import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  const { accountName, accountType, accountSubtype, balance, availableBalance } = req.body;

  // Validate required fields
  if (!accountName || !accountType || !accountSubtype || balance === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create a manual account with a unique plaidAccountId
    const manualAccountId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const account = await prisma.account.create({
      data: {
        userId: userId,
        plaidAccountId: manualAccountId,
        plaidAccessToken: 'manual', // Special token for manual accounts
        accountName: accountName,
        accountType: accountType,
        accountSubtype: accountSubtype || '',
        balance: parseFloat(balance),
        availableBalance: availableBalance ? parseFloat(availableBalance) : null,
      },
    });

    // If it's a credit card, auto-create a payment budget
    if (accountType === 'credit') {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const currentBalance = Math.abs(parseFloat(balance));
      
      // Calculate suggested monthly payment (minimum 2% of balance or $25, whichever is higher)
      const suggestedPayment = Math.max(Math.round(currentBalance * 0.02), 25);
      
      try {
        await prisma.budget.create({
          data: {
            userId: userId,
            name: `${accountName} Payment`,
            amount: 0, // Start with $0 for zero-based budgeting
            category: 'Credit Card Payments',
            month: currentMonth,
            year: currentYear,
            spent: 0,
          },
        });
      } catch (error) {
        // Budget might already exist, ignore duplicate error
        console.log(`Budget for ${accountName} already exists`);
      }
      
      // Create debt payoff goal if there's a balance
      if (currentBalance > 0) {
        try {
          const monthsToPayoff = Math.ceil(currentBalance / suggestedPayment);
          const targetDate = new Date();
          targetDate.setMonth(targetDate.getMonth() + monthsToPayoff);
          
          await prisma.goal.create({
            data: {
              userId: userId,
              name: `Pay Off ${accountName}`,
              description: `Pay off credit card debt. Current balance: $${currentBalance.toFixed(2)}`,
              targetAmount: 0, // Goal is to reach $0 debt
              currentAmount: -currentBalance, // Negative because it's debt
              type: 'debt',
              targetDate: targetDate,
              priority: 1,
            },
          });
        } catch (error) {
          console.log(`Goal for ${accountName} already exists`);
        }
      }
    }

    res.json({ 
      success: true, 
      account: {
        id: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        accountSubtype: account.accountSubtype,
        balance: account.balance,
        availableBalance: account.availableBalance
      }
    });
  } catch (error) {
    console.error('Error creating manual account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
}