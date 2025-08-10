import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { FinancialCalculator } from '../../lib/financial-calculator';
import CreditCardAutomation from '../../lib/credit-card-automation';
import prisma from '../../lib/prisma';

// WebSocket trigger for real-time updates
let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    const websocketServer = require('../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch (e) {
    console.log('WebSocket server not available');
  }
}

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
    const { name, amount, category } = req.body;

    if (!name || amount === undefined || amount === null || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prevent Income budget lines from being created
    if (name.toLowerCase().includes('income') || category.toLowerCase().includes('income')) {
      return res.status(400).json({ error: 'Income should not be tracked as a budget line. Income will appear in account balances and the "To Be Assigned" card.' });
    }

    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Check if budget already exists for this name/month/year
      const existingBudget = await prisma.budget.findUnique({
        where: {
          userId_name_month_year: {
            userId: userId,
            name,
            month: currentMonth,
            year: currentYear,
          },
        },
      });

      if (existingBudget) {
        return res.status(400).json({ error: 'Budget already exists for this category this month' });
      }

      const budget = await prisma.budget.create({
        data: {
          userId: userId,
          name,
          amount: parseFloat(amount),
          category,
          month: currentMonth,
          year: currentYear,
        },
      });

      // Ensure financial calculations are correct after budget creation
      try {
        await FinancialCalculator.ensureToBeAssignedBudget(userId);
        console.log('✅ Financial sync completed after budget creation');
      } catch (error) {
        console.error('⚠️ Financial sync failed after budget creation:', error);
      }

      // Trigger WebSocket update for real-time sync
      if (triggerFinancialSync) {
        try {
          await triggerFinancialSync(userId);
          console.log('✅ WebSocket sync triggered after budget creation');
        } catch (error) {
          console.error('⚠️ WebSocket sync failed:', error);
        }
      }

      res.status(201).json(budget);
    } catch (error) {
      console.error('Error creating budget:', error);
      res.status(500).json({ error: 'Failed to create budget' });
    }
  } else if (req.method === 'GET') {
    try {
      // Allow month/year to be passed as query parameters, default to current month/year
      const { month, year } = req.query;
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

      const budgets = await prisma.budget.findMany({
        where: {
          userId: userId,
          month: targetMonth,
          year: targetYear,
        },
        include: {
          transactions: {
            where: {
              date: {
                gte: new Date(targetYear, targetMonth - 1, 1),
                lt: new Date(targetYear, targetMonth, 1),
              },
            },
          },
        },
      });

      res.json(budgets);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      res.status(500).json({ error: 'Failed to fetch budgets' });
    }
  } else if (req.method === 'PUT') {
    const { id, name, amount, category } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Budget ID is required' });
    }

    try {
      // Check if budget exists and belongs to user
      const existingBudget = await prisma.budget.findFirst({
        where: {
          id,
          userId: userId,
        },
      });

      if (!existingBudget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      // Update budget
      const updatedBudget = await prisma.budget.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(amount !== undefined && amount !== null && { amount: parseFloat(amount) }),
          ...(category && { category }),
        },
      });

      // Use financial calculator to ensure "To Be Assigned" stays correct
      if (amount !== undefined && amount !== null) {
        const amountDifference = parseFloat(amount) - existingBudget.amount;
        
        if (amountDifference !== 0) {
          console.log(`🔍 Budget update: ${existingBudget.name} from $${existingBudget.amount} to $${amount} (difference: ${amountDifference})`);
          
          // Let the financial calculator handle "To Be Assigned" recalculation
          try {
            await FinancialCalculator.ensureToBeAssignedBudget(userId);
            console.log('✅ Financial sync completed after budget update');
          } catch (error) {
            console.error('⚠️ Financial sync failed after budget update:', error);
          }
        }
        
        // Trigger credit card automation if budget amount was increased (money assigned)
        if (parseFloat(amount) > existingBudget.amount) {
          const assignedAmount = parseFloat(amount) - existingBudget.amount;
          console.log(`🔄 Triggering credit card automation for ${updatedBudget.name} - assigned $${assignedAmount}`);
          try {
            const result = await CreditCardAutomation.processBudgetAssignment(
              userId,
              updatedBudget.id,
              assignedAmount
            );
            console.log(`✅ Automation result:`, result.message);
          } catch (automationError) {
            console.error('❌ Credit card automation failed for budget assignment:', automationError);
          }
        }
      }

      // Trigger WebSocket update for real-time sync
      if (triggerFinancialSync) {
        try {
          await triggerFinancialSync(userId);
          console.log('✅ WebSocket sync triggered after budget update');
        } catch (error) {
          console.error('⚠️ WebSocket sync failed:', error);
        }
      }

      res.json(updatedBudget);
    } catch (error) {
      console.error('Error updating budget:', error);
      res.status(500).json({ error: 'Failed to update budget' });
    }
  } else if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Budget ID is required' });
    }

    try {
      // Check if budget exists and belongs to user
      const existingBudget = await prisma.budget.findFirst({
        where: {
          id,
          userId: userId,
        },
      });

      if (!existingBudget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      // Delete budget
      await prisma.budget.delete({
        where: { id },
      });

      // Ensure financial calculations are correct after budget deletion
      try {
        await FinancialCalculator.ensureToBeAssignedBudget(userId);
        console.log('✅ Financial sync completed after budget deletion');
      } catch (error) {
        console.error('⚠️ Financial sync failed after budget deletion:', error);
      }

      // Trigger WebSocket update for real-time sync
      if (triggerFinancialSync) {
        try {
          await triggerFinancialSync(userId);
          console.log('✅ WebSocket sync triggered after budget deletion');
        } catch (error) {
          console.error('⚠️ WebSocket sync failed:', error);
        }
      }

      res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
      console.error('Error deleting budget:', error);
      res.status(500).json({ error: 'Failed to delete budget' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}