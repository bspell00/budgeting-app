import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ActionRequest {
  action: string;
  data: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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
    const { action, data }: ActionRequest = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'Action is required' });
    }

    let result;

    switch (action) {
      case 'create_budget':
        result = await handleCreateBudget(userId, data);
        break;
      
      case 'move_money':
        result = await handleMoveMoney(userId, data);
        break;
      
      case 'assign_money':
        result = await handleAssignMoney(userId, data);
        break;
      
      case 'create_goal':
        result = await handleCreateGoal(userId, data);
        break;
      
      case 'fund_goal':
        result = await handleFundGoal(userId, data);
        break;
      
      case 'fix_overspending':
        result = await handleFixOverspending(userId, data);
        break;

      case 'open_assign_money':
      case 'open_fund_goal':
        // These are UI actions that should be handled by the frontend
        result = { message: `Opening ${action.replace('open_', '').replace('_', ' ')} interface...` };
        break;
      
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('AI Action Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
}

async function handleCreateBudget(userId: string, data: any) {
  const { name, amount = 100, category = 'Monthly Bills' } = data;
  
  if (!name) {
    throw new Error('Budget name is required');
  }

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Check if budget already exists
  const existingBudget = await prisma.budget.findFirst({
    where: { userId, name, month: currentMonth, year: currentYear }
  });

  if (existingBudget) {
    throw new Error(`Budget "${name}" already exists for this month`);
  }

  const budget = await prisma.budget.create({
    data: {
      userId,
      name,
      amount: parseFloat(amount),
      category,
      spent: 0,
      month: currentMonth,
      year: currentYear
    }
  });

  return {
    message: `Created budget "${name}" with $${amount} in the ${category} category`,
    budget
  };
}

async function handleMoveMoney(userId: string, data: any) {
  const { fromBudgetId, toBudgetId, amount } = data;
  
  if (!fromBudgetId || !toBudgetId || !amount) {
    throw new Error('From budget, to budget, and amount are required');
  }

  const transferAmount = parseFloat(amount);
  if (transferAmount <= 0) {
    throw new Error('Transfer amount must be positive');
  }

  // Get both budgets
  const [fromBudget, toBudget] = await Promise.all([
    prisma.budget.findFirst({ where: { id: fromBudgetId, userId } }),
    prisma.budget.findFirst({ where: { id: toBudgetId, userId } })
  ]);

  if (!fromBudget || !toBudget) {
    throw new Error('One or both budgets not found');
  }

  if (fromBudget.amount < transferAmount) {
    throw new Error(`Not enough money in ${fromBudget.name}. Available: $${fromBudget.amount}`);
  }

  // Perform the transfer
  await prisma.$transaction([
    prisma.budget.update({
      where: { id: fromBudgetId },
      data: { amount: { decrement: transferAmount } }
    }),
    prisma.budget.update({
      where: { id: toBudgetId },
      data: { amount: { increment: transferAmount } }
    }),
    // Record the transfer for audit trail
    prisma.budgetTransfer.create({
      data: {
        userId,
        fromBudgetId,
        toBudgetId,
        amount: transferAmount,
        reason: `AI Assistant transfer: $${transferAmount} from ${fromBudget.name} to ${toBudget.name}`,
      }
    })
  ]);

  return {
    message: `Moved $${transferAmount} from "${fromBudget.name}" to "${toBudget.name}"`,
    transfer: { fromBudget: fromBudget.name, toBudget: toBudget.name, amount: transferAmount }
  };
}

async function handleAssignMoney(userId: string, data: any) {
  const { budgetId, amount } = data;
  
  if (!budgetId || !amount) {
    throw new Error('Budget ID and amount are required');
  }

  const assignAmount = parseFloat(amount);
  if (assignAmount <= 0) {
    throw new Error('Assignment amount must be positive');
  }

  // Get current account balances and total budgeted
  const [accounts, budgets] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.budget.findMany({ 
      where: { 
        userId, 
        month: new Date().getMonth() + 1, 
        year: new Date().getFullYear() 
      } 
    })
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const toBeAssigned = totalBalance - totalBudgeted;

  if (toBeAssigned < assignAmount) {
    throw new Error(`Not enough money to assign. Available: $${toBeAssigned.toFixed(2)}`);
  }

  // Find the target budget
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  // Assign the money
  await prisma.budget.update({
    where: { id: budgetId },
    data: { amount: { increment: assignAmount } }
  });

  return {
    message: `Assigned $${assignAmount} to "${budget.name}"`,
    assignment: { budgetName: budget.name, amount: assignAmount }
  };
}

async function handleCreateGoal(userId: string, data: any) {
  const { type, name, targetAmount, targetDate, suggestedName, suggestedAmount } = data;
  
  const goalName = name || suggestedName || (type === 'savings' ? 'New Savings Goal' : 'Debt Payoff Goal');
  const goalAmount = targetAmount || suggestedAmount || 1000;

  if (!type || (type !== 'savings' && type !== 'debt')) {
    throw new Error('Goal type must be "savings" or "debt"');
  }

  // Check if goal already exists
  const existingGoal = await prisma.goal.findFirst({
    where: { userId, name: goalName }
  });

  if (existingGoal) {
    throw new Error(`Goal "${goalName}" already exists`);
  }

  const goal = await prisma.goal.create({
    data: {
      userId,
      name: goalName,
      type,
      targetAmount: parseFloat(goalAmount),
      currentAmount: 0,
      targetDate: targetDate ? new Date(targetDate) : null
    }
  });

  return {
    message: `Created ${type} goal "${goalName}" with target of $${goalAmount}`,
    goal
  };
}

async function handleFundGoal(userId: string, data: any) {
  const { goalId, amount, budgetId } = data;
  
  if (!goalId || !amount) {
    throw new Error('Goal ID and amount are required');
  }

  const fundAmount = parseFloat(amount);
  if (fundAmount <= 0) {
    throw new Error('Funding amount must be positive');
  }

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId }
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  // If no specific budget provided, check if there's money to be assigned
  if (!budgetId) {
    const [accounts, budgets] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.budget.findMany({ 
        where: { 
          userId, 
          month: new Date().getMonth() + 1, 
          year: new Date().getFullYear() 
        } 
      })
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const toBeAssigned = totalBalance - totalBudgeted;

    if (toBeAssigned < fundAmount) {
      throw new Error(`Not enough money available. To be assigned: $${toBeAssigned.toFixed(2)}`);
    }
  }

  // Update goal progress
  await prisma.goal.update({
    where: { id: goalId },
    data: { currentAmount: { increment: fundAmount } }
  });

  const newTotal = goal.currentAmount + fundAmount;
  const progress = (newTotal / goal.targetAmount) * 100;

  return {
    message: `Added $${fundAmount} to "${goal.name}". Progress: ${progress.toFixed(1)}% ($${newTotal}/$${goal.targetAmount})`,
    goal: { ...goal, currentAmount: newTotal, progress }
  };
}

