import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User, Loader } from 'lucide-react';
import { useAIChat } from '../hooks/useAIChat';

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

interface AIChatProps {
  onExecuteAction: (action: string, data: any) => Promise<void>;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  ref?: React.Ref<{ openChat: () => void }>;
}

export default function AIChat({ onExecuteAction, isOpen: externalIsOpen, onOpenChange }: AIChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use optimistic AI chat hook
  const { data: chatData, sendMessageOptimistic, executeSuggestionOptimistic } = useAIChat();
  
  // Use messages from SWR or fallback to default
  const messages = chatData?.messages || [
    {
      id: '1',
      type: 'ai',
      content: "👋 Hi! I'm your AI financial assistant. I can help with budgets, spending, goals, and debt.\n\nWhat would you like to work on?",
      timestamp: new Date(),
      actions: [
        {
          type: 'button',
          label: '📊 Financial Overview',
          action: 'get_overview',
          data: {}
        },
        {
          type: 'button',
          label: '💸 Check Spending',
          action: 'analyze_spending',
          data: {}
        }
      ]
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const messageText = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      // Use optimistic update for sending message
      await sendMessageOptimistic(messageText, {
        history: messages.slice(-10) // Send last 10 messages for context
      });
    } catch (error) {
      console.error('AI Chat Error:', error);
    } finally {
      setIsTyping(false);
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
      // Handle special actions that should trigger new AI messages
      if (action === 'get_overview' || action === 'analyze_spending') {
        setIsTyping(true);
        const messageText = action === 'get_overview' ? 'Show financial overview' : 'Analyze my spending';
        
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
        // Use optimistic update for confirmation message
        await sendMessageOptimistic('Plan added successfully!', {
          systemMessage: '✅ Plan added to debt payoff page! You can view and manage it there.'
        });
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
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          data-testid="ai-chat-open"
          className="bg-last-lettuce hover:bg-last-lettuce/80 text-evergreen px-4 py-3 rounded-full shadow-xl transition-all duration-300 hover:scale-110 flex items-center space-x-2"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">Ask Finley</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-96 h-[500px]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-last-lettuce bg-opacity-10 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-last-lettuce rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Finley</h3>
              <p className="text-xs text-gray-500">Your AI financial assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 h-80">
              <div className="space-y-4">
                {messages.map((message: Message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-3 ${
                      message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' 
                        ? 'bg-blue-600' 
                        : 'bg-last-lettuce'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={`flex-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block p-3 rounded-2xl max-w-xs ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.actions && (
                        <div className="mt-2 space-y-2">
                          {message.actions.map((action: any, index: number) => (
                            <button
                              key={index}
                              onClick={() => handleActionClick(action.action, action.data)}
                              className="bg-last-lettuce text-white px-4 py-2 rounded-lg text-sm hover:bg-last-lettuce/80 transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-last-lettuce rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 p-3 rounded-2xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your finances..."
                  className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8717e] focus:border-transparent"
                  rows={1}
                  disabled={isTyping}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  className="bg-[#e8717e] text-white p-2 rounded-lg hover:bg-[#9bc267] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}