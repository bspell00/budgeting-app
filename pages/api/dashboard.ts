import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getUserTransactionsFromConnectedAccounts } from '../../lib/transaction-validation';
import { FinancialCalculator } from '../../lib/financial-calculator';
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
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  try {
    console.log('💰 Dashboard: Using simplified financial calculator');
    
    // Use the centralized financial calculator for all calculations
    const metrics = await FinancialCalculator.ensureToBeAssignedBudget(userId);
    
    // Get recent transactions and goals in parallel
    const [recentTransactions, goals] = await Promise.all([
      getUserTransactionsFromConnectedAccounts(
        userId,
        undefined, // No specific account filter
        10 // Limit to 10 recent transactions
      ),
      prisma.goal.findMany({
        where: { userId: userId },
        orderBy: { priority: 'asc' },
      })
    ]);

    // Format categories for dashboard display
    const categories = FinancialCalculator.formatBudgetsForDashboard(metrics.budgets.all);

    // Transform goals data and link to corresponding budgets
    const transformedGoals = goals.map(goal => {
      // Find the corresponding budget for this goal
      let correspondingBudget;
      
      // Check if goal has linkedBudgetId in description metadata
      const linkedBudgetMatch = goal.description?.match(/\[LINKED_BUDGET:([^\]]+)\]/);
      const linkedBudgetId = linkedBudgetMatch ? linkedBudgetMatch[1] : null;
      
      if (linkedBudgetId) {
        // New budget-centric approach: find budget by linkedBudgetId from metadata
        correspondingBudget = metrics.budgets.all.find(budget => budget.id === linkedBudgetId);
      } else {
        // Legacy approach: find budget by name and category
        correspondingBudget = metrics.budgets.all.find(budget => 
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

    // Transform transactions for display
    const transformedTransactions = recentTransactions.map(transaction => ({
      name: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date.toLocaleDateString(),
      account: transaction.account.accountName,
    }));

    // Create simplified, consistent response
    const dashboardData = {
      // Core financial metrics (single source of truth)
      toBeAssigned: metrics.budgets.toBeAssigned - (metrics.budgets.toBeAssignedBudget?.spent || 0),
      totalBudgeted: metrics.budgets.totalBudgeted,
      totalSpent: metrics.budgets.totalSpent,
      totalBalance: metrics.accounts.netWorth,
      totalCashBalance: metrics.accounts.totalCash,
      totalDebtBalance: metrics.accounts.totalDebt,
      
      // Formatted data for UI
      categories,
      goals: transformedGoals,
      recentTransactions: transformedTransactions,
    };

    console.log(`✅ Dashboard data calculated:`);
    console.log(`💰 Cash: $${metrics.accounts.totalCash.toFixed(2)}`);
    console.log(`💰 Budgeted: $${metrics.budgets.totalBudgeted.toFixed(2)}`);
    console.log(`💰 To Be Assigned: $${dashboardData.toBeAssigned.toFixed(2)}`);

    res.json(dashboardData);
  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}