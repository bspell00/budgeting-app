import { NextApiRequest, NextApiResponse } from 'next';
import { OBPClient } from '../../../lib/obp-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const obpClient = new OBPClient();
    
    // First, authenticate
    await obpClient.authenticate();
    
    // Get available banks
    const banks = await obpClient.getBanks();
    console.log('Available banks:', banks.length);
    
    if (banks.length === 0) {
      return res.status(404).json({ error: 'No banks available' });
    }
    
    // Use the first available bank (or Test Bank if available)
    const testBank = banks.find(b => b.short_name === 'Test Bank') || banks[0];
    console.log('Using bank:', testBank.short_name);
    
    const createdAccounts = [];
    
    // Create test accounts
    const accountsToCreate = [
      {
        label: 'My Checking Account',
        type: 'CURRENT',
        balance: { currency: 'USD', amount: '2500.75' }
      },
      {
        label: 'My Savings Account', 
        type: 'SAVINGS',
        balance: { currency: 'USD', amount: '8750.00' }
      },
      {
        label: 'My Credit Card',
        type: 'CREDIT_CARD',
        balance: { currency: 'USD', amount: '-1250.45' }
      }
    ];
    
    for (const accountData of accountsToCreate) {
      try {
        const account = await obpClient.createTestAccount(testBank.id, accountData);
        createdAccounts.push(account);
        console.log(`Created account: ${accountData.label}`);
      } catch (error) {
        console.error(`Failed to create account ${accountData.label}:`, error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : "Unknown error");
      }
    }
    
    res.json({
      success: true,
      message: `Successfully created ${createdAccounts.length} test accounts`,
      bank: testBank.short_name,
      accounts: createdAccounts.length,
      accountTypes: createdAccounts.map(a => a.type || 'Unknown')
    });
    
  } catch (error) {
    console.error('Error creating test accounts:', error);
    res.status(500).json({ 
      error: 'Failed to create test accounts',
      details: error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : "Unknown error" 
    });
  }
}