import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useDashboard } from '../../hooks/useDashboard';
import { useTransactions } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';

export default function SWRTest() {
  const { data: session } = useSession();
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  
  // SWR hooks
  const { 
    data: dashboardData, 
    error: dashboardError, 
    isLoading: dashboardLoading,
    updateBudgetOptimistic,
    createBudgetOptimistic,
    deleteBudgetOptimistic
  } = useDashboard();
  
  const {
    data: transactionsData,
    error: transactionsError,
    isLoading: transactionsLoading
  } = useTransactions();
  
  const {
    data: accountsData,
    error: accountsError,
    isLoading: accountsLoading
  } = useAccounts();

  const handleCreateBudget = async () => {
    if (!budgetName || !budgetAmount) return;
    
    try {
      await createBudgetOptimistic({
        name: budgetName,
        amount: parseFloat(budgetAmount),
        category: 'Test Category'
      });
      setBudgetName('');
      setBudgetAmount('');
    } catch (error) {
      console.error('Failed to create budget:', error);
    }
  };

  const handleUpdateBudget = async (budgetId: string, newAmount: number) => {
    try {
      await updateBudgetOptimistic(budgetId, { amount: newAmount });
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Login</h1>
          <p className="text-gray-600">You need to be logged in to test SWR functionality.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          SWR Real-time Updates Test
        </h1>
        
        {/* Loading States */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Loading States</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>Dashboard: {dashboardLoading ? '🔄 Loading...' : '✅ Loaded'}</div>
            <div>Transactions: {transactionsLoading ? '🔄 Loading...' : '✅ Loaded'}</div>
            <div>Accounts: {accountsLoading ? '🔄 Loading...' : '✅ Loaded'}</div>
          </div>
        </div>

        {/* Error States */}
        {(dashboardError || transactionsError || accountsError) && (
          <div className="mb-8 p-4 bg-red-50 rounded-lg">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Errors</h2>
            {dashboardError && <div className="text-red-600">Dashboard: {dashboardError.message}</div>}
            {transactionsError && <div className="text-red-600">Transactions: {transactionsError.message}</div>}
            {accountsError && <div className="text-red-600">Accounts: {accountsError.message}</div>}
          </div>
        )}

        {/* Create Budget Test */}
        <div className="mb-8 p-4 bg-green-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Test Optimistic Budget Creation</h2>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Budget Name</label>
              <input
                type="text"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Test Budget"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="100"
              />
            </div>
            <button
              onClick={handleCreateBudget}
              disabled={!budgetName || !budgetAmount}
              className="px-4 py-2 text-white rounded-md disabled:bg-gray-400 transition-colors"
              style={{ backgroundColor: '#aed274' }}
              onMouseEnter={(e) => !e.currentTarget.disabled && ((e.target as HTMLButtonElement).style.backgroundColor = '#9bc267')}
              onMouseLeave={(e) => !e.currentTarget.disabled && ((e.target as HTMLButtonElement).style.backgroundColor = '#aed274')}
            >
              Create Budget
            </button>
          </div>
        </div>

        {/* Dashboard Data Display */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Dashboard Data (Auto-refreshes every 10s)</h2>
          {dashboardData ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-100 rounded">
                <strong>To Be Assigned:</strong> ${dashboardData.toBeAssigned || 0}
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Budget Categories ({dashboardData.categories?.length || 0})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dashboardData.categories?.map((category: any) => (
                    <div key={category.id} className="border rounded p-3">
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">{category.name} ({category.budgets?.length || 0} budgets)</h4>
                      <div className="space-y-1">
                        {category.budgets?.map((budget: any) => (
                          <div key={budget.id} className="p-2 bg-gray-100 rounded flex justify-between items-center">
                            <div>
                              <span className="font-medium">{budget.name}</span>
                              <span className="text-sm text-gray-600 ml-2">(Status: {budget.status})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>${budget.budgeted || 0} budgeted, ${budget.spent || 0} spent</span>
                              <button
                                onClick={() => handleUpdateBudget(budget.id, (budget.budgeted || 0) + 50)}
                                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                              >
                                +$50
                              </button>
                            </div>
                          </div>
                        )) || <div className="text-gray-500 text-sm">No budgets in this category</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">No dashboard data available</div>
          )}
        </div>

        {/* Accounts Data */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Connected Accounts (Auto-refreshes every 30s)</h2>
          {accountsData && accountsData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accountsData.map((account: any) => (
                <div key={account.id} className="p-3 bg-gray-100 rounded">
                  <div className="font-medium">{account.accountName}</div>
                  <div className="text-sm text-gray-600">{account.accountType}</div>
                  <div className="text-lg font-semibold">${account.balance || 0}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No accounts connected</div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">How to Test Real-time Updates:</h3>
          <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
            <li>Open this page in multiple browser tabs</li>
            <li>Create a budget in one tab - watch it appear in other tabs within 10 seconds</li>
            <li>Update budget amounts - see changes propagate automatically</li>
            <li>Data refreshes automatically when you switch between tabs</li>
            <li>Network errors are handled gracefully with rollback</li>
          </ol>
        </div>
      </div>
    </div>
  );
}