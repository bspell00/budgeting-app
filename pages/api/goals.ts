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
    const { name, description, targetAmount, type, targetDate } = req.body;

    if (!name || !targetAmount || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const goal = await prisma.goal.create({
        data: {
          userId: userId,
          name,
          description: description || null,
          targetAmount: parseFloat(targetAmount),
          type,
          targetDate: targetDate ? new Date(targetDate) : null,
        },
      });

      res.status(201).json(goal);
    } catch (error) {
      console.error('Error creating goal:', error);
      res.status(500).json({ error: 'Failed to create goal' });
    }
  } else if (req.method === 'GET') {
    try {
      const goals = await prisma.goal.findMany({
        where: {
          userId: userId,
        },
        orderBy: {
          priority: 'asc',
        },
      });

      res.json(goals);
    } catch (error) {
      console.error('Error fetching goals:', error);
      res.status(500).json({ error: 'Failed to fetch goals' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}