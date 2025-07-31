import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import CreditCardAutomation from '../../../lib/credit-card-automation';
import { SecureAccountService, SecurityAuditService } from '../../../lib/secure-data';

const prisma = new PrismaClient();

const PLAID_BASE_URLS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com'
};

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
      console.error('Plaid exchange error:', errorData);
      throw new Error(`Failed to exchange token: ${exchangeResponse.status}`);
    }

    const exchangeData = await exchangeResponse.json();
    const accessToken = exchangeData.access_token;

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
      console.error('Plaid accounts error:', errorData);
      throw new Error(`Failed to get accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();

    // Store accounts in database with encrypted tokens
    const accounts = await Promise.all(
      accountsData.accounts.map(async (account: any) => {
        // Log account creation for security audit
        await SecurityAuditService.logSecurityEvent({
          userId,
          action: 'CREATE_ACCOUNT',
          resource: 'plaid_account',
          success: true,
          details: `Created account: ${account.name} (${account.type})`,
        });

        return await SecureAccountService.createAccount({
          userId: userId,
          plaidAccountId: account.account_id,
          plaidAccessToken: accessToken, // This will be encrypted automatically
          accountName: account.name,
          accountType: account.type,
          accountSubtype: account.subtype || '',
          balance: account.balances.current || 0,
          availableBalance: account.balances.available,
        });
      })
    );

    // Auto-create budgets and goals for credit cards
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    await Promise.all(
      accounts.map(async (account, index) => {
        const plaidAccount = accountsData.accounts[index];
        
        // Check if this is a credit card account
        if (plaidAccount.type === 'credit') {
          const creditCardName = plaidAccount.name || 'Credit Card';
          const currentBalance = Math.abs(plaidAccount.balances.current || 0);
          
          // Calculate suggested monthly payment (minimum 2% of balance or $25, whichever is higher)
          const suggestedPayment = Math.max(Math.round(currentBalance * 0.02), 25);
          
          // Create credit card payment budget category
          try {
            await prisma.budget.create({
              data: {
                userId: userId,
                name: `${creditCardName} Payment`,
                amount: suggestedPayment,
                category: 'Credit Card Payment',
                month: currentMonth,
                year: currentYear,
                spent: 0,
              },
            });
          } catch (error) {
            // Budget might already exist, ignore duplicate error
            console.log(`Budget for ${creditCardName} already exists`);
          }
          
          // Create debt payoff goal if there's a balance
          if (currentBalance > 0) {
            try {
              // Calculate payoff timeline (assuming minimum payments)
              const monthsToPayoff = Math.ceil(currentBalance / suggestedPayment);
              const targetDate = new Date();
              targetDate.setMonth(targetDate.getMonth() + monthsToPayoff);
              
              await prisma.goal.create({
                data: {
                  userId: userId,
                  name: `Pay Off ${creditCardName}`,
                  description: `Pay off credit card debt. Current balance: $${currentBalance.toFixed(2)}`,
                  targetAmount: 0, // Goal is to reach $0 debt
                  currentAmount: -currentBalance, // Negative because it's debt
                  type: 'debt',
                  targetDate: targetDate,
                  priority: 1,
                },
              });
            } catch (error) {
              // Goal might already exist, ignore duplicate error
              console.log(`Goal for ${creditCardName} already exists`);
            }
          }
        }
      })
    );

    // Get recent transactions
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

    if (!transactionsResponse.ok) {
      const errorData = await transactionsResponse.text();
      console.error('Plaid transactions error:', errorData);
      throw new Error(`Failed to get transactions: ${transactionsResponse.status}`);
    }

    const transactionsData = await transactionsResponse.json();

    // Store transactions in database with smart categorization
    let totalTransactions = 0;
    await Promise.all(
      transactionsData.transactions.map(async (transaction: any) => {
        const account = accounts.find(acc => acc.plaidAccountId === transaction.account_id);
        if (account) {
          const plaidAccount = accountsData.accounts.find((acc: any) => acc.account_id === transaction.account_id);
          const isCredit = plaidAccount?.type === 'credit';
          
          // DEBUG: Log transaction details
          console.log('🔍 Processing Plaid transaction:', {
            name: transaction.name,
            plaidAmount: transaction.amount,
            accountType: plaidAccount?.type,
            isCredit: isCredit,
            category: transaction.category
          });
          
          // Calculate amount based on account type
          let amount;
          
          if (isCredit) {
            // Credit card logic:
            // - Plaid positive amounts = payments = positive inflows (reduce debt)
            // - Plaid negative amounts = purchases = negative outflows (increase debt)
            amount = transaction.amount; // Use Plaid amount directly for credit cards
          } else {
            // Regular account logic:
            // - Plaid positive amounts = deposits = positive inflows
            // - Plaid negative amounts = spending = negative outflows
            amount = -transaction.amount; // Flip sign for regular accounts (Plaid convention)
          }
          
          console.log('🔍 Calculated amount:', {
            originalPlaidAmount: transaction.amount,
            calculatedAmount: amount,
            accountType: plaidAccount?.type
          });
          
          // Get smart category using enhanced Plaid categorization
          let category = CreditCardAutomation.categorizeTransaction(
            transaction.name, 
            transaction.category || [],
            transaction.personal_finance_category?.detailed || transaction.personal_finance_category?.primary
          );
          
          // Handle credit card specific transaction types
          if (isCredit) {
            // Credit card payments (positive amounts on credit cards = payments)
            if (transaction.amount > 0) {
              category = 'Credit Card Payments';
            }
            // Interest and fees (negative amounts that are fees/interest)
            else if (transaction.category?.includes('Interest') || 
                     transaction.category?.includes('Fee') ||
                     transaction.name.toLowerCase().includes('interest') ||
                     transaction.name.toLowerCase().includes('fee')) {
              category = 'Interest & Fees';
            }
          }
          
          // Find matching budget for automatic linking
          const budget = await prisma.budget.findFirst({
            where: {
              userId: userId,
              name: category, // Match by budget name, not category
              month: new Date(transaction.date).getMonth() + 1,
              year: new Date(transaction.date).getFullYear(),
            },
          });
          
          const createdTransaction = await prisma.transaction.create({
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
              isManual: false,
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
          
          // Note: Credit card automation is now triggered by budget assignments, not transaction imports
          // This ensures money only moves when you manually assign budget to cover expenses
          
          totalTransactions++;
        }
      })
    );

    console.log(`✅ Plaid integration successful: ${accounts.length} accounts, ${totalTransactions} transactions`);
    res.json({ 
      success: true, 
      accounts: accounts.length, 
      transactions: totalTransactions,
      accountDetails: accounts.map(acc => ({ id: acc.id, name: acc.accountName, type: acc.accountType }))
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
}