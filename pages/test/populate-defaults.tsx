import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function PopulateDefaults() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePopulate = async (overwrite = false) => {
    if (!session) {
      setError('You must be logged in');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/budgets/populate-defaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ overwrite }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        console.error('API Error:', data);
        setError(data.error || 'Failed to populate defaults');
        if (data.message) {
          setError(`${data.error}: ${data.message}`);
        }
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
        <h1 className="text-2xl font-bold mb-4">Populate Default Budgets</h1>
        <p>Please log in to use this feature.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Populate Default Budget Categories</h1>
      <p className="mb-6 text-gray-600">
        This will create the predefined budget categories (Bills, Frequent, Non-Monthly, Goals, Quality of Life).
      </p>

      <div className="space-y-4">
        <button
          onClick={() => handlePopulate(false)}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Default Budgets'}
        </button>

        <button
          onClick={() => handlePopulate(true)}
          disabled={loading}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 ml-4"
        >
          {loading ? 'Replacing...' : 'Replace Existing Budgets'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-bold">Success!</h3>
          <p>{result.message}</p>
          <p>Created {result.createdCount} budget categories for {result.month}/{result.year}</p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Default Categories:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <h3 className="font-medium text-blue-600">Bills</h3>
            <ul className="text-sm text-gray-600">
              <li>Rent/Mortgage</li>
              <li>Electric</li>
              <li>Water</li>
              <li>Internet</li>
              <li>Cellphone</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-green-600">Frequent</h3>
            <ul className="text-sm text-gray-600">
              <li>Groceries</li>
              <li>Eating Out</li>
              <li>Transportation</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-purple-600">Non-Monthly</h3>
            <ul className="text-sm text-gray-600">
              <li>Home Maintenance</li>
              <li>Auto Maintenance</li>
              <li>Gifts</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-orange-600">Goals</h3>
            <ul className="text-sm text-gray-600">
              <li>Vacation</li>
              <li>Education</li>
              <li>Home Improvement</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-pink-600">Quality of Life</h3>
            <ul className="text-sm text-gray-600">
              <li>Hobbies</li>
              <li>Entertainment</li>
              <li>Health & Wellness</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}