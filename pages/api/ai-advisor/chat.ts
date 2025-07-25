import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { AIConversationalAdvisor } from '../../../lib/ai-conversational-advisor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

  if (req.method === 'POST') {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const advisor = new AIConversationalAdvisor(userId);
      const aiResponse = await advisor.processMessage(message.trim());
      
      // Convert AI response to chat format
      const chatResponse = {
        id: `chat-${Date.now()}`,
        userId,
        message: message.trim(),
        response: aiResponse.message,
        context: {},
        suggestedActions: aiResponse.suggestedActions?.map(a => a.description) || [],
        budgetChanges: aiResponse.budgetRecommendations || [],
        quickReplies: aiResponse.followUpQuestions || [
          'Tell me more',
          'What should I do next?',
          'Help with something else'
        ],
        customPlan: aiResponse.customPlan,
        urgencyLevel: aiResponse.urgencyLevel,
        confidence: aiResponse.confidence,
        timestamp: new Date()
      };
      
      res.json({
        success: true,
        data: chatResponse
      });
    } catch (error) {
      console.error('Error processing chat message:', error);
      res.status(500).json({ 
        error: 'Failed to process message',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else if (req.method === 'GET') {
    // Get chat history (simplified - in production you'd store this in database)
    try {
      res.json({
        success: true,
        data: {
          messages: [],
          conversationStarted: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({ 
        error: 'Failed to get chat history',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}