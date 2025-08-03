import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  
  // Check which environment variables are set (without exposing actual values)
  const envCheck = {
    environment,
    timestamp: new Date().toISOString(),
    checks: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      PLAID_CLIENT_ID: !!process.env.PLAID_CLIENT_ID,
      PLAID_SECRET: !!process.env.PLAID_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      FROM_EMAIL: !!process.env.FROM_EMAIL,
      ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY
    },
    // Show first/last few characters for verification (safely)
    preview: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 
        `${process.env.OPENAI_API_KEY.substring(0, 8)}...${process.env.OPENAI_API_KEY.slice(-4)}` : 
        null,
      PLAID_ENV: process.env.PLAID_ENV || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set'
    }
  };

  // Count missing keys
  const missingKeys = Object.entries(envCheck.checks)
    .filter(([key, exists]) => !exists)
    .map(([key]) => key);

  const response = {
    ...envCheck,
    status: missingKeys.length === 0 ? 'healthy' : 'missing_keys',
    missingKeys,
    summary: `${Object.keys(envCheck.checks).length - missingKeys.length}/${Object.keys(envCheck.checks).length} environment variables configured`
  };

  return res.status(200).json(response);
}