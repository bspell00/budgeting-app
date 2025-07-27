import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useAccounts() {
  const { data, error, isLoading } = useSWR('/api/accounts', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds (accounts change less frequently)
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  // Sync accounts with Plaid
  const syncAccounts = async () => {
    try {
      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to sync accounts');
      }

      // Refresh accounts and related data
      mutate('/api/accounts');
      mutate('/api/transactions');
      mutate('/api/dashboard');
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    syncAccounts,
    refresh: () => mutate('/api/accounts'),
  };
}