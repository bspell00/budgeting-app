export interface DebtAccount {
  id: string;
  name: string;
  balance: number;
  minimumPayment: number;
  interestRate: number; // Annual percentage rate
  accountType: 'credit_card' | 'loan' | 'line_of_credit';
}

export interface PayoffStrategy {
  name: string;
  description: string;
  totalInterest: number;
  totalPayments: number;
  payoffDate: Date;
  monthsToPayoff: number;
  schedule: PaymentSchedule[];
}

export interface PaymentSchedule {
  month: number;
  date: Date;
  debtName: string;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface PayoffComparison {
  snowball: PayoffStrategy;
  avalanche: PayoffStrategy;
  custom?: PayoffStrategy;
  savings: {
    timeSaved: number; // months
    interestSaved: number; // dollars
    recommendedStrategy: 'snowball' | 'avalanche' | 'custom';
  };
}

export class DebtPayoffCalculator {
  
  /**
   * Debt Snowball Method - Pay minimums on all debts, extra goes to smallest balance
   */
  static calculateSnowball(debts: DebtAccount[], extraPayment: number = 0): PayoffStrategy {
    const sortedDebts = [...debts].sort((a, b) => a.balance - b.balance);
    return this.calculatePayoffSchedule(sortedDebts, extraPayment, 'Debt Snowball');
  }

  /**
   * Debt Avalanche Method - Pay minimums on all debts, extra goes to highest interest rate
   */
  static calculateAvalanche(debts: DebtAccount[], extraPayment: number = 0): PayoffStrategy {
    const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);
    return this.calculatePayoffSchedule(sortedDebts, extraPayment, 'Debt Avalanche');
  }

  /**
   * Custom Method - Pay debts in user-defined order
   */
  static calculateCustom(debts: DebtAccount[], extraPayment: number = 0): PayoffStrategy {
    return this.calculatePayoffSchedule(debts, extraPayment, 'Custom Strategy');
  }

  /**
   * Compare all strategies and provide recommendations
   */
  static compareStrategies(debts: DebtAccount[], extraPayment: number = 0): PayoffComparison {
    const snowball = this.calculateSnowball(debts, extraPayment);
    const avalanche = this.calculateAvalanche(debts, extraPayment);

    const timeSaved = snowball.monthsToPayoff - avalanche.monthsToPayoff;
    const interestSaved = snowball.totalInterest - avalanche.totalInterest;

    // Recommend avalanche if it saves significant money, snowball for motivation
    const recommendedStrategy = interestSaved > 500 ? 'avalanche' : 'snowball';

    return {
      snowball,
      avalanche,
      savings: {
        timeSaved,
        interestSaved,
        recommendedStrategy
      }
    };
  }

  /**
   * Calculate detailed payoff schedule
   */
  private static calculatePayoffSchedule(
    debts: DebtAccount[], 
    extraPayment: number, 
    strategyName: string
  ): PayoffStrategy {
    const schedule: PaymentSchedule[] = [];
    const workingDebts = debts.map(debt => ({ ...debt }));
    
    let month = 0;
    let totalInterest = 0;
    let totalPayments = 0;

    while (workingDebts.some(debt => debt.balance > 0)) {
      month++;
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() + month);

      let remainingExtraPayment = extraPayment;

      // Pay minimums on all debts first
      for (const debt of workingDebts) {
        if (debt.balance <= 0) continue;

        const monthlyInterestRate = debt.interestRate / 100 / 12;
        const interestPayment = debt.balance * monthlyInterestRate;
        const principalPayment = Math.min(debt.minimumPayment - interestPayment, debt.balance);
        
        debt.balance -= principalPayment;
        totalInterest += interestPayment;
        totalPayments += debt.minimumPayment;

        schedule.push({
          month,
          date: currentDate,
          debtName: debt.name,
          payment: debt.minimumPayment,
          principal: principalPayment,
          interest: interestPayment,
          remainingBalance: Math.max(0, debt.balance)
        });
      }

      // Apply extra payment to the priority debt (first in sorted order)
      if (remainingExtraPayment > 0) {
        const priorityDebt = workingDebts.find(debt => debt.balance > 0);
        if (priorityDebt) {
          const extraPrincipal = Math.min(remainingExtraPayment, priorityDebt.balance);
          priorityDebt.balance -= extraPrincipal;
          totalPayments += extraPrincipal;

          // Update the schedule entry for this debt
          const lastEntry = schedule
            .slice()
            .reverse()
            .find(entry => entry.debtName === priorityDebt.name && entry.month === month);
          
          if (lastEntry) {
            lastEntry.payment += extraPrincipal;
            lastEntry.principal += extraPrincipal;
            lastEntry.remainingBalance = Math.max(0, priorityDebt.balance);
          }
        }
      }

      // Safety check to prevent infinite loops
      if (month > 600) { // 50 years max
        break;
      }
    }

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + month);

    return {
      name: strategyName,
      description: this.getStrategyDescription(strategyName),
      totalInterest,
      totalPayments,
      payoffDate,
      monthsToPayoff: month,
      schedule
    };
  }

  /**
   * Calculate minimum extra payment needed to be debt-free by target date
   */
  static calculateTargetPayment(debts: DebtAccount[], targetMonths: number): number {
    let low = 0;
    let high = 10000; // Max extra payment to try
    let result = 0;

    // Binary search for the minimum extra payment
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const strategy = this.calculateAvalanche(debts, mid);
      
      if (strategy.monthsToPayoff <= targetMonths) {
        result = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return result;
  }

  /**
   * Calculate potential savings from debt consolidation
   */
  static calculateConsolidationSavings(
    debts: DebtAccount[], 
    consolidationRate: number, 
    consolidationPayment: number
  ): {
    currentStrategy: PayoffStrategy;
    consolidatedStrategy: PayoffStrategy;
    savings: number;
  } {
    const currentStrategy = this.calculateAvalanche(debts);
    
    const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
    const consolidatedDebt: DebtAccount = {
      id: 'consolidated',
      name: 'Consolidated Loan',
      balance: totalDebt,
      minimumPayment: consolidationPayment,
      interestRate: consolidationRate,
      accountType: 'loan'
    };

    const consolidatedStrategy = this.calculatePayoffSchedule(
      [consolidatedDebt], 
      0, 
      'Debt Consolidation'
    );

    return {
      currentStrategy,
      consolidatedStrategy,
      savings: currentStrategy.totalInterest - consolidatedStrategy.totalInterest
    };
  }

  private static getStrategyDescription(strategyName: string): string {
    switch (strategyName) {
      case 'Debt Snowball':
        return 'Pay minimum on all debts, extra payment goes to smallest balance first. Provides psychological wins and momentum.';
      case 'Debt Avalanche':
        return 'Pay minimum on all debts, extra payment goes to highest interest rate first. Mathematically optimal, saves the most money.';
      case 'Custom Strategy':
        return 'Pay debts in your preferred order. Customize based on your priorities and situation.';
      case 'Debt Consolidation':
        return 'Combine all debts into a single loan with potentially lower interest rate.';
      default:
        return 'Custom debt payoff strategy.';
    }
  }

  /**
   * Generate motivational milestones for the debt payoff journey
   */
  static generateMilestones(strategy: PayoffStrategy): Array<{
    title: string;
    description: string;
    targetDate: Date;
    amountPaid: number;
    remainingDebt: number;
  }> {
    const milestones = [];
    const totalDebt = strategy.schedule[0]?.remainingBalance || 0;
    
    // 25%, 50%, 75%, 100% milestones
    const percentages = [0.25, 0.5, 0.75, 1.0];
    
    for (const percentage of percentages) {
      const targetAmount = totalDebt * percentage;
      const milestoneEntry = strategy.schedule.find(entry => 
        (totalDebt - entry.remainingBalance) >= targetAmount
      );

      if (milestoneEntry) {
        milestones.push({
          title: `${percentage * 100}% Debt Free!`,
          description: percentage === 1 
            ? '🎉 Completely debt free! You did it!' 
            : `${percentage * 100}% of your debt has been eliminated!`,
          targetDate: milestoneEntry.date,
          amountPaid: totalDebt - milestoneEntry.remainingBalance,
          remainingDebt: milestoneEntry.remainingBalance
        });
      }
    }

    return milestones;
  }
}

export default DebtPayoffCalculator;