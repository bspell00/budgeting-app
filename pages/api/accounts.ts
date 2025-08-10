import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  console.log('🔍 Session check:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userEmail: session?.user?.email,
    userId: (session?.user as any)?.id
  });
  
  if (!session?.user) {
    console.log('❌ No session or user found');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    console.log('❌ No user ID in session');
    return res.status(401).json({ error: 'No user ID found' });
  }
  
  console.log('✅ Using userId:', userId);

  if (req.method === 'GET') {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          userId: userId,
        },
        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log('📊 Found', accounts.length, 'accounts for user', userId);
      
      const accountsWithStats = accounts.map(account => ({
        id: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        accountSubtype: account.accountSubtype,
        balance: account.balance,
        availableBalance: account.availableBalance,
        isJustWatching: account.isJustWatching,
        transactionCount: account._count.transactions,
        lastUpdated: account.updatedAt,
      }));

      console.log('💰 Returning accounts:', accountsWithStats);
      res.json(accountsWithStats);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  } else if (req.method === 'DELETE') {
    const { id, skipBalanceCheck } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
      // First, verify the account belongs to the current user
      const account = await prisma.account.findFirst({
        where: {
          id: id,
          userId: userId,
        },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // YNAB-style account closure: Enforce zero balance requirement (unless skipping check)
      if (skipBalanceCheck !== 'true') {
        const currentBalance = Math.abs(account.balance || 0);
        
        if (currentBalance > 0.01) { // Allow for small rounding differences
          return res.status(400).json({ 
            error: 'Account must have $0 balance before closing',
            currentBalance: account.balance,
            requiresReconciliation: true,
            message: 'Please reconcile this account to $0 before closing. This ensures proper debt tracking and budget integrity.'
          });
        }
      }

      // Check for uncleared transactions
      const unclearedTransactions = await prisma.transaction.findMany({
        where: { 
          accountId: id,
          cleared: false
        },
        select: {
          id: true,
          amount: true,
          description: true,
          date: true
        }
      });

      if (unclearedTransactions.length > 0) {
        return res.status(400).json({
          error: 'Account has uncleared transactions',
          unclearedTransactions: unclearedTransactions,
          requiresReconciliation: true,
          message: 'Please clear all transactions before closing the account.'
        });
      }

      // Check if there are any transactions associated with this account
      const transactionCount = await prisma.transaction.count({
        where: { accountId: id }
      });

      if (transactionCount > 0) {
        // YNAB approach: Mark as closed but preserve all data
        const updatedAccount = await prisma.account.update({
          where: { id: id },
          data: {
            accountName: `${account.accountName} (Closed)`,
            // Add a closed flag if you have it in schema, or use a special access token
            plaidAccessToken: account.plaidAccessToken === 'manual' ? 'manual_closed' : 'closed',
          }
        });
        
        // If it's a credit card with a payment budget, suggest converting to closed debt category
        if (account.accountType === 'credit') {
          const paymentBudget = await prisma.budget.findFirst({
            where: {
              userId: userId,
              category: 'Credit Card Payments',
              name: { contains: account.accountName }
            }
          });

          if (paymentBudget) {
            // Update the budget category to closed debt
            await prisma.budget.update({
              where: { id: paymentBudget.id },
              data: {
                category: 'Closed Card Debt',
                name: `${account.accountName} - Closed Debt`
              }
            });
          }
        }
        
        res.json({ 
          success: true, 
          message: `Account closed successfully. ${transactionCount} transactions preserved for historical tracking.`,
          account: updatedAccount 
        });
      } else {
        // If no transactions, safe to completely delete
        await prisma.account.delete({
          where: { id: id }
        });
        
        res.json({ 
          success: true, 
          message: 'Account removed successfully.' 
        });
      }
    } catch (error) {
      console.error('Error removing account:', error);
      res.status(500).json({ error: 'Failed to remove account' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}