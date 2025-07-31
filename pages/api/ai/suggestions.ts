import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get comprehensive financial data
    const [accounts, budgets, transactions, goals] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.budget.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({ 
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 100
      }),
      prisma.goal.findMany({ where: { userId: user.id } })
    ]);

    // Generate intelligent suggestions based on financial data
    const suggestions = await generateFinancialSuggestions(user.id, {
      accounts,
      budgets,
      transactions,
      goals
    });

    return res.status(200).json({
      suggestions,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return res.status(500).json({ error: 'Failed to generate suggestions' });
  } finally {
    await prisma.$disconnect();
  }
}

async function generateFinancialSuggestions(userId: string, data: any) {
  const suggestions = [];
  
  const { accounts, budgets, transactions, goals } = data;
  
  // Calculate financial metrics
  const totalIncome = transactions
    .filter((t: any) => t.amount > 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0) / 3; // 3-month average
    
  const totalExpenses = Math.abs(transactions
    .filter((t: any) => t.amount < 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0)) / 3; // 3-month average
    
  const cashBalance = accounts
    .filter((a: any) => a.accountType === 'depository')
    .reduce((sum: number, a: any) => sum + a.balance, 0);
    
  const totalDebt = Math.abs(accounts
    .filter((a: any) => (a.accountType === 'credit' || a.accountType === 'loan') && a.balance < 0)
    .reduce((sum: number, a: any) => sum + a.balance, 0));
    
  const monthlySurplus = totalIncome - totalExpenses;
  const emergencyFundMonths = totalExpenses > 0 ? cashBalance / totalExpenses : 0;

  // 1. Budget Optimization Suggestions
  const overBudgetCategories = budgets.filter((b: any) => b.spent > b.amount * 1.1);
  if (overBudgetCategories.length > 0) {
    const biggestOverspend = overBudgetCategories
      .sort((a: any, b: any) => (b.spent - b.amount) - (a.spent - a.amount))[0];
    
    suggestions.push({
      id: `budget-optimize-${Date.now()}`,
      type: 'budget_optimization',
      title: `Optimize ${biggestOverspend.name} Budget`,
      description: `You're $${Math.round(biggestOverspend.spent - biggestOverspend.amount)} over budget. Consider reducing spending or increasing allocation.`,
      impact: `Save $${Math.round((biggestOverspend.spent - biggestOverspend.amount) * 0.7)}/month`,
      actionText: 'Adjust Budget',
      priority: 'high',
      data: {
        budgetId: biggestOverspend.id,
        category: biggestOverspend.name,
        overspendAmount: biggestOverspend.spent - biggestOverspend.amount,
        suggestedReduction: Math.round((biggestOverspend.spent - biggestOverspend.amount) * 0.7)
      }
    });
  }

  // 2. Emergency Fund Suggestions
  if (emergencyFundMonths < 3 && monthlySurplus > 0) {
    const monthsToTarget = (totalExpenses * 3 - cashBalance) / monthlySurplus;
    suggestions.push({
      id: `emergency-fund-${Date.now()}`,
      type: 'savings_boost',
      title: 'Build Emergency Fund',
      description: `You have ${emergencyFundMonths.toFixed(1)} months of expenses saved. Build to 3 months for security.`,
      impact: `Reach 3-month fund in ${Math.ceil(monthsToTarget)} months`,
      actionText: 'Auto-Save',
      priority: emergencyFundMonths < 1 ? 'high' : 'medium',
      data: {
        currentMonths: emergencyFundMonths,
        targetAmount: totalExpenses * 3,
        suggestedMonthly: Math.min(monthlySurplus * 0.5, (totalExpenses * 3 - cashBalance) / 6),
        timeToTarget: monthsToTarget
      }
    });
  }

  // 3. Debt Payoff Suggestions
  if (totalDebt > 0 && monthlySurplus > 0) {
    const extraPayment = Math.min(monthlySurplus * 0.3, 500);
    const monthsToPayoff = totalDebt / (extraPayment + (totalDebt * 0.02)); // Rough estimate
    const interestSaved = totalDebt * 0.18 * (monthsToPayoff / 12) * 0.5; // Rough interest savings
    
    suggestions.push({
      id: `debt-payoff-${Date.now()}`,
      type: 'debt_strategy',
      title: 'Accelerate Debt Payoff',
      description: `Add $${Math.round(extraPayment)} to your monthly debt payments using avalanche method.`,
      impact: `Save ~$${Math.round(interestSaved)} in interest`,
      actionText: 'Create Plan',
      priority: totalDebt > totalIncome * 0.3 ? 'high' : 'medium',
      data: {
        totalDebt,
        extraPayment,
        strategy: 'avalanche',
        estimatedSavings: interestSaved,
        monthsToPayoff: Math.ceil(monthsToPayoff)
      }
    });
  }

  // 4. Spending Pattern Alerts
  const recentTransactions = transactions.slice(0, 30);
  const categorySpending = recentTransactions.reduce((acc: any, t: any) => {
    if (t.amount < 0) {
      const category = t.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + Math.abs(t.amount);
    }
    return acc;
  }, {});

  const topSpendingCategory = Object.entries(categorySpending)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];

  if (topSpendingCategory && (topSpendingCategory[1] as number) > totalExpenses * 0.2) {
    const [category, amount] = topSpendingCategory as [string, number];
    suggestions.push({
      id: `spending-alert-${Date.now()}`,
      type: 'spending_alert',
      title: `High ${category} Spending`,
      description: `You've spent $${Math.round(amount)} on ${category} recently. Consider setting a limit.`,
      impact: `Save $${Math.round(amount * 0.2)}/month with 20% reduction`,
      actionText: 'Set Limit',
      priority: 'medium',
      data: {
        category,
        recentAmount: amount,
        suggestedLimit: amount * 0.8,
        potentialSavings: amount * 0.2
      }
    });
  }

  // 5. Goal Acceleration
  const activeGoals = goals.filter((g: any) => g.currentAmount < g.targetAmount);
  if (activeGoals.length > 0 && monthlySurplus > 100) {
    const priorityGoal = activeGoals[0]; // First goal
    const monthsToGoal = (priorityGoal.targetAmount - priorityGoal.currentAmount) / (monthlySurplus * 0.2);
    
    suggestions.push({
      id: `goal-accelerator-${Date.now()}`,
      type: 'goal_accelerator',
      title: `Accelerate ${priorityGoal.name}`,
      description: `Add $${Math.round(monthlySurplus * 0.2)}/month to reach your goal faster.`,
      impact: `Reach goal ${Math.ceil(monthsToGoal)} months sooner`,
      actionText: 'Boost Goal',
      priority: 'low',
      data: {
        goalId: priorityGoal.id,
        goalName: priorityGoal.name,
        currentAmount: priorityGoal.currentAmount,
        targetAmount: priorityGoal.targetAmount,
        suggestedBoost: monthlySurplus * 0.2,
        acceleratedTimeline: monthsToGoal
      }
    });
  }

  // Limit to top 3 suggestions and sort by priority
  const priorityOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
  return suggestions
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 3);
}