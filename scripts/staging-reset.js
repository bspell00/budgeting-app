#!/usr/bin/env node

/**
 * Staging Database Reset Script
 * 
 * Safely resets the staging database with additional safety checks.
 * This script is designed specifically for staging environments.
 * 
 * Usage:
 *   NODE_ENV=staging node scripts/staging-reset.js
 *   heroku run node scripts/staging-reset.js --app your-staging-app
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function validateEnvironment() {
  const env = process.env.NODE_ENV;
  const dbUrl = process.env.DATABASE_URL;
  
  log('Validating environment...');
  log(`NODE_ENV: ${env}`);
  log(`Database: ${dbUrl ? 'Connected' : 'No DATABASE_URL'}`);
  
  // Safety check: Don't run on production
  if (env === 'production') {
    throw new Error('🚫 SAFETY STOP: This script cannot run in production environment');
  }
  
  // Warn if not explicitly staging
  if (env !== 'staging' && env !== 'development') {
    log(`⚠️  Warning: NODE_ENV is "${env}", expected "staging"`, 'warn');
  }
  
  return true;
}

async function getSystemInfo() {
  try {
    // Try to get some system info to verify we're in the right place
    const userCount = await prisma.user.count();
    const accountCount = await prisma.account.count();
    const transactionCount = await prisma.transaction.count();
    
    return {
      users: userCount,
      accounts: accountCount,
      transactions: transactionCount,
      total: userCount + accountCount + transactionCount
    };
  } catch (error) {
    log(`Database connection error: ${error.message}`, 'error');
    throw error;
  }
}

async function performReset() {
  log('🧹 Starting staging database reset...');
  
  try {
    // Get initial counts
    const before = await getSystemInfo();
    log(`📊 Current data: ${before.users} users, ${before.accounts} accounts, ${before.transactions} transactions`);
    
    if (before.total === 0) {
      log('✅ Database is already empty!', 'success');
      return;
    }
    
    // Perform deletion in safe order
    const deletions = [
      { name: 'AI Plans', query: () => prisma.aIPlan.deleteMany() },
      { name: 'Budget Transfers', query: () => prisma.budgetTransfer.deleteMany() },
      { name: 'Transactions', query: () => prisma.transaction.deleteMany() },
      { name: 'Goals', query: () => prisma.goal.deleteMany() },
      { name: 'Payees', query: () => prisma.payee.deleteMany() },
      { name: 'Budgets', query: () => prisma.budget.deleteMany() },
      { name: 'Accounts', query: () => prisma.account.deleteMany() },
      { name: 'Users', query: () => prisma.user.deleteMany() }
    ];
    
    for (const deletion of deletions) {
      try {
        const result = await deletion.query();
        const count = result.count || 0;
        if (count > 0) {
          log(`✅ Deleted ${count} ${deletion.name.toLowerCase()}`);
        }
      } catch (error) {
        if (error.code === 'P2025') {
          // No records found - this is fine
          continue;
        } else {
          throw error;
        }
      }
    }
    
    // Reset sequences if they exist (SQLite specific)
    try {
      await prisma.$executeRaw`DELETE FROM sqlite_sequence`;
      log('✅ Database sequences reset');
    } catch (error) {
      if (error.message.includes('no such table: sqlite_sequence')) {
        log('➖ No sequences to reset');
      } else {
        log(`⚠️  Sequence reset warning: ${error.message}`, 'warn');
      }
    }
    
    // Verify reset
    const after = await getSystemInfo();
    
    if (after.total === 0) {
      log('🎉 Staging database reset successful!', 'success');
      log('✅ All user data removed');
      log('✅ All accounts disconnected'); 
      log('✅ All transactions cleared');
      log('✅ All budgets and goals removed');
      log('✅ Ready for fresh testing');
    } else {
      log(`⚠️  Reset incomplete: ${after.total} records remain`, 'warn');
    }
    
  } catch (error) {
    log(`Reset failed: ${error.message}`, 'error');
    throw error;
  }
}

async function main() {
  try {
    log('🚀 Staging Database Reset Utility');
    log('================================');
    
    // Safety checks
    await validateEnvironment();
    
    // Show what we're about to do
    const info = await getSystemInfo();
    if (info.total > 0) {
      log(`📋 Will remove:`);
      log(`   • ${info.users} user accounts`);
      log(`   • ${info.accounts} connected bank accounts`);
      log(`   • ${info.transactions} transactions`);
      log(`   • All budgets, goals, and payees`);
    }
    
    // Perform the reset
    await performReset();
    
    log('🏁 Reset complete - staging environment is clean');
    
  } catch (error) {
    log(`💥 Fatal error: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}