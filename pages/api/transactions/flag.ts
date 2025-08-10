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
    console.log('[flag] WebSocket server not available');
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

  const { transactionIds, flagColor, single = false } = req.body;

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

    // Update transaction flags
    const updatedTransactions = await prisma.transaction.updateMany({
      where: {
        id: { in: ids },
        userId: userId,
      },
      data: {
        flagColor: flagColor || null,
      },
    });

    // Fetch updated transactions
    const flaggedTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        account: true,
        budget: true,
      },
    });

    const action = flagColor ? 'flagged' : 'unflagged';
    const message = single 
      ? `Transaction ${action}${flagColor ? ` with color ${flagColor}` : ''}`
      : `${updatedTransactions.count} transaction(s) ${action}${flagColor ? ` with color ${flagColor}` : ''}`;

    // Trigger WebSocket update for real-time UI sync
    if (triggerFinancialSync) {
      try {
        await triggerFinancialSync(userId);
        console.log('[flag] ✅ WebSocket sync triggered for user', userId);
      } catch (error) {
        console.log('[flag] ⚠️ WebSocket sync failed:', error instanceof Error ? error.message : error);
      }
    }

    res.json({
      success: true,
      message,
      transactions: flaggedTransactions,
    });
  } catch (error) {
    console.error('Error flagging transactions:', error);
    res.status(500).json({ error: 'Failed to flag transactions' });
  }
}