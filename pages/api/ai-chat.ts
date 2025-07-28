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

    // Get user's comprehensive financial data for analysis
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const [budgets, lastMonthBudgets, accounts, currentTransactions, allTransactions, goals] = await Promise.all([
      // Current month budgets
      prisma.budget.findMany({
        where: { userId, month: currentMonth, year: currentYear },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      }),
      // Last month budgets for comparison
      prisma.budget.findMany({
        where: { userId, month: lastMonth, year: lastMonthYear },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      }),
      // All accounts
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
        include: { account: true },
        orderBy: { date: 'desc' },
      }),
      // Last 3 months of transactions for trend analysis
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: new Date(currentYear, currentMonth - 4, 1), // Last 3 months
            lt: new Date(currentYear, currentMonth, 1),
          },
        },
        include: { account: true },
        orderBy: { date: 'desc' },
      }),
      // Goals
      prisma.goal.findMany({
        where: { userId },
        orderBy: { name: 'asc' }
      })
    ]);

    // COMPREHENSIVE FINANCIAL PROFILE ANALYSIS
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const toBeAssigned = totalBalance - totalBudgeted;
    
    // Calculate last month comparison
    const lastMonthBudgeted = lastMonthBudgets.reduce((sum, b) => sum + b.amount, 0);
    const lastMonthSpent = lastMonthBudgets.reduce((sum, b) => sum + b.spent, 0);
    
    // OVERSPENDING ANALYSIS
    const overspentBudgets = budgets.filter(b => (b.amount - b.spent) < 0);
    const totalOverspent = overspentBudgets.reduce((sum, b) => sum + Math.abs(b.amount - b.spent), 0);
    
    // YNAB-STYLE FOUR RULES ANALYSIS
    const rule1_GiveEveryDollarAJob = toBeAssigned === 0;
    const rule2_EmbraceRealExpenses = goals.filter(g => g.type === 'savings').length > 0;
    const rule3_RollWithPunches = overspentBudgets.length === 0;
    const rule4_AgeYourMoney = calculateAgeOfMoney(allTransactions);
    
    // DETAILED SPENDING ANALYSIS BY CATEGORY
    const spendingByCategory = budgets.reduce((acc, budget) => {
      const category = budget.category || 'Other';
      if (!acc[category]) {
        acc[category] = { 
          budgeted: 0, 
          spent: 0, 
          available: 0, 
          budgetCount: 0,
          performance: 'good'
        };
      }
      acc[category].budgeted += budget.amount;
      acc[category].spent += budget.spent;
      acc[category].available += (budget.amount - budget.spent);
      acc[category].budgetCount += 1;
      
      // Performance scoring
      const utilization = budget.amount > 0 ? (budget.spent / budget.amount) : 0;
      if (utilization > 1.1) acc[category].performance = 'overspent';
      else if (utilization > 0.9) acc[category].performance = 'high-usage';
      else if (utilization < 0.3) acc[category].performance = 'underutilized';
      
      return acc;
    }, {} as Record<string, any>);
    
    // ACCOUNT TYPE ANALYSIS
    const cashAccounts = accounts.filter(a => a.accountType === 'depository' || a.accountType === 'investment');
    const creditAccounts = accounts.filter(a => a.accountType === 'credit');
    const totalCash = cashAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
    const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);
    
    // TRANSACTION PATTERN ANALYSIS
    const largestTransactions = currentTransactions
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5);
    
    const frequentMerchants = analyzeFrequentMerchants(currentTransactions);
    const spendingTrends = analyzeSpendingTrends(allTransactions, currentMonth, currentYear);
    const unusualTransactions = findUnusualTransactions(currentTransactions, allTransactions);
    
    // INCOME AND SAVINGS ANALYSIS
    const monthlyIncome = currentTransactions
      .filter(t => t.amount > 0 && !['Transfer', 'Credit Card Payment'].includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0);
    const monthlySavings = totalBudgeted - totalSpent;
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
    
    // FINANCIAL HEALTH SCORING
    const financialHealthScore = calculateFinancialHealthScore({
      savingsRate,
      debtToIncomeRatio: monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) * 100 : 0,
      emergencyFund: goals.find(g => g.name.toLowerCase().includes('emergency')),
      budgetUtilization: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
      overspendingAmount: totalOverspent
    });
    
    // GOAL PROGRESS AND PROJECTIONS
    const goalAnalysis = goals.map(goal => {
      const monthsToTarget = goal.targetAmount > goal.currentAmount ? 
        Math.ceil((goal.targetAmount - goal.currentAmount) / (monthlySavings / goals.length)) : 0;
      return {
        ...goal,
        progressPercentage: goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0,
        monthsToTarget,
        onTrack: monthsToTarget <= 12
      };
    });
    
    // BUDGET EFFICIENCY ANALYSIS
    const budgetEfficiency = analyzeBudgetEfficiency(budgets, currentTransactions);
    
    // PREDICTIVE INSIGHTS
    const predictedOverspending = predictOverspending(budgets, spendingTrends);
    const cashFlowForecast = forecastCashFlow(accounts, budgets, spendingTrends);
    
    // PERSONALIZED RECOMMENDATIONS ENGINE
    const personalizedRecommendations = generatePersonalizedRecommendations({
      budgets,
      accounts,
      goals,
      transactions: currentTransactions,
      spendingTrends,
      overspentBudgets,
      savingsRate,
      totalDebt,
      monthlyIncome,
      financialHealthScore
    });

    // Generate AI response using OpenAI
    const aiResponse = await generateOpenAIResponse(message, {
      budgets,
      lastMonthBudgets,
      accounts,
      transactions: currentTransactions,
      allTransactions,
      goals,
      summary: { 
        totalBudgeted, 
        totalSpent, 
        totalBalance, 
        toBeAssigned,
        lastMonthBudgeted,
        lastMonthSpent,
        totalCash,
        totalDebt,
        savingsRate,
        monthlyIncome,
        monthlySavings,
        financialHealthScore
      },
      analysis: {
        spendingByCategory,
        overspentBudgets,
        totalOverspent,
        largestTransactions,
        frequentMerchants,
        spendingTrends,
        unusualTransactions,
        budgetEfficiency,
        predictedOverspending,
        cashFlowForecast,
        goalAnalysis,
        personalizedRecommendations
      },
      ynabRules: {
        rule1_GiveEveryDollarAJob,
        rule2_EmbraceRealExpenses,
        rule3_RollWithPunches,
        rule4_AgeYourMoney
      },
      history
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
  const { budgets, lastMonthBudgets, accounts, transactions, allTransactions, goals, summary, analysis, history } = context;

  // Check if OpenAI API key is available
  if (!hasOpenAIKey) {
    console.warn('OpenAI API key not configured, using fallback responses');
    return generateFallbackResponse(message, context);
  }

  console.log('OpenAI API Key configured:', hasOpenAIKey);
  console.log('Making OpenAI API request for message:', message.substring(0, 50) + '...');

  // Handle special button actions first
  if (message === 'get_overview') {
    return handleOverviewIntent(summary, budgets, accounts);
  }

  if (message === 'analyze_spending') {
    return handleSpendingAnalysisIntent(budgets, transactions);
  }

  // Create comprehensive financial context for OpenAI
  const financialContext = `
FINANCIAL OVERVIEW:
- Total Net Worth: $${(summary.totalCash - summary.totalDebt).toFixed(2)}
- Cash Available: $${summary.totalCash.toFixed(2)}
- Total Debt: $${summary.totalDebt.toFixed(2)}
- Monthly Savings Rate: ${summary.savingsRate.toFixed(1)}%
- To Be Assigned: $${summary.toBeAssigned.toFixed(2)}

THIS MONTH'S BUDGET PERFORMANCE:
- Budgeted: $${summary.totalBudgeted.toFixed(2)}
- Spent: $${summary.totalSpent.toFixed(2)} (${summary.totalBudgeted > 0 ? ((summary.totalSpent / summary.totalBudgeted) * 100).toFixed(1) : 0}%)
- Remaining: $${(summary.totalBudgeted - summary.totalSpent).toFixed(2)}
${analysis.overspentBudgets.length > 0 ? `- OVERSPENT: ${analysis.overspentBudgets.length} categories, $${analysis.totalOverspent.toFixed(2)} total` : '- No overspending ✅'}

MONTH-OVER-MONTH COMPARISON:
- Spending Change: ${summary.lastMonthSpent > 0 ? ((summary.totalSpent - summary.lastMonthSpent) / summary.lastMonthSpent * 100).toFixed(1) : 'N/A'}% vs last month
- Budget Change: ${summary.lastMonthBudgeted > 0 ? ((summary.totalBudgeted - summary.lastMonthBudgeted) / summary.lastMonthBudgeted * 100).toFixed(1) : 'N/A'}% vs last month

SPENDING BY CATEGORY:
${Object.entries(analysis.spendingByCategory).map(([category, data]: [string, any]) => 
  `- ${category}: $${data.spent.toFixed(2)}/$${data.budgeted.toFixed(2)} (${data.budgeted > 0 ? ((data.spent / data.budgeted) * 100).toFixed(0) : 0}%)`
).join('\n')}

ALL BUDGETS (${budgets.length}):
${budgets.map((b: any) => 
  `- ${b.name} (${b.category}): Budgeted $${b.amount}, Spent $${b.spent}, Available $${(b.amount - b.spent).toFixed(2)} ${b.amount - b.spent < 0 ? '⚠️' : '✅'}`
).join('\n')}

ACCOUNTS:
${accounts.map((a: any) => 
  `- ${a.accountName} (${a.accountType}): $${a.balance.toFixed(2)}`
).join('\n')}

RECENT TRANSACTIONS (${transactions.length} this month):
${transactions.slice(0, 10).map((t: any) => 
  `- ${t.description}: $${t.amount.toFixed(2)} → ${t.category || 'Uncategorized'} (${new Date(t.date).toLocaleDateString()})`
).join('\n')}

LARGEST TRANSACTIONS THIS MONTH:
${analysis.largestTransactions.map((t: any) => 
  `- ${t.description}: $${Math.abs(t.amount).toFixed(2)} (${t.category || 'Uncategorized'})`
).join('\n')}

GOALS (${goals.length}):
${goals.map((g: any) => {
  const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount * 100).toFixed(1) : '0';
  return `- ${g.name}: $${g.currentAmount}/$${g.targetAmount} (${progress}% complete) - ${g.type}`;
}).join('\n')}

FINANCIAL INSIGHTS:
- Monthly Income: $${summary.monthlyIncome.toFixed(2)}
- Monthly Savings: $${summary.monthlySavings.toFixed(2)}
- Debt-to-Cash Ratio: ${summary.totalCash > 0 ? (summary.totalDebt / summary.totalCash * 100).toFixed(1) : 'N/A'}%
- Emergency Fund: ${goals.find((g: any) => g.name.toLowerCase().includes('emergency')) ? 'Yes' : 'No'}
  `;

  // Create conversation history for context
  const conversationHistory = history.slice(-4).map((msg: any) => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  try {
    console.log('Calling OpenAI API with model gpt-4o-mini...');
    console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('Message length:', message.length);
    console.log('Context keys:', Object.keys(context));
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Finley, an expert financial analyst and advisor for a YNAB-style budgeting app. You have full access to the user's financial data and can answer ANY question about their finances with detailed analysis.

PERSONALITY: Be friendly, insightful, and thorough. Provide specific numbers and actionable advice. Use occasional emojis for emphasis.

CORE CAPABILITIES:
🔍 FINANCIAL ANALYSIS:
- Spending pattern analysis and trends
- Budget performance evaluation  
- Cash flow analysis and forecasting
- Debt-to-income ratios and payoff strategies
- Savings rate optimization
- Emergency fund adequacy assessment
- Category-wise spending breakdowns
- Month-over-month comparisons

💡 INTELLIGENT INSIGHTS:
- Identify spending anomalies and patterns
- Suggest budget optimizations
- Recommend savings opportunities
- Predict future cash flow
- Alert to potential problems
- Goal progress tracking and optimization
- Personalized recommendations based on financial behavior
- YNAB methodology guidance and best practices

🎯 DIRECT QUESTION ANSWERING:
Answer ANY financial question with specific data from their accounts:
- "How much did I spend on groceries last month?"
- "Am I saving enough for retirement?"
- "Which category am I overspending in?"
- "When will I reach my emergency fund goal?"
- "How does my spending compare to last month?"
- "What's my biggest expense category?"

RESPONSE STYLE:
- Provide specific dollar amounts and percentages
- Reference actual budget/account names from their data
- Give concrete recommendations with reasoning
- Offer actionable next steps when relevant
- Be thorough but conversational (not just concise)

CURRENT USER'S FINANCIAL STATE:
${financialContext}

PERSONALIZED RECOMMENDATIONS (Top Priority):
${analysis.personalizedRecommendations.slice(0, 3).map((rec: any, index: number) => 
  `${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}: ${rec.description} (${rec.impact})`
).join('\n')}

AVAILABLE ACTIONS (use when relevant):
- move_money: Move money between budgets
- create_budget: Create new budget
- create_goal: Create savings/debt goal  
- fix_overspending: Auto-fix overspent categories
- open_assign_money: Open assign money interface
- open_debt_planner: Open debt payoff planner
- get_detailed_analysis: Show comprehensive financial analysis

ANALYSIS EXAMPLES:
User: "How much have I spent on food this month?"
Response: "You've spent $347 on food this month across Groceries ($243) and Dining Out ($104). That's 23% over your $282 food budget. Consider meal planning to reduce dining out expenses."

User: "Am I on track with my savings?"
Response: "Your current savings rate is 15% ($450/month). For your age and income, financial experts recommend 20%. You're close! Moving $150 from Entertainment to your Emergency Fund would get you there."

Remember: You have access to ALL their financial data. Use specific numbers, account names, and budget categories from their actual data to provide detailed, personalized analysis.`
        },
        ...conversationHistory,
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiMessage = completion.choices[0]?.message?.content || "I'm here to help with your budget!";
    console.log('OpenAI API response received successfully');
    
    // Parse response and generate action buttons based on intent
    const actions = generateActionsFromResponse(message, aiMessage, context);

    return {
      message: aiMessage,
      actions: actions
    };

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        console.error('OpenAI API key issue:', error.message);
        return {
          message: "I'm having trouble connecting to my AI service. Using basic responses for now.",
          actions: [
            {
              type: 'button',
              label: '📊 Financial Overview',
              action: 'get_overview',
              data: {}
            }
          ]
        };
      }
      
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        console.error('OpenAI rate limit exceeded:', error.message);
        return {
          message: "I'm experiencing high demand right now. Let me help with basic responses.",
          actions: [
            {
              type: 'button',
              label: '📊 Financial Overview',
              action: 'get_overview',
              data: {}
            }
          ]
        };
      }
    }
    
    // Fallback to rule-based responses if OpenAI fails
    return generateFallbackResponse(message, context);
  }
}

function handleMoveMoneyIntent(message: string, budgets: any[]) {
  // Parse amount if mentioned
  const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

  // Look for budget names mentioned in the message
  const fromBudgetMatch = message.match(/from\s+["']?([^"']+?)["']?\s+to/i);
  const toBudgetMatch = message.match(/to\s+["']?([^"']+?)["']?(?:\s|$)/i);
  
  const availableBudgets = budgets.filter(b => b.available > 0);
  const underfundedBudgets = budgets.filter(b => b.available < 0);

  if (availableBudgets.length === 0) {
    return {
      message: "No budgets have available money to transfer.",
      actions: []
    };
  }

  // If we can detect specific budgets and amount, offer direct execution
  if (amount && fromBudgetMatch && toBudgetMatch) {
    const fromBudget = budgets.find(b => b.name.toLowerCase().includes(fromBudgetMatch[1].toLowerCase()));
    const toBudget = budgets.find(b => b.name.toLowerCase().includes(toBudgetMatch[1].toLowerCase()));
    
    if (fromBudget && toBudget && fromBudget.available >= amount) {
      return {
        message: `Move $${amount} from "${fromBudget.name}" to "${toBudget.name}"?`,
        actions: [
          {
            type: 'button',
            label: `✅ Yes, Move $${amount}`,
            action: 'move_money',
            data: { 
              fromBudgetId: fromBudget.id, 
              toBudgetId: toBudget.id, 
              amount 
            }
          },
          {
            type: 'button',
            label: 'Choose Different Budgets',
            action: 'open_move_money',
            data: { amount }
          }
        ]
      };
    }
  }

  return {
    message: `Ready to move money between budgets.${amount ? ` Amount: $${amount}` : ''}`,
    actions: [
      {
        type: 'button',
        label: 'Choose Budgets',
        action: 'open_move_money',
        data: { amount }
      }
    ]
  };
}

function handleCreateBudgetIntent(message: string, budgets: any[]) {
  // Extract potential budget name and amount
  const nameMatch = message.match(/(?:create|add|make)(?:\s+a)?\s+(?:budget\s+(?:for\s+)?)?["']?([^"']+?)["']?(?:\s+for|\s+with|\s*$)/i);
  const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
  
  const budgetName = nameMatch ? nameMatch[1].trim() : null;
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 100;

  if (budgetName) {
    // Check if budget already exists
    const existingBudget = budgets.find(b => b.name.toLowerCase() === budgetName.toLowerCase());
    
    if (existingBudget) {
      return {
        message: `Budget "${budgetName}" already exists.`,
        actions: []
      };
    }

    return {
      message: `Create "${budgetName}" budget with $${amount}?`,
      actions: [
        {
          type: 'button',
          label: `✅ Create $${amount} Budget`,
          action: 'create_budget',
          data: { name: budgetName, amount }
        }
      ]
    };
  }

  return {
    message: "What should I name the new budget?",
    actions: []
  };
}

function handleSpendingAnalysisIntent(budgets: any[], transactions: any[]) {
  const overspentBudgets = budgets.filter(b => b.available < 0);
  const topSpendingCategories = budgets
    .filter(b => b.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  let analysis = "";
  
  if (overspentBudgets.length > 0) {
    analysis += `⚠️ ${overspentBudgets.length} categories overspent\n`;
  }

  if (topSpendingCategories.length > 0) {
    analysis += "Top spending:\n";
    topSpendingCategories.forEach((budget, index) => {
      analysis += `${index + 1}. ${budget.name}: $${budget.spent.toFixed(2)}\n`;
    });
  }

  return {
    message: analysis.trim() || "Spending looks good!",
    actions: overspentBudgets.length > 0 ? [
      {
        type: 'button',
        label: `✅ Fix ${overspentBudgets.length} Overspent`,
        action: 'fix_overspending',
        data: { overspentBudgets }
      }
    ] : []
  };
}

function handleCreateGoalIntent(message: string) {
  // Extract goal name and amount
  const goalMatch = message.match(/(?:goal|save|saving)(?:\s+for)?\s+["']?([^"']+?)["']?(?:\s|$)/i);
  const amountMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  
  const goalName = goalMatch ? goalMatch[1].trim() : null;
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 1000;

  if (goalName) {
    return {
      message: `Create "${goalName}" savings goal for $${amount.toLocaleString()}?`,
      actions: [
        {
          type: 'button',
          label: `✅ Create $${amount.toLocaleString()} Goal`,
          action: 'create_goal',
          data: { type: 'savings', name: goalName, targetAmount: amount }
        }
      ]
    };
  }

  return {
    message: "What's your savings goal?",
    actions: [
      {
        type: 'button',
        label: 'Emergency Fund ($1,000)',
        action: 'create_goal',
        data: { type: 'savings', name: 'Emergency Fund', targetAmount: 1000 }
      }
    ]
  };
}

function handleAccountBalanceIntent(accounts: any[], summary: any) {
  let response = "";
  
  accounts.slice(0, 3).forEach(account => {
    const balance = account.balance || 0;
    const emoji = balance >= 0 ? '💰' : '⚠️';
    response += `${emoji} ${account.accountName}: $${balance.toFixed(2)}\n`;
  });

  if (accounts.length > 3) {
    response += `...and ${accounts.length - 3} more\n`;
  }

  response += `\nTotal: $${summary.totalBalance.toFixed(2)}`;
  if (summary.toBeAssigned > 0) {
    response += `\nUnassigned: $${summary.toBeAssigned.toFixed(2)}`;
  }

  return {
    message: response.trim(),
    actions: summary.toBeAssigned > 0 ? [
      {
        type: 'button',
        label: `✅ Assign $${summary.toBeAssigned.toFixed(2)}`,
        action: 'open_assign_money',
        data: { amount: summary.toBeAssigned }
      }
    ] : []
  };
}

function handleDebtIntent(accounts: any[], budgets: any[]) {
  const debtAccounts = accounts.filter(a => a.accountType === 'credit' && a.balance < 0);

  if (debtAccounts.length === 0) {
    return {
      message: "🎉 You're debt-free!",
      actions: []
    };
  }

  const totalDebt = debtAccounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
  
  return {
    message: `$${totalDebt.toFixed(2)} debt across ${debtAccounts.length} accounts.`,
    actions: [
      {
        type: 'button',
        label: '✅ Open Debt Planner',
        action: 'open_debt_planner',
        data: { totalDebt, debtAccounts: debtAccounts.length }
      }
    ]
  };
}

function handleEmergencyFundIntent(goals: any[], summary: any) {
  const emergencyFund = goals.find(g => g.name.toLowerCase().includes('emergency'));
  const recommendedAmount = Math.max(1000, Math.abs(summary.totalSpent) * 6);

  if (emergencyFund) {
    const progress = (emergencyFund.currentAmount / emergencyFund.targetAmount) * 100;
    return {
      message: `Emergency fund: ${progress.toFixed(0)}% complete ($${emergencyFund.currentAmount.toFixed(2)}/$${emergencyFund.targetAmount.toFixed(2)})`,
      actions: [
        {
          type: 'button',
          label: '✅ Add Money',
          action: 'open_fund_goal',
          data: { goalId: emergencyFund.id, goalName: emergencyFund.name }
        }
      ]
    };
  }

  return {
    message: `No emergency fund found. Recommend $${recommendedAmount.toLocaleString()}.`,
    actions: [
      {
        type: 'button',
        label: '✅ Create Emergency Fund',
        action: 'create_goal',
        data: { 
          type: 'savings', 
          name: 'Emergency Fund',
          targetAmount: recommendedAmount
        }
      }
    ]
  };
}

function handleOverviewIntent(summary: any, budgets: any[], accounts: any[]) {
  const { totalBudgeted, totalSpent, totalBalance, toBeAssigned } = summary;
  const spentPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const overspentCount = budgets.filter(b => b.available < 0).length;

  let status = "✅ Looking good";
  if (overspentCount > 0) status = "⚠️ Needs attention";
  if (spentPercentage > 90) status = "🔥 High spending";
  if (toBeAssigned < 0) status = "💸 Overbudgeted";

  const response = `${status}\n` +
    `Balance: $${totalBalance.toFixed(2)}\n` +
    `Spent: $${totalSpent.toFixed(2)} (${spentPercentage.toFixed(0)}%)\n` +
    (toBeAssigned !== 0 ? `Unassigned: $${toBeAssigned.toFixed(2)}\n` : '') +
    (overspentCount > 0 ? `${overspentCount} overspent categories` : '');

  const actions = [];
  if (toBeAssigned > 0) {
    actions.push({
      type: 'button',
      label: `✅ Assign $${toBeAssigned.toFixed(2)}`,
      action: 'open_assign_money',
      data: { amount: toBeAssigned }
    });
  }
  if (overspentCount > 0) {
    actions.push({
      type: 'button',
      label: `✅ Fix ${overspentCount} Overspent`,
      action: 'fix_overspending',
      data: { count: overspentCount }
    });
  }

  return { message: response.trim(), actions };
}

function generateActionsFromResponse(userMessage: string, aiResponse: string, context: any) {
  const { budgets, accounts, goals, summary } = context;
  const actions = [];
  const message = userMessage.toLowerCase();

  // Move money intent
  if (message.includes('move') && message.includes('money')) {
    const amountMatch = userMessage.match(/\$?(\d+(?:\.\d{2})?)/);
    const fromMatch = userMessage.match(/from\s+([^to]+?)(?:\s+to|$)/i);
    const toMatch = userMessage.match(/to\s+(.+?)(?:\s|$)/i);
    
    if (amountMatch && fromMatch && toMatch) {
      const amount = parseFloat(amountMatch[1]);
      const fromBudget = budgets.find((b: any) => 
        b.name.toLowerCase().includes(fromMatch[1].toLowerCase().trim())
      );
      const toBudget = budgets.find((b: any) => 
        b.name.toLowerCase().includes(toMatch[1].toLowerCase().trim())
      );
      
      if (fromBudget && toBudget) {
        actions.push({
          type: 'button',
          label: `✅ Move $${amount}`,
          action: 'move_money',
          data: { fromBudgetId: fromBudget.id, toBudgetId: toBudget.id, amount }
        });
      }
    }
  }

  // Create budget intent
  if (message.includes('create') && message.includes('budget')) {
    const nameMatch = userMessage.match(/budget\s+(?:for\s+)?(.+?)(?:\s+with|\s+\$|\s*$)/i);
    const amountMatch = userMessage.match(/\$?(\d+(?:\.\d{2})?)/);
    
    if (nameMatch) {
      actions.push({
        type: 'button',
        label: `✅ Create Budget`,
        action: 'create_budget',
        data: { 
          name: nameMatch[1].trim(), 
          amount: amountMatch ? parseFloat(amountMatch[1]) : 100 
        }
      });
    }
  }

  // Overview actions
  if (message.includes('overview') || message.includes('how am i doing')) {
    if (summary.toBeAssigned > 0) {
      actions.push({
        type: 'button',
        label: `✅ Assign $${summary.toBeAssigned.toFixed(2)}`,
        action: 'open_assign_money',
        data: { amount: summary.toBeAssigned }
      });
    }
  }

  // Spending analysis
  if (message.includes('spending') || message.includes('overspent')) {
    const overspentBudgets = budgets.filter((b: any) => b.spent > b.amount);
    if (overspentBudgets.length > 0) {
      actions.push({
        type: 'button',
        label: `✅ Fix ${overspentBudgets.length} Overspent`,
        action: 'fix_overspending',
        data: { overspentBudgets }
      });
    }
  }

  // Debt intent
  if (message.includes('debt') || message.includes('pay off')) {
    actions.push({
      type: 'button',
      label: '✅ Open Debt Planner',
      action: 'open_debt_planner',
      data: {}
    });
  }

  // Emergency fund
  if (message.includes('emergency')) {
    const emergencyFund = goals.find((g: any) => g.name.toLowerCase().includes('emergency'));
    if (!emergencyFund) {
      actions.push({
        type: 'button',
        label: '✅ Create Emergency Fund',
        action: 'create_goal',
        data: { type: 'savings', name: 'Emergency Fund', targetAmount: 1000 }
      });
    }
  }

  return actions;
}

function generateFallbackResponse(message: string, context: any) {
  const { budgets, accounts, summary, goals, analysis } = context;
  const msg = message.toLowerCase();
  
  // Enhanced fallback responses with actual financial data
  if (msg.includes('overview') || msg.includes('how am i doing') || msg.includes('summary')) {
    return handleOverviewIntent(summary, budgets, accounts);
  }
  
  if (msg.includes('spending') || msg.includes('spent') || msg.includes('expenses')) {
    return handleSpendingAnalysisIntent(budgets, context.transactions);
  }
  
  if (msg.includes('budget') && msg.includes('how much')) {
    const totalBudgeted = budgets.reduce((sum: number, b: any) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum: number, b: any) => sum + b.spent, 0);
    return {
      message: `You've budgeted $${totalBudgeted.toFixed(2)} this month and spent $${totalSpent.toFixed(2)} (${totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(0) : 0}%). Remaining: $${(totalBudgeted - totalSpent).toFixed(2)}`,
      actions: []
    };
  }
  
  if (msg.includes('balance') || msg.includes('account')) {
    return handleAccountBalanceIntent(accounts, summary);
  }
  
  if (msg.includes('debt') || msg.includes('credit card') || msg.includes('owe')) {
    return handleDebtIntent(accounts, budgets);
  }
  
  if (msg.includes('emergency') || msg.includes('savings')) {
    return handleEmergencyFundIntent(goals, summary);
  }
  
  if (msg.includes('goal')) {
    if (goals.length === 0) {
      return {
        message: "You don't have any goals set up yet. Would you like to create a savings goal?",
        actions: [
          {
            type: 'button',
            label: '✅ Create Emergency Fund ($1,000)',
            action: 'create_goal',
            data: { type: 'savings', name: 'Emergency Fund', targetAmount: 1000 }
          }
        ]
      };
    } else {
      const goalSummary = goals.map((g: any) => {
        const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount * 100).toFixed(0) : '0';
        return `${g.name}: ${progress}% complete ($${g.currentAmount}/$${g.targetAmount})`;
      }).join('\n');
      return {
        message: `Your goals:\n${goalSummary}`,
        actions: []
      };
    }
  }
  
  // Smart category-specific responses
  const categoryMentions = budgets.filter((b: any) => 
    msg.includes(b.name.toLowerCase()) || 
    msg.includes(b.category.toLowerCase())
  );
  
  if (categoryMentions.length > 0) {
    const budget = categoryMentions[0];
    const available = budget.amount - budget.spent;
    return {
      message: `${budget.name}: Budgeted $${budget.amount}, Spent $${budget.spent}, Available $${available.toFixed(2)} ${available < 0 ? '⚠️ (overspent)' : '✅'}`,
      actions: available < 0 ? [
        {
          type: 'button',
          label: '✅ Fix Overspending',
          action: 'fix_overspending',
          data: { overspentBudgets: [budget] }
        }
      ] : []
    };
  }
  
  // Provide helpful suggestions based on current financial state
  const suggestions = [];
  if (summary.toBeAssigned > 0) {
    suggestions.push(`💰 You have $${summary.toBeAssigned.toFixed(2)} to assign to budgets`);
  }
  if (analysis.overspentBudgets?.length > 0) {
    suggestions.push(`⚠️ ${analysis.overspentBudgets.length} categories are overspent`);
  }
  if (goals.length === 0) {
    suggestions.push(`🎯 Consider setting up an emergency fund goal`);
  }
  
  const helpMessage = suggestions.length > 0 
    ? `Here's what I noticed:\n${suggestions.join('\n')}\n\nI can help with budgets, spending, goals, and debt. What would you like to work on?`
    : "I can help with budgets, spending, goals, and debt. What would you like to work on?";
  
  return {
    message: helpMessage,
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
  };
}

