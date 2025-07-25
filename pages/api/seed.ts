import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_BUDGETS = [
  // Credit Card Payments
  { name: 'Chase Sapphire Rewards', amount: 500, category: 'Credit Card Payments' },
  { name: 'Adrienne\'s Barclay Arrival', amount: 300, category: 'Credit Card Payments' },
  { name: 'Brandon\'s Barclay Arrival', amount: 250, category: 'Credit Card Payments' },
  { name: 'Amazon Store Card', amount: 150, category: 'Credit Card Payments' },
  { name: 'American Express Gold Card', amount: 800, category: 'Credit Card Payments' },
  
  // Auto Loans
  { name: '2021 Ram 1500', amount: 650, category: 'Auto Loans' },
  { name: '2023 Hyundai Palisade', amount: 720, category: 'Auto Loans' },
  
  // Monthly Bills
  { name: 'Mortgage', amount: 2800, category: 'Monthly Bills' },
  { name: 'Electric', amount: 180, category: 'Monthly Bills' },
  { name: 'Gas', amount: 120, category: 'Monthly Bills' },
  { name: 'Water', amount: 85, category: 'Monthly Bills' },
  { name: 'Internet', amount: 95, category: 'Monthly Bills' },
  { name: 'Car Insurance', amount: 220, category: 'Monthly Bills' },
  { name: 'Cellphone', amount: 150, category: 'Monthly Bills' },
  { name: 'HOA Fees', amount: 95, category: 'Monthly Bills' },
  { name: 'Subscriptions', amount: 75, category: 'Monthly Bills' },
  { name: 'HELOC Payments', amount: 1200, category: 'Monthly Bills' },
  
  // Frequent Spending
  { name: 'Groceries', amount: 800, category: 'Frequent Spending' },
  { name: 'Eating Out', amount: 400, category: 'Frequent Spending' },
  { name: 'Transportation', amount: 300, category: 'Frequent Spending' },
  { name: 'Tithing', amount: 1000, category: 'Frequent Spending' },
  
  // Non-Monthly
  { name: 'Auto Maintenance', amount: 200, category: 'Non-Monthly' },
  { name: 'Clothing', amount: 300, category: 'Non-Monthly' },
  { name: 'Gifts', amount: 200, category: 'Non-Monthly' },
  { name: 'Medical', amount: 250, category: 'Non-Monthly' },
  { name: 'Home Improvement', amount: 400, category: 'Non-Monthly' },
  { name: 'Emergency Fund', amount: 500, category: 'Non-Monthly' },
  
  // Sully & Remi
  { name: 'Childcare', amount: 800, category: 'Sully & Remi' },
  { name: 'Lunch Money', amount: 120, category: 'Sully & Remi' },
  { name: 'Extracurricular', amount: 200, category: 'Sully & Remi' },
  { name: 'Teacher Gifts', amount: 50, category: 'Sully & Remi' },
];

const SAMPLE_TRANSACTIONS = [
  // Recent transactions
  { description: 'Target', amount: -85.32, category: 'Groceries', date: new Date('2024-12-10') },
  { description: 'Starbucks', amount: -12.45, category: 'Eating Out', date: new Date('2024-12-09') },
  { description: 'Shell Gas Station', amount: -45.67, category: 'Transportation', date: new Date('2024-12-08') },
  { description: 'Walmart Groceries', amount: -127.89, category: 'Groceries', date: new Date('2024-12-07') },
  { description: 'Chase Sapphire Payment', amount: -500.00, category: 'Credit Card Payments', date: new Date('2024-12-06') },
  { description: 'Electric Bill', amount: -156.78, category: 'Electric', date: new Date('2024-12-05') },
  { description: 'Chipotle', amount: -23.45, category: 'Eating Out', date: new Date('2024-12-04') },
  { description: 'Amazon Purchase', amount: -67.89, category: 'Misc. Needs', date: new Date('2024-12-03') },
  { description: 'Costco', amount: -234.56, category: 'Groceries', date: new Date('2024-12-02') },
  { description: 'Salary Deposit', amount: 5000.00, category: 'Income', date: new Date('2024-12-01') },
];

