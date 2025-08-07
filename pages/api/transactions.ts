import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getUserTransactionsFromConnectedAccounts } from '../../lib/transaction-validation';
import { FinancialCalculator } from '../../lib/financial-calculator';
import CreditCardAutomation from '../../lib/credit-card-automation';
import prisma from '../../lib/prisma';

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
    const { amount, description, category, date, accountId } = req.body;

    if (!amount || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Auto-categorize income transactions
    let finalCategory = category;
    if (parseFloat(amount) > 0) {
      // Check if this is income by using our income detection logic
      if (CreditCardAutomation.isIncomeTransaction(description, [], parseFloat(amount))) {
        finalCategory = 'To Be Assigned';
      }
    }

    try {
      let account;
      
      // If accountId is provided, validate and use that account
      if (accountId) {
        account = await prisma.account.findFirst({
          where: { 
            id: accountId,
            userId: userId // Ensure user owns this account
          }
        });
        
        if (!account) {
          return res.status(403).json({ error: 'Account not found or access denied' });
        }
      } else {
        // Fall back to Manual Entry account if no specific account provided
        account = await prisma.account.findFirst({
          where: { 
            userId: userId,
            accountName: 'Manual Entry'
          }
        });

        if (!account) {
          account = await prisma.account.create({
            data: {
              userId: userId,
              plaidAccountId: 'manual_' + userId,
              plaidAccessToken: 'manual',
              accountName: 'Manual Entry',
              accountType: 'manual',
              accountSubtype: 'manual',
              balance: 0,
              availableBalance: 0,
            }
          });
        }
      }

      // Find matching budget for this category and month
      const transactionDate = date ? new Date(date) : new Date();
      const month = transactionDate.getMonth() + 1;
      const year = transactionDate.getFullYear();

      let budget = await prisma.budget.findFirst({
        where: {
          userId: userId,
          name: finalCategory, // Use finalCategory instead of category
          month: month,
          year: year,
        }
      });

      // Auto-create budget if it doesn't exist
      if (!budget) {
        // For "To Be Assigned", ensure it's in the Income category group
        if (finalCategory === 'To Be Assigned') {
          budget = await prisma.budget.create({
            data: {
              userId: userId,
              name: 'To Be Assigned',
              category: 'Income',
              amount: 0,
              spent: 0,
              month: month,
              year: year
            }
          });
        } else {
          budget = await CreditCardAutomation.getOrCreateBudget(
            userId,
            finalCategory,
            month,
            year,
            100 // $100 default for other categories
          );
        }
      }

      // Use the centralized financial calculator for transaction creation
      const transaction = await FinancialCalculator.createTransactionWithSync({
        userId: userId,
        accountId: account.id,
        budgetId: budget?.id || null,
        amount: parseFloat(amount),
        description,
        category: finalCategory,
        date: transactionDate,
        plaidTransactionId: 'manual_' + Date.now(),
        isManual: true,
        cleared: account.accountType !== 'manual', // Uncleared for connected accounts, cleared for manual entry
        approved: true, // Manual transactions are automatically approved
      });

      console.log(`✅ Transaction created with WebSocket sync: ${description} - $${amount}`);
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  } else if (req.method === 'GET') {
    try {
      const { accountId } = req.query;
      
      console.log('🔍 GET /api/transactions called with:', { 
        userId, 
        accountId: accountId as string | undefined,
        accountIdType: typeof accountId 
      });
      
      // Use the secure validation function to get transactions
      const transactions = await getUserTransactionsFromConnectedAccounts(
        userId,
        accountId as string | undefined,
        50
      );

      console.log('🔍 GET /api/transactions result:', {
        transactionCount: transactions?.length || 0,
        isArray: Array.isArray(transactions),
        accountId: accountId as string | undefined
      });

      // Format response to match expected structure
      res.json({ transactions });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      if (error instanceof Error && error.message.includes('access denied')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch transactions' });
      }
    }
  } else if (req.method === 'PATCH') {
    const { id } = req.query;
    const updates = req.body;

    // Handle specific validation for the cleared field if it's being updated
    if (updates.hasOwnProperty('cleared') && typeof updates.cleared !== 'boolean') {
      return res.status(400).json({ error: 'cleared field must be a boolean' });
    }

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: id as string }
      });

      if (!transaction || transaction.userId !== userId) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Prepare the update data object
      const updateData: any = {};
      
      // Handle each possible field update
      if (updates.hasOwnProperty('cleared')) {
        updateData.cleared = updates.cleared;
      }
      if (updates.hasOwnProperty('description')) {
        updateData.description = updates.description;
      }
      if (updates.hasOwnProperty('category')) {
        updateData.category = updates.category;
      }
      if (updates.hasOwnProperty('amount')) {
        updateData.amount = parseFloat(updates.amount);
      }
      if (updates.hasOwnProperty('date')) {
        updateData.date = new Date(updates.date);
      }
      if (updates.hasOwnProperty('accountId')) {
        // Validate that the user owns the target account
        const targetAccount = await prisma.account.findFirst({
          where: { 
            id: updates.accountId,
            userId: userId
          }
        });
        if (!targetAccount) {
          return res.status(403).json({ error: 'Target account not found or access denied' });
        }
        updateData.accountId = updates.accountId;
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: id as string },
        data: updateData
      });

      // Trigger financial sync after update
      if (FinancialCalculator && typeof FinancialCalculator.ensureToBeAssignedBudget === 'function') {
        try {
          await FinancialCalculator.ensureToBeAssignedBudget(userId);
          console.log('✅ Financial sync completed after transaction update');
        } catch (error) {
          console.error('⚠️ Financial sync failed after transaction update:', error);
        }
      }

      res.json(updatedTransaction);
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ error: 'Failed to update transaction' });
    }
  } else if (req.method === 'DELETE') {
    const { id } = req.query;

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: id as string },
        include: { 
          budget: true,
          account: true
        }
      });

      if (!transaction || transaction.userId !== userId) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Check if this is a credit card payment transfer
      const isCreditCardPayment = (
        transaction.description.includes('Payment To:') ||
        transaction.description.includes('Payment From:') ||
        transaction.plaidTransactionId?.startsWith('cc_payment_')
      );

      let pairedTransaction = null;
      
      if (isCreditCardPayment) {
        // Find the paired transaction
        const isOutflow = transaction.description.includes('Payment To:');
        const isInflow = transaction.description.includes('Payment From:');
        
        if (isOutflow) {
          // This is the outflow (checking account), find the paired inflow (credit card)
          const creditCardName = transaction.description.replace('Payment To: ', '');
          pairedTransaction = await prisma.transaction.findFirst({
            where: {
              userId: userId,
              description: `Payment From: ${transaction.account?.accountName}`,
              date: transaction.date,
              amount: Math.abs(transaction.amount), // Positive amount for credit card
              account: {
                accountType: 'credit'
              }
            },
            include: { budget: true, account: true }
          });
        } else if (isInflow) {
          // This is the inflow (credit card), find the paired outflow (checking)
          const checkingAccountName = transaction.description.replace('Payment From: ', '');
          pairedTransaction = await prisma.transaction.findFirst({
            where: {
              userId: userId,
              description: `Payment To: ${transaction.account?.accountName}`,
              date: transaction.date,
              amount: -Math.abs(transaction.amount), // Negative amount for checking
              account: {
                accountType: { in: ['checking', 'depository', 'savings'] }
              }
            },
            include: { budget: true, account: true }
          });
        }
      }

      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Handle the main transaction
        if (transaction.budget && transaction.amount < 0) {
          await tx.budget.update({
            where: { id: transaction.budget.id },
            data: {
              spent: {
                decrement: Math.abs(transaction.amount)
              }
            }
          });
        }

        await tx.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: {
              decrement: transaction.amount
            }
          }
        });

        await tx.transaction.delete({
          where: { id: id as string }
        });

        // Handle the paired transaction if found
        if (pairedTransaction) {
          console.log('🔗 Deleting paired credit card payment transaction:', pairedTransaction.id);
          
          if (pairedTransaction.budget && pairedTransaction.amount < 0) {
            await tx.budget.update({
              where: { id: pairedTransaction.budget.id },
              data: {
                spent: {
                  decrement: Math.abs(pairedTransaction.amount)
                }
              }
            });
          }

          await tx.account.update({
            where: { id: pairedTransaction.accountId },
            data: {
              balance: {
                decrement: pairedTransaction.amount
              }
            }
          });

          await tx.transaction.delete({
            where: { id: pairedTransaction.id }
          });
        }
      });

      console.log(`✅ Deleted transaction ${id}${pairedTransaction ? ` and paired transaction ${pairedTransaction.id}` : ''}`);
      
      // Trigger financial sync after deletion
      if (FinancialCalculator && typeof FinancialCalculator.ensureToBeAssignedBudget === 'function') {
        try {
          await FinancialCalculator.ensureToBeAssignedBudget(userId);
          console.log('✅ Financial sync completed after transaction deletion');
        } catch (error) {
          console.error('⚠️ Financial sync failed after transaction deletion:', error);
        }
      }
      
      res.json({ 
        success: true, 
        deletedTransactions: pairedTransaction ? 2 : 1,
        pairedTransactionDeleted: !!pairedTransaction
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: 'Failed to delete transaction' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}