// ADVANCED FINANCIAL ANALYSIS HELPER FUNCTIONS

function calculateAgeOfMoney(transactions: any[]): number {
  // Simple approximation: average days between income and expenses
  const incomeTransactions = transactions.filter(t => t.amount > 0);
  const expenseTransactions = transactions.filter(t => t.amount < 0);
  
  if (incomeTransactions.length === 0 || expenseTransactions.length === 0) return 0;
  
  const avgIncomeDays = incomeTransactions.reduce((sum, t) => {
    return sum + (Date.now() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24);
  }, 0) / incomeTransactions.length;
  
  return Math.floor(avgIncomeDays);
}

function analyzeFrequentMerchants(transactions: any[]): any[] {
  const merchantCount = transactions.reduce((acc, t) => {
    const merchant = t.description || 'Unknown';
    acc[merchant] = (acc[merchant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(merchantCount)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([merchant, count]) => ({ merchant, count }));
}

function analyzeSpendingTrends(allTransactions: any[], currentMonth: number, currentYear: number): any {
  const months = [currentMonth - 2, currentMonth - 1, currentMonth].map(m => {
    const month = m <= 0 ? m + 12 : m;
    const year = m <= 0 ? currentYear - 1 : currentYear;
    return { month, year };
  });
  
  const monthlySpending = months.map(({ month, year }) => {
    const monthTransactions = allTransactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() + 1 === month && tDate.getFullYear() === year;
    });
    
    return {
      month,
      year,
      total: monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      count: monthTransactions.length
    };
  });
  
  return {
    trend: monthlySpending.length >= 2 ? 
      (monthlySpending[2].total > monthlySpending[1].total ? 'increasing' : 'decreasing') : 'stable',
    monthlyData: monthlySpending
  };
}

function findUnusualTransactions(currentTransactions: any[], allTransactions: any[]): any[] {
  // Find transactions that are significantly larger than normal
  const amounts = allTransactions.map(t => Math.abs(t.amount));
  const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const threshold = avgAmount * 3; // 3x average is unusual
  
  return currentTransactions
    .filter(t => Math.abs(t.amount) > threshold)
    .slice(0, 3);
}

function calculateFinancialHealthScore(metrics: any): number {
  let score = 0;
  
  // Savings rate (0-30 points)
  if (metrics.savingsRate >= 20) score += 30;
  else if (metrics.savingsRate >= 10) score += 20;
  else if (metrics.savingsRate >= 5) score += 10;
  
  // Debt-to-income ratio (0-25 points)
  if (metrics.debtToIncomeRatio <= 10) score += 25;
  else if (metrics.debtToIncomeRatio <= 30) score += 15;
  else if (metrics.debtToIncomeRatio <= 50) score += 5;
  
  // Emergency fund (0-20 points)
  if (metrics.emergencyFund) {
    const fundRatio = metrics.emergencyFund.currentAmount / metrics.emergencyFund.targetAmount;
    if (fundRatio >= 1) score += 20;
    else if (fundRatio >= 0.5) score += 10;
    else if (fundRatio > 0) score += 5;
  }
  
  // Budget utilization (0-15 points)
  if (metrics.budgetUtilization <= 90) score += 15;
  else if (metrics.budgetUtilization <= 100) score += 10;
  
  // Overspending penalty (0-10 points)
  if (metrics.overspendingAmount === 0) score += 10;
  else if (metrics.overspendingAmount < 100) score += 5;
  
  return Math.min(score, 100);
}

function analyzeBudgetEfficiency(budgets: any[], transactions: any[]): any {
  const categoryEfficiency = budgets.map(budget => {
    const categoryTransactions = transactions.filter(t => t.category === budget.name);
    const actualSpending = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const efficiency = budget.amount > 0 ? (actualSpending / budget.amount) : 0;
    
    return {
      name: budget.name,
      budgeted: budget.amount,
      actual: actualSpending,
      efficiency: efficiency,
      status: efficiency > 1.1 ? 'overspent' : 
              efficiency > 0.9 ? 'efficient' : 
              efficiency < 0.3 ? 'underused' : 'good'
    };
  });
  
  return {
    overallEfficiency: categoryEfficiency.reduce((sum, c) => sum + c.efficiency, 0) / budgets.length,
    categories: categoryEfficiency
  };
}

function predictOverspending(budgets: any[], spendingTrends: any): any[] {
  const currentDate = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const daysPassed = currentDate.getDate();
  const daysRemaining = daysInMonth - daysPassed;
  
  const dailySpendRate = daysPassed > 0 ? daysPassed : 1;
  
  return budgets.filter(budget => {
    const currentDailySpend = budget.spent / dailySpendRate;
    const projectedMonthlySpend = currentDailySpend * daysInMonth;
    return projectedMonthlySpend > budget.amount * 1.1; // 10% over budget
  }).map(budget => ({
    ...budget,
    projectedOverspend: (budget.spent / dailySpendRate * daysInMonth) - budget.amount
  }));
}

function forecastCashFlow(accounts: any[], budgets: any[], spendingTrends: any): any {
  const totalCash = accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const monthlyBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const averageMonthlySpending = spendingTrends.monthlyData.reduce((sum: number, m: any) => sum + m.total, 0) / spendingTrends.monthlyData.length;
  
  const monthsOfRunway = averageMonthlySpending > 0 ? totalCash / averageMonthlySpending : 0;
  
  return {
    monthsOfRunway: Math.floor(monthsOfRunway),
    projectedBalance: totalCash - averageMonthlySpending,
    burnRate: averageMonthlySpending,
    healthStatus: monthsOfRunway >= 6 ? 'excellent' : 
                 monthsOfRunway >= 3 ? 'good' : 
                 monthsOfRunway >= 1 ? 'concerning' : 'critical'
  };
}

function generatePersonalizedRecommendations(context: any): any[] {
  const {
    budgets,
    accounts,
    goals,
    transactions,
    spendingTrends,
    overspentBudgets,
    savingsRate,
    totalDebt,
    monthlyIncome,
    financialHealthScore
  } = context;
  
  const recommendations = [];
  
  // DEBT OPTIMIZATION RECOMMENDATIONS
  if (totalDebt > 0) {
    const debtAccounts = accounts.filter((a: any) => a.accountType === 'credit' && a.balance < 0);
    if (debtAccounts.length > 1) {
      recommendations.push({
        priority: 'high',
        category: 'debt',
        title: 'Optimize Debt Payoff Strategy',
        description: `Focus on highest-interest debt first. You could save hundreds in interest by using the debt avalanche method.`,
        impact: `Potential savings: $${Math.floor(totalDebt * 0.15)}`,
        actionable: true,
        confidence: 0.9
      });
    }
  }
  
  // EMERGENCY FUND RECOMMENDATIONS  
  const emergencyFund = goals.find((g: any) => g.name.toLowerCase().includes('emergency'));
  const recommendedEmergencyAmount = Math.max(1000, monthlyIncome * 3);
  
  if (!emergencyFund) {
    recommendations.push({
      priority: 'critical',
      category: 'emergency',
      title: 'Build Emergency Fund',
      description: `Start with $1,000 emergency fund, then build to 3-6 months of expenses ($${recommendedEmergencyAmount.toLocaleString()}).`,
      impact: 'Financial security for unexpected expenses',
      actionable: true,
      confidence: 0.95
    });
  } else if (emergencyFund.currentAmount < recommendedEmergencyAmount * 0.5) {
    recommendations.push({
      priority: 'high',
      category: 'emergency',
      title: 'Increase Emergency Fund',
      description: `Your emergency fund is only ${((emergencyFund.currentAmount / recommendedEmergencyAmount) * 100).toFixed(0)}% of recommended amount.`,
      impact: `Target: $${recommendedEmergencyAmount.toLocaleString()}`,
      actionable: true,
      confidence: 0.85
    });
  }
  
  // SAVINGS RATE OPTIMIZATION
  if (savingsRate < 10) {
    recommendations.push({
      priority: 'medium',
      category: 'savings',
      title: 'Increase Savings Rate',
      description: `Your current savings rate is ${savingsRate.toFixed(1)}%. Financial experts recommend at least 20%.`,
      impact: 'Faster wealth building and financial independence',
      actionable: true,
      confidence: 0.8
    });
  }
  
  // OVERSPENDING FIXES
  if (overspentBudgets.length > 0) {
    const totalOverspent = overspentBudgets.reduce((sum: number, b: any) => sum + Math.abs(b.amount - b.spent), 0);
    recommendations.push({
      priority: 'critical',
      category: 'spending',
      title: 'Fix Overspending',
      description: `${overspentBudgets.length} categories are overspent by $${totalOverspent.toFixed(2)} total.`,
      impact: 'Get back on budget and prevent debt accumulation',
      actionable: true,
      confidence: 0.95
    });
  }
  
  // BUDGET OPTIMIZATION RECOMMENDATIONS
  const underutilizedBudgets = budgets.filter((b: any) => b.amount > 0 && (b.spent / b.amount) < 0.3);
  if (underutilizedBudgets.length > 0) {
    const totalUnderutilized = underutilizedBudgets.reduce((sum: number, b: any) => sum + (b.amount - b.spent), 0);
    recommendations.push({
      priority: 'medium',
      category: 'spending',
      title: 'Reallocate Underused Budgets',
      description: `You have $${totalUnderutilized.toFixed(2)} in underutilized budget categories that could be redirected.`,
      impact: 'Better budget efficiency and faster goal achievement',
      actionable: true,
      confidence: 0.75
    });
  }
  
  // GOAL ACHIEVEMENT RECOMMENDATIONS
  const stagnantGoals = goals.filter((g: any) => g.type === 'savings' && g.currentAmount === 0);
  if (stagnantGoals.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'goals',
      title: 'Start Funding Your Goals',
      description: `You have ${stagnantGoals.length} unfunded savings goals. Even $25/month makes progress.`,
      impact: 'Turn dreams into achievable financial milestones',
      actionable: true,
      confidence: 0.8
    });
  }
  
  // INCOME DIVERSIFICATION
  const incomeTransactions = transactions.filter((t: any) => t.amount > 0);
  const primaryIncomeSource = incomeTransactions.length > 0;
  if (primaryIncomeSource && monthlyIncome > 0 && savingsRate > 15) {
    recommendations.push({
      priority: 'low',
      category: 'goals',
      title: 'Consider Investment Opportunities',
      description: `With your strong savings rate (${savingsRate.toFixed(1)}%), consider investing for long-term growth.`,
      impact: 'Accelerated wealth building through compound growth',
      actionable: false,
      confidence: 0.6
    });
  }
  
  // SPENDING PATTERN OPTIMIZATIONS
  if (spendingTrends.trend === 'increasing') {
    recommendations.push({
      priority: 'medium',
      category: 'spending',
      title: 'Address Spending Increase',
      description: 'Your spending has been trending upward. Review recent purchases for opportunities to cut back.',
      impact: 'Prevent lifestyle inflation and maintain budget control',
      actionable: true,
      confidence: 0.7
    });
  }
  
  // FINANCIAL HEALTH IMPROVEMENTS
  if (financialHealthScore < 60) {
    recommendations.push({
      priority: 'high',
      category: 'overall',
      title: 'Improve Financial Health Score',
      description: `Your financial health score is ${financialHealthScore}/100. Focus on emergency fund, debt reduction, and consistent budgeting.`,
      impact: 'Overall financial stability and peace of mind',
      actionable: true,
      confidence: 0.85
    });
  }
  
  // Sort by priority and confidence
  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  return recommendations
    .sort((a, b) => {
      const priorityDiff = (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    })
    .slice(0, 8); // Return top 8 recommendations
}