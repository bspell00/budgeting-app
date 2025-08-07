import useSWR, { mutate } from 'swr';
import { useWebSocket } from './useWebSocket';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useDashboard = () => {
  const { data, error, isLoading } = useSWR('/api/dashboard', fetcher, {
    // Reduce polling frequency since WebSocket handles real-time updates
    refreshInterval: 30000, // 30 seconds instead of constant polling
    revalidateOnFocus: false, // WebSocket handles focus-based updates
    revalidateOnReconnect: true,
  });

  const { connected, requestSync, triggerUpdate } = useWebSocket();

  // Simple refresh function that uses WebSocket when available
  const refresh = () => {
    if (connected) {
      requestSync(); // Use WebSocket for instant updates
    } else {
      mutate('/api/dashboard'); // Fallback to SWR refresh
    }
  };

  // Optimistic budget update with WebSocket sync
  const updateBudgetOptimistic = async (budgetId: string, updates: any) => {
    console.log('💰 Optimistic budget update:', budgetId, updates);
    
    // Optimistic update to local cache
    mutate('/api/dashboard', (currentData: any) => {
      if (!currentData?.categories) return currentData;
      
      const updatedCategories = currentData.categories.map((category: any) => ({
        ...category,
        budgets: category.budgets.map((budget: any) => 
          budget.id === budgetId ? { ...budget, ...updates } : budget
        )
      }));
      
      return { ...currentData, categories: updatedCategories };
    }, false);
    
    // Trigger WebSocket sync for real-time updates to all clients
    triggerUpdate('budget');
  };

  // Transaction category update with WebSocket sync
  const updateTransactionCategoriesOptimistic = async (transactionUpdates: any[]) => {
    console.log('💳 Optimistic transaction category updates:', transactionUpdates.length);
    
    // Let the WebSocket handle the complex budget calculation updates
    // This removes the race condition-prone setTimeout logic
    triggerUpdate('transaction');
  };

  // Create budget with WebSocket sync
  const createBudgetOptimistic = async (budgetData: any) => {
    console.log('📝 Creating budget:', budgetData.name);
    
    // Create temporary optimistic entry
    mutate('/api/dashboard', (currentData: any) => {
      if (!currentData) return currentData;
      
      // Add new budget to appropriate category
      const categoryName = budgetData.category || 'Misc';
      const updatedCategories = [...(currentData.categories || [])];
      
      const categoryIndex = updatedCategories.findIndex(cat => cat.name === categoryName);
      if (categoryIndex >= 0) {
        updatedCategories[categoryIndex].budgets.push({
          id: 'temp-' + Date.now(),
          name: budgetData.name,
          budgeted: budgetData.amount,
          spent: 0,
          available: budgetData.amount,
          status: 'on-track'
        });
      }
      
      return { ...currentData, categories: updatedCategories };
    }, false);
    
    triggerUpdate('budget');
  };

  // Delete budget with WebSocket sync
  const deleteBudgetOptimistic = async (budgetId: string) => {
    console.log('🗑 Deleting budget:', budgetId);
    
    // Optimistic removal
    mutate('/api/dashboard', (currentData: any) => {
      if (!currentData?.categories) return currentData;
      
      const updatedCategories = currentData.categories.map((category: any) => ({
        ...category,
        budgets: category.budgets.filter((budget: any) => budget.id !== budgetId)
      })).filter((category: any) => category.budgets.length > 0);
      
      return { ...currentData, categories: updatedCategories };
    }, false);
    
    triggerUpdate('budget');
  };

  return {
    data,
    error,
    isLoading,
    connected,
    updateBudgetOptimistic,
    updateTransactionCategoriesOptimistic,
    createBudgetOptimistic,
    deleteBudgetOptimistic,
    refresh,
  };
};