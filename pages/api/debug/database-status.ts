import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get basic database info
    const userCount = await prisma.user.count();
    const accountCount = await prisma.account.count();
    const budgetCount = await prisma.budget.count();
    const transactionCount = await prisma.transaction.count();
    
    // Check session
    const session = await getServerSession(req, res, authOptions);
    const sessionUserId = session?.user ? (session.user as any).id : null;
    
    // Check if session user exists in database
    let sessionUserExists = false;
    if (sessionUserId) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUserId }
      });
      sessionUserExists = !!user;
    }
    
    // Get database connection info
    const dbResult = await prisma.$queryRaw`SELECT current_database(), current_user, version()` as any[];
    const dbInfo = dbResult[0];
    
    const status = {
      database: {
        name: dbInfo.current_database,
        user: dbInfo.current_user,
        version: dbInfo.version.split(' ').slice(0, 2).join(' '),
        url: process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@') || 'Not set'
      },
      counts: {
        users: userCount,
        accounts: accountCount,
        budgets: budgetCount,
        transactions: transactionCount,
        total: userCount + accountCount + budgetCount + transactionCount
      },
      session: {
        exists: !!session,
        userId: sessionUserId,
        userEmail: session?.user?.email || null,
        sessionUserExistsInDb: sessionUserExists
      },
      issues: [] as Array<{
        type: string;
        message: string;
        solution: string;
      }>
    };
    
    // Identify potential issues
    if (session && !sessionUserExists) {
      status.issues.push({
        type: 'STALE_SESSION',
        message: 'Session references a user that no longer exists in the database',
        solution: 'Sign out and sign up again to create a new account'
      });
    }
    
    if (userCount === 0) {
      status.issues.push({
        type: 'EMPTY_DATABASE',
        message: 'Database is empty - no users exist',
        solution: 'Sign up to create your first account'
      });
    }
    
    res.json(status);
    
  } catch (error) {
    console.error('Database status check failed:', error);
    res.status(500).json({
      error: 'Database status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}