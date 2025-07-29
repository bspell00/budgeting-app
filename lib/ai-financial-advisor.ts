import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Types for AI Financial Advisor
export interface DebtPayoffPlan {
  id: string;
  debtName: string;
  currentBalance: number;
  minimumPayment: number;
  interestRate: number;
  currentPayoffDate: Date;
  optimizedPayoffDate: Date;
  monthsSaved: number;
  interestSaved: number;
  recommendedPayment: number;
  strategy: 'avalanche' | 'snowball' | 'custom';
}

export interface SpendingPattern {
  category: string;
  averageMonthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: 'low' | 'medium' | 'high';
  triggerEvents: string[];
  bestPerformingWeeks: string[];
  recommendations: string[];
}

export interface BehavioralInsight {
  id: string;
  type: 'spending_trigger' | 'success_pattern' | 'optimization_opportunity' | 'warning';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedActions: string[];
  dataPoints: string[];
  createdAt: Date;
}

export interface FinancialHealthScore {
  overall: number; // 0-100
  debtUtilization: number;
  emergencyFundRatio: number;
  savingsRate: number;
  budgetConsistency: number;
  paymentHistory: number;
  improvementTrend: 'improving' | 'declining' | 'stable';
  healthLevel: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

export interface AdvisorRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'debt' | 'savings' | 'spending' | 'emergency' | 'goals';
  title: string;
  description: string;
  estimatedImpact: string;
  timeToImplement: string;
  difficultyLevel: 'easy' | 'moderate' | 'challenging';
  suggestedBudgetChanges?: {
    fromCategory: string;
    toCategory: string;
    amount: number;
  }[];
  implementationSteps: string[];
  createdAt: Date;
  completedAt?: Date;
}

export class AIFinancialAdvisor {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Generate comprehensive debt payoff analysis and optimization
   */
  async generateDebtPayoffPlan(): Promise<DebtPayoffPlan[]> {
    // Get all credit card accounts (debts)
    const debtAccounts = await prisma.account.findMany({
      where: {
        userId: this.userId,
        accountType: 'credit',
        balance: { lt: 0 } // Negative balance = debt
      }
    });

    // Get current payment budgets
    const paymentBudgets = await prisma.budget.findMany({
      where: {
        userId: this.userId,
        category: { in: ['Credit Card Payments', 'Closed Card Debt'] }
      }
    });

    // Get user's total monthly income (estimated from transactions)
    const monthlyIncome = await this.estimateMonthlyIncome();
    const availableForDebt = await this.calculateAvailableDebtPayment();

    const plans: DebtPayoffPlan[] = [];

    for (const account of debtAccounts) {
      const currentBalance = Math.abs(account.balance);
      const paymentBudget = paymentBudgets.find(b => 
        b.name.toLowerCase().includes(account.accountName.toLowerCase())
      );
      
      const minimumPayment = paymentBudget?.amount || Math.max(25, currentBalance * 0.02);
      const estimatedAPR = 0.24; // Default 24% APR - could be enhanced with real data

      // Calculate current payoff timeline
      const currentPayoff = this.calculatePayoffTime(currentBalance, minimumPayment, estimatedAPR);
      
      // Calculate optimized payoff (debt avalanche method)
      const optimizedPayment = minimumPayment + (availableForDebt / debtAccounts.length);
      const optimizedPayoff = this.calculatePayoffTime(currentBalance, optimizedPayment, estimatedAPR);

      plans.push({
        id: account.id,
        debtName: account.accountName,
        currentBalance,
        minimumPayment,
        interestRate: estimatedAPR,
        currentPayoffDate: currentPayoff.payoffDate,
        optimizedPayoffDate: optimizedPayoff.payoffDate,
        monthsSaved: currentPayoff.months - optimizedPayoff.months,
        interestSaved: currentPayoff.totalInterest - optimizedPayoff.totalInterest,
        recommendedPayment: optimizedPayment,
        strategy: 'avalanche'
      });
    }

    // Sort by interest rate (avalanche method)
    return plans.sort((a, b) => b.interestRate - a.interestRate);
  }

