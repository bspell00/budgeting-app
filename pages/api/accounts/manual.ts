import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { PayeeService } from '../../../lib/payee-service';

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

  const { accountName, accountType, accountSubtype, balance, availableBalance, isJustWatching } = req.body;

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
        isJustWatching: isJustWatching || false,
      },
    });

    // Create payment categories for "Just Watching" accounts
    if (isJustWatching) {
      console.log(`👀 Creating payment category for Just Watching account: ${accountName}`);
      
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Determine category name based on account type
      let categoryName = '';
      let categoryGroup = 'Just Watching';
      
      if (accountType === 'loan') {
        if (accountSubtype === 'mortgage') {
          categoryName = `${accountName} Payment`;
          categoryGroup = 'Housing';
        } else {
          categoryName = `${accountName} Payment`;
          categoryGroup = 'Debt Payments';
        }
      } else if (accountType === 'investment') {
        categoryName = `${accountName} Contribution`;
        categoryGroup = 'Savings & Investments';
      } else {
        categoryName = `${accountName} Payment`;
        categoryGroup = 'Just Watching';
      }
      
      try {
        await prisma.budget.create({
          data: {
            userId: userId,
            name: categoryName,
            amount: 0, // Start with $0 for zero-based budgeting
            category: categoryGroup,
            month: currentMonth,
            year: currentYear,
            spent: 0,
          },
        });
        console.log(`✅ Created payment budget for Just Watching account: ${categoryName}`);
      } catch (error) {
        console.log(`Budget for ${categoryName} already exists`);
      }
    }
    
    // If it's a credit card and NOT just watching, auto-create payment payee and budget
    if (accountType === 'credit' && !isJustWatching) {
      console.log(`💳 Creating payment payee for credit card: ${accountName}`);
      
      // Create the "Payment: [Card Name]" payee for YNAB-style payments
      await PayeeService.getOrCreatePayee(userId, `Payment: ${accountName}`, {
        category: 'Transfer',
        isInternal: true
      });
      
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
        console.log(`✅ Created payment budget for: ${accountName}`);
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