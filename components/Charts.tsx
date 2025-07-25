import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { 
  X, 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  DollarSign, 
  Target,
  Calendar,
  RefreshCw,
  Download
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

interface ChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChartsModal({ isOpen, onClose }: ChartsModalProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('spending');

  useEffect(() => {
    if (isOpen) {
      fetchChartData();
    }
  }, [isOpen]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/charts');
      if (response.ok) {
        const data = await response.json();
        setChartData(data);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: false,
      },
    },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const tabs = [
    { id: 'spending', label: 'Spending Trends', icon: TrendingUp },
    { id: 'categories', label: 'Categories', icon: PieChart },
    { id: 'budget', label: 'Budget vs Actual', icon: BarChart3 },
    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'monthly', label: 'Monthly', icon: Calendar },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Analytics & Charts</h2>
              <p className="text-sm text-gray-600">Visualize your spending patterns and trends</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchChartData}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-white border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading analytics...</p>
              </div>
            </div>
          ) : !chartData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No data available</p>
                <p className="text-gray-500 text-sm mt-2">Add some transactions to see charts</p>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {/* Spending Trends */}
              {activeTab === 'spending' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Spending Trends</h3>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="h-96">
                        <Line data={chartData.spendingTrends} options={chartOptions} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Breakdown */}
              {activeTab === 'categories' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <h4 className="font-medium mb-4">Pie Chart</h4>
                        <div className="h-80">
                          <Pie data={chartData.categoryBreakdown} options={pieOptions} />
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <h4 className="font-medium mb-4">Doughnut Chart</h4>
                        <div className="h-80">
                          <Doughnut data={chartData.categoryBreakdown} options={pieOptions} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Budget vs Actual */}
              {activeTab === 'budget' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual Spending</h3>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="h-96">
                        <Bar data={chartData.budgetVsActual} options={chartOptions} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Flow */}
              {activeTab === 'cashflow' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses</h3>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="h-96">
                        <Bar data={chartData.cashFlow} options={chartOptions} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Goals Progress */}
              {activeTab === 'goals' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Goal Progress</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {chartData.goalProgress.map((goal: any) => (
                        <div key={goal.id} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-gray-900">{goal.name}</h4>
                            <span className={`text-sm px-2 py-1 rounded-full ${
                              goal.type === 'savings' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {goal.type === 'savings' ? 'Savings' : 'Debt'}
                            </span>
                          </div>
                          
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                              <span>{formatCurrency(goal.current)}</span>
                              <span>{formatCurrency(goal.target)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  goal.type === 'savings' ? 'bg-green-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, goal.progress)}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">
                              {Math.round(goal.progress)}%
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatCurrency(Math.abs(goal.remaining))} {goal.type === 'savings' ? 'to go' : 'remaining'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly Comparison */}
              {activeTab === 'monthly' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Comparison (Last 6 Months)</h3>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="h-96">
                        <Bar data={chartData.monthlyComparison} options={chartOptions} />
                      </div>
                    </div>
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