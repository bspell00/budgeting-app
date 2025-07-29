import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIFinancialContext {
  userId: string;
  currentCashBalance: number;
  totalDebt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyFundMonths: number;
  budgetCategories: { name: string; allocated: number; spent: number; remaining: number }[];
  recentTransactions: { date: string; amount: number; payee: string; category: string }[];
  debtAccounts: { name: string; balance: number; interestRate: number; minimumPayment: number }[];
  goals: { name: string; target: number; current: number; deadline?: string }[];
  spendingTrends: { category: string; trend: 'increasing' | 'decreasing' | 'stable'; amount: number }[];
}

export interface AIResponse {
  message: string;
  suggestedActions?: {
    action: 'move_money' | 'create_budget' | 'set_goal' | 'pay_debt' | 'adjust_spending';
    description: string;
    details: any;
  }[];
  budgetRecommendations?: {
    fromCategory: string;
    toCategory: string;
    amount: number;
    reason: string;
  }[];
  customPlan?: {
    title: string;
    description: string;
    steps: string[];
    timeline: string;
    expectedOutcome: string;
  };
  followUpQuestions?: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export class AIConversationalAdvisor {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Process user message with real AI
   */
  async processMessage(userMessage: string): Promise<AIResponse> {
    try {
      // Get comprehensive financial context
      const context = await this.getFinancialContext();
      
      // Create AI system prompt with financial expertise
      const systemPrompt = this.createSystemPrompt(context);
      
      // Define function tools for AI to call
      const tools = this.defineTools();
      
      // Get AI response with function calling
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000
      });

      const aiMessage = completion.choices[0].message;
      
      // Process AI response and any function calls
      return await this.processAIResponse(aiMessage, context);
      
    } catch (error) {
      console.error('AI processing error:', error);
      
      // Enhanced fallback with intelligent rule-based responses
      const context = await this.getFinancialContext();
      return await this.generateFallbackResponse(userMessage, context);
    }
  }

  /**
   * Create comprehensive financial context for AI
   */
  private async getFinancialContext(): Promise<AIFinancialContext> {
    // Get user accounts
    const accounts = await prisma.account.findMany({
      where: { userId: this.userId }
    });

    // Get budgets
    const budgets = await prisma.budget.findMany({
      where: { userId: this.userId }
    });

    // Get recent transactions (last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: this.userId,
        date: { gte: sixtyDaysAgo }
      },
      orderBy: { date: 'desc' },
      take: 50
    });

    // Get goals
    const goals = await prisma.goal.findMany({
      where: { userId: this.userId }
    });

    // Calculate financial metrics
    const cashAccounts = accounts.filter(a => a.accountType === 'depository');
    const debtAccounts = accounts.filter(a => (a.accountType === 'credit' || a.accountType === 'loan') && a.balance < 0);
    
    const currentCashBalance = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalDebt = Math.abs(debtAccounts.reduce((sum, a) => sum + a.balance, 0));
    
    // Calculate monthly income/expenses
    const monthlyIncome = this.calculateMonthlyIncome(recentTransactions);
    const monthlyExpenses = this.calculateMonthlyExpenses(recentTransactions);
    
    const emergencyFundMonths = monthlyExpenses > 0 ? currentCashBalance / monthlyExpenses : 0;
    
    // Analyze spending trends
    const spendingTrends = this.analyzeSpendingTrends(recentTransactions);
    
    return {
      userId: this.userId,
      currentCashBalance,
      totalDebt,
      monthlyIncome,
      monthlyExpenses,
      emergencyFundMonths,
      budgetCategories: budgets.map(b => ({
        name: b.name,
        allocated: b.amount,
        spent: b.spent,
        remaining: b.amount - b.spent
      })),
      recentTransactions: recentTransactions.slice(0, 10).map(t => ({
        date: t.date.toISOString().split('T')[0],
        amount: t.amount,
        payee: t.description || 'Unknown',
        category: t.category || 'Uncategorized'
      })),
      debtAccounts: debtAccounts.map(a => ({
        name: a.accountName,
        balance: Math.abs(a.balance),
        interestRate: 0.18, // Default APR - could be enhanced with real data
        minimumPayment: Math.abs(a.balance) * 0.02 // Estimated 2% minimum
      })),
      goals: goals.map(g => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        deadline: g.targetDate?.toISOString().split('T')[0]
      })),
      spendingTrends
    };
  }

  /**
   * Create comprehensive system prompt for AI financial advisor
   */
  private createSystemPrompt(context: AIFinancialContext): string {
    return `You are an expert personal financial advisor with deep knowledge of budgeting, debt management, investing, and financial planning. You provide personalized, actionable advice based on the user's actual financial situation.

CURRENT USER FINANCIAL CONTEXT:
- Cash Balance: $${context.currentCashBalance.toLocaleString()}
- Total Debt: $${context.totalDebt.toLocaleString()}
- Monthly Income: $${context.monthlyIncome.toLocaleString()}
- Monthly Expenses: $${context.monthlyExpenses.toLocaleString()}
- Emergency Fund: ${context.emergencyFundMonths.toFixed(1)} months of expenses
- Monthly Surplus/Deficit: $${(context.monthlyIncome - context.monthlyExpenses).toLocaleString()}

BUDGET CATEGORIES:
${context.budgetCategories.map(b => 
  `- ${b.name}: $${b.allocated} allocated, $${b.spent} spent, $${b.remaining} remaining`
).join('\n')}

DEBT ACCOUNTS:
${context.debtAccounts.map(d => 
  `- ${d.name}: $${d.balance} balance, ${(d.interestRate * 100).toFixed(1)}% APR, $${d.minimumPayment} min payment`
).join('\n')}

RECENT TRANSACTIONS (Last 10):
${context.recentTransactions.map(t => 
  `- ${t.date}: ${t.payee} - $${Math.abs(t.amount)} (${t.category})`
).join('\n')}

FINANCIAL GOALS:
${context.goals.map(g => 
  `- ${g.name}: $${g.current}/$${g.target}${g.deadline ? ` by ${g.deadline}` : ''}`
).join('\n')}

SPENDING TRENDS:
${context.spendingTrends.map(s => 
  `- ${s.category}: $${s.amount}/month (${s.trend})`
).join('\n')}

INSTRUCTIONS:
1. Provide specific, actionable advice based on this real financial data
2. Use exact dollar amounts and percentages when making recommendations
3. Prioritize high-impact actions (debt payoff, emergency fund, overspending)
4. Be encouraging but honest about financial challenges
5. Suggest concrete next steps the user can take immediately
6. Consider the user's entire financial picture when giving advice
7. Use function calls when you recommend specific actions
8. Keep responses conversational and supportive, not overly technical

RESPONSE STYLE:
- Be warm, encouraging, and professional
- Use real numbers from their data, not generic examples
- Give specific recommendations, not vague advice
- Acknowledge their financial strengths and wins
- Be direct about areas that need improvement
- Provide clear next steps they can take today`;
  }

  /**
   * Define tools/functions the AI can call
   */
  private defineTools(): OpenAI.ChatCompletionTool[] {
    return [
      {
        type: "function",
        function: {
          name: "suggest_budget_reallocation",
          description: "Recommend moving money between budget categories",
          parameters: {
            type: "object",
            properties: {
              fromCategory: { type: "string", description: "Category to take money from" },
              toCategory: { type: "string", description: "Category to move money to" },
              amount: { type: "number", description: "Dollar amount to move" },
              reason: { type: "string", description: "Explanation for the reallocation" }
            },
            required: ["fromCategory", "toCategory", "amount", "reason"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_debt_payoff_plan",
          description: "Create a specific debt elimination strategy",
          parameters: {
            type: "object",
            properties: {
              strategy: { type: "string", enum: ["avalanche", "snowball", "custom"] },
              extraPayment: { type: "number", description: "Additional monthly payment amount" },
              targetDate: { type: "string", description: "Goal payoff date" },
              priorityDebt: { type: "string", description: "Which debt to focus on first" }
            },
            required: ["strategy", "extraPayment"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_savings_plan",
          description: "Create a savings or emergency fund plan",
          parameters: {
            type: "object",
            properties: {
              goalAmount: { type: "number", description: "Target savings amount" },
              monthlyContribution: { type: "number", description: "Monthly savings amount" },
              purpose: { type: "string", description: "What the savings is for" },
              timeline: { type: "string", description: "How long to reach the goal" }
            },
            required: ["goalAmount", "monthlyContribution", "purpose"]
          }
        }
      },
      {
        type: "function", 
        function: {
          name: "analyze_spending_reduction",
          description: "Identify areas to reduce spending",
          parameters: {
            type: "object",
            properties: {
              targetCategory: { type: "string", description: "Category to reduce spending in" },
              reductionAmount: { type: "number", description: "Monthly reduction target" },
              strategies: { 
                type: "array", 
                items: { type: "string" },
                description: "Specific strategies to reduce spending"
              }
            },
            required: ["targetCategory", "reductionAmount", "strategies"]
          }
        }
      }
    ];
  }

  /**
   * Process AI response and function calls
   */
  private async processAIResponse(aiMessage: any, context: AIFinancialContext): Promise<AIResponse> {
    const response: AIResponse = {
      message: aiMessage.content || "I'd be happy to help with your finances!",
      urgencyLevel: 'medium',
      confidence: 0.9
    };

    // Process function calls if any
    if (aiMessage.tool_calls) {
      response.suggestedActions = [];
      response.budgetRecommendations = [];

      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        switch (functionName) {
          case 'suggest_budget_reallocation':
            response.budgetRecommendations!.push({
              fromCategory: args.fromCategory,
              toCategory: args.toCategory,
              amount: args.amount,
              reason: args.reason
            });
            break;

          case 'create_debt_payoff_plan':
            response.customPlan = {
              title: `${args.strategy.charAt(0).toUpperCase() + args.strategy.slice(1)} Debt Payoff Plan`,
              description: `Pay an extra $${args.extraPayment}/month using the ${args.strategy} method`,
              steps: [
                `Focus extra payments on ${args.priorityDebt || 'highest interest debt'}`,
                `Set up automatic $${args.extraPayment} monthly transfer`,
                `Track progress and adjust as needed`,
                `Celebrate milestones along the way`
              ],
              timeline: args.targetDate || `${Math.ceil(context.totalDebt / args.extraPayment)} months`,
              expectedOutcome: `Save thousands in interest and become debt-free faster`
            };
            break;

          case 'create_savings_plan':
            response.customPlan = {
              title: `${args.purpose} Savings Plan`,
              description: `Save $${args.monthlyContribution}/month to reach your $${args.goalAmount} goal`,
              steps: [
                `Set up automatic $${args.monthlyContribution} monthly transfer`,
                `Open dedicated savings account if needed`,
                `Track progress monthly`,
                `Adjust contributions if income changes`
              ],
              timeline: args.timeline || `${Math.ceil(args.goalAmount / args.monthlyContribution)} months`,
              expectedOutcome: `Reach your $${args.goalAmount} ${args.purpose.toLowerCase()} goal`
            };
            break;

          case 'analyze_spending_reduction':
            response.suggestedActions!.push({
              action: 'adjust_spending',
              description: `Reduce ${args.targetCategory} spending by $${args.reductionAmount}/month`,
              details: {
                category: args.targetCategory,
                reduction: args.reductionAmount,
                strategies: args.strategies
              }
            });
            break;
        }
      }
    }

    // Determine urgency based on financial situation
    if (context.totalDebt > context.monthlyIncome * 6) response.urgencyLevel = 'critical';
    else if (context.emergencyFundMonths < 1) response.urgencyLevel = 'high';
    else if (context.monthlyIncome - context.monthlyExpenses < 0) response.urgencyLevel = 'high';
    else if (context.emergencyFundMonths < 3) response.urgencyLevel = 'medium';
    else response.urgencyLevel = 'low';

    return response;
  }

  // Helper methods
  private calculateMonthlyIncome(transactions: any[]): number {
    const incomeTransactions = transactions.filter(t => t.amount > 0);
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    return Math.round(totalIncome / 2); // Rough 2-month average
  }

  private calculateMonthlyExpenses(transactions: any[]): number {
    const expenseTransactions = transactions.filter(t => t.amount < 0);
    const totalExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + t.amount, 0));
    return Math.round(totalExpenses / 2); // Rough 2-month average
  }

  private analyzeSpendingTrends(transactions: any[]): { category: string; trend: 'increasing' | 'decreasing' | 'stable'; amount: number }[] {
    const categorySpending = new Map<string, number[]>();
    
    transactions.forEach(t => {
      if (t.amount < 0) {
        const category = t.category || 'Uncategorized';
        if (!categorySpending.has(category)) {
          categorySpending.set(category, []);
        }
        categorySpending.get(category)!.push(Math.abs(t.amount));
      }
    });

    return Array.from(categorySpending.entries())
      .map(([category, amounts]) => ({
        category,
        trend: 'stable' as const, // Simplified - could add real trend analysis
        amount: Math.round(amounts.reduce((sum, amt) => sum + amt, 0) / 2)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  /**
   * Intelligent fallback when AI is unavailable
   */
  private async generateFallbackResponse(userMessage: string, context: AIFinancialContext): Promise<AIResponse> {
    const lowerMessage = userMessage.toLowerCase();
    
    // Analyze financial health for intelligent responses
    const debtToIncomeRatio = context.monthlyIncome > 0 ? context.totalDebt / (context.monthlyIncome * 12) : 0;
    const monthlySurplus = context.monthlyIncome - context.monthlyExpenses;
    const isHighDebt = context.totalDebt > context.monthlyIncome * 6;
    const hasEmergencyFund = context.emergencyFundMonths >= 3;
    
    // Smart intent detection with context-aware responses
    if (lowerMessage.includes('financial health') || lowerMessage.includes('how am i doing') || lowerMessage.includes('overall')) {
      return {
        message: `Based on your financial data:\n\n💰 **Cash Position**: $${context.currentCashBalance.toLocaleString()}\n📊 **Monthly Surplus**: $${monthlySurplus.toLocaleString()}\n⚡ **Emergency Fund**: ${context.emergencyFundMonths.toFixed(1)} months\n\n${isHighDebt ? '🚨 **Priority**: Your debt-to-income ratio suggests focusing on debt elimination first.' : hasEmergencyFund ? '✅ **Strong Position**: You have a solid foundation. Consider growth opportunities.' : '📈 **Focus Area**: Building your emergency fund should be the next priority.'}\n\nWhat specific area would you like to explore?`,
        urgencyLevel: isHighDebt ? 'high' : context.emergencyFundMonths < 1 ? 'medium' : 'low',
        confidence: 0.85,
        followUpQuestions: [
          'Create a debt payoff plan',
          'Help me save more money',
          'Analyze my spending',
          'Set financial goals'
        ]
      };
    }
    
    if (lowerMessage.includes('extra money') || lowerMessage.includes('bonus') || lowerMessage.includes('windfall')) {
      const extraAmount = this.extractAmount(userMessage) || 1000;
      let recommendation = '';
      let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      
      if (isHighDebt) {
        recommendation = `With $${context.totalDebt.toLocaleString()} in debt, I recommend putting 70% ($${Math.round(extraAmount * 0.7).toLocaleString()}) toward your highest-interest debt. This could save you hundreds in interest payments.`;
        urgency = 'high';
      } else if (context.emergencyFundMonths < 3) {
        recommendation = `Since your emergency fund covers ${context.emergencyFundMonths.toFixed(1)} months, consider putting 60% toward emergency savings and 40% toward goals or investments.`;
      } else {
        recommendation = `Great position! With solid emergency funds and manageable debt, consider 50% for investments and 50% for goals or extra debt payments.`;
        urgency = 'low';
      }
      
      return {
        message: `Smart question about your $${extraAmount.toLocaleString()} windfall!\n\n${recommendation}\n\n💡 **Quick Analysis**:\n• Emergency Fund: ${context.emergencyFundMonths.toFixed(1)} months (${hasEmergencyFund ? 'Strong ✅' : 'Needs work 📈'})\n• Debt Level: ${isHighDebt ? 'High priority 🚨' : 'Manageable 👍'}\n• Monthly Surplus: $${monthlySurplus.toLocaleString()}\n\nWould you like a detailed allocation plan?`,
        urgencyLevel: urgency,
        confidence: 0.8,
        suggestedActions: [
          {
            action: 'pay_debt',
            description: `Pay $${Math.round(extraAmount * 0.7).toLocaleString()} toward highest interest debt`,
            details: { amount: Math.round(extraAmount * 0.7) }
          }
        ],
        followUpQuestions: ['Yes, create a plan', 'Show investment options', 'Help with emergency fund']
      };
    }
    
    if (lowerMessage.includes('debt') || lowerMessage.includes('pay off') || lowerMessage.includes('credit card')) {
      if (context.totalDebt === 0) {
        return {
          message: "🎉 Excellent news! You don't currently have any debt. You're in a great position to focus on building wealth through savings and investments. What financial goal would you like to work toward?",
          urgencyLevel: 'low',
          confidence: 0.9,
          followUpQuestions: ['Build investment portfolio', 'Increase emergency fund', 'Save for a goal', 'Plan for retirement']
        };
      }
      
      const monthsToPayoff = monthlySurplus > 0 ? Math.ceil(context.totalDebt / monthlySurplus) : 'indefinite';
      
      return {
        message: `Let's tackle your $${context.totalDebt.toLocaleString()} debt strategically!\n\n📊 **Debt Analysis**:\n• Current monthly surplus: $${monthlySurplus.toLocaleString()}\n• Payoff timeline at current rate: ${monthsToPayoff} months\n• Debt-to-income ratio: ${(debtToIncomeRatio * 100).toFixed(1)}%\n\n💪 **Recommended Strategy**: Focus on the avalanche method - pay minimums on all debts, then attack the highest interest rate first.\n\n${monthlySurplus <= 0 ? '⚠️ **Priority**: Find ways to free up money in your budget for extra payments.' : `✅ **Good news**: Your $${monthlySurplus.toLocaleString()} monthly surplus can accelerate payoff significantly.`}`,
        urgencyLevel: isHighDebt ? 'critical' : 'high',
        confidence: 0.85,
        customPlan: {
          title: 'Debt Avalanche Elimination Plan',
          description: `Pay off $${context.totalDebt.toLocaleString()} using the mathematically optimal strategy`,
          steps: [
            'List all debts by interest rate (highest first)',
            'Pay minimums on all debts',
            `Direct extra $${Math.max(50, monthlySurplus).toLocaleString()}/month to highest rate debt`,
            'Once first debt is paid, roll payment to next highest rate',
            'Repeat until debt-free'
          ],
          timeline: monthlySurplus > 0 ? `${Math.ceil(context.totalDebt / (monthlySurplus + 100))} months` : 'Varies based on extra payments',
          expectedOutcome: 'Save thousands in interest and become debt-free faster'
        },
        followUpQuestions: ['Show me the exact plan', 'Help me find extra money', 'What about debt consolidation?']
      };
    }
    
    if (lowerMessage.includes('save') || lowerMessage.includes('emergency fund') || lowerMessage.includes('savings')) {
      const targetEmergencyFund = context.monthlyExpenses * 3;
      const emergencyGap = Math.max(0, targetEmergencyFund - context.currentCashBalance);
      
      return {
        message: `Let's boost your savings! 💰\n\n📊 **Current Savings Status**:\n• Cash on hand: $${context.currentCashBalance.toLocaleString()}\n• Emergency fund: ${context.emergencyFundMonths.toFixed(1)} months\n• Monthly surplus: $${monthlySurplus.toLocaleString()}\n\n🎯 **Emergency Fund Goal**: $${targetEmergencyFund.toLocaleString()} (3 months expenses)\n${emergencyGap > 0 ? `• Still need: $${emergencyGap.toLocaleString()}` : '• ✅ Goal achieved!'}\n\n${monthlySurplus > 0 ? `💡 With your $${monthlySurplus.toLocaleString()} monthly surplus, you could reach your emergency fund goal in ${Math.ceil(emergencyGap / monthlySurplus)} months!` : '📈 Focus on increasing income or reducing expenses to build savings capacity.'}`,
        urgencyLevel: context.emergencyFundMonths < 1 ? 'high' : context.emergencyFundMonths < 3 ? 'medium' : 'low',
        confidence: 0.9,
        customPlan: emergencyGap > 0 ? {
          title: 'Emergency Fund Builder',
          description: `Save $${emergencyGap.toLocaleString()} to reach 3-month safety net`,
          steps: [
            'Open high-yield savings account',
            `Set up automatic $${Math.min(monthlySurplus, Math.ceil(emergencyGap / 6)).toLocaleString()}/month transfer`,
            'Redirect any windfalls to emergency fund',
            'Track progress monthly',
            'Celebrate when you hit 3 months!'
          ],
          timeline: monthlySurplus > 0 ? `${Math.ceil(emergencyGap / monthlySurplus)} months` : '6-12 months',
          expectedOutcome: 'Peace of mind and financial security'
        } : undefined,
        followUpQuestions: ['Help me save more', 'Where should I keep emergency fund?', 'What about other savings goals?']
      };
    }
    
    // Default intelligent response based on financial context
    let priority = '';
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    if (isHighDebt) {
      priority = 'debt elimination';
      urgency = 'critical';
    } else if (context.emergencyFundMonths < 1) {
      priority = 'emergency fund building';
      urgency = 'high';
    } else if (context.emergencyFundMonths < 3) {
      priority = 'emergency fund completion';
      urgency = 'medium';
    } else {
      priority = 'wealth building and optimization';
      urgency = 'low';
    }
    
    return {
      message: `I'm here to help with your finances! Based on your situation, your top priority should be **${priority}**.\n\n💰 **Quick Overview**:\n• Cash: $${context.currentCashBalance.toLocaleString()}\n• Debt: $${context.totalDebt.toLocaleString()}\n• Monthly flow: $${monthlySurplus.toLocaleString()}\n• Emergency fund: ${context.emergencyFundMonths.toFixed(1)} months\n\nWhat specific area would you like help with?`,
      urgencyLevel: urgency,
      confidence: 0.75,
      followUpQuestions: [
        'Analyze my complete financial health',
        'Create a debt payoff strategy', 
        'Help me build emergency savings',
        'Show me ways to save more money',
        'Plan for a financial goal'
      ]
    };
  }
  
  /**
   * Extract dollar amount from user message
   */
  private extractAmount(message: string): number | null {
    const amountMatch = message.match(/\$?([\d,]+)/);
    return amountMatch ? parseInt(amountMatch[1].replace(',', '')) : null;
  }
}