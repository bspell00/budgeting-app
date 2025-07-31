import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useTransactions(accountId?: string) {
  const key = accountId ? `/api/transactions?accountId=${accountId}` : '/api/transactions';
  
  console.log('🔍 useTransactions called with:', { 
    accountId: accountId, 
    key: key,
    accountIdType: typeof accountId 
  });
  
  const { data, error, isLoading } = useSWR(key, fetcher, {
    refreshInterval: 15000, // Refresh every 15 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  });
  
  console.log('🔍 useTransactions SWR result:', { 
    key: key,
    dataExists: !!data,
    transactionCount: data?.transactions?.length || 0,
    error: error,
    isLoading: isLoading 
  });

  // Optimistic update for transaction category changes
  const updateTransactionOptimistic = async (transactionId: string, updates: any) => {
    const currentData = data;
    if (!currentData) return;

    // Create optimistic update
    const optimisticData = {
      ...currentData,
      transactions: currentData.transactions?.map((transaction: any) => {
        if (transaction.id === transactionId) {
          return { ...transaction, ...updates };
        }
        return transaction;
      })
    };

    // Update cache optimistically
    mutate(key, optimisticData, false);

    try {
      // Make API call based on update type
      let response;
      if (updates.category) {
        response = await fetch('/api/transactions/update-category', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            transactionId, 
            category: updates.category 
          }),
        });
      } else {
        response = await fetch('/api/transactions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: transactionId, ...updates }),
        });
      }

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }

      // Revalidate to sync with server
      mutate(key);
      
      // Also refresh dashboard if category changed (affects budgets)
      if (updates.category) {
        mutate('/api/dashboard');
      }
    } catch (error) {
      // Revert optimistic update on error
      mutate(key, currentData, false);
      throw error;
    }
  };

  // Optimistic update for creating transactions
  const createTransactionOptimistic = async (transactionData: any) => {
    const currentData = data;
    if (!currentData) return;

    // Create temporary transaction with optimistic ID
    const tempTransaction = {
      id: `temp-${Date.now()}`,
      ...transactionData,
      date: new Date(transactionData.date),
      cleared: false,
      approved: true,
      isManual: true,
    };

    // Add to optimistic data
    const optimisticData = {
      ...currentData,
      transactions: [tempTransaction, ...(currentData.transactions || [])]
    };

    // Update cache optimistically
    mutate(key, optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        throw new Error('Failed to create transaction');
      }

      // Revalidate to get real data from server
      mutate(key);
      mutate('/api/dashboard'); // Refresh dashboard too
    } catch (error) {
      // Revert optimistic update on error
      mutate(key, currentData, false);
      throw error;
    }
  };

  // Optimistic update for deleting transactions
  const deleteTransactionOptimistic = async (transactionId: string) => {
    const currentData = data;
    if (!currentData) return;

    // Remove from optimistic data
    const optimisticData = {
      ...currentData,
      transactions: currentData.transactions?.filter((txn: any) => txn.id !== transactionId) || []
    };

    // Update cache optimistically
    mutate(key, optimisticData, false);

    try {
      // Make API call
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      // Revalidate to sync with server
      mutate(key);
      mutate('/api/dashboard'); // Refresh dashboard too
    } catch (error) {
      // Revert optimistic update on error
      mutate(key, currentData, false);
      throw error;
    }
  };

  // Toggle cleared status optimistically
  const toggleClearedOptimistic = async (transactionId: string) => {
    const currentData = data;
    if (!currentData) return;

    const transaction = currentData.transactions?.find((txn: any) => txn.id === transactionId);
    if (!transaction) return;

    // Create optimistic update
    const optimisticData = {
      ...currentData,
      transactions: currentData.transactions?.map((txn: any) => {
        if (txn.id === transactionId) {
          return { ...txn, cleared: !txn.cleared };
        }
        return txn;
      })
    };

    // Update cache optimistically
    mutate(key, optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: transactionId, 
          cleared: !transaction.cleared 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle cleared status');
      }

      // Revalidate to sync with server
      mutate(key);
    } catch (error) {
      // Revert optimistic update on error
      mutate(key, currentData, false);
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    updateTransactionOptimistic,
    createTransactionOptimistic,
    deleteTransactionOptimistic,
    toggleClearedOptimistic,
    refresh: () => mutate(key),
  };
}