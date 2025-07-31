import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'POST') {
    const { name, description, targetAmount, type, targetDate, linkedBudgetId, linkedBudgetName } = req.body;

    if (!name || !targetAmount || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // Create the goal
      const goal = await prisma.goal.create({
        data: {
          userId: userId,
          name,
          description: description || null,
          targetAmount: parseFloat(targetAmount),
          type,
          targetDate: targetDate ? new Date(targetDate) : null,
        },
      });

      let correspondingBudget = null;

      if (linkedBudgetId) {
        // Link to existing budget - just verify it exists and belongs to user
        correspondingBudget = await prisma.budget.findFirst({
          where: {
            id: linkedBudgetId,
            userId: userId,
          },
        });

        if (!correspondingBudget) {
          // Clean up the goal if budget doesn't exist
          await prisma.goal.delete({ where: { id: goal.id } });
          return res.status(400).json({ error: 'Linked budget not found' });
        }

        // Store the budget linkage in the goal description as metadata
        const updatedGoal = await prisma.goal.update({
          where: { id: goal.id },
          data: {
            description: `${description || ''}${description ? '\n' : ''}[LINKED_BUDGET:${linkedBudgetId}]`
          }
        });

        console.log('✅ Created goal linked to existing budget:', { goal: updatedGoal.id, budget: correspondingBudget.id });

        res.status(201).json({ 
          goal: updatedGoal, 
          budget: correspondingBudget,
          linkedBudgetId: linkedBudgetId,
          message: `Goal "${name}" created and linked to budget "${correspondingBudget.name}"`
        });
      } else {
        // Create a new corresponding budget for this goal (legacy behavior)
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Determine the budget category based on goal type
        const budgetCategory = type === 'debt' ? 'Debt Payoff' : 'Savings Goals';
        
        correspondingBudget = await prisma.budget.create({
          data: {
            userId: userId,
            name: name, // Same name as the goal
            amount: 0, // Start with $0, user can allocate money
            category: budgetCategory,
            month: currentMonth,
            year: currentYear,
          },
        });

        console.log('✅ Created goal and corresponding budget:', { goal: goal.id, budget: correspondingBudget.id });

        res.status(201).json({ 
          goal, 
          budget: correspondingBudget,
          message: `Goal "${name}" created with corresponding budget in "${budgetCategory}" category`
        });
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      res.status(500).json({ error: 'Failed to create goal' });
    }
  } else if (req.method === 'GET') {
    try {
      const goals = await prisma.goal.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          priority: 'asc',
        },
      });

      res.json(goals);
    } catch (error) {
      console.error('Error fetching goals:', error);
      res.status(500).json({ error: 'Failed to fetch goals' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}