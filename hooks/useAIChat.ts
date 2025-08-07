import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useAIChat() {
  // Fetch real conversation history from database
  const { data, error, isLoading } = useSWR('/api/ai-chat/history', fetcher, {
    refreshInterval: 0, // Don't auto-refresh chat history
    revalidateOnFocus: false, // Don't refresh when window gains focus  
    revalidateOnReconnect: false, // Don't refresh when connection is restored
    dedupingInterval: 5000, // Dedupe requests for 5 seconds
  });

  // Optimistic update for sending chat messages
  const sendMessageOptimistic = async (message: string, context?: any) => {
    console.log('💬 Sending AI chat message optimistically:', message);
    console.log('🔍 Send message context:', context);

    const currentData = data;
    
    // Create user message
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date(),
      isOptimistic: true
    };

    // Create AI loading message
    const aiLoadingMessage = {
      id: `temp-ai-${Date.now()}`,
      type: 'ai',
      content: 'Thinking...',
      timestamp: new Date(),
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

      // Handle executed functions for optimistic updates
      console.log('🔍 Checking for executed functions in result:', { 
        hasExecutedFunctions: !!result.executedFunctions,
        executedFunctionsLength: result.executedFunctions?.length || 0,
        resultKeys: Object.keys(result || {}),
        fullResult: result
      });
      
      if (result.executedFunctions && result.executedFunctions.length > 0) {
        console.log('🔄 Processing executed functions for data updates:', result.executedFunctions);
        
        for (const func of result.executedFunctions) {
          if (func.success) {
            // Trigger appropriate data refreshes based on function type
            if (func.name === 'categorize_transaction') {
              console.log('💳 Refreshing transaction data after categorization', func.result);
              
              // Trigger optimistic updates if we have transaction details
              if (func.result?.transactions && func.args?.category) {
                const transactionIds = func.result.transactions.map((t: any) => t.id);
                console.log('🔄 Triggering optimistic transaction updates for:', transactionIds, 'category:', func.args.category);
                console.log('📊 Transaction details from AI function:', func.result.transactions);
                
                // Use the transaction details directly from the API response
                const transactionDetails = func.result.transactions.map((t: any) => ({
                  id: t.id,
                  amount: t.amount,
                  description: t.description,
                  oldCategory: t.oldCategory || 'Needs a Category',
                  newCategory: t.newCategory || func.args.category
                }));
                
                console.log('💰 Transaction details prepared for budget updates:', transactionDetails);
                
                // This will be used by components that import both hooks
                // We'll store the update details for components to use
                window.dispatchEvent(new CustomEvent('finley-transaction-update', {
                  detail: {
                    transactionIds,
                    transactionDetails,
                    updates: { category: func.args.category },
                    budgetId: func.args.budget_id
                  }
                }));
              }
              
              mutate('/api/transactions');
              mutate('/api/dashboard'); // Dashboard might show transaction data
            } else if (func.name === 'update_budget_amount') {
              console.log('💰 Refreshing budget data after budget update');
              mutate('/api/dashboard');
              mutate('/api/budgets');
            } else if (func.name === 'transfer_money_between_budgets') {
              console.log('🔄 Refreshing data after budget transfer');
              mutate('/api/dashboard');
              mutate('/api/budgets');
            } else if (func.name === 'create_financial_goal') {
              console.log('🎯 Refreshing goals data after goal creation');
              mutate('/api/dashboard');
              mutate('/api/goals');
            } else if (func.name === 'add_budget_category') {
              console.log('📊 Refreshing budget data after category creation');
              mutate('/api/dashboard');
              mutate('/api/budgets');
            }
          }
        }
      }

      // Update with real response
      const finalData = {
        ...currentData,
        messages: [
          ...(currentData?.messages || []),
          {
            id: `user-${Date.now()}`,
            type: 'user',
            content: message,
            timestamp: new Date()
          },
          {
            id: `ai-${Date.now()}`,
            type: 'ai',
            content: result.message,
            timestamp: new Date(),
            actions: result.actions || []
          }
        ]
      };

      // Refresh chat history from server (new messages stored in database)
      mutate('/api/ai-chat/history');
      
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
            type: 'ai',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
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

  // Clear chat history 
  const clearHistoryOptimistic = async () => {
    console.log('🗑️ Clearing AI chat history');

    try {
      const response = await fetch('/api/ai-chat/clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear chat history');
      }

      // Refresh history from server
      mutate('/api/ai-chat/history');
      
      console.log('✅ AI chat history cleared successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear chat history:', error);
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