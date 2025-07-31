import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
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
    // Count existing data before deletion
    const accountCount = await prisma.account.count({ where: { userId } });
    const transactionCount = await prisma.transaction.count({ where: { userId } });
    const budgetTransferCount = await prisma.budgetTransfer.count({ where: { userId } });

    console.log(`🧹 Resetting Plaid data for user ${userId}:`);
    console.log(`- ${accountCount} accounts`);
    console.log(`- ${transactionCount} transactions`);
    console.log(`- ${budgetTransferCount} budget transfers`);

    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete budget transfers (they reference transactions)
    await prisma.budgetTransfer.deleteMany({
      where: { userId }
    });
    
    // 2. Delete transactions (they reference accounts and budgets)
    await prisma.transaction.deleteMany({
      where: { userId }
    });
    
    // 3. Delete accounts (they reference users)
    await prisma.account.deleteMany({
      where: { userId }
    });

    // Note: We keep budgets and goals as they may have been manually created
    // If you want to delete auto-created credit card budgets/goals, we can add that

    console.log(`✅ Successfully reset Plaid data for user ${userId}`);
    
    res.json({ 
      success: true, 
      message: `Deleted ${accountCount} accounts, ${transactionCount} transactions, and ${budgetTransferCount} budget transfers`,
      deleted: {
        accounts: accountCount,
        transactions: transactionCount,
        budgetTransfers: budgetTransferCount
      }
    });
  } catch (error) {
    console.error('Error resetting Plaid data:', error);
    res.status(500).json({ error: 'Failed to reset Plaid data' });
  }
}