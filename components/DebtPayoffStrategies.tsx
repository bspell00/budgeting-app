import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
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
import { useAlert } from './ModalAlert';

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

const fetcher = (url: string) => fetch(url).then(res => res.json());

const DebtPayoffStrategies: React.FC<DebtPayoffStrategiesProps> = ({
  debts,
  accounts,
  transactions,
  onOpenAIChat,
  onRefreshData
}) => {
  const { showAlert, showSuccess, showError, showWarning } = useAlert();
  const [isLoading, setIsLoading] = useState(false);
  
  // Use SWR for reactive debt plan loading
  const { data: debtPlansData, error: debtPlansError, mutate: mutateDebtPlans } = useSWR('/api/debt-plans', fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: true
  });
  
  const activePlan = debtPlansData?.activePlan || null;
  const isLoadingDebtPlans = !debtPlansData && !debtPlansError;

  // Calculate total debt and monthly minimums
  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimums = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const debtCount = debts.length;

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


  const generateSnowballPlan = async () => {
    if (debts.length === 0) {
      showWarning('No debts found. Connect credit card accounts to create a debt payoff plan.');
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
        await mutateDebtPlans(); // Refresh debt plans data
        onRefreshData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate plan' }));
        showError(`Error: ${errorData.error || 'Failed to generate snowball plan'}`);
      }
    } catch (error) {
      console.error('Error generating snowball plan:', error);
      showError('Failed to generate snowball plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAvalanchePlan = async () => {
    if (debts.length === 0) {
      showWarning('No debts found. Connect credit card accounts to create a debt payoff plan.');
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
        await mutateDebtPlans(); // Refresh debt plans data
        onRefreshData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate plan' }));
        showError(`Error: ${errorData.error || 'Failed to generate avalanche plan'}`);
      }
    } catch (error) {
      console.error('Error generating avalanche plan:', error);
      showError('Failed to generate avalanche plan. Please try again.');
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
        await mutateDebtPlans(); // Refresh debt plans data
        onRefreshData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete plan' }));
        showError(`Error: ${errorData.error || 'Failed to delete plan'}`);
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      showError('Failed to delete plan. Please try again.');
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

  if (isLoading || isLoadingDebtPlans) {
    return (
      <div className="p-6 bg-found-surface rounded-xl shadow-sm border border-found-divider">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-found-divider rounded w-1/3"></div>
          <div className="h-32 bg-found-divider rounded"></div>
          <div className="h-48 bg-found-divider rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats with Action Items */}
      <div className="bg-found-surface rounded-xl p-6 shadow-sm border border-found-divider">
        <h2 className="text-2xl font-bold text-found-text mb-6 flex items-center">
          <Target className="w-6 h-6 mr-2 text-evergreen" />
          Debt Payoff Command Center
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Debt Stats */}
          <div className="space-y-4">
            <div className="bg-found-surface rounded-lg p-4 shadow-sm">
              <div className="text-3xl font-bold text-red-600">-{formatCurrency(totalDebt)}</div>
              <div className="text-sm text-found-text opacity-60">Total Debt</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-found-surface rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-teal-midnight">{debtCount}</div>
                <div className="text-sm text-found-text opacity-60">Accounts</div>
              </div>
              <div className="bg-found-surface rounded-lg p-4 shadow-sm">
                <div className="text-2xl font-bold text-last-lettuce">
                  {activePlan ? `${activePlan.estimatedMonths}mo` : '--'}
                </div>
                <div className="text-sm text-found-text opacity-60">Est. Payoff</div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Progress */}
          <div className="bg-found-surface rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-semibold text-found-text">Your Progress</h4>
              <span className="text-3xl font-bold text-last-lettuce">{Math.round(automaticProgress || 0)}%</span>
            </div>
            
            <div className="w-full bg-found-divider rounded-full h-4 mb-4">
              <div 
                className="h-4 rounded-full transition-all duration-300 bg-last-lettuce"
                style={{ 
                  width: `${automaticProgress || 0}%`
                }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-found-text opacity-60">
              <span>{formatCurrency(totalDebt * ((automaticProgress || 0) / 100))} paid down</span>
              <span>
                {detectedPayments.length >= 3 ? '🔥 Excellent consistency' : 
                 detectedPayments.length >= 1 ? '👍 Good progress' : '📈 Just getting started'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Bar */}
        {totalDebt > 0 && (
          <div className="bg-found-surface rounded-lg p-4 border-l-4 border-evergreen">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-found-text">💡 Next Steps</h3>
                <p className="text-sm text-found-text opacity-60 mt-1">
                  {activePlan 
                    ? `You're on track! Continue following your ${activePlan.strategy} strategy.`
                    : "Choose a debt payoff strategy below to get started with your debt-free journey."
                  }
                </p>
              </div>
              {!activePlan && (
                <button 
                  onClick={() => {
                    const snowballCard = document.querySelector('[data-strategy="snowball"]');
                    snowballCard?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-evergreen text-white px-4 py-2 rounded-full hover:bg-evergreen/90 transition-colors text-sm font-medium"
                >
                  Get Started
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Strategy Selection */}
      {!activePlan && (
        <div className="bg-found-surface rounded-xl p-6 shadow-sm border border-found-divider">
          <h3 className="text-lg font-semibold text-found-text mb-4">Choose Your Strategy</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Snowball Strategy */}
            <div data-strategy="snowball" className="border-2 border-found-divider rounded-xl p-6 hover:border-evergreen transition-colors cursor-pointer hover:shadow-lg"
                 onClick={generateSnowballPlan}>
              <div className="text-center">
                <div className="w-12 h-12 bg-evergreen/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-evergreen" />
                </div>
                <h4 className="font-semibold text-found-text mb-2">🔥 Debt Snowball</h4>
                <p className="text-sm text-found-text opacity-60 mb-3">Pay smallest balances first for quick wins and motivation</p>
                <div className="text-xs text-evergreen bg-evergreen/10 rounded-lg p-2 mb-4">
                  <strong>Best for:</strong> Building momentum & staying motivated
                </div>
                <button className="w-full bg-evergreen text-white py-2 px-4 rounded-full hover:bg-evergreen/90 transition-colors">
                  Select Snowball
                </button>
              </div>
            </div>

            {/* Avalanche Strategy */}
            <div data-strategy="avalanche" className="border-2 border-found-divider rounded-xl p-6 hover:border-teal-midnight transition-colors cursor-pointer hover:shadow-lg"
                 onClick={generateAvalanchePlan}>
              <div className="text-center">
                <div className="w-12 h-12 bg-teal-midnight/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-teal-midnight" />
                </div>
                <h4 className="font-semibold text-found-text mb-2">⚡ Debt Avalanche</h4>
                <p className="text-sm text-found-text opacity-60 mb-3">Pay highest interest rates first to save money</p>
                <div className="text-xs text-teal-midnight bg-teal-midnight/10 rounded-lg p-2 mb-4">
                  <strong>Best for:</strong> Saving money on interest payments
                </div>
                <button className="w-full bg-teal-midnight text-white py-2 px-4 rounded-full hover:bg-teal-midnight/90 transition-colors">
                  Select Avalanche
                </button>
              </div>
            </div>

            {/* Ask Finley Strategy */}
            <div data-strategy="ai-custom" className="border-2 border-found-divider rounded-xl p-6 hover:border-last-lettuce transition-colors cursor-pointer hover:shadow-lg"
                 onClick={onOpenAIChat}>
              <div className="text-center">
                <div className="w-12 h-12 bg-found-divider/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-found-text" />
                </div>
                <h4 className="font-semibold text-found-text mb-2">🤖 Ask Finley</h4>
                <p className="text-sm text-found-text opacity-60 mb-3">Get a personalized strategy based on your situation</p>
                <div className="text-xs text-last-lettuce bg-last-lettuce/10 rounded-lg p-2 mb-4">
                  <strong>Best for:</strong> Complex situations & personalized advice
                </div>
                <button 
                  className="w-full bg-last-lettuce text-white py-2 px-4 rounded-full hover:bg-last-lettuce/90 transition-colors flex items-center justify-center font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAIChat();
                  }}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Chat with Finley
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Plan */}
      {activePlan && (
        <div className="bg-found-surface rounded-xl p-6 shadow-sm border border-found-divider">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-found-text flex items-center">
                <Target className="w-5 h-5 mr-2 text-last-lettuce" />
                {activePlan.title}
              </h3>
              <p className="text-sm text-found-text opacity-60 mt-1">{activePlan.description}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 text-found-text opacity-40 hover:text-evergreen hover:opacity-100 transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={deletePlan}
                className="p-2 text-found-text opacity-40 hover:text-evergreen hover:opacity-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>


          {/* Monthly Action Plan */}
          <div className="bg-dipped-cream rounded-lg p-6 mb-6 border border-evergreen/30">
            <h4 className="text-xl font-semibold text-found-text mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-evergreen" />
              This Month's Plan
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-evergreen">{formatCurrency(totalMinimums)}</div>
                <div className="text-sm text-found-text opacity-60">Minimum Payments</div>
              </div>
              
              {debts.length > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-last-lettuce">{debts[0].accountName}</div>
                  <div className="text-sm text-found-text opacity-60">Focus Account</div>
                </div>
              )}
              
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-midnight">
                  {detectedPayments.length > 0 
                    ? formatCurrency(detectedPayments.reduce((sum, month) => sum + month.amount, 0) / detectedPayments.length)
                    : '--'
                  }
                </div>
                <div className="text-sm text-found-text opacity-60">Avg. Payment</div>
              </div>
            </div>
            
            <button 
              className="w-full bg-last-lettuce text-white py-3 px-4 rounded-full hover:bg-last-lettuce/90 transition-colors flex items-center justify-center font-medium"
              onClick={() => onOpenAIChat()}
            >
              <Brain className="w-4 h-4 mr-2" />
              Ask Finley for Strategy Help
            </button>
          </div>



          {/* Payoff Plan Steps */}
          <div className="bg-found-surface rounded-lg p-6 border border-found-divider">
            <h4 className="text-xl font-semibold text-found-text mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-last-lettuce" />
              Your Payoff Plan
            </h4>
            
            <div className="space-y-3">
              {activePlan.steps.map((step: string, index: number) => {
                const currentProgress = automaticProgress || activePlan.progress || 0;
                const isCompleted = index < Math.floor(currentProgress / (100 / activePlan.steps.length));
                const isCurrent = index === Math.floor(currentProgress / (100 / activePlan.steps.length));
                
                return (
                  <div key={index} className={`flex items-center space-x-3 p-4 rounded-lg ${
                    isCompleted ? 'bg-last-lettuce/10 border border-last-lettuce' : 
                    isCurrent ? 'bg-evergreen/10 border border-evergreen' :
                    'bg-found-divider/30 border border-found-divider'
                  }`}>
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-last-lettuce" />
                      ) : isCurrent ? (
                        <ArrowRight className="w-6 h-6 text-evergreen" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-found-text opacity-30 flex items-center justify-center">
                          <span className="text-xs font-bold text-found-text opacity-30">{index + 1}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${
                        isCompleted ? 'text-found-text' :
                        isCurrent ? 'text-found-text' :
                        'text-found-text opacity-60'
                      }`}>
                        {step}
                      </span>
                      {isCurrent && (
                        <div className="text-xs text-evergreen mt-1 font-medium">
                          ← You are here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default DebtPayoffStrategies;