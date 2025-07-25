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
    
    // Run analysis in parallel for better performance
    const [spendingPatterns, behavioralInsights] = await Promise.all([
      advisor.analyzeSpendingBehavior(),
      advisor.generateBehavioralInsights()
    ]);
    
    res.json({
      success: true,
      data: {
        spendingPatterns,
        insights: behavioralInsights,
        summary: {
          topSpendingCategories: spendingPatterns
            .slice(0, 5)
            .map(p => ({ category: p.category, amount: p.averageMonthly })),
          totalInsights: behavioralInsights.length,
          highImpactInsights: behavioralInsights.filter(i => i.impact === 'high').length,
          actionableInsights: behavioralInsights.filter(i => i.actionable).length
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating behavioral insights:', error);
    res.status(500).json({ 
      error: 'Failed to generate behavioral insights',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}