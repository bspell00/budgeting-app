import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
// import { createDefaultBudgets } from '../../../lib/default-budgets';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 Populate defaults API called');
  
  const session = await getServerSession(req, res, authOptions);
  console.log('🔍 Session:', session ? 'exists' : 'null');
  
  if (!session?.user) {
    console.log('❌ No session or user found');
    return res.status(401).json({ error: 'Unauthorized - please log in first' });
  }

  const userId = (session.user as any).id;
  console.log('🔍 User ID:', userId);
  
  if (!userId) {
    console.log('❌ No user ID in session');
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'POST') {
    try {
      const { month, year, overwrite = false } = req.body;
      
      const targetMonth = month || new Date().getMonth() + 1;
      const targetYear = year || new Date().getFullYear();
      
      // Check if user already has budgets for this month/year
      const existingBudgets = await prisma.budget.findMany({
        where: {
          userId: userId,
          month: targetMonth,
          year: targetYear
        }
      });
      
      if (existingBudgets.length > 0 && !overwrite) {
        return res.status(400).json({ 
          error: 'Budgets already exist for this month. Use overwrite=true to replace them.',
          existingCount: existingBudgets.length
        });
      }
      
      // If overwriting, delete ALL existing budgets for this month/year
      if (overwrite) {
        const deletedBudgets = await prisma.budget.deleteMany({
          where: {
            userId: userId,
            month: targetMonth,
            year: targetYear
          }
        });
        console.log(`🗑️  Deleted ${deletedBudgets.count} existing budgets for ${targetMonth}/${targetYear}`);
      }
      
      // Create default budgets inline
      console.log(`🚀 Creating default budgets for ${targetMonth}/${targetYear}`);
      
      const DEFAULT_BUDGET_CATEGORIES = [
        // Credit Card Payments (always needed for automation)
        { 
          categoryGroup: 'Credit Card Payments', 
          categories: [] // Will be populated when credit cards are connected
        },
        // Auto Loans
        { 
          categoryGroup: 'Auto Loans', 
          categories: [] // Will be populated when auto loans are added
        },
        // Monthly Bills
        { 
          categoryGroup: 'Monthly Bills', 
          categories: ['Mortgage/Rent', 'Electric', 'Gas', 'Water', 'Internet', 'Car Insurance', 'Cellphone', 'HOA Fees', 'Subscriptions'] 
        },
        // Frequent Spending
        { 
          categoryGroup: 'Frequent Spending', 
          categories: ['Groceries', 'Eating Out', 'Transportation', 'Gas & Fuel'] 
        },
        // Non-Monthly
        { 
          categoryGroup: 'Non-Monthly', 
          categories: ['Auto Maintenance', 'Clothing', 'Gifts', 'Medical', 'Home Improvement', 'Emergency Fund'] 
        },
        // Just for Fun
        { 
          categoryGroup: 'Just for Fun', 
          categories: ['Fun Money', 'Entertainment', 'Hobbies'] 
        }
      ];

      const budgetsToCreate = [];
      for (const group of DEFAULT_BUDGET_CATEGORIES) {
        for (const categoryName of group.categories) {
          budgetsToCreate.push({
            userId: userId,
            name: categoryName,
            category: group.categoryGroup,
            amount: 0,
            spent: 0,
            month: targetMonth,
            year: targetYear,
          });
        }
      }
      
      // Create all budgets at once (no duplicates since we deleted first)
      let createdCount = 0;
      if (overwrite) {
        await prisma.budget.createMany({
          data: budgetsToCreate
        });
        createdCount = budgetsToCreate.length;
      } else {
        // Create budgets one by one to handle potential duplicates
        for (const budgetData of budgetsToCreate) {
          try {
            await prisma.budget.create({
              data: budgetData
            });
            createdCount++;
          } catch (error) {
            // Skip if budget already exists (duplicate error)
            console.log(`⚠️  Budget ${budgetData.name} already exists, skipping`);
          }
        }
      }
      console.log(`✅ Successfully created ${createdCount} budgets`);
      
      res.json({ 
        success: true, 
        message: `Created ${createdCount} default budget categories for ${targetMonth}/${targetYear}`,
        createdCount: createdCount,
        month: targetMonth,
        year: targetYear
      });
      
    } catch (error) {
      console.error('❌ Error populating default budgets:', error);
      res.status(500).json({ 
        error: 'Failed to populate default budgets',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}