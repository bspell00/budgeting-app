#!/usr/bin/env node

/**
 * Fix Credit Card Transaction Amounts
 * 
 * This script corrects existing credit card transactions that have incorrect amounts
 * due to the previous bug where all credit card transactions were negated.
 * 
 * Usage: node scripts/fix-credit-card-transactions.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixCreditCardTransactions(dryRun = false) {
  console.log('🔍 Starting credit card transaction fix...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (making changes)'}`);

  try {
    // Get all credit card accounts
    const creditAccounts = await prisma.account.findMany({
      where: {
        accountType: 'credit'
      },
      include: {
        transactions: {
          where: {
            plaidTransactionId: {
              not: null // Only fix Plaid-imported transactions
            }
          }
        }
      }
    });

    console.log(`📊 Found ${creditAccounts.length} credit card accounts`);

    let totalFixed = 0;
    let purchasesFixed = 0;
    let paymentsFixed = 0;

    for (const account of creditAccounts) {
      console.log(`\n💳 Processing ${account.accountName} (${account.transactions.length} transactions)`);

      // Debug: Show all transactions for this account
      console.log('   Existing transactions:');
      account.transactions.forEach(t => {
        console.log(`     ${t.description}: $${t.amount.toFixed(2)} (${t.amount > 0 ? 'inflow' : 'outflow'})`);
      });

      for (const transaction of account.transactions) {
        // Identify if this should be a payment (inflow) or purchase (outflow)
        // Look for payment keywords in the description
        const description = transaction.description.toLowerCase();
        const isPayment = description.includes('payment') || 
                         description.includes('autopay') ||
                         description.includes('automatic') ||
                         description.includes('thank') ||
                         description.includes('transfer from') ||
                         description.includes('online payment');

        // Determine correct amount based on transaction type
        let correctAmount;
        if (isPayment) {
          // Payments should be positive (inflows to credit card)
          correctAmount = Math.abs(transaction.amount);
        } else {
          // Purchases should be negative (outflows from your perspective)
          correctAmount = -Math.abs(transaction.amount);
        }

        // Check if this transaction needs fixing
        if (Math.abs(correctAmount - transaction.amount) > 0.01) {
          const transactionType = isPayment ? 'payment' : 'purchase';
          
          console.log(`  🔧 ${transactionType}: "${transaction.description}"`);
          console.log(`     Current: $${transaction.amount.toFixed(2)} → Correct: $${correctAmount.toFixed(2)}`);

          if (!dryRun) {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { amount: correctAmount }
            });
          }

          totalFixed++;
          if (transactionType === 'purchase') purchasesFixed++;
          else paymentsFixed++;
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`  Total transactions fixed: ${totalFixed}`);
    console.log(`  Purchases fixed: ${purchasesFixed}`);
    console.log(`  Payments fixed: ${paymentsFixed}`);

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to apply these fixes');
    } else {
      console.log('\n✅ All credit card transactions have been corrected!');
    }

  } catch (error) {
    console.error('❌ Error fixing credit card transactions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run the fix
fixCreditCardTransactions(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });