import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb, 
  Target,
  CheckCircle,
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react';

interface Insight {
  id: string;
  type: 'warning' | 'tip' | 'goal' | 'trend' | 'success';
  title: string;
  description: string;
  action?: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  amount?: number;
}

interface InsightsSummary {
  totalInsights: number;
  highPriority: number;
  warnings: number;
  tips: number;
  trends: number;
  successes: number;
}

interface AIInsightsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIInsights({ isOpen, onClose }: AIInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInsights();
    }
  }, [isOpen]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/insights');
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'tip':
        return <Lightbulb className="w-5 h-5 text-yellow-500" />;
      case 'goal':
        return <Target className="w-5 h-5 text-blue-500" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-purple-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Brain className="w-5 h-5 text-gray-500" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-l-red-500 bg-red-50';
      case 'tip':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'goal':
        return 'border-l-blue-500 bg-blue-50';
      case 'trend':
        return 'border-l-purple-500 bg-purple-50';
      case 'success':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">High</span>;
      case 'medium':
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">Medium</span>;
      case 'low':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Low</span>;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Insights</h2>
              <p className="text-sm text-gray-600">Smart recommendations for your budget</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchInsights}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.totalInsights}</div>
                <div className="text-sm text-gray-600">Total Insights</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.warnings}</div>
                <div className="text-sm text-gray-600">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.tips}</div>
                <div className="text-sm text-gray-600">Tips</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.trends}</div>
                <div className="text-sm text-gray-600">Trends</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.successes}</div>
                <div className="text-sm text-gray-600">Successes</div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing your spending patterns...</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              {insights.length > 0 ? (
                <div className="p-6 space-y-4">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={`border-l-4 ${getInsightColor(insight.type)} p-4 rounded-r-lg cursor-pointer transition-all hover:shadow-md`}
                      onClick={() => setSelectedInsight(insight)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getInsightIcon(insight.type)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                              {getPriorityBadge(insight.priority)}
                            </div>
                            <p className="text-gray-700 text-sm mb-2">{insight.description}</p>
                            {insight.action && (
                              <p className="text-gray-600 text-sm italic">💡 {insight.action}</p>
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center space-x-3">
                                {insight.category && (
                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {insight.category}
                                  </span>
                                )}
                                {insight.amount && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    {formatCurrency(Math.abs(insight.amount))}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-16 bg-gray-200 rounded-full h-1">
                                  <div 
                                    className="bg-purple-600 h-1 rounded-full" 
                                    style={{width: `${insight.confidence}%`}}
                                  ></div>
                                </div>
                                <span className="text-xs text-gray-500">{insight.confidence}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 ml-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No insights available yet</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Add more transactions and budgets to get personalized recommendations
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}