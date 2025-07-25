import React, { useState, useEffect } from 'react';
import { X, ArrowRight, DollarSign } from 'lucide-react';

interface MoveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (targetBudgetId: string, amount: number) => void;
  sourceBudget: {
    id: string;
    name: string;
    available: number;
  };
  availableBudgets: Array<{
    id: string;
    name: string;
    category: string;
    available: number;
  }>;
}

export default function MoveMoneyModal({
  isOpen,
  onClose,
  onMove,
  sourceBudget,
  availableBudgets,
}: MoveMoneyModalProps) {
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [amount, setAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedBudgetId('');
      setAmount('');
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredBudgets = availableBudgets
    .filter(budget => 
      budget.id !== sourceBudget.id && 
      (budget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       budget.category.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const handleMove = () => {
    const moveAmount = parseFloat(amount);
    if (selectedBudgetId && moveAmount > 0 && moveAmount <= sourceBudget.available) {
      onMove(selectedBudgetId, moveAmount);
      onClose();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Move Money</h3>
              <p className="text-sm text-gray-600">
                From: {sourceBudget.name} ({formatCurrency(sourceBudget.available)} available)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount to Move
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">$</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="0.00"
                step="0.01"
                min="0.01"
                max={sourceBudget.available}
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(sourceBudget.available)}
            </p>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Move to Budget
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Search budgets..."
            />
          </div>

          {/* Budget List */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {filteredBudgets.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredBudgets.map((budget) => (
                  <div
                    key={budget.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedBudgetId === budget.id
                        ? 'bg-green-50 border-l-4 border-green-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedBudgetId(budget.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{budget.name}</p>
                        <p className="text-sm text-gray-600">{budget.category}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          budget.available < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(budget.available)}
                        </p>
                        <p className="text-xs text-gray-500">available</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <p>No budgets found</p>
                <p className="text-sm mt-1">Try adjusting your search</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          {selectedBudgetId && amount && (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 flex items-center space-x-2">
                <span>{sourceBudget.name}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{filteredBudgets.find(b => b.id === selectedBudgetId)?.name}</span>
              </div>
              <button
                onClick={handleMove}
                disabled={!selectedBudgetId || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > sourceBudget.available}
                className="px-6 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Move {amount && `$${amount}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}