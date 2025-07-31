import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { getAllBudgetCategories } from '../../../lib/default-budgets';

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
    try {
      console.log('🧹 Starting cleanup of unused budgets and categories...');
      
      // Get all valid predefined categories
      const validCategories = getAllBudgetCategories();
      console.log('✅ Valid categories:', validCategories);
      
      // Add credit card payment budgets to valid list (they're auto-created)
      const creditCardPaymentBudgets = await prisma.budget.findMany({
        where: {
          userId: userId,
          category: 'Credit Card Payments'
        }
      });
      
      const creditCardPaymentNames = creditCardPaymentBudgets.map(b => b.name);
      const allValidBudgetNames = [...validCategories, ...creditCardPaymentNames];
      
      console.log('✅ All valid budget names (including credit card payments):', allValidBudgetNames);
      
      // Find budgets that don't match predefined categories
      const invalidBudgets = await prisma.budget.findMany({
        where: {
          userId: userId,
          name: {
            notIn: allValidBudgetNames
          }
        }
      });
      
      console.log(`🔍 Found ${invalidBudgets.length} invalid budgets to clean up:`, invalidBudgets.map(b => b.name));
      
      let deletedCount = 0;
      let updatedTransactions = 0;
      
      for (const budget of invalidBudgets) {
        // First, update any transactions that reference this budget to remove the budget link
        const transactionUpdateResult = await prisma.transaction.updateMany({
          where: {
            budgetId: budget.id
          },
          data: {
            budgetId: null
          }
        });
        
        updatedTransactions += transactionUpdateResult.count;
        console.log(`📝 Updated ${transactionUpdateResult.count} transactions for budget: ${budget.name}`);
        
        // Delete any budget transfers involving this budget
        await prisma.budgetTransfer.deleteMany({
          where: {
            OR: [
              { fromBudgetId: budget.id },
              { toBudgetId: budget.id }
            ]
          }
        });
        
        // Now delete the budget
        await prisma.budget.delete({
          where: { id: budget.id }
        });
        
        deletedCount++;
        console.log(`🗑️ Deleted budget: ${budget.name}`);
      }
      
      res.json({ 
        success: true, 
        message: `Cleanup completed. Deleted ${deletedCount} invalid budgets and updated ${updatedTransactions} transactions.`,
        deletedBudgets: invalidBudgets.map(b => b.name),
        deletedCount,
        updatedTransactions
      });
      
    } catch (error) {
      console.error('❌ Error cleaning up budgets:', error);
      res.status(500).json({ 
        error: 'Failed to cleanup budgets',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}