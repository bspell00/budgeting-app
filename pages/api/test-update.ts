import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { FinancialCalculator } from '../../lib/financial-calculator';

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
    // Test creating a small transaction to verify updates
    const transaction = await FinancialCalculator.createTransactionWithSync({
      userId: userId,
      accountId: 'cmdvpahub000n0mv7fdfwldec', // Plaid Checking from your logs
      amount: -5.00, // $5 expense
      description: 'Test Update Transaction',
      category: 'Test Category',
      isManual: true,
      cleared: true,
      approved: true,
    });

    console.log('✅ Test transaction created with automatic sync');
    
    // Get updated metrics to verify
    const metrics = await FinancialCalculator.calculateFinancialMetrics(userId);
    
    res.json({
      success: true,
      transaction,
      metrics: {
        totalCash: metrics.accounts.totalCash,
        totalBudgeted: metrics.budgets.totalBudgeted,
        toBeAssigned: metrics.budgets.toBeAssigned
      }
    });
  } catch (error) {
    console.error('❌ Test update error:', error);
    res.status(500).json({ error: 'Test update failed' });
  }
}