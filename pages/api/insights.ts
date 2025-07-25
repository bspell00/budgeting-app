import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { InsightsEngine } from '../../lib/insights';

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

    // Get user's transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: userId,
        date: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
      },
      orderBy: { date: 'desc' },
    });

    // Get budget data
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

    // Get account balances
    const accounts = await prisma.account.findMany({
      where: { userId: userId },
    });

    // Calculate totals
    const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

    // Transform data for insights engine
    const dashboardData = {
      totalBudgeted,
      totalSpent,
      toBeAssigned: totalBalance - totalBudgeted,
      categories: budgets.map(budget => ({
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        spent: budget.spent,
        available: budget.amount - budget.spent,
        category: budget.category,
      })),
      goals: goals.map(goal => ({
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        type: goal.type as 'savings' | 'debt',
        targetDate: goal.targetDate?.toISOString(),
      })),
    };

    const transactionData = transactions.map(tx => ({
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
      date: tx.date.toISOString(),
    }));

    // Generate AI insights
    const insightsEngine = new InsightsEngine(transactionData, dashboardData);
    const insights = insightsEngine.generateInsights();

    // Limit to top 10 insights
    const topInsights = insights.slice(0, 10);

    res.json({
      insights: topInsights,
      summary: {
        totalInsights: insights.length,
        highPriority: insights.filter(i => i.priority === 'high').length,
        warnings: insights.filter(i => i.type === 'warning').length,
        tips: insights.filter(i => i.type === 'tip').length,
        trends: insights.filter(i => i.type === 'trend').length,
        successes: insights.filter(i => i.type === 'success').length,
      },
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
}