async function handleFixOverspending(userId: string, data: any) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Find overspent budgets
  const overspentBudgets = await prisma.budget.findMany({
    where: { 
      userId, 
      month: currentMonth, 
      year: currentYear,
      spent: { gt: prisma.budget.fields.amount }
    },
    orderBy: { spent: 'desc' }
  });

  if (overspentBudgets.length === 0) {
    return {
      message: "No overspent budgets found. Your spending is on track!",
      fixes: []
    };
  }

  // Find budgets with available money
  const availableBudgets = await prisma.budget.findMany({
    where: { 
      userId, 
      month: currentMonth, 
      year: currentYear,
      amount: { gt: prisma.budget.fields.spent }
    },
    orderBy: { amount: 'desc' }
  });

  const fixes = [];
  
  for (const overspentBudget of overspentBudgets.slice(0, 3)) { // Fix top 3 overspent
    const overspentAmount = overspentBudget.spent - overspentBudget.amount;
    
    // Find a budget with enough available money
    const sourceBudget = availableBudgets.find(b => 
      (b.amount - b.spent) >= overspentAmount && b.id !== overspentBudget.id
    );
    
    if (sourceBudget) {
      // Move money to fix overspending
      await prisma.$transaction([
        prisma.budget.update({
          where: { id: sourceBudget.id },
          data: { amount: { decrement: overspentAmount } }
        }),
        prisma.budget.update({
          where: { id: overspentBudget.id },
          data: { amount: { increment: overspentAmount } }
        }),
        prisma.budgetTransfer.create({
          data: {
            userId,
            fromBudgetId: sourceBudget.id,
            toBudgetId: overspentBudget.id,
            amount: overspentAmount,
            reason: `AI Assistant fix: Cover overspending in ${overspentBudget.name}`,
              }
        })
      ]);

      fixes.push({
        from: sourceBudget.name,
        to: overspentBudget.name,
        amount: overspentAmount
      });
    }
  }

  const message = fixes.length > 0 
    ? `Fixed ${fixes.length} overspent categories:\n${fixes.map(f => `• $${f.amount.toFixed(2)} from ${f.from} to ${f.to}`).join('\n')}`
    : "Couldn't automatically fix overspending. You may need to manually move money between budgets.";

  return { message, fixes };
}