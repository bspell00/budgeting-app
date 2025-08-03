import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasKey) {
    return res.status(200).json({
      status: 'error',
      message: 'OpenAI API key not configured',
      hasKey: false
    });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test with a simple completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'API key working'" }],
      max_tokens: 10,
      temperature: 0
    });

    const response = completion.choices[0]?.message?.content || '';

    return res.status(200).json({
      status: 'success',
      message: 'OpenAI API key is working',
      hasKey: true,
      testResponse: response,
      model: 'gpt-4o-mini'
    });

  } catch (error: any) {
    return res.status(200).json({
      status: 'error',
      message: 'OpenAI API key invalid or failed',
      hasKey: true,
      error: error.message || 'Unknown error',
      errorType: error.type || 'unknown'
    });
  }
}