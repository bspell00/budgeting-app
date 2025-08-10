import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Validates that a transaction belongs to a connected account for the given user
 */
export async function validateTransactionAccess(transactionId: string, userId: string): Promise<boolean> {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: userId
      },
      include: {
        account: true
      }
    });

    if (!transaction) {
      return false;
    }

    // Ensure the account also belongs to this user
    if (transaction.account.userId !== userId) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating transaction access:', error);
    return false;
  }
}

/**
 * Validates that an account belongs to the given user
 */
export async function validateAccountAccess(accountId: string, userId: string): Promise<boolean> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: userId
      }
    });

    return !!account;
  } catch (error) {
    console.error('Error validating account access:', error);
    return false;
  }
}

/**
 * Gets all transactions for a user, ensuring they only come from connected accounts
 */
export async function getUserTransactionsFromConnectedAccounts(
  userId: string, 
  accountId?: string,
  limit: number = 50,
  month?: number,
  year?: number
) {
  try {
    // Build where clause with proper user and account filtering
    const whereClause: any = {
      userId: userId,
      // Only include transactions from accounts that belong to this user
      account: {
        userId: userId
      }
    };

    // If specific account requested, validate it belongs to user first
    if (accountId) {
      const hasAccess = await validateAccountAccess(accountId, userId);
      if (!hasAccess) {
        throw new Error('Account access denied or not found');
      }
      whereClause.accountId = accountId;
    }

    // Add month/year filtering if specified
    if (month && year) {
      whereClause.date = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1)
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        description: true,
        category: true,
        date: true,
        cleared: true,
        isManual: true,
        approved: true,
        account: {
          select: { 
            accountName: true, 
            accountType: true,
            accountSubtype: true
          }
        },
        budget: {
          select: { name: true, category: true }
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: limit
    });

    return transactions;
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    throw error;
  }
}

/**
 * Validates that all transactions in a list belong to connected accounts
 */
export function validateTransactionIntegrity(transactions: any[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  for (const transaction of transactions) {
    // Check if transaction has valid account reference
    if (!transaction.account) {
      issues.push(`Transaction ${transaction.id} has no associated account`);
      continue;
    }

    // Check if account belongs to same user as transaction
    if (transaction.account.userId !== transaction.userId) {
      issues.push(`Transaction ${transaction.id} user (${transaction.userId}) doesn't match account user (${transaction.account.userId})`);
    }

    // Check for invalid account IDs
    if (transaction.accountId === 'seed-account' || transaction.accountId.startsWith('invalid_')) {
      issues.push(`Transaction ${transaction.id} has invalid accountId: ${transaction.accountId}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export default {
  validateTransactionAccess,
  validateAccountAccess,
  getUserTransactionsFromConnectedAccounts,
  validateTransactionIntegrity
};