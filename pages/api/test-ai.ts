import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🧪 Test AI endpoint called');
  
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    console.log('❌ No session found');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  console.log('✅ User ID:', userId);
  
  // Check environment variables
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const openaiKeyLength = process.env.OPENAI_API_KEY?.length || 0;
  
  console.log('🔑 Environment check:', {
    hasOpenAI,
    openaiKeyLength,
    nodeEnv: process.env.NODE_ENV
  });

  try {
    // Test basic response
    const response = {
      message: "Test successful! I can process your request.",
      userId,
      hasOpenAI,
      timestamp: new Date().toISOString(),
      actions: [
        {
          type: 'button',
          label: '✅ Test Complete',
          action: 'test_complete',
          data: { success: true }
        }
      ]
    };
    
    console.log('✅ Test response prepared');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}