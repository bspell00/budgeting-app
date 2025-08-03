import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb, 
  ArrowRight, 
  DollarSign, 
  Target, 
  TrendingUp,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useAlert } from './ModalAlert';

interface FinleySuggestion {
  id: string;
  type: 'budget_optimization' | 'debt_strategy' | 'savings_boost' | 'spending_alert' | 'goal_accelerator';
  title: string;
  description: string;
  impact: string;
  actionText: string;
  priority: 'high' | 'medium' | 'low';
  data?: any; // Additional data for the action
}

interface FinleySuggestsProps {
  userId: string;
  onRefreshData: () => void;
}

const FinleySuggests: React.FC<FinleySuggestsProps> = ({ userId, onRefreshData }) => {
  const { showSuccess, showError } = useAlert();
  const [suggestions, setSuggestions] = useState<FinleySuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  // Fetch suggestions from the AI
  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setHasNewSuggestions(data.suggestions?.length > 0);
        setLastFetchTime(Date.now());
      } else {
        console.error('Failed to fetch AI suggestions');
        // Set mock suggestions for demo purposes
        setMockSuggestions();
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
      // Set mock suggestions for demo purposes
      setMockSuggestions();
    } finally {
      setIsLoading(false);
    }
  };

  // Set mock suggestions for development/demo
  const setMockSuggestions = () => {
    const mockSuggestions: FinleySuggestion[] = [
      {
        id: 'budget-optimize-1',
        type: 'budget_optimization',
        title: 'Optimize Food Budget',
        description: 'Move $150 from dining out to groceries to save $300/month',
        impact: 'Save $300/month',
        actionText: 'Adjust Budget',
        priority: 'high',
        data: { fromCategory: 'Dining Out', toCategory: 'Groceries', amount: 150 }
      },
      {
        id: 'savings-boost-1',
        type: 'savings_boost',
        title: 'Emergency Fund Boost',
        description: 'Your surplus can build emergency fund 2x faster',
        impact: 'Reach 3-month fund in 4 months',
        actionText: 'Auto-Save',
        priority: 'medium',
        data: { targetAmount: 500, frequency: 'monthly' }
      },
      {
        id: 'debt-strategy-1',
        type: 'debt_strategy', 
        title: 'Debt Avalanche Strategy',
        description: 'Focus extra payments on highest interest debt first',
        impact: 'Save $1,200 in interest',
        actionText: 'Create Plan',
        priority: 'high',
        data: { strategy: 'avalanche', extraPayment: 200 }
      }
    ];
    setSuggestions(mockSuggestions);
    setHasNewSuggestions(true);
    setLastFetchTime(Date.now());
  };

  // Execute a suggestion action
  const executeSuggestion = async (suggestion: FinleySuggestion) => {
    setIsLoading(true);
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
        
        // Remove executed suggestion
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        
        // Refresh dashboard data
        onRefreshData();
        
        // Show success message
        showSuccess(`${suggestion.title} executed successfully! ${result.message || ''}`);
        
        // If no suggestions left, fetch new ones
        if (suggestions.length === 1) {
          setTimeout(fetchSuggestions, 1000);
        }
      } else {
        throw new Error('Failed to execute suggestion');
      }
    } catch (error) {
      console.error('Error executing suggestion:', error);
      showError('Failed to execute suggestion. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get suggestion icon
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'budget_optimization': return DollarSign;
      case 'debt_strategy': return Target;
      case 'savings_boost': return TrendingUp;
      case 'spending_alert': return Zap;
      case 'goal_accelerator': return Target;
      default: return Lightbulb;
    }
  };

  // Get suggestion color
  const getSuggestionColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Auto-fetch suggestions on mount
  useEffect(() => {
    fetchSuggestions();
    
    // Set up periodic refresh (every 5 minutes)
    const interval = setInterval(() => {
      if (!isOpen) { // Only auto-refresh when closed to avoid disruption
        fetchSuggestions();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle button click
  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (hasNewSuggestions && !isOpen) {
      setHasNewSuggestions(false); // Clear the "new" indicator when opened
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header Button */}
      <button
        onClick={handleToggle}
        className={`w-full p-4 flex items-center justify-between transition-all duration-300 rounded-lg ${
          hasNewSuggestions && !isOpen
            ? 'bg-last-lettuce bg-opacity-10 border-2 border-last-lettuce shadow-lg animate-pulse'
            : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full transition-all duration-300 ${
            hasNewSuggestions && !isOpen
              ? 'bg-last-lettuce shadow-lg'
              : 'bg-last-lettuce bg-opacity-20'
          }`}>
            <Brain className={`w-5 h-5 ${
              hasNewSuggestions && !isOpen ? 'text-white' : 'text-last-lettuce'
            }`} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <span>Finley Suggests</span>
              {hasNewSuggestions && !isOpen && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">
                  New!
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600">
              {isLoading ? 'Analyzing your finances...' : 
               suggestions.length > 0 ? `${suggestions.length} smart ${suggestions.length === 1 ? 'tip' : 'tips'} available` : 
               'AI-powered financial insights'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isLoading && (
            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="border-t border-gray-200 p-4 space-y-4 animate-in slide-in-from-top duration-300">
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion) => {
                const IconComponent = getSuggestionIcon(suggestion.type);
                const colorClasses = getSuggestionColor(suggestion.priority);
                
                return (
                  <div
                    key={suggestion.id}
                    className={`p-4 rounded-lg border transition-all hover:shadow-md ${colorClasses}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-full bg-white shadow-sm">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {suggestion.title}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {suggestion.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                            {suggestion.impact}
                          </span>
                          <button
                            onClick={() => executeSuggestion(suggestion)}
                            disabled={isLoading}
                            className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              suggestion.priority === 'high'
                                ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
                                : suggestion.priority === 'medium'
                                ? 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-300'
                                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
                            }`}
                          >
                            <span>{suggestion.actionText}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Refresh Button */}
              <div className="pt-2 border-t border-gray-200">
                <button
                  onClick={fetchSuggestions}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 p-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Suggestions</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Lightbulb className="w-6 h-6 text-gray-400" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">No suggestions right now</h4>
              <p className="text-sm text-gray-600 mb-4">
                Finley is analyzing your financial data to find optimization opportunities.
              </p>
              <button
                onClick={fetchSuggestions}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {isLoading ? 'Analyzing...' : 'Get Suggestions'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinleySuggests;