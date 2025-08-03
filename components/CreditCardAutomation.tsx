import React, { useState, useEffect } from 'react';
import { ArrowRight, CreditCard, DollarSign, Zap, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAlert } from './ModalAlert';

interface BudgetTransfer {
  id: string;
  amount: number;
  reason: string;
  automated: boolean;
  createdAt: string;
  fromBudget: {
    name: string;
    category: string;
  };
  toBudget: {
    name: string;
    category: string;
  };
  transaction?: {
    description: string;
    amount: number;
    account: {
      accountName: string;
    };
  };
}

interface CreditCardAutomationProps {
  transactionId?: string;
}

export default function CreditCardAutomation({ transactionId }: CreditCardAutomationProps) {
  const { showSuccess, showError } = useAlert();
  const [transfers, setTransfers] = useState<BudgetTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggerLoading, setTriggerLoading] = useState(false);

  useEffect(() => {
    fetchTransfers();
  }, [transactionId]);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const url = transactionId 
        ? `/api/budget/credit-card-automation?transactionId=${transactionId}`
        : '/api/budget/credit-card-automation';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setTransfers(data.transfers || []);
      }
    } catch (error) {
      console.error('Error fetching automation transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerAutomation = async () => {
    if (!transactionId) return;
    
    setTriggerLoading(true);
    try {
      const response = await fetch('/api/budget/credit-card-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          forceTransfer: true,
          allowOverspend: false
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        showSuccess(`Automation successful: ${result.message}`);
        fetchTransfers(); // Refresh transfers list
      } else {
        showError(`Automation failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error triggering automation:', error);
      showError('Failed to trigger automation');
    } finally {
      setTriggerLoading(false);
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (transactionId) {
    // Transaction-specific view
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Zap className="w-5 h-5 text-purple-600 mr-2" />
            Credit Card Automation
          </h3>
          <button
            onClick={triggerAutomation}
            disabled={triggerLoading}
            className="flex items-center space-x-2 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
          >
            {triggerLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>{triggerLoading ? 'Processing...' : 'Trigger Now'}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading automation history...</span>
          </div>
        ) : transfers.length > 0 ? (
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(transfer.amount)}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <div className="text-sm">
                    <span className="text-gray-600">from</span>
                    <span className="font-medium text-gray-900 mx-1">{transfer.fromBudget.name}</span>
                    <span className="text-gray-600">to</span>
                    <span className="font-medium text-gray-900 mx-1">{transfer.toBudget.name}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(transfer.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm">No automation transfers for this transaction</p>
            <p className="text-xs mt-1">Click "Trigger Now" to process credit card automation</p>
          </div>
        )}
      </div>
    );
  }

  // Dashboard view - show recent automation activity
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <CreditCard className="w-5 h-5 text-purple-600 mr-2" />
            Credit Card Automation
          </h2>
          <button
            onClick={fetchTransfers}
            disabled={loading}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          YNAB-style automatic budget transfers for credit card purchases
        </p>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading automation history...</span>
          </div>
        ) : transfers.length > 0 ? (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {transfer.automated ? (
                    <Zap className="w-5 h-5 text-purple-600" />
                  ) : (
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(transfer.amount)}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {transfer.fromBudget.name} → {transfer.toBudget.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(transfer.createdAt)}</span>
                    </div>
                  </div>
                  
                  {transfer.transaction && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">{transfer.transaction.description}</span>
                      <span className="mx-2">•</span>
                      <span>{transfer.transaction.account.accountName}</span>
                      <span className="mx-2">•</span>
                      <span className="font-medium">{formatCurrency(Math.abs(transfer.transaction.amount))}</span>
                    </div>
                  )}
                  
                  <div className="mt-1 text-xs text-gray-500">
                    {transfer.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Automation Activity</h3>
            <p className="text-sm">
              Credit card automation will appear here when you make purchases with connected credit cards.
            </p>
            <p className="text-xs mt-2 text-gray-400">
              Money is automatically moved from spending budgets to credit card payment budgets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}