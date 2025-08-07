import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

/**
 * Force refresh "To Be Assigned" and budget calculations
 * Provides instant updates after financial actions
 */
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
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Get current accounts and calculate total cash
    const accounts = await prisma.account.findMany({
      where: { userId }
    });

    const cashAccounts = accounts.filter(account => 
      account.accountType === 'depository' || 
      account.accountType === 'investment' ||
      (account.accountType === 'other' && account.balance > 0)
    );
    
    const totalCashBalance = cashAccounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0);

    // Get all budgets except "To Be Assigned"
    const allBudgetsExceptTBA = await prisma.budget.findMany({
      where: {
        userId,
        month: currentMonth,
        year: currentYear,
        NOT: { name: 'To Be Assigned' }
      }
    });
    
    const totalBudgetedByUser = allBudgetsExceptTBA.reduce((sum, budget) => sum + budget.amount, 0);
    const correctToBeAssigned = totalCashBalance - totalBudgetedByUser;

    // Find or create "To Be Assigned" budget
    let toBeAssignedBudget = await prisma.budget.findFirst({
      where: {
        userId,
        name: 'To Be Assigned',
        month: currentMonth,
        year: currentYear,
      },
    });

    if (!toBeAssignedBudget) {
      toBeAssignedBudget = await prisma.budget.create({
        data: {
          userId,
          name: 'To Be Assigned',
          category: 'Income',
          amount: correctToBeAssigned,
          spent: 0,
          month: currentMonth,
          year: currentYear,
        }
      });
    } else {
      // Update existing budget
      await prisma.budget.update({
        where: { id: toBeAssignedBudget.id },
        data: { amount: correctToBeAssigned }
      });
    }

    console.log(`🔄 Real-time refresh: "To Be Assigned" = $${correctToBeAssigned.toFixed(2)}`);

    res.json({
      success: true,
      toBeAssigned: correctToBeAssigned,
      totalCash: totalCashBalance,
      totalBudgeted: totalBudgetedByUser,
      message: 'Budget calculations refreshed'
    });

  } catch (error) {
    console.error('Error refreshing budget calculations:', error);
    res.status(500).json({ error: 'Failed to refresh budget calculations' });
  }
}