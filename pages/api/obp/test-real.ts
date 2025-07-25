import { NextApiRequest, NextApiResponse } from 'next';
import { OBPClient } from '../../../lib/obp-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const obpClient = new OBPClient();
    
    console.log('Testing real OBP authentication...');
    console.log('Base URL:', process.env.OBP_BASE_URL);
    console.log('API Version:', process.env.OBP_API_VERSION);
    console.log('Username:', process.env.OBP_USERNAME);
    console.log('Consumer Key:', process.env.OBP_CONSUMER_KEY ? 'Present' : 'Missing');
    
    // Test authentication
    const token = await obpClient.authenticate();
    console.log('Authentication successful, token:', token);
    
    // Test getting banks
    const banks = await obpClient.getBanks();
    console.log('Available banks:', banks.length);
    
    // Test getting accounts
    try {
      const accounts = await obpClient.getAccounts();
      console.log('User accounts:', accounts.length);
      
      res.json({ 
        success: true, 
        message: 'Real OBP connection successful!',
        authentication: 'Working',
        banks: banks.length,
        accounts: accounts.length,
        bankNames: banks.slice(0, 3).map(b => b.full_name || b.short_name),
        accountTypes: accounts.map(a => a.type)
      });
    } catch (accountError) {
      console.log('No accounts found (you may need to create some):', accountError instanceof Error ? accountError.message : "Unknown error");
      res.json({ 
        success: true, 
        message: 'OBP authentication works, but no accounts found',
        authentication: 'Working',
        banks: banks.length,
        accounts: 0,
        bankNames: banks.slice(0, 3).map(b => b.full_name || b.short_name),
        note: 'You may need to create test accounts or connect real bank accounts'
      });
    }
  } catch (error) {
    console.error('Real OBP test failed:', error);
    res.status(500).json({ 
      error: 'Real OBP connection failed',
      details: error instanceof Error ? error.message : "Unknown error",
      authenticationStatus: 'Failed'
    });
  }
}