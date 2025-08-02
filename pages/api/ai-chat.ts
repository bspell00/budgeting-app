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
    const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.abs(Math.min(0, a.balance)), 0);
    const netWorth = totalCash - totalDebt;
    
    // === INCOME ANALYSIS ===
    const incomeTransactions = yearTransactions.filter(t => t.amount > 0 && !['Transfer', 'Credit Card Payment', 'Payment', 'Deposit'].includes(t.category));
    const totalYearIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const averageMonthlyIncome = totalYearIncome / 12;
    const currentMonthIncome = currentTransactions.filter(t => t.amount > 0 && !['Transfer', 'Credit Card Payment'].includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    
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
    const aiResponse = await generateOpenAIResponse(message, {
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
      history,
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

async function generateOpenAIResponse(message: string, context: any) {
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
  `- ${a.accountName} (${a.accountType}): $${a.balance.toFixed(2)}`
).join('\n')}

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

  // Create conversation history
  const conversationHistory = history.slice(-6).map((msg: any) => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert financial advisor with complete access to the user's financial data. You can answer ANY question about their finances with specific, detailed analysis using their actual data.

CAPABILITIES:
- Analyze spending patterns and trends
- Calculate financial ratios and health metrics  
- Provide budget recommendations
- Forecast cash flow and savings
- Compare periods and track progress
- Identify opportunities and risks
- Answer specific financial questions with exact data

RESPONSE STYLE:
- Use specific dollar amounts and percentages from their data
- Reference actual account names, budget categories, and transactions
- Be conversational but thorough
- Provide actionable insights and recommendations
- Use the user's actual financial data to support all statements

USER'S COMPLETE FINANCIAL DATA:
${financialDataContext}

Instructions: Answer the user's question using their specific financial data. Be direct, helpful, and provide concrete insights based on their actual numbers. Don't give generic advice - use their real data to provide personalized analysis.`
        },
        ...conversationHistory,
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.3, // Lower temperature for more focused responses
    });

    const aiMessage = completion.choices[0]?.message?.content || "I'm here to help analyze your financial data!";
    
    // Smart plan detection - check if AI created a plan that could be added to debt payoff page
    const containsPlan = detectPlanInResponse(aiMessage);
    const actions = [];
    
    if (containsPlan) {
      actions.push({
        type: 'button',
        label: '📋 Add this plan to debt payoff page',
        action: 'add_to_debt_payoff',
        data: {
          planContent: aiMessage,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    return {
      message: aiMessage,
      actions
    };

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    return {
      message: "I'm having trouble accessing my AI capabilities right now. Please try again in a moment.",
      actions: []
    };
  }
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

// All predetermined response functions removed - AI now handles everything conversationally with comprehensive financial data analysis