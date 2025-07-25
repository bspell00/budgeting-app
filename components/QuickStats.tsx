import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, Zap } from 'lucide-react';

interface QuickStatsProps {
  dashboardData: any;
  transactions: any[];
}

export default function QuickStats({ dashboardData, transactions }: QuickStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Calculate this month's spending
  const thisMonthSpending = transactions
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  // Calculate this month's income
  const thisMonthIncome = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Calculate savings rate
  const savingsRate = thisMonthIncome > 0 ? ((thisMonthIncome - thisMonthSpending) / thisMonthIncome) * 100 : 0;

  // Calculate average transaction amount
  const avgTransactionAmount = transactions.length > 0 
    ? transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / transactions.length 
    : 0;

  // Calculate days since last transaction
  const lastTransactionDate = transactions.length > 0 
    ? new Date(Math.max(...transactions.map(tx => new Date(tx.date).getTime())))
    : null;
  
  const daysSinceLastTransaction = lastTransactionDate 
    ? Math.floor((Date.now() - lastTransactionDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Calculate budget utilization
  const budgetUtilization = dashboardData?.totalBudgeted > 0 
    ? (dashboardData.totalSpent / dashboardData.totalBudgeted) * 100 
    : 0;

  const stats = [
    {
      label: 'Monthly Spending',
      value: formatCurrency(thisMonthSpending),
      change: 0, // Would need previous month data
      icon: TrendingDown,
      color: 'red',
      trend: 'down'
    },
    {
      label: 'Monthly Income',
      value: formatCurrency(thisMonthIncome),
      change: 0,
      icon: TrendingUp,
      color: 'green',
      trend: 'up'
    },
    {
      label: 'Savings Rate',
      value: `${Math.round(savingsRate)}%`,
      change: 0,
      icon: Target,
      color: savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'yellow' : 'red',
      trend: savingsRate >= 20 ? 'up' : 'down'
    },
    {
      label: 'Avg Transaction',
      value: formatCurrency(avgTransactionAmount),
      change: 0,
      icon: DollarSign,
      color: 'blue',
      trend: 'neutral'
    },
    {
      label: 'Budget Used',
      value: `${Math.round(budgetUtilization)}%`,
      change: 0,
      icon: Zap,
      color: budgetUtilization > 90 ? 'red' : budgetUtilization > 70 ? 'yellow' : 'green',
      trend: budgetUtilization > 80 ? 'up' : 'down'
    },
    {
      label: 'Last Transaction',
      value: `${daysSinceLastTransaction} days ago`,
      change: 0,
      icon: Calendar,
      color: 'gray',
      trend: 'neutral'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'green':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'gray':
        return 'bg-gray-50 border-gray-200 text-gray-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getIconColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return 'text-red-500';
      case 'green':
        return 'text-green-500';
      case 'yellow':
        return 'text-yellow-500';
      case 'blue':
        return 'text-blue-500';
      case 'gray':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`${getColorClasses(stat.color)} border rounded-lg p-4 transition-all duration-200 hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium opacity-80">{stat.label}</p>
                <p className="text-lg font-bold mt-1">{stat.value}</p>
              </div>
              <Icon className={`w-5 h-5 ${getIconColorClasses(stat.color)}`} />
            </div>
            
            {/* Trend indicator */}
            {stat.trend !== 'neutral' && (
              <div className="mt-2 flex items-center space-x-1">
                {stat.trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span className="text-xs opacity-70">
                  {stat.trend === 'up' ? 'Good' : stat.trend === 'down' && stat.color === 'red' ? 'High' : 'Low'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}