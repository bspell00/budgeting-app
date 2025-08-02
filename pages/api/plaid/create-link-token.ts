import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

const PLAID_BASE_URLS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com'
};

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
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    const baseUrl = PLAID_BASE_URLS[plaidEnv as keyof typeof PLAID_BASE_URLS];
    
    const response = await fetch(`${baseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
        'PLAID-SECRET': process.env.PLAID_SECRET!,
      },
      body: JSON.stringify({
        client_name: 'Budgeting App',
        country_codes: ['US'],
        language: 'en',
        user: {
          client_user_id: userId,
        },
        products: ['transactions'],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Plaid API error:', errorData);
      console.error('Request that failed:', {
        url: `${baseUrl}/link/token/create`,
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET ? 'Present' : 'Missing',
        },
        body: {
          client_name: 'Budgeting App',
          country_codes: ['US'],
          language: 'en',
          user: { client_user_id: userId },
          products: ['transactions'],
        }
      });
      throw new Error(`Plaid API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    res.json({ link_token: data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}