#!/usr/bin/env node

/**
 * Fix Credit Card Transaction Amounts
 * 
 * This script fixes existing credit card transactions that have incorrect amount signs.
 * The issue: Plaid amounts were stored directly instead of being flipped for credit cards.
 * 
 * The fix:
 * - Credit card purchases (positive amounts) should become negative (outflows)
 * - Credit card payments (negative amounts) should become positive (inflows)
 * 
 * This means we need to flip the sign of ALL existing credit card transactions.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCreditCardAmounts() {
  console.log('🔍 Starting credit card amount fix...');
  
  try {
    // Find all transactions for credit card accounts
    const creditCardTransactions = await prisma.transaction.findMany({
      include: {
        account: true
      },
      where: {
        account: {
          accountType: 'credit'
        }
      }
    });

    console.log(`📊 Found ${creditCardTransactions.length} credit card transactions to fix`);

    if (creditCardTransactions.length === 0) {
      console.log('✅ No credit card transactions found. Nothing to fix.');
      return;
    }

    // Group transactions by amount sign for reporting
    const positiveAmounts = creditCardTransactions.filter(t => t.amount > 0);
    const negativeAmounts = creditCardTransactions.filter(t => t.amount < 0);
    const zeroAmounts = creditCardTransactions.filter(t => t.amount === 0);

    console.log(`📈 Positive amounts (purchases that will become negative): ${positiveAmounts.length}`);
    console.log(`📉 Negative amounts (payments that will become positive): ${negativeAmounts.length}`);
    console.log(`⚪ Zero amounts (will remain zero): ${zeroAmounts.length}`);

    // Show a few examples before fixing
    if (positiveAmounts.length > 0) {
      console.log('\n🔍 Example purchases that will be fixed:');
      positiveAmounts.slice(0, 3).forEach(t => {
        console.log(`  - ${t.description}: $${t.amount} → $${-t.amount} (${t.account.accountName})`);
      });
    }

    if (negativeAmounts.length > 0) {
      console.log('\n🔍 Example payments that will be fixed:');
      negativeAmounts.slice(0, 3).forEach(t => {
        console.log(`  - ${t.description}: $${t.amount} → $${-t.amount} (${t.account.accountName})`);
      });
    }

    // Ask for confirmation (in a real script, you might want to add a prompt)
    console.log('\n⚠️  About to flip the sign of ALL credit card transaction amounts...');
    
    // Perform the update - flip the sign of all credit card transaction amounts
    const updateResult = await prisma.transaction.updateMany({
      where: {
        account: {
          accountType: 'credit'
        }
      },
      data: {
        // Use raw SQL to flip the sign: amount = -amount
        amount: {
          multiply: -1
        }
      }
    });

    console.log(`✅ Successfully updated ${updateResult.count} credit card transactions!`);

    // Verify the fix by checking a few transactions
    const verifyTransactions = await prisma.transaction.findMany({
      include: {
        account: true
      },
      where: {
        account: {
          accountType: 'credit'
        }
      },
      take: 5,
      orderBy: {
        date: 'desc'
      }
    });

    console.log('\n🔍 Verification - Recent credit card transactions:');
    verifyTransactions.forEach(t => {
      const type = t.amount > 0 ? 'PAYMENT (inflow)' : t.amount < 0 ? 'PURCHASE (outflow)' : 'ZERO';
      console.log(`  - ${t.description}: $${t.amount} [${type}] (${t.account.accountName})`);
    });

    console.log('\n✅ Credit card amount fix completed successfully!');
    console.log('💡 Credit card purchases should now show as negative (red outflows)');
    console.log('💡 Credit card payments should now show as positive (green inflows)');

  } catch (error) {
    console.error('❌ Error fixing credit card amounts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Handle the case where Prisma's updateMany doesn't support multiply
async function fixCreditCardAmountsAlternative() {
  console.log('🔄 Using alternative approach (individual updates)...');
  
  try {
    const creditCardTransactions = await prisma.transaction.findMany({
      include: {
        account: true
      },
      where: {
        account: {
          accountType: 'credit'
        }
      }
    });

    console.log(`📊 Found ${creditCardTransactions.length} credit card transactions to fix`);

    let updatedCount = 0;
    
    for (const transaction of creditCardTransactions) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { amount: -transaction.amount }
      });
      updatedCount++;
      
      if (updatedCount % 10 === 0) {
        console.log(`📊 Updated ${updatedCount}/${creditCardTransactions.length} transactions...`);
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} credit card transactions!`);
    
  } catch (error) {
    console.error('❌ Error with alternative approach:', error);
    throw error;
  }
}

// Run the script
async function main() {
  try {
    await fixCreditCardAmounts();
  } catch (error) {
    if (error.message && error.message.includes('multiply')) {
      console.log('⚠️  Prisma multiply not supported, trying alternative approach...');
      await fixCreditCardAmountsAlternative();
    } else {
      throw error;
    }
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixCreditCardAmounts, fixCreditCardAmountsAlternative };