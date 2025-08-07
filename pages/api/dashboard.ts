import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getUserTransactionsFromConnectedAccounts } from '../../lib/transaction-validation';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  console.log('🔍 SESSION USER ID:', userId);
  
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    console.log('🔍 QUERY PARAMS:', { userId, currentMonth, currentYear });

    // Test basic database connectivity
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });
    console.log('🔍 USER EXISTS:', !!userExists, userExists?.email);

    // Get ALL budgets for this user (no filters)
    const allUserBudgets = await prisma.budget.findMany({
      where: { userId: userId }
    });
    console.log('🔍 ALL USER BUDGETS:', allUserBudgets.length);
    
    // Try raw SQL query as backup
    const rawBudgets = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Budget" WHERE "userId" = ${userId}
    `;
    console.log('🔍 RAW SQL BUDGET COUNT:', rawBudgets);

    // Get budgets with month/year filter
    const monthYearBudgets = await prisma.budget.findMany({
      where: {
        userId: userId,
        month: currentMonth,
        year: currentYear,
      }
    });
    console.log('🔍 MONTH/YEAR FILTERED BUDGETS:', monthYearBudgets.length);

    // Check what months/years exist for this user
    const budgetMonthYears = await prisma.budget.findMany({
      where: { userId: userId },
      select: { month: true, year: true },
      distinct: ['month', 'year']
    });
    console.log('🔍 AVAILABLE MONTH/YEARS:', budgetMonthYears);

    // Get user's accounts
    const accounts = await prisma.account.findMany({
      where: { userId: userId },
    });
    console.log('🔍 USER ACCOUNTS:', accounts.length);

    // Ensure "To Be Assigned" budget exists for the current month
    const existingToBeAssignedBudget = await prisma.budget.findFirst({
      where: {
        userId: userId,
        name: 'To Be Assigned',
        month: currentMonth,
        year: currentYear,
      },
    });

    let toBeAssignedRecord = existingToBeAssignedBudget;
    if (!existingToBeAssignedBudget) {
      console.log('📝 Creating missing "To Be Assigned" budget for current month');
      toBeAssignedRecord = await prisma.budget.create({
        data: {
          userId: userId,
          name: 'To Be Assigned',
          category: 'Income',
          amount: 0,
          spent: 0,
          month: currentMonth,
          year: currentYear,
        }
      });
    }

    // The "To Be Assigned" budget amount should now be correctly maintained by transaction imports
    console.log('💰 "To Be Assigned" budget should be automatically maintained by transaction imports');
    
    if (toBeAssignedRecord) {
      console.log(`💰 Current "To Be Assigned" amount: $${toBeAssignedRecord.amount.toFixed(2)}`);
    } else {
      console.warn('⚠️ "To Be Assigned" budget record not found - this should not happen');
    }

    // Use the month/year filtered budgets for the final query
    const budgets = await prisma.budget.findMany({
      where: {
        userId: userId,
        month: currentMonth,
        year: currentYear,
      },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1),
            },
          },
        },
      },
    });

    // Get recent transactions from connected accounts only
    const recentTransactions = await getUserTransactionsFromConnectedAccounts(
      userId,
      undefined, // No specific account filter
      10 // Limit to 10 recent transactions
    );

    // Get goals
    const goals = await prisma.goal.findMany({
      where: { userId: userId },
      orderBy: { priority: 'asc' },
    });

    // Calculate totals
    const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
    
    // Separate cash accounts from credit/debt accounts for proper zero-based budgeting
    const cashAccounts = accounts.filter(account => 
      account.accountType === 'depository' || 
      account.accountType === 'investment' ||
      (account.accountType === 'other' && account.balance > 0)
    );
    
    const debtAccounts = accounts.filter(account => 
      account.accountType === 'credit' || 
      account.accountType === 'loan' ||
      (account.accountType === 'other' && account.balance < 0)
    );
    
    // Only count positive cash balances for "To Be Assigned"
    const totalCashBalance = cashAccounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0);
    const totalDebtBalance = debtAccounts.reduce((sum, account) => sum + account.balance, 0);
    const totalBalance = totalCashBalance + totalDebtBalance; // For display purposes
    
    // Get "To Be Assigned" amount from the budget (YNAB methodology)
    const toBeAssignedBudget = budgets.find(budget => budget.name === 'To Be Assigned');
    const toBeAssigned = toBeAssignedBudget ? toBeAssignedBudget.amount - toBeAssignedBudget.spent : 0;

    // Group budgets by category (Bills, Frequent, etc.)
    const budgetsByCategory = budgets.reduce((acc, budget) => {
      // Skip "To Be Assigned" - it's handled separately
      if (budget.name === 'To Be Assigned') {
        return acc;
      }
      
      // Normalize credit card categories to consolidate them
      let categoryGroup = budget.category || 'Misc';
      
      // Consolidate all credit card payment categories
      if (categoryGroup === 'Credit Card Payment' || 
          categoryGroup.startsWith('Credit Card Payments:') ||
          categoryGroup.includes('Credit Card')) {
        categoryGroup = 'Credit Card Payments';
      }
      
      if (!acc[categoryGroup]) {
        acc[categoryGroup] = [];
      }
      acc[categoryGroup].push({
        id: budget.id,
        name: budget.name,
        budgeted: budget.amount,
        spent: budget.spent,
        available: budget.amount - budget.spent,
        status: budget.spent > budget.amount ? 'overspent' : 'on-track',
      });
      return acc;
    }, {} as { [key: string]: any[] });

    // Transform to the expected format with category groups
    const categories = Object.entries(budgetsByCategory)
      .map(([categoryName, budgetItems]) => ({
        id: categoryName.toLowerCase().replace(/\s+/g, '-'),
        name: categoryName,
        category: categoryName,
        budgets: budgetItems,
        totalBudgeted: budgetItems.reduce((sum, item) => sum + item.budgeted, 0),
        totalSpent: budgetItems.reduce((sum, item) => sum + item.spent, 0),
        totalAvailable: budgetItems.reduce((sum, item) => sum + item.available, 0),
      }))
      .sort((a, b) => {
        // Always put Credit Card Payments at the top
        if (a.name === 'Credit Card Payments') return -1;
        if (b.name === 'Credit Card Payments') return 1;
        
        // Then sort alphabetically
        return a.name.localeCompare(b.name);
      });

    // Transform goals data and link to corresponding budgets
    const transformedGoals = goals.map(goal => {
      // Find the corresponding budget for this goal
      let correspondingBudget;
      
      // Check if goal has linkedBudgetId in description metadata
      const linkedBudgetMatch = goal.description?.match(/\[LINKED_BUDGET:([^\]]+)\]/);
      const linkedBudgetId = linkedBudgetMatch ? linkedBudgetMatch[1] : null;
      
      if (linkedBudgetId) {
        // New budget-centric approach: find budget by linkedBudgetId from metadata
        correspondingBudget = budgets.find(budget => budget.id === linkedBudgetId);
      } else {
        // Legacy approach: find budget by name and category
        correspondingBudget = budgets.find(budget => 
          budget.name === goal.name && 
          (goal.type === 'debt' ? budget.category === 'Debt Payoff' : budget.category === 'Savings Goals')
        );
      }
      
      // Use budget available amount as the current amount for the goal
      const currentAmount = correspondingBudget ? correspondingBudget.amount - correspondingBudget.spent : goal.currentAmount;
      
      return {
        id: goal.id,
        name: goal.name,
        current: Math.max(0, currentAmount), // Don't show negative amounts
        target: goal.targetAmount,
        budgetId: correspondingBudget?.id || null,
        budgetAllocated: correspondingBudget?.amount || 0,
        budgetSpent: correspondingBudget?.spent || 0,
        monthlyPayment: goal.type === 'debt' ? Math.ceil((goal.targetAmount - currentAmount) / 12) : Math.ceil(goal.targetAmount / 12),
        payoffDate: goal.targetDate?.toLocaleDateString() || 'No target date',
        type: goal.type,
      };
    });

    // Transform transactions
    const transformedTransactions = recentTransactions.map(transaction => ({
      name: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date.toLocaleDateString(),
      account: transaction.account.accountName,
    }));

    const dashboardData = {
      toBeAssigned, // Use the "To Be Assigned" budget amount (YNAB methodology)
      totalBudgeted,
      totalSpent,
      totalBalance, // All accounts combined for net worth display
      totalCashBalance, // Available cash for budgeting
      totalDebtBalance, // Total debt (negative)
      categories,
      goals: transformedGoals,
      recentTransactions: transformedTransactions,
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}