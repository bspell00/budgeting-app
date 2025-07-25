import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function PopulateDashboard() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const populateDashboard = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult({ success: true, data });
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (error) {
      setResult({ success: false, error: 'Network error' });
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
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Populate Dashboard
        </h1>
        
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            This will populate your dashboard with sample YNAB categories, budgets, transactions, and goals.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-yellow-800 text-sm">
              <strong>Warning:</strong> This will clear all existing data and replace it with sample data.
            </p>
          </div>

          <button
            onClick={populateDashboard}
            disabled={isLoading}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Populating...' : 'Populate Dashboard'}
          </button>

          {result && (
            <div className={`mt-4 p-3 rounded-lg ${
              result.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {result.success ? (
                <div className="text-green-800">
                  <p className="font-medium">Success!</p>
                  <p className="text-sm mt-1">
                    Created {result.data.data.budgets} budgets, {result.data.data.goals} goals, 
                    and {result.data.data.transactions} transactions.
                  </p>
                  <p className="text-sm mt-2">
                    <a href="/" className="text-blue-600 hover:text-blue-700 underline">
                      Go to Dashboard
                    </a>
                  </p>
                </div>
              ) : (
                <div className="text-red-800">
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}