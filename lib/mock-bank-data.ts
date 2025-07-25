// Mock banking data service to simulate real bank integration
// This lets us test the full app functionality without dealing with complex API authentication

export interface MockAccount {
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

export interface MockTransaction {
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

export class MockBankService {
  private username: string;
  private password: string;

  constructor() {
    this.username = process.env.OBP_USERNAME || '';
    this.password = process.env.OBP_PASSWORD || '';
  }

  // Mock authentication
  async authenticate(): Promise<string> {
    if (!this.username || !this.password) {
      throw new Error('Username and password required');
    }
    
    // Simulate authentication delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return 'mock-auth-token';
  }

  // Mock get accounts
  async getAccounts(): Promise<MockAccount[]> {
    await this.authenticate();
    
    return [
      {
        id: 'acc-checking-001',
        bank_id: 'mock-bank-001',
        label: 'Main Checking',
        type: 'CHECKING',
        balance: {
          currency: 'USD',
          amount: '2500.75'
        },
        owners: []
      },
      {
        id: 'acc-savings-001',
        bank_id: 'mock-bank-001',
        label: 'Savings Account',
        type: 'SAVINGS',
        balance: {
          currency: 'USD',
          amount: '8750.00'
        },
        owners: []
      },
      {
        id: 'acc-credit-001',
        bank_id: 'mock-bank-001',
        label: 'Chase Freedom Credit Card',
        type: 'CREDIT',
        balance: {
          currency: 'USD',
          amount: '-1250.45'
        },
        owners: []
      }
    ];
  }

  // Mock get transactions
  async getTransactions(bankId: string, accountId: string, limit: number = 50): Promise<MockTransaction[]> {
    await this.authenticate();
    
    const baseDate = new Date();
    const transactions: MockTransaction[] = [];
    
    // Generate realistic mock transactions
    const mockTransactionData = [
      { description: 'Amazon.com Purchase', amount: '-87.99', category: 'Shopping' },
      { description: 'Starbucks Coffee', amount: '-5.47', category: 'Food & Dining' },
      { description: 'Salary Deposit', amount: '3200.00', category: 'Income' },
      { description: 'Grocery Store', amount: '-156.78', category: 'Groceries' },
      { description: 'Gas Station', amount: '-45.23', category: 'Transportation' },
      { description: 'Electric Bill', amount: '-89.56', category: 'Utilities' },
      { description: 'Netflix Subscription', amount: '-15.99', category: 'Entertainment' },
      { description: 'ATM Withdrawal', amount: '-100.00', category: 'Cash' },
      { description: 'Restaurant Dinner', amount: '-67.89', category: 'Food & Dining' },
      { description: 'Target Purchase', amount: '-124.55', category: 'Shopping' },
      { description: 'Internet Bill', amount: '-79.99', category: 'Utilities' },
      { description: 'Uber Ride', amount: '-18.75', category: 'Transportation' },
      { description: 'Pharmacy', amount: '-23.45', category: 'Healthcare' },
      { description: 'Credit Card Payment', amount: '-500.00', category: 'Transfer' },
      { description: 'Apple Store', amount: '-299.99', category: 'Shopping' }
    ];

    for (let i = 0; i < Math.min(limit, mockTransactionData.length); i++) {
      const txData = mockTransactionData[i];
      const txDate = new Date(baseDate.getTime() - (i * 24 * 60 * 60 * 1000)); // Spread over days
      
      transactions.push({
        id: `tx-${accountId}-${i.toString().padStart(3, '0')}`,
        account: {
          id: accountId,
          bank_id: bankId
        },
        counterparty: {
          name: txData.description
        },
        details: {
          type: parseFloat(txData.amount) > 0 ? 'CREDIT' : 'DEBIT',
          description: txData.description,
          posted: txDate.toISOString(),
          completed: txDate.toISOString(),
          new_balance: {
            currency: 'USD',
            amount: '0.00' // Mock balance
          },
          value: {
            currency: 'USD',
            amount: txData.amount
          }
        },
        metadata: {
          narrative: txData.description,
          comments: [],
          tags: [],
          images: [],
          where_tag: null
        }
      });
    }

    return transactions;
  }

  // Mock get account details
  async getAccount(bankId: string, accountId: string): Promise<MockAccount> {
    const accounts = await this.getAccounts();
    const account = accounts.find(acc => acc.id === accountId && acc.bank_id === bankId);
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    return account;
  }

  // Mock get banks
  async getBanks(): Promise<any[]> {
    return [
      {
        id: 'mock-bank-001',
        full_name: 'Mock Bank Demo',
        short_name: 'MockBank',
        website: 'https://mockbank.example.com'
      }
    ];
  }
}

export default MockBankService;