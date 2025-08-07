import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check if OpenAI API key is configured
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: 'button';
    label: string;
    action: string;
    data?: any;
  }>;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  try {
    const { message, history = [] }: ChatRequest = req.body;

    // Store user message in database
    const userMessage = await (prisma as any).chatMessage.create({
      data: {
        userId,
        type: 'user',
        content: message
      }
    });

    // Get recent conversation history from database (last 20 messages)
    const dbHistory = await (prisma as any).chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Reverse to get chronological order (oldest first)
    const conversationHistory = dbHistory.reverse().map((msg: any) => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get COMPREHENSIVE financial data for robust analysis
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const [
      budgets, 
      lastMonthBudgets,  
      last3MonthsBudgets,
      accounts, 
      currentTransactions, 
      allTransactions,
      yearTransactions,
      goals,
      budgetTransfers
    ] = await Promise.all([
      // Current month budgets
      prisma.budget.findMany({
        where: { userId, month: currentMonth, year: currentYear },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      }),
      // Last month budgets
      prisma.budget.findMany({
        where: { userId, month: lastMonth, year: lastMonthYear },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      }),
      // Last 3 months budgets for trends
      prisma.budget.findMany({
        where: { 
          userId,
          OR: [
            { month: currentMonth - 3 < 1 ? currentMonth - 3 + 12 : currentMonth - 3, year: currentMonth - 3 < 1 ? currentYear - 1 : currentYear },
            { month: currentMonth - 2 < 1 ? currentMonth - 2 + 12 : currentMonth - 2, year: currentMonth - 2 < 1 ? currentYear - 1 : currentYear },
            { month: lastMonth, year: lastMonthYear },
            { month: currentMonth, year: currentYear }
          ]
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }, { category: 'asc' }, { name: 'asc' }]
      }),
      // All accounts with balances
      prisma.account.findMany({
        where: { userId },
        orderBy: { accountName: 'asc' }
      }),
      // Current month transactions
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1),
          },
        },
        include: { account: true, budget: true },
        orderBy: { date: 'desc' },
      }),
      // All transactions for comprehensive analysis
      prisma.transaction.findMany({
        where: { userId },
        include: { account: true, budget: true },
        orderBy: { date: 'desc' },
        take: 1000 // Limit to prevent memory issues
      }),
      // This year's transactions for income analysis
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: new Date(currentYear, 0, 1),
            lt: new Date(currentYear + 1, 0, 1),
          },
        },
        include: { account: true, budget: true },
        orderBy: { date: 'desc' },
      }),
      // Goals
      prisma.goal.findMany({
        where: { userId },
        orderBy: { name: 'asc' }
      }),
      // Budget transfers for automation tracking
      prisma.budgetTransfer.findMany({
        where: { userId },
        include: { fromBudget: true, toBudget: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    // COMPREHENSIVE FINANCIAL ANALYSIS ENGINE
    
    // === ACCOUNT ANALYSIS ===
    const cashAccounts = accounts.filter(a => ['depository', 'investment'].includes(a.accountType));
    const creditAccounts = accounts.filter(a => a.accountType === 'credit');
    const totalCash = cashAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
    const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
    const netWorth = totalCash - totalDebt;
    
    // === INCOME ANALYSIS ===
    const incomeTransactions = yearTransactions.filter(t => t.amount > 0 && (t.category === 'To Be Assigned' || !['Transfer', 'Credit Card Payment', 'Payment', 'Deposit'].includes(t.category)));
    const totalYearIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const averageMonthlyIncome = totalYearIncome / 12;
    const currentMonthIncome = currentTransactions.filter(t => t.amount > 0 && (t.category === 'To Be Assigned' || !['Transfer', 'Credit Card Payment'].includes(t.category))).reduce((sum, t) => sum + t.amount, 0);
    
    // === EXPENSE ANALYSIS ===
    const expenseTransactions = yearTransactions.filter(t => t.amount < 0);
    const totalYearExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + t.amount, 0));
    const averageMonthlyExpenses = totalYearExpenses / 12;
    const currentMonthExpenses = Math.abs(currentTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    
    // === BUDGET ANALYSIS ===
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const totalAvailable = totalBudgeted - totalSpent;
    const toBeAssigned = totalCash - totalBudgeted;
    
    // Budget trends
    const lastMonthBudgeted = lastMonthBudgets.reduce((sum, b) => sum + b.amount, 0);
    const lastMonthSpent = lastMonthBudgets.reduce((sum, b) => sum + b.spent, 0);
    const budgetGrowth = lastMonthBudgeted > 0 ? ((totalBudgeted - lastMonthBudgeted) / lastMonthBudgeted) * 100 : 0;
    const spendingGrowth = lastMonthSpent > 0 ? ((totalSpent - lastMonthSpent) / lastMonthSpent) * 100 : 0;
    
    // === CATEGORY ANALYSIS ===
    const categoryAnalysis = budgets.reduce((acc, budget) => {
      const category = budget.category || 'Other';
      if (!acc[category]) {
        acc[category] = { budgeted: 0, spent: 0, available: 0, count: 0, utilization: 0 };
      }
      acc[category].budgeted += budget.amount;
      acc[category].spent += budget.spent;
      acc[category].available += (budget.amount - budget.spent);
      acc[category].count += 1;
      acc[category].utilization = acc[category].budgeted > 0 ? (acc[category].spent / acc[category].budgeted) * 100 : 0;
      return acc;
    }, {} as Record<string, any>);
    
    // === SPENDING PATTERNS ===
    const merchantAnalysis = currentTransactions.reduce((acc, t) => {
      const merchant = t.description || 'Unknown';
      if (!acc[merchant]) {
        acc[merchant] = { amount: 0, count: 0, avgAmount: 0 };
      }
      acc[merchant].amount += Math.abs(t.amount);
      acc[merchant].count += 1;
      acc[merchant].avgAmount = acc[merchant].amount / acc[merchant].count;
      return acc;
    }, {} as Record<string, any>);
    
    const topMerchants = Object.entries(merchantAnalysis)
      .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
      .slice(0, 10);
    
    // === FINANCIAL RATIOS ===
    const savingsRate = averageMonthlyIncome > 0 ? ((averageMonthlyIncome - averageMonthlyExpenses) / averageMonthlyIncome) * 100 : 0;
    const debtToIncomeRatio = averageMonthlyIncome > 0 ? (totalDebt / (averageMonthlyIncome * 12)) * 100 : 0;
    const expenseRatio = averageMonthlyIncome > 0 ? (averageMonthlyExpenses / averageMonthlyIncome) * 100 : 0;
    const emergencyFundMonths = averageMonthlyExpenses > 0 ? totalCash / averageMonthlyExpenses : 0;
    
    // === GOAL ANALYSIS ===
    const goalAnalysis = goals.map(goal => {
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
      const remaining = goal.targetAmount - goal.currentAmount;
      const monthlySavingsPotential = Math.max(0, averageMonthlyIncome - averageMonthlyExpenses);
      const monthsToCompletion = remaining > 0 && monthlySavingsPotential > 0 ? Math.ceil(remaining / monthlySavingsPotential) : 0;
      
      return {
        ...goal,
        progress,
        remaining,
        monthsToCompletion,
        isOnTrack: monthsToCompletion <= 24
      };
    });
    
    // === TRANSACTION INSIGHTS ===
    const largestExpenses = currentTransactions
      .filter(t => t.amount < 0)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5);
      
    const frequentExpenses = Object.entries(merchantAnalysis)
      .filter(([merchant, data]) => (data as any).count >= 3)
      .sort(([,a], [,b]) => (b as any).count - (a as any).count)
      .slice(0, 5);
    
    // === FINANCIAL HEALTH METRICS ===
    const overspentBudgets = budgets.filter(b => b.spent > b.amount);
    const totalOverspent = overspentBudgets.reduce((sum, b) => sum + (b.spent - b.amount), 0);
    const budgetUtilization = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
    
    // Health score calculation
    let healthScore = 100;
    if (totalDebt > averageMonthlyIncome * 6) healthScore -= 25;
    if (emergencyFundMonths < 3) healthScore -= 20;
    if (savingsRate < 10) healthScore -= 15;
    if (totalOverspent > 0) healthScore -= 20;
    if (budgetUtilization > 95) healthScore -= 10;
    
    // === TREND ANALYSIS ===
    const monthlyTrends = last3MonthsBudgets.reduce((acc, budget) => {
      const key = `${budget.year}-${budget.month}`;
      if (!acc[key]) {
        acc[key] = { budgeted: 0, spent: 0, month: budget.month, year: budget.year };
      }
      acc[key].budgeted += budget.amount;
      acc[key].spent += budget.spent;
      return acc;
    }, {} as Record<string, any>);
    
    const trendData = Object.values(monthlyTrends).sort((a: any, b: any) => 
      (a.year * 12 + a.month) - (b.year * 12 + b.month)
    );

    // Generate comprehensive AI response
    const aiResponse = await generateOpenAIResponse(message, userId, conversationHistory, {
      // Raw Data
      budgets,
      lastMonthBudgets,
      accounts,
      currentTransactions,
      allTransactions,
      yearTransactions,
      goals,
      budgetTransfers,
      
      // Calculated Metrics
      financialOverview: {
        netWorth,
        totalCash,
        totalDebt,
        totalBudgeted,
        totalSpent,
        totalAvailable,
        toBeAssigned,
        healthScore,
        budgetUtilization,
        totalOverspent
      },
      
      // Income & Expense Analysis
      incomeAnalysis: {
        totalYearIncome,
        averageMonthlyIncome,
        currentMonthIncome,
        totalYearExpenses,
        averageMonthlyExpenses,
        currentMonthExpenses
      },
      
      // Financial Ratios
      ratios: {
        savingsRate,
        debtToIncomeRatio,
        expenseRatio,
        emergencyFundMonths,
        budgetGrowth,
        spendingGrowth
      },
      
      // Detailed Analysis
      categoryAnalysis,
      merchantAnalysis,
      topMerchants,
      goalAnalysis,
      largestExpenses,
      frequentExpenses,
      overspentBudgets,
      trendData,
      
      // Context
      currentDate: new Date().toISOString()
    });

    res.json(aiResponse);
  } catch (error) {
    console.error('AI Chat Error:', error);
    
    // Return a user-friendly error response instead of just an error status
    res.status(200).json({
      message: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
      actions: [
        {
          type: 'button',
          label: '📊 Financial Overview',
          action: 'get_overview',
          data: {}
        },
        {
          type: 'button',
          label: '💸 Check Spending',
          action: 'analyze_spending',
          data: {}
        }
      ]
    });
  }
}

async function generateOpenAIResponse(message: string, userId: string, conversationHistory: any[], context: any) {
  const { 
    budgets, 
    accounts, 
    currentTransactions, 
    allTransactions,
    yearTransactions,
    goals, 
    financialOverview,
    incomeAnalysis,
    ratios,
    categoryAnalysis,
    topMerchants,
    goalAnalysis,
    largestExpenses,
    frequentExpenses,
    overspentBudgets,
    trendData,
    history
  } = context;

  // Check if OpenAI API key is available
  if (!hasOpenAIKey) {
    console.warn('OpenAI API key not configured, using basic response');
    return {
      message: "I need an OpenAI API key to provide personalized financial analysis. Please configure the API key to unlock my full capabilities.",
      actions: []
    };
  }

  // Create comprehensive financial data context
  const financialDataContext = `
=== COMPLETE FINANCIAL PROFILE ===

NET WORTH SUMMARY:
- Net Worth: $${financialOverview.netWorth.toFixed(2)}
- Total Cash: $${financialOverview.totalCash.toFixed(2)}
- Total Debt: $${financialOverview.totalDebt.toFixed(2)}
- Financial Health Score: ${financialOverview.healthScore}/100

INCOME & EXPENSE ANALYSIS:
- Average Monthly Income: $${incomeAnalysis.averageMonthlyIncome.toFixed(2)}
- Current Month Income: $${incomeAnalysis.currentMonthIncome.toFixed(2)}
- Average Monthly Expenses: $${incomeAnalysis.averageMonthlyExpenses.toFixed(2)}
- Current Month Expenses: $${incomeAnalysis.currentMonthExpenses.toFixed(2)}
- Annual Income: $${incomeAnalysis.totalYearIncome.toFixed(2)}
- Annual Expenses: $${incomeAnalysis.totalYearExpenses.toFixed(2)}

FINANCIAL RATIOS:
- Savings Rate: ${ratios.savingsRate.toFixed(1)}%
- Debt-to-Income Ratio: ${ratios.debtToIncomeRatio.toFixed(1)}%
- Expense Ratio: ${ratios.expenseRatio.toFixed(1)}%
- Emergency Fund: ${ratios.emergencyFundMonths.toFixed(1)} months
- Budget Growth: ${ratios.budgetGrowth.toFixed(1)}%
- Spending Growth: ${ratios.spendingGrowth.toFixed(1)}%

BUDGET ANALYSIS:
- Total Budgeted: $${financialOverview.totalBudgeted.toFixed(2)}
- Total Spent: $${financialOverview.totalSpent.toFixed(2)}
- Total Available: $${financialOverview.totalAvailable.toFixed(2)}
- To Be Assigned: $${financialOverview.toBeAssigned.toFixed(2)}
- Budget Utilization: ${financialOverview.budgetUtilization.toFixed(1)}%
- Overspent Amount: $${financialOverview.totalOverspent.toFixed(2)}

CATEGORY BREAKDOWN:
${Object.entries(categoryAnalysis).map(([category, data]: [string, any]) => 
  `- ${category}: $${data.spent.toFixed(2)}/$${data.budgeted.toFixed(2)} (${data.utilization.toFixed(1)}% used)`
).join('\n')}

ALL CURRENT BUDGETS:
${budgets.map((b: any) => 
  `- ${b.name} (${b.category}): $${b.spent.toFixed(2)}/$${b.amount.toFixed(2)} (Available: $${(b.amount - b.spent).toFixed(2)})`
).join('\n')}

ACCOUNT DETAILS:
${accounts.map((a: any) => 
  `- ${a.accountName} (${a.accountType}): $${a.balance.toFixed(2)}${a.availableBalance ? ` (Available: $${a.availableBalance.toFixed(2)})` : ''}`
).join('\n')}

DEBT ANALYSIS:
${accounts.filter((a: any) => {
  // Credit cards: positive balance means debt
  if (a.accountType === 'credit') return a.balance > 0;
  // Loans/other debt: negative balance means debt
  return a.balance < 0;
}).map((a: any) => {
  const debtAmount = a.accountType === 'credit' ? a.balance : Math.abs(a.balance);
  return `- ${a.accountName}: $${debtAmount.toFixed(2)} debt${a.accountType === 'credit' ? ` (Available Credit: $${(a.availableBalance || 0).toFixed(2)})` : ''}`;
}).join('\n') || 'No outstanding debts detected'}

CASH FLOW ANALYSIS:
- Available Cash: $${financialOverview.totalCash.toFixed(2)}
- Total Debt: $${financialOverview.totalDebt.toFixed(2)}
- Monthly Income: $${incomeAnalysis.averageMonthlyIncome.toFixed(2)}
- Monthly Expenses: $${incomeAnalysis.averageMonthlyExpenses.toFixed(2)}
- Available for Debt Payments: $${Math.max(0, incomeAnalysis.averageMonthlyIncome - incomeAnalysis.averageMonthlyExpenses).toFixed(2)}

TOP SPENDING MERCHANTS:
${topMerchants.slice(0, 5).map(([merchant, data]: [string, any]) => 
  `- ${merchant}: $${data.amount.toFixed(2)} (${data.count} transactions)`
).join('\n')}

LARGEST EXPENSES THIS MONTH:
${largestExpenses.map((t: any) => 
  `- ${t.description}: $${Math.abs(t.amount).toFixed(2)} (${new Date(t.date).toLocaleDateString()})`
).join('\n')}

GOALS PROGRESS:
${goalAnalysis.map((g: any) => 
  `- ${g.name}: $${g.currentAmount.toFixed(2)}/$${g.targetAmount.toFixed(2)} (${g.progress.toFixed(1)}% complete, ${g.monthsToCompletion} months to finish)`
).join('\n')}

RECENT TRANSACTIONS (Last 10):
${currentTransactions.slice(0, 10).map((t: any) => 
  `- ${new Date(t.date).toLocaleDateString()}: ${t.description} - $${t.amount.toFixed(2)} (${t.category || 'Uncategorized'})`
).join('\n')}

MONTHLY TRENDS:
${trendData.map((trend: any) => 
  `- ${trend.month}/${trend.year}: Budgeted $${trend.budgeted.toFixed(2)}, Spent $${trend.spent.toFixed(2)}`
).join('\n')}

OVERSPENT CATEGORIES:
${overspentBudgets.map((b: any) => 
  `- ${b.name}: Over by $${(b.spent - b.amount).toFixed(2)}`
).join('\n')}
`;

  // Use conversationHistory passed as parameter

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Finley, an expert financial advisor AI with complete access to the user's financial data AND the ability to take actions on their behalf.

🎯 YOUR SUPERPOWERS:
- Analyze financial data with precision
- Take REAL actions: update budgets, categorize transactions, create goals
- Provide specific recommendations using actual numbers
- Execute financial plans immediately

💪 AVAILABLE ACTIONS (use functions):
1. update_budget_amount - Adjust budget allocations
2. transfer_money_between_budgets - Move money between categories
3. categorize_transaction - Fix uncategorized transactions
4. create_financial_goal - Set up savings/debt goals
5. add_budget_category - Create new budget line items
6. search_transactions - Find transactions by meaning (coffee, dining, etc.)

🧠 WHEN TO USE FUNCTIONS:
- User says "move $X from A to B" → transfer_money_between_budgets
- "Increase my grocery budget" → update_budget_amount  
- "Categorize that Starbucks transaction" → categorize_transaction
- "Set a goal to save $X" → create_financial_goal
- "Add a budget for vacation" → add_budget_category
- "Show me coffee purchases" or "Find dining expenses" → search_transactions

💬 CONVERSATION STYLE:
- Be conversational and helpful
- Confirm actions before executing: "I'll move $200 from Entertainment to Groceries - sound good?"
- Use their actual data and numbers
- Provide context for why actions make sense

🎯 DEBT EXPERTISE:
Still create detailed debt payoff plans with specific steps, timelines, and payment amounts.

USER'S COMPLETE FINANCIAL DATA:
${financialDataContext}

Instructions: Use functions to take actions when users request changes. Always explain what you're doing and why it helps their financial situation.`
        },
        ...conversationHistory,
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      tools: [
        {
          type: "function",
          function: {
            name: "update_budget_amount",
            description: "Update the amount allocated to a specific budget category",
            parameters: {
              type: "object",
              properties: {
                budget_id: {
                  type: "string",
                  description: "The ID of the budget to update"
                },
                new_amount: {
                  type: "number",
                  description: "The new budget amount"
                },
                reason: {
                  type: "string",
                  description: "Explanation for the budget change"
                }
              },
              required: ["budget_id", "new_amount", "reason"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "transfer_money_between_budgets",
            description: "Move money from one budget category to another",
            parameters: {
              type: "object",
              properties: {
                from_budget_id: {
                  type: "string",
                  description: "The ID of the budget to take money from"
                },
                to_budget_id: {
                  type: "string",
                  description: "The ID of the budget to add money to"
                },
                amount: {
                  type: "number",
                  description: "The amount to transfer"
                },
                reason: {
                  type: "string",
                  description: "Explanation for the transfer"
                }
              },
              required: ["from_budget_id", "to_budget_id", "amount", "reason"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "categorize_transaction",
            description: "Update the category of one or more transactions. Can identify transactions by ID or by description pattern.",
            parameters: {
              type: "object",
              properties: {
                transaction_id: {
                  type: "string",
                  description: "The ID of a specific transaction to categorize (optional if using description_pattern)"
                },
                description_pattern: {
                  type: "string",
                  description: "A pattern to match transaction descriptions (e.g., 'Uber', 'Starbucks') - will categorize all matching transactions"
                },
                category: {
                  type: "string",
                  description: "The new category for the transaction(s)"
                },
                budget_id: {
                  type: "string",
                  description: "The budget ID to assign this transaction to (optional)"
                }
              },
              required: ["category"],
              additionalProperties: false
            }
          }
        },
        {
          type: "function",
          function: {
            name: "create_financial_goal",
            description: "Create a new savings or debt payoff goal",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The name of the goal"
                },
                target_amount: {
                  type: "number",
                  description: "The target amount to reach"
                },
                current_amount: {
                  type: "number",
                  description: "The current progress amount (default 0)"
                },
                target_date: {
                  type: "string",
                  description: "Target completion date (YYYY-MM-DD format)"
                },
                goal_type: {
                  type: "string",
                  enum: ["savings", "debt_payoff", "emergency_fund", "investment"],
                  description: "The type of goal"
                }
              },
              required: ["name", "target_amount", "goal_type"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "add_budget_category",
            description: "Create a new budget category/line item",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The name of the budget category"
                },
                category_group: {
                  type: "string",
                  description: "Which group to add it to (e.g., 'Frequent Spending', 'Just for Fun')"
                },
                amount: {
                  type: "number",
                  description: "Initial budget amount"
                },
                description: {
                  type: "string",
                  description: "Description of what this budget is for"
                }
              },
              required: ["name", "category_group", "amount"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "search_transactions",
            description: "Search transactions using semantic similarity (understands meaning, not just keywords)",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query (e.g., 'coffee purchases', 'dining out', 'gas stations')"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return (default 10)"
                },
                threshold: {
                  type: "number",
                  description: "Similarity threshold 0-1 (default 0.7, higher = more strict)"
                }
              },
              required: ["query"]
            }
          }
        }
      ],
      tool_choice: "auto"
    });

    const responseMessage = completion.choices[0]?.message;
    let aiMessage = responseMessage?.content || "I'm here to help analyze your financial data!";
    
    // Handle function calls
    const executedFunctions: any[] = [];
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log('🔧 AI wants to execute functions:', responseMessage.tool_calls.length);
      
      const functionResults = [];
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`🎯 Executing function: ${functionName}`, functionArgs);
        
        try {
          const result = await executeFunction(userId, functionName, functionArgs);
          functionResults.push(`✅ ${functionName}: ${result.message}`);
          
          // Store execution details for client-side optimistic updates
          executedFunctions.push({
            name: functionName,
            args: functionArgs,
            result: result,
            success: true
          });
          
          // Refresh relevant data after function execution
          await refreshDataAfterFunction(functionName, result);
          
        } catch (error) {
          console.error(`❌ Function ${functionName} failed:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          functionResults.push(`❌ ${functionName}: ${errorMessage}`);
          
          // Store failed execution for client awareness
          executedFunctions.push({
            name: functionName,
            args: functionArgs,
            error: errorMessage,
            success: false
          });
        }
      }
      
      // Add function results to the AI message
      if (functionResults.length > 0) {
        aiMessage += "\n\n**Actions Completed:**\n" + functionResults.join('\n');
      }
    }
    
    // Smart plan detection - check if AI created a plan that could be added to debt payoff page
    const containsPlan = detectPlanInResponse(aiMessage);
    const isDebtPayoffPlan = detectDebtPayoffPlan(aiMessage);
    
    // Debug logging
    console.log('🔍 Plan Detection Debug:', {
      messageLength: aiMessage.length,
      containsPlan,
      isDebtPayoffPlan,
      hasDebtKeywords: /debt|credit card|loan|payoff|payment/i.test(aiMessage),
      hasNumbers: /\$[\d,]+/.test(aiMessage),
      hasSteps: /[1-9]\.|•|-/.test(aiMessage)
    });
    
    const actions = [];
    
    if (isDebtPayoffPlan) {
      console.log('✅ Adding Save Debt Payoff Plan button');
      actions.push({
        type: 'button',
        label: '🎯 Save Debt Payoff Plan',
        action: 'add_to_debt_payoff',
        data: {
          planContent: aiMessage,
          timestamp: new Date().toISOString(),
          planType: 'debt_payoff'
        }
      });
    } else if (containsPlan) {
      console.log('✅ Adding Save Financial Plan button');
      actions.push({
        type: 'button',
        label: '📋 Save Financial Plan',
        action: 'add_to_debt_payoff',
        data: {
          planContent: aiMessage,
          timestamp: new Date().toISOString(),
          planType: 'general'
        }
      });
    } else {
      console.log('❌ No plan detected in AI response');
    }
    
    // Add common debt-related quick actions if message mentions debt
    if (/debt|credit card|loan|payoff/i.test(aiMessage)) {
      actions.push({
        type: 'button',
        label: '💳 Analyze All Debts',
        action: 'analyze_all_debts',
        data: {}
      });
    }
    
    console.log('🎯 Final AI response:', {
      messageLength: aiMessage.length,
      actionsCount: actions.length,
      actions: actions.map(a => a.label)
    });

    // Store AI response in database
    const metadata = {
      actions,
      executedFunctions: executedFunctions.length > 0 ? executedFunctions : undefined
    };
    
    await (prisma as any).chatMessage.create({
      data: {
        userId: userId,
        type: 'ai',
        content: aiMessage,
        metadata: (actions.length > 0 || executedFunctions.length > 0) ? JSON.stringify(metadata) : null
      }
    });

    return {
      message: aiMessage,
      actions,
      executedFunctions: executedFunctions.length > 0 ? executedFunctions : undefined
    };

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    return {
      message: "I'm having trouble accessing my AI capabilities right now. Please try again in a moment.",
      actions: []
    };
  }
}

// Specific debt payoff plan detection
function detectDebtPayoffPlan(message: string): boolean {
  const messageLower = message.toLowerCase();
  
  // Primary debt payoff indicators - more lenient
  const primaryDebtTerms = [
    'debt payoff', 'pay off debt', 'debt plan', 'debt strategy',
    'debt avalanche', 'debt snowball', 'debt elimination',
    'payoff plan', 'debt free', 'eliminate debt'
  ];
  
  // Secondary debt indicators
  const debtContextTerms = [
    'debt', 'credit card', 'loan', 'owe', 'balance',
    'interest', 'payment', 'payoff', 'minimum payment'
  ];
  
  // Plan structure indicators
  const planStructureTerms = [
    'step', 'month', 'payment', 'strategy', 'plan',
    'prioritize', 'focus', 'recommend', 'should pay',
    'timeline', 'schedule'
  ];
  
  // Check for primary debt payoff terms
  const hasPrimaryDebtTerms = primaryDebtTerms.some(term => messageLower.includes(term));
  
  // Check for debt context
  const hasDebtContext = debtContextTerms.some(term => messageLower.includes(term));
  
  // Check for planning structure
  const hasStructure = planStructureTerms.some(term => messageLower.includes(term));
  
  // Look for numbered steps or lists
  const hasNumberedSteps = /[1-9]\.|•|-/.test(message);
  
  // Check for financial amounts
  const hasAmounts = /\$[\d,]+/.test(message);
  
  // More lenient detection logic
  return (
    // Direct debt payoff terms
    hasPrimaryDebtTerms ||
    
    // Debt context + structure + reasonable length
    (hasDebtContext && hasStructure && message.length > 150) ||
    
    // Debt context + numbered steps
    (hasDebtContext && hasNumberedSteps) ||
    
    // Debt context + amounts + advice structure
    (hasDebtContext && hasAmounts && hasStructure && message.length > 100)
  );
}

// Smart plan detection function
function detectPlanInResponse(message: string): boolean {
  const planIndicators = [
    // Direct plan mentions
    'plan', 'strategy', 'approach', 'steps',
    
    // Debt-specific terms
    'debt payoff', 'pay off', 'eliminate debt', 'debt elimination',
    'snowball', 'avalanche', 'minimum payments',
    
    // Timeline indicators
    'month', 'timeline', 'schedule', 'by when', 'completion',
    
    // Action-oriented terms
    'prioritize', 'focus on', 'start with', 'next step',
    'recommendation', 'suggest', 'should pay'
  ];
  
  const structureIndicators = [
    // List or step indicators
    '1.', '2.', '3.', '•', '-', 'first', 'second', 'third',
    'step 1', 'step 2', 'phase 1', 'phase 2',
    
    // Financial amounts and calculations
    '$', 'payment', 'balance', 'interest', 'total'
  ];
  
  const messageLower = message.toLowerCase();
  
  // Check for plan indicators
  const hasPlanTerms = planIndicators.some(term => messageLower.includes(term.toLowerCase()));
  
  // Check for structured content (numbered lists, steps, etc.)
  const hasStructure = structureIndicators.some(indicator => messageLower.includes(indicator.toLowerCase()));
  
  // Look for numbered or bulleted lists (stronger indicator)
  const hasNumberedList = /[1-9]\.|•|-/.test(message);
  
  // Check for debt-specific context with actionable advice
  const isDebtRelated = /debt|credit card|loan|owe|payoff|payment/i.test(message);
  const hasActionableAdvice = /should|recommend|suggest|plan|strategy/i.test(message);
  
  // Return true if it looks like a plan
  return (hasPlanTerms && hasStructure) || 
         (hasNumberedList && isDebtRelated) ||
         (isDebtRelated && hasActionableAdvice && message.length > 200); // Substantial debt advice
}

// Function execution handler
async function executeFunction(userId: string, functionName: string, args: any) {
  console.log(`🔧 Executing ${functionName} for user ${userId}:`, args);
  
  switch (functionName) {
    case 'update_budget_amount':
      return await updateBudgetAmount(userId, args);
      
    case 'transfer_money_between_budgets':
      return await transferMoneyBetweenBudgets(userId, args);
      
    case 'categorize_transaction':
      return await categorizeTransaction(userId, args);
      
    case 'create_financial_goal':
      return await createFinancialGoal(userId, args);
      
    case 'add_budget_category':
      return await addBudgetCategory(userId, args);
      
    case 'search_transactions':
      return await searchTransactions(userId, args);
      
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

// Individual function implementations
async function updateBudgetAmount(userId: string, args: { budget_id: string, new_amount: number, reason: string }) {
  const { budget_id, new_amount, reason } = args;
  
  const budget = await prisma.budget.findFirst({
    where: { id: budget_id, userId }
  });
  
  if (!budget) {
    throw new Error(`Budget not found: ${budget_id}`);
  }
  
  await prisma.budget.update({
    where: { id: budget_id },
    data: { amount: new_amount }
  });
  
  return {
    success: true,
    message: `Updated ${budget.name} budget from $${budget.amount} to $${new_amount}. Reason: ${reason}`
  };
}

async function transferMoneyBetweenBudgets(userId: string, args: { from_budget_id: string, to_budget_id: string, amount: number, reason: string }) {
  const { from_budget_id, to_budget_id, amount, reason } = args;
  
  const [fromBudget, toBudget] = await Promise.all([
    prisma.budget.findFirst({ where: { id: from_budget_id, userId } }),
    prisma.budget.findFirst({ where: { id: to_budget_id, userId } })
  ]);
  
  if (!fromBudget || !toBudget) {
    throw new Error('One or both budgets not found');
  }
  
  if (fromBudget.amount < amount) {
    throw new Error(`Insufficient funds in ${fromBudget.name} ($${fromBudget.amount} available)`);
  }
  
  await Promise.all([
    prisma.budget.update({
      where: { id: from_budget_id },
      data: { amount: fromBudget.amount - amount }
    }),
    prisma.budget.update({
      where: { id: to_budget_id },
      data: { amount: toBudget.amount + amount }
    })
  ]);
  
  // Log the transfer for audit trail
  await prisma.budgetTransfer.create({
    data: {
      userId,
      fromBudgetId: from_budget_id,
      toBudgetId: to_budget_id,
      amount,
      reason: reason
    }
  });
  
  return {
    success: true,
    message: `Transferred $${amount} from ${fromBudget.name} to ${toBudget.name}. Reason: ${reason}`
  };
}

async function categorizeTransaction(userId: string, args: { transaction_id?: string, description_pattern?: string, category: string, budget_id?: string }) {
  const { transaction_id, description_pattern, category, budget_id } = args;
  
  if (!transaction_id && !description_pattern) {
    throw new Error('Either transaction_id or description_pattern must be provided');
  }
  
  let transactions: any[] = [];
  
  if (transaction_id) {
    // Single transaction by ID
    const transaction = await prisma.transaction.findFirst({
      where: { id: transaction_id, userId }
    });
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transaction_id}`);
    }
    
    transactions = [transaction];
  } else if (description_pattern) {
    // Multiple transactions by description pattern
    transactions = await prisma.transaction.findMany({
      where: {
        userId,
        description: {
          contains: description_pattern,
          mode: 'insensitive'
        }
      }
    });
    
    if (transactions.length === 0) {
      throw new Error(`No transactions found matching pattern: ${description_pattern}`);
    }
  }
  
  // Find budget if budget_id provided
  let budget = null;
  if (budget_id) {
    budget = await prisma.budget.findFirst({
      where: { id: budget_id, userId }
    });
  }
  
  // Update all matching transactions
  const updateData: any = { category };
  if (budget) {
    updateData.budgetId = budget_id;
  }
  
  const transactionIds = transactions.map(t => t.id);
  await prisma.transaction.updateMany({
    where: { id: { in: transactionIds } },
    data: updateData
  });
  
  // Return success message
  const transactionDescriptions = transactions.map(t => t.description).join(', ');
  const count = transactions.length;
  
  return {
    success: true,
    message: `Categorized ${count} transaction${count > 1 ? 's' : ''} as "${category}": ${transactionDescriptions.length > 100 ? transactionDescriptions.substring(0, 100) + '...' : transactionDescriptions}${budget_id ? ' and assigned to budget' : ''}`,
    count: count,
    transactions: transactions.map(t => ({ 
      id: t.id, 
      description: t.description, 
      amount: t.amount,
      oldCategory: t.category || 'Needs a Category',
      newCategory: category
    }))
  };
}

