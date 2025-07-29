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
  Plus
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

interface DebtPayoffStrategiesProps {
  debts: Debt[];
  onOpenAIChat: () => void;
  onRefreshData: () => void;
}

const DebtPayoffStrategies: React.FC<DebtPayoffStrategiesProps> = ({
  debts,
  onOpenAIChat,
  onRefreshData
}) => {
  const [activePlan, setActivePlan] = useState<DebtPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Calculate total debt and monthly minimums
  const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalMinimums = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const debtCount = debts.length;

  useEffect(() => {
    loadActivePlan();
  }, []);

  const loadActivePlan = async () => {
    try {
      const response = await fetch('/api/debt-plans');
      if (response.ok) {
        const data = await response.json();
        setActivePlan(data.activePlan);
      }
    } catch (error) {
      console.error('Error loading active plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSnowballPlan = async () => {
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

  const recordPayment = async () => {
    if (!activePlan || !paymentAmount) return;
    
    setIsRecordingPayment(true);
    try {
      const response = await fetch('/api/debt-plans/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: activePlan.id,
          amount: parseFloat(paymentAmount),
          date: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActivePlan(data.updatedPlan);
        setPaymentAmount('');
        onRefreshData();
        alert(`Payment of $${paymentAmount} recorded successfully!`);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to record payment' }));
        alert(`Error: ${errorData.error || 'Failed to record payment'}`);
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setIsRecordingPayment(false);
    }
  };

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
            <div className="text-2xl font-bold text-green-600">
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
                <Target className="w-5 h-5 mr-2 text-green-600" />
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
              const isCompleted = index < Math.floor(activePlan.progress / (100 / activePlan.steps.length));
              const isCurrent = index === Math.floor(activePlan.progress / (100 / activePlan.steps.length));
              
              return (
                <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg ${
                  isCompleted ? 'bg-green-50 border border-green-200' :
                  isCurrent ? 'bg-blue-50 border border-blue-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : isCurrent ? (
                    <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <span className={`${
                    isCompleted ? 'text-green-800' :
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
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{Math.round(activePlan.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${activePlan.progress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>{formatCurrency(activePlan.totalDebt * (activePlan.progress / 100))} paid</span>
              <span>Est. completion: {formatDate(new Date(Date.now() + activePlan.estimatedMonths * 30 * 24 * 60 * 60 * 1000).toISOString())}</span>
            </div>
          </div>

          {/* Payment Tracker */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-medium text-gray-900 mb-4 flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-green-600" />
              Payment Tracker
            </h4>
            
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Record This Month's Payment
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={recordPayment}
                disabled={!paymentAmount || isRecordingPayment}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Plus className="w-4 h-4 mr-1" />
                Record
              </button>
            </div>

            {/* Recent Payments */}
            {activePlan.payments && activePlan.payments.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">Recent Payments</h5>
                <div className="flex flex-wrap gap-2">
                  {activePlan.payments.slice(0, 6).map((payment, index) => (
                    <div key={index} className="bg-green-50 border border-green-200 rounded-lg px-3 py-1 text-xs">
                      <span className="font-medium text-green-800">{payment.month}</span>
                      <span className="text-green-600 ml-1">{formatCurrency(payment.amount)} ✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtPayoffStrategies;