import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { OBPClient } from '../../../lib/obp-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== Debug Connect Start ===');
    
    // Step 1: Check session
    const session = await getServerSession(req, res, authOptions);
    console.log('Session check:', session?.user ? 'OK' : 'FAILED');
    
    if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return res.status(401).json({ error: 'No user ID found' });
  }

    // Step 2: Create OBP client
    console.log('Creating OBP client...');
    const obpClient = new OBPClient();
    console.log('OBP client created successfully');

    // Step 3: Test authentication
    console.log('Testing authentication...');
    try {
      const token = await obpClient.authenticate();
      console.log('Authentication successful:', token ? 'Token received' : 'No token');
    } catch (authError) {
      console.error('Authentication failed:', authError instanceof Error ? authError.message : "Unknown error");
      return res.status(500).json({ 
        error: 'Authentication failed',
        details: authError instanceof Error ? authError.message : "Unknown error",
        step: 'authentication'
      });
    }

    // Step 4: Test getting accounts
    console.log('Testing get accounts...');
    try {
      const accounts = await obpClient.getAccounts();
      console.log('Get accounts successful. Count:', accounts.length);
      
      return res.json({
        success: true,
        step: 'accounts',
        accounts: accounts.length,
        message: 'Debug successful - OBP connection working'
      });
    } catch (accountError) {
      console.error('Get accounts failed:', accountError instanceof Error ? accountError.message : "Unknown error");
      return res.status(500).json({ 
        error: 'Get accounts failed',
        details: accountError instanceof Error ? accountError.message : "Unknown error",
        step: 'accounts'
      });
    }

  } catch (error) {
    console.error('=== Debug Connect Error ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : 'UnknownError');
    console.error('Error message:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : "Unknown error");
    console.error('Error stack:', error instanceof Error ? error instanceof Error ? error instanceof Error ? error.stack : "No stack trace" : "No stack trace" : "No stack trace");
    
    res.status(500).json({ 
      error: 'Debug connect failed',
      details: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : "Unknown error",
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      step: 'unknown'
    });
  }
}