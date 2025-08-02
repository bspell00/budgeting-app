import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useAccounts() {
  const { data, error, isLoading } = useSWR('/api/accounts', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds (accounts change less frequently)
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  // Sync accounts with Plaid (optimistic)
  const syncAccounts = async () => {
    console.log('🔄 Syncing accounts optimistically');
    
    // Set optimistic loading state
    const currentData = data;
    if (currentData) {
      const optimisticData = {
        ...currentData,
        isSyncing: true
      };
      mutate('/api/accounts', optimisticData, false);
    }

    try {
      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to sync accounts');
      }

      const result = await response.json();
      console.log('✅ Accounts synced successfully');

      // Refresh accounts and related data
      mutate('/api/accounts');
      mutate('/api/transactions');
      mutate('/api/dashboard');
      
      return result;
    } catch (error) {
      console.error('❌ Failed to sync accounts:', error);
      // Revert optimistic update on error
      mutate('/api/accounts', currentData, false);
      throw error;
    }
  };

  // Optimistic update for deleting accounts
  const deleteAccountOptimistic = async (accountId: string) => {
    const currentData = data;
    if (!currentData) return;

    console.log('🗑️ Deleting account optimistically:', accountId);

    // Remove from optimistic data
    const optimisticData = {
      ...currentData,
      accounts: currentData.accounts?.filter((acc: any) => acc.id !== accountId) || []
    };

    // Update cache optimistically
    mutate('/api/accounts', optimisticData, false);

    try {
      // Make API call
      const response = await fetch(`/api/accounts?id=${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete account' }));
        throw new Error(errorData.error || 'Failed to delete account');
      }

      console.log('✅ Account deleted successfully:', accountId);

      // Force revalidate to sync with server
      mutate('/api/accounts');
      mutate('/api/transactions');
      mutate('/api/dashboard');
    } catch (error) {
      console.error('❌ Failed to delete account:', error);
      // Revert optimistic update on error
      mutate('/api/accounts', currentData, false);
      throw error;
    }
  };

  // Optimistic update for connecting new accounts
  const connectAccountOptimistic = async (accountData: any) => {
    console.log('🔗 Connecting account optimistically:', accountData);
    
    const currentData = data;
    if (currentData) {
      // Add temporary account with optimistic ID
      const tempAccount = {
        id: `temp-${Date.now()}`,
        ...accountData,
        isConnecting: true
      };
      
      const optimisticData = {
        ...currentData,
        accounts: [...(currentData.accounts || []), tempAccount]
      };
      
      mutate('/api/accounts', optimisticData, false);
    }

    try {
      // The actual connection happens via Plaid Link
      // This is just for the optimistic state
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to connect account:', error);
      // Revert optimistic update on error
      mutate('/api/accounts', currentData, false);
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    syncAccounts,
    deleteAccountOptimistic,
    connectAccountOptimistic,
    refresh: () => mutate('/api/accounts'),
  };
}