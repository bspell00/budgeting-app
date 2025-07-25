import { NextApiRequest, NextApiResponse } from 'next';
import { MockBankService } from '../../../lib/mock-bank-data';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mockBankService = new MockBankService();
    
    // Test authentication
    const token = await mockBankService.authenticate();
    console.log('Authentication successful, token:', token);
    
    // Test getting banks
    const banks = await mockBankService.getBanks();
    console.log('Banks:', banks);
    
    // Test getting accounts
    const accounts = await mockBankService.getAccounts();
    console.log('Accounts:', accounts);
    
    // Test getting transactions for first account
    if (accounts.length > 0) {
      const transactions = await mockBankService.getTransactions(accounts[0].bank_id, accounts[0].id, 5);
      console.log('Sample transactions:', transactions.slice(0, 3));
      
      res.json({ 
        success: true, 
        message: 'Mock bank service working perfectly!',
        token: token ? 'Present' : 'Missing',
        banks: banks.length,
        accounts: accounts.length,
        sampleTransactions: transactions.length
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Mock bank service working, but no accounts found',
        token: token ? 'Present' : 'Missing',
        banks: banks.length,
        accounts: 0
      });
    }
  } catch (error) {
    console.error('Mock bank test failed:', error);
    res.status(500).json({ 
      error: 'Mock bank service failed',
      details: (error as Error).message 
    });
  }
}