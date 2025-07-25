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
    const healthScore = await advisor.calculateFinancialHealthScore();
    
    // Determine overall health level
    let healthLevel: 'excellent' | 'good' | 'fair' | 'poor';
    if (healthScore.overall >= 80) healthLevel = 'excellent';
    else if (healthScore.overall >= 65) healthLevel = 'good';
    else if (healthScore.overall >= 50) healthLevel = 'fair';
    else healthLevel = 'poor';
    
    res.json({
      success: true,
      data: {
        ...healthScore,
        healthLevel,
        breakdown: {
          debtUtilization: {
            score: healthScore.debtUtilization,
            weight: 30,
            description: 'How much of your available credit you\'re using'
          },
          emergencyFund: {
            score: healthScore.emergencyFundRatio,
            weight: 25,
            description: 'Months of expenses covered by emergency savings'
          },
          savingsRate: {
            score: healthScore.savingsRate,
            weight: 20,
            description: 'Percentage of income saved each month'
          },
          budgetConsistency: {
            score: healthScore.budgetConsistency,
            weight: 15,
            description: 'How well you stick to your budget'
          },
          paymentHistory: {
            score: healthScore.paymentHistory,
            weight: 10,
            description: 'Track record of on-time payments'
          }
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating financial health:', error);
    res.status(500).json({ 
      error: 'Failed to calculate financial health',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}