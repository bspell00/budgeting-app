import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import CreditCardAutomation from '../../../lib/credit-card-automation';

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
    const { budgetId, assignedAmount, forceTransfer = false } = req.body;

    if (!budgetId || !assignedAmount) {
      return res.status(400).json({ error: 'Budget ID and assigned amount are required' });
    }

    try {
      const result = await CreditCardAutomation.processBudgetAssignment(
        userId,
        budgetId,
        parseFloat(assignedAmount),
        { forceTransfer }
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          transfer: {
            amount: result.transferAmount,
            fromBudget: result.fromBudget,
            creditCardTransfers: result.creditCardTransfers
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error('Error processing budget assignment automation:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to process budget assignment automation',
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  } 
  else if (req.method === 'GET') {
    // Get automation settings/history
    const { transactionId } = req.query;

    if (transactionId) {
      // Get automation history for a specific transaction
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const transfers = await prisma.budgetTransfer.findMany({
          where: {
            userId: userId,
            transactionId: transactionId as string
          },
          include: {
            fromBudget: true,
            toBudget: true,
            transaction: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        res.json({ transfers });
      } catch (error) {
        console.error('Error fetching automation history:', error);
        res.status(500).json({ error: 'Failed to fetch automation history' });
      }
    } else {
      // Get all recent automation transfers
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const transfers = await prisma.budgetTransfer.findMany({
          where: {
            userId: userId,
          },
          include: {
            fromBudget: true,
            toBudget: true,
            transaction: {
              include: {
                account: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 20 // Last 20 transfers
        });

        res.json({ transfers });
      } catch (error) {
        console.error('Error fetching automation transfers:', error);
        res.status(500).json({ error: 'Failed to fetch automation transfers' });
      }
    }
  } 
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}