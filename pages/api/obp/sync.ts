import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { OBPClient } from '../../../lib/obp-client';

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
    const obpClient = new OBPClient();
    
    // Get user's existing accounts
    const accounts = await prisma.account.findMany({
      where: {
        userId: userId,
      },
    });

    if (accounts.length === 0) {
      return res.status(404).json({ error: 'No connected accounts found' });
    }

    let totalNewTransactions = 0;
    let totalUpdatedAccounts = 0;

    // Sync each account
    for (const account of accounts) {
      try {
        // Get fresh account data from OBP
        const obpAccount = await obpClient.getAccount(account.plaidAccessToken, account.plaidAccountId);
        
        // Update account balance
        await prisma.account.update({
          where: { id: account.id },
          data: {
            balance: parseFloat(obpAccount.balance.amount),
            availableBalance: parseFloat(obpAccount.balance.amount),
          },
        });
        totalUpdatedAccounts++;

        // Get new transactions
        const transactions = await obpClient.getTransactions(account.plaidAccessToken, account.plaidAccountId, 50);
        
        for (const transaction of transactions) {
          // Check if transaction already exists
          const existingTransaction = await prisma.transaction.findFirst({
            where: {
              plaidTransactionId: transaction.id,
            },
          });

          if (!existingTransaction) {
            // Parse transaction amount
            const amount = parseFloat(transaction.details.value.amount);
            
            // Basic category mapping
            let category = 'Other';
            const description = transaction.details.description.toLowerCase();
            
            if (description.includes('payment') || description.includes('transfer')) {
              category = 'Transfer';
            } else if (description.includes('grocery') || description.includes('food')) {
              category = 'Food & Dining';
            } else if (description.includes('gas') || description.includes('fuel')) {
              category = 'Transportation';
            } else if (description.includes('amazon') || description.includes('shopping')) {
              category = 'Shopping';
            }

            // Find matching budget
            const budget = await prisma.budget.findFirst({
              where: {
                userId: userId,
                category: category,
                month: new Date(transaction.details.posted).getMonth() + 1,
                year: new Date(transaction.details.posted).getFullYear(),
              },
            });

            await prisma.transaction.create({
              data: {
                userId: userId,
                accountId: account.id,
                budgetId: budget?.id || null,
                plaidTransactionId: transaction.id,
                amount: amount,
                description: transaction.details.description,
                category: category,
                subcategory: transaction.details.type,
                date: new Date(transaction.details.posted),
              },
            });

            // Update budget if it's an expense
            if (budget && amount < 0) {
              await prisma.budget.update({
                where: { id: budget.id },
                data: {
                  spent: {
                    increment: Math.abs(amount)
                  }
                }
              });
            }

            totalNewTransactions++;
          }
        }
      } catch (error) {
        console.error(`Error syncing account ${account.id}:`, error);
      }
    }

    res.json({ 
      success: true, 
      newTransactions: totalNewTransactions,
      updatedAccounts: totalUpdatedAccounts,
      message: `Synced ${totalNewTransactions} new transactions and updated ${totalUpdatedAccounts} accounts`
    });
  } catch (error) {
    console.error('Error syncing with Open Bank Project:', error);
    res.status(500).json({ 
      error: 'Failed to sync with Open Bank Project',
      details: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : "Unknown error" 
    });
  }
}