import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { PrismaClient, AIAssistant } from '@prisma/client';
import { createOrGetAssistant, createThread } from '../../../lib/assistant';

const prisma = new PrismaClient();

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

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  try {
    console.log(`🤖 Setting up AI Assistant for user ${userId}`);

    // Check if user already has an assistant
    let existingAssistant = await (prisma as any).aIAssistant.findUnique({
      where: { userId }
    });

    if (existingAssistant && existingAssistant.isActive) {
      return res.json({
        message: 'Assistant already exists and is active',
        assistant: existingAssistant,
        isNew: false
      });
    }

    // Create new OpenAI Assistant
    const assistantId = await createOrGetAssistant(userId);
    if (!assistantId) {
      throw new Error('Failed to create OpenAI Assistant');
    }

    // Create conversation thread
    const threadId = await createThread();
    if (!threadId) {
      throw new Error('Failed to create conversation thread');
    }

    // Save to database
    const aiAssistant = existingAssistant 
      ? await (prisma as any).aIAssistant.update({
          where: { userId },
          data: {
            assistantId,
            threadId,
            isActive: true,
            updatedAt: new Date()
          }
        })
      : await (prisma as any).aIAssistant.create({
          data: {
            userId,
            assistantId,
            threadId,
            name: 'Finley',
            isActive: true
          }
        });

    console.log(`✅ AI Assistant setup complete for user ${userId}`);
    console.log(`   Assistant ID: ${assistantId}`);
    console.log(`   Thread ID: ${threadId}`);

    res.json({
      message: 'AI Assistant setup successfully',
      assistant: aiAssistant,
      isNew: true,
      capabilities: [
        'Persistent conversation memory',
        'Deep financial analysis',
        'Code execution for complex calculations',
        'Long-term goal tracking',
        'Personalized advice evolution'
      ]
    });

  } catch (error) {
    console.error('AI Assistant setup failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to setup AI Assistant',
      details: errorMessage
    });
  }
}