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
    console.log('[move] WebSocket server not available');
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

  const { transactionIds, targetAccountId } = req.body;

  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return res.status(400).json({ error: 'Transaction IDs are required' });
  }

  if (!targetAccountId) {
    return res.status(400).json({ error: 'Target account ID is required' });
  }

  try {
    // Verify target account exists and belongs to user
    const targetAccount = await prisma.account.findFirst({
      where: {
        id: targetAccountId,
        userId: userId,
      },
    });

    if (!targetAccount) {
      return res.status(404).json({ error: 'Target account not found' });
    }

    // Verify all transactions exist and belong to user, and get their current account info
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId: userId,
      },
      include: {
        account: true,
      },
    });

    if (transactions.length !== transactionIds.length) {
      return res.status(404).json({ error: 'Some transactions not found' });
    }

    // Calculate balance adjustments by source account
    const accountAdjustments = new Map<string, number>();
    
    transactions.forEach(transaction => {
      const sourceAccountId = transaction.accountId;
      const amount = transaction.amount;
      
      // Remove from source account (subtract the transaction amount)
      if (!accountAdjustments.has(sourceAccountId)) {
        accountAdjustments.set(sourceAccountId, 0);
      }
      accountAdjustments.set(sourceAccountId, accountAdjustments.get(sourceAccountId)! - amount);
      
      // Add to target account (add the transaction amount)
      if (!accountAdjustments.has(targetAccountId)) {
        accountAdjustments.set(targetAccountId, 0);
      }
      accountAdjustments.set(targetAccountId, accountAdjustments.get(targetAccountId)! + amount);
    });

    // Start a transaction for atomic updates
    const result = await prisma.$transaction(async (prisma) => {
      // Update all transactions to new account
      await prisma.transaction.updateMany({
        where: {
          id: { in: transactionIds },
          userId: userId,
        },
        data: {
          accountId: targetAccountId,
        },
      });

      // Update account balances
      const updatedAccounts = [];
      for (const [accountId, adjustment] of Array.from(accountAdjustments.entries())) {
        const updatedAccount = await prisma.account.update({
          where: { id: accountId },
          data: {
            balance: {
              increment: adjustment,
            },
            // Also update available balance if it exists
            availableBalance: {
              increment: adjustment,
            },
          },
        });
        updatedAccounts.push(updatedAccount);
      }

      // Recalculate budget spending amounts for budgets that had transactions moved
      // This is critical for maintaining accurate budget math
      const affectedBudgetIds = new Set<string>();
      transactions.forEach(transaction => {
        if (transaction.budgetId) {
          affectedBudgetIds.add(transaction.budgetId);
        }
      });

      // Update spent amounts for all affected budgets
      for (const budgetId of Array.from(affectedBudgetIds)) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        // Recalculate spent amount from all transactions for this budget in current month
        const budgetTransactions = await prisma.transaction.findMany({
          where: {
            budgetId: budgetId,
            userId: userId,
            date: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1),
            },
          },
        });

        const totalSpent = budgetTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        await prisma.budget.update({
          where: { id: budgetId },
          data: { spent: totalSpent },
        });
      }

      // Fetch updated transactions with account info
      const movedTransactions = await prisma.transaction.findMany({
        where: {
          id: { in: transactionIds },
        },
        include: {
          account: true,
          budget: true,
        },
      });

      return { movedTransactions, updatedAccounts };
    });

    // Prepare balance change summary for logging
    const balanceChanges = Array.from(accountAdjustments.entries()).map(([accountId, change]) => {
      const account = accountId === targetAccountId ? targetAccount : transactions.find(t => t.accountId === accountId)?.account;
      return `${account?.accountName || 'Unknown'}: ${change >= 0 ? '+' : ''}${change}`;
    });

    // Trigger WebSocket update for real-time UI sync
    if (triggerFinancialSync) {
      try {
        await triggerFinancialSync(userId);
        console.log('[move] ✅ WebSocket sync triggered for user', userId);
      } catch (error) {
        console.log('[move] ⚠️ WebSocket sync failed:', error instanceof Error ? error.message : error);
      }
    }
        // after updating transaction(s)
    if (triggerFinancialSync) {
      await triggerFinancialSync(userId);
    }
    res.json({
      success: true,
      message: `Moved ${transactions.length} transaction(s) to ${targetAccount.accountName}`,
      transactions: result.movedTransactions,
      updatedAccounts: result.updatedAccounts,
      balanceChanges,
      targetAccount: targetAccount,
    });
  } catch (error) {
    console.error('Error moving transactions:', error);
    res.status(500).json({ error: 'Failed to move transactions' });
  }
}