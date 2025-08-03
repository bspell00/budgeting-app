#!/usr/bin/env node

/**
 * Database Reset Script
 * 
 * This script completely clears the database for fresh testing.
 * Use with caution - this will delete ALL data!
 * 
 * Usage:
 *   node scripts/reset-database.js
 *   node scripts/reset-database.js --confirm
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const { loadEnvironment } = require('../lib/env-loader');

// Load environment-specific configuration
loadEnvironment();

const prisma = new PrismaClient();

// Color codes for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function confirmReset() {
  const args = process.argv.slice(2);
  if (args.includes('--confirm')) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(colorize('\n⚠️  WARNING: DATABASE RESET', 'red'));
    console.log(colorize('═'.repeat(50), 'red'));
    console.log('This will permanently delete ALL data:');
    console.log('• All user accounts');
    console.log('• All connected bank accounts');
    console.log('• All transactions');
    console.log('• All budgets and categories');
    console.log('• All goals and payees');
    console.log('• All AI plans and transfers');
    console.log('');
    
    rl.question('Are you absolutely sure? Type "RESET" to continue: ', (answer) => {
      rl.close();
      resolve(answer === 'RESET');
    });
  });
}

async function getTableCounts() {
  const counts = {};
  
  try {
    counts.users = await prisma.user.count();
    counts.accounts = await prisma.account.count();
    counts.transactions = await prisma.transaction.count();
    counts.budgets = await prisma.budget.count();
    counts.goals = await prisma.goal.count();
    counts.payees = await prisma.payee.count();
    counts.budgetTransfers = await prisma.budgetTransfer.count();
    counts.aiPlans = await prisma.aIPlan.count();
  } catch (error) {
    console.warn('Some tables may not exist yet:', error.message);
  }
  
  return counts;
}

async function resetDatabase() {
  console.log(colorize('\n🗃️  Current Database State', 'blue'));
  console.log('─'.repeat(30));
  
  const beforeCounts = await getTableCounts();
  Object.entries(beforeCounts).forEach(([table, count]) => {
    if (count > 0) {
      console.log(`📊 ${table}: ${colorize(count.toString(), 'yellow')}`);
    }
  });
  
  if (Object.values(beforeCounts).every(count => count === 0)) {
    console.log(colorize('✅ Database is already empty!', 'green'));
    return;
  }

  console.log(colorize('\n🧹 Starting Database Reset...', 'magenta'));
  console.log('─'.repeat(40));

  try {
    // Delete in proper order to respect foreign key constraints
    const operations = [
      { name: 'AI Plans', fn: () => prisma.aIPlan.deleteMany() },
      { name: 'Budget Transfers', fn: () => prisma.budgetTransfer.deleteMany() },
      { name: 'Transactions', fn: () => prisma.transaction.deleteMany() },
      { name: 'Goals', fn: () => prisma.goal.deleteMany() },
      { name: 'Payees', fn: () => prisma.payee.deleteMany() },
      { name: 'Budgets', fn: () => prisma.budget.deleteMany() },
      { name: 'Accounts', fn: () => prisma.account.deleteMany() },
      { name: 'Users', fn: () => prisma.user.deleteMany() }
    ];

    for (const operation of operations) {
      try {
        const result = await operation.fn();
        const count = result.count || 0;
        if (count > 0) {
          console.log(`✅ Deleted ${colorize(count.toString(), 'green')} ${operation.name.toLowerCase()}`);
        } else {
          console.log(`➖ No ${operation.name.toLowerCase()} to delete`);
        }
      } catch (error) {
        if (error.code === 'P2025') {
          // Record not found - table might be empty or not exist
          console.log(`➖ No ${operation.name.toLowerCase()} to delete`);
        } else {
          throw error;
        }
      }
    }

    // Reset database sequences (PostgreSQL specific)
    console.log(colorize('\n🔄 Resetting database sequences...', 'cyan'));
    try {
      const dbUrl = process.env.DATABASE_URL || '';
      
      if (dbUrl.includes('postgresql')) {
        // PostgreSQL sequence reset
        await prisma.$executeRaw`
          DO $$ 
          DECLARE 
            r RECORD;
          BEGIN 
            FOR r IN (SELECT schemaname, sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
              EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.schemaname) || '.' || quote_ident(r.sequencename) || ' RESTART WITH 1';
            END LOOP;
          END $$;
        `;
        console.log('✅ PostgreSQL sequences reset');
      } else if (dbUrl.includes('sqlite')) {
        // SQLite sequence reset (legacy support)
        await prisma.$executeRaw`DELETE FROM sqlite_sequence WHERE name IN ('User', 'Account', 'Transaction', 'Budget', 'Goal', 'Payee', 'BudgetTransfer', 'AIPlan')`;
        console.log('✅ SQLite sequences reset');
      } else {
        console.log('➖ Unknown database type, skipping sequence reset');
      }
    } catch (error) {
      if (error.message.includes('no such table: sqlite_sequence') || 
          error.message.includes('relation "pg_sequences" does not exist')) {
        console.log('➖ No sequences to reset');
      } else {
        console.log(`⚠️  Sequence reset warning: ${error.message}`);
      }
    }

    console.log(colorize('\n🎉 Database Reset Complete!', 'green'));
    console.log('─'.repeat(30));
    console.log('✅ All data has been removed');
    console.log('✅ Database is ready for fresh testing');
    console.log('✅ You can now sign up with a new account');

    // Verify the reset
    console.log(colorize('\n🔍 Verification', 'blue'));
    const afterCounts = await getTableCounts();
    const totalRecords = Object.values(afterCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalRecords === 0) {
      console.log('✅ Confirmed: Database is completely empty');
    } else {
      console.log(colorize('⚠️  Warning: Some records may remain:', 'yellow'));
      Object.entries(afterCounts).forEach(([table, count]) => {
        if (count > 0) {
          console.log(`  - ${table}: ${count}`);
        }
      });
    }

  } catch (error) {
    console.error(colorize('\n❌ Reset Failed:', 'red'), error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log(colorize('🗄️  Database Reset Utility', 'bold'));
    console.log(colorize('═'.repeat(30), 'blue'));
    
    const confirmed = await confirmReset();
    
    if (!confirmed) {
      console.log(colorize('\n❌ Reset cancelled', 'yellow'));
      process.exit(0);
    }

    await resetDatabase();

  } catch (error) {
    console.error(colorize('\n💥 Fatal Error:', 'red'), error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(colorize('\n\n👋 Reset cancelled by user', 'yellow'));
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  main();
}