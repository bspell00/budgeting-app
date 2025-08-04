import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Update all transactions with category "General" to "Needs a Category"
    const transactionResult = await prisma.transaction.updateMany({
      where: {
        category: 'General'
      },
      data: {
        category: 'Needs a Category'
      }
    });

    // Update all payees with category "General" to "Needs a Category"
    const payeeResult = await prisma.payee.updateMany({
      where: {
        category: 'General'
      },
      data: {
        category: 'Needs a Category'
      }
    });

    // Update all budgets with name "General" to "Needs a Category"
    const budgetResult = await prisma.budget.updateMany({
      where: {
        name: 'General'
      },
      data: {
        name: 'Needs a Category'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully updated General categories to Needs a Category',
      updated: {
        transactions: transactionResult.count,
        payees: payeeResult.count,
        budgets: budgetResult.count
      }
    });

  } catch (error) {
    console.error('Error fixing General categories:', error);
    return res.status(500).json({ error: 'Failed to update categories' });
  }
}