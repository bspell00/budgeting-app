import useSWR, { mutate } from 'swr';
import { useEffect } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useDashboard = (month?: number, year?: number) => {
  const url = month && year ? `/api/dashboard?month=${month}&year=${year}` : '/api/dashboard';
  const { data, error, isLoading } = useSWR(url, fetcher, {
    refreshInterval: 0, // Disabled polling - use WebSocket events instead
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    onSuccess: (data) => {
      console.log('💰 Dashboard data updated via SWR:', {
        toBeAssigned: data?.toBeAssigned,
        categoriesCount: data?.categories?.length,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Real-time updates are now handled by the useWebSocket hook in Dashboard
  // The WebSocket hook triggers SWR mutations directly via mutate('/api/dashboard')
  // This ensures the dashboard data stays in sync automatically

  // Simple refresh function for local development
  const refresh = () => {
    mutate(url);
  };

  // Budget update with actual API call
  const updateBudgetOptimistic = async (budgetId: string, updates: any) => {
    console.log('💰 Local: Budget update API call:', budgetId, updates);
    
    try {
      // Make actual API call to update the budget
      const response = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: budgetId,
          ...updates
        })
      });

      if (!response.ok) {
        throw new Error(`Budget update failed: ${response.statusText}`);
      }

      const updatedBudget = await response.json();
      console.log('✅ Budget updated successfully:', updatedBudget);

      // Refresh dashboard data after successful update
      mutate(url);
      
      return updatedBudget;
    } catch (error) {
      console.error('❌ Budget update failed:', error);
      
      // Still refresh dashboard in case of error to get current state
      mutate(url);
      throw error;
    }
  };

  // Transaction category update with immediate refresh
  const updateTransactionCategoriesOptimistic = async (transactionUpdates: any[]) => {
    console.log('💳 Local: Transaction category updates:', transactionUpdates.length);
    
    // Immediate server refresh
    setTimeout(() => {
      mutate(url);
    }, 100);
  };

  // Create budget with immediate refresh
  const createBudgetOptimistic = async (budgetData: any) => {
    console.log('📝 Local: Creating budget:', budgetData.name);
    
    // Create temporary optimistic entry
    mutate(url, (currentData: any) => {
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
    
    // Immediate server refresh
    setTimeout(() => {
      mutate(url);
    }, 100);
  };

  // Delete budget with immediate refresh
  const deleteBudgetOptimistic = async (budgetId: string) => {
    console.log('🗑 Local: Deleting budget:', budgetId);
    
    // Optimistic removal
    mutate(url, (currentData: any) => {
      if (!currentData?.categories) return currentData;
      
      const updatedCategories = currentData.categories.map((category: any) => ({
        ...category,
        budgets: category.budgets.filter((budget: any) => budget.id !== budgetId)
      })).filter((category: any) => category.budgets.length > 0);
      
      return { ...currentData, categories: updatedCategories };
    }, false);
    
    // Immediate server refresh
    setTimeout(() => {
      mutate(url);
    }, 100);
  };

  return {
    data,
    error,
    isLoading,
    connected: true, // Always true for local development
    updateBudgetOptimistic,
    updateTransactionCategoriesOptimistic,
    createBudgetOptimistic,
    deleteBudgetOptimistic,
    refresh,
  };
};