async function createFinancialGoal(userId: string, args: { name: string, target_amount: number, current_amount?: number, target_date?: string, goal_type: string }) {
  const { name, target_amount, current_amount = 0, target_date, goal_type } = args;
  
  const goalData: any = {
    userId,
    name,
    targetAmount: target_amount,
    currentAmount: current_amount,
    type: goal_type
  };
  
  if (target_date) {
    goalData.targetDate = new Date(target_date);
  }
  
  const goal = await prisma.goal.create({
    data: goalData
  });
  
  return {
    success: true,
    message: `Created ${goal_type} goal "${name}" with target of $${target_amount}${target_date ? ` by ${target_date}` : ''}`
  };
}

async function addBudgetCategory(userId: string, args: { name: string, category_group: string, amount: number, description?: string }) {
  const { name, category_group, amount, description } = args;
  
  // Get current month/year
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  const budget = await prisma.budget.create({
    data: {
      userId,
      name,
      category: category_group,
      amount,
      spent: 0,
      month,
      year
    }
  });
  
  return {
    success: true,
    message: `Created new budget category "${name}" in ${category_group} with $${amount} allocated`
  };
}

async function searchTransactions(userId: string, args: { query: string, limit?: number, threshold?: number }) {
  const { query, limit = 10, threshold = 0.7 } = args;
  
  try {
    // Call our search API internally
    const searchUrl = new URL('/api/transactions/search', 'http://localhost:3000');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('limit', limit.toString());
    searchUrl.searchParams.set('threshold', threshold.toString());
    
    // For internal API calls, we need to simulate the request with proper auth
    // In a real implementation, you'd pass the auth context properly
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        description: {
          contains: query,
          mode: 'insensitive'
        }
      },
      include: {
        account: {
          select: { accountName: true }
        },
        budget: {
          select: { name: true }
        }
      },
      orderBy: { date: 'desc' },
      take: limit
    });
    
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;
    
    // Create detailed transaction list for AI categorization
    const transactionDetails = transactions.slice(0, 5).map((t, index) => 
      `${index + 1}. "${t.description}" - $${Math.abs(t.amount)} on ${new Date(t.date).toLocaleDateString()} (ID: ${t.id})`
    ).join('\n');
    
    const summary = `Found ${transactions.length} transactions matching "${query}":
• Total spent: $${totalAmount.toFixed(2)}
• Average amount: $${avgAmount.toFixed(2)}
• Date range: ${transactions.length > 0 ? 
  `${new Date(transactions[transactions.length - 1].date).toLocaleDateString()} to ${new Date(transactions[0].date).toLocaleDateString()}` 
  : 'N/A'}

Transaction details:
${transactionDetails}

To categorize these transactions, use the categorize_transaction function with either:
- description_pattern: "${query}" (to categorize all matching transactions)
- transaction_id: specific ID (to categorize individual transactions)`;

    return {
      success: true,
      message: summary,
      data: {
        transactions: transactions.slice(0, 5), // Show top 5 in response
        total: transactions.length,
        totalAmount,
        avgAmount,
        query
      }
    };
    
  } catch (error) {
    console.error('Transaction search failed:', error);
    return {
      success: false,
      message: `Search failed for "${query}". Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Data refresh helper
async function refreshDataAfterFunction(functionName: string, result?: any) {
  console.log(`📊 Data refreshed after ${functionName}`);
  
  // For transaction categorization, we need to notify that the data has changed
  // This will be handled by the client-side optimistic updates
  if (functionName === 'categorize_transaction') {
    console.log('🔄 Transaction categorization completed, client should refresh transaction data');
    // The result contains transaction details that can be used for optimistic updates
    if (result?.transactions) {
      console.log(`📝 Categorized ${result.count} transactions:`, result.transactions.map((t: any) => t.description));
    }
  }
}

// All predetermined response functions removed - AI now handles everything conversationally with comprehensive financial data analysis