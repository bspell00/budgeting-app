import { useState } from 'react';

export default function PlaidTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestPlaidToken = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setError('Network error: ' + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Test Plaid Token Creation</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-gray-600 mb-4">
            This will test if Plaid link token creation is working.
          </p>
          
          <button
            onClick={handleTestPlaidToken}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Plaid Token'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">Error:</h3>
            <pre className="text-red-700 text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {error}
            </pre>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-green-800 font-semibold mb-2">Success!</h3>
            <pre className="text-green-700 text-sm overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-600">
          <p><strong>If this works:</strong> Your Plaid API credentials are correct and token creation is working.</p>
          <p><strong>If this fails:</strong> There's an issue with your Plaid credentials or API setup.</p>
        </div>
      </div>
    </div>
  );
}