import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { decryptPlaidToken } from '../../lib/encryption';
import { plaidClient } from '../../lib/plaid'; // Your Plaid client instance

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  try {
    // Get user's linked accounts
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        plaidAccessToken: true,
        plaidAccountId: true,
      },
    });

    if (!accounts.length) {
      return res.status(404).json({ error: 'No connected accounts found' });
    }

    let totalNewTransactions = 0;
    let totalUpdatedAccounts = 0;

    for (const account of accounts) {
      try {
        if (!account.plaidAccessToken || !account.plaidAccountId) {
          console.warn('[sync] Skipping account with missing Plaid info:', account.id);
          continue;
        }

        // Decrypt Plaid token
        const accessToken = decryptPlaidToken(account.plaidAccessToken) ?? account.plaidAccessToken;
        if (!accessToken) {
          console.warn('[sync] Could not decrypt Plaid token for account:', account.id);
          continue;
        }

        // Get balance from Plaid
        const balanceRes = await plaidClient.accountsBalanceGet({ access_token: accessToken });
        const plaidAcc = balanceRes.data.accounts.find(a => a.account_id === account.plaidAccountId);
        if (plaidAcc) {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              balance: plaidAcc.balances.current ?? 0,
              availableBalance: plaidAcc.balances.available ?? plaidAcc.balances.current ?? 0,
            },
          });
          totalUpdatedAccounts++;
        }

        // Get transactions from Plaid (last 30 days example)
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const txRes = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: thirtyDaysAgo.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          account_ids: [account.plaidAccountId],
        });

        for (const t of txRes.data.transactions) {
          const existing = await prisma.transaction.findFirst({
            where: { plaidTransactionId: t.transaction_id },
            select: { id: true },
          });
          if (existing) continue;

          const amount = t.amount * -1; // Plaid positive=expense, negative=credit, adjust if needed

          await prisma.transaction.create({
            data: {
              userId,
              accountId: account.id,
              plaidTransactionId: t.transaction_id,
              amount,
              description: t.name,
              category: t.category?.[0] || 'Other',
              subcategory: t.category?.[1] || null,
              date: new Date(t.date),
            },
          });

          totalNewTransactions++;
        }
      } catch (err) {
        console.error(`[sync] Error syncing account ${account.id}:`, err);
        continue;
      }
    }

    return res.json({
      success: true,
      newTransactions: totalNewTransactions,
      updatedAccounts: totalUpdatedAccounts,
      message: `Synced ${totalNewTransactions} new transactions and updated ${totalUpdatedAccounts} accounts`,
    });
  } catch (error: any) {
    console.error('Error syncing with Plaid:', error);
    return res.status(500).json({
      error: 'Failed to sync with Plaid',
      details: error?.message ?? 'Unknown error',
    });
  }
}