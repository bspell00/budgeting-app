import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import CreditCardAutomation from '../../../lib/credit-card-automation';

const prisma = new PrismaClient();

// WebSocket integration for real-time updates
let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch (error) {
    console.log('[update-category] WebSocket server not available');
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

  if (req.method === 'PUT') {
    const { transactionId, category } = req.body;

    if (!transactionId || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // Get the current transaction to check ownership and get old budget info
      const currentTransaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { budget: true }
      });

      if (!currentTransaction || currentTransaction.userId !== userId) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Remove amount from old budget if it exists and is an expense
      if (currentTransaction.budget && currentTransaction.amount < 0) {
        await prisma.budget.update({
          where: { id: currentTransaction.budget.id },
          data: {
            spent: {
              decrement: Math.abs(currentTransaction.amount)
            }
          }
        });
      }

      // Find matching budget for new category
      const transactionDate = new Date(currentTransaction.date);
      const month = transactionDate.getMonth() + 1;
      const year = transactionDate.getFullYear();

      let newBudget = await prisma.budget.findFirst({
        where: {
          userId: userId,
          name: category,
          month: month,
          year: year,
        }
      });

      // Auto-create budget if it doesn't exist for the category
      if (!newBudget) {
        newBudget = await CreditCardAutomation.getOrCreateBudget(
          userId,
          category,
          month,
          year,
          100 // Default $100 budget
        );
      }

      // Add amount to new budget if it exists and is an expense
      if (newBudget && currentTransaction.amount < 0) {
        await prisma.budget.update({
          where: { id: newBudget.id },
          data: {
            spent: {
              increment: Math.abs(currentTransaction.amount)
            }
          }
        });
      }

      // Update the transaction with new category and budget
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId, userId },
        data: { 
          category: category,
          budgetId: newBudget?.id || null
        },
      });

      // Trigger WebSocket update for real-time UI sync
      if (triggerFinancialSync) {
        try {
          await triggerFinancialSync(userId);
          console.log('[update-category] ✅ WebSocket sync triggered for user', userId);
        } catch (error) {
          console.log('[update-category] ⚠️ WebSocket sync failed:', error instanceof Error ? error.message : error);
        }
      }

      res.json({ success: true, transaction: updatedTransaction });
    } catch (error) {
      console.error('Error updating transaction category:', error);
      res.status(500).json({ error: 'Failed to update transaction category' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}