import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  } finally {
    await prisma.$disconnect();
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
  const { suggestedMonthly } = data;
  
  // Create or update Emergency Fund budget
  const existingBudget = await prisma.budget.findFirst({
    where: { 
      userId, 
      name: { contains: 'Emergency' },
      category: 'Savings'
    }
  });
  
  if (existingBudget) {
    await prisma.budget.update({
      where: { id: existingBudget.id },
      data: { amount: existingBudget.amount + suggestedMonthly }
    });
  } else {
    await prisma.budget.create({
      data: {
        userId,
        name: 'Emergency Fund',
        amount: suggestedMonthly,
        spent: 0,
        category: 'Savings',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      }
    });
  }
  
  return {
    message: `Emergency fund savings increased by $${suggestedMonthly.toFixed(2)}/month`
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
  const { category, suggestedLimit } = data;
  
  // Find or create budget for this category
  const existingBudget = await prisma.budget.findFirst({
    where: { 
      userId,
      name: category,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    }
  });
  
  if (existingBudget) {
    await prisma.budget.update({
      where: { id: existingBudget.id },
      data: { amount: suggestedLimit }
    });
  } else {
    await prisma.budget.create({
      data: {
        userId,
        name: category,
        amount: suggestedLimit,
        spent: 0,
        category: 'Discretionary Spending',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      }
    });
  }
  
  return {
    message: `Spending limit set! ${category} budget limited to $${suggestedLimit.toFixed(2)}/month`
  };
}

async function executeGoalAccelerator(userId: string, data: any) {
  const { goalId, suggestedBoost } = data;
  
  // Update the goal's current amount
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId }
  });
  
  if (!goal) {
    throw new Error('Goal not found');
  }
  
  await prisma.goal.update({
    where: { id: goalId },
    data: { currentAmount: goal.currentAmount + suggestedBoost }
  });
  
  // Create or update goal budget
  const goalBudgetName = `${goal.name} Savings`;
  const existingBudget = await prisma.budget.findFirst({
    where: { 
      userId,
      name: { contains: goal.name },
      category: 'Savings'
    }
  });
  
  if (existingBudget) {
    await prisma.budget.update({
      where: { id: existingBudget.id },
      data: { amount: existingBudget.amount + suggestedBoost }
    });
  } else {
    await prisma.budget.create({
      data: {
        userId,
        name: goalBudgetName,
        amount: suggestedBoost,
        spent: 0,
        category: 'Savings',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      }
    });
  }
  
  return {
    message: `Goal accelerated! Added $${suggestedBoost.toFixed(2)}/month to ${goal.name}`
  };
}