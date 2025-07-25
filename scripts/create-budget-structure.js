const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createBudgetStructure() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  // Get the test user (or use your actual user ID)
  const user = await prisma.user.findFirst({
    where: {
      email: 'test@example.com'
    }
  });
  if (!user) {
    console.error('No user found. Please create a user first.');
    return;
  }

  console.log(`Creating budget structure for user: ${user.email}`);

  const budgetStructure = [
    // Credit Card Payments
    {
      category: 'Credit Card Payments',
      budgets: [
        { name: 'Chase Sapphire Rewards', amount: 0 },
        { name: "Adrienne's Barclay Arrival", amount: 70 },
        { name: "Brandon's Barclay Arrival", amount: 50 },
        { name: 'Amazon Store Card', amount: 120.92 },
        { name: 'Navy Federal Rewards Card', amount: 70 },
        { name: 'Delta Platinum Rewards', amount: 64 },
        { name: 'Adrienne Capital One Venture', amount: 0 },
        { name: 'GAP Reward Card', amount: 50 },
        { name: 'American Express Gold Card', amount: 0 },
        { name: 'CareCredit', amount: 113 },
        { name: 'Venture X', amount: 251 },
        { name: 'Home Depot CC', amount: 0 }
      ]
    },

    // Auto Loans
    {
      category: 'Auto Loans',
      budgets: [
        { name: '2021 Ram 1500', amount: 0 },
        { name: '2023 Hyundai Palisade', amount: 0 }
      ]
    },

    // Monthly Bills
    {
      category: 'Monthly Bills',
      budgets: [
        { name: 'Gabb Wireless', amount: 18.12 },
        { name: 'Interest Charges', amount: 0 },
        { name: 'HELOC Payments', amount: 1376.03 },
        { name: 'Aidvantage (Student Loan)', amount: 0 },
        { name: 'Car Insurance', amount: 0 },
        { name: 'Cellphone', amount: 0 },
        { name: 'Electric', amount: 141 },
        { name: 'Gas', amount: 0 },
        { name: 'HOA Fees', amount: 0 },
        { name: 'Internet', amount: 79.99 },
        { name: 'Mortgage', amount: 563.31 },
        { name: 'Subscriptions', amount: 123.31 },
        { name: 'TV', amount: 73 },
        { name: 'Trash', amount: 25.50 },
        { name: 'Water', amount: 0 }
      ]
    },

    // Frequent Spending
    {
      category: 'Frequent Spending',
      budgets: [
        { name: 'Eating Out', amount: 786.97 },
        { name: 'Groceries', amount: 447.38 },
        { name: 'HELOC', amount: 0 },
        { name: 'Investments', amount: 0 },
        { name: 'Tithing', amount: 495.48 },
        { name: 'Transportation', amount: 234.56 }
      ]
    },

    // Non-Monthly
    {
      category: 'Non-Monthly',
      budgets: [
        { name: 'Taxes', amount: 0 },
        { name: 'Emergency Fund', amount: 0 },
        { name: 'Auto Maintenance', amount: 569.36 },
        { name: 'Clothing', amount: 180.33 },
        { name: 'Gifts', amount: 350 },
        { name: 'Hair', amount: 0 },
        { name: 'Home Improvement', amount: 0 },
        { name: 'Medical', amount: 148.07 },
        { name: 'Misc. Needs', amount: 100.84 },
        { name: 'Pet Maintenance', amount: 64.26 },
        { name: 'Stuff I Forgot to Budget For', amount: 0 }
      ]
    },

    // Sully & Remi
    {
      category: 'Sully & Remi',
      budgets: [
        { name: 'Teacher Gifts', amount: 0 },
        { name: 'Misc School', amount: 0 },
        { name: 'Birthdays', amount: 0 },
        { name: 'Childcare', amount: 0 },
        { name: 'Clothing', amount: 85.19 },
        { name: 'Lunch Money', amount: 0 },
        { name: 'Extracurricular', amount: 0 },
        { name: 'Toys', amount: 0 }
      ]
    },

    // Adrienne Spell Counseling
    {
      category: 'Adrienne Spell Counseling',
      budgets: [
        { name: 'Fees and Registrations', amount: 0 },
        { name: 'State Registration', amount: 0 },
        { name: 'Continuing Education', amount: 0 },
        { name: 'Affiliation Fees', amount: 0 },
        { name: 'Business Insurance', amount: 0 },
        { name: 'Office Rent', amount: 0 }
      ]
    },

    // Goals
    {
      category: 'Goals',
      budgets: [
        { name: 'Christmas Gifts 🎁🎄', amount: 0 },
        { name: 'Mexico Trip', amount: 0 },
        { name: 'Pampering', amount: 569.33 },
        { name: 'Vacation', amount: 0 }
      ]
    },

    // Just for Fun
    {
      category: 'Just for Fun',
      budgets: [
        { name: 'Fun Money', amount: 109.64 }
      ]
    }
  ];

  console.log('Creating budget categories and items...');

  let totalCreated = 0;

  for (const categoryGroup of budgetStructure) {
    console.log(`Creating budgets for: ${categoryGroup.category}`);
    
    for (const budget of categoryGroup.budgets) {
      try {
        // Check if budget already exists
        const existingBudget = await prisma.budget.findFirst({
          where: {
            userId: user.id,
            name: budget.name,
            category: categoryGroup.category,
            month: currentMonth,
            year: currentYear
          }
        });

        if (!existingBudget) {
          await prisma.budget.create({
            data: {
              userId: user.id,
              name: budget.name,
              amount: budget.amount,
              category: categoryGroup.category,
              month: currentMonth,
              year: currentYear,
              spent: 0
            }
          });
          console.log(`  ✓ Created: ${budget.name} ($${budget.amount})`);
          totalCreated++;
        } else {
          console.log(`  - Exists: ${budget.name}`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to create ${budget.name}:`, error.message);
      }
    }
  }

  console.log(`\n🎉 Budget structure creation complete!`);
  console.log(`📊 Created ${totalCreated} new budget items`);
  console.log(`📅 Month: ${currentMonth}/${currentYear}`);
  console.log(`👤 User: ${user.email}`);

  // Summary statistics
  const totalBudgets = await prisma.budget.count({
    where: {
      userId: user.id,
      month: currentMonth,
      year: currentYear
    }
  });

  const totalBudgetAmount = await prisma.budget.aggregate({
    where: {
      userId: user.id,
      month: currentMonth,
      year: currentYear
    },
    _sum: {
      amount: true
    }
  });

  console.log(`\n📈 Budget Summary:`);
  console.log(`   Total Budget Items: ${totalBudgets}`);
  console.log(`   Total Budgeted: $${totalBudgetAmount._sum.amount?.toFixed(2) || '0.00'}`);
}

createBudgetStructure()
  .catch((e) => {
    console.error('Error creating budget structure:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });