import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function CleanupBudgets() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    if (!session) {
      setError('You must be logged in');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/budgets/cleanup-unused', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to cleanup budgets');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Cleanup Unused Budgets</h1>
        <p>Please log in to use this feature.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Cleanup Unused Budget Categories</h1>
      <p className="mb-6 text-gray-600">
        This will remove any budget categories that don't match the predefined list.
      </p>

      <button
        onClick={handleCleanup}
        disabled={loading}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
      >
        {loading ? 'Cleaning up...' : 'Cleanup Unused Budgets'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-bold">Cleanup Complete!</h3>
          <p>{result.message}</p>
          {result.deletedBudgets && result.deletedBudgets.length > 0 && (
            <div className="mt-2">
              <p><strong>Deleted budgets:</strong></p>
              <ul className="list-disc list-inside">
                {result.deletedBudgets.map((name: string, index: number) => (
                  <li key={index}>{name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}