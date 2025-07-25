import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { getUserTransactionsFromConnectedAccounts } from '../../lib/transaction-validation';

const prisma = new PrismaClient();

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
      SELECT COUNT(*) as count FROM Budget WHERE userId = ${userId}
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
    
    // Calculate "To Be Assigned" - available cash minus what's been budgeted
    const toBeAssigned = totalCashBalance - totalBudgeted;

    // Group budgets by category (Bills, Frequent, etc.)
    const budgetsByCategory = budgets.reduce((acc, budget) => {
      const categoryGroup = budget.category || 'Misc';
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
    const categories = Object.entries(budgetsByCategory).map(([categoryName, budgetItems]) => ({
      id: categoryName.toLowerCase().replace(/\s+/g, '-'),
      name: categoryName,
      category: categoryName,
      budgets: budgetItems,
      totalBudgeted: budgetItems.reduce((sum, item) => sum + item.budgeted, 0),
      totalSpent: budgetItems.reduce((sum, item) => sum + item.spent, 0),
      totalAvailable: budgetItems.reduce((sum, item) => sum + item.available, 0),
    }));

    // Transform goals data
    const transformedGoals = goals.map(goal => ({
      id: goal.id,
      name: goal.name,
      current: goal.currentAmount,
      target: goal.targetAmount,
      monthlyPayment: goal.type === 'debt' ? Math.ceil((goal.targetAmount - goal.currentAmount) / 12) : Math.ceil(goal.targetAmount / 12),
      payoffDate: goal.targetDate?.toLocaleDateString() || 'No target date',
      type: goal.type,
    }));

    // Transform transactions
    const transformedTransactions = recentTransactions.map(transaction => ({
      name: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date.toLocaleDateString(),
      account: transaction.account.accountName,
    }));

    const dashboardData = {
      toBeAssigned: totalCashBalance - totalBudgeted, // Only cash available for budgeting
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