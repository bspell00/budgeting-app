import useSWR from 'swr';

interface FinleySuggestion {
  id: string;
  type: 'budget_optimization' | 'debt_strategy' | 'savings_boost' | 'spending_alert' | 'goal_accelerator';
  title: string;
  description: string;
  impact: string;
  actionText: string;
  priority: 'high' | 'medium' | 'low';
  data?: any;
  isNew?: boolean;
}

interface SuggestionsResponse {
  suggestions: FinleySuggestion[];
  hasNewSuggestions: boolean;
  lastUpdated: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSuggestions() {
  const { data, error, mutate } = useSWR<SuggestionsResponse>('/api/ai/suggestions', fetcher, {
    refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    onError: (error) => {
      console.error('useSuggestions SWR error:', error);
    }
  });

  console.log('useSuggestions:', { data, error, isLoading: !error && !data });

  const suggestions = data?.suggestions || [];
  const hasNewSuggestions = data?.hasNewSuggestions || false;
  const isLoading = !error && !data;

  // Mark suggestions as read
  const markAsRead = async () => {
    if (data) {
      const updatedData = {
        ...data,
        hasNewSuggestions: false,
        suggestions: data.suggestions.map(s => ({ ...s, isNew: false }))
      };
      mutate(updatedData, false);
    }
  };

  // Execute a suggestion
  const executeSuggestion = async (suggestion: FinleySuggestion) => {
    try {
      const response = await fetch('/api/ai/execute-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          type: suggestion.type,
          data: suggestion.data
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state to remove executed suggestion
        if (data) {
          const updatedData = {
            ...data,
            suggestions: data.suggestions.filter(s => s.id !== suggestion.id)
          };
          mutate(updatedData, false);
        }
        
        return result;
      } else {
        throw new Error('Failed to execute suggestion');
      }
    } catch (error) {
      console.error('Error executing suggestion:', error);
      throw error;
    }
  };

  return {
    suggestions,
    hasNewSuggestions,
    isLoading,
    error,
    markAsRead,
    executeSuggestion,
    refetch: () => mutate()
  };
}