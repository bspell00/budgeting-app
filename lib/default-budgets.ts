// Predefined budget categories and groups
export const DEFAULT_BUDGET_CATEGORIES = [
  // Income Category Group - Special category for incoming funds
  {
    categoryGroup: 'Income',
    categories: [
      'To Be Assigned'
    ]
  },
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

/**
 * Create default budget categories for a user
 */
export async function createDefaultBudgets(
  userId: string, 
  month: number, 
  year: number,
  prisma: any
) {
  const budgetsToCreate = [];
  
  for (const group of DEFAULT_BUDGET_CATEGORIES) {
    for (const categoryName of group.categories) {
      budgetsToCreate.push({
        userId: userId,
        name: categoryName,
        category: group.categoryGroup,
        amount: 0,
        spent: 0,
        month: month,
        year: year,
      });
    }
  }
  
  try {
    // Use createMany to insert all budgets at once
    await prisma.budget.createMany({
      data: budgetsToCreate,
      skipDuplicates: true // Skip if budget already exists
    });
    
    console.log(`✅ Created ${budgetsToCreate.length} default budget categories for user ${userId}`);
    return budgetsToCreate.length;
  } catch (error) {
    console.error('Error creating default budgets:', error);
    throw error;
  }
}

/**
 * Get category group for a budget category name
 */
export function getCategoryGroup(categoryName: string): string {
  for (const group of DEFAULT_BUDGET_CATEGORIES) {
    if (group.categories.includes(categoryName)) {
      return group.categoryGroup;
    }
  }
  return 'Misc'; // Default fallback
}

/**
 * Get all available budget categories
 */
export function getAllBudgetCategories(): string[] {
  return DEFAULT_BUDGET_CATEGORIES.flatMap(group => group.categories);
}

/**
 * Check if a category is a predefined category
 */
export function isPredefinedCategory(categoryName: string): boolean {
  return getAllBudgetCategories().includes(categoryName);
}