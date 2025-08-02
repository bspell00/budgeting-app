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

  if (req.method === 'POST') {
    try {
      const {
        title,
        description,
        category,
        priority,
        timeframe,
        estimatedImpact,
        steps,
        metadata
      } = req.body;

      // If this is a debt plan, deactivate any existing active debt plans
      if (category === 'debt') {
        await prisma.aIPlan.updateMany({
          where: {
            userId,
            category: 'debt',
            status: 'active'
          },
          data: {
            status: 'paused'
          }
        });
      }

      const newPlan = await prisma.aIPlan.create({
        data: {
          userId,
          title,
          description,
          goals: description || 'Financial improvement',
          category,
          priority,
          timeframe,
          estimatedImpact,
          steps,
          metadata,
          aiGenerated: true,
          status: 'active'
        }
      });

      return res.status(201).json({
        success: true,
        plan: newPlan
      });
    } catch (error) {
      console.error('Error creating AI plan:', error);
      return res.status(500).json({ 
        error: 'Failed to create plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const plans = await prisma.aIPlan.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json({ plans });
    } catch (error) {
      console.error('Error fetching AI plans:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch plans',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, status, ...updateData } = req.body;

      const updatedPlan = await prisma.aIPlan.update({
        where: { 
          id,
          userId // Ensure user can only update their own plans
        },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        plan: updatedPlan
      });
    } catch (error) {
      console.error('Error updating AI plan:', error);
      return res.status(500).json({ 
        error: 'Failed to update plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      await prisma.aIPlan.delete({
        where: { 
          id,
          userId // Ensure user can only delete their own plans
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Plan deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting AI plan:', error);
      return res.status(500).json({ 
        error: 'Failed to delete plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}