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

    console.log('✏️ Updating transaction optimistically:', transactionId, updates);

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

    // Update multiple cache keys to handle different views
    mutate(key, optimisticData, false);
    mutate('/api/transactions', (cachedData: any) => {
      if (cachedData?.transactions) {
        return {
          ...cachedData,
          transactions: cachedData.transactions.map((transaction: any) => {
            if (transaction.id === transactionId) {
              return { ...transaction, ...updates };
            }
            return transaction;
          })
        };
      }
      return cachedData;
    }, false);

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
        const errorData = await response.json().catch(() => ({ error: 'Failed to update transaction' }));
        throw new Error(errorData.error || 'Failed to update transaction');
      }

      console.log('✅ Transaction updated successfully:', transactionId);

      // Force revalidate all transaction caches to get real data from server
      mutate(key);
      mutate('/api/transactions');
      // Also invalidate account-specific transaction caches
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions?accountId='));
      
      // Also refresh dashboard if category changed (affects budgets)
      if (updates.category) {
        mutate('/api/dashboard');
      }
    } catch (error) {
      console.error('❌ Failed to update transaction:', error);
      // Revert optimistic update on error
      mutate(key, currentData, false);
      mutate('/api/transactions');
      throw error;
    }
  };

  // Optimistic update for creating transactions
  const createTransactionOptimistic = async (transactionData: any, accounts?: any[]) => {
    console.log('🔄 Creating transaction optimistically:', transactionData);

    // Get account info for proper display
    const targetAccount = accounts?.find(acc => acc.id === transactionData.accountId);
    console.log('🏦 Target account for transaction:', targetAccount ? { id: targetAccount.id, name: targetAccount.accountName, type: targetAccount.accountType } : 'not found');
    
    // Create temporary transaction with optimistic ID and proper account info
    const tempTransaction = {
      id: `temp-${Date.now()}-${Math.random()}`,
      ...transactionData,
      date: new Date(transactionData.date),
      cleared: true, // Manual transactions are cleared
      approved: true,
      isManual: true,
      account: targetAccount ? {
        id: targetAccount.id,
        accountName: targetAccount.accountName,
        accountType: targetAccount.accountType
      } : { id: transactionData.accountId, accountName: 'Loading...', accountType: 'unknown' },
    };

    console.log('📤 Temp transaction created:', tempTransaction);

    // Helper function to add transaction to cache data
    const addTransactionToCache = (cacheData: any) => {
      if (!cacheData?.transactions) return cacheData;
      return {
        ...cacheData,
        transactions: [tempTransaction, ...cacheData.transactions]
      };
    };

    // Update ALL possible cache keys optimistically
    const currentData = data;
    if (currentData) {
      mutate(key, addTransactionToCache(currentData), false);
    }
    
    // Update general transactions cache
    mutate('/api/transactions', addTransactionToCache, false);
    
    // Update specific account cache
    const accountCacheKey = `/api/transactions?accountId=${transactionData.accountId}`;
    console.log('🔄 Updating account cache:', accountCacheKey);
    mutate(accountCacheKey, addTransactionToCache, false);
    
    // Update all account-specific caches (in case the transaction affects multiple views)
    console.log('🔄 Updating all account-specific caches');
    mutate((cacheKey) => {
      const shouldUpdate = typeof cacheKey === 'string' && cacheKey.startsWith('/api/transactions?accountId=');
      if (shouldUpdate) {
        console.log('🔄 Updating cache key:', cacheKey);
      }
      return shouldUpdate;
    }, addTransactionToCache, false);

    try {
      // Make API call
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create transaction' }));
        throw new Error(errorData.error || 'Failed to create transaction');
      }

      const createdTransaction = await response.json();
      console.log('✅ Transaction created successfully:', createdTransaction);

      // Force revalidate all transaction caches to get real data from server
      // This will replace the temporary transaction with the real one
      setTimeout(() => {
        mutate(key);
        mutate('/api/transactions');
        mutate(`/api/transactions?accountId=${transactionData.accountId}`);
        mutate((cacheKey) => {
          return typeof cacheKey === 'string' && cacheKey.startsWith('/api/transactions?accountId=');
        });
        mutate('/api/dashboard'); // Refresh dashboard too
      }, 100);
      
      return createdTransaction;
    } catch (error) {
      console.error('❌ Failed to create transaction:', error);
      
      // Revert optimistic update on error by removing the temp transaction
      const revertTransaction = (cacheData: any) => {
        if (!cacheData?.transactions) return cacheData;
        return {
          ...cacheData,
          transactions: cacheData.transactions.filter((txn: any) => txn.id !== tempTransaction.id)
        };
      };
      
      mutate(key, revertTransaction, false);
      mutate('/api/transactions', revertTransaction, false);
      mutate(`/api/transactions?accountId=${transactionData.accountId}`, revertTransaction, false);
      mutate((cacheKey) => {
        return typeof cacheKey === 'string' && cacheKey.startsWith('/api/transactions?accountId=');
      }, revertTransaction, false);
      
      throw error;
    }
  };

  // Optimistic update for deleting transactions
  const deleteTransactionOptimistic = async (transactionId: string) => {
    const currentData = data;
    if (!currentData) return;

    console.log('🗑️ Deleting transaction optimistically:', transactionId);

    // Remove from optimistic data
    const optimisticData = {
      ...currentData,
      transactions: currentData.transactions?.filter((txn: any) => txn.id !== transactionId) || []
    };

    // Update multiple cache keys to handle different views
    mutate(key, optimisticData, false);
    mutate('/api/transactions', (cachedData: any) => {
      if (cachedData?.transactions) {
        return {
          ...cachedData,
          transactions: cachedData.transactions.filter((txn: any) => txn.id !== transactionId)
        };
      }
      return cachedData;
    }, false);

    try {
      // Make API call
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete transaction' }));
        throw new Error(errorData.error || 'Failed to delete transaction');
      }

      console.log('✅ Transaction deleted successfully:', transactionId);

      // Force revalidate all transaction caches to get real data from server
      mutate(key);
      mutate('/api/transactions');
      // Also invalidate account-specific transaction caches
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions?accountId='));
      mutate('/api/dashboard'); // Refresh dashboard too
    } catch (error) {
      console.error('❌ Failed to delete transaction:', error);
      // Revert optimistic update on error
      mutate(key, currentData, false);
      mutate('/api/transactions');
      throw error;
    }
  };

  // Toggle cleared status optimistically
  const toggleClearedOptimistic = async (transactionId: string) => {
    const currentData = data;
    if (!currentData) return;

    const transaction = currentData.transactions?.find((txn: any) => txn.id === transactionId);
    if (!transaction) return;

    console.log('🔄 Toggling cleared status optimistically:', transactionId, !transaction.cleared);

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

    // Update multiple cache keys to handle different views
    mutate(key, optimisticData, false);
    mutate('/api/transactions', (cachedData: any) => {
      if (cachedData?.transactions) {
        return {
          ...cachedData,
          transactions: cachedData.transactions.map((txn: any) => {
            if (txn.id === transactionId) {
              return { ...txn, cleared: !txn.cleared };
            }
            return txn;
          })
        };
      }
      return cachedData;
    }, false);

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
        const errorData = await response.json().catch(() => ({ error: 'Failed to toggle cleared status' }));
        throw new Error(errorData.error || 'Failed to toggle cleared status');
      }

      console.log('✅ Cleared status toggled successfully:', transactionId);

      // Force revalidate all transaction caches to get real data from server
      mutate(key);
      mutate('/api/transactions');
      // Also invalidate account-specific transaction caches
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions?accountId='));
    } catch (error) {
      console.error('❌ Failed to toggle cleared status:', error);
      // Revert optimistic update on error
      mutate(key, currentData, false);
      mutate('/api/transactions');
      throw error;
    }
  };

  // Special function for creating credit card payment transfers (updates both accounts)
  const createCreditCardPaymentTransfer = async (checkingTransactionData: any, creditCardTransactionData: any, accounts?: any[]) => {
    console.log('💳 Creating credit card payment transfer:', { checkingTransactionData, creditCardTransactionData });
    
    try {
      // Create both transactions optimistically at the same time
      const [checkingResult, creditCardResult] = await Promise.all([
        createTransactionOptimistic(checkingTransactionData, accounts),
        createTransactionOptimistic(creditCardTransactionData, accounts)
      ]);
      
      console.log('✅ Credit card payment transfer completed successfully');
      return { checkingResult, creditCardResult };
    } catch (error) {
      console.error('❌ Failed to create credit card payment transfer:', error);
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    updateTransactionOptimistic,
    createTransactionOptimistic,
    createCreditCardPaymentTransfer,
    deleteTransactionOptimistic,
    toggleClearedOptimistic,
    refresh: () => mutate(key),
  };
}