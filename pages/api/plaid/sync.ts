// pages/api/plaid/sync.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import prisma from '../../../lib/prisma';
import { decryptPlaidToken } from '../../../lib/encryption';
import CreditCardAutomation from '../../../lib/credit-card-automation';

// optional realtime emit
let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch {}
}

// Plaid client (explicit version header)
const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[(process.env.PLAID_ENV as any) || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
        'PLAID-SECRET': process.env.PLAID_SECRET || '',
        'Plaid-Version': '2020-09-14',
      },
    },
  })
);

// Helpers
function calcAmount(plaidAmount: number, accountType?: string) {
  // Credit: purchases are negative (outflow), payments positive (inflow)
  if (accountType === 'credit') {
    // For credit cards: positive Plaid amount = money spent (negative in our system)
    // negative Plaid amount = payment made (positive in our system)
    return plaidAmount > 0 ? -plaidAmount : Math.abs(plaidAmount);
  } else {
    // For depository: negative Plaid amount = money spent (negative in our system)
    // positive Plaid amount = money received (positive in our system)
    return -plaidAmount;
  }
}

function safeDecryptToken(token: string): string | null {
  if (!token) return null;
  
  // Check if token is already decrypted (starts with access-)
  if (token.startsWith('access-')) {
    return token;
  }
  
  // Try to decrypt
  try {
    const decrypted = decryptPlaidToken(token);
    if (decrypted && decrypted.startsWith('access-')) {
      return decrypted;
    }
  } catch (error) {
    console.warn('[plaid/sync] Token decryption failed:', error instanceof Error ? error.message : error);
  }
  
  // Fallback to raw token
  console.warn('[plaid/sync] Using raw token as fallback');
  return token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Handle webhook calls (bypass auth for internal calls)
  let userId: string;
  const webhookUserId = req.body?.webhookUserId;
  if (webhookUserId && req.headers['user-agent']?.includes('plaid-webhook-sync')) {
    userId = webhookUserId;
    console.log(`[plaid/sync] Processing webhook sync for user ${userId}`);
  } else {
    // Normal authenticated call
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
    userId = (session.user as any).id;
    if (!userId) return res.status(401).json({ error: 'No user ID found' });
  }

  let broadcastQueued = false;
  let totalNewTransactions = 0;
  let totalUpdatedAccounts = 0;

  try {
    // Pull all Plaid items for this user, with their accounts (and cursor on the item)
    const items = await prisma.plaidItem.findMany({
      where: { userId },
      include: {
        accounts: {
          select: {
            id: true,
            plaidAccessToken: true,
            plaidAccountId: true,
            accountType: true,
            accountName: true,
          },
        },
      },
    });

    if (!items.length) {
      return res.status(404).json({ error: 'No connected items found' });
    }

    for (const item of items) {
      // Need at least one account to get an access token
      if (!item.accounts.length) continue;

      // Use the (decrypted) access token from any account under this item
      const first = item.accounts.find(a => a.plaidAccessToken);
      if (!first?.plaidAccessToken) {
        console.warn(`[plaid/sync] No access token found for item ${item.id}`);
        continue;
      }

      const accessToken = safeDecryptToken(first.plaidAccessToken);
      if (!accessToken) {
        console.error(`[plaid/sync] Failed to decrypt token for item ${item.id}`);
        continue;
      }

      // Map plaidAccountId → local account
      const byPlaidId = new Map(
        item.accounts
          .filter(a => a.plaidAccountId)
          .map(a => [a.plaidAccountId as string, a])
      );

      // 1) Update balances (optional but nice)
      try {
        const accountsResp = await plaidClient.accountsGet({ access_token: accessToken });
        for (const pAcc of accountsResp.data.accounts) {
          const local = byPlaidId.get(pAcc.account_id);
          if (!local) continue;
          await prisma.account.update({
            where: { id: local.id },
            data: {
              balance: pAcc.balances.current ?? 0,
              availableBalance: pAcc.balances.available ?? null,
            },
          });
          totalUpdatedAccounts++;
        }
      } catch (e) {
        console.warn('[plaid/sync] accountsGet failed (continuing)', e);
      }

      // 2) Transactions sync - handle both initial and incremental
      let cursor = item.cursor || null;
      const added: any[] = [];
      const modified: any[] = [];
      const removed: any[] = [];
      let hasMore = true;
      let requestCount = 0;
      const maxRequests = 10; // Prevent infinite loops

      // If no cursor, this is first sync - get recent transactions
      if (!cursor) {
        console.log(`[plaid/sync] First sync for item ${item.id}, fetching recent transactions`);
      }

      while (hasMore && requestCount < maxRequests) {
        try {
          const resp = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
            count: 250,
          });
          
          added.push(...resp.data.added);
          modified.push(...resp.data.modified);
          removed.push(...resp.data.removed);
          
          hasMore = resp.data.has_more;
          cursor = resp.data.next_cursor;
          requestCount++;
          
          console.log(`[plaid/sync] Batch ${requestCount}: +${resp.data.added.length} ~${resp.data.modified.length} -${resp.data.removed.length}`);
        } catch (error) {
          console.error(`[plaid/sync] transactionsSync failed for item ${item.id}:`, error);
          break;
        }
      }

      // Save cursor
      if (cursor !== item.cursor) {
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { cursor },
        });
        console.log(`[plaid/sync] Updated cursor for item ${item.id}`);
      }

      // 3) Handle removed transactions
      for (const removedTx of removed) {
        try {
          const existing = await prisma.transaction.findUnique({
            where: { plaidTransactionId: removedTx.transaction_id },
            select: { id: true, budgetId: true, amount: true },
          });
          
          if (existing) {
            // Reverse budget impact before deletion
            if (existing.budgetId && existing.amount < 0) {
              await prisma.budget.update({
                where: { id: existing.budgetId },
                data: { spent: { decrement: Math.abs(existing.amount) } },
              });
            }
            
            await prisma.transaction.delete({
              where: { id: existing.id },
            });
            console.log(`[plaid/sync] Removed transaction ${removedTx.transaction_id}`);
            broadcastQueued = true;
          }
        } catch (error) {
          console.warn(`[plaid/sync] Failed to remove transaction ${removedTx.transaction_id}:`, error);
        }
      }

      // 4) Handle modified transactions
      for (const modifiedTx of modified) {
        try {
          const local = byPlaidId.get(modifiedTx.account_id);
          if (!local) continue;

          const existing = await prisma.transaction.findUnique({
            where: { plaidTransactionId: modifiedTx.transaction_id },
            include: { budget: true },
          });

          if (existing) {
            const newAmount = calcAmount(modifiedTx.amount, local.accountType);
            const amountDiff = newAmount - existing.amount;

            await prisma.transaction.update({
              where: { id: existing.id },
              data: {
                amount: newAmount,
                description: modifiedTx.name,
                date: new Date(modifiedTx.date),
              },
            });

            // Update budget spent amount if changed
            if (existing.budget && amountDiff !== 0 && newAmount < 0) {
              await prisma.budget.update({
                where: { id: existing.budget.id },
                data: { spent: { increment: Math.abs(amountDiff) } },
              });
            }
            
            console.log(`[plaid/sync] Modified transaction ${modifiedTx.transaction_id}`);
            broadcastQueued = true;
          }
        } catch (error) {
          console.warn(`[plaid/sync] Failed to update transaction ${modifiedTx.transaction_id}:`, error);
        }
      }

      // 5) Insert NEW transactions, routed to the correct account
      for (const t of added) {
        const local = byPlaidId.get(t.account_id);
        if (!local) {
          console.warn(`[plaid/sync] No local account found for Plaid account ${t.account_id}`);
          continue;
        }

        // De-dupe by Plaid ID
        const exists = await prisma.transaction.findUnique({
          where: { plaidTransactionId: t.transaction_id },
          select: { id: true },
        });
        if (exists) {
          console.log(`[plaid/sync] Transaction ${t.transaction_id} already exists, skipping`);
          continue;
        }

        const amountFinal = calcAmount(t.amount, local.accountType);
        const tDate = new Date(t.date);
        const txMonth = tDate.getMonth() + 1;
        const txYear = tDate.getFullYear();

        // Categorize (keep your existing helper logic)
        let category = CreditCardAutomation.categorizeTransaction(
          t.name,
          t.category || [],
          t.personal_finance_category?.detailed || t.personal_finance_category?.primary,
          amountFinal
        );
        // Credit card specific overrides
        if (local.accountType === 'credit') {
          if (t.amount < 0) {
            category = 'Credit Card Payments';
          } else if (
            t.category?.includes('Interest') ||
            t.category?.includes('Fee') ||
            t.name.toLowerCase().includes('interest') ||
            t.name.toLowerCase().includes('fee')
          ) {
            category = 'Interest & Fees';
          }
        }

        // Optional: match manual uncleared within ±3 days and ±5%
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

        await prisma.$transaction(async (trx) => {
          if (unclearedManual) {
            console.log(`[plaid/sync] Matching manual transaction found for ${t.transaction_id}`);
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

          // Find/create budget bucket for any category
          let budget = await trx.budget.findFirst({
            where: { userId, name: category, month: txMonth, year: txYear },
          });
          
          if (!budget) {
            // Determine the appropriate category group for the budget
            let categoryGroup = 'General';
            if (category === 'To Be Assigned') {
              categoryGroup = 'Income';
            } else if (category === 'Credit Card Payments') {
              categoryGroup = 'Credit Card Payments';
            } else if (['Transportation', 'Gas & Fuel', 'Eating Out', 'Groceries', 'Shopping'].includes(category)) {
              categoryGroup = 'Frequent Spending';
            } else if (['Hobbies', 'Fun Money', 'Entertainment'].includes(category)) {
              categoryGroup = 'Just for Fun';
            } else if (['Mortgage/Rent', 'Electric', 'Gas', 'Water', 'Internet', 'Car Insurance', 'Cellphone'].includes(category)) {
              categoryGroup = 'Monthly Bills';
            }

            budget = await trx.budget.create({
              data: {
                userId,
                name: category,
                category: categoryGroup,
                amount: 0,
                spent: 0,
                month: txMonth,
                year: txYear,
              },
            });
            console.log(`[plaid/sync] Created new budget: ${category} in ${categoryGroup}`);
          }

          // Create transaction
          const newTransaction = await trx.transaction.create({
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
          
          console.log(`[plaid/sync] Created transaction: ${t.name} (${amountFinal}) -> ${local.accountName}`);

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
    // belt-and-suspenders: try to notify even if response already sent
    if (broadcastQueued && triggerFinancialSync) {
      try { await triggerFinancialSync(userId); } catch {}
    }
  }
}