const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetAllData() {
  console.log('🔄 Starting complete data reset...');
  
  try {
    // Get all users to confirm what we're resetting
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    
    console.log(`📋 Found ${users.length} user(s):`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.name || 'No name'})`);
    });
    
    if (users.length === 0) {
      console.log('ℹ️  No users found - database is already empty');
      return;
    }
    
    console.log('\n🗑️  Deleting all data...');
    
    // Delete in correct order due to foreign key constraints
    // Start with dependent tables first
    
    console.log('  - Deleting AI plans...');
    const aiPlansDeleted = await prisma.aIPlan.deleteMany({});
    console.log(`    ✅ Deleted ${aiPlansDeleted.count} AI plans`);
    
    console.log('  - Deleting budget transfers...');
    const budgetTransfersDeleted = await prisma.budgetTransfer.deleteMany({});
    console.log(`    ✅ Deleted ${budgetTransfersDeleted.count} budget transfers`);
    
    console.log('  - Deleting transactions...');
    const transactionsDeleted = await prisma.transaction.deleteMany({});
    console.log(`    ✅ Deleted ${transactionsDeleted.count} transactions`);
    
    console.log('  - Deleting budgets...');
    const budgetsDeleted = await prisma.budget.deleteMany({});
    console.log(`    ✅ Deleted ${budgetsDeleted.count} budgets`);
    
    console.log('  - Deleting goals...');
    const goalsDeleted = await prisma.goal.deleteMany({});
    console.log(`    ✅ Deleted ${goalsDeleted.count} goals`);
    
    console.log('  - Deleting accounts...');
    const accountsDeleted = await prisma.account.deleteMany({});
    console.log(`    ✅ Deleted ${accountsDeleted.count} accounts`);
    
    console.log('  - Deleting users...');
    const usersDeleted = await prisma.user.deleteMany({});
    console.log(`    ✅ Deleted ${usersDeleted.count} users`);
    
    console.log('\n🎉 Complete data reset successful!');
    console.log('📊 Summary:');
    console.log(`  - Users: ${usersDeleted.count}`);
    console.log(`  - Accounts: ${accountsDeleted.count}`);
    console.log(`  - Budgets: ${budgetsDeleted.count}`);
    console.log(`  - Transactions: ${transactionsDeleted.count}`);
    console.log(`  - Goals: ${goalsDeleted.count}`);
    console.log(`  - Budget Transfers: ${budgetTransfersDeleted.count}`);
    console.log(`  - AI Plans: ${aiPlansDeleted.count}`);
    
    console.log('\n✨ Your app is now completely reset and ready for a fresh start!');
    console.log('💡 Next steps:');
    console.log('  1. Go to your app and sign up with a new account');
    console.log('  2. Connect your bank accounts via Plaid');
    console.log('  3. Set up your budgets and goals');
    
  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset
resetAllData();