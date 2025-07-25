import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { AIFinancialAdvisor } from '../../../lib/ai-financial-advisor';

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
    const advisor = new AIFinancialAdvisor(userId);
    const debtAnalysis = await advisor.generateDebtPayoffPlan();
    
    res.json({
      success: true,
      data: {
        plans: debtAnalysis,
        summary: {
          totalDebt: debtAnalysis.reduce((sum, plan) => sum + plan.currentBalance, 0),
          totalInterestSavings: debtAnalysis.reduce((sum, plan) => sum + plan.interestSaved, 0),
          totalMonthsSaved: Math.max(...debtAnalysis.map(plan => plan.monthsSaved)),
          recommendedStrategy: 'debt_avalanche'
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating debt analysis:', error);
    res.status(500).json({ 
      error: 'Failed to generate debt analysis',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}