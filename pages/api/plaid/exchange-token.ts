import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PayeeService } from '../../../lib/payee-service';
import prisma from '../../../lib/prisma';

const PLAID_BASE_URLS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com'
};

// Improved categorization function with proper income handling
function categorizeTransaction(transactionName: string, categories: string[], amount: number): string {
  const name = transactionName.toLowerCase();
  const category = categories[0]?.toLowerCase() || '';
  
  // Handle transfers first (these shouldn't be counted as income)
  if (category.includes('transfer') || name.includes('payment to') || name.includes('payment from') || 
      name.includes('transfer') || name.includes('ach transfer')) {
    return 'Transfer';
  }
  
  // ALL positive amounts should be treated as income unless they're clearly transfers
  if (amount > 0) {
    return 'To Be Assigned';
  }
  
  // Categorization logic for expenses (negative amounts)
  if (name.includes('starbucks') || name.includes('dunkin') || category.includes('restaurant')) {
    return 'Food & Dining';
  }
  if (name.includes('gas') || name.includes('shell') || name.includes('exxon') || category.includes('gas')) {
    return 'Transportation';
  }
  if (name.includes('walmart') || name.includes('target') || name.includes('grocery') || category.includes('shop')) {
    return 'Groceries';
  }
  
  return 'Needs a Category';
}

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

  const { public_token } = req.body;

  try {
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    const baseUrl = PLAID_BASE_URLS[plaidEnv as keyof typeof PLAID_BASE_URLS];

    console.log('🔄 Starting minimal token exchange for user:', userId);

    // Exchange public token for access token
    const exchangeResponse = await fetch(`${baseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
      body: JSON.stringify({
        public_token,
      }),
    });

    if (!exchangeResponse.ok) {
      const errorData = await exchangeResponse.text();
      console.error('❌ Plaid exchange error:', errorData);
      throw new Error(`Failed to exchange token: ${exchangeResponse.status}`);
    }

    const exchangeData = await exchangeResponse.json();
    const accessToken = exchangeData.access_token;
    console.log('✅ Access token obtained');

    // Get account information
    const accountsResponse = await fetch(`${baseUrl}/accounts/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
      body: JSON.stringify({
        access_token: accessToken,
      }),
    });

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.text();
      console.error('❌ Plaid accounts error:', errorData);
      throw new Error(`Failed to get accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();
    console.log(`✅ Retrieved ${accountsData.accounts.length} accounts`);

    // Store accounts in database
    const accounts = await Promise.all(
      accountsData.accounts.map(async (account: any) => {
        console.log(`📝 Creating account: ${account.name} (${account.type})`);
        
        return await prisma.account.create({
          data: {
            userId: userId,
            plaidAccountId: account.account_id,
            plaidAccessToken: accessToken, // Store directly for now
            accountName: account.name,
            accountType: account.type,
            accountSubtype: account.subtype || '',
            balance: account.balances.current || 0,
            availableBalance: account.balances.available,
          },
        });
      })
    );

    console.log(`✅ Created ${accounts.length} accounts in database`);

    // Create credit card payment payees for YNAB-style functionality
    console.log('💳 Creating credit card payment payees...');
    await PayeeService.createCreditCardPaymentPayees(userId);
    console.log('✅ Credit card payment payees created');

    // Import transactions
    console.log('📊 Importing transactions...');
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const transactionsResponse = await fetch(`${baseUrl}/transactions/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
      body: JSON.stringify({
        access_token: accessToken,
        start_date: thirtyDaysAgo.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      }),
    });

    if (transactionsResponse.ok) {
      const transactionsData = await transactionsResponse.json();
      console.log(`📊 Processing ${transactionsData.transactions.length} transactions`);

      // Import transactions
      await Promise.all(
        transactionsData.transactions.map(async (transaction: any) => {
          const account = accounts.find(acc => acc.plaidAccountId === transaction.account_id);
          if (!account) return;

          const isCredit = account.accountType === 'credit';
          let amount = transaction.amount;

          // Fix amount signs for credit cards
          if (isCredit) {
            // Credit card transactions:
            // - Plaid positive amounts = purchases → should be negative outflows
            // - Plaid negative amounts = payments → should be positive inflows
            if (transaction.amount > 0) {
              // Purchase: positive Plaid amount becomes negative (outflow)
              amount = -transaction.amount;
            } else {
              // Payment: negative Plaid amount becomes positive (inflow)
              amount = Math.abs(transaction.amount);
            }
          }

          // Categorize transaction
          const category = categorizeTransaction(transaction.name, transaction.category || [], amount);

          try {
            // Find or create budget for this category
            const transactionDate = new Date(transaction.date);
            const month = transactionDate.getMonth() + 1;
            const year = transactionDate.getFullYear();

            let budget = await prisma.budget.findFirst({
              where: {
                userId: userId,
                name: category,
                month: month,
                year: year,
              }
            });

            // Auto-create budget if it doesn't exist
            if (!budget) {
              if (category === 'To Be Assigned') {
                budget = await prisma.budget.create({
                  data: {
                    userId: userId,
                    name: 'To Be Assigned',
                    category: 'Income',
                    amount: 0,
                    spent: 0,
                    month: month,
                    year: year
                  }
                });
                console.log(`📊 Created "To Be Assigned" budget for ${month}/${year}`);
              } else {
                budget = await prisma.budget.create({
                  data: {
                    userId: userId,
                    name: category,
                    category: category === 'Transfer' ? 'Transfer' : 'Needs a Category',
                    amount: 0,
                    spent: 0,
                    month: month,
                    year: year
                  }
                });
                console.log(`📊 Created budget: ${category} for ${month}/${year}`);
              }
            }

            // Create transaction with budget link
            await prisma.transaction.create({
              data: {
                userId: userId,
                accountId: account.id,
                budgetId: budget.id,
                plaidTransactionId: transaction.transaction_id,
                amount: amount,
                description: transaction.name,
                category: category,
                subcategory: (transaction.category && transaction.category[0]) || '',
                date: transactionDate,
                cleared: true,
                approved: false,
                isManual: false,
              },
            });

            // Update budget based on transaction type
            if (category === 'To Be Assigned' && amount > 0) {
              // Income: increase the budget amount
              await prisma.budget.update({
                where: { id: budget.id },
                data: {
                  amount: {
                    increment: amount
                  }
                }
              });
              console.log(`💰 Added $${amount} to "To Be Assigned" budget`);
            } else if (category !== 'Transfer' && amount < 0) {
              // Expense: increase the spent amount
              await prisma.budget.update({
                where: { id: budget.id },
                data: {
                  spent: {
                    increment: Math.abs(amount)
                  }
                }
              });
              console.log(`💸 Added $${Math.abs(amount)} to ${category} spent`);
            }

            console.log(`✅ Created transaction: ${transaction.name} - $${amount} → ${category}`);
          } catch (error) {
            console.error(`❌ Failed to create transaction ${transaction.name}:`, error);
          }
        })
      );
      
      console.log('✅ Transactions imported successfully');
    }

    res.json({ 
      success: true, 
      accounts: accounts.length,
      message: 'Accounts connected successfully'
    });

  } catch (error) {
    console.error('❌ Exchange token error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}