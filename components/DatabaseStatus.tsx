import React, { useState, useEffect } from 'react';
import { Database, Users, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface DatabaseStatusData {
  database: {
    name: string;
    user: string;
    version: string;
    url: string;
  };
  counts: {
    users: number;
    accounts: number;
    budgets: number;
    transactions: number;
    total: number;
  };
  session: {
    exists: boolean;
    userId: string | null;
    userEmail: string | null;
    sessionUserExistsInDb: boolean;
  };
  issues: Array<{
    type: string;
    message: string;
    solution: string;
  }>;
}

export default function DatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/debug/database-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Show Database Status"
      >
        <Database className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Database Status</span>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Hide"
          >
            ×
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </div>
      )}

      {status && (
        <div className="space-y-3">
          {/* Database Info */}
          <div className="bg-blue-50 rounded p-2">
            <div className="text-xs font-medium text-blue-800 mb-1">PostgreSQL Database</div>
            <div className="text-xs text-blue-700">
              <div>{status.database.name}</div>
              <div>{status.database.version}</div>
            </div>
          </div>

          {/* Data Counts */}
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs font-medium text-gray-800 mb-1">Data Count</div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-700">
              <div>Users: {status.counts.users}</div>
              <div>Accounts: {status.counts.accounts}</div>
              <div>Budgets: {status.counts.budgets}</div>
              <div>Transactions: {status.counts.transactions}</div>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-green-50 rounded p-2">
            <div className="text-xs font-medium text-green-800 mb-1">Session Status</div>
            <div className="text-xs text-green-700">
              {status.session.exists ? (
                <div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Logged in: {status.session.userEmail}</span>
                  </div>
                  {!status.session.sessionUserExistsInDb && (
                    <div className="text-red-600 mt-1">⚠️ User not in database</div>
                  )}
                </div>
              ) : (
                <div>No active session</div>
              )}
            </div>
          </div>

          {/* Issues */}
          {status.issues.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <div className="text-xs font-medium text-yellow-800 mb-1 flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Issues Detected</span>
              </div>
              {status.issues.map((issue, index) => (
                <div key={index} className="text-xs text-yellow-700 mb-2">
                  <div className="font-medium">{issue.type}</div>
                  <div>{issue.message}</div>
                  <div className="text-yellow-600 italic">→ {issue.solution}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {status.issues.length === 0 && status.counts.total > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <div className="text-xs font-medium text-green-800 flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>Database Ready</span>
              </div>
              <div className="text-xs text-green-700">
                PostgreSQL migration successful
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}