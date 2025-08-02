import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PayeeService {
  /**
   * Get or create a payee for a user
   */
  static async getOrCreatePayee(userId: string, payeeName: string, options?: {
    category?: string;
    isInternal?: boolean;
  }): Promise<any> {
    try {
      // Try to find existing payee
      let payee = await prisma.payee.findUnique({
        where: {
          userId_name: {
            userId,
            name: payeeName
          }
        }
      });

      // Create if doesn't exist
      if (!payee) {
        payee = await prisma.payee.create({
          data: {
            userId,
            name: payeeName,
            category: options?.category || null,
            isInternal: options?.isInternal || false,
          }
        });
        console.log(`✅ Created payee: ${payeeName}`);
      }

      return payee;
    } catch (error) {
      console.error('Error creating/getting payee:', error);
      throw error;
    }
  }

  /**
   * Create credit card payment payees for all credit card accounts
   */
  static async createCreditCardPaymentPayees(userId: string): Promise<void> {
    try {
      // Get all credit card accounts for this user
      const creditCardAccounts = await prisma.account.findMany({
        where: {
          userId,
          accountType: 'credit'
        }
      });

      console.log(`🏦 Found ${creditCardAccounts.length} credit card accounts to create payment payees for`);

      // Create payment payees for each credit card
      for (const account of creditCardAccounts) {
        const payeeName = `Payment: ${account.accountName}`;
        
        await this.getOrCreatePayee(userId, payeeName, {
          category: 'Transfer',
          isInternal: true
        });
      }
    } catch (error) {
      console.error('Error creating credit card payment payees:', error);
      throw error;
    }
  }

  /**
   * Get or create a payee from transaction description (for Plaid imports)
   */
  static async getOrCreatePayeeFromTransaction(userId: string, transactionDescription: string, category?: string): Promise<any> {
    // Clean up the transaction description to create a good payee name
    let payeeName = transactionDescription
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[*]+/g, '') // Remove asterisks
      .replace(/\s+\d{4,}\s*$/, '') // Remove trailing numbers (often account numbers)
      .trim();

    // Limit length
    if (payeeName.length > 50) {
      payeeName = payeeName.substring(0, 50).trim();
    }

    return await this.getOrCreatePayee(userId, payeeName, {
      category: category || 'General'
    });
  }

  /**
   * Get all payees for a user
   */
  static async getUserPayees(userId: string): Promise<any[]> {
    return await prisma.payee.findMany({
      where: { userId },
      orderBy: [
        { isInternal: 'desc' }, // Internal payees (transfers) first
        { name: 'asc' }
      ]
    });
  }

  /**
   * Get credit card payment payees specifically
   */
  static async getCreditCardPaymentPayees(userId: string): Promise<any[]> {
    return await prisma.payee.findMany({
      where: {
        userId,
        isInternal: true,
        name: { startsWith: 'Payment: ' }
      },
      orderBy: { name: 'asc' }
    });
  }
}