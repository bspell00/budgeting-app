interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  available: number;
  category: string;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  type: 'savings' | 'debt';
  targetDate?: string;
}

interface DashboardData {
  totalBudgeted: number;
  totalSpent: number;
  toBeAssigned: number;
  categories: Budget[];
  goals: Goal[];
}

export interface Insight {
  id: string;
  type: 'warning' | 'tip' | 'goal' | 'trend' | 'success';
  title: string;
  description: string;
  action?: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  amount?: number;
}

export class InsightsEngine {
  private transactions: Transaction[];
  private dashboardData: DashboardData;

  constructor(transactions: Transaction[], dashboardData: DashboardData) {
    this.transactions = transactions;
    this.dashboardData = dashboardData;
  }

  generateInsights(): Insight[] {
    const insights: Insight[] = [];

    // Budget-related insights
    insights.push(...this.analyzeBudgetHealth());
    insights.push(...this.analyzeSpendingPatterns());
    insights.push(...this.analyzeGoalProgress());
    insights.push(...this.generateOptimizationTips());
    insights.push(...this.analyzeCashFlow());

    // Sort by priority and confidence
    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  private analyzeBudgetHealth(): Insight[] {
    const insights: Insight[] = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const daysInMonth = new Date(today.getFullYear(), currentMonth + 1, 0).getDate();
    const daysPassed = today.getDate();
    const monthProgress = daysPassed / daysInMonth;

    this.dashboardData.categories.forEach(budget => {
      const spentPercentage = budget.spent / budget.amount;
      const expectedSpent = budget.amount * monthProgress;
      const overspendRate = (budget.spent - expectedSpent) / budget.amount;

      // Overspending warnings
      if (spentPercentage > 0.8 && monthProgress < 0.8) {
        insights.push({
          id: `budget-warning-${budget.id}`,
          type: 'warning',
          title: `${budget.category} Budget Alert`,
          description: `You've spent ${Math.round(spentPercentage * 100)}% of your ${budget.category} budget with ${Math.round((1 - monthProgress) * 100)}% of the month remaining.`,
          action: `Add $${Math.round(Math.abs(budget.available))} to Budget`,
          confidence: 90,
          priority: 'high',
          category: budget.category,
          amount: budget.spent - expectedSpent
        });
      }

      // Underspending opportunities
      if (spentPercentage < 0.5 && monthProgress > 0.7) {
        insights.push({
          id: `budget-opportunity-${budget.id}`,
          type: 'tip',
          title: `${budget.category} Budget Surplus`,
          description: `You have $${Math.round(budget.available)} remaining in your ${budget.category} budget.`,
          action: `Move $${Math.round(budget.available * 0.5)} to Savings`,
          confidence: 75,
          priority: 'medium',
          category: budget.category,
          amount: budget.available
        });
      }

      // Success stories
      if (spentPercentage >= 0.7 && spentPercentage <= 1.0 && overspendRate < 0.1) {
        insights.push({
          id: `budget-success-${budget.id}`,
          type: 'success',
          title: `Great ${budget.category} Management!`,
          description: `You're tracking perfectly with your ${budget.category} budget.`,
          confidence: 85,
          priority: 'low',
          category: budget.category
        });
      }
    });

    return insights;
  }

  private analyzeSpendingPatterns(): Insight[] {
    const insights: Insight[] = [];
    
    if (this.transactions.length < 5) {
      return insights;
    }

    // Analyze spending by day of week
    const weekdaySpending = this.transactions.reduce((acc, tx) => {
      if (tx.amount < 0) {
        const dayOfWeek = new Date(tx.date).getDay();
        acc[dayOfWeek] = (acc[dayOfWeek] || 0) + Math.abs(tx.amount);
      }
      return acc;
    }, {} as Record<number, number>);

    const weekdayTotals = Object.values(weekdaySpending);
    const avgWeekdaySpending = weekdayTotals.reduce((a, b) => a + b, 0) / weekdayTotals.length;

    // Weekend vs weekday analysis
    const weekendSpending = (weekdaySpending[0] || 0) + (weekdaySpending[6] || 0);
    const weekdaySpendingTotal = weekdayTotals.reduce((a, b) => a + b, 0) - weekendSpending;

    if (weekendSpending > weekdaySpendingTotal * 0.4) {
      insights.push({
        id: 'weekend-spending',
        type: 'trend',
        title: 'Weekend Spending Pattern',
        description: `You spend ${Math.round((weekendSpending / weekdaySpendingTotal) * 100)}% more on weekends.`,
        action: 'Consider planning weekend activities within a specific budget to control impulse spending.',
        confidence: 80,
        priority: 'medium',
        amount: weekendSpending - (weekdaySpendingTotal * 0.2)
      });
    }

    // High-frequency small purchases
    const smallPurchases = this.transactions.filter(tx => tx.amount < 0 && Math.abs(tx.amount) < 20);
    if (smallPurchases.length > this.transactions.length * 0.6) {
      const totalSmallPurchases = smallPurchases.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      insights.push({
        id: 'small-purchases',
        type: 'tip',
        title: 'Small Purchase Pattern',
        description: `${smallPurchases.length} small purchases totaling $${Math.round(totalSmallPurchases)} this month.`,
        action: 'Consider the "24-hour rule" for purchases under $20 to reduce impulse buying.',
        confidence: 70,
        priority: 'medium',
        amount: totalSmallPurchases
      });
    }

    return insights;
  }

  private analyzeGoalProgress(): Insight[] {
    const insights: Insight[] = [];

    this.dashboardData.goals.forEach(goal => {
      const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
      
      if (goal.type === 'savings') {
        if (progressPercentage < 10 && goal.targetDate) {
          const targetDate = new Date(goal.targetDate);
          const monthsRemaining = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
          const monthlyNeeded = (goal.targetAmount - goal.currentAmount) / monthsRemaining;

          insights.push({
            id: `goal-behind-${goal.id}`,
            type: 'warning',
            title: `${goal.name} Goal Behind Schedule`,
            description: `You need to save $${Math.round(monthlyNeeded)} per month to reach your goal.`,
            action: `Consider increasing your monthly contribution by $${Math.round(monthlyNeeded * 0.1)}.`,
            confidence: 85,
            priority: 'high',
            amount: monthlyNeeded
          });
        }

        if (progressPercentage > 80) {
          insights.push({
            id: `goal-near-${goal.id}`,
            type: 'success',
            title: `${goal.name} Goal Almost Complete!`,
            description: `You're ${Math.round(progressPercentage)}% of the way to your goal!`,
            action: `Just $${Math.round(goal.targetAmount - goal.currentAmount)} more to go!`,
            confidence: 95,
            priority: 'medium',
            amount: goal.targetAmount - goal.currentAmount
          });
        }
      }

      if (goal.type === 'debt') {
        const remainingDebt = goal.targetAmount - goal.currentAmount;
        if (remainingDebt > 0) {
          insights.push({
            id: `debt-progress-${goal.id}`,
            type: 'tip',
            title: `${goal.name} Progress`,
            description: `$${Math.round(remainingDebt)} remaining on your debt goal.`,
            action: 'Consider the debt avalanche method: pay minimums on all debts, then extra on highest interest rate.',
            confidence: 75,
            priority: 'medium',
            amount: remainingDebt
          });
        }
      }
    });

    return insights;
  }

  private generateOptimizationTips(): Insight[] {
    const insights: Insight[] = [];

    // Analyze category spending efficiency
    const categorySpending = this.transactions.reduce((acc, tx) => {
      if (tx.amount < 0) {
        acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    const totalSpending = Object.values(categorySpending).reduce((a, b) => a + b, 0);

    // Find categories with high spending but low budget allocation
    Object.entries(categorySpending).forEach(([category, spent]) => {
      const budget = this.dashboardData.categories.find(b => b.category === category);
      if (budget && spent > budget.amount * 1.2) {
        insights.push({
          id: `budget-rebalance-${category}`,
          type: 'tip',
          title: `Consider Increasing ${category} Budget`,
          description: `You've spent $${Math.round(spent)} but budgeted only $${budget.amount} for ${category}.`,
          action: `Increase ${category} budget by $${Math.round(spent - budget.amount)} and reduce from underused categories.`,
          confidence: 80,
          priority: 'medium',
          category: category,
          amount: spent - budget.amount
        });
      }
    });

    // Emergency fund recommendations
    const emergencyFund = this.dashboardData.goals.find(g => g.name.toLowerCase().includes('emergency'));
    const monthlyExpenses = this.dashboardData.totalSpent;
    const recommendedEmergencyFund = monthlyExpenses * 6;

    if (!emergencyFund && monthlyExpenses > 0) {
      insights.push({
        id: 'emergency-fund-missing',
        type: 'warning',
        title: 'Emergency Fund Recommended',
        description: `Build an emergency fund of $${Math.round(recommendedEmergencyFund)} (6 months of expenses).`,
        action: 'Start with a goal of $1,000 and gradually increase it.',
        confidence: 90,
        priority: 'high',
        amount: recommendedEmergencyFund
      });
    }

    return insights;
  }

  private analyzeCashFlow(): Insight[] {
    const insights: Insight[] = [];

    const income = this.transactions
      .filter(tx => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = this.transactions
      .filter(tx => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    if (savingsRate < 10 && income > 0) {
      insights.push({
        id: 'low-savings-rate',
        type: 'warning',
        title: 'Low Savings Rate',
        description: `You're saving ${Math.round(savingsRate)}% of your income. Financial experts recommend 20%.`,
        action: 'Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.',
        confidence: 85,
        priority: 'high',
        amount: income * 0.2 - (income - expenses)
      });
    }

    if (savingsRate > 30) {
      insights.push({
        id: 'high-savings-rate',
        type: 'success',
        title: 'Excellent Savings Rate!',
        description: `You're saving ${Math.round(savingsRate)}% of your income. Great job!`,
        action: 'Consider investing surplus savings for long-term growth.',
        confidence: 90,
        priority: 'low',
        amount: income - expenses
      });
    }

    return insights;
  }
}