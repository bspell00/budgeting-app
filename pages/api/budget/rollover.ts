import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { FinancialCalculator } from '../../../lib/financial-calculator';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'POST') {
    const { fromMonth, fromYear, toMonth, toYear } = req.body;

    if (!fromMonth || !fromYear || !toMonth || !toYear) {
      return res.status(400).json({ error: 'Missing required date parameters' });
    }

    try {
      console.log(`🔄 Starting rollover from ${fromMonth}/${fromYear} to ${toMonth}/${toYear}`);

      // Check if rollover already happened
      const existingRollover = await prisma.budget.findFirst({
        where: {
          userId: userId,
          month: toMonth,
          year: toYear,
          name: { not: 'To Be Assigned' }
        }
      });

      if (existingRollover) {
        console.log(`⚠️ Rollover already exists for ${toMonth}/${toYear} - skipping`);
        return res.json({ 
          success: true, 
          message: `Rollover already completed for ${toMonth}/${toYear}`,
          alreadyExists: true 
        });
      }

      // Get all budgets from the previous month
      const previousMonthBudgets = await prisma.budget.findMany({
        where: {
          userId: userId,
          month: fromMonth,
          year: fromYear,
          name: { not: 'To Be Assigned' } // Don't rollover "To Be Assigned"
        }
      });

      console.log(`📊 Found ${previousMonthBudgets.length} budgets to process for rollover`);

      let carriedForward = 0;
      let overspendingDeduction = 0;
      let creditCardOverspendingReset = 0;
      const newBudgets = [];

      // Process each budget for rollover
      for (const budget of previousMonthBudgets) {
        const available = budget.amount - budget.spent;
        
        if (available > 0) {
          // Positive available - carry forward
          const newBudget = await prisma.budget.create({
            data: {
              userId: userId,
              name: budget.name,
              category: budget.category,
              amount: available, // Start new month with previous available amount
              spent: 0,
              month: toMonth,
              year: toYear,
            }
          });
          
          newBudgets.push(newBudget);
          carriedForward += available;
          console.log(`✅ Carried forward ${budget.name}: $${available.toFixed(2)}`);
          
        } else if (available < 0) {
          // Overspending - handle differently for cash vs credit
          const overspentAmount = Math.abs(available);
          
          // Check if this category has credit card transactions
          const creditCardTransactions = await prisma.transaction.findMany({
            where: {
              userId: userId,
              category: budget.name,
              account: { accountType: 'credit' },
              date: {
                gte: new Date(fromYear, fromMonth - 1, 1),
                lt: new Date(fromYear, fromMonth, 1),
              }
            }
          });
          
          if (creditCardTransactions.length > 0) {
            // Credit card overspending - reset to $0 (fresh start)
            creditCardOverspendingReset += overspentAmount;
            console.log(`🔄 Credit card overspending reset: ${budget.name} -$${overspentAmount.toFixed(2)}`);
          } else {
            // Cash overspending - deduct from "To Be Assigned"
            overspendingDeduction += overspentAmount;
            console.log(`⚠️ Cash overspending: ${budget.name} -$${overspentAmount.toFixed(2)} (will deduct from To Be Assigned)`);
          }
        }
        // If available === 0, don't create new budget (clean slate)
      }

      // Ensure "To Be Assigned" budget exists and apply overspending deduction
      await FinancialCalculator.ensureToBeAssignedBudget(userId, toMonth, toYear);
      
      if (overspendingDeduction > 0) {
        // Find "To Be Assigned" budget and reduce it by overspending amount
        const toBeAssignedBudget = await prisma.budget.findFirst({
          where: {
            userId: userId,
            name: 'To Be Assigned',
            month: toMonth,
            year: toYear,
          }
        });
        
        if (toBeAssignedBudget) {
          await prisma.budget.update({
            where: { id: toBeAssignedBudget.id },
            data: { 
              amount: Math.max(0, toBeAssignedBudget.amount - overspendingDeduction) 
            }
          });
          console.log(`💰 Reduced "To Be Assigned" by $${overspendingDeduction.toFixed(2)} for cash overspending`);
        }
      }

      const summary = {
        success: true,
        message: `Rollover completed: ${newBudgets.length} budgets carried forward`,
        details: {
          processedBudgets: previousMonthBudgets.length,
          carriedForwardBudgets: newBudgets.length,
          totalCarriedForward: carriedForward,
          cashOverspendingDeduction: overspendingDeduction,
          creditCardOverspendingReset: creditCardOverspendingReset,
        }
      };

      console.log(`✅ Rollover completed:`, summary.details);
      res.json(summary);

    } catch (error) {
      console.error('❌ Error processing rollover:', error);
      res.status(500).json({ 
        error: 'Failed to process rollover',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}