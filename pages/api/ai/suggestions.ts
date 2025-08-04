import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

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
  }
}

async function generateFinancialSuggestions(userId: string, data: any) {
  const suggestions = [];
  
  const { accounts, budgets, transactions, goals } = data;
  
  // Filter recent transactions (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const recentTransactions = transactions.filter((t: any) => 
    new Date(t.date) >= ninetyDaysAgo
  );

  // Calculate financial metrics from recent data
  const totalIncome = recentTransactions
    .filter((t: any) => t.amount > 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0) / 3; // 3-month average
    
  const totalExpenses = Math.abs(recentTransactions
    .filter((t: any) => t.amount < 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0)) / 3; // 3-month average
    
  const cashBalance = accounts
    .filter((a: any) => a.accountType === 'depository')
    .reduce((sum: number, a: any) => sum + a.balance, 0);
    
  // Fix credit card debt calculation - positive balances are debt for credit cards
  const totalDebt = accounts
    .filter((a: any) => a.accountType === 'credit' && a.balance > 0)
    .reduce((sum: number, a: any) => sum + a.balance, 0);
    
  const monthlySurplus = totalIncome - totalExpenses;
  const emergencyFundMonths = totalExpenses > 0 ? cashBalance / totalExpenses : 0;

  console.log('💰 Financial Metrics:', {
    totalIncome: totalIncome.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    cashBalance: cashBalance.toFixed(2), 
    totalDebt: totalDebt.toFixed(2),
    monthlySurplus: monthlySurplus.toFixed(2),
    emergencyFundMonths: emergencyFundMonths.toFixed(1)
  });

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
  if (totalExpenses > 0 && emergencyFundMonths < 3 && monthlySurplus > 50) {
    const targetAmount = totalExpenses * 3;
    const neededAmount = Math.max(0, targetAmount - cashBalance);
    const suggestedMonthly = Math.min(
      monthlySurplus * 0.3, // Don't use more than 30% of surplus
      neededAmount / 12,     // Spread over 12 months max
      300                    // Cap at $300/month
    );
    const monthsToTarget = suggestedMonthly > 0 ? Math.ceil(neededAmount / suggestedMonthly) : 999;
    
    if (neededAmount > 0 && suggestedMonthly >= 25) { // Only suggest if meaningful amount
      suggestions.push({
        id: `emergency-fund-${Date.now()}`,
        type: 'savings_boost',
        title: 'Build Emergency Fund',
        description: `You have ${emergencyFundMonths.toFixed(1)} months of expenses saved. Aim for 3 months ($${Math.round(targetAmount)}).`,
        impact: `Reach 3-month fund in ${monthsToTarget} months`,
        actionText: 'Auto-Save',
        priority: emergencyFundMonths < 1 ? 'high' : 'medium',
        data: {
          currentMonths: emergencyFundMonths,
          currentAmount: cashBalance,
          targetAmount: targetAmount,
          neededAmount: neededAmount,
          suggestedMonthly: suggestedMonthly,
          timeToTarget: monthsToTarget
        }
      });
    }
  }

  // 3. Debt Payoff Suggestions
  if (totalDebt > 0 && monthlySurplus > 100) {
    const minPayment = totalDebt * 0.025; // Assume 2.5% minimum payment
    const extraPayment = Math.min(
      monthlySurplus * 0.4, // Up to 40% of surplus for debt
      500,                  // Cap at $500/month extra
      totalDebt * 0.1       // Don't exceed 10% of total debt per month
    );
    
    if (extraPayment >= 25) { // Only suggest if meaningful
      // Rough calculation assuming 18% average APR
      const totalMonthlyPayment = minPayment + extraPayment;
      const monthsToPayoff = Math.log(1 + (totalDebt * 0.18/12) / totalMonthlyPayment) / Math.log(1 + 0.18/12);
      const interestSaved = totalDebt * 0.18 * 0.3; // Estimate 30% interest savings with extra payments
      
      suggestions.push({
        id: `debt-payoff-${Date.now()}`,
        type: 'debt_strategy',
        title: 'Accelerate Debt Payoff',
        description: `Add $${Math.round(extraPayment)}/month to debt payments. Focus on highest interest rates first.`,
        impact: `Save ~$${Math.round(interestSaved)} in interest`,
        actionText: 'Create Plan',
        priority: totalDebt > (totalIncome * 12) * 0.3 ? 'high' : 'medium',
        data: {
          totalDebt,
          currentMinPayment: minPayment,
          extraPayment,
          totalMonthlyPayment: totalMonthlyPayment,
          strategy: 'avalanche',
          estimatedSavings: interestSaved,
          monthsToPayoff: Math.ceil(monthsToPayoff)
        }
      });
    }
  }

  // 4. Spending Pattern Alerts  
  const categorySpending = recentTransactions.reduce((acc: any, t: any) => {
    if (t.amount < 0 && t.category) {
      const category = t.category;
      acc[category] = (acc[category] || 0) + Math.abs(t.amount);
    }
    return acc;
  }, {});

  const topSpendingCategories = Object.entries(categorySpending)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3); // Top 3 spending categories

  // Only alert if spending is significantly high (>25% of total expenses)
  const highSpendingCategory = topSpendingCategories.find(([category, amount]) => 
    (amount as number) > totalExpenses * 0.25
  );

  if (highSpendingCategory && totalExpenses > 0) {
    const [category, amount] = highSpendingCategory as [string, number];
    const monthlyAmount = amount / 3; // Convert to monthly
    
    suggestions.push({
      id: `spending-alert-${Date.now()}`,
      type: 'spending_alert',
      title: `High ${category} Spending`,
      description: `You're spending $${Math.round(monthlyAmount)}/month on ${category}. This is ${Math.round((monthlyAmount/totalExpenses)*100)}% of your expenses.`,
      impact: `Save $${Math.round(monthlyAmount * 0.15)}/month with modest reduction`,
      actionText: 'Set Budget',
      priority: monthlyAmount > totalExpenses * 0.3 ? 'high' : 'medium',
      data: {
        category,
        monthlyAmount,
        percentOfExpenses: (monthlyAmount/totalExpenses)*100,
        suggestedLimit: monthlyAmount * 0.85,
        potentialSavings: monthlyAmount * 0.15
      }
    });
  }

  // 5. Goal Acceleration
  const activeGoals = goals.filter((g: any) => 
    g.currentAmount < g.targetAmount && 
    g.targetAmount > 0 &&
    g.currentAmount >= 0
  );
  
  if (activeGoals.length > 0 && monthlySurplus > 150) {
    // Sort goals by completion percentage to prioritize closer goals
    const priorityGoal = activeGoals.sort((a: any, b: any) => {
      const aProgress = a.currentAmount / a.targetAmount;
      const bProgress = b.currentAmount / b.targetAmount;
      return bProgress - aProgress; // Higher completion percentage first
    })[0];
    
    const remainingAmount = priorityGoal.targetAmount - priorityGoal.currentAmount;
    const suggestedBoost = Math.min(
      monthlySurplus * 0.25,  // Up to 25% of surplus
      remainingAmount / 6,     // Complete in 6 months if possible
      200                      // Cap at $200/month
    );
    
    if (suggestedBoost >= 25 && remainingAmount > 100) {
      const monthsToComplete = Math.ceil(remainingAmount / suggestedBoost);
      const progressPercent = Math.round((priorityGoal.currentAmount / priorityGoal.targetAmount) * 100);
      
      suggestions.push({
        id: `goal-accelerator-${Date.now()}`,
        type: 'goal_accelerator',
        title: `Accelerate ${priorityGoal.name}`,
        description: `You're ${progressPercent}% complete! Add $${Math.round(suggestedBoost)}/month to finish in ${monthsToComplete} months.`,
        impact: `Complete goal in ${monthsToComplete} months`,
        actionText: 'Boost Goal',
        priority: progressPercent > 50 ? 'medium' : 'low',
        data: {
          goalId: priorityGoal.id,
          goalName: priorityGoal.name,
          currentAmount: priorityGoal.currentAmount,
          targetAmount: priorityGoal.targetAmount,
          remainingAmount: remainingAmount,
          progressPercent: progressPercent,
          suggestedBoost: suggestedBoost,
          monthsToComplete: monthsToComplete
        }
      });
    }
  }

  // Limit to top 3 suggestions and sort by priority
  const priorityOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
  return suggestions
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 3);
}