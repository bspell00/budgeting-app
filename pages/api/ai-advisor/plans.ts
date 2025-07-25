import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
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
      // Get all active plans for the user
      const plans = await prisma.aIPlan.findMany({
        where: { 
          userId,
          status: { in: ['active', 'in_progress'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      console.error('Error fetching AI plans:', error);
      res.status(500).json({ 
        error: 'Failed to fetch plans',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else if (req.method === 'POST') {
    try {
      const { plan } = req.body;
      
      if (!plan || !plan.title || !plan.description) {
        return res.status(400).json({ error: 'Plan data is required' });
      }

      // Save the AI-generated plan
      const savedPlan = await prisma.aIPlan.create({
        data: {
          userId,
          title: plan.title,
          description: plan.description,
          category: plan.category || 'general',
          priority: plan.priority || 'medium',
          timeframe: plan.timeline || 'varies',
          estimatedImpact: plan.expectedOutcome || 'Financial improvement',
          steps: JSON.stringify(plan.steps || []),
          status: 'active',
          aiGenerated: true,
          metadata: JSON.stringify({
            confidence: plan.confidence || 0.8,
            urgencyLevel: plan.urgencyLevel || 'medium',
            generatedAt: new Date().toISOString()
          })
        }
      });

      res.json({
        success: true,
        data: savedPlan
      });
    } catch (error) {
      console.error('Error saving AI plan:', error);
      res.status(500).json({ 
        error: 'Failed to save plan',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else if (req.method === 'PUT') {
    try {
      const { planId, status, completedSteps } = req.body;
      
      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required' });
      }

      // Update plan status or progress
      const updatedPlan = await prisma.aIPlan.update({
        where: { 
          id: planId,
          userId // Ensure user owns the plan
        },
        data: {
          ...(status && { status }),
          ...(completedSteps && { 
            metadata: {
              update: {
                completedSteps
              }
            }
          }),
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        data: updatedPlan
      });
    } catch (error) {
      console.error('Error updating AI plan:', error);
      res.status(500).json({ 
        error: 'Failed to update plan',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}