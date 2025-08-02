import { PrismaClient } from '@prisma/client';
import { PayeeService } from './payee-service';

const prisma = new PrismaClient();

export interface CreditCardPaymentData {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  userId: string;
}

export class CreditCardPaymentHandler {
  /**
   * Create paired transactions for credit card payments
   * - Outflow from checking account: "Payment To: [Credit Card Name]"
   * - Inflow to credit card account: "Payment From: [Checking Account Name]"
   */
  static async createCreditCardPayment(paymentData: CreditCardPaymentData) {
    const { fromAccountId, toAccountId, amount, date, userId } = paymentData;

    // Validate accounts belong to user
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({
        where: { id: fromAccountId, userId }
      }),
      prisma.account.findFirst({
        where: { id: toAccountId, userId }
      })
    ]);

    if (!fromAccount || !toAccount) {
      throw new Error('One or both accounts not found or access denied');
    }

    // Validate that we're paying from checking/savings to credit card
    const isCreditCardPayment = (
      ['checking', 'savings', 'depository'].includes(fromAccount.accountType.toLowerCase()) &&
      ['credit', 'credit_card'].includes(toAccount.accountType.toLowerCase())
    );

    if (!isCreditCardPayment) {
      throw new Error('Invalid payment: Must be from checking/savings to credit card');
    }

    // Get or create credit card payment budget
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    let creditCardPaymentBudget = await prisma.budget.findFirst({
      where: {
        userId,
        name: `${toAccount.accountName} Payment`,
        month,
        year
      }
    });

    if (!creditCardPaymentBudget) {
      creditCardPaymentBudget = await prisma.budget.create({
        data: {
          userId,
          name: `${toAccount.accountName} Payment`,
          amount: 0,
          spent: 0,
          category: 'Credit Card Payments',
          month,
          year
        }
      });
    }

    // Get or create the payment payee for this credit card
    const payeeName = `Payment: ${toAccount.accountName}`;
    const payee = await PayeeService.getOrCreatePayee(userId, payeeName, {
      category: 'Transfer',
      isInternal: true
    });

    // Create transactions in a transaction block
    const result = await prisma.$transaction(async (tx) => {
      // Outflow from checking account
      const outflowTransaction = await tx.transaction.create({
        data: {
          userId,
          accountId: fromAccountId,
          payeeId: payee.id,
          budgetId: creditCardPaymentBudget!.id,
          plaidTransactionId: `cc_payment_out_${Date.now()}`,
          amount: -Math.abs(amount), // Negative for outflow
          description: `Payment To: ${toAccount.accountName}`,
          category: `Credit Card Payments: ${toAccount.accountName}`,
          date,
          cleared: true,
          isManual: true,
          approved: true
        }
      });

      // Inflow to credit card account (positive for credit cards reduces debt)
      const inflowTransaction = await tx.transaction.create({
        data: {
          userId,
          accountId: toAccountId,
          payeeId: payee.id,
          budgetId: null, // Credit card payments don't need spending budget assignment
          plaidTransactionId: `cc_payment_in_${Date.now()}`,
          amount: Math.abs(amount), // Positive for credit card (reduces debt)
          description: `Payment From: ${fromAccount.accountName}`,
          category: 'Credit Card Payment',
          date,
          cleared: true,
          isManual: true,
          approved: true
        }
      });

      // Update account balances
      await tx.account.update({
        where: { id: fromAccountId },
        data: {
          balance: {
            decrement: Math.abs(amount)
          }
        }
      });

      await tx.account.update({
        where: { id: toAccountId },
        data: {
          balance: {
            increment: Math.abs(amount) // For credit cards, positive payment reduces debt
          }
        }
      });

      // Update budget spent amount (money used from payment budget)
      await tx.budget.update({
        where: { id: creditCardPaymentBudget!.id },
        data: {
          spent: {
            increment: Math.abs(amount)
          }
        }
      });

      return { outflowTransaction, inflowTransaction };
    });

    return result;
  }

  /**
   * Check if a transaction appears to be a credit card payment
   */
  static isCreditCardPayment(transaction: {
    description: string;
    amount: number;
    account: { accountType: string };
  }): boolean {
    const description = transaction.description.toLowerCase();
    const isPaymentDescription = (
      description.includes('payment to:') ||
      description.includes('payment from:') ||
      description.includes('credit card payment') ||
      description.includes('cc payment')
    );

    return isPaymentDescription;
  }

  /**
   * Update transaction description for credit card payments
   */
  static formatCreditCardPaymentDescription(
    isOutflow: boolean,
    fromAccountName: string,
    toAccountName: string
  ): string {
    if (isOutflow) {
      return `Payment To: ${toAccountName}`;
    } else {
      return `Payment From: ${fromAccountName}`;
    }
  }
}

export default CreditCardPaymentHandler;