import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User, Loader, Bell, ChevronUp } from 'lucide-react';
import { useAIChat } from '../hooks/useAIChat';
import { useSuggestions } from '../hooks/useSuggestions';
import { mutate } from 'swr';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: 'button';
    label: string;
    action: string;
    data?: any;
  }>;
}

// Type guard to ensure message data matches our interface
const ensureMessageType = (data: any): Message => {
  console.log('ensureMessageType processing:', data);
  
  const message = {
    id: data.id || `msg-${Date.now()}`,
    type: (data.type === 'user' || data.type === 'ai') ? data.type : 'ai',
    content: data.content || '',
    timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()),
    actions: data.actions || []
  };
  
  console.log('ensureMessageType result:', message);
  return message;
};

interface AIChatProps {
  onExecuteAction: (action: string, data: any) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  ref?: React.Ref<{ openChat: () => void }>;
}

export default function AIChat({ onExecuteAction, isOpen: externalIsOpen, onOpenChange }: AIChatProps) {
  console.log('🎭 AIChat component rendered with props:', { onExecuteAction: !!onExecuteAction, isOpen: externalIsOpen, onOpenChange: !!onOpenChange });
  
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use optimistic AI chat hook and suggestions
  const { data: chatData, sendMessageOptimistic, executeSuggestionOptimistic } = useAIChat();
  const { suggestions = [], hasNewSuggestions = false, markAsRead = () => {}, isLoading: suggestionsLoading = false, error: suggestionsError } = useSuggestions();

  // Debug logging
  console.log('AIChat Debug:', {
    chatData,
    suggestions,
    hasNewSuggestions,
    suggestionsLoading,
    suggestionsError
  });
  
  // Generate contextual welcome message
  const generateWelcomeMessage = () => {
    console.log('Generating welcome message with:', { hasNewSuggestions, suggestionsCount: suggestions?.length || 0 });
    
    // Enhanced logic for when there are new suggestions with alert guidance
    if (hasNewSuggestions && suggestions && suggestions.length > 0) {
      console.log('Has new suggestions, generating enhanced welcome');
      return {
        content: `Hey! 👋 I found ${suggestions.length} ways to optimize your budget.\n\nWant to see them?`,
        actions: [
          {
            type: 'button',
            label: '✨ Show Suggestions',
            action: 'show_all_suggestions',
            data: { suggestions }
          },
          {
            type: 'button',
            label: '💬 Chat Instead',
            action: 'start_conversation',
            data: {}
          }
        ]
      };
    }
    
    // Default welcome message
    console.log('No new suggestions, using default welcome');
    return {
      content: `Hi! I'm Finley 👋\n\nI can help with budgets, spending, and financial goals. What's on your mind?`,
      actions: [
        {
          type: 'button',
          label: '📊 My Overview',
          action: 'get_overview',
          data: {}
        },
        {
          type: 'button', 
          label: '💸 Spending Analysis',
          action: 'analyze_spending',
          data: {}
        },
        {
          type: 'button',
          label: '🎯 Set Goals',
          action: 'set_goals',
          data: {}
        }
      ]
    };
  };

  const welcomeMessage = generateWelcomeMessage();
  console.log('Generated welcome message:', welcomeMessage);
  
  // Ensure we always have a valid welcome message
  if (!welcomeMessage || !welcomeMessage.content) {
    console.error('Invalid welcome message generated!', welcomeMessage);
  }
  
  // Use messages from SWR or fallback to contextual welcome, ensuring proper typing
  const defaultMessages = [
    {
      id: '1',
      type: 'ai' as const,
      content: welcomeMessage?.content || "Hi! I'm Finley 👋 What's on your mind?",
      timestamp: new Date(),
      actions: welcomeMessage?.actions || [
        {
          type: 'button',
          label: '📊 Financial Overview',
          action: 'get_overview',
          data: {}
        }
      ]
    }
  ];
  
  console.log('Default messages created:', defaultMessages);
  
  // Use chatData messages only if they exist and have content, otherwise use defaultMessages
  const messagesToProcess = (chatData?.messages && chatData.messages.length > 0) ? chatData.messages : defaultMessages;
  console.log('Messages to process before map:', messagesToProcess);
  console.log('chatData?.messages:', chatData?.messages);
  
  const messages: Message[] = messagesToProcess.map(ensureMessageType);
  console.log('Final messages after ensureMessageType:', messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset typing state on mount to prevent stuck state
  useEffect(() => {
    console.log('🔄 AIChat mounted, resetting isTyping to false');
    setIsTyping(false);
  }, []);

  const handleSendMessage = async () => {
    console.log('🎯 handleSendMessage called with input:', inputMessage);
    console.log('🎯 Current isTyping state:', isTyping);
    
    if (!inputMessage.trim()) {
      console.log('❌ Empty message, skipping send');
      return;
    }

    if (isTyping) {
      console.log('⏳ Already typing, ignoring send request');
      return;
    }

    const messageText = inputMessage;
    setInputMessage('');
    setIsTyping(true);
    console.log('📤 About to send message:', messageText, 'isTyping set to true');

    // Failsafe timeout - reset isTyping after 30 seconds maximum
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Timeout reached - forcing isTyping to false');
      setIsTyping(false);
    }, 30000);

    try {
      // Use optimistic update for sending message
      console.log('🔄 Calling sendMessageOptimistic...');
      await sendMessageOptimistic(messageText, {
        history: messages.slice(-10) // Send last 10 messages for context
      });
      console.log('✅ sendMessageOptimistic completed successfully');
    } catch (error) {
      console.error('AI Chat Error:', error);
      console.error('📝 Setting isTyping to false due to error');
    } finally {
      clearTimeout(timeoutId);
      setIsTyping(false);
      console.log('🏁 handleSendMessage completed, isTyping set to false');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleActionClick = async (action: string, data: any) => {
    try {
      // Mark suggestions as read when chat is opened/interacted with
      if (hasNewSuggestions) {
        markAsRead();
      }

      // Handle new suggestion-related actions
      if (action === 'show_all_suggestions') {
        const suggestionsText = data.suggestions.map((s: any, index: number) => 
          `${index + 1}. **${s.title}** (${s.priority} priority)\n   ${s.description}\n   Impact: ${s.impact}`
        ).join('\n\n');

        const suggestionsMessage = {
          id: `suggestions-${Date.now()}`,
          type: 'ai',
          content: `Here's what I found! 🎯\n\n${suggestionsText}\n\nWhich one sounds good to you?`,
          timestamp: new Date(),
          actions: data.suggestions.slice(0, 3).map((s: any) => ({
            type: 'button',
            label: `${s.actionText}: ${s.title}`,
            action: 'execute_suggestion',
            data: s
          }))
        };

        const currentData = chatData;
        const updatedData = {
          ...currentData,
          messages: [...(currentData?.messages || []), suggestionsMessage]
        };

        mutate('/api/ai-chat/history', updatedData, false);
        return;
      }

      if (action === 'execute_suggestion') {
        setIsTyping(true);
        try {
          const suggestion = data;
          const messageText = `Execute suggestion: ${suggestion.title}`;
          
          await sendMessageOptimistic(messageText, {
            history: messages.slice(-10),
            suggestion: suggestion
          });
        } finally {
          setIsTyping(false);
        }
        return;
      }

      if (action === 'start_conversation') {
        const conversationMessage = {
          id: `conversation-${Date.now()}`,
          type: 'ai',
          content: 'Great! What would you like to talk about? 😊\n\nJust ask me anything about your finances.',
          timestamp: new Date(),
          actions: [
            {
              type: 'button',
              label: '📊 My Overview',
              action: 'get_overview',
              data: {}
            },
            {
              type: 'button',
              label: '💸 Spending Check',
              action: 'analyze_spending',
              data: {}
            }
          ]
        };

        const currentData = chatData;
        const updatedData = {
          ...currentData,
          messages: [...(currentData?.messages || []), conversationMessage]
        };

        mutate('/api/ai-chat/history', updatedData, false);
        return;
      }

      // Handle special actions that should trigger new AI messages
      if (action === 'get_overview' || action === 'analyze_spending' || action === 'set_goals') {
        setIsTyping(true);
        let messageText = '';
        
        switch (action) {
          case 'get_overview':
            messageText = 'Show me my financial overview';
            break;
          case 'analyze_spending':
            messageText = 'Analyze my spending patterns';
            break;
          case 'set_goals':
            messageText = 'Help me set and track financial goals';
            break;
        }
        
        try {
          await sendMessageOptimistic(messageText, {
            history: messages.slice(-10)
          });
        } finally {
          setIsTyping(false);
        }
        return;
      }

      // Handle special UI actions that don't require API calls
      if (action.startsWith('open_')) {
        await onExecuteAction(action, data);
        return;
      }

      // Handle add to debt payoff page action
      if (action === 'add_to_debt_payoff') {
        await onExecuteAction(action, data);
        
        // Add simple confirmation message without triggering AI
        const currentData = chatData;
        const confirmationMessage = {
          id: `confirmation-${Date.now()}`,
          type: 'ai',
          content: '✅ **Debt payoff plan saved successfully!**\n\nYour plan has been added to the Debt Payoff page where you can track progress and manage payments.',
          timestamp: new Date(),
          isConfirmation: true
        };

        const updatedData = {
          ...currentData,
          messages: [...(currentData?.messages || []), confirmationMessage]
        };

        // Update the cache with confirmation message
        mutate('/api/ai-chat/history', updatedData, false);
        return;
      }

      // For API actions, use optimistic suggestion execution
      await executeSuggestionOptimistic({ action, data });

      // Trigger a refresh of the dashboard data
      if (onExecuteAction) {
        await onExecuteAction('refresh_data', {});
      }
    } catch (error) {
      console.error('Action execution error:', error);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 left-6 right-6 z-50 lg:left-auto lg:right-6 lg:max-w-sm">
        <div className="relative">
          <button
            onClick={() => {
              setIsOpen(true);
              if (hasNewSuggestions) {
                markAsRead();
              }
            }}
            data-testid="ai-chat-open"
            className={`relative w-full px-6 py-4 rounded-full shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-3 ${
              hasNewSuggestions 
                ? 'bg-gradient-to-r from-last-lettuce to-evergreen text-white animate-pulse shadow-lg shadow-last-lettuce/50'
                : 'bg-last-lettuce hover:bg-last-lettuce/80 text-evergreen'
            }`}
          >
            <MessageCircle className="w-6 h-6" />
            <span className="font-semibold text-lg">Ask Finley</span>
          </button>
          
          {/* Notification Badge */}
          {hasNewSuggestions && (
            <div className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center animate-bounce border-2 border-white shadow-lg">
              <Bell className="w-4 h-4" />
            </div>
          )}
          
          {/* Pulsing Ring Effect for New Suggestions */}
          {hasNewSuggestions && (
            <div className="absolute inset-0 rounded-full bg-last-lettuce/30 animate-ping pointer-events-none"></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-up Panel */}
      <div className={`fixed inset-x-0 bottom-0 z-50 bg-white border-t border-gray-200 shadow-2xl transition-all duration-300 transform lg:inset-x-auto lg:right-6 sm:bottom-0 lg:bottom-20 lg:border lg:rounded-t-2xl lg:max-w-2xl lg:w-full ${
        isMinimized ? 'translate-y-full lg:translate-y-0 lg:h-20' : 'translate-y-0 h-[80vh] lg:h-[70vh]'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-last-lettuce/10 to-evergreen/10 lg:rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-last-lettuce to-evergreen rounded-full flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Finley</h3>
              <p className="text-sm text-gray-600">Your AI Financial Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
            >
              {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-col h-full">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages && messages.length > 0 ? messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                    message.type === 'user' 
                      ? 'bg-blue-600' 
                      : 'bg-gradient-to-r from-last-lettuce to-evergreen'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`flex-1 max-w-[85%] ${message.type === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-4 rounded-2xl shadow-sm ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white ml-auto'
                        : 'bg-gray-50 text-gray-900 border border-gray-100'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.actions.map((action: any, index: number) => (
                          <button
                            key={index}
                            onClick={() => handleActionClick(action.action, action.data)}
                            className="bg-gradient-to-r from-last-lettuce to-evergreen text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all duration-200 hover:scale-105 block w-full text-left"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2 opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-last-lettuce to-evergreen rounded-full flex items-center justify-center shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-900">👋 Hi! I'm Finley, your AI financial assistant. Let me load up...</p>
                  </div>
                </div>
              )}
              
              {isTyping && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-last-lettuce to-evergreen rounded-full flex items-center justify-center shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Finley is thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white p-4 lg:rounded-b-2xl">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => {
                      console.log('📝 Input changed:', e.target.value);
                      setInputMessage(e.target.value);
                    }}
                    onKeyPress={(e) => {
                      console.log('⌨️ Key pressed:', e.key);
                      handleKeyPress(e);
                    }}
                    onFocus={() => {
                      console.log('👆 Textarea focused, isTyping:', isTyping);
                    }}
                    onClick={() => {
                      console.log('🖱️ Textarea clicked, isTyping:', isTyping);
                    }}
                    placeholder="Ask me anything about your finances..."
                    className={`w-full resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-last-lettuce focus:border-transparent max-h-32 ${
                      isTyping ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                    }`}
                    rows={2}
                    disabled={isTyping}
                  />
                </div>
                <button
                  onClick={() => {
                    console.log('🔘 Send button clicked!');
                    handleSendMessage();
                  }}
                  disabled={!inputMessage.trim() || isTyping}
                  className="bg-gradient-to-r from-last-lettuce to-evergreen text-white p-3 rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  <Send className="w-5 h-5" />
                </button>
                {/* Debug reset button */}
                {isTyping && (
                  <button
                    onClick={() => {
                      console.log('🔄 Manual reset clicked!');
                      setIsTyping(false);
                    }}
                    className="bg-red-500 text-white p-2 rounded-lg text-xs"
                    title="Reset stuck typing state (debug)"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}