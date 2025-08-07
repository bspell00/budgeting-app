import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check if OpenAI API key is configured
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

/**
 * Create or retrieve a persistent AI Assistant for a user
 */
export async function createOrGetAssistant(userId: string): Promise<string | null> {
  if (!hasOpenAIKey) {
    console.warn('OpenAI API key not configured, skipping assistant creation');
    return null;
  }

  try {
    // Create a persistent assistant with financial expertise
    const assistant = await openai.beta.assistants.create({
      name: `Finley-${userId}`,
      instructions: `You are Finley, an expert AI financial advisor with persistent memory and deep financial expertise. 

🎯 YOUR ROLE:
- Personal finance advisor for this specific user
- Remember all conversations and build context over time
- Provide specific, actionable financial advice
- Use tools to take real actions when requested

💪 CAPABILITIES:
- Analyze spending patterns and trends
- Create and modify budgets
- Track financial goals and progress
- Generate debt payoff strategies
- Search transactions semantically
- Remember user preferences and financial situation

📊 MEMORY FOCUS:
- User's financial goals and priorities
- Spending habits and patterns
- Budget preferences and pain points
- Risk tolerance and investment interests
- Debt management strategies
- Previous advice given and outcomes

💬 CONVERSATION STYLE:
- Friendly and supportive, not preachy
- Use specific numbers from their actual data
- Confirm before making changes
- Celebrate progress and milestones
- Provide context for recommendations

Always reference past conversations when relevant and build upon previous advice given.`,
      model: "gpt-4o-mini",
      tools: [
        { type: "code_interpreter" },
        {
          type: "function",
          function: {
            name: "analyze_financial_data",
            description: "Analyze user's complete financial data for insights",
            parameters: {
              type: "object",
              properties: {
                analysis_type: {
                  type: "string",
                  enum: ["spending", "budgets", "goals", "debt", "trends", "complete"],
                  description: "Type of financial analysis to perform"
                },
                time_period: {
                  type: "string",
                  enum: ["current_month", "last_3_months", "last_6_months", "year_to_date"],
                  description: "Time period for analysis"
                }
              },
              required: ["analysis_type"]
            }
          }
        }
      ]
    });

    console.log(`✅ Created persistent assistant for user ${userId}: ${assistant.id}`);
    return assistant.id;

  } catch (error) {
    console.error('Failed to create assistant:', error);
    return null;
  }
}

/**
 * Create a conversation thread for a user
 */
export async function createThread(): Promise<string | null> {
  if (!hasOpenAIKey) {
    return null;
  }

  try {
    const thread = await openai.beta.threads.create();
    console.log(`✅ Created conversation thread: ${thread.id}`);
    return thread.id;
  } catch (error) {
    console.error('Failed to create thread:', error);
    return null;
  }
}

/**
 * Send a message to the assistant and get a response
 * Note: Simplified implementation - full Assistant API integration would require additional setup
 */
export async function chatWithAssistant(
  assistantId: string,
  threadId: string,
  message: string,
  context?: any
): Promise<{
  message: string;
  actions?: any[];
  runId?: string;
} | null> {
  if (!hasOpenAIKey) {
    return null;
  }

  try {
    console.log('🤖 Assistant API chat - simplified implementation');
    
    // For now, return a placeholder response
    // Full implementation would use OpenAI Assistant API
    return {
      message: "Assistant API integration in progress. Using standard chat for now.",
      runId: `run-${Date.now()}`
    };
  } catch (error) {
    console.error('Assistant chat failed:', error);
    return null;
  }
}

/**
 * Get conversation history from a thread
 */
export async function getThreadHistory(threadId: string): Promise<any[] | null> {
  if (!hasOpenAIKey) {
    return null;
  }

  try {
    const messages = await openai.beta.threads.messages.list(threadId, {
      order: 'asc',
      limit: 100
    });

    return messages.data.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content[0]?.type === 'text' ? msg.content[0].text.value : '',
      timestamp: new Date(msg.created_at * 1000),
      metadata: msg.metadata
    }));
  } catch (error) {
    console.error('Failed to get thread history:', error);
    return null;
  }
}

/**
 * Delete an assistant (cleanup)
 */
export async function deleteAssistant(assistantId: string): Promise<boolean> {
  if (!hasOpenAIKey) {
    return false;
  }

  try {
    await openai.beta.assistants.delete(assistantId);
    console.log(`🗑️ Deleted assistant: ${assistantId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete assistant:', error);
    return false;
  }
}