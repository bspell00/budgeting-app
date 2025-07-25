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
    
    // Try to import sample data for the sandbox
    const sampleDataUrl = `${obpClient['baseUrl']}/obp/${obpClient['apiVersion']}/sandbox/data-import`;
    
    const response = await fetch(sampleDataUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DirectLogin token="${obpClient['token']}"`
      },
      body: JSON.stringify({
        banks: [
          {
            id: "rbs",
            short_name: "RBS",
            full_name: "The Royal Bank of Scotland",
            logo: "https://static.openbankproject.com/images/sandbox/bank_logos/rbs.png",
            website: "https://www.rbs.co.uk/"
          }
        ],
        users: [
          {
            email: process.env.OBP_USERNAME + "@example.com",
            password: process.env.OBP_PASSWORD,
            display_name: "Test User"
          }
        ],
        accounts: [
          {
            id: "savings-01",
            bank_id: "rbs",
            label: "Savings Account",
            number: "123456789",
            type: "CURRENT",
            balance: {
              currency: "USD",
              amount: "2500.00"
            },
            IBAN: "GB33BUKB20201555555555",
            owners: [process.env.OBP_USERNAME + "@example.com"]
          },
          {
            id: "checking-01", 
            bank_id: "rbs",
            label: "Checking Account",
            number: "987654321",
            type: "CURRENT",
            balance: {
              currency: "USD",
              amount: "1750.50"
            },
            IBAN: "GB33BUKB20201555555556",
            owners: [process.env.OBP_USERNAME + "@example.com"]
          }
        ]
      })
    });

    console.log('Sample data import response status:', response.status);
    const responseText = await response.text();
    console.log('Sample data import response:', responseText.substring(0, 500));

    if (!response.ok) {
      // If sample data import fails, try a different approach
      console.log('Sample data import failed, trying alternative...');
      
      // Check if there are any existing accounts we can access
      const accounts = await obpClient.getAccounts();
      
      return res.json({
        success: false,
        message: 'Could not create sample data, but found existing accounts',
        accounts: accounts.length,
        accountData: accounts,
        note: 'The OBP sandbox might not allow account creation. Try using existing accounts or check OBP documentation.'
      });
    }

    // If successful, try to get the created accounts
    const accounts = await obpClient.getAccounts();
    
    res.json({
      success: true,
      message: `Successfully imported sample data`,
      accounts: accounts.length,
      accountData: accounts
    });
    
  } catch (error) {
    console.error('Error importing sample data:', error);
    res.status(500).json({ 
      error: 'Failed to import sample data',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" 
    });
  }
}