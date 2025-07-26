import React, { useState } from 'react';
import { X, CreditCard, ArrowRight } from 'lucide-react';

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  balance: number;
}

interface CreditCardPaymentModalProps {
  accounts: Account[];
  onClose: () => void;
  onPaymentCreated: () => void;
}

export default function CreditCardPaymentModal({ 
  accounts, 
  onClose, 
  onPaymentCreated 
}: CreditCardPaymentModalProps) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filter accounts for source (checking/savings) and target (credit cards)
  const sourceAccounts = accounts.filter(account => 
    ['checking', 'savings', 'depository'].includes(account.accountType.toLowerCase())
  );
  
  const creditCardAccounts = accounts.filter(account => 
    ['credit', 'credit_card'].includes(account.accountType.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fromAccountId || !toAccountId || !amount) {
      setError('Please fill in all required fields');
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      setError('Payment amount must be positive');
      return;
    }

    const fromAccount = sourceAccounts.find(acc => acc.id === fromAccountId);
    if (fromAccount && fromAccount.balance < paymentAmount) {
      setError('Insufficient funds in source account');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/transactions/credit-card-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: paymentAmount,
          date
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      onPaymentCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fromAccount = sourceAccounts.find(acc => acc.id === fromAccountId);
  const toAccount = creditCardAccounts.find(acc => acc.id === toAccountId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Make Credit Card Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* From Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pay From (Checking/Savings)
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select account...</option>
              {sourceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} - ${account.balance.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* To Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pay To (Credit Card)
            </label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select credit card...</option>
              {creditCardAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} - Balance: ${Math.abs(account.balance).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Preview */}
          {fromAccount && toAccount && amount && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Transaction Preview:</h3>
              <div className="space-y-1 text-sm text-blue-800">
                <div className="flex items-center justify-between">
                  <span>{fromAccount.accountName}</span>
                  <span className="flex items-center">
                    <span className="text-red-600">-${parseFloat(amount || '0').toFixed(2)}</span>
                  </span>
                </div>
                <div className="flex items-center justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span>{toAccount.accountName}</span>
                  <span className="text-green-600">+${parseFloat(amount || '0').toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700">
                <div>From: "Payment To: {toAccount.accountName}"</div>
                <div>To: "Payment From: {fromAccount.accountName}"</div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Make Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}