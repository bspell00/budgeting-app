import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { AIFinancialAdvisor } from '../../../lib/ai-financial-advisor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'GET') {
    try {
      const advisor = new AIFinancialAdvisor(userId);
      const recommendations = await advisor.generateRecommendations();
      
      res.json({
        success: true,
        data: {
          recommendations,
          summary: {
            total: recommendations.length,
            critical: recommendations.filter(r => r.priority === 'critical').length,
            high: recommendations.filter(r => r.priority === 'high').length,
            actionableToday: recommendations.filter(r => 
              r.timeToImplement.toLowerCase().includes('immediate') || 
              r.difficultyLevel === 'easy'
            ).length
          },
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({ 
        error: 'Failed to generate recommendations',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else if (req.method === 'POST') {
    // Mark recommendation as completed
    try {
      const { recommendationId } = req.body;
      
      if (!recommendationId) {
        return res.status(400).json({ error: 'Recommendation ID is required' });
      }

      // In a real implementation, you'd store completion status in the database
      // For now, we'll just acknowledge the completion
      
      res.json({
        success: true,
        message: 'Recommendation marked as completed',
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking recommendation as completed:', error);
      res.status(500).json({ 
        error: 'Failed to complete recommendation',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}