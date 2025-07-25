import { PrismaClient } from '@prisma/client';
import { AIFinancialAdvisor } from './ai-financial-advisor';

const prisma = new PrismaClient();

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  context: FinancialContext;
  suggestedActions?: string[];
  planGenerated?: CustomPlan;
  budgetChanges?: BudgetRecommendation[];
  quickReplies?: string[];
  timestamp: Date;
}

export interface FinancialContext {
  currentCashBalance: number;
  totalDebt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyFundMonths: number;
  budgetStatus: 'over' | 'under' | 'on-track';
  topSpendingCategories: { category: string; amount: number; trend: string }[];
  upcomingBills: { name: string; amount: number; dueDate: Date }[];
  recentWins: string[];
  currentGoals: { name: string; progress: number; target: number }[];
}

export interface CustomPlan {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: 'debt' | 'savings' | 'spending' | 'emergency' | 'goals';
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
  estimatedImpact: string;
  steps: PlanStep[];
  status: 'active' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanStep {
  id: string;
  description: string;
  actionType: 'budget_change' | 'payment' | 'transfer' | 'reminder' | 'review';
  details?: any;
  completed: boolean;
  dueDate?: Date;
}

export interface BudgetRecommendation {
  fromCategory: string;
  toCategory: string;
  amount: number;
  reason: string;
  impact: string;
}

export class ConversationalFinancialAdvisor {
  private userId: string;
  private advisor: AIFinancialAdvisor;

  constructor(userId: string) {
    this.userId = userId;
    this.advisor = new AIFinancialAdvisor(userId);
  }

  /**
   * Main chat processing function
   */
  async processUserMessage(message: string): Promise<ChatMessage> {
    // Get current financial context
    const context = await this.getFinancialContext();
    
    // Analyze the user's intent
    const intent = this.analyzeIntent(message, context);
    
    // Generate appropriate response
    const response = await this.generateResponse(message, intent, context);
    
    // Save the conversation
    const chatMessage = await this.saveChatMessage(message, response, context);
    
    return chatMessage;
  }

