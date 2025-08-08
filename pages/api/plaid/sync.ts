import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import prisma from '../../../lib/prisma';
import CreditCardAutomation from '../../../lib/credit-card-automation';

let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch {}
}

const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[(process.env.PLAID_ENV as any) || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
      'Plaid-Version': '2020-09-14',
    },
  },
}));

function calcAmount(plaidAmount: number, accountType?: string) {
  return accountType === 'credit'
    ? (plaidAmount > 0 ? -plaidAmount : Math.abs(plaidAmount))
    : -plaidAmount;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  let broadcastQueued = false;
  let totalNewTransactions = 0;
  let totalUpdatedAccounts = 0;

  try {
    // Pull all Plaid items for this user, with their accounts
    const items = await prisma.plaidItem.findMany({
      where: { userId },
      include: {
        accounts: {
          select: {
            id: true,
            plaidAccessToken: true,
            plaidAccountId: true,
            accountType: true,
          },
        },
      },
    });
    if (!items.length) return res.status(404).json({ error: 'No connected items found' });

    // Process each ITEM once (single cursor per item)
    for (const item of items) {
      if (!item.accounts.length) continue;
      const accessToken = item.accounts[0].plaidAccessToken;
      if (!accessToken) continue;

      // Map plaidAccountId -> local account
      const byPlaidId = new Map(item.accounts.map(a => [a.plaidAccountId, a]));

      // 1) Update balances for accounts under this item
      const accountsResp = await plaidClient.accountsGet({ access_token: accessToken });
      for (const pAcc of accountsResp.data.accounts) {
        const local = byPlaidId.get(pAcc.account_id);
        if (!local) continue;
        await prisma.account.update({
          where: { id: local.id },
          data: {
            balance: pAcc.balances.current || 0,
            availableBalance: pAcc.balances.available ?? null,
          },
        });
        totalUpdatedAccounts++;
      }

      // 2) transactions/sync loop for this item
      let cursor = item.cursor || null;
      const added: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const resp = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: cursor || undefined,
          count: 250,
        });
        added.push(...resp.data.added);
        hasMore = resp.data.has_more;
        cursor = resp.data.next_cursor;
      }

      // Save new cursor back to the item
      await prisma.plaidItem.update({ where: { id: item.id }, data: { cursor } });

      // 3) Insert NEW transactions, routed to the correct local account
      for (const t of added) {
        const local = byPlaidId.get(t.account_id);
        if (!local) continue;

        // De-dupe by Plaid ID
        const exists = await prisma.transaction.findUnique({
          where: { plaidTransactionId: t.transaction_id },
          select: { id: true },
        });
        if (exists) continue;

        // Match potential manual transaction (±5%, ±3 days)
        const amountFinal = calcAmount(t.amount, local.accountType);
        const tDate = new Date(t.date);
        const matchStart = new Date(tDate.getTime() - 3 * 24 * 60 * 60 * 1000);
        const matchEnd   = new Date(tDate.getTime() + 3 * 24 * 60 * 60 * 1000);

        const unclearedManual = await prisma.transaction.findFirst({
          where: {
            userId,
            accountId: local.id,
            isManual: true,
            cleared: false,
            date: { gte: matchStart, lte: matchEnd },
            amount: { gte: amountFinal * 0.95, lte: amountFinal * 1.05 },
          },
          select: { id: true },
        });

        // Categorize
        let category = CreditCardAutomation.categorizeTransaction(
          t.name,
          t.category || [],
          t.personal_finance_category?.detailed || t.personal_finance_category?.primary,
          amountFinal
        );
        if (local.accountType === 'credit') {
          if (t.amount < 0) category = 'Credit Card Payments';
          else if (
            t.category?.includes('Interest') ||
            t.category?.includes('Fee') ||
            t.name.toLowerCase().includes('interest') ||
            t.name.toLowerCase().includes('fee')
          ) category = 'Interest & Fees';
        }

        const txMonth = tDate.getMonth() + 1;
        const txYear  = tDate.getFullYear();

        await prisma.$transaction(async (trx) => {
          if (unclearedManual) {
            await trx.transaction.update({
              where: { id: unclearedManual.id },
              data: {
                cleared: true,
                plaidTransactionId: t.transaction_id,
                amount: amountFinal,
                description: t.name,
                date: tDate,
              },
            });
            return;
          }

          // Find/create budget bucket
          let budget = await trx.budget.findFirst({
            where: { userId, name: category, month: txMonth, year: txYear },
          });
          if (!budget && category === 'To Be Assigned') {
            budget = await trx.budget.create({
              data: {
                userId,
                name: 'To Be Assigned',
                category: 'Income',
                amount: 0,
                spent: 0,
                month: txMonth,
                year: txYear,
              },
            });
          }

          // Create transaction
          await trx.transaction.create({
            data: {
              userId,
              accountId: local.id,
              budgetId: budget?.id || null,
              plaidTransactionId: t.transaction_id,
              amount: amountFinal,
              description: t.name,
              category,
              subcategory: t.category?.[1] || null,
              date: tDate,
              cleared: true,
              isManual: false,
              approved: false,
            },
          });

          // Update budget totals
          if (budget) {
            if (amountFinal < 0) {
              await trx.budget.update({
                where: { id: budget.id },
                data: { spent: { increment: Math.abs(amountFinal) } },
              });
            } else if (amountFinal > 0 && category === 'To Be Assigned') {
              await trx.budget.update({
                where: { id: budget.id },
                data: { amount: { increment: amountFinal } },
              });
            }
          }
        });

        totalNewTransactions++;
        broadcastQueued = true;
      }
    }

    if (broadcastQueued && triggerFinancialSync) {
      await triggerFinancialSync(userId);
    }

    return res.json({
      success: true,
      newTransactions: totalNewTransactions,
      updatedAccounts: totalUpdatedAccounts,
      message: `Synced ${totalNewTransactions} new transactions and updated ${totalUpdatedAccounts} accounts`,
    });
  } catch (error) {
    console.error('Error syncing accounts:', error);
    return res.status(500).json({ error: 'Failed to sync accounts' });
  } finally {
    if (broadcastQueued && triggerFinancialSync) {
      try { await triggerFinancialSync(userId); } catch {}
    }
  }
}