import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

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
      console.log('🧹 Starting fresh data cleanup for user:', userId);
      
      // Step 1: Delete all budget transfers first (foreign key constraint)
      const transferDeleteResult = await prisma.budgetTransfer.deleteMany({
        where: { userId: userId }
      });
      console.log(`🗑️ Deleted ${transferDeleteResult.count} budget transfers`);
      
      // Step 2: Delete all transactions (this gives you a completely fresh start)
      const transactionDeleteResult = await prisma.transaction.deleteMany({
        where: { userId: userId }
      });
      console.log(`🗑️ Deleted ${transactionDeleteResult.count} transactions`);
      
      // Step 3: Delete all budgets
      const budgetDeleteResult = await prisma.budget.deleteMany({
        where: { userId: userId }
      });
      console.log(`🗑️ Deleted ${budgetDeleteResult.count} budgets`);
      
      // Step 4: Delete all goals
      const goalDeleteResult = await prisma.goal.deleteMany({
        where: { userId: userId }
      });
      console.log(`🗑️ Deleted ${goalDeleteResult.count} goals`);
      
      // Step 5: Delete all Plaid accounts (complete fresh start)
      const accountDeleteResult = await prisma.account.deleteMany({
        where: { userId: userId }
      });
      console.log(`🗑️ Deleted ${accountDeleteResult.count} Plaid accounts`);
      
      res.json({ 
        success: true, 
        message: `Complete fresh start! Deleted ${budgetDeleteResult.count} budgets, ${transactionDeleteResult.count} transactions, ${goalDeleteResult.count} goals, ${transferDeleteResult.count} transfers, and ${accountDeleteResult.count} Plaid accounts. You now have a completely clean account!`,
        deletedBudgets: budgetDeleteResult.count,
        deletedTransactions: transactionDeleteResult.count,
        deletedGoals: goalDeleteResult.count,
        deletedTransfers: transferDeleteResult.count,
        deletedAccounts: accountDeleteResult.count
      });
      
    } catch (error) {
      console.error('❌ Error cleaning up data:', error);
      res.status(500).json({ 
        error: 'Failed to clean up data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}