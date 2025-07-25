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
    
    // Test authentication
    await obpClient.authenticate();
    
    // Get user's accounts
    const accounts = await obpClient.getAccounts();
    
    if (accounts.length === 0) {
      return res.json({ 
        success: true, 
        accounts: 0,
        transactions: 0,
        message: 'OBP connection successful, but no accounts found. You may need to create accounts through the OBP web interface or connect real bank accounts.'
      });
    }

    // Store accounts in database
    const savedAccounts = await Promise.all(
      accounts.map(async (account) => {
        // Check if account already exists
        const existingAccount = await prisma.account.findFirst({
          where: {
            userId: userId,
            plaidAccountId: account.id, // Reusing the field for OBP account ID
          },
        });

        if (existingAccount) {
          // Update existing account
          return await prisma.account.update({
            where: { id: existingAccount.id },
            data: {
              balance: parseFloat(account.balance.amount),
              accountName: account.label,
              accountType: account.type,
            },
          });
        } else {
          // Create new account
          return await prisma.account.create({
            data: {
              userId: userId,
              plaidAccountId: account.id,
              plaidAccessToken: account.bank_id, // Store bank_id for reference
              accountName: account.label,
              accountType: account.type,
              accountSubtype: account.type,
              balance: parseFloat(account.balance.amount),
              availableBalance: parseFloat(account.balance.amount),
            },
          });
        }
      })
    );

    // Get and store transactions for each account
    let totalTransactions = 0;
    
    for (const account of accounts) {
      try {
        const transactions = await obpClient.getTransactions(account.bank_id, account.id, 50);
        const savedAccount = savedAccounts.find(sa => sa.plaidAccountId === account.id);
        
        if (savedAccount) {
          for (const transaction of transactions) {
            // Check if transaction already exists
            const existingTransaction = await prisma.transaction.findFirst({
              where: {
                plaidTransactionId: transaction.id,
              },
            });

            if (!existingTransaction) {
              // Parse transaction amount (negative for debits, positive for credits)
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
                  accountId: savedAccount.id,
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

              totalTransactions++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing transactions for account ${account.id}:`, error);
      }
    }

    res.json({ 
      success: true, 
      accounts: savedAccounts.length,
      transactions: totalTransactions,
      message: `Connected ${savedAccounts.length} accounts and imported ${totalTransactions} transactions`
    });
  } catch (error) {
    console.error('Error connecting to Open Bank Project:', error);
    console.error('Error stack:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error instanceof Error ? error.stack : "No stack trace" : "No stack trace" : "No stack trace" : 'No stack trace');
    res.status(500).json({ 
      error: 'Failed to connect to Open Bank Project',
      details: error instanceof Error ? error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : "Unknown error" : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      fullError: process.env.NODE_ENV === 'development' && error instanceof Error ? error instanceof Error ? error instanceof Error ? error instanceof Error ? error.stack : "No stack trace" : "No stack trace" : "No stack trace" : undefined
    });
  }
}