const SAMPLE_GOALS = [
  {
    name: 'Pay Off Chase Sapphire',
    description: 'Pay off Chase Sapphire credit card debt',
    targetAmount: 0,
    currentAmount: -2500,
    type: 'debt',
    priority: 1,
    targetDate: new Date('2025-06-01'),
  },
  {
    name: 'Emergency Fund',
    description: 'Build 6 months of expenses for financial security',
    targetAmount: 25000,
    currentAmount: 8500,
    type: 'savings',
    priority: 1,
    targetDate: new Date('2025-12-31'),
  },
  {
    name: 'Pay Off Ram 1500',
    description: 'Pay off 2021 Ram 1500 truck loan',
    targetAmount: 0,
    currentAmount: -18500,
    type: 'debt',
    priority: 2,
    targetDate: new Date('2027-03-01'),
  },
];

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

  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Clear existing data for this user
    await prisma.transaction.deleteMany({ where: { userId: userId } });
    await prisma.budget.deleteMany({ where: { userId: userId } });
    await prisma.goal.deleteMany({ where: { userId: userId } });

    // Create sample budgets
    const budgets = await Promise.all(
      SAMPLE_BUDGETS.map(async (budget) => {
        // Calculate some random spending for each budget (0-80% of budget)
        const spentPercentage = Math.random() * 0.8;
        const spent = Math.round(budget.amount * spentPercentage);
        
        return await prisma.budget.create({
          data: {
            userId: userId,
            name: budget.name,
            amount: budget.amount,
            category: budget.category,
            month: currentMonth,
            year: currentYear,
            spent: spent,
          },
        });
      })
    );

    // Create sample goals
    const goals = await Promise.all(
      SAMPLE_GOALS.map(async (goal) => {
        return await prisma.goal.create({
          data: {
            userId: userId,
            name: goal.name,
            description: goal.description,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            type: goal.type,
            priority: goal.priority,
            targetDate: goal.targetDate,
          },
        });
      })
    );

    // Create or find a manual entry account for seed transactions
    let manualAccount = await prisma.account.findFirst({
      where: { 
        userId: userId, 
        accountName: 'Manual Entry (Seed Data)',
        accountType: 'manual'
      }
    });
    
    if (!manualAccount) {
      manualAccount = await prisma.account.create({
        data: {
          userId: userId,
          plaidAccountId: `manual_seed_${userId}_${Date.now()}`,
          plaidAccessToken: 'manual_seed',
          accountName: 'Manual Entry (Seed Data)',
          accountType: 'manual',
          accountSubtype: 'checking',
          balance: 0,
          availableBalance: 0
        }
      });
    }

    // Create sample transactions linked to the manual account
    const transactions = await Promise.all(
      SAMPLE_TRANSACTIONS.map(async (transaction) => {
        // Find matching budget for this transaction
        const budget = budgets.find(b => 
          b.category === transaction.category || 
          b.name.toLowerCase().includes(transaction.category.toLowerCase())
        );
        
        return await prisma.transaction.create({
          data: {
            userId: userId,
            accountId: manualAccount!.id,
            budgetId: budget?.id || null,
            amount: transaction.amount,
            description: transaction.description,
            category: transaction.category,
            date: transaction.date,
            plaidTransactionId: `seed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          },
        });
      })
    );

    res.json({ 
      success: true, 
      message: 'Dashboard populated successfully',
      data: {
        budgets: budgets.length,
        goals: goals.length,
        transactions: transactions.length,
      }
    });
  } catch (error) {
    console.error('Error seeding dashboard:', error);
    res.status(500).json({ error: 'Failed to populate dashboard' });
  }
}