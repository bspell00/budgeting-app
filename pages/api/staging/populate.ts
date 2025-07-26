import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow this in staging environment
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL?.includes('staging')) {
    return res.status(403).json({ error: 'This endpoint is only available in staging' });
  }

  if (req.method === 'POST') {
    try {
      console.log('🚀 Populating staging database with test data...');

      // Get or create a test user
      let user = await prisma.user.findFirst({
        where: { email: 'test@staging.com' }
      });

      if (!user) {
        // Create test user with password "test123"
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('test123', 12);
        
        user = await prisma.user.create({
          data: {
            email: 'test@staging.com',
            name: 'Test User',
            password: hashedPassword
          }
        });
      }

      console.log(`✅ Using user: ${user.email}`);

      // Create sample accounts
      const accounts = [
        {
          userId: user.id,
          plaidAccountId: 'demo_checking_001',
          plaidAccessToken: 'demo_token',
          accountName: 'Primary Checking',
          accountType: 'depository',
          accountSubtype: 'checking',
          balance: 2500.00,
          availableBalance: 2500.00,
        },
        {
          userId: user.id,
          plaidAccountId: 'demo_savings_001',
          plaidAccessToken: 'demo_token',
          accountName: 'Emergency Savings',
          accountType: 'depository',
          accountSubtype: 'savings',
          balance: 15000.00,
          availableBalance: 15000.00,
        },
        {
          userId: user.id,
          plaidAccountId: 'demo_credit_001',
          plaidAccessToken: 'demo_token',
          accountName: 'Chase Sapphire Reserve',
          accountType: 'credit',
          accountSubtype: 'credit_card',
          balance: -850.50, // Negative balance = debt
          availableBalance: 4149.50, // Available credit
        },
        {
          userId: user.id,
          plaidAccountId: 'demo_credit_002',
          plaidAccessToken: 'demo_token',
          accountName: 'American Express Gold',
          accountType: 'credit',
          accountSubtype: 'credit_card',
          balance: -1240.25,
          availableBalance: 3759.75,
        }
      ];

      // Clear existing accounts and create new ones
      await prisma.account.deleteMany({ where: { userId: user.id } });
      
      const createdAccounts = [];
      for (const accountData of accounts) {
        const account = await prisma.account.create({ data: accountData });
        createdAccounts.push(account);
        console.log(`✅ Created account: ${account.accountName} (${account.accountType})`);
      }

      // Create sample budgets for current month
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const budgets = [
        // Credit Card Payment budgets
        { name: 'Chase Sapphire Reserve Payment', amount: 500, category: 'Credit Card Payments' },
        { name: 'American Express Gold Payment', amount: 300, category: 'Credit Card Payments' },
        
        // Monthly Bills
        { name: 'Rent', amount: 1800, category: 'Monthly Bills' },
        { name: 'Electric', amount: 150, category: 'Monthly Bills' },
        { name: 'Internet', amount: 80, category: 'Monthly Bills' },
        
        // Frequent Spending
        { name: 'Groceries', amount: 600, category: 'Frequent Spending' },
        { name: 'Dining Out', amount: 300, category: 'Frequent Spending' },
        { name: 'Gas', amount: 200, category: 'Frequent Spending' },
        
        // Non-Monthly
        { name: 'Clothing', amount: 200, category: 'Non-Monthly' },
        { name: 'Entertainment', amount: 150, category: 'Non-Monthly' },
      ];

      // Clear existing budgets and create new ones
      await prisma.budget.deleteMany({ where: { userId: user.id } });
      
      for (const budgetData of budgets) {
        const budget = await prisma.budget.create({
          data: {
            userId: user.id,
            name: budgetData.name,
            amount: budgetData.amount,
            spent: 0,
            category: budgetData.category,
            month,
            year
          }
        });
        console.log(`✅ Created budget: ${budget.name} - $${budget.amount}`);
      }

      // Create sample transactions to demonstrate credit card payments
      const checkingAccount = createdAccounts.find(a => a.accountName === 'Primary Checking');
      const chaseCard = createdAccounts.find(a => a.accountName === 'Chase Sapphire Reserve');
      const amexCard = createdAccounts.find(a => a.accountName === 'American Express Gold');

      // Get budgets for transaction assignment
      const groceriesBudget = await prisma.budget.findFirst({
        where: { userId: user.id, name: 'Groceries', month, year }
      });
      const diningBudget = await prisma.budget.findFirst({
        where: { userId: user.id, name: 'Dining Out', month, year }
      });
      const chaseBudget = await prisma.budget.findFirst({
        where: { userId: user.id, name: 'Chase Sapphire Reserve Payment', month, year }
      });

      const transactions = [
        // Credit card spending
        {
          userId: user.id,
          accountId: chaseCard!.id,
          budgetId: groceriesBudget?.id,
          plaidTransactionId: 'demo_txn_001',
          amount: -85.43,
          description: 'Whole Foods Market',
          category: 'Groceries',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          cleared: true,
          isManual: false,
          approved: true,
        },
        {
          userId: user.id,
          accountId: amexCard!.id,
          budgetId: diningBudget?.id,
          plaidTransactionId: 'demo_txn_002',
          amount: -45.67,
          description: 'The Cheesecake Factory',
          category: 'Dining Out',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          cleared: true,
          isManual: false,
          approved: true,
        },
        
        // Sample credit card payment (showing the new format)
        {
          userId: user.id,
          accountId: checkingAccount!.id,
          budgetId: chaseBudget?.id,
          plaidTransactionId: 'demo_payment_out_001',
          amount: -200.00, // Negative for cash account (outflow)
          description: 'Payment To: Chase Sapphire Reserve',
          category: 'Credit Card Payments: Chase Sapphire Reserve',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          cleared: true,
          isManual: true,
          approved: true,
        },
        {
          userId: user.id,
          accountId: chaseCard!.id,
          budgetId: null,
          plaidTransactionId: 'demo_payment_in_001',
          amount: 200.00, // Positive for credit card (reduces debt)
          description: 'Payment From: Primary Checking',
          category: 'Credit Card Payment',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          cleared: true,
          isManual: true,
          approved: true,
        },

        // Checking account activities
        {
          userId: user.id,
          accountId: checkingAccount!.id,
          budgetId: null,
          plaidTransactionId: 'demo_txn_005',
          amount: 3200.00,
          description: 'Direct Deposit - Payroll',
          category: 'Income',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          cleared: true,
          isManual: false,
          approved: true,
        }
      ];

      // Clear existing transactions and create new ones
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      
      for (const txnData of transactions) {
        const transaction = await prisma.transaction.create({ data: txnData });
        console.log(`✅ Created transaction: ${transaction.description} - $${transaction.amount}`);
      }

      // Update budget spent amounts based on transactions
      if (groceriesBudget) {
        await prisma.budget.update({
          where: { id: groceriesBudget.id },
          data: { spent: 85.43 }
        });
      }
      if (diningBudget) {
        await prisma.budget.update({
          where: { id: diningBudget.id },
          data: { spent: 45.67 }
        });
      }
      if (chaseBudget) {
        await prisma.budget.update({
          where: { id: chaseBudget.id },
          data: { spent: 200.00 }
        });
      }

      res.json({
        success: true,
        message: 'Staging database populated successfully!',
        summary: {
          accounts: createdAccounts.length,
          budgets: budgets.length,
          transactions: transactions.length,
          testUser: user.email
        }
      });

    } catch (error) {
      console.error('❌ Error populating staging database:', error);
      res.status(500).json({ 
        error: 'Failed to populate staging database',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}