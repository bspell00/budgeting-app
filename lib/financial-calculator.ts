import prisma from './prisma';

// Conditional import for WebSocket server (only available in runtime)
let triggerFinancialSync: ((userId: string) => Promise<void>) | null = null;
if (typeof window === 'undefined') {
  try {
    const websocketServer = require('./websocket-server');
    triggerFinancialSync = websocketServer.triggerFinancialSync;
  } catch (error) {
    console.log('WebSocket server not available during build');
  }
}

/**
 * Centralized Financial Calculator
 * 
 * This service ensures all financial calculations are consistent across the app.
 * It's the single source of truth for account balances, budget amounts, and "To Be Assigned".
 */
export class FinancialCalculator {
  /**
   * Calculate core financial metrics for a user
   */
  static async calculateFinancialMetrics(userId: string, month?: number, year?: number) {
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    // Get all financial data in parallel
    const [accounts, budgets] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        orderBy: { accountName: 'asc' }
      }),
      prisma.budget.findMany({
        where: {
          userId,
          month: currentMonth,
          year: currentYear,
        },
        orderBy: { name: 'asc' }
      })
    ]);

    // Calculate account totals - Exclude "Just Watching" accounts from budgeting calculations
    const cashAccounts = accounts.filter(account => 
      !account.isJustWatching && (
        account.accountType === 'depository' || 
        account.accountType === 'investment' ||
        (account.accountType === 'other' && account.balance > 0)
      )
    );
    
    const debtAccounts = accounts.filter(account => 
      !account.isJustWatching && (
        account.accountType === 'credit' || 
        account.accountType === 'loan' ||
        (account.accountType === 'other' && account.balance < 0)
      )
    );
    
    // Get Just Watching accounts separately for display purposes
    const justWatchingAccounts = accounts.filter(account => account.isJustWatching);
    
    const totalCashBalance = cashAccounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0);
    const totalDebtBalance = debtAccounts.reduce((sum, account) => sum + account.balance, 0);
    const totalNetWorth = totalCashBalance + totalDebtBalance;

    // Calculate budget totals
    const allBudgetsExceptTBA = budgets.filter(budget => budget.name !== 'To Be Assigned');
    const totalBudgetedByUser = allBudgetsExceptTBA.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
    
    // Core YNAB calculation: To Be Assigned = Available Cash - Budgeted
    const correctToBeAssigned = totalCashBalance - totalBudgetedByUser;

    return {
      accounts: {
        all: accounts,
        cash: cashAccounts,
        debt: debtAccounts,
        justWatching: justWatchingAccounts,
        totalCash: totalCashBalance,
        totalDebt: totalDebtBalance,
        netWorth: totalNetWorth
      },
      budgets: {
        all: budgets,
        userBudgets: allBudgetsExceptTBA,
        totalBudgeted: totalBudgetedByUser,
        totalSpent,
        toBeAssigned: correctToBeAssigned
      },
      month: currentMonth,
      year: currentYear
    };
  }

  /**
   * Ensure "To Be Assigned" budget is correct and update if needed
   */
  static async ensureToBeAssignedBudget(userId: string, month?: number, year?: number) {
    const metrics = await this.calculateFinancialMetrics(userId, month, year);
    const { budgets, accounts } = metrics;

    // Find or create "To Be Assigned" budget
    let toBeAssignedBudget = budgets.all.find(budget => budget.name === 'To Be Assigned');
    
    if (!toBeAssignedBudget) {
      console.log(`📝 Creating missing "To Be Assigned" budget for ${metrics.month}/${metrics.year}`);
      toBeAssignedBudget = await prisma.budget.create({
        data: {
          userId,
          name: 'To Be Assigned',
          category: 'Income',
          amount: budgets.toBeAssigned,
          spent: 0,
          month: metrics.month,
          year: metrics.year,
        }
      });
    } else if (Math.abs(toBeAssignedBudget.amount - budgets.toBeAssigned) > 0.01) {
      console.log(`🔄 Updating "To Be Assigned" from $${toBeAssignedBudget.amount.toFixed(2)} to $${budgets.toBeAssigned.toFixed(2)}`);
      await prisma.budget.update({
        where: { id: toBeAssignedBudget.id },
        data: { amount: budgets.toBeAssigned }
      });
      toBeAssignedBudget.amount = budgets.toBeAssigned;
    }

    return {
      ...metrics,
      budgets: {
        ...metrics.budgets,
        toBeAssignedBudget
      }
    };
  }

  /**
   * Update account balance and trigger financial sync
   */
  static async updateAccountBalance(accountId: string, amount: number, userId: string) {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    // Trigger real-time sync
    if (triggerFinancialSync) {
      await triggerFinancialSync(userId);
    }
  }

  /**
   * Update budget spent amount and trigger financial sync
   */
  static async updateBudgetSpent(budgetId: string, amount: number, userId: string) {
    await prisma.budget.update({
      where: { id: budgetId },
      data: {
        spent: {
          increment: amount
        }
      }
    });

    // Trigger real-time sync
    if (triggerFinancialSync) {
      await triggerFinancialSync(userId);
    }
  }

  /**
   * Move money between budgets and trigger financial sync
   */
  static async moveMoney(fromBudgetId: string, toBudgetId: string, amount: number, userId: string) {
    await prisma.$transaction([
      prisma.budget.update({
        where: { id: fromBudgetId },
        data: { amount: { decrement: amount } }
      }),
      prisma.budget.update({
        where: { id: toBudgetId },
        data: { amount: { increment: amount } }
      })
    ]);

    // Trigger real-time sync
    if (triggerFinancialSync) {
      await triggerFinancialSync(userId);
    }
  }

  /**
   * Create transaction with automatic account/budget updates and sync
   */
  static async createTransactionWithSync(transactionData: {
    userId: string;
    accountId: string;
    budgetId?: string | null;
    amount: number;
    description: string;
    category: string;
    date?: Date;
    plaidTransactionId?: string;
    isManual?: boolean;
    cleared?: boolean;
    approved?: boolean;
  }) {
    const transaction = await prisma.transaction.create({
      data: {
        ...transactionData,
        date: transactionData.date || new Date(),
        cleared: transactionData.cleared ?? true,
        approved: transactionData.approved ?? false,
        isManual: transactionData.isManual ?? false,
        plaidTransactionId: transactionData.plaidTransactionId || `manual_${Date.now()}`
      }
    });

    // Update account balance
    await this.updateAccountBalance(transactionData.accountId, transactionData.amount, transactionData.userId);

    // Update budget spent (only for negative amounts - expenses)
    if (transactionData.budgetId && transactionData.amount < 0) {
      await this.updateBudgetSpent(transactionData.budgetId, Math.abs(transactionData.amount), transactionData.userId);
    }

    return transaction;
  }

  /**
   * Delete transaction with automatic account/budget updates and sync
   */
  static async deleteTransactionWithSync(transactionId: string, userId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { budget: true, account: true }
    });

    if (!transaction || transaction.userId !== userId) {
      throw new Error('Transaction not found or access denied');
    }

    // Reverse account balance change
    await this.updateAccountBalance(transaction.accountId, -transaction.amount, userId);

    // Reverse budget spent change (only for negative amounts - expenses)
    if (transaction.budget && transaction.amount < 0) {
      await this.updateBudgetSpent(transaction.budget.id, -Math.abs(transaction.amount), userId);
    }

    // Delete the transaction
    await prisma.transaction.delete({
      where: { id: transactionId }
    });

    return transaction;
  }

  /**
   * Format budgets for dashboard display
   */
  static formatBudgetsForDashboard(budgets: any[]) {
    const budgetsByCategory = budgets.reduce((acc, budget) => {
      // Skip "To Be Assigned" - it's handled separately
      if (budget.name === 'To Be Assigned') {
        return acc;
      }
      
      // Normalize credit card categories
      let categoryGroup = budget.category || 'Misc';
      if (categoryGroup === 'Credit Card Payment' || 
          categoryGroup.startsWith('Credit Card Payments:') ||
          categoryGroup.includes('Credit Card')) {
        categoryGroup = 'Credit Card Payments';
      }
      
      if (!acc[categoryGroup]) {
        acc[categoryGroup] = [];
      }
      
      acc[categoryGroup].push({
        id: budget.id,
        name: budget.name,
        budgeted: budget.amount,
        spent: budget.spent,
        available: budget.amount - budget.spent,
        status: budget.spent > budget.amount ? 'overspent' : 'on-track',
      });
      
      return acc;
    }, {} as { [key: string]: any[] });

    return Object.entries(budgetsByCategory)
      .map((entry) => {
        const [categoryName, budgetItems] = entry;
        const items = budgetItems as any[];
        return {
          id: categoryName.toLowerCase().replace(/\s+/g, '-'),
          name: categoryName,
          category: categoryName,
          budgets: items,
          totalBudgeted: items.reduce((sum: number, item: any) => sum + item.budgeted, 0),
          totalSpent: items.reduce((sum: number, item: any) => sum + item.spent, 0),
          totalAvailable: items.reduce((sum: number, item: any) => sum + item.available, 0),
        };
      })
      .sort((a, b) => {
        if (a.name === 'Credit Card Payments') return -1;
        if (b.name === 'Credit Card Payments') return 1;
        return a.name.localeCompare(b.name);
      });
  }
}