import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// WebSocket integration for real-time updates
let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    const websocketServer = require('../../../lib/websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch (error) {
    console.log('[approve] WebSocket server not available');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transactionIds, approved = true } = req.body;

  if (!transactionIds || (!Array.isArray(transactionIds) && typeof transactionIds !== 'string')) {
    return res.status(400).json({ error: 'Transaction ID(s) are required' });
  }

  const ids = Array.isArray(transactionIds) ? transactionIds : [transactionIds];

  try {
    // Verify all transactions exist and belong to user
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: ids },
        userId: userId,
      },
    });

    if (transactions.length !== ids.length) {
      return res.status(404).json({ error: 'Some transactions not found' });
    }

    // Update transaction approval status
    const updatedTransactions = await prisma.transaction.updateMany({
      where: {
        id: { in: ids },
        userId: userId,
      },
      data: {
        approved: approved,
      },
    });

    // Fetch updated transactions with account and budget info
    const approvedTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        account: true,
        budget: true,
      },
    });

    const action = approved ? 'approved' : 'unapproved';
    const message = ids.length === 1 
      ? `Transaction ${action}`
      : `${updatedTransactions.count} transaction(s) ${action}`;

    // Trigger WebSocket update for real-time UI sync
    if (triggerFinancialSync) {
      try {
        await triggerFinancialSync(userId);
        console.log('[approve] ✅ WebSocket sync triggered for user', userId);
      } catch (error) {
        console.log('[approve] ⚠️ WebSocket sync failed:', error instanceof Error ? error.message : error);
      }
    }

    res.json({
      success: true,
      message,
      transactions: approvedTransactions,
    });
  } catch (error) {
    console.error('Error approving transactions:', error);
    res.status(500).json({ error: 'Failed to approve transactions' });
  }
}