import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, encryptPlaidToken, decryptPlaidToken } from './encryption';

const prisma = new PrismaClient();

/**
 * Secure account operations with encrypted Plaid tokens
 */
export class SecureAccountService {
  /**
   * Create account with encrypted Plaid access token
   */
  static async createAccount(data: {
    userId: string;
    plaidAccountId: string;
    plaidAccessToken: string;
    accountName: string;
    accountType: string;
    accountSubtype?: string;
    balance: number;
    availableBalance?: number;
  }) {
    // Encrypt the Plaid access token before storing
    const encryptedToken = encryptPlaidToken(data.plaidAccessToken);
    
    return await prisma.account.create({
      data: {
        ...data,
        accountSubtype: data.accountSubtype || '',
        plaidAccessToken: encryptedToken,
      },
    });
  }

  /**
   * Get account with decrypted Plaid access token
   */
  static async getAccountWithDecryptedToken(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) return null;

    // Decrypt the Plaid access token
    const decryptedToken = decryptPlaidToken(account.plaidAccessToken);
    
    return {
      ...account,
      plaidAccessToken: decryptedToken,
    };
  }

  /**
   * Get all accounts for a user (tokens remain encrypted for security)
   */
  static async getUserAccounts(userId: string) {
    return await prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        plaidAccountId: true,
        accountName: true,
        accountType: true,
        accountSubtype: true,
        balance: true,
        availableBalance: true,
        createdAt: true,
        updatedAt: true,
        // Exclude encrypted token from general queries
        // plaidAccessToken: false,
      },
    });
  }

  /**
   * Update account balance securely
   */
  static async updateAccountBalance(accountId: string, balance: number, availableBalance?: number) {
    return await prisma.account.update({
      where: { id: accountId },
      data: {
        balance,
        availableBalance,
        updatedAt: new Date(),
      },
    });
  }
}

/**
 * Secure user data operations
 */
export class SecureUserService {
  /**
   * Get user data with security logging
   */
  static async getUser(userId: string) {
    // Log access for security audit trail
    console.log(`🔒 Secure access to user data: ${userId} at ${new Date().toISOString()}`);
    
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password hash from general queries
      },
    });
  }

  /**
   * Securely delete user and all associated data
   */
  static async deleteUserData(userId: string) {
    // Log deletion for compliance
    console.log(`🗑️ Secure deletion of user data: ${userId} at ${new Date().toISOString()}`);
    
    // Delete in proper order due to foreign key constraints
    await prisma.$transaction(async (tx) => {
      await tx.budgetTransfer.deleteMany({ where: { userId } });
      await tx.transaction.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.goal.deleteMany({ where: { userId } });
      await tx.aIPlan.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    
    return true;
  }
}

/**
 * Secure transaction operations with data masking
 */
export class SecureTransactionService {
  /**
   * Create transaction with sensitive data logging
   */
  static async createTransaction(data: any) {
    // Log transaction creation for audit trail (without sensitive amounts)
    console.log(`💰 Transaction created for user: ${data.userId} at ${new Date().toISOString()}`);
    
    return await prisma.transaction.create({ data });
  }

  /**
   * Get transactions with optional data masking for sensitive users
   */
  static async getUserTransactions(userId: string, maskSensitive = false) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: {
        account: {
          select: {
            accountName: true,
            accountType: true,
          },
        },
        budget: {
          select: {
            name: true,
            category: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Optionally mask sensitive data for demo/testing
    if (maskSensitive) {
      return transactions.map(tx => ({
        ...tx,
        amount: Math.abs(tx.amount) > 100 ? '***' : tx.amount,
        description: tx.description.length > 10 ? '***' : tx.description,
      }));
    }

    return transactions;
  }
}

/**
 * Security audit logging
 */
export class SecurityAuditService {
  /**
   * Log security events
   */
  static async logSecurityEvent(event: {
    userId?: string;
    action: string;
    resource: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    details?: string;
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    // In production, send to secure logging service
    console.log('🛡️ SECURITY AUDIT:', JSON.stringify(logEntry));
    
    // Could also store in database or send to external security service
    return logEntry;
  }

  /**
   * Log data access events
   */
  static async logDataAccess(userId: string, dataType: string, action: string) {
    return this.logSecurityEvent({
      userId,
      action,
      resource: dataType,
      success: true,
      details: `User accessed ${dataType} data`,
    });
  }
}

export { prisma };