  /**
   * Get comprehensive financial context for the user
   */
  private async getFinancialContext(): Promise<FinancialContext> {
    // Get all user accounts
    const accounts = await prisma.account.findMany({
      where: { userId: this.userId }
    });

    // Get current budgets
    const budgets = await prisma.budget.findMany({
      where: { userId: this.userId }
    });

    // Get recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: thirtyDaysAgo }
      }
    });

    // Calculate financial metrics
    const cashAccounts = accounts.filter(a => a.accountType === 'depository');
    const debtAccounts = accounts.filter(a => a.accountType === 'credit' && a.balance < 0);
    
    const currentCashBalance = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalDebt = Math.abs(debtAccounts.reduce((sum, a) => sum + a.balance, 0));
    
    const monthlyIncome = await this.calculateMonthlyIncome();
    const monthlyExpenses = await this.calculateMonthlyExpenses();
    
    const emergencyFundMonths = monthlyExpenses > 0 ? currentCashBalance / monthlyExpenses : 0;
    
    // Analyze budget status
    const budgetStatus = this.analyzeBudgetStatus(budgets);
    
    // Get top spending categories
    const topSpendingCategories = this.analyzeTopSpending(recentTransactions);
    
    // Get upcoming bills (simplified - could be enhanced)
    const upcomingBills = this.getUpcomingBills(budgets);
    
    // Identify recent wins
    const recentWins = await this.identifyRecentWins(recentTransactions, budgets);
    
    // Get current goals
    const currentGoals = await this.getCurrentGoals();

    return {
      currentCashBalance,
      totalDebt,
      monthlyIncome,
      monthlyExpenses,
      emergencyFundMonths,
      budgetStatus,
      topSpendingCategories,
      upcomingBills,
      recentWins,
      currentGoals
    };
  }

  /**
   * Analyze user intent from their message
   */
  private analyzeIntent(message: string, context: FinancialContext): string {
    const lowerMessage = message.toLowerCase();
    
    // Money questions (windfall, bonus, extra money)
    if (lowerMessage.includes('extra money') || lowerMessage.includes('bonus') || 
        lowerMessage.includes('windfall') || lowerMessage.includes('got') && lowerMessage.includes('$')) {
      return 'windfall_advice';
    }
    
    // Debt questions
    if (lowerMessage.includes('debt') || lowerMessage.includes('credit card') || 
        lowerMessage.includes('pay off') || lowerMessage.includes('owe')) {
      return 'debt_help';
    }
    
    // Spending questions
    if (lowerMessage.includes('overspend') || lowerMessage.includes('budget') || 
        lowerMessage.includes('spending too much') || lowerMessage.includes('over budget')) {
      return 'spending_help';
    }
    
    // Saving questions
    if (lowerMessage.includes('save') || lowerMessage.includes('emergency fund') || 
        lowerMessage.includes('goal') || lowerMessage.includes('vacation')) {
      return 'savings_help';
    }
    
    // General advice
    if (lowerMessage.includes('advice') || lowerMessage.includes('help') || 
        lowerMessage.includes('what should i do') || lowerMessage.includes('recommend')) {
      return 'general_advice';
    }
    
    // Status check
    if (lowerMessage.includes('how am i doing') || lowerMessage.includes('progress') || 
        lowerMessage.includes('status')) {
      return 'status_check';
    }
    
    return 'general_question';
  }

  /**
   * Generate contextual response based on intent and financial situation
   */
  private async generateResponse(message: string, intent: string, context: FinancialContext): Promise<{
    response: string;
    suggestedActions?: string[];
    planGenerated?: CustomPlan;
    budgetChanges?: BudgetRecommendation[];
    quickReplies?: string[];
  }> {
    
    switch (intent) {
      case 'windfall_advice':
        return await this.handleWindfallAdvice(message, context);
      
      case 'debt_help':
        return await this.handleDebtHelp(message, context);
      
      case 'spending_help':
        return await this.handleSpendingHelp(message, context);
      
      case 'savings_help':
        return await this.handleSavingsHelp(message, context);
      
      case 'status_check':
        return await this.handleStatusCheck(context);
      
      case 'general_advice':
        return await this.handleGeneralAdvice(context);
      
      default:
        return await this.handleGeneralQuestion(message, context);
    }
  }

  /**
   * Handle windfall/bonus money questions
   */
  private async handleWindfallAdvice(message: string, context: FinancialContext): Promise<any> {
    // Extract amount from message (simplified regex)
    const amountMatch = message.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const windfall = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : 500; // Default to $500
    
    let response = `Great news on the $${windfall.toLocaleString()}! Based on your current situation, here's what I recommend:\n\n`;
    const suggestedActions: string[] = [];
    const budgetChanges: BudgetRecommendation[] = [];
    
    // Priority 1: High interest debt
    if (context.totalDebt > 0) {
      const debtPayment = Math.min(windfall * 0.7, context.totalDebt);
      response += `🎯 **High Priority**: Put $${debtPayment.toLocaleString()} toward your debt\n`;
      response += `   • This could save you months of payments and hundreds in interest\n\n`;
      suggestedActions.push(`Pay $${debtPayment.toLocaleString()} toward highest interest debt`);
    }
    
    // Priority 2: Emergency fund (if less than 3 months)
    if (context.emergencyFundMonths < 3) {
      const emergencyAmount = Math.min(windfall * 0.3, context.monthlyExpenses * 3 - context.currentCashBalance);
      if (emergencyAmount > 0) {
        response += `🛡️ **Important**: Add $${emergencyAmount.toLocaleString()} to your emergency fund\n`;
        response += `   • This gets you closer to 3 months of expenses for security\n\n`;
        suggestedActions.push(`Transfer $${emergencyAmount.toLocaleString()} to emergency savings`);
      }
    }
    
    // If no debt and good emergency fund
    if (context.totalDebt === 0 && context.emergencyFundMonths >= 3) {
      response += `🌟 **Excellent position!** Since you have no debt and a solid emergency fund:\n`;
      response += `   • Consider investing $${(windfall * 0.8).toLocaleString()} for long-term growth\n`;
      response += `   • Keep $${(windfall * 0.2).toLocaleString()} for a fun purchase - you've earned it!\n\n`;
    }
    
    // Generate a custom plan
    const plan = await this.createWindfallPlan(windfall, context);
    
    response += `💡 Want me to create a detailed plan for optimizing this money?`;
    
    return {
      response,
      suggestedActions,
      planGenerated: plan,
      budgetChanges,
      quickReplies: ['Yes, create the plan', 'Show me other options', 'What about investing?']
    };
  }

  /**
   * Handle debt-related questions
   */
  private async handleDebtHelp(message: string, context: FinancialContext): Promise<any> {
    if (context.totalDebt === 0) {
      return {
        response: "🎉 Great news - you don't currently have any debt! You're in an excellent position to focus on building wealth and achieving your goals.",
        quickReplies: ['Help me invest', 'Build my emergency fund', 'Plan for a big purchase']
      };
    }
    
    const monthlyPaymentCapacity = Math.max(0, context.monthlyIncome - context.monthlyExpenses);
    
    let response = `I can help you tackle that $${context.totalDebt.toLocaleString()} debt! Here's your situation:\n\n`;
    
    // Get debt analysis
    const debtPlans = await this.advisor.generateDebtPayoffPlan();
    const totalInterestSavings = debtPlans.reduce((sum, plan) => sum + plan.interestSaved, 0);
    const maxMonthsSaved = Math.max(...debtPlans.map(plan => plan.monthsSaved));
    
    response += `📊 **Debt Payoff Potential**:\n`;
    response += `   • With optimization, you could save $${totalInterestSavings.toLocaleString()} in interest\n`;
    response += `   • Pay off debt ${maxMonthsSaved} months sooner\n\n`;
    
    if (monthlyPaymentCapacity > 0) {
      response += `💪 **Good News**: You have $${monthlyPaymentCapacity.toLocaleString()}/month available for extra payments\n\n`;
    }
    
    // Specific recommendations
    const suggestions: string[] = [];
    if (context.topSpendingCategories.length > 0) {
      const topCategory = context.topSpendingCategories[0];
      if (topCategory.amount > 200) {
        response += `💡 **Quick Win**: I notice you spend $${topCategory.amount.toLocaleString()}/month on ${topCategory.category}. Even reducing this by $100 could accelerate your debt payoff significantly.\n\n`;
        suggestions.push(`Reduce ${topCategory.category} spending by $100/month`);
      }
    }
    
    suggestions.push('Create optimized debt payoff plan');
    suggestions.push('Find money in budget for extra payments');
    
    return {
      response: response + "Want me to create a personalized debt elimination plan?",
      suggestedActions: suggestions,
      quickReplies: ['Yes, create a plan', 'Show me where to find extra money', 'Which debt should I pay first?']
    };
  }

  /**
   * Handle spending/budget questions
   */
  private async handleSpendingHelp(message: string, context: FinancialContext): Promise<any> {
    let response = "Let me help you get your spending back on track! 📊\n\n";
    
    if (context.budgetStatus === 'over') {
      response += `I see you're currently over budget this month. Here's what's happening:\n\n`;
      
      // Identify problem areas
      const problemCategories = context.topSpendingCategories.filter(cat => cat.trend === 'increasing');
      if (problemCategories.length > 0) {
        response += `🔍 **Spending Increases**:\n`;
        problemCategories.slice(0, 3).forEach(cat => {
          response += `   • ${cat.category}: $${cat.amount.toLocaleString()} (trending up)\n`;
        });
        response += `\n`;
      }
    }
    
    // Recent wins to encourage
    if (context.recentWins.length > 0) {
      response += `🌟 **Recent Wins**: ${context.recentWins[0]}\n\n`;
    }
    
    // Specific advice
    const budgetChanges: BudgetRecommendation[] = [];
    const suggestions: string[] = [];
    
    if (context.topSpendingCategories.length > 0) {
      const topSpending = context.topSpendingCategories[0];
      response += `💡 **Biggest Opportunity**: Your top spending is ${topSpending.category} at $${topSpending.amount.toLocaleString()}/month.\n\n`;
      
      if (topSpending.amount > 300) {
        const reduction = Math.min(100, topSpending.amount * 0.2);
        suggestions.push(`Try reducing ${topSpending.category} by $${reduction.toLocaleString()}/month`);
        budgetChanges.push({
          fromCategory: topSpending.category,
          toCategory: 'Available for Assignment',
          amount: reduction,
          reason: 'Reduce overspending',
          impact: `Frees up $${reduction}/month for other priorities`
        });
      }
    }
    
    response += "What specific area would you like help with?";
    
    return {
      response,
      suggestedActions: suggestions,
      budgetChanges,
      quickReplies: ['Help me stick to my budget', 'Find ways to spend less', 'Track my progress better']
    };
  }

  /**
   * Handle savings and goals questions
   */
  private async handleSavingsHelp(message: string, context: FinancialContext): Promise<any> {
    let response = "Let's work on your savings goals! 🎯\n\n";
    
    // Emergency fund check
    if (context.emergencyFundMonths < 1) {
      response += `🚨 **First Priority**: You need an emergency fund! I recommend starting with $500, then building to $${(context.monthlyExpenses * 3).toLocaleString()}.\n\n`;
    } else if (context.emergencyFundMonths < 3) {
      response += `📈 **Good Start**: You have ${context.emergencyFundMonths.toFixed(1)} months of expenses saved. Let's get you to 3 months!\n\n`;
    } else {
      response += `✅ **Great Job**: Your emergency fund looks solid! Now we can focus on other goals.\n\n`;
    }
    
    // Available for savings
    const availableForSavings = Math.max(0, context.monthlyIncome - context.monthlyExpenses);
    if (availableForSavings > 0) {
      response += `💰 **Available for Savings**: $${availableForSavings.toLocaleString()}/month\n\n`;
    }
    
    // Current goals progress
    if (context.currentGoals.length > 0) {
      response += `🎯 **Current Goals**:\n`;
      context.currentGoals.forEach(goal => {
        const progressPercent = (goal.progress / goal.target) * 100;
        response += `   • ${goal.name}: ${progressPercent.toFixed(1)}% complete\n`;
      });
      response += `\n`;
    }
    
    const suggestions = [
      'Set up automatic savings transfers',
      'Create a new savings goal',
      'Find money in budget for savings'
    ];
    
    response += "What savings goal would you like to work on?";
    
    return {
      response,
      suggestedActions: suggestions,
      quickReplies: ['Emergency fund', 'Vacation savings', 'House down payment', 'Retirement']
    };
  }

  /**
   * Handle status check questions
   */
  private async handleStatusCheck(context: FinancialContext): Promise<any> {
    let response = "Here's how you're doing financially! 📊\n\n";
    
    // Overall assessment
    const healthScore = await this.advisor.calculateFinancialHealthScore();
    response += `🎯 **Financial Health Score**: ${Math.round(healthScore.overall)}/100 (${healthScore.healthLevel})\n\n`;
    
    // Key metrics
    response += `💰 **Key Numbers**:\n`;
    response += `   • Cash on hand: $${context.currentCashBalance.toLocaleString()}\n`;
    if (context.totalDebt > 0) {
      response += `   • Total debt: $${context.totalDebt.toLocaleString()}\n`;
    }
    response += `   • Emergency fund: ${context.emergencyFundMonths.toFixed(1)} months\n`;
    response += `   • Monthly surplus: $${(context.monthlyIncome - context.monthlyExpenses).toLocaleString()}\n\n`;
    
    // Recent wins
    if (context.recentWins.length > 0) {
      response += `🌟 **Recent Wins**:\n`;
      context.recentWins.forEach(win => {
        response += `   • ${win}\n`;
      });
      response += `\n`;
    }
    
    // Areas for improvement
    const improvements: string[] = [];
    if (context.emergencyFundMonths < 3) improvements.push('Build emergency fund');
    if (context.totalDebt > 0) improvements.push('Accelerate debt payoff');
    if (context.budgetStatus === 'over') improvements.push('Reduce overspending');
    
    if (improvements.length > 0) {
      response += `🎯 **Areas to Focus On**: ${improvements.join(', ')}\n\n`;
    }
    
    response += "What would you like to work on next?";
    
    return {
      response,
      quickReplies: ['Set a new goal', 'Improve my budget', 'Get debt help', 'Plan something fun']
    };
  }

  /**
   * Handle general advice requests
   */
  private async handleGeneralAdvice(context: FinancialContext): Promise<any> {
    const recommendations = await this.advisor.generateRecommendations();
    const topRec = recommendations[0];
    
    let response = "Here's my top recommendation for you right now:\n\n";
    
    if (topRec) {
      response += `🎯 **${topRec.title}**\n`;
      response += `${topRec.description}\n\n`;
      response += `💡 **Impact**: ${topRec.estimatedImpact}\n`;
      response += `⏱️ **Time needed**: ${topRec.timeToImplement}\n\n`;
      
      response += "Want me to help you implement this?";
      
      return {
        response,
        suggestedActions: topRec.implementationSteps.slice(0, 3),
        quickReplies: ['Yes, let\'s do it', 'Show me other options', 'Tell me more']
      };
    }
    
    // Fallback general advice
    response = "You're doing great! Here are some areas where you could optimize:\n\n";
    
    if (context.totalDebt > 0) {
      response += "• Focus on debt elimination to free up monthly cash flow\n";
    }
    if (context.emergencyFundMonths < 3) {
      response += "• Build your emergency fund for financial security\n";
    }
    if (context.budgetStatus === 'over') {
      response += "• Tighten up spending to stay within budget\n";
    }
    
    return {
      response,
      quickReplies: ['Help with debt', 'Build emergency fund', 'Control spending']
    };
  }

  /**
   * Handle general questions
   */
  private async handleGeneralQuestion(message: string, context: FinancialContext): Promise<any> {
    return {
      response: "I'd love to help! I'm here to give you personalized financial advice based on your specific situation. What would you like to know about your finances?",
      quickReplies: [
        'How am I doing overall?',
        'Help me save money',
        'What should I prioritize?',
        'Plan for a goal'
      ]
    };
  }

  /**
   * Create a custom windfall optimization plan
   */
  private async createWindfallPlan(amount: number, context: FinancialContext): Promise<CustomPlan> {
    const steps: PlanStep[] = [];
    let stepId = 1;
    
    // Debt payments
    if (context.totalDebt > 0) {
      const debtPayment = Math.min(amount * 0.7, context.totalDebt);
      steps.push({
        id: `step-${stepId++}`,
        description: `Pay $${debtPayment.toLocaleString()} toward highest interest debt`,
        actionType: 'payment',
        details: { amount: debtPayment, category: 'debt' },
        completed: false,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      });
    }
    
    // Emergency fund
    if (context.emergencyFundMonths < 3) {
      const emergencyAmount = Math.min(amount * 0.3, context.monthlyExpenses * 3);
      steps.push({
        id: `step-${stepId++}`,
        description: `Transfer $${emergencyAmount.toLocaleString()} to emergency savings`,
        actionType: 'transfer',
        details: { amount: emergencyAmount, category: 'emergency' },
        completed: false,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      });
    }
    
    // Celebration/discretionary
    const funMoney = amount * 0.1;
    steps.push({
      id: `step-${stepId++}`,
      description: `Enjoy $${funMoney.toLocaleString()} on something special - you've earned it!`,
      actionType: 'reminder',
      details: { amount: funMoney, category: 'fun' },
      completed: false
    });
    
    const plan: CustomPlan = {
      id: `plan-${Date.now()}`,
      userId: this.userId,
      title: `$${amount.toLocaleString()} Windfall Optimization Plan`,
      description: `Smart allocation of your bonus to maximize financial benefit`,
      category: 'debt',
      priority: 'high',
      timeframe: '1-2 weeks',
      estimatedImpact: `Reduce debt, build security, and still have fun!`,
      steps,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return plan;
  }

  /**
   * Save chat message to database (simplified - you'd want to implement proper storage)
   */
  private async saveChatMessage(message: string, response: any, context: FinancialContext): Promise<ChatMessage> {
    return {
      id: `chat-${Date.now()}`,
      userId: this.userId,
      message,
      response: response.response,
      context,
      suggestedActions: response.suggestedActions,
      planGenerated: response.planGenerated,
      budgetChanges: response.budgetChanges,
      quickReplies: response.quickReplies,
      timestamp: new Date()
    };
  }

  // Helper methods for context analysis
  private async calculateMonthlyIncome(): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const incomeTransactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: threeMonthsAgo },
        amount: { gt: 0 }
      }
    });

    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    return totalIncome / 3;
  }

  private async calculateMonthlyExpenses(): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: threeMonthsAgo },
        amount: { lt: 0 }
      }
    });

    const totalExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + t.amount, 0));
    return totalExpenses / 3;
  }

  private analyzeBudgetStatus(budgets: any[]): 'over' | 'under' | 'on-track' {
    if (budgets.length === 0) return 'on-track';
    
    const overBudgetCount = budgets.filter(b => b.spent > b.amount * 1.1).length;
    const totalBudgets = budgets.length;
    
    if (overBudgetCount > totalBudgets * 0.3) return 'over';
    if (overBudgetCount === 0) return 'under';
    return 'on-track';
  }

  private analyzeTopSpending(transactions: any[]): { category: string; amount: number; trend: string }[] {
    const categoryTotals = new Map<string, number>();
    
    transactions.forEach(t => {
      if (t.amount < 0) { // Expenses only
        const category = t.category || 'Uncategorized';
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + Math.abs(t.amount));
      }
    });
    
    return Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        trend: 'stable' // Simplified - could add trend analysis
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  private getUpcomingBills(budgets: any[]): { name: string; amount: number; dueDate: Date }[] {
    // Simplified - you could enhance this with actual bill tracking
    return budgets
      .filter(b => b.category === 'Monthly Bills')
      .map(b => ({
        name: b.name,
        amount: b.amount,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
      }))
      .slice(0, 3);
  }

  private async identifyRecentWins(transactions: any[], budgets: any[]): Promise<string[]> {
    const wins: string[] = [];
    
    // Check if user stayed under budget in any category
    const underBudgetCategories = budgets.filter(b => b.spent < b.amount * 0.9);
    if (underBudgetCategories.length > 0) {
      wins.push(`Stayed under budget in ${underBudgetCategories[0].name}`);
    }
    
    // Check for income increases
    const currentMonthIncome = transactions
      .filter(t => t.amount > 0 && new Date(t.date).getMonth() === new Date().getMonth())
      .reduce((sum, t) => sum + t.amount, 0);
    
    if (currentMonthIncome > 0) {
      wins.push(`Good income month with $${currentMonthIncome.toLocaleString()}`);
    }
    
    return wins.slice(0, 2);
  }

  private async getCurrentGoals(): Promise<{ name: string; progress: number; target: number }[]> {
    const goals = await prisma.goal.findMany({
      where: { userId: this.userId }
    });
    
    return goals.map(g => ({
      name: g.name,
      progress: g.currentAmount,
      target: g.targetAmount
    }));
  }
}