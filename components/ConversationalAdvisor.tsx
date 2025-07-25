import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  Send, 
  Bot, 
  User, 
  Lightbulb, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  context: any;
  suggestedActions?: string[];
  planGenerated?: any;
  budgetChanges?: any[];
  quickReplies?: string[];
  timestamp: Date;
}

interface ConversationMessage {
  id: string;
  type: 'user' | 'advisor';
  content: string;
  timestamp: Date;
  suggestedActions?: string[];
  quickReplies?: string[];
  planGenerated?: any;
  budgetChanges?: any[];
  customPlan?: any;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
  confidence?: number;
}

const ConversationalAdvisor: React.FC = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Add welcome message
    setMessages([{
      id: 'welcome',
      type: 'advisor',
      content: "Hi! I'm your AI Financial Advisor, powered by GPT-4o-mini. I've analyzed your actual financial data and I'm ready to provide personalized advice based on your specific situation. I can help with debt management, budgeting, savings goals, and investment planning. What would you like to discuss?",
      timestamp: new Date(),
      confidence: 0.95,
      urgencyLevel: 'low',
      quickReplies: [
        'Analyze my financial health',
        'I have extra money, what should I do?',
        'Create a debt payoff plan',
        'Help me save more money',
        'Review my spending patterns'
      ]
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if (!text || isLoading) return;

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      const data = await response.json();

      if (data.success) {
        const advisorMessage: ConversationMessage = {
          id: `advisor-${Date.now()}`,
          type: 'advisor',
          content: data.data.response,
          timestamp: new Date(data.data.timestamp),
          suggestedActions: data.data.suggestedActions,
          quickReplies: data.data.quickReplies,
          planGenerated: data.data.planGenerated || data.data.customPlan,
          budgetChanges: data.data.budgetChanges,
          customPlan: data.data.customPlan,
          urgencyLevel: data.data.urgencyLevel,
          confidence: data.data.confidence
        };

        setMessages(prev => [...prev, advisorMessage]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ConversationMessage = {
        id: `error-${Date.now()}`,
        type: 'advisor',
        content: "I'm sorry, I encountered an error processing your message. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 bg-[#86b686] text-white px-4 py-3 rounded-full shadow-lg hover:bg-[#73a373] transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:block">AI Advisor</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">AI Financial Advisor</span>
        </div>
        <button 
          onClick={() => setIsMinimized(true)}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <span className="text-lg">−</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              {/* Avatar */}
              <div className={`flex items-center space-x-2 mb-1 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.type === 'advisor' && (
                  <>
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs text-gray-500">AI Advisor</span>
                  </>
                )}
                {message.type === 'user' && (
                  <>
                    <span className="text-xs text-gray-500">You</span>
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  </>
                )}
              </div>

              {/* Message Content */}
              <div className={`p-3 rounded-lg ${
                message.type === 'user' 
                  ? 'bg-[#86b686] text-white ml-8' 
                  : message.urgencyLevel === 'critical' ? 'bg-red-50 border border-red-200 text-gray-900 mr-8' :
                    message.urgencyLevel === 'high' ? 'bg-orange-50 border border-orange-200 text-gray-900 mr-8' :
                    'bg-gray-100 text-gray-900 mr-8'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* AI Confidence & Urgency Indicators */}
                {message.type === 'advisor' && (message.confidence || message.urgencyLevel) && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-xs">
                    {message.confidence && (
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          message.confidence >= 0.8 ? 'bg-green-500' :
                          message.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="text-gray-600">
                          {Math.round(message.confidence * 100)}% confidence
                        </span>
                      </div>
                    )}
                    {message.urgencyLevel && message.urgencyLevel !== 'low' && (
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        message.urgencyLevel === 'critical' ? 'bg-red-100 text-red-800' :
                        message.urgencyLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {message.urgencyLevel} priority
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Suggested Actions */}
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="mt-2 mr-8">
                  <div className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                    <Lightbulb className="w-3 h-3" />
                    <span>Suggested Actions:</span>
                  </div>
                  <div className="space-y-1">
                    {message.suggestedActions.map((action, index) => (
                      <div key={index} className="flex items-center space-x-2 text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                        <CheckCircle className="w-3 h-3 text-yellow-600" />
                        <span className="text-yellow-800">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget Changes */}
              {message.budgetChanges && message.budgetChanges.length > 0 && (
                <div className="mt-2 mr-8">
                  <div className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Budget Recommendations:</span>
                  </div>
                  <div className="space-y-1">
                    {message.budgetChanges.map((change, index) => (
                      <div key={index} className="text-xs bg-green-50 border border-green-200 rounded p-2">
                        <div className="flex items-center space-x-1 font-medium text-green-800">
                          <ArrowRight className="w-3 h-3" />
                          <span>{change.fromCategory} → {change.toCategory}</span>
                        </div>
                        <div className="text-green-700 mt-1">
                          {formatCurrency(change.amount)} - {change.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated Plan */}
              {message.planGenerated && (
                <div className="mt-2 mr-8">
                  <div className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Custom Plan Generated:</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <h4 className="font-medium text-blue-900 text-sm">{message.planGenerated.title}</h4>
                    <p className="text-xs text-blue-800 mt-1">{message.planGenerated.description}</p>
                    <div className="mt-2 text-xs text-blue-700">
                      <span className="font-medium">Impact:</span> {message.planGenerated.estimatedImpact}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Replies */}
              {message.quickReplies && message.quickReplies.length > 0 && (
                <div className="mt-3 mr-8">
                  <div className="flex flex-wrap gap-2">
                    {message.quickReplies.map((reply, index) => (
                      <button
                        key={index}
                        onClick={() => sendMessage(reply)}
                        disabled={isLoading}
                        className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400 mt-1 text-right">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center space-x-1">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-gray-600 text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your finances..."
            disabled={isLoading}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-[#86b686] text-white p-2 rounded-lg hover:bg-[#73a373] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Get personalized advice based on your actual financial data
        </div>
      </div>
    </div>
  );
};

export default ConversationalAdvisor;