import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  Target, 
  Lightbulb,
  Clock,
  ArrowRight,
  RefreshCw,
  Shield,
  PieChart,
  Activity
} from 'lucide-react';

interface DebtPlan {
  id: string;
  debtName: string;
  currentBalance: number;
  minimumPayment: number;
  interestRate: number;
  currentPayoffDate: string;
  optimizedPayoffDate: string;
  monthsSaved: number;
  interestSaved: number;
  recommendedPayment: number;
  strategy: string;
}

interface BehavioralInsight {
  id: string;
  type: 'spending_trigger' | 'success_pattern' | 'optimization_opportunity' | 'warning';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedActions: string[];
  dataPoints: string[];
  createdAt: string;
}

interface SpendingPattern {
  category: string;
  averageMonthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: 'low' | 'medium' | 'high';
  triggerEvents: string[];
  bestPerformingWeeks: string[];
  recommendations: string[];
}

interface FinancialHealth {
  overall: number;
  debtUtilization: number;
  emergencyFundRatio: number;
  savingsRate: number;
  budgetConsistency: number;
  paymentHistory: number;
  improvementTrend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
  healthLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

interface Recommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'debt' | 'savings' | 'spending' | 'emergency' | 'goals';
  title: string;
  description: string;
  estimatedImpact: string;
  timeToImplement: string;
  difficultyLevel: 'easy' | 'moderate' | 'challenging';
  implementationSteps: string[];
  createdAt: string;
  completedAt?: string;
}

const AIAdvisorDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'debt' | 'behavior' | 'recommendations'>('overview');
  const [financialHealth, setFinancialHealth] = useState<FinancialHealth | null>(null);
  const [debtAnalysis, setDebtAnalysis] = useState<{ plans: DebtPlan[]; summary: any } | null>(null);
  const [behavioralData, setBehavioralData] = useState<{ 
    spendingPatterns: SpendingPattern[]; 
    insights: BehavioralInsight[]; 
    summary: any;
  } | null>(null);
  const [recommendations, setRecommendations] = useState<{ 
    recommendations: Recommendation[]; 
    summary: any;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [healthRes, debtRes, behaviorRes, recRes] = await Promise.all([
        fetch('/api/ai-advisor/financial-health'),
        fetch('/api/ai-advisor/debt-analysis'),
        fetch('/api/ai-advisor/behavioral-insights'),
        fetch('/api/ai-advisor/recommendations')
      ]);

      const [healthData, debtData, behaviorData, recData] = await Promise.all([
        healthRes.json(),
        debtRes.json(),
        behaviorRes.json(),
        recRes.json()
      ]);

      if (healthData.success) setFinancialHealth(healthData.data);
      if (debtData.success) setDebtAnalysis(debtData.data);
      if (behaviorData.success) setBehavioralData(behaviorData.data);
      if (recData.success) setRecommendations(recData.data);
    } catch (error) {
      console.error('Error loading AI advisor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const markRecommendationCompleted = async (recId: string) => {
    try {
      const response = await fetch('/api/ai-advisor/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: recId })
      });

      if (response.ok) {
        // Update local state to mark as completed
        setRecommendations(prev => prev ? {
          ...prev,
          recommendations: prev.recommendations.map(rec => 
            rec.id === recId 
              ? { ...rec, completedAt: new Date().toISOString() }
              : rec
          )
        } : null);
      }
    } catch (error) {
      console.error('Error marking recommendation as completed:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 65) return 'text-blue-600 bg-blue-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium': return <Activity className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Lightbulb className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-lg font-medium text-gray-600">
              Finley is analyzing your financial data...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finley's Financial Insights</h1>
            <p className="text-gray-600">Personalized recommendations and analysis</p>
          </div>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-[#aed274] text-white rounded-lg hover:bg-[#9bc267] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* AI Insights Overview */}
      <div className="space-y-6">
        {/* Quick Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Financial Health Card */}
          {financialHealth && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Shield className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Financial Health</h3>
              </div>
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold mb-2 ${getHealthColor(financialHealth.overall)}`}>
                  {Math.round(financialHealth.overall)}
                </div>
                <p className="text-sm text-gray-600">
                  {financialHealth.improvementTrend === 'improving' && '📈 Improving'}
                  {financialHealth.improvementTrend === 'stable' && '➡️ Stable'}
                  {financialHealth.improvementTrend === 'declining' && '📉 Needs attention'}
                </p>
                <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(financialHealth.overall)}`}>
                  {Math.round(financialHealth.overall)}/100
                </div>
              </div>
            </div>
          )}

          {/* Debt Overview Card */}
          {debtAnalysis && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Debt Overview</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Total Debt</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(debtAnalysis.summary.totalDebt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Potential Savings</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(debtAnalysis.summary.totalInterestSavings)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Spending Insights Card */}
          {behavioralData && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <TrendingUp className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Spending Insights</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">AI Insights Found</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {behavioralData.summary.totalInsights}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">High Impact Actions</p>
                  <p className="text-lg font-semibold text-orange-600">
                    {behavioralData.insights.filter(i => i.impact === 'high').length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Items Card */}
          {recommendations && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <Lightbulb className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">Action Items</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Priority Actions</p>
                  <p className="text-2xl font-bold text-red-600">
                    {recommendations.summary.critical + recommendations.summary.high}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Recommendations</p>
                  <p className="text-lg font-semibold text-gray-600">
                    {recommendations.summary.total}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'overview', label: 'Overview', icon: Activity },
              { key: 'debt', label: 'Debt Analysis', icon: Target },
              { key: 'behavior', label: 'Spending Patterns', icon: TrendingUp },
              { key: 'recommendations', label: 'Action Plan', icon: Lightbulb }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-[#aed274] text-[#aed274]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Selected Tab Content Below */}
      <div className="bg-white rounded-lg shadow-sm">

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {debtAnalysis && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-red-800">Total Debt</span>
                    </div>
                    <p className="text-2xl font-bold text-red-900 mt-1">
                      {formatCurrency(debtAnalysis.summary.totalDebt)}
                    </p>
                  </div>
                )}

                {debtAnalysis && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Interest Savings</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {formatCurrency(debtAnalysis.summary.totalInterestSavings)}
                    </p>
                  </div>
                )}

                {behavioralData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <Brain className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">AI Insights</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {behavioralData.summary.totalInsights}
                    </p>
                  </div>
                )}

                {recommendations && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">Action Items</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900 mt-1">
                      {recommendations.summary.critical + recommendations.summary.high}
                    </p>
                  </div>
                )}
              </div>

              {/* Top Recommendations Preview */}
              {recommendations && recommendations.recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Recommendations</h3>
                  <div className="space-y-3">
                    {recommendations.recommendations.slice(0, 3).map((rec) => (
                      <div
                        key={rec.id}
                        className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{rec.title}</h4>
                            <p className="text-sm mt-1 opacity-80">{rec.description}</p>
                            <p className="text-sm font-medium mt-2">💡 {rec.estimatedImpact}</p>
                          </div>
                          <button
                            onClick={() => setActiveTab('recommendations')}
                            className="ml-4 p-1 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Debt Analysis Tab */}
          {activeTab === 'debt' && debtAnalysis && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Debt Payoff Strategy</h3>
                <p className="text-blue-800">
                  Using the debt avalanche method, you could save{' '}
                  <span className="font-bold">{formatCurrency(debtAnalysis.summary.totalInterestSavings)}</span>
                  {' '}in interest and pay off debt{' '}
                  <span className="font-bold">{debtAnalysis.summary.totalMonthsSaved} months earlier</span>.
                </p>
              </div>

              <div className="space-y-4">
                {debtAnalysis.plans.map((plan) => (
                  <div key={plan.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">{plan.debtName}</h4>
                      <span className="text-2xl font-bold text-red-600">
                        {formatCurrency(plan.currentBalance)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Interest Rate</p>
                        <p className="font-semibold">{(plan.interestRate * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Minimum Payment</p>
                        <p className="font-semibold">{formatCurrency(plan.minimumPayment)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Recommended Payment</p>
                        <p className="font-semibold text-green-600">{formatCurrency(plan.recommendedPayment)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Interest Savings</p>
                        <p className="font-semibold text-green-600">{formatCurrency(plan.interestSaved)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-600">Current payoff: </span>
                        <span className="font-medium">
                          {new Date(plan.currentPayoffDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Optimized payoff: </span>
                        <span className="font-medium text-green-600">
                          {new Date(plan.optimizedPayoffDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-green-600 font-medium">
                        {plan.monthsSaved} months sooner!
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavioral Insights Tab */}
          {activeTab === 'behavior' && behavioralData && (
            <div className="space-y-6">
              {/* Insights */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavioral Insights</h3>
                <div className="space-y-4">
                  {behavioralData.insights.map((insight) => (
                    <div key={insight.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start space-x-3">
                        {getImpactIcon(insight.impact)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                {Math.round(insight.confidence * 100)}% confidence
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                insight.impact === 'high' ? 'bg-red-100 text-red-700' :
                                insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {insight.impact} impact
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-700 mb-3">{insight.description}</p>
                          {insight.actionable && insight.suggestedActions.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-900 mb-2">Suggested Actions:</p>
                              <ul className="text-sm text-gray-700 space-y-1">
                                {insight.suggestedActions.map((action, index) => (
                                  <li key={index} className="flex items-start space-x-2">
                                    <span>•</span>
                                    <span>{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spending Patterns */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Patterns</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {behavioralData.spendingPatterns.slice(0, 6).map((pattern) => (
                    <div key={pattern.category} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{pattern.category}</h4>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(pattern.averageMonthly)}/mo
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          pattern.trend === 'increasing' ? 'bg-red-100 text-red-700' :
                          pattern.trend === 'decreasing' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {pattern.trend === 'increasing' ? '📈' : pattern.trend === 'decreasing' ? '📉' : '➡️'} {pattern.trend}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          pattern.volatility === 'high' ? 'bg-orange-100 text-orange-700' :
                          pattern.volatility === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {pattern.volatility} volatility
                        </span>
                      </div>
                      {pattern.recommendations.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-600 mb-1">Recommendations:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {pattern.recommendations.slice(0, 2).map((rec, index) => (
                              <li key={index}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && recommendations && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Personalized Action Plan</h3>
                <div className="text-sm text-gray-600">
                  {recommendations.summary.total} recommendations • {recommendations.summary.actionableToday} actionable today
                </div>
              </div>

              {recommendations.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`border rounded-lg p-6 ${getPriorityColor(rec.priority)} ${
                    rec.completedAt ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      {rec.completedAt ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <div className={`w-3 h-3 rounded-full mt-2 ${
                          rec.priority === 'critical' ? 'bg-red-500' :
                          rec.priority === 'high' ? 'bg-orange-500' :
                          rec.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                          <span className="text-xs font-medium px-2 py-1 bg-white bg-opacity-50 rounded">
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-sm mb-2 opacity-90">{rec.description}</p>
                        <div className="flex items-center space-x-4 text-xs opacity-75">
                          <span>💡 {rec.estimatedImpact}</span>
                          <span>⏱️ {rec.timeToImplement}</span>
                          <span>🎯 {rec.difficultyLevel}</span>
                        </div>
                      </div>
                    </div>
                    {!rec.completedAt && (
                      <button
                        onClick={() => markRecommendationCompleted(rec.id)}
                        className="px-3 py-1 bg-white bg-opacity-75 hover:bg-opacity-100 text-xs font-medium rounded transition-colors"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>

                  {rec.implementationSteps.length > 0 && (
                    <div className="bg-white bg-opacity-50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Implementation Steps:</p>
                      <ol className="text-sm space-y-1">
                        {rec.implementationSteps.map((step, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="font-medium text-gray-500">{index + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {rec.completedAt && (
                    <div className="text-xs text-green-600 mt-2">
                      ✅ Completed on {new Date(rec.completedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAdvisorDashboard;