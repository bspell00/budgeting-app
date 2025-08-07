import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useTransactions(accountId?: string) {
  const key = accountId ? `/api/transactions?accountId=${accountId}` : '/api/transactions';
  
  console.log('🔍 useTransactions LOCAL called with:', { 
    accountId: accountId, 
    key: key,
    accountIdType: typeof accountId 
  });
  
  const { data, error, isLoading } = useSWR(key, fetcher, {
    refreshInterval: 1000, // 1 second for local development
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  console.log('🔍 useTransactions LOCAL SWR result:', {
    key,
    dataExists: !!data,
    transactionCount: data?.transactions?.length || 0,
    error: error?.message,
    isLoading
  });

  // Simple transaction update with immediate refresh
  const updateTransactionOptimistic = async (transactionId: string, updates: any) => {
    console.log('✏️ LOCAL: Updating transaction:', transactionId, updates);
    
    try {
      // Make the API call immediately (note: API uses query parameter)
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.statusText}`);
      }

      const updatedTransaction = await response.json();
      console.log('✅ Transaction updated successfully:', updatedTransaction);

      // Refresh all related data immediately
      mutate(key);
      mutate('/api/transactions');
      mutate('/api/dashboard'); // Update dashboard for budget changes
      
      return updatedTransaction;
    } catch (error) {
      console.error('❌ Transaction update failed:', error);
      throw error;
    }
  };

  // Simple transaction creation
  const createTransactionOptimistic = async (transactionData: any) => {
    console.log('📝 LOCAL: Creating transaction:', transactionData);
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      });

      if (!response.ok) {
        throw new Error(`Create failed: ${response.statusText}`);
      }

      const newTransaction = await response.json();
      console.log('✅ Transaction created successfully:', newTransaction);

      // Refresh all related data immediately
      mutate(key);
      mutate('/api/transactions');
      mutate('/api/dashboard');
      
      return newTransaction;
    } catch (error) {
      console.error('❌ Transaction creation failed:', error);
      throw error;
    }
  };

  // Simple transaction deletion
  const deleteTransactionOptimistic = async (transactionId: string) => {
    console.log('🗑️ LOCAL: Deleting transaction:', transactionId);
    
    try {
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      console.log('✅ Transaction deleted successfully');

      // Refresh all related data immediately
      mutate(key);
      mutate('/api/transactions');
      mutate('/api/dashboard');
      
      return true;
    } catch (error) {
      console.error('❌ Transaction deletion failed:', error);
      throw error;
    }
  };

  // Multiple transaction updates (for AI batch operations)
  const updateMultipleTransactionsOptimistic = async (transactionUpdates: any[]) => {
    console.log('📝 LOCAL: Updating multiple transactions:', transactionUpdates.length);
    
    try {
      // Update each transaction sequentially for reliability
      const results = [];
      for (const update of transactionUpdates) {
        const result = await updateTransactionOptimistic(update.id, update.updates);
        results.push(result);
      }
      
      console.log('✅ Multiple transactions updated successfully');
      return results;
    } catch (error) {
      console.error('❌ Multiple transaction update failed:', error);
      throw error;
    }
  };

  // Stub for credit card payment transfer (if needed)
  const createCreditCardPaymentTransfer = async (paymentData: any) => {
    console.log('💳 LOCAL: Creating credit card payment transfer:', paymentData);
    // Implementation would go here if needed
    throw new Error('Credit card payment transfer not implemented in local version');
  };

  return {
    data,
    error,
    isLoading,
    updateTransactionOptimistic,
    updateMultipleTransactionsOptimistic, 
    createTransactionOptimistic,
    deleteTransactionOptimistic,
    createCreditCardPaymentTransfer,
    refresh: () => {
      mutate(key);
      mutate('/api/dashboard');
    }
  };
}