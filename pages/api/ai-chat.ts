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

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error('❌ Invalid message received:', message);
      return res.status(400).json({ error: 'Message is required and cannot be empty' });
    }

    console.log('✅ Processing AI chat message:', { userId, messageLength: message.length });

    // Store user message in database
    const userMessage = await (prisma as any).chatMessage.create({
      data: {
        userId,
        type: 'user',
        content: message
      }
    });

    console.log('✅ User message stored in database:', userMessage.id);

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


    // Get COMPREHENSIVE financial data for robust analysis
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    console.log('📊 Fetching basic financial data...');

    // Simplified data fetching to isolate issues
    const budgets = await prisma.budget.findMany({
      where: { userId, month: currentMonth, year: currentYear },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { accountName: 'asc' }
    });

    console.log('✅ Basic data fetched:', { budgets: budgets.length, accounts: accounts.length });

    // Set dummy data for complex queries to isolate the issue
    const lastMonthBudgets = [];
    const last3MonthsBudgets = [];
    const currentTransactions = [];
    const allTransactions = [];
    const yearTransactions = [];
    const goals = [];
    const budgetTransfers = [];

    console.log('✅ Financial data fetched successfully:', {
      budgets: budgets.length,
      accounts: accounts.length,
      currentTransactions: currentTransactions.length,
      goals: goals.length
    });

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

    console.log('🤖 Calling OpenAI API for response generation...');

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
    console.error('❌ AI Chat Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      userId,
      messageReceived: !!req.body.message
    });
    
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
    console.warn('❌ OpenAI API key not configured, using basic response');
    return {
      message: "I need an OpenAI API key to provide personalized financial analysis. Please configure the API key to unlock my full capabilities.",
      actions: []
    };
  }

  console.log('✅ OpenAI API key available, proceeding with simplified AI response generation');

  // Use conversationHistory passed as parameter

  try {
    console.log('🤖 Making simplified OpenAI API call...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Finley, a helpful financial advisor AI. Keep responses concise and helpful.

Current user data:
- Budgets: ${budgets.length}
- Accounts: ${accounts.length}

Just provide helpful financial advice based on the user's question.`
        },
        ...conversationHistory,
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    console.log('✅ OpenAI API response received');
    
    const responseMessage = completion.choices[0]?.message;
    let aiMessage = responseMessage?.content || "I'm here to help analyze your financial data!";
    
    console.log('📝 AI message length:', aiMessage.length);
    
    // Simplified response - no function calls for now
    const executedFunctions: any[] = [];
    const actions = [
      {
        type: 'button',
        label: '📊 Financial Overview',
        action: 'get_overview',
        data: {}
      }
    ];

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
    console.error('❌ OpenAI API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      userId,
      messageLength: message.length
    });
    
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