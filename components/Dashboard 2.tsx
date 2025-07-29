import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import BudgetModal from './BudgetModal';
import GoalModal from './GoalModal';
import TransactionModal from './TransactionModal';
import TransactionList from './TransactionList';
import AIInsights from './AIInsights';
import ChartsModal from './Charts';
import ChartsContent from './ChartsContent';
import QuickStats from './QuickStats';
import { 
  PlusCircle, 
  Target, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  CreditCard,
  Zap,
  Settings,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Receipt,
  Activity,
  BarChart3,
  PieChart
} from 'lucide-react';

const Dashboard = () => {
  const { data: session } = useSession();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [leftSidebarTab, setLeftSidebarTab] = useState('budget');
  const [aiSuggestionsCollapsed, setAiSuggestionsCollapsed] = useState(false);
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashboardResponse, transactionsResponse] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/transactions')
        ]);
        
        if (!dashboardResponse.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        
        const dashboardData = await dashboardResponse.json();
        const transactionsData = transactionsResponse.ok ? await transactionsResponse.json() : [];
        
        setDashboardData(dashboardData);
        setTransactions(transactionsData);
        
        // Fetch AI suggestions
        fetchAISuggestions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    const fetchAISuggestions = async () => {
      try {
        const response = await fetch('/api/insights');
        if (response.ok) {
          const data = await response.json();
          // Get top 3 suggestions for the preview
          setAiSuggestions(data.insights.slice(0, 3));
        }
      } catch (error) {
        console.error('Error fetching AI suggestions:', error);
      }
    };

    if (session) {
      fetchDashboardData();
    }
  }, [session]);

  const handleCreateBudget = async (budgetData: any) => {
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(budgetData),
      });

      if (!response.ok) {
        throw new Error('Failed to create budget');
      }

      // Refresh dashboard data
      const updatedResponse = await fetch('/api/dashboard');
      const updatedData = await updatedResponse.json();
      setDashboardData(updatedData);
    } catch (error) {
      console.error('Error creating budget:', error);
      alert('Failed to create budget. Please try again.');
    }
  };

  const handleCreateTransaction = async (transactionData: any) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        throw new Error('Failed to create transaction');
      }

      // Refresh both dashboard and transactions data
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/transactions')
      ]);
      
      const dashboardData = await dashboardResponse.json();
      const transactionsData = await transactionsResponse.json();
      
      setDashboardData(dashboardData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction. Please try again.');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      // Refresh both dashboard and transactions data
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/transactions')
      ]);
      
      const dashboardData = await dashboardResponse.json();
      const transactionsData = await transactionsResponse.json();
      
      setDashboardData(dashboardData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  };

  const handleCreateGoal = async (goalData: any) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });

      if (!response.ok) {
        throw new Error('Failed to create goal');
      }

      // Refresh dashboard data
      const updatedResponse = await fetch('/api/dashboard');
      const updatedData = await updatedResponse.json();
      setDashboardData(updatedData);
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  const budgetData = dashboardData;

  const debtGoals = dashboardData?.goals ? dashboardData.goals.filter((goal: any) => goal.type === 'debt') : [];
  const savingsGoals = dashboardData?.goals ? dashboardData.goals.filter((goal: any) => goal.type === 'savings') : [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'overspent': return 'text-red-600 bg-red-50';
      case 'on-track': return 'text-green-600 bg-green-50';
      case 'goal': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Budget Dashboard</h1>
            <p className="text-gray-600">December 2024</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowAIInsights(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors shadow-sm"
            >
              <Zap className="w-4 h-4" />
              <span className="font-medium">AI Insights</span>
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            </button>
            <button 
              onClick={() => setLeftSidebarTab('charts')}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Charts</span>
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setLeftSidebarTab('budget')}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium transition-colors ${
                leftSidebarTab === 'budget'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Budget</span>
            </button>
            <button
              onClick={() => setLeftSidebarTab('transactions')}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium transition-colors ${
                leftSidebarTab === 'transactions'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Transactions</span>
            </button>
            <button
              onClick={() => setLeftSidebarTab('charts')}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium transition-colors ${
                leftSidebarTab === 'charts'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Charts</span>
            </button>
            <button
              onClick={() => setLeftSidebarTab('actions')}
              className={`flex-1 flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium transition-colors ${
                leftSidebarTab === 'actions'
                  ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Actions</span>
            </button>
          </div>
          
          <div className="p-6">
            {leftSidebarTab === 'budget' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Quick Stats</p>
                    <p className="text-xs text-blue-500 mt-1">View budget categories in main content</p>
                  </div>
                  <button
                    onClick={() => setShowBudgetModal(true)}
                    className="w-full flex items-center space-x-2 p-3 text-white rounded-lg transition-colors"
                    style={{ backgroundColor: '#aed274' }}
                    onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#9bc267'}
                    onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#aed274'}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Budget Category</span>
                  </button>
                </div>
              </div>
            )}

            {leftSidebarTab === 'transactions' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                  <button
                    onClick={() => setShowTransactionModal(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {dashboardData.recentTransactions && dashboardData.recentTransactions.length > 0 ? dashboardData.recentTransactions.map((transaction: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{transaction.name}</p>
                        <p className="text-sm text-gray-600">{transaction.category} • {transaction.date}</p>
                      </div>
                      <span className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  )) : (
                    <div className="p-3 text-center text-gray-500">
                      <p>No recent transactions</p>
                      <button
                        onClick={() => setShowTransactionModal(true)}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Add your first transaction
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {leftSidebarTab === 'charts' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chart Types</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-indigo-600 font-medium">6 Chart Types Available</p>
                    <p className="text-xs text-indigo-500 mt-1">Switch tabs in main content to explore</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <TrendingUp className="w-4 h-4 mx-auto text-green-500 mb-1" />
                      <span className="block text-gray-600">Spending</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <PieChart className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                      <span className="block text-gray-600">Categories</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <BarChart3 className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                      <span className="block text-gray-600">Budget</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <DollarSign className="w-4 h-4 mx-auto text-orange-500 mb-1" />
                      <span className="block text-gray-600">Cash Flow</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <Target className="w-4 h-4 mx-auto text-red-500 mb-1" />
                      <span className="block text-gray-600">Goals</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <Calendar className="w-4 h-4 mx-auto text-indigo-500 mb-1" />
                      <span className="block text-gray-600">Monthly</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {leftSidebarTab === 'actions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span>Connect Bank Account</span>
                  </button>
                  <button
                    onClick={() => setShowTransactionModal(true)}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <PlusCircle className="w-5 h-5 text-[#86b686]" />
                    <span>Add Transaction</span>
                  </button>
                  <button
                    onClick={() => setShowBudgetModal(true)}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Target className="w-5 h-5 text-purple-600" />
                    <span>Create Budget</span>
                  </button>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Target className="w-5 h-5 text-red-600" />
                    <span>Create Goal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          {/* Main Content */}
          <main className="flex-1 p-6">
            {/* Quick Stats - Always visible */}
            <QuickStats dashboardData={dashboardData} transactions={transactions} />
            
            {/* Budget Tab Content */}
            {leftSidebarTab === 'budget' && (
              <>
                {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">To Be Assigned</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(budgetData.toBeAssigned || 0)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Budgeted</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(budgetData.totalBudgeted || 0)}</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Spent</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(budgetData.totalSpent || 0)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            {/* AI Suggestions - Collapsible */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 mb-8">
              <div 
                className="flex items-center justify-between p-6 cursor-pointer"
                onClick={() => setAiSuggestionsCollapsed(!aiSuggestionsCollapsed)}
              >
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-gray-900">AI Suggestions</h2>
                  {aiSuggestions.length > 0 && (
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                      {aiSuggestions.length}
                    </span>
                  )}
                </div>
                {aiSuggestionsCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                )}
              </div>
              
              {!aiSuggestionsCollapsed && (
                <div className="px-6 pb-6">
                  <div className="space-y-3">
                    {aiSuggestions.length > 0 ? aiSuggestions.map((suggestion, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{suggestion.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                          <div className="flex items-center mt-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full" 
                                style={{width: `${suggestion.confidence}%`}}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{suggestion.confidence}% confidence</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAIInsights(true);
                          }}
                          className="ml-4 px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                        >
                          View All
                        </button>
                      </div>
                    )) : (
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-gray-500 text-sm">Add more transactions to get AI-powered insights</p>
                        <button 
                          onClick={() => setShowTransactionModal(true)}
                          className="mt-2 flex items-center space-x-1 text-[#86b686] hover:text-[#73a373] text-sm font-medium"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>Add Transaction</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* Budget Categories */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Budget Categories</h2>
                <button 
                  onClick={() => setShowBudgetModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors"
                  style={{ backgroundColor: '#aed274' }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#9bc267'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#aed274'}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {budgetData?.categories && budgetData.categories.length > 0 ? budgetData.categories.map((category: any) => (
                <div 
                  key={category.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-medium text-gray-900">{category.name}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(category.status)}`}>
                          {category.status === 'overspent' ? 'Overspent' : 
                           category.status === 'goal' ? 'Goal' : 'On Track'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Budgeted: </span>
                          <span className="font-medium">{formatCurrency(category.budgeted)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Spent: </span>
                          <span className="font-medium">{formatCurrency(category.spent)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Available: </span>
                          <span className={`font-medium ${category.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(category.available)}
                          </span>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            category.available < 0 ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (category.spent / category.budgeted) * 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              )) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No budget categories found. Create some budgets to get started!</p>
                </div>
              )}
            </div>
          </div>
              </>
            )}

            {/* Transactions Tab Content */}
            {leftSidebarTab === 'transactions' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">All Transactions</h2>
                    <button
                      onClick={() => setShowTransactionModal(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Transaction</span>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <TransactionList
                    transactions={transactions}
                    onDeleteTransaction={handleDeleteTransaction}
                    onAddTransaction={() => setShowTransactionModal(true)}
                  />
                </div>
              </div>
            )}

            {/* Charts Tab Content */}
            {leftSidebarTab === 'charts' && (
              <ChartsContent dashboardData={dashboardData} transactions={transactions} />
            )}

          </main>

          {/* Right Sidebar */}
          <aside className="w-80 bg-white border-l border-gray-200 p-6">
            <div className="space-y-6">
              {/* Debt Payoff Goals */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Debt Payoff Goals</h3>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Add Goal
                  </button>
                </div>
                
                <div className="space-y-4">
                  {debtGoals && debtGoals.length > 0 ? debtGoals.map((goal: any) => (
                    <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{goal.name}</h4>
                        <span className="text-xs text-gray-600">Target: {goal.payoffDate}</span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Balance:</span>
                          <span className="font-medium text-red-600">{formatCurrency(goal.current)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment:</span>
                          <span className="font-medium">{formatCurrency(goal.monthlyPayment)}</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                        <div 
                          className="bg-red-500 h-2 rounded-full"
                          style={{width: `${Math.min(100, ((goal.target - goal.current) / goal.target) * 100)}%`}}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {Math.round(((goal.target - goal.current) / goal.target) * 100)}% complete
                      </p>
                    </div>
                  )) : (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">No debt goals yet</p>
                      <button
                        onClick={() => setShowGoalModal(true)}
                        className="mt-2 text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Create your first goal
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Savings Goals */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Savings Goals</h3>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    Add Goal
                  </button>
                </div>
                
                <div className="space-y-4">
                  {savingsGoals && savingsGoals.length > 0 ? savingsGoals.map((goal: any) => (
                    <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{goal.name}</h4>
                        <span className="text-xs text-gray-600">Target: {goal.payoffDate}</span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Saved:</span>
                          <span className="font-medium text-green-600">{formatCurrency(goal.current)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Target:</span>
                          <span className="font-medium">{formatCurrency(goal.target)}</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{width: `${Math.min(100, (goal.current / goal.target) * 100)}%`}}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {Math.round((goal.current / goal.target) * 100)}% complete
                      </p>
                    </div>
                  )) : (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">No savings goals yet</p>
                      <button
                        onClick={() => setShowGoalModal(true)}
                        className="mt-2 text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        Create your first goal
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Insights */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Insights</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Spending Trend</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      {dashboardData.totalSpent > 0 
                        ? `You've spent ${formatCurrency(dashboardData.totalSpent)} this month`
                        : 'No spending recorded yet'
                      }
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Budget Status</span>
                    </div>
                    <p className="text-sm text-green-700">
                      {dashboardData.categories && dashboardData.categories.length > 0
                        ? `${dashboardData.categories.length} budget categories active`
                        : 'Create budgets to track spending'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      
      <BudgetModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        onSubmit={handleCreateBudget}
      />
      
      <GoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onSubmit={handleCreateGoal}
      />
      
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSubmit={handleCreateTransaction}
        budgetCategories={dashboardData?.categories?.map((cat: any) => cat.name.replace(/^\S+\s/, '')) || []}
      />
      
      <AIInsights
        isOpen={showAIInsights}
        onClose={() => setShowAIInsights(false)}
      />
      
      <ChartsModal
        isOpen={showCharts}
        onClose={() => setShowCharts(false)}
      />
    </div>
  );
};

export default Dashboard;