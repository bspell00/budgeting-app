import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface StructuredInsight {
  category: string;
  insight: string;
  confidence: number;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    // Get recent conversation history (last 30 messages for analysis)
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    if (messages.length === 0) {
      return res.json({ insights: [], message: 'No conversation history to analyze' });
    }

    // Prepare conversation text for analysis
    const conversationText = messages.reverse()
      .map((msg: any) => `${msg.type.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Extract structured insights using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert financial analyst. Analyze this conversation between a user and their AI financial assistant to extract structured insights.

Extract key financial insights, patterns, preferences, and actionable recommendations from the conversation.

Respond with a JSON array of insights. Each insight should have:
- category: The financial category (e.g., "spending_patterns", "budget_preferences", "debt_strategy", "goals", "concerns")
- insight: A clear, specific insight about the user's financial situation or behavior
- confidence: A number 0-100 indicating how confident you are in this insight
- actionable: Boolean indicating if this insight leads to specific actions
- priority: "high", "medium", or "low" based on financial impact
- tags: Array of relevant tags for categorization

Focus on:
- Spending patterns and habits
- Budget preferences and pain points
- Financial goals and priorities
- Risk tolerance and preferences
- Debt management approaches
- Investment interests
- Saving behaviors

Only extract insights that are clearly supported by the conversation content.`
        },
        {
          role: "user",
          content: `Analyze this financial conversation for structured insights:\n\n${conversationText}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No insights generated');
    }

    let structuredInsights;
    try {
      const parsed = JSON.parse(responseContent);
      structuredInsights = parsed.insights || parsed;
    } catch (parseError) {
      console.error('Failed to parse AI insights response:', parseError);
      throw new Error('Invalid insights response format');
    }

    // Validate and clean insights
    const validInsights = Array.isArray(structuredInsights) 
      ? structuredInsights.filter((insight: any) => 
          insight.category && 
          insight.insight && 
          typeof insight.confidence === 'number' &&
          ['high', 'medium', 'low'].includes(insight.priority)
        )
      : [];

    // Sort by priority and confidence
    const sortedInsights = validInsights.sort((a: any, b: any) => {
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      const priorityDiff = bPriority - aPriority;
      return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence;
    });

    res.json({
      insights: sortedInsights.slice(0, 20), // Limit to top 20 insights
      messageCount: messages.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error extracting conversation insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to extract insights',
      details: errorMessage
    });
  }
}