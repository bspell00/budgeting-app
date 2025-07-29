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

  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      await prisma.aIPlan.delete({
        where: { 
          id: id as string,
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

  if (req.method === 'PUT') {
    try {
      const { title, description, steps, status } = req.body;

      const updatedPlan = await prisma.aIPlan.update({
        where: { 
          id: id as string,
          userId // Ensure user can only update their own plans
        },
        data: {
          title,
          description,
          steps: steps ? JSON.stringify(steps) : undefined,
          status,
          updatedAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        plan: updatedPlan,
        message: 'Debt plan updated successfully'
      });
    } catch (error) {
      console.error('Error updating debt plan:', error);
      return res.status(500).json({ 
        error: 'Failed to update debt plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}