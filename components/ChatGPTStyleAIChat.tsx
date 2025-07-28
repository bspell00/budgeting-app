import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  MessageSquare,
  Plus,
  Download,
  Trash2,
  Edit2,
  MoreVertical,
  Check,
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  lastMessage: string;
}

interface ChatGPTStyleAIChatProps {
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const ChatGPTStyleAIChat: React.FC<ChatGPTStyleAIChatProps> = ({ 
  isMinimized = false, 
  onToggleMinimize 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadConversations();
    if (!isMinimized) {
      addWelcomeMessage();
    }
  }, [isMinimized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addWelcomeMessage = () => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `# Welcome to Your AI Financial Advisor! 🤖💰

I'm your **ChatGPT-style financial assistant** with access to your complete financial data. I can help you with:

## What I Can Do:
- 📊 **Analyze your spending patterns** and budget performance
- 💳 **Create debt elimination strategies** with specific timelines
- 💰 **Build emergency fund plans** tailored to your situation  
- 🎯 **Set and track financial goals** based on your income
- 📈 **Provide investment guidance** for your surplus money
- 🔍 **Answer specific questions** about your accounts and transactions

## Try asking me:
- *"Analyze my complete financial health"*
- *"I have an extra $1,000, what should I do with it?"*
- *"Create a debt payoff plan for my credit cards"*
- *"How much should I save for emergencies?"*
- *"Which categories am I overspending in?"*

**Just start typing below and I'll provide personalized advice based on your actual financial data!**`,
        timestamp: new Date()
      }]);
    }
  };

  const loadConversations = async () => {
    // TODO: Implement conversation loading when backend is ready
    setConversations([]);
  };

  const loadConversation = async (conversationId: string) => {
    // TODO: Implement conversation loading when backend is ready
    console.log('Loading conversation:', conversationId);
  };

  const createNewConversation = async () => {
    // For now, just reset to new conversation
    setCurrentConversationId(`new-${Date.now()}`);
    setMessages([]);
    addWelcomeMessage();
    setShowConversations(false);
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    // TODO: Implement when backend is ready
    console.log('Updating conversation title:', conversationId, title);
  };

  const deleteConversation = async (conversationId: string) => {
    // TODO: Implement when backend is ready
    console.log('Deleting conversation:', conversationId);
  };

  const exportConversation = async (conversationId: string) => {
    // Simple client-side export
    const exportText = messages.map(msg => 
      `**${msg.role === 'user' ? 'You' : 'AI Assistant'}**: ${msg.content}\n\n`
    ).join('');
    
    const blob = new Blob([exportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Use existing AI chat API for now
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text,
          history: messages.slice(-10).map(msg => ({
            id: msg.id,
            type: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      // Simulate streaming effect by typing out the response
      const fullResponse = data.message || "I'm here to help with your finances!";
      const words = fullResponse.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between words
        const currentText = words.slice(0, i + 1).join(' ');
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: currentText }
            : msg
        ));
      }

      // Mark as done
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, streaming: false }
          : msg
      ));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Streaming error:', error);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { 
                ...msg, 
                content: "I'm sorry, I encountered an error. Please try again.", 
                streaming: false 
              }
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTitleEdit = (conversationId: string, currentTitle: string) => {
    setEditingTitle(conversationId);
    setNewTitle(currentTitle);
  };

  const saveTitleEdit = () => {
    if (editingTitle && newTitle.trim()) {
      updateConversationTitle(editingTitle, newTitle.trim());
    }
    setEditingTitle(null);
    setNewTitle('');
  };

  const cancelTitleEdit = () => {
    setEditingTitle(null);
    setNewTitle('');
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={onToggleMinimize}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-xl transition-all duration-300 hover:scale-105"
        >
          <Bot className="w-5 h-5" />
          <span className="hidden sm:block font-medium">AI Assistant</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 md:w-[800px] md:h-[700px] bg-white md:rounded-xl shadow-2xl border border-gray-200 flex z-50">
      {/* Sidebar - Conversations */}
      <div className={`${showConversations ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-gray-200 bg-gray-50`}>
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Conversation</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div key={conv.id} className="border-b border-gray-200">
              <div className="p-3 hover:bg-gray-100 cursor-pointer group">
                <div className="flex items-center justify-between">
                  {editingTitle === conv.id ? (
                    <div className="flex-1 flex items-center space-x-2">
                      <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && saveTitleEdit()}
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                        autoFocus
                      />
                      <button onClick={saveTitleEdit} className="text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelTitleEdit} className="text-red-600 hover:text-red-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1" onClick={() => loadConversation(conv.id)}>
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {conv.title}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-1">
                          {conv.lastMessage}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {conv.messageCount} messages • {new Date(conv.lastMessageAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
                        <button
                          onClick={() => handleTitleEdit(conv.id, conv.title)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => exportConversation(conv.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteConversation(conv.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600 text-white md:rounded-t-xl">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowConversations(!showConversations)}
              className="text-white hover:text-gray-200 transition-colors md:hidden"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">AI Financial Advisor</h3>
              <p className="text-sm text-blue-100">ChatGPT-style financial assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConversations(!showConversations)}
              className="hidden md:block text-white hover:text-gray-200 transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                {/* Avatar & Name */}
                <div className={`flex items-center space-x-2 mb-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <>
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">AI Assistant</span>
                      {message.streaming && (
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      )}
                    </>
                  )}
                  {message.role === 'user' && (
                    <>
                      <span className="text-sm font-medium text-gray-700">You</span>
                      <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-green-600" />
                      </div>
                    </>
                  )}
                </div>

                {/* Message Content */}
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white ml-9' 
                    : 'bg-white border border-gray-200 text-gray-900 mr-9 shadow-sm'
                }`}>
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;
                            return !isInline ? (
                              <SyntaxHighlighter
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                                {children}
                              </code>
                            );
                          },
                          h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-3">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-800 mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-medium text-gray-800 mb-2">{children}</h3>,
                          p: ({ children }) => <p className="text-gray-700 mb-2 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-gray-700">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                          em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                          blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-4 text-gray-600 italic">{children}</blockquote>
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>

                <div className="text-xs text-gray-400 mt-2 text-right">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4 bg-white md:rounded-b-xl">
          <div className="flex items-end space-x-3">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your finances..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 max-h-32"
              style={{ minHeight: '44px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            💡 Ask about budgets, debt strategies, savings goals, or specific financial questions
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatGPTStyleAIChat;