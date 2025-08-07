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

    // Set dummy data for complex queries to isolate the issue
    const lastMonthBudgets: any[] = [];
    const last3MonthsBudgets: any[] = [];
    const currentTransactions: any[] = [];
    const allTransactions: any[] = [];
    const yearTransactions: any[] = [];
    const goals: any[] = [];
    const budgetTransfers: any[] = [];

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
    
    // === SIMPLIFIED ANALYSIS WITH DEFAULTS ===
    const totalBudgeted = budgets.reduce((sum: number, b: any) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum: number, b: any) => sum + b.spent, 0);
    const totalAvailable = totalBudgeted - totalSpent;
    const toBeAssigned = totalCash - totalBudgeted;
    
    // Default values for simplified version
    const totalYearIncome = 0;
    const averageMonthlyIncome = 0;
    const currentMonthIncome = 0;
    const totalYearExpenses = 0;
    const averageMonthlyExpenses = 0;
    const currentMonthExpenses = 0;
    const budgetGrowth = 0;
    const spendingGrowth = 0;
    const categoryAnalysis = {};
    const topMerchants: any[] = [];
    const largestExpenses: any[] = [];
    const frequentExpenses: any[] = [];
    const goalAnalysis: any[] = [];
    const overspentBudgets = budgets.filter((b: any) => b.spent > b.amount);
    const totalOverspent = overspentBudgets.reduce((sum: number, b: any) => sum + (b.spent - b.amount), 0);
    const budgetUtilization = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
    const savingsRate = 0;
    const debtToIncomeRatio = 0;
    const expenseRatio = 0;
    const emergencyFundMonths = 0;
    const healthScore = 100;
    const trendData: any[] = [];

    console.log('🤖 Calling OpenAI API for response generation...');

    // Generate simplified AI response
    const aiResponse = await generateOpenAIResponse(message, userId, conversationHistory, {
      budgets,
      accounts
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
  const { budgets, accounts } = context;

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
    
    await prisma.chatMessage.create({
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

// Simplified version - removed complex function implementations for debugging