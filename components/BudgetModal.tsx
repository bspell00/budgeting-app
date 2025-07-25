import React, { useState } from 'react';
import { X } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (budgetData: {
    name: string;
    amount: number;
    category: string;
  }) => void;
}

const BUDGET_CATEGORIES = [
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
  
  // Other
  'Other'
];

export default function BudgetModal({ isOpen, onClose, onSubmit }: BudgetModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        name,
        amount: parseFloat(amount),
        category,
      });
      
      // Reset form
      setName('');
      setAmount('');
      setCategory('');
      onClose();
    } catch (error) {
      console.error('Error creating budget:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-found-surface rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-found-text">Create Budget Category</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-found-text"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-found-text mb-1">
              Budget Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Groceries"
              className="w-full px-3 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary bg-found-surface text-found-text"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-found-text mb-1">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary bg-found-surface text-found-text"
              required
            >
              <option value="">Select a category</option>
              {BUDGET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-found-text mb-1">
              Monthly Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-found-text opacity-60">$</span>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary bg-found-surface text-found-text"
                required
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-found-text bg-found-divider rounded-md hover:bg-found-divider/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-found-primary text-white rounded-md hover:bg-found-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}