import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    const { suggestionId, type, data } = req.body;

    if (!suggestionId || !type || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let result;
    let message = '';

    switch (type) {
      case 'budget_optimization':
        result = await executeBudgetOptimization(user.id, data);
        message = result.message;
        break;
        
      case 'savings_boost':
        result = await executeSavingsBoost(user.id, data);
        message = result.message;
        break;
        
      case 'debt_strategy':
        result = await executeDebtStrategy(user.id, data);
        message = result.message;
        break;
        
      case 'spending_alert':
        result = await executeSpendingAlert(user.id, data);
        message = result.message;
        break;
        
      case 'goal_accelerator':
        result = await executeGoalAccelerator(user.id, data);
        message = result.message;
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown suggestion type' });
    }

    return res.status(200).json({
      success: true,
      message,
      result
    });

  } catch (error) {
    console.error('Error executing suggestion:', error);
    return res.status(500).json({ error: 'Failed to execute suggestion' });
  }
}

async function executeBudgetOptimization(userId: string, data: any) {
  const { budgetId, suggestedReduction } = data;
  
  // Get the budget
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId }
  });
  
  if (!budget) {
    throw new Error('Budget not found');
  }
  
  // Reduce the budget allocation by suggested amount
  const newAmount = Math.max(budget.amount - suggestedReduction, budget.spent);
  
  await prisma.budget.update({
    where: { id: budgetId },
    data: { amount: newAmount }
  });
  
  return {
    message: `Budget adjusted! Reduced ${budget.name} by $${suggestedReduction.toFixed(2)}`
  };
}

async function executeSavingsBoost(userId: string, data: any) {
  const { suggestedMonthly, targetAmount, currentAmount } = data;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const monthlyAmount = Math.round(suggestedMonthly);
  
  // Create or update Emergency Fund budget for current month
  const existingBudget = await prisma.budget.findFirst({
    where: { 
      userId, 
      name: { contains: 'Emergency' },
      category: 'Savings',
      month: currentMonth,
      year: currentYear
    }
  });
  
  if (existingBudget) {
    await prisma.budget.update({
      where: { id: existingBudget.id },
      data: { amount: existingBudget.amount + monthlyAmount }
    });
  } else {
    await prisma.budget.create({
      data: {
        userId,
        name: 'Emergency Fund',
        amount: monthlyAmount,
        spent: 0,
        category: 'Savings',
        month: currentMonth,
        year: currentYear
      }
    });
  }
  
  const targetFormatted = targetAmount ? `$${Math.round(targetAmount)}` : '3 months of expenses';
  return {
    message: `Emergency fund savings set to $${monthlyAmount}/month! Working toward ${targetFormatted} target.`
  };
}

async function executeDebtStrategy(userId: string, data: any) {
  const { extraPayment, strategy } = data;
  
  // Find existing debt payment budgets or create new ones
  const debtAccounts = await prisma.account.findMany({
    where: { 
      userId,
      accountType: 'credit',
      balance: { lt: 0 }
    }
  });
  
  if (debtAccounts.length === 0) {
    throw new Error('No debt accounts found');
  }
  
  // Focus on highest balance account for simplicity
  const priorityAccount = debtAccounts.sort((a, b) => a.balance - b.balance)[0];
  const paymentBudgetName = `${priorityAccount.accountName} Payment`;
  
  const existingPaymentBudget = await prisma.budget.findFirst({
    where: { 
      userId,
      name: { contains: priorityAccount.accountName },
      category: 'Credit Card Payments'
    }
  });
  
  if (existingPaymentBudget) {
    await prisma.budget.update({
      where: { id: existingPaymentBudget.id },
      data: { amount: existingPaymentBudget.amount + extraPayment }
    });
  } else {
    await prisma.budget.create({
      data: {
        userId,
        name: paymentBudgetName,
        amount: Math.abs(priorityAccount.balance) * 0.02 + extraPayment, // 2% minimum + extra
        spent: 0,
        category: 'Credit Card Payments',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      }
    });
  }
  
  return {
    message: `Debt payoff plan created! Added $${extraPayment.toFixed(2)} extra payment to ${priorityAccount.accountName}`
  };
}

async function executeSpendingAlert(userId: string, data: any) {
  const { category, suggestedLimit, monthlyAmount } = data;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  // Find or create budget for this category
  const existingBudget = await prisma.budget.findFirst({
    where: { 
      userId,
      name: category,
      month: currentMonth,
      year: currentYear
    }
  });
  
  const budgetAmount = Math.round(suggestedLimit);
  
  if (existingBudget) {
    await prisma.budget.update({
      where: { id: existingBudget.id },
      data: { amount: budgetAmount }
    });
  } else {
    // Determine appropriate category group
    const categoryGroup = getCategoryGroup(category);
    
    await prisma.budget.create({
      data: {
        userId,
        name: category,
        amount: budgetAmount,
        spent: 0,
        category: categoryGroup,
        month: currentMonth,
        year: currentYear
      }
    });
  }
  
  const reduction = Math.round((monthlyAmount || suggestedLimit) - suggestedLimit);
  return {
    message: `Budget created for ${category}! Set limit to $${budgetAmount}/month (${reduction > 0 ? `reducing spending by $${reduction}` : 'based on current spending'})`
  };
}

function getCategoryGroup(categoryName: string): string {
  const category = categoryName.toLowerCase();
  
  if (category.includes('food') || category.includes('dining') || category.includes('restaurant') || category.includes('grocery')) {
    return 'Food & Dining';
  } else if (category.includes('transport') || category.includes('gas') || category.includes('uber') || category.includes('parking')) {
    return 'Transportation';
  } else if (category.includes('entertainment') || category.includes('movie') || category.includes('streaming')) {
    return 'Entertainment';
  } else if (category.includes('shopping') || category.includes('retail') || category.includes('clothing')) {
    return 'Shopping';
  } else if (category.includes('health') || category.includes('medical') || category.includes('pharmacy')) {
    return 'Healthcare';
  } else {
    return 'Discretionary Spending';
  }
}

async function executeGoalAccelerator(userId: string, data: any) {
  const { goalId, goalName, suggestedBoost, monthsToComplete } = data;
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  // Verify the goal exists
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId }
  });
  
  if (!goal) {
    throw new Error('Goal not found');
  }
  
  const monthlyAmount = Math.round(suggestedBoost);
  
  // Create or update goal savings budget for current month
  const goalBudgetName = `${goalName} Savings`;
  const existingBudget = await prisma.budget.findFirst({
    where: { 
      userId,
      name: { contains: goalName },
      category: 'Savings',
      month: currentMonth,
      year: currentYear
    }
  });
  
  if (existingBudget) {
    await prisma.budget.update({
      where: { id: existingBudget.id },
      data: { amount: existingBudget.amount + monthlyAmount }
    });
  } else {
    await prisma.budget.create({
      data: {
        userId,
        name: goalBudgetName,
        amount: monthlyAmount,
        spent: 0,
        category: 'Savings',
        month: currentMonth,
        year: currentYear
      }
    });
  }
  
  return {
    message: `Goal accelerated! Added $${monthlyAmount}/month to ${goalName}. On track to complete in ${monthsToComplete} months.`
  };
}