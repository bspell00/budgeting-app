const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixExistingTransactions(specificUserId = null) {
  try {
    console.log('🔧 Fixing existing transactions...');
    
    // Get user first to ensure we have proper user context
    const user = await prisma.user.findFirst({
      where: specificUserId ? { id: specificUserId } : {}
    });
    
    if (!user) {
      console.log('❌ No user found. Please create a user first or specify a valid userId.');
      return;
    }
    
    console.log(`🔒 Processing transactions for user: ${user.email} (${user.id})`);
    
    // Get only this user's transactions with their accounts
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id
      },
      include: {
        account: true,
      },
    });

    console.log(`Found ${transactions.length} transactions to review for this user`);

    let fixedCount = 0;

    for (const transaction of transactions) {
      const isCredit = transaction.account.accountType === 'credit';
      let shouldUpdate = false;
      let updates = {};

      if (isCredit) {
        // For credit cards, fix the amount logic
        if (transaction.plaidTransactionId) {
          // This was imported from Plaid, we need to determine the original Plaid amount
          // Since we can't reverse-engineer the original Plaid amount reliably,
          // we'll use the description and category to make best guesses
          
          if (transaction.category === 'Credit Card Payment') {
            // Payments should be negative (inflows)
            if (transaction.amount > 0) {
              updates.amount = -Math.abs(transaction.amount);
              shouldUpdate = true;
            }
          } else {
            // Purchases should be positive (outflows)
            if (transaction.amount < 0) {
              updates.amount = Math.abs(transaction.amount);
              shouldUpdate = true;
            }
          }
        }

        // Re-categorize using our enhanced logic
        const { categorizeTransaction } = require('../lib/credit-card-automation');
        const newCategory = categorizeTransaction(transaction.description, []);
        
        if (newCategory !== transaction.category) {
          updates.category = newCategory;
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: updates,
        });
        
        fixedCount++;
        console.log(`✅ Fixed transaction: ${transaction.description} (${transaction.account.accountName})`);
        if (updates.amount !== undefined) {
          console.log(`   Amount: ${transaction.amount} → ${updates.amount}`);
        }
        if (updates.category !== undefined) {
          console.log(`   Category: ${transaction.category} → ${updates.category}`);
        }
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} transactions out of ${transactions.length} total`);
    
  } catch (error) {
    console.error('❌ Error fixing transactions:', error);
  }
}

async function createSampleTransactions() {
  console.log('\n📝 Creating sample transactions for testing...');
  
  // Get user and accounts
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ No user found. Please create a user first.');
    return;
  }

  const accounts = await prisma.account.findMany({
    where: { userId: user.id }
  });

  if (accounts.length === 0) {
    console.log('❌ No accounts found. Please connect accounts via Plaid first.');
    return;
  }

  const creditCard = accounts.find(acc => acc.accountType === 'credit');
  const checkingAccount = accounts.find(acc => acc.accountType === 'depository');

  const sampleTransactions = [];

  if (creditCard) {
    // Credit card sample transactions
    sampleTransactions.push(
      {
        accountId: creditCard.id,
        amount: 4.50, // Purchase (positive outflow)
        description: 'Starbucks Coffee',
        category: 'Eating Out',
        date: new Date('2025-07-15'),
        plaidTransactionId: 'sample-starbucks-001'
      },
      {
        accountId: creditCard.id,
        amount: 85.32, // Purchase (positive outflow)
        description: 'Target Groceries',
        category: 'Groceries',
        date: new Date('2025-07-14'),
        plaidTransactionId: 'sample-target-001'
      },
      {
        accountId: creditCard.id,
        amount: -150.00, // Payment (negative inflow)
        description: 'Credit Card Payment',
        category: 'Credit Card Payment',
        date: new Date('2025-07-13'),
        plaidTransactionId: 'sample-payment-001'
      },
      {
        accountId: creditCard.id,
        amount: 45.67, // Purchase (positive outflow)
        description: 'Shell Gas Station',
        category: 'Transportation',
        date: new Date('2025-07-12'),
        plaidTransactionId: 'sample-shell-001'
      },
      {
        accountId: creditCard.id,
        amount: 2.50, // Fee (positive outflow)
        description: 'Interest Charge',
        category: 'Interest & Fees',
        date: new Date('2025-07-11'),
        plaidTransactionId: 'sample-interest-001'
      }
    );
  }

  if (checkingAccount) {
    // Checking account sample transactions
    sampleTransactions.push(
      {
        accountId: checkingAccount.id,
        amount: 3000.00, // Deposit (positive inflow)
        description: 'Salary Deposit',
        category: 'Income',
        date: new Date('2025-07-15'),
        plaidTransactionId: 'sample-salary-001'
      },
      {
        accountId: checkingAccount.id,
        amount: -150.00, // Payment (negative outflow)
        description: 'Credit Card Payment',
        category: 'Credit Card Payment',
        date: new Date('2025-07-13'),
        plaidTransactionId: 'sample-cc-payment-001'
      },
      {
        accountId: checkingAccount.id,
        amount: -1200.00, // Payment (negative outflow)
        description: 'Mortgage Payment',
        category: 'Mortgage',
        date: new Date('2025-07-01'),
        plaidTransactionId: 'sample-mortgage-001'
      }
    );
  }

  let createdCount = 0;
  for (const txData of sampleTransactions) {
    try {
      // Check if transaction already exists
      const existing = await prisma.transaction.findUnique({
        where: { plaidTransactionId: txData.plaidTransactionId }
      });

      if (!existing) {
        await prisma.transaction.create({
          data: {
            userId: user.id,
            ...txData
          }
        });
        createdCount++;
        console.log(`✅ Created: ${txData.description} (${txData.amount > 0 ? '+' : ''}$${txData.amount})`);
      }
    } catch (error) {
      console.log(`❌ Failed to create: ${txData.description} - ${error.message}`);
    }
  }

  console.log(`\n📊 Created ${createdCount} sample transactions`);
}

async function main() {
  console.log('🚀 Starting transaction fix and sample creation...\n');
  
  await fixExistingTransactions();
  await createSampleTransactions();
  
  console.log('\n✨ All done!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });