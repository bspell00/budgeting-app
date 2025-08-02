require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PLAID_BASE_URLS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com'
};

// Simple categorization function (copied from exchange-token.ts)
function categorizeTransaction(transactionName, categories) {
  const name = transactionName.toLowerCase();
  const category = categories[0]?.toLowerCase() || '';
  
  if (name.includes('starbucks') || name.includes('dunkin') || category.includes('restaurant')) {
    return 'Food & Dining';
  }
  if (name.includes('gas') || name.includes('shell') || name.includes('exxon') || category.includes('gas')) {
    return 'Transportation';
  }
  if (name.includes('walmart') || name.includes('target') || name.includes('grocery') || category.includes('shop')) {
    return 'Groceries';
  }
  if (category.includes('transfer') || name.includes('payment')) {
    return 'Transfer';
  }
  
  return 'General';
}

async function importTransactionsDirectly() {
  console.log('🔄 Importing transactions directly...');
  
  try {
    await prisma.$connect();
    
    // Get all accounts with Plaid access tokens
    const accounts = await prisma.account.findMany({
      where: {
        plaidAccessToken: { not: '' }
      },
      include: {
        user: true
      }
    });
    
    if (accounts.length === 0) {
      console.log('❌ No accounts found with Plaid access tokens');
      return;
    }
    
    console.log(`✅ Found ${accounts.length} accounts to import transactions for`);
    
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    const baseUrl = PLAID_BASE_URLS[plaidEnv];
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get transactions for all accounts
    const transactionsResponse = await fetch(`${baseUrl}/transactions/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
      body: JSON.stringify({
        access_token: accounts[0].plaidAccessToken, // Use first account's token (they should be the same)
        start_date: thirtyDaysAgo.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      }),
    });
    
    if (!transactionsResponse.ok) {
      const errorText = await transactionsResponse.text();
      console.error('❌ Plaid transactions API error:', errorText);
      return;
    }
    
    const transactionsData = await transactionsResponse.json();
    console.log(`📊 Retrieved ${transactionsData.transactions.length} transactions from Plaid`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Import transactions
    for (const transaction of transactionsData.transactions) {
      const account = accounts.find(acc => acc.plaidAccountId === transaction.account_id);
      if (!account) {
        console.log(`⚠️  No account found for transaction ${transaction.name} (account_id: ${transaction.account_id})`);
        continue;
      }

      const isCredit = account.accountType === 'credit';
      let amount = transaction.amount;

      // Fix amount signs for credit cards
      if (isCredit) {
        amount = -transaction.amount;
      }

      // Categorize transaction
      const category = categorizeTransaction(transaction.name, transaction.category || []);

      try {
        const createdTransaction = await prisma.transaction.create({
          data: {
            userId: account.userId,
            accountId: account.id,
            plaidTransactionId: transaction.transaction_id,
            amount: amount,
            description: transaction.name,
            category: category,
            subcategory: (transaction.category && transaction.category[0]) || '',
            date: new Date(transaction.date),
            cleared: true,
            approved: false,
            isManual: false,
          },
        });
        
        console.log(`✅ ${transaction.name} - $${amount} (${account.accountName})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create transaction ${transaction.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 Import complete: ${successCount} success, ${errorCount} errors`);
    
    // Check final count
    const totalTransactions = await prisma.transaction.count();
    console.log(`💾 Total transactions in database: ${totalTransactions}`);
    
  } catch (error) {
    console.error('❌ Error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importTransactionsDirectly();