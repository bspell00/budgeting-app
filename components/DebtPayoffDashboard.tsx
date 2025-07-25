import React, { useState, useEffect } from 'react';
import { TrendingDown, Calendar, DollarSign, Target, Zap, Trophy, Calculator, BarChart3 } from 'lucide-react';
import DebtPayoffCalculator, { DebtAccount, PayoffStrategy, PayoffComparison } from '../lib/debt-payoff-calculator';
import AIGeneratedPlans from './AIGeneratedPlans';

interface DebtPayoffDashboardProps {
  accounts: any[];
}

export default function DebtPayoffDashboard({ accounts }: DebtPayoffDashboardProps) {
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([]);
  const [extraPayment, setExtraPayment] = useState(0);
  const [comparison, setComparison] = useState<PayoffComparison | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [targetMonths, setTargetMonths] = useState(36);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Convert connected accounts to debt accounts (only negative balances = actual debt)
    const debts = accounts
      .filter(account => account.accountType === 'credit' && account.balance < 0)
      .map(account => ({
        id: account.id,
        name: account.accountName,
        balance: Math.abs(account.balance), // Convert negative debt to positive amount
        minimumPayment: Math.max(25, Math.round(Math.abs(account.balance) * 0.02)), // 2% minimum or $25
        interestRate: 18.99, // Default APR - user can modify
        accountType: 'credit_card' as const
      }));
    
    setDebtAccounts(debts);
  }, [accounts]);

  useEffect(() => {
    if (debtAccounts.length > 0) {
      setLoading(true);
      try {
        const comp = DebtPayoffCalculator.compareStrategies(debtAccounts, extraPayment);
        setComparison(comp);
      } catch (error) {
        console.error('Error calculating debt payoff:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [debtAccounts, extraPayment]);

  const handleDebtUpdate = (index: number, field: keyof DebtAccount, value: any) => {
    const updated = [...debtAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setDebtAccounts(updated);
  };

  const totalDebt = debtAccounts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimumPayments = debtAccounts.reduce((sum, debt) => sum + debt.minimumPayment, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  if (debtAccounts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Congratulations!</h2>
          <p className="text-gray-600 mb-6">You don't have any debt accounts to pay off. You're already debt-free!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <TrendingDown className="w-8 h-8 text-red-500 mr-3" />
            Debt Payoff Planner
          </h1>
          <p className="text-gray-600 mt-1">Create your personalized debt-free plan</p>
        </div>
      </div>

      {/* Debt Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-600">Total Debt</p>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-600">Minimum Payments</p>
              <p className="text-2xl font-bold text-yellow-900">{formatCurrency(totalMinimumPayments)}/mo</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-600">Extra Payment</p>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-blue-900">$</span>
                <input
                  type="number"
                  value={extraPayment}
                  onChange={(e) => setExtraPayment(Number(e.target.value) || 0)}
                  className="text-xl font-bold text-blue-900 bg-transparent border-none outline-none w-20"
                  placeholder="0"
                />
                <span className="text-sm text-blue-600">/mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debt Accounts */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Debt Accounts</h2>
          <p className="text-sm text-gray-600 mt-1">Adjust interest rates and minimum payments as needed</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Payment</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {debtAccounts.map((debt, index) => (
                <tr key={debt.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{debt.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{debt.accountType.replace('_', ' ')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(debt.balance)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        step="0.01"
                        value={debt.interestRate}
                        onChange={(e) => handleDebtUpdate(index, 'interestRate', Number(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        value={debt.minimumPayment}
                        onChange={(e) => handleDebtUpdate(index, 'minimumPayment', Number(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy Comparison */}
      {comparison && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Debt Snowball */}
          <div className={`border-2 rounded-lg p-6 transition-all ${
            selectedStrategy === 'snowball' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Zap className="w-6 h-6 text-yellow-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Debt Snowball</h3>
              </div>
              <button
                onClick={() => setSelectedStrategy('snowball')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedStrategy === 'snowball'
                    ? 'bg-[#86b686] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Select
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Pay smallest balances first for psychological wins and momentum
            </p>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payoff Date:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(comparison.snowball.payoffDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Interest:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(comparison.snowball.totalInterest)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Time to Freedom:</span>
                <span className="text-sm font-medium text-gray-900">
                  {comparison.snowball.monthsToPayoff} months
                </span>
              </div>
            </div>
          </div>

          {/* Debt Avalanche */}
          <div className={`border-2 rounded-lg p-6 transition-all ${
            selectedStrategy === 'avalanche' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Calculator className="w-6 h-6 text-green-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Debt Avalanche</h3>
                {comparison.savings.recommendedStrategy === 'avalanche' && (
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedStrategy('avalanche')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedStrategy === 'avalanche'
                    ? 'bg-[#86b686] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Select
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Pay highest interest rates first for maximum savings
            </p>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payoff Date:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(comparison.avalanche.payoffDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Interest:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(comparison.avalanche.totalInterest)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Time to Freedom:</span>
                <span className="text-sm font-medium text-gray-900">
                  {comparison.avalanche.monthsToPayoff} months
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Savings Comparison */}
      {comparison && comparison.savings.interestSaved > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Trophy className="w-6 h-6 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-green-900">Potential Savings</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-green-600">Interest Savings (Avalanche vs Snowball)</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(comparison.savings.interestSaved)}
              </p>
            </div>
            <div>
              <p className="text-sm text-green-600">Time Savings</p>
              <p className="text-2xl font-bold text-green-900">
                {Math.abs(comparison.savings.timeSaved)} months
              </p>
            </div>
          </div>
          
          <p className="text-sm text-green-700 mt-4">
            💡 The <strong>{comparison.savings.recommendedStrategy}</strong> method is recommended for your situation.
          </p>
        </div>
      )}

      {/* Progress Milestones */}
      {comparison && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <BarChart3 className="w-6 h-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Your Debt-Free Journey</h3>
          </div>
          
          <div className="space-y-4">
            {DebtPayoffCalculator.generateMilestones(
              selectedStrategy === 'snowball' ? comparison.snowball : comparison.avalanche
            ).map((milestone, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                  <p className="text-sm text-gray-600">{milestone.description}</p>
                  <p className="text-sm text-purple-600 font-medium">
                    Target: {formatDate(milestone.targetDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(milestone.amountPaid)} paid
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(milestone.remainingDebt)} remaining
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Generated Debt Plans */}
      <AIGeneratedPlans category="debt" />

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-2">Calculating your debt payoff plan...</p>
        </div>
      )}
    </div>
  );
}