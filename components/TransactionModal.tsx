import React, { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transactionData: {
    amount: number;
    description: string;
    category: string;
    date: string;
    accountId?: string;
  }) => void;
  budgetCategories: string[];
  accounts?: Array<{
    id: string;
    accountName: string;
    accountType: string;
  }>;
  selectedAccountId?: string;
}

const COMMON_CATEGORIES = [
  // Credit Card Payments (Group)
  'Credit Card Payments',
  'Chase Sapphire Rewards',
  'Adrienne\'s Barclay Arrival',
  'Brandon\'s Barclay Arrival',
  'Amazon Store Card',
  'Navy Federal Rewards Card',
  'Delta Platinum Rewards',
  'Adrienne Capital One Venture',
  'GAP Reward Card',
  'American Express Gold Card',
  'CareCredit',
  'Venture X',
  'Home Depot CC',
  
  // Auto Loans (Group)
  'Auto Loans',
  '2021 Ram 1500',
  '2023 Hyundai Palisade',
  
  // Monthly Bills (Group)
  'Monthly Bills',
  'Gabb Wireless',
  'Interest Charges',
  'HELOC Payments',
  'Aidvantage (Student Loan)',
  'Car Insurance',
  'Cellphone',
  'Electric',
  'Gas',
  'HOA Fees',
  'Internet',
  'Mortgage',
  'Subscriptions',
  'TV',
  'Trash',
  'Water',
  
  // Frequent Spending (Group)
  'Frequent Spending',
  'Eating Out',
  'Groceries',
  'HELOC',
  'Investments',
  'Tithing',
  'Transportation',
  
  // Non-Monthly (Group)
  'Non-Monthly',
  'Taxes',
  'Emergency Fund',
  'Auto Maintenance',
  'Clothing',
  'Gifts',
  'Hair',
  'Home Improvement',
  'Medical',
  'Misc. Needs',
  'Pet Maintenance',
  'Stuff I Forgot to Budget For',
  
  // Sully & Remi (Group)
  'Sully & Remi',
  'Teacher Gifts',
  'Misc School',
  'Birthdays',
  'Childcare',
  'Clothing',
  'Lunch Money',
  'Extracurricular',
  
  // Income & Other
  'Income',
  'Other'
];

const QUICK_TRANSACTIONS = [
  { name: 'Coffee', amount: -4.50, category: 'Eating Out' },
  { name: 'Lunch', amount: -12.00, category: 'Eating Out' },
  { name: 'Gas', amount: -45.00, category: 'Transportation' },
  { name: 'Groceries', amount: -85.00, category: 'Groceries' },
  { name: 'Tithing', amount: -500.00, category: 'Tithing' },
  { name: 'Credit Card Payment', amount: -150.00, category: 'Credit Card Payments' },
  { name: 'Interest Charge', amount: -25.00, category: 'Interest Charges' },
  { name: 'Salary', amount: 3000.00, category: 'Income' },
];

export default function TransactionModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  budgetCategories, 
  accounts = [], 
  selectedAccountId 
}: TransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExpense, setIsExpense] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountId, setAccountId] = useState(selectedAccountId || '');

  // Update accountId when selectedAccountId changes
  useEffect(() => {
    setAccountId(selectedAccountId || '');
  }, [selectedAccountId]);

  const allCategories = Array.from(new Set([...budgetCategories, ...COMMON_CATEGORIES]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const finalAmount = isExpense ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));
      
      await onSubmit({
        amount: finalAmount,
        description,
        category,
        date,
        accountId: accountId || undefined,
      });
      
      // Reset form
      setAmount('');
      setDescription('');
      setCategory('');
      setDate(new Date().toISOString().split('T')[0]);
      setIsExpense(true);
      onClose();
    } catch (error) {
      console.error('Error creating transaction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickTransaction = (quickTx: any) => {
    setDescription(quickTx.name);
    setAmount(Math.abs(quickTx.amount).toString());
    setCategory(quickTx.category);
    setIsExpense(quickTx.amount < 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Add Transaction</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Quick Transaction Buttons */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Add</h3>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TRANSACTIONS.map((tx, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleQuickTransaction(tx)}
                className={`p-2 text-sm rounded-md border transition-colors ${
                  tx.amount < 0 
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' 
                    : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{tx.name}</span>
                  <span className="font-medium">${Math.abs(tx.amount)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type
            </label>
            <div className="flex rounded-md bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setIsExpense(true)}
                className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isExpense 
                    ? 'bg-red-500 text-white' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Minus className="w-4 h-4 mr-1" />
                Expense
              </button>
              <button
                type="button"
                onClick={() => setIsExpense(false)}
                className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isExpense 
                    ? 'text-white' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                style={!isExpense ? { backgroundColor: '#aed274' } : {}}
              >
                <Plus className="w-4 h-4 mr-1" />
                Income
              </button>
            </div>
          </div>

          {/* Account Selection */}
          {accounts.length > 0 && (
            <div>
              <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Manual Entry Account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName} ({account.accountType})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {accountId 
                  ? `Transaction will be added to ${accounts.find(a => a.id === accountId)?.accountName}` 
                  : 'Transaction will be added to your Manual Entry account'
                }
              </p>
            </div>
          )}

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Starbucks, Gas station, Salary"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a category</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 ${
                isExpense 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-[#86b686] hover:bg-[#73a373]'
              }`}
            >
              {isSubmitting ? 'Adding...' : `Add ${isExpense ? 'Expense' : 'Income'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}