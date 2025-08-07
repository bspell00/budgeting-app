import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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
    // Get a quick snapshot of current financial state
    const [accounts, budgets, transactions] = await Promise.all([
      prisma.account.findMany({ where: { userId } }),
      prisma.budget.findMany({ 
        where: { 
          userId,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        } 
      }),
      prisma.transaction.count({ where: { userId } })
    ]);

    const totalCash = accounts
      .filter(acc => acc.accountType === 'depository' || acc.accountType === 'investment')
      .reduce((sum, acc) => sum + acc.balance, 0);

    const totalBudgeted = budgets
      .filter(b => b.name !== 'To Be Assigned')
      .reduce((sum, b) => sum + b.amount, 0);

    const toBeAssignedBudget = budgets.find(b => b.name === 'To Be Assigned');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      financial_state: {
        total_cash: totalCash,
        total_budgeted: totalBudgeted,
        to_be_assigned: toBeAssignedBudget?.amount || 0,
        calculation_check: totalCash - totalBudgeted,
        accounts_count: accounts.length,
        budgets_count: budgets.length,
        transactions_count: transactions
      },
      status: 'All systems operational for local development'
    });

  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({ error: 'Test failed' });
  }
}