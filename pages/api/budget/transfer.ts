import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  const { fromBudgetId, overspentBudgets, amount } = req.body;

  if (!fromBudgetId || !overspentBudgets || !Array.isArray(overspentBudgets) || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  try {
    // Verify the source budget exists and has enough available funds
    const sourceBudget = await prisma.budget.findFirst({
      where: {
        id: fromBudgetId,
        userId: userId,
      },
    });

    if (!sourceBudget) {
      return res.status(404).json({ error: 'Source budget not found' });
    }

    const sourceAvailable = sourceBudget.amount - sourceBudget.spent;
    if (sourceAvailable < amount) {
      return res.status(400).json({ error: 'Insufficient funds in source budget' });
    }

    // Calculate total overspent amount from the provided budgets
    const overspentBudgetIds = overspentBudgets.map((b: any) => b.id);
    const overspentBudgetRecords = await prisma.budget.findMany({
      where: {
        id: { in: overspentBudgetIds },
        userId: userId,
      },
    });

    const totalOverspent = overspentBudgetRecords.reduce((sum, budget) => {
      const overspent = Math.max(0, budget.spent - budget.amount);
      return sum + overspent;
    }, 0);

    if (totalOverspent === 0) {
      return res.status(400).json({ error: 'No overspending found in target budgets' });
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (prisma) => {
      // Reduce the source budget amount
      const updatedSourceBudget = await prisma.budget.update({
        where: { id: fromBudgetId },
        data: {
          amount: sourceBudget.amount - amount,
        },
      });

      // Distribute the amount proportionally to overspent budgets
      const updates = [];
      let remainingAmount = amount;

      for (let i = 0; i < overspentBudgetRecords.length; i++) {
        const budget = overspentBudgetRecords[i];
        const overspent = Math.max(0, budget.spent - budget.amount);
        
        if (overspent > 0) {
          // Calculate proportional amount to add to this budget
          let amountToAdd;
          if (i === overspentBudgetRecords.length - 1) {
            // Last budget gets remaining amount to avoid rounding issues
            amountToAdd = remainingAmount;
          } else {
            amountToAdd = Math.min(overspent, (overspent / totalOverspent) * amount);
            remainingAmount -= amountToAdd;
          }

          if (amountToAdd > 0) {
            const updatedBudget = await prisma.budget.update({
              where: { id: budget.id },
              data: {
                amount: budget.amount + amountToAdd,
              },
            });
            updates.push(updatedBudget);
          }
        }
      }

      // Create audit trail for the transfer
      await prisma.budgetTransfer.create({
        data: {
          userId: userId,
          fromBudgetId: fromBudgetId,
          toBudgetId: overspentBudgetIds[0], // Use first overspent budget as primary target for audit
          amount: amount,
          reason: `Covered overspending: moved $${amount} from ${sourceBudget.name} to cover overspent categories`,
          // This is a manual user action
        },
      });

      return {
        sourceBudget: updatedSourceBudget,
        updatedBudgets: updates,
      };
    });

    res.json({
      success: true,
      message: `Successfully moved $${amount} to cover overspending`,
      data: result,
    });
  } catch (error) {
    console.error('Error transferring budget funds:', error);
    res.status(500).json({ error: 'Failed to transfer budget funds' });
  }
}