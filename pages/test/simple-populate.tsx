import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function SimplePopulate() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const sampleBudgets = [
    // Credit Card Payments
    { name: 'Chase Sapphire Rewards', amount: 500, category: 'Credit Card Payments' },
    { name: 'Adrienne\'s Barclay Arrival', amount: 300, category: 'Credit Card Payments' },
    { name: 'Brandon\'s Barclay Arrival', amount: 250, category: 'Credit Card Payments' },
    { name: 'Amazon Store Card', amount: 150, category: 'Credit Card Payments' },
    { name: 'American Express Gold Card', amount: 800, category: 'Credit Card Payments' },
    
    // Auto Loans
    { name: '2021 Ram 1500', amount: 650, category: 'Auto Loans' },
    { name: '2023 Hyundai Palisade', amount: 720, category: 'Auto Loans' },
    
    // Monthly Bills
    { name: 'Mortgage', amount: 2800, category: 'Monthly Bills' },
    { name: 'Electric', amount: 180, category: 'Monthly Bills' },
    { name: 'Gas', amount: 120, category: 'Monthly Bills' },
    { name: 'Water', amount: 85, category: 'Monthly Bills' },
    { name: 'Internet', amount: 95, category: 'Monthly Bills' },
    { name: 'Car Insurance', amount: 220, category: 'Monthly Bills' },
    { name: 'Cellphone', amount: 150, category: 'Monthly Bills' },
    { name: 'Subscriptions', amount: 75, category: 'Monthly Bills' },
    { name: 'HELOC Payments', amount: 1200, category: 'Monthly Bills' },
    
    // Frequent Spending
    { name: 'Groceries', amount: 800, category: 'Frequent Spending' },
    { name: 'Eating Out', amount: 400, category: 'Frequent Spending' },
    { name: 'Transportation', amount: 300, category: 'Frequent Spending' },
    { name: 'Tithing', amount: 1000, category: 'Frequent Spending' },
    
    // Non-Monthly
    { name: 'Auto Maintenance', amount: 200, category: 'Non-Monthly' },
    { name: 'Clothing', amount: 300, category: 'Non-Monthly' },
    { name: 'Gifts', amount: 200, category: 'Non-Monthly' },
    { name: 'Medical', amount: 250, category: 'Non-Monthly' },
    { name: 'Emergency Fund', amount: 500, category: 'Non-Monthly' },
    
    // Sully & Remi
    { name: 'Childcare', amount: 800, category: 'Sully & Remi' },
    { name: 'Lunch Money', amount: 120, category: 'Sully & Remi' },
    { name: 'Extracurricular', amount: 200, category: 'Sully & Remi' },
    { name: 'Teacher Gifts', amount: 50, category: 'Sully & Remi' },
  ];

  const clearAndPopulate = async () => {
    setIsLoading(true);
    setResults([]);

    try {
      // First, clear existing budgets by calling the seed API
      const clearResponse = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (clearResponse.ok) {
        setResults([{ budget: 'Clear existing data', success: true }]);
      } else {
        setResults([{ budget: 'Clear existing data', success: false, error: 'Failed to clear' }]);
      }

      // Then create new budgets with proper categories
      const results = [{ budget: 'Clear existing data', success: true }];
      
      for (const budget of sampleBudgets) {
        try {
          const response = await fetch('/api/budgets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(budget),
          });

          if (response.ok) {
            results.push({ budget: budget.name, success: true });
          } else {
            const error = await response.text();
            results.push({ budget: budget.name, success: false, error: error } as any);
          }
        } catch (error) {
          results.push({ budget: budget.name, success: false, error: 'Network error' } as any);
        }
      }

      setResults(results);
    } catch (error) {
      setResults([{ budget: 'General', success: false, error: 'Failed to populate' } as any]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Login</h1>
          <p className="text-gray-600">You need to be logged in to populate the dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Simple Dashboard Population
        </h1>
        
        <div className="space-y-4">
          <p className="text-gray-600">
            This will create {sampleBudgets.length} sample budget categories using your YNAB categories.
          </p>

          <button
            onClick={clearAndPopulate}
            disabled={isLoading}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Creating Budgets...' : 'Clear & Create YNAB Categories'}
          </button>

          {results.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="font-medium text-gray-900">Results:</h3>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-sm ${
                      result.success
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {result.budget}: {result.success ? '✓ Created' : `✗ ${result.error}`}
                  </div>
                ))}
              </div>
              
              {results.some(r => r.success) && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    Success! Some budgets were created.
                  </p>
                  <p className="text-sm mt-1">
                    <a href="/" className="text-blue-600 hover:text-blue-700 underline">
                      Go to Dashboard
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}