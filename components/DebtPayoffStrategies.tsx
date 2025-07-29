import React, { useState, useEffect } from 'react';
import { 
  Target, 
  TrendingUp, 
  Zap, 
  Brain, 
  Edit3, 
  Trash2, 
  Check, 
  Circle, 
  ArrowRight,
  DollarSign,
  Calendar,
  BarChart3,
  MessageCircle,
  Plus,
  Activity
} from 'lucide-react';

interface Debt {
  id: string;
  accountName: string;
  balance: number;
  interestRate?: number;
  minimumPayment: number;
}

interface DebtPlan {
  id: string;
  title: string;
  description: string;
  strategy: 'snowball' | 'avalanche' | 'ai_custom';
  steps: string[];
  totalDebt: number;
  monthlyPayment: number;
  estimatedMonths: number;
  progress: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  payments: PaymentRecord[];
}

interface PaymentRecord {
  id: string;
  amount: number;
  targetDebt: string;
  date: string;
  month: string;
}

interface MonthlyPaymentData {
  month: string;
  amount: number;
  count: number;
  payments: {
    description: string;
    amount: number;
    date: string;
  }[];
}

interface DebtPayoffStrategiesProps {
  debts: Debt[];
  accounts: any[]; // Full account data for payment detection
  transactions: any[]; // Transaction data for automatic payment tracking
  onOpenAIChat: () => void;
  onRefreshData: () => void;
}

