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

    // Get user's current financial data for context
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [budgets, accounts, transactions, goals] = await Promise.all([
      prisma.budget.findMany({
        where: { userId, month: currentMonth, year: currentYear },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      }),
      prisma.account.findMany({
        where: { userId },
        orderBy: { accountName: 'asc' }
      }),
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
        take: 50 // Recent transactions for context
      }),
      prisma.goal.findMany({
        where: { userId },
        orderBy: { name: 'asc' }
      })
    ]);

    // Calculate summary data
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const toBeAssigned = totalBalance - totalBudgeted;

    // Generate AI response using OpenAI
    const aiResponse = await generateOpenAIResponse(message, {
      budgets,
      accounts,
      transactions,
      goals,
      summary: { totalBudgeted, totalSpent, totalBalance, toBeAssigned },
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
  const { budgets, accounts, transactions, goals, summary, history } = context;

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

  // Create financial context for OpenAI
  const financialContext = `
FINANCIAL DATA:
- Total Balance: $${summary.totalBalance.toFixed(2)}
- Total Budgeted: $${summary.totalBudgeted.toFixed(2)}
- Total Spent: $${summary.totalSpent.toFixed(2)}
- To Be Assigned: $${summary.toBeAssigned.toFixed(2)}

BUDGETS (${budgets.length}):
${budgets.slice(0, 5).map((b: any) => `- ${b.name}: Budgeted $${b.amount}, Spent $${b.spent}, Available $${(b.amount - b.spent).toFixed(2)}`).join('\n')}

ACCOUNTS (${accounts.length}):
${accounts.slice(0, 3).map((a: any) => `- ${a.accountName}: $${a.balance.toFixed(2)}`).join('\n')}

RECENT TRANSACTIONS (${Math.min(transactions.length, 3)}):
${transactions.slice(0, 3).map((t: any) => `- ${t.description}: $${t.amount.toFixed(2)} (${t.category || 'Uncategorized'})`).join('\n')}

GOALS (${goals.length}):
${goals.slice(0, 2).map((g: any) => `- ${g.name}: $${g.currentAmount}/$${g.targetAmount} (${g.type})`).join('\n')}
  `;

  // Create conversation history for context
  const conversationHistory = history.slice(-4).map((msg: any) => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  try {
    console.log('Calling OpenAI API with model gpt-4o-mini...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a concise, helpful financial assistant for a YNAB-style budgeting app. 

PERSONALITY: Be conversational, concise (1-3 sentences max), and action-oriented. Use emojis sparingly.

CAPABILITIES: You can help with:
- Moving money between budgets
- Creating new budgets/goals  
- Analyzing spending patterns
- Checking account balances
- Budget recommendations

RESPONSE FORMAT: 
- Keep responses under 50 words
- Always suggest specific actionable buttons when possible
- For money movements, detect amounts and budget names to offer direct execution

CURRENT USER'S FINANCIAL STATE:
${financialContext}

AVAILABLE ACTIONS (suggest these as buttons when relevant):
- move_money: Move money between budgets (needs fromBudgetId, toBudgetId, amount)
- create_budget: Create new budget (needs name, amount) 
- create_goal: Create savings/debt goal (needs name, targetAmount, type)
- fix_overspending: Auto-fix overspent categories
- open_assign_money: Open assign money interface
- open_debt_planner: Open debt payoff planner

EXAMPLES:
User: "move $50 from groceries to gas"
Response: "Move $50 from Groceries to Transportation?" + [button: "✅ Move $50"]

User: "how am I doing?"  
Response: "Looking good! Spent $850 (65%). Have $200 unassigned." + [button: "✅ Assign $200"]
`
        },
        ...conversationHistory,
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 150,
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
  const { budgets, accounts, summary } = context;
  
  // Simple fallback based on keywords
  if (message.toLowerCase().includes('overview')) {
    return handleOverviewIntent(summary, budgets, accounts);
  }
  
  if (message.toLowerCase().includes('spending')) {
    return handleSpendingAnalysisIntent(budgets, context.transactions);
  }
  
  return {
    message: "I can help with budgets, spending, goals, and debt. What would you like to do?",
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