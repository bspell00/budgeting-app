import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Search } from 'lucide-react';

interface MoveMoneyPopoverProps {
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
  position: { top: number; left: number };
}

export default function MoveMoneyPopover({
  isOpen,
  onClose,
  onMove,
  sourceBudget,
  availableBudgets,
  position,
}: MoveMoneyPopoverProps) {
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [amount, setAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedBudgetId('');
      setAmount('');
      setSearchTerm('');
      // Focus the amount input when opening
      setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedBudgetId && amount) {
      handleMove();
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
    <div 
      ref={popoverRef}
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl w-80"
      style={{
        top: Math.min(position.top, window.innerHeight - 400),
        left: Math.min(position.left, window.innerWidth - 320),
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Move Money</h3>
          <p className="text-xs text-gray-600">
            From: {sourceBudget.name} ({formatCurrency(sourceBudget.available)})
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Amount Input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Amount to Move
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">$</span>
            </div>
            <input
              ref={amountInputRef}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              max={sourceBudget.available}
            />
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Move to Budget
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <Search className="w-3 h-3 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Search budgets..."
            />
          </div>
        </div>

        {/* Budget List */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded">
          {filteredBudgets.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredBudgets.slice(0, 8).map((budget) => (
                <div
                  key={budget.id}
                  className={`p-2 cursor-pointer transition-colors text-sm ${
                    selectedBudgetId === budget.id
                      ? 'bg-green-50 border-l-2 border-green-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedBudgetId(budget.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-xs">{budget.name}</p>
                      <p className="text-xs text-gray-500 truncate">{budget.category}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`text-xs font-medium ${
                        budget.available < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(budget.available)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No budgets found</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        
        {selectedBudgetId && amount && (
          <button
            onClick={handleMove}
            disabled={!selectedBudgetId || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > sourceBudget.available}
            className="px-4 py-1 text-sm bg-[#86b686] text-white rounded hover:bg-[#73a373] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Move ${amount}
          </button>
        )}
      </div>
    </div>
  );
}