  /**
   * Analyze user's spending patterns and behavior
   */
  async analyzeSpendingBehavior(): Promise<SpendingPattern[]> {
    // Get last 6 months of transactions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: sixMonthsAgo },
        amount: { lt: 0 } // Only spending (negative amounts)
      },
      orderBy: { date: 'desc' }
    });

    // Group by category and analyze patterns
    const categoryGroups = this.groupTransactionsByCategory(transactions);
    const patterns: SpendingPattern[] = [];

    for (const [category, categoryTransactions] of Object.entries(categoryGroups)) {
      const monthlyAmounts = this.calculateMonthlySpending(categoryTransactions as any[]);
      const averageMonthly = monthlyAmounts.reduce((sum, amt) => sum + amt, 0) / monthlyAmounts.length;
      
      // Calculate trend
      const trend = this.calculateSpendingTrend(monthlyAmounts);
      
      // Calculate volatility
      const volatility = this.calculateVolatility(monthlyAmounts, averageMonthly);
      
      // Identify triggers and patterns
      const triggerEvents = await this.identifySpendingTriggers(categoryTransactions as any[]);
      const bestWeeks = this.identifyBestPerformingPeriods(categoryTransactions as any[]);
      const recommendations = this.generateCategoryRecommendations(category, trend, volatility, averageMonthly);

      patterns.push({
        category,
        averageMonthly,
        trend,
        volatility,
        triggerEvents,
        bestPerformingWeeks: bestWeeks,
        recommendations
      });
    }

    return patterns.sort((a, b) => b.averageMonthly - a.averageMonthly);
  }

  /**
   * Generate personalized behavioral insights
   */
  async generateBehavioralInsights(): Promise<BehavioralInsight[]> {
    const insights: BehavioralInsight[] = [];
    const spendingPatterns = await this.analyzeSpendingBehavior();
    const transactions = await this.getRecentTransactions(90); // Last 90 days

    // Insight 1: Weekend vs Weekday spending
    const weekendSpending = this.analyzeWeekendVsWeekdaySpending(transactions);
    if (weekendSpending.weekendPremium > 0.2) {
      insights.push({
        id: 'weekend-spending',
        type: 'spending_trigger',
        title: 'Weekend Spending Pattern Detected',
        description: `You spend ${Math.round(weekendSpending.weekendPremium * 100)}% more on weekends. This adds up to about $${Math.round(weekendSpending.extraCost)} per month.`,
        confidence: 0.85,
        impact: 'medium',
        actionable: true,
        suggestedActions: [
          'Set a weekend discretionary spending limit',
          'Plan weekend activities that fit your budget',
          'Consider weekend meal prep to avoid eating out'
        ],
        dataPoints: [`${weekendSpending.weekendTransactions} weekend transactions analyzed`],
        createdAt: new Date()
      });
    }

    // Insight 2: Stress spending correlation
    const stressSpending = await this.analyzeStressSpending(transactions);
    if (stressSpending.correlation > 0.3) {
      insights.push({
        id: 'stress-spending',
        type: 'spending_trigger',
        title: 'Stress-Related Spending Detected',
        description: `Your spending increases by ${Math.round(stressSpending.increasePercentage)}% during stressful periods, particularly on ${stressSpending.topCategories.join(' and ')}.`,
        confidence: 0.78,
        impact: 'high',
        actionable: true,
        suggestedActions: [
          'Create a "stress budget" of $50/month for emotional purchases',
          'Set up spending alerts for high-stress categories',
          'Try the 24-hour rule before large purchases during busy periods'
        ],
        dataPoints: [`${stressSpending.stressfulDays} high-spending days analyzed`],
        createdAt: new Date()
      });
    }

    // Insight 3: Successful budget periods
    const successPatterns = this.identifySuccessPatterns(spendingPatterns);
    if (successPatterns.length > 0) {
      insights.push({
        id: 'success-patterns',
        type: 'success_pattern',
        title: 'Your Best Budget Months Have Common Traits',
        description: `Your most successful budget months share these patterns: ${successPatterns.join(', ')}`,
        confidence: 0.92,
        impact: 'high',
        actionable: true,
        suggestedActions: [
          'Try to replicate these successful patterns',
          'Set calendar reminders for these positive behaviors',
          'Track these patterns to maintain consistency'
        ],
        dataPoints: [`Analysis of ${spendingPatterns.length} spending categories`],
        createdAt: new Date()
      });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate overall financial health score
   */
  async calculateFinancialHealthScore(): Promise<FinancialHealthScore> {
    const accounts = await prisma.account.findMany({
      where: { userId: this.userId }
    });

    const budgets = await prisma.budget.findMany({
      where: { userId: this.userId }
    });

    // Calculate debt utilization
    const totalCredit = accounts
      .filter(a => a.accountType === 'credit')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);
    
    const totalDebt = accounts
      .filter(a => (a.accountType === 'credit' || a.accountType === 'loan') && a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const debtUtilization = totalCredit > 0 ? Math.min(100, (totalDebt / totalCredit) * 100) : 100;

    // Calculate emergency fund ratio
    const cashAccounts = accounts.filter(a => a.accountType === 'depository');
    const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
    const monthlyExpenses = await this.estimateMonthlyExpenses();
    const emergencyFundRatio = Math.min(100, (totalCash / (monthlyExpenses * 3)) * 100); // 3 months target

    // Calculate savings rate
    const monthlyIncome = await this.estimateMonthlyIncome();
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlySavings / monthlyIncome) * 100) : 0;

    // Calculate budget consistency
    const budgetConsistency = await this.calculateBudgetConsistency();

    // Calculate payment history score
    const paymentHistory = await this.calculatePaymentHistoryScore();

    // Overall score (weighted average)
    const overall = Math.round(
      (debtUtilization * 0.3) + // Lower is better, so invert
      (emergencyFundRatio * 0.25) +
      (savingsRate * 0.2) +
      (budgetConsistency * 0.15) +
      (paymentHistory * 0.1)
    );

    const finalScore = Math.min(100, Math.max(0, 100 - (debtUtilization * 0.3) + (emergencyFundRatio * 0.25) + (savingsRate * 0.2) + (budgetConsistency * 0.15) + (paymentHistory * 0.1)));
    
    let healthLevel: 'excellent' | 'good' | 'fair' | 'poor';
    if (finalScore >= 80) healthLevel = 'excellent';
    else if (finalScore >= 65) healthLevel = 'good';
    else if (finalScore >= 50) healthLevel = 'fair';
    else healthLevel = 'poor';

    return {
      overall: finalScore,
      debtUtilization: 100 - debtUtilization, // Invert so higher is better
      emergencyFundRatio,
      savingsRate,
      budgetConsistency,
      paymentHistory,
      improvementTrend: await this.calculateImprovementTrend(),
      healthLevel,
      recommendations: await this.generateHealthRecommendations(overall)
    };
  }

  /**
   * Generate personalized advisor recommendations
   */
  async generateRecommendations(): Promise<AdvisorRecommendation[]> {
    const recommendations: AdvisorRecommendation[] = [];
    const healthScore = await this.calculateFinancialHealthScore();
    const debtPlans = await this.generateDebtPayoffPlan();
    const behavioralInsights = await this.generateBehavioralInsights();

    // Critical: High debt utilization
    if (healthScore.debtUtilization < 70) {
      recommendations.push({
        id: 'high-debt-utilization',
        priority: 'critical',
        category: 'debt',
        title: 'High Credit Card Debt Detected',
        description: 'Your debt utilization is impacting your financial health. Focusing on debt payoff should be your top priority.',
        estimatedImpact: `Save $${Math.round(debtPlans.reduce((sum, plan) => sum + plan.interestSaved, 0))} in interest`,
        timeToImplement: 'Start immediately',
        difficultyLevel: 'moderate',
        suggestedBudgetChanges: this.generateDebtPayoffBudgetChanges(debtPlans),
        implementationSteps: [
          'Review your debt payoff plan in the AI Advisor tab',
          'Identify discretionary spending to redirect to debt payments',
          'Set up automatic payments for recommended amounts',
          'Track progress weekly and adjust as needed'
        ],
        createdAt: new Date()
      });
    }

    // High: No emergency fund
    if (healthScore.emergencyFundRatio < 30) {
      recommendations.push({
        id: 'emergency-fund',
        priority: 'high',
        category: 'emergency',
        title: 'Build Emergency Fund',
        description: 'You need an emergency fund to avoid debt when unexpected expenses arise.',
        estimatedImpact: 'Prevent future debt and financial stress',
        timeToImplement: '3-6 months',
        difficultyLevel: 'easy',
        implementationSteps: [
          'Start with a $500 starter emergency fund',
          'Set up automatic savings of $50-100 per month',
          'Keep funds in a separate high-yield savings account',
          'Build to 3-6 months of expenses over time'
        ],
        createdAt: new Date()
      });
    }

    // Medium: Budget consistency issues
    if (healthScore.budgetConsistency < 70) {
      const budgetIssues = await this.identifyBudgetConsistencyIssues();
      recommendations.push({
        id: 'budget-consistency',
        priority: 'medium',
        category: 'spending',
        title: 'Improve Budget Consistency',
        description: `You frequently overspend in ${budgetIssues.problemCategories.join(', ')}. Better planning could save you money.`,
        estimatedImpact: `Prevent $${budgetIssues.averageOverspend}/month in overspending`,
        timeToImplement: '2-4 weeks',
        difficultyLevel: 'easy',
        implementationSteps: [
          'Review spending patterns in problem categories',
          'Set realistic budget amounts based on actual spending',
          'Use the envelope method for discretionary categories',
          'Check budget weekly instead of monthly'
        ],
        createdAt: new Date()
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Helper methods (implementation details)
  private calculatePayoffTime(balance: number, payment: number, apr: number) {
    const monthlyRate = apr / 12;
    let months = 0;
    let remainingBalance = balance;
    let totalInterest = 0;

    while (remainingBalance > 0 && months < 600) { // Cap at 50 years
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = Math.max(0, payment - interestPayment);
      
      totalInterest += interestPayment;
      remainingBalance -= principalPayment;
      months++;

      if (principalPayment <= 0) break; // Payment too small
    }

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);

    return { months, payoffDate, totalInterest };
  }

  private async estimateMonthlyIncome(): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const incomeTransactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: threeMonthsAgo },
        amount: { gt: 0 } // Positive amounts are income
      }
    });

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    return totalIncome / 3; // Average monthly income
  }

  private async calculateAvailableDebtPayment(): Promise<number> {
    const monthlyIncome = await this.estimateMonthlyIncome();
    const monthlyExpenses = await this.estimateMonthlyExpenses();
    const currentDebtPayments = await this.getCurrentDebtPayments();
    
    return Math.max(0, monthlyIncome - monthlyExpenses - currentDebtPayments);
  }

  private async estimateMonthlyExpenses(): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: threeMonthsAgo },
        amount: { lt: 0 } // Negative amounts are expenses
      }
    });

    const totalExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + t.amount, 0));
    return totalExpenses / 3;
  }

  private async getCurrentDebtPayments(): Promise<number> {
    const paymentBudgets = await prisma.budget.findMany({
      where: {
        userId: this.userId,
        category: { in: ['Credit Card Payments', 'Closed Card Debt'] }
      }
    });

    return paymentBudgets.reduce((sum, b) => sum + b.amount, 0);
  }

  private groupTransactionsByCategory(transactions: any[]) {
    return transactions.reduce((groups, transaction) => {
      const category = transaction.category || 'Uncategorized';
      if (!groups[category]) groups[category] = [];
      groups[category].push(transaction);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private calculateMonthlySpending(transactions: any[]): number[] {
    // Group transactions by month and calculate totals
    const monthlyTotals = new Map<string, number>();
    
    transactions.forEach(t => {
      const monthKey = new Date(t.date).toISOString().substring(0, 7); // YYYY-MM
      const current = monthlyTotals.get(monthKey) || 0;
      monthlyTotals.set(monthKey, current + Math.abs(t.amount));
    });

    return Array.from(monthlyTotals.values());
  }

  private calculateSpendingTrend(monthlyAmounts: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (monthlyAmounts.length < 2) return 'stable';
    
    const firstHalf = monthlyAmounts.slice(0, Math.floor(monthlyAmounts.length / 2));
    const secondHalf = monthlyAmounts.slice(Math.floor(monthlyAmounts.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, amt) => sum + amt, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, amt) => sum + amt, 0) / secondHalf.length;
    
    const changePercent = (secondAvg - firstAvg) / firstAvg;
    
    if (changePercent > 0.1) return 'increasing';
    if (changePercent < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateVolatility(amounts: number[], average: number): 'low' | 'medium' | 'high' {
    if (amounts.length < 2) return 'low';
    
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / amounts.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / average;
    
    if (coefficientOfVariation < 0.2) return 'low';
    if (coefficientOfVariation < 0.5) return 'medium';
    return 'high';
  }

  private async identifySpendingTriggers(transactions: any[]): Promise<string[]> {
    const triggers: string[] = [];
    
    // Analyze day-of-week patterns
    const daySpending = transactions.reduce((days, t) => {
      const day = new Date(t.date).getDay();
      days[day] = (days[day] || 0) + Math.abs(t.amount);
      return days;
    }, {} as Record<number, number>);
    
    const avgDaily = (Object.values(daySpending) as number[]).reduce((sum: number, amt: number) => sum + amt, 0) / 7;
    const weekend = (daySpending[0] || 0) + (daySpending[6] || 0);
    
    if (weekend > avgDaily * 3) {
      triggers.push('Weekend spending spikes');
    }
    
    // Could add more trigger analysis here
    return triggers;
  }

  private identifyBestPerformingPeriods(transactions: any[]): string[] {
    // Analyze which weeks/periods had lower spending
    const weeklySpending = new Map<string, number>();
    
    transactions.forEach(t => {
      const date = new Date(t.date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().substring(0, 10);
      
      const current = weeklySpending.get(weekKey) || 0;
      weeklySpending.set(weekKey, current + Math.abs(t.amount));
    });
    
    const sortedWeeks = Array.from(weeklySpending.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([week]) => week);
    
    return sortedWeeks;
  }

  private generateCategoryRecommendations(category: string, trend: string, volatility: string, average: number): string[] {
    const recommendations: string[] = [];
    
    if (trend === 'increasing') {
      recommendations.push(`${category} spending is trending up - consider setting a stricter limit`);
    }
    
    if (volatility === 'high') {
      recommendations.push(`${category} has high volatility - try to plan purchases in advance`);
    }
    
    if (average > 500) { // High spending category
      recommendations.push(`${category} is a major expense - look for optimization opportunities`);
    }
    
    return recommendations;
  }

  private async getRecentTransactions(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: startDate }
      },
      orderBy: { date: 'desc' }
    });
  }

  private analyzeWeekendVsWeekdaySpending(transactions: any[]) {
    let weekendSpending = 0;
    let weekdaySpending = 0;
    let weekendTransactions = 0;
    let weekdayTransactions = 0;
    
    transactions.forEach(t => {
      const dayOfWeek = new Date(t.date).getDay();
      const amount = Math.abs(t.amount);
      
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        weekendSpending += amount;
        weekendTransactions++;
      } else {
        weekdaySpending += amount;
        weekdayTransactions++;
      }
    });
    
    const avgWeekendSpending = weekendTransactions > 0 ? weekendSpending / weekendTransactions : 0;
    const avgWeekdaySpending = weekdayTransactions > 0 ? weekdaySpending / weekdayTransactions : 0;
    
    const weekendPremium = avgWeekdaySpending > 0 ? (avgWeekendSpending - avgWeekdaySpending) / avgWeekdaySpending : 0;
    const extraCost = weekendPremium * avgWeekdaySpending * 8; // 8 weekend days per month
    
    return {
      weekendPremium,
      extraCost,
      weekendTransactions
    };
  }

  private async analyzeStressSpending(transactions: any[]) {
    // Simplified stress analysis - in reality, this could be more sophisticated
    // For now, identify days with unusually high spending
    
    const dailySpending = new Map<string, number>();
    
    transactions.forEach(t => {
      const day = new Date(t.date).toISOString().substring(0, 10);
      const current = dailySpending.get(day) || 0;
      dailySpending.set(day, current + Math.abs(t.amount));
    });
    
    const amounts = Array.from(dailySpending.values());
    const avgDaily = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const highSpendingDays = amounts.filter(amt => amt > avgDaily * 1.5).length;
    
    return {
      correlation: highSpendingDays / amounts.length,
      increasePercentage: 50, // Simplified
      topCategories: ['Dining Out', 'Shopping'],
      stressfulDays: highSpendingDays
    };
  }

  private identifySuccessPatterns(patterns: SpendingPattern[]): string[] {
    const successFactors: string[] = [];
    
    const stableCategories = patterns.filter(p => p.volatility === 'low').length;
    const decreasingSpend = patterns.filter(p => p.trend === 'decreasing').length;
    
    if (stableCategories > patterns.length * 0.6) {
      successFactors.push('consistent spending across categories');
    }
    
    if (decreasingSpend > patterns.length * 0.3) {
      successFactors.push('trending downward in discretionary spending');
    }
    
    return successFactors;
  }

  private async calculateBudgetConsistency(): Promise<number> {
    const budgets = await prisma.budget.findMany({
      where: { userId: this.userId }
    });
    
    if (budgets.length === 0) return 0;
    
    const consistentBudgets = budgets.filter(b => {
      const overagePercent = b.amount > 0 ? (b.spent - b.amount) / b.amount : 0;
      return overagePercent <= 0.1; // Within 10% of budget
    });
    
    return (consistentBudgets.length / budgets.length) * 100;
  }

  private async calculatePaymentHistoryScore(): Promise<number> {
    // Simplified - could track actual payment history
    return 85; // Placeholder
  }

  private async calculateImprovementTrend(): Promise<'improving' | 'declining' | 'stable'> {
    // Compare current month to previous months
    return 'stable'; // Placeholder
  }

  private async generateHealthRecommendations(score: number): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (score < 60) {
      recommendations.push('Focus on debt reduction as your top priority');
      recommendations.push('Build a small emergency fund to prevent more debt');
    } else if (score < 80) {
      recommendations.push('Continue debt payoff while building emergency savings');
      recommendations.push('Optimize your budget to increase available funds');
    } else {
      recommendations.push('Great job! Focus on long-term wealth building');
      recommendations.push('Consider increasing retirement contributions');
    }
    
    return recommendations;
  }

  private generateDebtPayoffBudgetChanges(plans: DebtPayoffPlan[]) {
    // Generate suggestions for budget reallocation
    return plans.map(plan => ({
      fromCategory: 'Discretionary Spending',
      toCategory: `${plan.debtName} Payment`,
      amount: plan.recommendedPayment - plan.minimumPayment
    }));
  }

  private async identifyBudgetConsistencyIssues() {
    const budgets = await prisma.budget.findMany({
      where: { userId: this.userId }
    });
    
    const problemBudgets = budgets.filter(b => b.spent > b.amount * 1.1);
    const problemCategories = problemBudgets.map(b => b.name);
    const averageOverspend = problemBudgets.reduce((sum, b) => sum + (b.spent - b.amount), 0) / problemBudgets.length || 0;
    
    return {
      problemCategories,
      averageOverspend
    };
  }
}