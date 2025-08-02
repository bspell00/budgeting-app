import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';

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

  if (req.method === 'GET') {
    try {
      // Get the active debt plan (only one can be active at a time)
      const activePlan = await prisma.aIPlan.findFirst({
        where: { 
          userId,
          category: 'debt',
          status: 'active'
        },
        orderBy: { createdAt: 'desc' }
      });

      let processedPlan = null;
      if (activePlan) {
        // Parse the steps and metadata
        const steps = activePlan.steps ? JSON.parse(activePlan.steps) : [];
        const metadata = activePlan.metadata ? JSON.parse(activePlan.metadata) : {};
        
        processedPlan = {
          id: activePlan.id,
          title: activePlan.title,
          description: activePlan.description,
          strategy: metadata.strategy || 'ai_custom',
          steps: steps,
          totalDebt: metadata.totalDebt || 0,
          monthlyPayment: metadata.monthlyPayment || 0,
          estimatedMonths: parseInt(activePlan.timeframe || '12') || 12,
          progress: metadata.progress || 0,
          status: activePlan.status,
          createdAt: activePlan.createdAt.toISOString(),
          payments: metadata.payments || []
        };
      }

      return res.status(200).json({ 
        activePlan: processedPlan 
      });
    } catch (error) {
      console.error('Error fetching debt plans:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch debt plans',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { planId } = req.query;

      await prisma.aIPlan.delete({
        where: { 
          id: planId as string,
          userId // Ensure user can only delete their own plans
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Debt plan deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting debt plan:', error);
      return res.status(500).json({ 
        error: 'Failed to delete debt plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}