import crypto from 'crypto';

export interface OBPAccount {
  id: string;
  bank_id: string;
  label: string;
  type: string;
  balance: {
    currency: string;
    amount: string;
  };
  owners: any[];
}

export interface OBPTransaction {
  id: string;
  account: {
    id: string;
    bank_id: string;
  };
  counterparty: {
    name: string;
  };
  details: {
    type: string;
    description: string;
    posted: string;
    completed: string;
    new_balance: {
      currency: string;
      amount: string;
    };
    value: {
      currency: string;
      amount: string;
    };
  };
  metadata: {
    narrative: string;
    comments: any[];
    tags: any[];
    images: any[];
    where_tag: any;
  };
}

export class OBPClient {
  private baseUrl: string;
  private apiVersion: string;
  private username: string;
  private password: string;
  private consumerKey: string;
  private consumerSecret: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = process.env.OBP_BASE_URL || 'https://apisandbox.openbankproject.com';
    this.apiVersion = process.env.OBP_API_VERSION || 'v4.0.0';
    this.username = process.env.OBP_USERNAME || '';
    this.password = process.env.OBP_PASSWORD || '';
    this.consumerKey = process.env.OBP_CONSUMER_KEY || '';
    this.consumerSecret = process.env.OBP_CONSUMER_SECRET || '';
  }

  // Direct Login authentication (corrected)
  async authenticate(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    // Try multiple possible DirectLogin endpoints
    const possibleUrls = [
      `${this.baseUrl}/obp/${this.apiVersion}/my/logins/direct`,
      `${this.baseUrl}/obp/${this.apiVersion}/users/direct-login`, 
      `${this.baseUrl}/obp/${this.apiVersion}/banks/rbs/users/direct-login`,
      `${this.baseUrl}/my/logins/direct`,
      `${this.baseUrl}/users/direct-login`
    ];
    
    console.log('Attempting DirectLogin authentication...');
    console.log('Username:', this.username);
    console.log('Consumer Key:', this.consumerKey ? 'Present' : 'Missing');
    
    for (const url of possibleUrls) {
      console.log('Trying URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `DirectLogin username="${this.username}",password="${this.password}",consumer_key="${this.consumerKey}"`
        }
      });

      console.log(`Response status for ${url}:`, response.status);
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log('DirectLogin response data:', data);
          
          if (data.token) {
            this.token = data.token;
            console.log('Successfully authenticated with URL:', url);
            return data.token;
          }
        } catch (parseError) {
          console.log('Failed to parse response as JSON for URL:', url);
          continue;
        }
      } else {
        const errorText = await response.text();
        console.log(`Error response for ${url}:`, errorText.substring(0, 200));
      }
    }
    
    throw new Error('DirectLogin authentication failed on all possible endpoints. Check your credentials and consumer key.');
  }

  // Get user's accounts
  async getAccounts(): Promise<OBPAccount[]> {
    const token = await this.authenticate();
    
    // Try multiple possible accounts endpoints
    const possibleUrls = [
      `${this.baseUrl}/obp/${this.apiVersion}/my/accounts/private`,
      `${this.baseUrl}/obp/${this.apiVersion}/my/accounts`,
      `${this.baseUrl}/obp/${this.apiVersion}/accounts/private`,
      `${this.baseUrl}/obp/${this.apiVersion}/accounts`,
      `${this.baseUrl}/my/accounts/private`,
      `${this.baseUrl}/my/accounts`
    ];
    
    for (const url of possibleUrls) {
      console.log('Trying accounts URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `DirectLogin token="${token}"`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Accounts response status for ${url}:`, response.status);
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log('Accounts response data:', data);
          console.log('Successfully got accounts with URL:', url);
          return data.accounts || data || [];
        } catch (parseError) {
          console.log('Failed to parse accounts response as JSON for URL:', url);
          continue;
        }
      } else {
        const errorText = await response.text();
        console.log(`Accounts error response for ${url}:`, errorText.substring(0, 200));
      }
    }
    
    throw new Error('Failed to get accounts from all possible endpoints. The user may not have any accounts or the API endpoints have changed.');
  }

  // Get account details
  async getAccount(bankId: string, accountId: string): Promise<OBPAccount> {
    const token = await this.authenticate();
    
    const url = `${this.baseUrl}/obp/${this.apiVersion}/my/banks/${bankId}/accounts/${accountId}/account`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `DirectLogin token="${token}"`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get account: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  // Get account transactions
  async getTransactions(bankId: string, accountId: string, limit: number = 100): Promise<OBPTransaction[]> {
    const token = await this.authenticate();
    
    const url = `${this.baseUrl}/obp/${this.apiVersion}/my/banks/${bankId}/accounts/${accountId}/transactions?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `DirectLogin token="${token}"`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get transactions: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.transactions || [];
  }

  // Get banks
  async getBanks(): Promise<any[]> {
    const url = `${this.baseUrl}/obp/${this.apiVersion}/banks`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get banks: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.banks || [];
  }

  // Create a test account (sandbox only)
  async createTestAccount(bankId: string, accountData?: any): Promise<any> {
    const token = await this.authenticate();
    
    const url = `${this.baseUrl}/obp/${this.apiVersion}/banks/${bankId}/accounts`;
    
    const defaultAccountData = {
      user_id: this.username,
      label: accountData?.label || 'Test Account',
      type: accountData?.type || 'CURRENT',
      balance: accountData?.balance || {
        currency: 'USD',
        amount: '1000.00'
      }
    };
    
    console.log('Creating account with data:', defaultAccountData);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DirectLogin token="${token}"`
      },
      body: JSON.stringify(defaultAccountData)
    });

    console.log('Account creation response status:', response.status);
    const responseText = await response.text();
    console.log('Account creation response:', responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`Failed to create test account: ${response.status} ${response.statusText} - ${responseText}`);
    }

    return JSON.parse(responseText);
  }
}

export default OBPClient;