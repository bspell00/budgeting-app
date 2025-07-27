import React, { useState, useMemo } from 'react';
import { Plus, Search, Tag, ChevronRight, X, DollarSign } from 'lucide-react';

interface CategoryGroup {
  id: string;
  name: string;
  budgets: Array<{
    id: string;
    name: string;
    budgeted: number;
    spent: number;
    available: number;
  }>;
}

interface OverspentBudget {
  id: string;
  name: string;
  categoryName: string;
  overspentAmount: number;
  budgeted: number;
  spent: number;
  available: number;
}

interface AssignMoneyFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignMoney: (budgetId: string, amount: number) => void;
  categories: CategoryGroup[];
  availableAmount: number;
  position: { top: number; left: number };
  overspentBudgets?: OverspentBudget[];
  isOverspendingMode?: boolean;
}

export default function AssignMoneyFlyout({
  isOpen,
  onClose,
  onAssignMoney,
  categories,
  availableAmount,
  position,
  overspentBudgets = [],
  isOverspendingMode = false
}: AssignMoneyFlyoutProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Monthly Bills', 'Credit Card Payment']));
  const [assignAmount, setAssignAmount] = useState('');

  // Get all budget names for searching - ALWAYS run this hook
  const allBudgets = useMemo(() => {
    const budgets: Array<{ id: string; name: string; group: string; data: any }> = [];
    categories.forEach(group => {
      group.budgets.forEach(budget => {
        // In overspending mode (overbudgeted), show all budgets so user can reduce any of them
        // In normal mode, show all budgets for assignment
        budgets.push({
          id: budget.id,
          name: budget.name,
          group: group.name,
          data: budget
        });
      });
    });
    return budgets;
  }, [categories]);

  // Filter budgets based on search term - ALWAYS run this hook
  const filteredBudgets = useMemo(() => {
    if (!searchTerm.trim()) return allBudgets;
    return allBudgets.filter(budget =>
      budget.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allBudgets, searchTerm]);

  // Group filtered budgets by category group - ALWAYS run this hook
  const groupedFilteredBudgets = useMemo(() => {
    const grouped: { [key: string]: Array<{ id: string; name: string; data: any }> } = {};
    filteredBudgets.forEach(budget => {
      if (!grouped[budget.group]) {
        grouped[budget.group] = [];
      }
      grouped[budget.group].push({ id: budget.id, name: budget.name, data: budget.data });
    });
    return grouped;
  }, [filteredBudgets]);

  // Early return AFTER all hooks have been called
  if (!isOpen) return null;

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleBudgetClick = (budgetId: string) => {
    if (assignAmount) {
      const amount = parseFloat(assignAmount);
      if (isOverspendingMode) {
        // In overspending mode, we're moving money FROM this budget TO overspent budgets
        if (amount > 0) {
          // For overspending, we pass a negative amount to indicate money is being taken FROM this budget
          onAssignMoney(budgetId, -amount);
          setAssignAmount('');
          onClose();
        }
      } else {
        // Normal assign money mode
        if (amount > 0 && amount <= availableAmount) {
          onAssignMoney(budgetId, amount);
          setAssignAmount('');
          onClose();
        }
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      
      {/* Flyout */}
      <div 
        className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-xl"
        style={{
          top: position.top,
          left: position.left,
          width: '400px',
          maxHeight: '500px',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-found-divider">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <DollarSign className={`w-5 h-5 ${isOverspendingMode ? 'text-red-600' : 'text-found-primary'}`} />
              <h3 className="text-lg font-semibold text-found-text">
                {isOverspendingMode ? 'Cover Overspending' : 'Assign Money'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-found-divider rounded transition-colors"
            >
              <X className="w-4 h-4 text-found-text" />
            </button>
          </div>
          
          {/* Show information when in overspending mode */}
          {isOverspendingMode && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-2">Overbudgeted - Reduce Budget Amounts</h4>
              <p className="text-xs text-red-700 mb-2">
                You've budgeted more money than you have available. Select a budget below and enter an amount to reduce it by. This will free up money for "To Be Budgeted".
              </p>
              {overspentBudgets.length > 0 && (
                <div>
                  <div className="text-xs text-red-600 font-medium mb-1">Also overspent categories:</div>
                  <div className="space-y-1">
                    {overspentBudgets.map((budget) => (
                      <div key={budget.id} className="flex justify-between text-xs">
                        <span className="text-red-700">{budget.name}</span>
                        <span className="text-red-600 font-medium">-{formatCurrency(budget.overspentAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-found-text mb-2">
              {isOverspendingMode ? 'Amount to Move' : 'Amount to Assign'}
              {!isOverspendingMode && (
                <span className="text-xs text-gray-500 ml-2">
                  (Available: {formatCurrency(availableAmount)})
                </span>
              )}
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={assignAmount}
                onChange={(e) => setAssignAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                max={isOverspendingMode ? undefined : availableAmount}
                step="0.01"
                className="w-full pl-10 pr-4 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary focus:border-found-primary"
                autoFocus
              />
            </div>
            {assignAmount && parseFloat(assignAmount) > 0 && (
              <p className={`text-xs mt-1 ${isOverspendingMode ? 'text-red-600' : 'text-green-600'}`}>
                {isOverspendingMode 
                  ? `Click a budget below to reduce it by ${formatCurrency(parseFloat(assignAmount))}`
                  : `Click any budget below to assign ${formatCurrency(parseFloat(assignAmount))}`}
              </p>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={isOverspendingMode ? "Search budgets to reduce..." : "Search budget categories..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary focus:border-found-primary"
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {Object.entries(groupedFilteredBudgets).map(([groupName, budgets]) => {
            const isExpanded = expandedGroups.has(groupName);
            return (
              <div key={groupName} className="border-b border-found-divider last:border-b-0">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-found-divider/30 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-found-primary" />
                    <span className="font-medium text-found-text">{groupName}</span>
                    <span className="text-xs text-found-text opacity-60">({budgets.length})</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-found-text transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Budget Items */}
                {isExpanded && (
                  <div className="pb-2">
                    {budgets.map((budget) => {
                      const hasAmount = assignAmount && parseFloat(assignAmount) > 0;
                      const amount = parseFloat(assignAmount) || 0;
                      const canAssign = isOverspendingMode 
                        ? hasAmount && amount <= budget.data.budgeted // Can reduce budget by up to its current budgeted amount
                        : hasAmount && amount <= availableAmount; // Normal mode validation
                      
                      return (
                        <button
                          key={budget.id}
                          onClick={() => handleBudgetClick(budget.id)}
                          disabled={!canAssign}
                          className={`w-full px-8 py-2 text-left transition-colors flex items-center justify-between ${
                            canAssign 
                              ? 'hover:bg-found-primary/10 cursor-pointer' 
                              : 'cursor-not-allowed opacity-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-found-text">{budget.name}</span>
                            {hasAmount && canAssign && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                isOverspendingMode 
                                  ? 'bg-red-100 text-red-600' 
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                {isOverspendingMode ? '-' : '+'}{formatCurrency(amount)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-found-text opacity-60">
                            {isOverspendingMode 
                              ? `${formatCurrency(budget.data.budgeted)} budgeted`
                              : `${formatCurrency(budget.data.available)} available`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(groupedFilteredBudgets).length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Tag className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p>No budget categories found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}