const DebtPayoffStrategies: React.FC<DebtPayoffStrategiesProps> = ({
  debts,
  accounts,
  transactions,
  onOpenAIChat,
  onRefreshData
}) => {
  const [activePlan, setActivePlan] = useState<DebtPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate total debt and monthly minimums
  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimums = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const debtCount = debts.length;

  useEffect(() => {
    loadActivePlan();
  }, []);

  // Automatically detect credit card payments from transactions
  const detectCreditCardPayments = () => {
    if (!activePlan || !transactions || !accounts) return [];

    // Get the debt accounts that are part of this plan
    const debtAccountIds = debts.map(debt => debt.id);
    
    // Find payments to credit cards (positive transactions to credit accounts)
    const creditCardPayments = transactions.filter(transaction => {
      // Check if this is a payment TO a credit card (positive amount to credit account)
      const targetAccount = accounts.find(acc => acc.id === transaction.accountId);
      const isPaymentToCredit = targetAccount?.accountType === 'credit' && transaction.amount > 0;
      
      // Or check if this is a payment FROM checking TO credit (negative amount with credit card category)
      const isPaymentFromChecking = transaction.amount < 0 && 
        (transaction.category?.toLowerCase().includes('credit card') ||
         transaction.category?.toLowerCase().includes('payment') ||
         transaction.description?.toLowerCase().includes('credit card') ||
         debtAccountIds.some(debtId => 
           transaction.description?.toLowerCase().includes(accounts.find(acc => acc.id === debtId)?.accountName?.toLowerCase() || '')
         ));

      return isPaymentToCredit || isPaymentFromChecking;
    });

    // Group by month and calculate totals
    const paymentsByMonth = creditCardPayments.reduce((acc, payment) => {
      const date = new Date(payment.date);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          amount: 0,
          count: 0,
          payments: []
        };
      }
      
      acc[monthKey].amount += Math.abs(payment.amount);
      acc[monthKey].count += 1;
      acc[monthKey].payments.push({
        description: payment.description,
        amount: Math.abs(payment.amount),
        date: payment.date
      });
      
      return acc;
    }, {} as Record<string, MonthlyPaymentData>);

    // Return sorted by date (most recent first)
    return (Object.values(paymentsByMonth) as MonthlyPaymentData[])
      .sort((a, b) => new Date(b.payments[0].date).getTime() - new Date(a.payments[0].date).getTime())
      .slice(0, 6); // Last 6 months
  };

  // Calculate automatic progress based on actual payments
  const calculateAutomaticProgress = () => {
    if (!activePlan || !debts.length) return 0;

    const detectedPayments = detectCreditCardPayments();
    const totalPaid = detectedPayments.reduce((sum: number, month: MonthlyPaymentData) => sum + month.amount, 0);
    
    // Calculate total debt at plan start (this could be enhanced to store original debt amounts)
    const totalOriginalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
    
    // Progress = payments made / original debt amount
    return Math.min((totalPaid / totalOriginalDebt) * 100, 100);
  };

  const loadActivePlan = async () => {
    try {
      const response = await fetch('/api/debt-plans');
      if (response.ok) {
        const data = await response.json();
        setActivePlan(data.activePlan);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load plans' }));
        console.error('Error loading active plan:', errorData);
        // Don't show alert on initial load, just log the error
      }
    } catch (error) {
      console.error('Error loading active plan:', error);
      // Don't show alert on initial load failure
    } finally {
      setIsLoading(false);
    }
  };

  const generateSnowballPlan = async () => {
    if (debts.length === 0) {
      alert('No debts found. Connect credit card accounts to create a debt payoff plan.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/debt-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          strategy: 'snowball',
          debts: debts,
          extraPayment: 200 // Default extra payment
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActivePlan(data.plan);
        onRefreshData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate plan' }));
        alert(`Error: ${errorData.error || 'Failed to generate snowball plan'}`);
      }
    } catch (error) {
      console.error('Error generating snowball plan:', error);
      alert('Failed to generate snowball plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAvalanchePlan = async () => {
    if (debts.length === 0) {
      alert('No debts found. Connect credit card accounts to create a debt payoff plan.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/debt-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          strategy: 'avalanche',
          debts: debts,
          extraPayment: 200 // Default extra payment
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActivePlan(data.plan);
        onRefreshData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate plan' }));
        alert(`Error: ${errorData.error || 'Failed to generate avalanche plan'}`);
      }
    } catch (error) {
      console.error('Error generating avalanche plan:', error);
      alert('Failed to generate avalanche plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deletePlan = async () => {
    if (!activePlan || !window.confirm('Are you sure you want to delete this debt plan?')) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/debt-plans/${activePlan.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setActivePlan(null);
        onRefreshData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete plan' }));
        alert(`Error: ${errorData.error || 'Failed to delete plan'}`);
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Failed to delete plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get detected payments for display
  const detectedPayments = detectCreditCardPayments();
  const automaticProgress = calculateAutomaticProgress();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
          <Target className="w-6 h-6 mr-2 text-red-600" />
          Debt Payoff Strategies
        </h2>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</div>
            <div className="text-sm text-gray-600">Total Debt</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{debtCount}</div>
            <div className="text-sm text-gray-600">Accounts</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold" style={{ color: '#aed274' }}>
              {activePlan ? `${activePlan.estimatedMonths}mo` : '--'}
            </div>
            <div className="text-sm text-gray-600">Est. Payoff</div>
          </div>
        </div>
      </div>

      {/* Strategy Selection */}
      {!activePlan && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Strategy</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Snowball Strategy */}
            <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors cursor-pointer"
                 onClick={generateSnowballPlan}>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">🔥 Debt Snowball</h4>
                <p className="text-sm text-gray-600 mb-4">Pay smallest balances first for quick wins and motivation</p>
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                  Select Snowball
                </button>
              </div>
            </div>

            {/* Avalanche Strategy */}
            <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 transition-colors cursor-pointer"
                 onClick={generateAvalanchePlan}>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">⚡ Debt Avalanche</h4>
                <p className="text-sm text-gray-600 mb-4">Pay highest interest rates first to save money</p>
                <button className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors">
                  Select Avalanche
                </button>
              </div>
            </div>

            {/* AI Custom Strategy */}
            <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-orange-300 transition-colors cursor-pointer"
                 onClick={onOpenAIChat}>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-orange-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">🤖 AI Custom</h4>
                <p className="text-sm text-gray-600 mb-4">Get a personalized strategy based on your situation</p>
                <button className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Ask AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Plan */}
      {activePlan && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Target className="w-5 h-5 mr-2" style={{ color: '#aed274' }} />
                {activePlan.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{activePlan.description}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={deletePlan}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {activePlan.steps.map((step, index) => {
              const currentProgress = automaticProgress || activePlan.progress || 0;
              const isCompleted = index < Math.floor(currentProgress / (100 / activePlan.steps.length));
              const isCurrent = index === Math.floor(currentProgress / (100 / activePlan.steps.length));
              
              return (
                <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg ${
                  isCompleted ? 'border' : 
                  isCurrent ? 'bg-blue-50 border border-blue-200' :
                  'bg-gray-50 border border-gray-200'
                }`} style={{
                  backgroundColor: isCompleted ? '#f0f9e8' : undefined,
                  borderColor: isCompleted ? '#aed274' : undefined
                }}>
                  {isCompleted ? (
                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#aed274' }} />
                  ) : isCurrent ? (
                    <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <span className={`${
                    isCompleted ? 'text-gray-800' :
                    isCurrent ? 'text-blue-800' :
                    'text-gray-600'
                  }`}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress (Auto-Detected)</span>
              <span className="text-sm text-gray-600">{Math.round(automaticProgress || 0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${automaticProgress || 0}%`,
                  backgroundColor: '#aed274'
                }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>{formatCurrency(totalDebt * ((automaticProgress || 0) / 100))} paid</span>
              <span>Based on detected payments</span>
            </div>
          </div>

          {/* Automatic Payment Tracker */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-medium text-gray-900 mb-4 flex items-center">
              <DollarSign className="w-4 h-4 mr-2" style={{ color: '#aed274' }} />
              Detected Payments
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Automatic</span>
            </h4>
            
            {detectedPayments.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detectedPayments.map((month, index) => (
                    <div key={index} className="border rounded-lg p-3" style={{ 
                      backgroundColor: '#f0f9e8', 
                      borderColor: '#aed274' 
                    }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{month.month}</span>
                        <span className="font-semibold" style={{ color: '#aed274' }}>{formatCurrency(month.amount)}</span>
                      </div>
                      <div className="text-xs text-gray-700">
                        {month.count} payment{month.count > 1 ? 's' : ''} detected
                      </div>
                      {month.payments.slice(0, 2).map((payment, pIndex: number) => (
                        <div key={pIndex} className="text-xs text-gray-600 mt-1 truncate">
                          {payment.description} - {formatCurrency(payment.amount)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                
                <div className="text-xs text-gray-500 mt-3 p-3 bg-blue-50 rounded-lg">
                  <strong>💡 Smart Detection:</strong> Payments are automatically detected from your transaction history. 
                  This includes direct payments to credit cards and transfers categorized as "Credit Card Payment".
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No credit card payments detected yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Payments will automatically appear here when you make them
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtPayoffStrategies;