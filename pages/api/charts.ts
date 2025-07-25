import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';

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
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Get transactions for current month
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: userId,
        date: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
      },
      orderBy: { date: 'asc' },
    });

    // Get budgets for current month
    const budgets = await prisma.budget.findMany({
      where: {
        userId: userId,
        month: currentMonth,
        year: currentYear,
      },
    });

    // Get goals
    const goals = await prisma.goal.findMany({
      where: { userId: userId },
    });

    // Generate spending trends data (daily spending)
    const spendingTrends = generateSpendingTrends(transactions);

    // Generate category breakdown
    const categoryBreakdown = generateCategoryBreakdown(transactions);

    // Generate budget vs actual data
    const budgetVsActual = generateBudgetVsActual(budgets);

    // Generate cash flow data
    const cashFlow = generateCashFlow(transactions);

    // Generate goal progress data
    const goalProgress = generateGoalProgress(goals);

    // Generate monthly comparison (last 6 months)
    const monthlyComparison = await generateMonthlyComparison(userId, currentMonth, currentYear);

    res.json({
      spendingTrends,
      categoryBreakdown,
      budgetVsActual,
      cashFlow,
      goalProgress,
      monthlyComparison,
    });
  } catch (error) {
    console.error('Error generating chart data:', error);
    res.status(500).json({ error: 'Failed to generate chart data' });
  }
}

function generateSpendingTrends(transactions: any[]) {
  const dailySpending: Record<string, number> = {};
  
  transactions.forEach(tx => {
    if (tx.amount < 0) { // Only expenses
      const date = tx.date.toISOString().split('T')[0];
      dailySpending[date] = (dailySpending[date] || 0) + Math.abs(tx.amount);
    }
  });

  const sortedDates = Object.keys(dailySpending).sort();
  const labels = sortedDates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const data = sortedDates.map(date => dailySpending[date]);

  return {
    labels,
    datasets: [{
      label: 'Daily Spending',
      data,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true,
    }]
  };
}

function generateCategoryBreakdown(transactions: any[]) {
  const categorySpending: Record<string, number> = {};
  
  transactions.forEach(tx => {
    if (tx.amount < 0) { // Only expenses
      categorySpending[tx.category] = (categorySpending[tx.category] || 0) + Math.abs(tx.amount);
    }
  });

  const labels = Object.keys(categorySpending);
  const data = Object.values(categorySpending);
  
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
  ];

  return {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, labels.length),
      borderColor: colors.slice(0, labels.length).map(color => color + '80'),
      borderWidth: 2,
    }]
  };
}

function generateBudgetVsActual(budgets: any[]) {
  const labels = budgets.map(budget => budget.category);
  const budgetedData = budgets.map(budget => budget.amount);
  const spentData = budgets.map(budget => budget.spent);

  return {
    labels,
    datasets: [
      {
        label: 'Budgeted',
        data: budgetedData,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
      },
      {
        label: 'Spent',
        data: spentData,
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
      }
    ]
  };
}

function generateCashFlow(transactions: any[]) {
  const monthlyData: Record<string, { income: number; expenses: number }> = {};
  
  transactions.forEach(tx => {
    const monthKey = tx.date.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }
    
    if (tx.amount > 0) {
      monthlyData[monthKey].income += tx.amount;
    } else {
      monthlyData[monthKey].expenses += Math.abs(tx.amount);
    }
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const labels = sortedMonths.map(month => new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  const incomeData = sortedMonths.map(month => monthlyData[month].income);
  const expenseData = sortedMonths.map(month => monthlyData[month].expenses);

  return {
    labels,
    datasets: [
      {
        label: 'Income',
        data: incomeData,
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
      },
      {
        label: 'Expenses',
        data: expenseData,
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
      }
    ]
  };
}

function generateGoalProgress(goals: any[]) {
  return goals.map(goal => ({
    id: goal.id,
    name: goal.name,
    type: goal.type,
    progress: (goal.currentAmount / goal.targetAmount) * 100,
    current: goal.currentAmount,
    target: goal.targetAmount,
    remaining: goal.targetAmount - goal.currentAmount,
  }));
}

async function generateMonthlyComparison(userId: string, currentMonth: number, currentYear: number) {
  const monthlyData = [];
  
  for (let i = 5; i >= 0; i--) {
    const month = currentMonth - i;
    const year = month <= 0 ? currentYear - 1 : currentYear;
    const adjustedMonth = month <= 0 ? 12 + month : month;
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(year, adjustedMonth - 1, 1),
          lt: new Date(year, adjustedMonth, 1),
        },
      },
    });
    
    const totalSpent = transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    const totalIncome = transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    monthlyData.push({
      month: new Date(year, adjustedMonth - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      spent: totalSpent,
      income: totalIncome,
      net: totalIncome - totalSpent,
    });
  }
  
  return {
    labels: monthlyData.map(d => d.month),
    datasets: [
      {
        label: 'Monthly Spending',
        data: monthlyData.map(d => d.spent),
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
      },
      {
        label: 'Monthly Income',
        data: monthlyData.map(d => d.income),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
      }
    ]
  };
}