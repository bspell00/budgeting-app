import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useAIChat() {
  const { data, error, isLoading } = useSWR('/api/ai-chat/history', fetcher, {
    refreshInterval: 0, // Don't auto-refresh chat history
    revalidateOnFocus: false, // Don't refresh when window gains focus
    revalidateOnReconnect: true, // Refresh when connection is restored
    dedupingInterval: 1000,
  });

  // Optimistic update for sending chat messages
  const sendMessageOptimistic = async (message: string, context?: any) => {
    console.log('💬 Sending AI chat message optimistically:', message);

    const currentData = data;
    
    // Create user message
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      isOptimistic: true
    };

    // Create AI loading message
    const aiLoadingMessage = {
      id: `temp-ai-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
      isOptimistic: true
    };

    // Add messages to optimistic data
    const optimisticData = {
      ...currentData,
      messages: [...(currentData?.messages || []), userMessage, aiLoadingMessage]
    };

    // Update cache optimistically
    mutate('/api/ai-chat/history', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          context: context || {}
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();
      console.log('✅ AI chat message sent successfully');

      // Update with real response
      const finalData = {
        ...currentData,
        messages: [
          ...(currentData?.messages || []),
          {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
          },
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: result.response || result.message,
            timestamp: new Date().toISOString()
          }
        ]
      };

      // Force revalidate with final data
      mutate('/api/ai-chat/history', finalData, false);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send AI chat message:', error);
      
      // Create error message instead of reverting
      const errorData = {
        ...currentData,
        messages: [
          ...(currentData?.messages || []),
          userMessage,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date().toISOString(),
            isError: true
          }
        ]
      };
      
      mutate('/api/ai-chat/history', errorData, false);
      throw error;
    }
  };

  // Optimistic update for executing AI suggestions
  const executeSuggestionOptimistic = async (suggestion: any) => {
    console.log('⚡ Executing AI suggestion optimistically:', suggestion);

    try {
      // Make API call
      const response = await fetch('/api/ai/execute-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestion),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to execute suggestion' }));
        throw new Error(errorData.error || 'Failed to execute suggestion');
      }

      const result = await response.json();
      console.log('✅ AI suggestion executed successfully');

      // Refresh relevant data based on suggestion type
      if (suggestion.type === 'budget') {
        mutate('/api/dashboard');
      } else if (suggestion.type === 'transaction') {
        mutate('/api/transactions');
      } else if (suggestion.type === 'goal') {
        mutate('/api/goals');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to execute AI suggestion:', error);
      throw error;
    }
  };

  // Clear chat history optimistically
  const clearHistoryOptimistic = async () => {
    console.log('🗑️ Clearing AI chat history optimistically');

    const currentData = data;
    
    // Clear optimistically
    const optimisticData = {
      ...currentData,
      messages: []
    };

    mutate('/api/ai-chat/history', optimisticData, false);

    try {
      // Make API call
      const response = await fetch('/api/ai-chat/history', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear chat history');
      }

      console.log('✅ AI chat history cleared successfully');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear AI chat history:', error);
      // Revert optimistic update on error
      mutate('/api/ai-chat/history', currentData, false);
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    sendMessageOptimistic,
    executeSuggestionOptimistic,
    clearHistoryOptimistic,
    refresh: () => mutate('/api/ai-chat/history'),
  };
}