import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import CreditCardAutomation from '../../lib/credit-card-automation';

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
    const userMessage = await prisma.chatMessage.create({
      data: {
        userId,
        type: 'user',
        content: message
      }
    });

    console.log('✅ User message stored in database:', userMessage.id);

    // Get recent conversation history from database (last 20 messages)
    const dbHistory = await prisma.chatMessage.findMany({
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

    // Get comprehensive financial data for intelligent analysis
    const [currentTransactions, allTransactions, goals, budgetTransfers, lastMonthBudgets] = await Promise.all([
      // Current month transactions
      prisma.transaction.findMany({
        where: { 
          userId, 
          date: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1)
          }
        },
        orderBy: { date: 'desc' },
        include: { account: true, budget: true }
      }),
      
      // All recent transactions (last 6 months)
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: new Date(currentYear, currentMonth - 7, 1)
          }
        },
        orderBy: { date: 'desc' },
        include: { account: true, budget: true }
      }),
      
      // Goals
      prisma.goal.findMany({
        where: { userId },
        orderBy: { priority: 'desc' }
      }),
      
      // Budget transfers (credit card automation)
      prisma.budgetTransfer.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { fromBudget: true, toBudget: true }
      }),
      
      // Last month's budgets for comparison
      prisma.budget.findMany({
        where: { userId, month: lastMonth, year: lastMonthYear },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      })
    ]);

    const yearTransactions = allTransactions.filter(t => new Date(t.date).getFullYear() === currentYear);
    const last3MonthsBudgets = await prisma.budget.findMany({
      where: {
        userId,
        OR: [
          { month: currentMonth, year: currentYear },
          { month: lastMonth, year: lastMonthYear },
          { month: lastMonth === 1 ? 12 : lastMonth - 1, year: lastMonth <= 2 ? currentYear - 1 : currentYear }
        ]
      }
    });

    console.log('✅ Financial data fetched successfully:', {
      budgets: budgets.length,
      accounts: accounts.length,
      currentTransactions: currentTransactions.length,
      goals: goals.length
    });

    // COMPREHENSIVE FINANCIAL ANALYSIS ENGINE
    
    // === SIMPLIFIED ACCOUNT ANALYSIS ===
    const cashAccounts = accounts.filter((a: any) => ['depository', 'investment'].includes(a.accountType));
    const creditAccounts = accounts.filter((a: any) => a.accountType === 'credit');
    const totalCash = cashAccounts.reduce((sum: number, a: any) => sum + Math.max(0, a.balance), 0);
    const totalDebt = creditAccounts.reduce((sum: number, a: any) => sum + Math.max(0, a.balance), 0);
    const netWorth = totalCash - totalDebt;
    
    // === COMPREHENSIVE FINANCIAL ANALYSIS ===
    const totalBudgeted = budgets.reduce((sum: number, b: any) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum: number, b: any) => sum + b.spent, 0);
    const totalAvailable = totalBudgeted - totalSpent;
    const toBeAssigned = totalCash - totalBudgeted;
    
    // Income and expense analysis
    const currentMonthIncome = currentTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const currentMonthExpenses = Math.abs(currentTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));
    
    const totalYearIncome = yearTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalYearExpenses = Math.abs(yearTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));
    
    const averageMonthlyIncome = totalYearIncome / 12;
    const averageMonthlyExpenses = totalYearExpenses / 12;
    
    // Budget growth analysis
    const lastMonthBudgeted = lastMonthBudgets.reduce((sum: number, b: any) => sum + b.amount, 0);
    const budgetGrowth = lastMonthBudgeted > 0 ? ((totalBudgeted - lastMonthBudgeted) / lastMonthBudgeted) * 100 : 0;
    const spendingGrowth = averageMonthlyExpenses > 0 ? ((currentMonthExpenses - averageMonthlyExpenses) / averageMonthlyExpenses) * 100 : 0;
    
    // Category analysis
    const categoryAnalysis = currentTransactions
      .filter(t => t.amount < 0)
      .reduce((acc: any, t) => {
        const category = t.category || 'Uncategorized';
        if (!acc[category]) acc[category] = { total: 0, count: 0, transactions: [] };
        acc[category].total += Math.abs(t.amount);
        acc[category].count += 1;
        acc[category].transactions.push(t);
        return acc;
      }, {});
    
    // Top merchants analysis
    const merchantAnalysis = currentTransactions
      .filter(t => t.amount < 0)
      .reduce((acc: any, t) => {
        const merchant = t.description.split(' ')[0] || 'Unknown';
        if (!acc[merchant]) acc[merchant] = { total: 0, count: 0 };
        acc[merchant].total += Math.abs(t.amount);
        acc[merchant].count += 1;
        return acc;
      }, {});
    
    const topMerchants = Object.entries(merchantAnalysis)
      .sort(([,a]: any, [,b]: any) => b.total - a.total)
      .slice(0, 5)
      .map(([merchant, data]: any) => ({ merchant, ...data }));
    
    // Large and frequent expenses
    const expenses = currentTransactions.filter(t => t.amount < 0);
    const avgExpense = expenses.length > 0 ? expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0) / expenses.length : 0;
    
    const largestExpenses = expenses
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5)
      .map(t => ({
        description: t.description,
        amount: Math.abs(t.amount),
        category: t.category,
        date: t.date
      }));
    
    const frequentExpenses = Object.entries(merchantAnalysis)
      .filter(([,data]: any) => data.count >= 3)
      .sort(([,a]: any, [,b]: any) => b.count - a.count)
      .slice(0, 5)
      .map(([merchant, data]: any) => ({ merchant, ...data }));
    
    // Goals analysis
    const goalAnalysis = goals.map(g => ({
      ...g,
      progress: g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0,
      monthsRemaining: g.targetDate ? Math.max(0, Math.ceil((new Date(g.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30))) : null
    }));
    
    // Budget health analysis
    const overspentBudgets = budgets.filter((b: any) => b.spent > b.amount);
    const totalOverspent = overspentBudgets.reduce((sum: number, b: any) => sum + (b.spent - b.amount), 0);
    const budgetUtilization = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
    
    // Financial ratios
    const savingsRate = currentMonthIncome > 0 ? ((currentMonthIncome - currentMonthExpenses) / currentMonthIncome) * 100 : 0;
    const debtToIncomeRatio = currentMonthIncome > 0 ? (totalDebt / (currentMonthIncome * 12)) * 100 : 0;
    const expenseRatio = currentMonthIncome > 0 ? (currentMonthExpenses / currentMonthIncome) * 100 : 0;
    const emergencyFundMonths = currentMonthExpenses > 0 ? totalCash / currentMonthExpenses : 0;
    
    // Financial health score
    let healthScore = 100;
    if (savingsRate < 10) healthScore -= 20;
    if (debtToIncomeRatio > 30) healthScore -= 25;
    if (overspentBudgets.length > 0) healthScore -= Math.min(30, overspentBudgets.length * 5);
    if (emergencyFundMonths < 3) healthScore -= 15;
    if (budgetUtilization > 90) healthScore -= 10;
    
    // Trend data for the last 3 months
    const trendData = last3MonthsBudgets.reduce((acc: any, budget) => {
      const key = `${budget.month}/${budget.year}`;
      if (!acc[key]) acc[key] = { month: budget.month, year: budget.year, budgeted: 0, spent: 0 };
      acc[key].budgeted += budget.amount;
      acc[key].spent += budget.spent;
      return acc;
    }, {});
    
    const trendArray = Object.values(trendData).sort((a: any, b: any) => {
      return (a.year - b.year) || (a.month - b.month);
    });

    console.log('🤖 Calling OpenAI API for response generation...');

    // Generate intelligent AI response with comprehensive analysis
    const aiResponse = await generateOpenAIResponse(message, userId, conversationHistory, {
      budgets,
      accounts,
      currentTransactions,
      allTransactions,
      goals,
      budgetTransfers,
      analysis: {
        totalBudgeted,
        totalSpent,
        totalAvailable,
        toBeAssigned,
        currentMonthIncome,
        currentMonthExpenses,
        totalYearIncome,
        totalYearExpenses,
        averageMonthlyIncome,
        averageMonthlyExpenses,
        budgetGrowth,
        spendingGrowth,
        categoryAnalysis,
        topMerchants,
        largestExpenses,
        frequentExpenses,
        goalAnalysis,
        overspentBudgets,
        totalOverspent,
        budgetUtilization,
        savingsRate,
        debtToIncomeRatio,
        expenseRatio,
        emergencyFundMonths,
        healthScore,
        trendData: trendArray,
        netWorth,
        totalCash,
        totalDebt
      }
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
  const { budgets, accounts, analysis, goals, currentTransactions, topMerchants } = context;

  // Check if OpenAI API key is available
  if (!hasOpenAIKey) {
    console.warn('❌ OpenAI API key not configured, using basic response');
    return {
      message: "I need an OpenAI API key to provide personalized financial analysis. Please configure the API key to unlock my full capabilities.",
      actions: []
    };
  }

  console.log('✅ OpenAI API key available, proceeding with intelligent AI response generation');

  try {
    console.log('🤖 Making intelligent OpenAI API call with comprehensive financial data...');
    
    // Create detailed financial context for the AI
    const financialSummary = `
COMPREHENSIVE FINANCIAL OVERVIEW:

💰 NET WORTH & ACCOUNTS:
- Net Worth: $${analysis.netWorth.toFixed(2)}
- Total Cash: $${analysis.totalCash.toFixed(2)}
- Total Debt: $${analysis.totalDebt.toFixed(2)}
- Accounts: ${accounts.length} total

📱 AVAILABLE ACCOUNTS:
${accounts.map((a: any) => `- ${a.accountName} (${a.accountType}${a.accountSubtype ? `/${a.accountSubtype}` : ''}) - ID: ${a.id} - Balance: $${a.balance.toFixed(2)}`).join('\n')}

📊 BUDGET PERFORMANCE:
- Total Budgeted: $${analysis.totalBudgeted.toFixed(2)}
- Total Spent: $${analysis.totalSpent.toFixed(2)}
- Budget Utilization: ${analysis.budgetUtilization.toFixed(1)}%
- Overspent Categories: ${analysis.overspentBudgets.length}
- Total Overspent: $${analysis.totalOverspent.toFixed(2)}

💸 SPENDING & INCOME:
- This Month's Income: $${analysis.currentMonthIncome.toFixed(2)}
- This Month's Expenses: $${analysis.currentMonthExpenses.toFixed(2)}
- Monthly Income vs Expenses Growth: ${analysis.budgetGrowth.toFixed(1)}%
- Savings Rate: ${analysis.savingsRate.toFixed(1)}%

🏪 TOP MERCHANTS:
${analysis.topMerchants.map((m: any, i: number) => `${i + 1}. ${m.merchant}: $${m.total.toFixed(2)} (${m.count} transactions)`).join('\n')}

📈 FINANCIAL HEALTH:
- Health Score: ${analysis.healthScore}/100
- Emergency Fund: ${analysis.emergencyFundMonths.toFixed(1)} months
- Debt-to-Income Ratio: ${analysis.debtToIncomeRatio.toFixed(1)}%
- Expense Ratio: ${analysis.expenseRatio.toFixed(1)}%

🎯 GOALS:
${goals.length > 0 ? goals.map((g: any) => `- ${g.name}: ${analysis.goalAnalysis.find((ga: any) => ga.id === g.id)?.progress?.toFixed(1) || 0}% complete`).join('\n') : '- No goals set'}

📝 RECENT TRANSACTIONS (for reference):
${currentTransactions.slice(0, 10).map((t: any) => `- ID: ${t.id} | $${t.amount.toFixed(2)} | ${t.description} | ${t.category || 'Uncategorized'} | ${new Date(t.date).toLocaleDateString()}`).join('\n')}

⚠️ ALERTS & INSIGHTS:
${analysis.overspentBudgets.length > 0 ? `- You're overspending in ${analysis.overspentBudgets.length} categories` : '- Budget is on track'}
${analysis.savingsRate < 10 ? '- Savings rate is below recommended 10%' : '- Healthy savings rate'}
${analysis.emergencyFundMonths < 3 ? '- Emergency fund is below recommended 3 months' : '- Good emergency fund'}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are Finley, an expert financial advisor AI with deep expertise in personal finance, budgeting, and wealth building. You provide personalized, actionable advice based on comprehensive financial analysis.

PERSONALITY: Professional yet friendly, insightful, and genuinely caring about the user's financial wellbeing. You make complex financial concepts easy to understand and always provide practical next steps.

CAPABILITIES:
- Analyze spending patterns and identify optimization opportunities
- Provide personalized budget recommendations based on actual data
- Identify financial risks and suggest mitigation strategies  
- Offer savings and investment guidance
- Help set and track meaningful financial goals
- Spot unusual transactions or concerning trends
- Provide context-aware advice based on the user's specific situation
- Create new transactions when requested
- Recategorize existing transactions to improve budget accuracy

TRANSACTION MANAGEMENT:
You can help users manage their transactions by:
1. Creating new transactions when they mention purchases, payments, or income
2. Recategorizing existing transactions when they seem incorrectly categorized
3. Updating transaction details like descriptions or amounts

ACCOUNT SELECTION RULES:
When creating transactions, you must choose the appropriate account:
- For CASH purchases/expenses: Use checking or debit accounts (accountType: 'depository', subtype: 'checking')
- For CREDIT CARD purchases: Use credit card accounts (accountType: 'credit')
- For INCOME/PAYCHECKS: Use checking accounts (primary depository account)
- For SAVINGS transactions: Use savings accounts (accountType: 'depository', subtype: 'savings')

IMPORTANT: If the user mentions a transaction but you're unsure which account to use (e.g., they have multiple credit cards or checking accounts), DO NOT create the transaction immediately. Instead, ask them to clarify which specific account they used for the transaction. Only create transactions when you're confident about the account selection.

When a user mentions a transaction that should be created or updated, use the appropriate function to help them.

RESPONSE STYLE:
- Use specific numbers and insights from their actual financial data
- Provide 2-4 actionable recommendations per response
- Be encouraging while honest about areas needing improvement
- Use emojis thoughtfully to make responses engaging but professional
- Reference specific transactions, merchants, or categories when relevant

${financialSummary}

Focus on being helpful, insightful, and specific to their situation. Always reference their actual financial data in your responses.`
        },
        ...conversationHistory,
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.4,
      functions: [
        {
          name: "create_transaction",
          description: "Create a new transaction for the user. Only use this function when you're confident about which account to use. If unsure about the account, ask the user for clarification instead.",
          parameters: {
            type: "object",
            properties: {
              amount: {
                type: "number",
                description: "Transaction amount (positive for income, negative for expenses)"
              },
              description: {
                type: "string",
                description: "Description of the transaction"
              },
              category: {
                type: "string",
                description: "Budget category for the transaction"
              },
              date: {
                type: "string",
                description: "Date of transaction in YYYY-MM-DD format (optional, defaults to today)"
              },
              accountId: {
                type: "string",
                description: "Account ID from the AVAILABLE ACCOUNTS list. Required when creating transactions. Choose based on transaction type: credit card purchases use credit accounts, cash/debit use checking accounts, income goes to primary checking."
              }
            },
            required: ["amount", "description", "category", "accountId"]
          }
        },
        {
          name: "recategorize_transaction",
          description: "Change the category of an existing transaction",
          parameters: {
            type: "object",
            properties: {
              transactionId: {
                type: "string",
                description: "ID of the transaction to recategorize"
              },
              category: {
                type: "string",
                description: "New budget category for the transaction"
              }
            },
            required: ["transactionId", "category"]
          }
        },
        {
          name: "ask_for_account_clarification",
          description: "Ask the user to clarify which account to use when creating a transaction. Use this when you're unsure which account the user wants to use.",
          parameters: {
            type: "object",
            properties: {
              transactionType: {
                type: "string",
                description: "Type of transaction (e.g., 'credit card purchase', 'cash payment', 'income deposit')"
              },
              suggestedAccounts: {
                type: "array",
                items: { type: "string" },
                description: "List of account IDs that could be appropriate for this transaction"
              }
            },
            required: ["transactionType", "suggestedAccounts"]
          }
        }
      ],
      function_call: "auto"
    });

    console.log('✅ OpenAI API response received');
    
    const responseMessage = completion.choices[0]?.message;
    let aiMessage = responseMessage?.content || "I'm here to help analyze your financial data!";
    
    // Handle function calls if present
    let functionResults: any[] = [];
    if (responseMessage?.function_call) {
      console.log('🔧 Function call detected:', responseMessage.function_call.name);
      
      try {
        const functionArgs = JSON.parse(responseMessage.function_call.arguments);
        let functionResult = null;

        switch (responseMessage.function_call.name) {
          case 'create_transaction':
            functionResult = await handleCreateTransaction(userId, functionArgs);
            break;
          case 'recategorize_transaction':
            functionResult = await handleRecategorizeTransaction(userId, functionArgs);
            break;
          case 'ask_for_account_clarification':
            functionResult = await handleAccountClarification(userId, functionArgs, accounts);
            break;
          default:
            console.warn('Unknown function call:', responseMessage.function_call.name);
        }

        if (functionResult) {
          functionResults.push({
            function: responseMessage.function_call.name,
            args: functionArgs,
            result: functionResult
          });
        }
      } catch (error) {
        console.error('Error executing function call:', error);
        functionResults.push({
          function: responseMessage.function_call.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log('📝 AI message length:', aiMessage.length);
    
    // Generate contextual actions based on analysis
    const actions = [];
    
    // Always include overview
    actions.push({
      type: 'button',
      label: '📊 Detailed Overview',
      action: 'get_overview',
      data: {}
    });

    // Context-aware actions
    if (analysis.overspentBudgets.length > 0) {
      actions.push({
        type: 'button',
        label: '⚠️ Fix Overspending',
        action: 'fix_overspending',
        data: { count: analysis.overspentBudgets.length }
      });
    }

    if (analysis.savingsRate < 15) {
      actions.push({
        type: 'button',
        label: '💰 Boost Savings',
        action: 'improve_savings',
        data: { currentRate: analysis.savingsRate }
      });
    }

    if (analysis.topMerchants.length > 0) {
      actions.push({
        type: 'button',
        label: '🏪 Analyze Spending',
        action: 'analyze_merchants',
        data: { topMerchant: analysis.topMerchants[0].merchant }
      });
    }

    // Store AI response in database with rich metadata
    const metadata = {
      actions,
      analysis: {
        healthScore: analysis.healthScore,
        savingsRate: analysis.savingsRate,
        budgetUtilization: analysis.budgetUtilization,
        overspentBudgets: analysis.overspentBudgets.length,
        netWorth: analysis.netWorth,
        emergencyFundMonths: analysis.emergencyFundMonths
      },
      insights: {
        topSpendingCategory: Object.entries(analysis.categoryAnalysis).sort(([,a]: any, [,b]: any) => b.total - a.total)[0]?.[0],
        largestExpense: analysis.largestExpenses[0],
        budgetTrend: analysis.budgetGrowth > 0 ? 'increasing' : 'decreasing'
      }
    };
    
    await prisma.chatMessage.create({
      data: {
        userId: userId,
        type: 'ai',
        content: aiMessage,
        metadata: JSON.stringify(metadata)
      }
    });

    return {
      message: aiMessage,
      actions: actions.slice(0, 4), // Limit to 4 actions
      insights: metadata.insights,
      healthScore: analysis.healthScore,
      functionResults: functionResults.length > 0 ? functionResults : undefined
    };

  } catch (error) {
    console.error('❌ OpenAI API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      userId,
      messageLength: message.length
    });
    
    return {
      message: "I'm having trouble accessing my advanced analysis right now, but I can see you have great financial data to work with! Let me help with what I can analyze locally - what specific area would you like to focus on?",
      actions: [
        {
          type: 'button',
          label: '📊 Budget Review',
          action: 'analyze_budget',
          data: {}
        },
        {
          type: 'button',
          label: '💸 Spending Analysis',
          action: 'analyze_spending',
          data: {}
        }
      ]
    };
  }
}

// Function handlers for AI-driven transaction management
async function handleCreateTransaction(userId: string, args: any) {
  try {
    console.log('🔧 Creating transaction:', args);
    
    const { amount, description, category, date, accountId } = args;

    if (!amount || !description || !category) {
      throw new Error('Missing required fields: amount, description, category');
    }

    if (!accountId) {
      throw new Error('Account ID is required. Please specify which account this transaction should be added to.');
    }

    // Auto-categorize income transactions using the same logic as the main endpoint
    let finalCategory = category;
    if (parseFloat(amount) > 0) {
      if (CreditCardAutomation.isIncomeTransaction(description, [], parseFloat(amount))) {
        finalCategory = 'To Be Assigned';
      }
    }

    // Find the specified account
    const account = await prisma.account.findFirst({
      where: { 
        id: accountId,
        userId: userId
      }
    });
    
    if (!account) {
      throw new Error(`Account with ID '${accountId}' not found or access denied. Please check the available accounts and try again.`);
    }

    // Find or create budget
    const transactionDate = date ? new Date(date) : new Date();
    const month = transactionDate.getMonth() + 1;
    const year = transactionDate.getFullYear();

    let budget = await prisma.budget.findFirst({
      where: {
        userId: userId,
        name: finalCategory,
        month: month,
        year: year,
      }
    });

    // Auto-create budget if it doesn't exist
    if (!budget) {
      if (finalCategory === 'To Be Assigned') {
        budget = await prisma.budget.create({
          data: {
            userId: userId,
            name: 'To Be Assigned',
            category: 'Income',
            amount: 0,
            spent: 0,
            month: month,
            year: year
          }
        });
      } else {
        budget = await CreditCardAutomation.getOrCreateBudget(
          userId,
          finalCategory,
          month,
          year,
          100 // $100 default
        );
      }
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: userId,
        accountId: account.id,
        budgetId: budget?.id || null,
        plaidTransactionId: 'manual_ai_' + Date.now(),
        amount: parseFloat(amount),
        description,
        category: finalCategory,
        date: transactionDate,
        cleared: account.accountType === 'manual',
        isManual: true,
        approved: true,
      },
    });

    // Update budget
    if (budget && parseFloat(amount) < 0) {
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          spent: {
            increment: Math.abs(parseFloat(amount))
          }
        }
      });
    } else if (budget && parseFloat(amount) > 0 && finalCategory === 'To Be Assigned') {
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          amount: {
            increment: parseFloat(amount)
          }
        }
      });
    }

    // Update account balance
    await prisma.account.update({
      where: { id: account.id },
      data: {
        balance: {
          increment: parseFloat(amount)
        }
      }
    });

    console.log('✅ Transaction created successfully:', transaction.id);
    
    return {
      success: true,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        date: transaction.date
      }
    };
  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create transaction'
    };
  }
}

async function handleRecategorizeTransaction(userId: string, args: any) {
  try {
    console.log('🔧 Recategorizing transaction:', args);
    
    const { transactionId, category } = args;

    if (!transactionId || !category) {
      throw new Error('Missing required fields: transactionId, category');
    }

    // Get the current transaction
    const currentTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { budget: true }
    });

    if (!currentTransaction || currentTransaction.userId !== userId) {
      throw new Error('Transaction not found');
    }

    // Remove amount from old budget if it exists and is an expense
    if (currentTransaction.budget && currentTransaction.amount < 0) {
      await prisma.budget.update({
        where: { id: currentTransaction.budget.id },
        data: {
          spent: {
            decrement: Math.abs(currentTransaction.amount)
          }
        }
      });
    }

    // Find matching budget for new category
    const transactionDate = new Date(currentTransaction.date);
    const month = transactionDate.getMonth() + 1;
    const year = transactionDate.getFullYear();

    let newBudget = await prisma.budget.findFirst({
      where: {
        userId: userId,
        category: category,
        month: month,
        year: year,
      }
    });

    // Auto-create budget if it doesn't exist for the category
    if (!newBudget) {
      newBudget = await CreditCardAutomation.getOrCreateBudget(
        userId,
        category,
        month,
        year,
        100 // Default $100 budget
      );
    }

    // Update the transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        category: category,
        budgetId: newBudget?.id || null,
      },
    });

    // Add amount to new budget if it exists and is an expense
    if (newBudget && currentTransaction.amount < 0) {
      await prisma.budget.update({
        where: { id: newBudget.id },
        data: {
          spent: {
            increment: Math.abs(currentTransaction.amount)
          }
        }
      });
    }

    console.log('✅ Transaction recategorized successfully');
    
    return {
      success: true,
      transaction: {
        id: updatedTransaction.id,
        category: updatedTransaction.category,
        oldCategory: currentTransaction.category
      }
    };
  } catch (error) {
    console.error('❌ Error recategorizing transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recategorize transaction'
    };
  }
}

async function handleAccountClarification(userId: string, args: any, accounts: any[]) {
  try {
    console.log('🔧 Requesting account clarification:', args);
    
    const { transactionType, suggestedAccounts } = args;

    // Get the suggested account details
    const suggestedAccountDetails = accounts.filter(account => 
      suggestedAccounts.includes(account.id)
    );

    if (suggestedAccountDetails.length === 0) {
      throw new Error('No valid account suggestions found');
    }

    // Format the account options for the user
    const accountOptions = suggestedAccountDetails.map(account => ({
      id: account.id,
      name: account.accountName,
      type: `${account.accountType}${account.accountSubtype ? `/${account.accountSubtype}` : ''}`,
      balance: account.balance
    }));

    console.log('✅ Account clarification prepared');
    
    return {
      success: true,
      clarificationNeeded: true,
      transactionType,
      accountOptions,
      message: `I need to know which account you used for this ${transactionType}. Please specify which account:`
    };
  } catch (error) {
    console.error('❌ Error preparing account clarification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare account clarification'
    };
  }
}

// Comprehensive Finley AI with advanced financial analysis and intelligent recommendations