import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Lightbulb, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Target,
  DollarSign
} from 'lucide-react';

interface ChatMessage {
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

interface AIAdvisorChatProps {
  onPlanGenerated?: (plan: any) => void;
  onBudgetChanges?: (changes: any[]) => void;
}

const AIAdvisorChat: React.FC<AIAdvisorChatProps> = ({ onPlanGenerated, onBudgetChanges }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Add welcome message
    setMessages([{
      id: 'welcome',
      type: 'advisor',
      content: "Hi! I'm your AI Financial Advisor. I can analyze your complete financial situation and create personalized plans. Ask me anything about your finances, debt, savings, or budgeting strategy!",
      timestamp: new Date(),
      confidence: 0.95,
      urgencyLevel: 'low',
      quickReplies: [
        'Analyze my complete financial health',
        'I have extra money, what should I do?',
        'Create a debt elimination plan',
        'Help me build an emergency fund',
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

    const userMessage: ChatMessage = {
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
        const advisorMessage: ChatMessage = {
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

        // Save and notify parent components of generated plans/changes
        if (data.data.customPlan) {
          // Save the plan to database
          try {
            await fetch('/api/ai-advisor/plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan: data.data.customPlan })
            });
          } catch (error) {
            console.error('Error saving plan:', error);
          }
          
          if (onPlanGenerated) {
            onPlanGenerated(data.data.customPlan);
          }
        }
        if (data.data.budgetChanges && data.data.budgetChanges.length > 0 && onBudgetChanges) {
          onBudgetChanges(data.data.budgetChanges);
        }
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
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

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'high': return 'border-orange-200 bg-orange-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="h-[600px] flex flex-col bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">AI Financial Advisor Chat</h3>
          <p className="text-sm text-gray-600">Ask me anything about your finances</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              {/* Avatar & Name */}
              <div className={`flex items-center space-x-2 mb-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.type === 'advisor' && (
                  <>
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-gray-600">AI Advisor</span>
                  </>
                )}
                {message.type === 'user' && (
                  <>
                    <span className="text-xs font-medium text-gray-600">You</span>
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  </>
                )}
              </div>

              {/* Message Content */}
              <div className={`p-4 rounded-lg ${
                message.type === 'user' 
                  ? 'bg-[#aed274] text-white ml-8' 
                  : `${getUrgencyColor(message.urgencyLevel)} text-gray-900 mr-8 border`
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* AI Confidence & Urgency Indicators */}
                {message.type === 'advisor' && (message.confidence || message.urgencyLevel) && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 text-xs">
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

              {/* Custom Plan Display */}
              {message.customPlan && (
                <div className="mt-3 mr-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Custom Plan Generated</span>
                    </div>
                    <h4 className="font-semibold text-blue-900 mb-2">{message.customPlan.title}</h4>
                    <p className="text-sm text-blue-800 mb-3">{message.customPlan.description}</p>
                    
                    {message.customPlan.steps && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-blue-900 mb-2">Implementation Steps:</p>
                        <ol className="text-sm text-blue-800 space-y-1">
                          {message.customPlan.steps.map((step: string, index: number) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="font-medium text-blue-600">{index + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-700">
                        <strong>Timeline:</strong> {message.customPlan.timeline}
                      </span>
                      <span className="text-blue-700">
                        <strong>Expected:</strong> {message.customPlan.expectedOutcome}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested Actions */}
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="mt-3 mr-8">
                  <div className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                    <Lightbulb className="w-3 h-3" />
                    <span>Suggested Actions:</span>
                  </div>
                  <div className="space-y-2">
                    {message.suggestedActions.map((action, index) => (
                      <div key={index} className="flex items-start space-x-2 text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <CheckCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <span className="text-yellow-800">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget Changes */}
              {message.budgetChanges && message.budgetChanges.length > 0 && (
                <div className="mt-3 mr-8">
                  <div className="text-xs font-medium text-gray-600 mb-2 flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Budget Recommendations:</span>
                  </div>
                  <div className="space-y-2">
                    {message.budgetChanges.map((change, index) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-sm font-medium text-green-800 mb-1">
                          <ArrowRight className="w-4 h-4" />
                          <span>{change.fromCategory} → {change.toCategory}</span>
                        </div>
                        <div className="text-sm text-green-700">
                          <span className="font-medium">{formatCurrency(change.amount)}</span> - {change.reason}
                        </div>
                      </div>
                    ))}
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
                        className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400 mt-2 text-right">
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
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-gray-600 text-sm">Analyzing your finances...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your finances, debt strategy, savings goals..."
            disabled={isLoading}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-[#aed274] text-white p-2 rounded-lg hover:bg-[#9bc267] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          💡 Try: "Create a debt payoff plan" or "I have $500 extra, what should I do?"
        </div>
      </div>
    </div>
  );
};

export default AIAdvisorChat;