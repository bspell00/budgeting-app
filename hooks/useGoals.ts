import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useGoals() {
  const { data, error, isLoading } = useSWR('/api/goals', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  // Optimistic update for creating goals
  const createGoalOptimistic = async (goalData: any) => {
    console.log('🎯 Creating goal optimistically:', goalData);

    const currentData = data;
    if (!currentData) return;

    // Create temporary goal with optimistic ID
    const tempGoal = {
      id: `temp-${Date.now()}`,
      ...goalData,
      currentAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to optimistic data
    const optimisticData = {
      ...currentData,
      goals: [...(currentData.goals || []), tempGoal]
    };

    // Update cache optimistically
    mutate('/api/goals', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create goal' }));
        throw new Error(errorData.error || 'Failed to create goal');
      }

      const createdGoal = await response.json();
      console.log('✅ Goal created successfully:', createdGoal);

      // Force revalidate to get real data from server
      mutate('/api/goals');
      mutate('/api/dashboard'); // Goals may affect dashboard
      
      return createdGoal;
    } catch (error) {
      console.error('❌ Failed to create goal:', error);
      // Revert optimistic update on error
      mutate('/api/goals', currentData, false);
      throw error;
    }
  };

  // Optimistic update for updating goals
  const updateGoalOptimistic = async (goalId: string, updates: any) => {
    const currentData = data;
    if (!currentData) return;

    console.log('✏️ Updating goal optimistically:', goalId, updates);

    // Create optimistic update
    const optimisticData = {
      ...currentData,
      goals: currentData.goals?.map((goal: any) => {
        if (goal.id === goalId) {
          return { ...goal, ...updates, updatedAt: new Date().toISOString() };
        }
        return goal;
      }) || []
    };

    // Update cache optimistically
    mutate('/api/goals', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: goalId, ...updates }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update goal' }));
        throw new Error(errorData.error || 'Failed to update goal');
      }

      console.log('✅ Goal updated successfully:', goalId);

      // Force revalidate to sync with server
      mutate('/api/goals');
      mutate('/api/dashboard');
    } catch (error) {
      console.error('❌ Failed to update goal:', error);
      // Revert optimistic update on error
      mutate('/api/goals', currentData, false);
      throw error;
    }
  };

  // Optimistic update for deleting goals
  const deleteGoalOptimistic = async (goalId: string) => {
    const currentData = data;
    if (!currentData) return;

    console.log('🗑️ Deleting goal optimistically:', goalId);

    // Remove from optimistic data
    const optimisticData = {
      ...currentData,
      goals: currentData.goals?.filter((goal: any) => goal.id !== goalId) || []
    };

    // Update cache optimistically
    mutate('/api/goals', optimisticData, false);

    try {
      // Make API call
      const response = await fetch(`/api/goals?id=${goalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete goal' }));
        throw new Error(errorData.error || 'Failed to delete goal');
      }

      console.log('✅ Goal deleted successfully:', goalId);

      // Force revalidate to sync with server
      mutate('/api/goals');
      mutate('/api/dashboard');
    } catch (error) {
      console.error('❌ Failed to delete goal:', error);
      // Revert optimistic update on error
      mutate('/api/goals', currentData, false);
      throw error;
    }
  };

  // Optimistic update for goal progress
  const updateGoalProgressOptimistic = async (goalId: string, amount: number) => {
    const currentData = data;
    if (!currentData) return;

    console.log('📈 Updating goal progress optimistically:', goalId, amount);

    // Create optimistic update
    const optimisticData = {
      ...currentData,
      goals: currentData.goals?.map((goal: any) => {
        if (goal.id === goalId) {
          const newCurrentAmount = Math.max(0, (goal.currentAmount || 0) + amount);
          return { 
            ...goal, 
            currentAmount: newCurrentAmount,
            updatedAt: new Date().toISOString()
          };
        }
        return goal;
      }) || []
    };

    // Update cache optimistically
    mutate('/api/goals', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/goals/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, amount }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update goal progress' }));
        throw new Error(errorData.error || 'Failed to update goal progress');
      }

      console.log('✅ Goal progress updated successfully:', goalId);

      // Force revalidate to sync with server
      mutate('/api/goals');
      mutate('/api/dashboard');
    } catch (error) {
      console.error('❌ Failed to update goal progress:', error);
      // Revert optimistic update on error
      mutate('/api/goals', currentData, false);
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    createGoalOptimistic,
    updateGoalOptimistic,
    deleteGoalOptimistic,
    updateGoalProgressOptimistic,
    refresh: () => mutate('/api/goals'),
  };
}