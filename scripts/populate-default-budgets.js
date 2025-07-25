const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Predefined budget categories and groups
const DEFAULT_BUDGET_CATEGORIES = [
  // Bills Category Group
  {
    categoryGroup: 'Bills',
    categories: [
      'Rent/Mortgage',
      'Electric',
      'Water',
      'Internet',
      'Cellphone'
    ]
  },
  
  // Frequent Category Group
  {
    categoryGroup: 'Frequent',
    categories: [
      'Groceries',
      'Eating Out',
      'Transportation'
    ]
  },
  
  // Non-Monthly Category Group
  {
    categoryGroup: 'Non-Monthly',
    categories: [
      'Home Maintenance',
      'Auto Maintenance',
      'Gifts'
    ]
  },
  
  // Goals Category Group
  {
    categoryGroup: 'Goals',
    categories: [
      'Vacation',
      'Education',
      'Home Improvement'
    ]
  },
  
  // Quality of Life Category Group
  {
    categoryGroup: 'Quality of Life',
    categories: [
      'Hobbies',
      'Entertainment',
      'Health & Wellness'
    ]
  }
];

async function populateDefaultBudgets() {
  try {
    console.log('🚀 Starting default budget population...');
    
    // Get all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);
    
    if (users.length === 0) {
      console.log('No users found. Create a user account first.');
      return;
    }
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    for (const user of users) {
      console.log(`\n📝 Processing user: ${user.email} (${user.id})`);
      
      // Check if user already has budgets for current month
      const existingBudgets = await prisma.budget.findMany({
        where: {
          userId: user.id,
          month: currentMonth,
          year: currentYear
        }
      });
      
      if (existingBudgets.length > 0) {
        console.log(`  ℹ️  User already has ${existingBudgets.length} budgets for ${currentMonth}/${currentYear}`);
        continue;
      }
      
      // Create default budgets
      const budgetsToCreate = [];
      
      for (const group of DEFAULT_BUDGET_CATEGORIES) {
        for (const categoryName of group.categories) {
          budgetsToCreate.push({
            userId: user.id,
            name: categoryName,
            category: group.categoryGroup,
            amount: 0,
            spent: 0,
            month: currentMonth,
            year: currentYear,
          });
        }
      }
      
      // Insert all budgets
      await prisma.budget.createMany({
        data: budgetsToCreate,
        skipDuplicates: true
      });
      
      console.log(`  ✅ Created ${budgetsToCreate.length} default budget categories`);
    }
    
    console.log('\n🎉 Default budget population completed!');
    
  } catch (error) {
    console.error('❌ Error populating default budgets:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this script is executed directly
if (require.main === module) {
  populateDefaultBudgets();
}

module.exports = { populateDefaultBudgets };