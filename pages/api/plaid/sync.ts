import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PlaidApi, Configuration, PlaidEnvironments, TransactionsGetRequest, AccountsGetRequest } from 'plaid';
import { PrismaClient } from '@prisma/client';
import CreditCardAutomation from '../../../lib/credit-card-automation';
import { SecureAccountService, SecurityAuditService, SecureTransactionService } from '../../../lib/secure-data';

const prisma = new PrismaClient();

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

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
    // Log sync operation for security audit
    await SecurityAuditService.logSecurityEvent({
      userId,
      action: 'SYNC_ACCOUNTS',
      resource: 'plaid_data',
      success: true,
      details: 'User initiated account sync',
    });

    // Get all user accounts (tokens remain encrypted)
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
        // Update account balances
        const accountsRequest: AccountsGetRequest = {
          access_token: account.plaidAccessToken,
        };
        const accountsResponse = await plaidClient.accountsGet(accountsRequest);
        const plaidAccount = accountsResponse.data.accounts.find(
          acc => acc.account_id === account.plaidAccountId
        );

        if (plaidAccount) {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              balance: plaidAccount.balances.current || 0,
              availableBalance: plaidAccount.balances.available,
            },
          });
          totalUpdatedAccounts++;
        }

        // Get transactions from the last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const transactionsRequest: TransactionsGetRequest = {
          access_token: account.plaidAccessToken,
          start_date: thirtyDaysAgo.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
        };
        const transactionsResponse = await plaidClient.transactionsGet(transactionsRequest);

        // Process new transactions
        for (const transaction of transactionsResponse.data.transactions) {
          // Check if transaction already exists
          const existingTransaction = await prisma.transaction.findUnique({
            where: {
              plaidTransactionId: transaction.transaction_id,
            },
          });

          if (!existingTransaction) {
            // Calculate expected amount for matching (applying same logic as transaction creation)
            let expectedAmount;
            if (plaidAccount?.type === 'credit') {
              // Credit card logic: flip sign for credit cards
              expectedAmount = -transaction.amount;
            } else {
              // Regular account logic: flip sign
              expectedAmount = -transaction.amount;
            }

            // Check for matching uncleared manual transaction
            const unclearedManualTransaction = await prisma.transaction.findFirst({
              where: {
                userId: userId,
                accountId: account.id,
                isManual: true,
                cleared: false,
                date: {
                  gte: new Date(new Date(transaction.date).getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
                  lte: new Date(new Date(transaction.date).getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days after
                },
                amount: {
                  gte: expectedAmount * 0.95, // 5% tolerance
                  lte: expectedAmount * 1.05,
                },
              },
            });

            if (unclearedManualTransaction) {
              // Match found - update the manual transaction to be cleared and link to Plaid transaction
              await prisma.transaction.update({
                where: { id: unclearedManualTransaction.id },
                data: {
                  cleared: true,
                  plaidTransactionId: transaction.transaction_id,
                  amount: expectedAmount, // Use the correctly calculated amount
                  description: transaction.name, // Use Plaid's description
                  date: new Date(transaction.date), // Use Plaid's date
                },
              });
              continue; // Skip creating a new transaction
            }
            // Enhanced smart categorization using Plaid data
            console.log('Transaction categorization debug:', {
              name: transaction.name,
              category: transaction.category,
              personal_finance_category: transaction.personal_finance_category
            });
            
            let category = CreditCardAutomation.categorizeTransaction(
              transaction.name,
              transaction.category || [],
              transaction.personal_finance_category?.detailed || transaction.personal_finance_category?.primary
            );
            
            // DEBUG: Log transaction details
            console.log('🔍 Processing Plaid sync transaction:', {
              name: transaction.name,
              plaidAmount: transaction.amount,
              accountType: plaidAccount?.type,
              isCredit: plaidAccount?.type === 'credit',
              category: transaction.category
            });
            
            // Calculate amount based on account type
            let amount;
            if (plaidAccount?.type === 'credit') {
              // Credit card logic:
              // - Plaid positive amounts = purchases = negative outflows (increase debt)
              // - Plaid negative amounts = payments = positive inflows (reduce debt)
              amount = -transaction.amount; // Flip sign for credit cards (purchases become negative, payments become positive)
              
              // Credit card payments (negative Plaid amounts become positive after flip = payments)
              if (transaction.amount < 0) {
                category = 'Credit Card Payments';
              }
              // Interest and fees (positive Plaid amounts that are fees/interest become negative after flip)
              else if (transaction.category?.includes('Interest') || 
                       transaction.category?.includes('Fee') ||
                       transaction.name.toLowerCase().includes('interest') ||
                       transaction.name.toLowerCase().includes('fee')) {
                category = 'Interest & Fees';
              }
            } else {
              // Regular account logic:
              // - Plaid positive amounts = deposits = positive inflows
              // - Plaid negative amounts = spending = negative outflows
              amount = -transaction.amount; // Flip sign for regular accounts (Plaid convention)
            }
            
            console.log('🔍 Calculated sync amount:', {
              originalPlaidAmount: transaction.amount,
              calculatedAmount: amount,
              accountType: plaidAccount?.type,
              finalCategory: category
            });
            
            // Find matching budget for automatic linking
            const budget = await prisma.budget.findFirst({
              where: {
                userId: userId,
                category: category,
                month: new Date(transaction.date).getMonth() + 1,
                year: new Date(transaction.date).getFullYear(),
              },
            });
            
            await prisma.transaction.create({
              data: {
                userId: userId,
                accountId: account.id,
                budgetId: budget?.id || null,
                plaidTransactionId: transaction.transaction_id,
                amount: amount,
                description: transaction.name,
                category: category,
                subcategory: transaction.category?.[1] || null,
                date: new Date(transaction.date),
                cleared: true, // Plaid transactions are always cleared
                isManual: false, // Plaid transactions are not manual
                approved: false, // Imported transactions require approval
              },
            });
            
            // Update budget spent amount if linked and it's an expense (negative amount)
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
      } catch (accountError) {
        console.error(`Error syncing account ${account.id}:`, accountError);
        // Continue with other accounts even if one fails
      }
    }

    res.json({ 
      success: true, 
      newTransactions: totalNewTransactions,
      updatedAccounts: totalUpdatedAccounts,
      message: `Synced ${totalNewTransactions} new transactions and updated ${totalUpdatedAccounts} accounts`
    });
  } catch (error) {
    console.error('Error syncing accounts:', error);
    res.status(500).json({ error: 'Failed to sync accounts' });
  }
}