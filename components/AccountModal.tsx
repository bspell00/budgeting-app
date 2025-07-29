import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (accountData: {
    accountName: string;
    accountType: string;
    accountSubtype: string;
    balance: number;
    availableBalance?: number;
  }) => void;
}

export default function AccountModal({ isOpen, onClose, onSubmit }: AccountModalProps) {
  const [formData, setFormData] = useState({
    accountName: '',
    accountType: 'depository',
    accountSubtype: 'checking',
    balance: '',
    availableBalance: ''
  });

  const accountTypes = [
    { value: 'depository', label: 'Bank Account' },
    { value: 'credit', label: 'Credit Card' },
    { value: 'loan', label: 'Loan' },
    { value: 'investment', label: 'Investment' },
    { value: 'other', label: 'Other' }
  ];

  const accountSubtypes = {
    depository: [
      { value: 'checking', label: 'Checking' },
      { value: 'savings', label: 'Savings' },
      { value: 'money_market', label: 'Money Market' },
      { value: 'cd', label: 'Certificate of Deposit' }
    ],
    credit: [
      { value: 'credit_card', label: 'Credit Card' },
      { value: 'line_of_credit', label: 'Line of Credit' }
    ],
    loan: [
      { value: 'auto', label: 'Auto Loan' },
      { value: 'mortgage', label: 'Mortgage' },
      { value: 'personal', label: 'Personal Loan' },
      { value: 'student', label: 'Student Loan' }
    ],
    investment: [
      { value: '401k', label: '401(k)' },
      { value: 'ira', label: 'IRA' },
      { value: 'brokerage', label: 'Brokerage' }
    ],
    other: [
      { value: 'other', label: 'Other' }
    ]
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const balance = parseFloat(formData.balance) || 0;
    const availableBalance = formData.availableBalance ? parseFloat(formData.availableBalance) : undefined;
    
    onSubmit({
      accountName: formData.accountName,
      accountType: formData.accountType,
      accountSubtype: formData.accountSubtype,
      balance: balance,
      availableBalance: availableBalance
    });
    
    // Reset form
    setFormData({
      accountName: '',
      accountType: 'depository',
      accountSubtype: 'checking',
      balance: '',
      availableBalance: ''
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset subtype when type changes
      ...(field === 'accountType' && { accountSubtype: accountSubtypes[value as keyof typeof accountSubtypes][0].value })
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add Manual Account</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Name *
            </label>
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => handleInputChange('accountName', e.target.value)}
              placeholder="e.g., Wells Fargo Checking"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type *
            </label>
            <select
              value={formData.accountType}
              onChange={(e) => handleInputChange('accountType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accountTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Subtype *
            </label>
            <select
              value={formData.accountSubtype}
              onChange={(e) => handleInputChange('accountSubtype', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accountSubtypes[formData.accountType as keyof typeof accountSubtypes].map(subtype => (
                <option key={subtype.value} value={subtype.value}>
                  {subtype.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Balance *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.balance}
              onChange={(e) => handleInputChange('balance', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              For credit cards, enter the negative balance (e.g., -500.00 for $500 owed)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Available Balance
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.availableBalance}
              onChange={(e) => handleInputChange('availableBalance', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional: Available balance (for checking accounts with pending transactions)
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#aed274] text-white rounded-md hover:bg-[#9bc267]"
            >
              Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}