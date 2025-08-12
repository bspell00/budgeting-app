import React, { useState, useMemo } from 'react';
import { Plus, Search, Tag, ChevronRight, X } from 'lucide-react';

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

interface CategorySelectionFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (categoryName: string) => void;
  onCreateCategory: (categoryName: string, groupName: string) => void;
  categories: CategoryGroup[];
  currentCategory?: string;
  position: { top: number; left: number };
}

export default function CategorySelectionFlyout({
  isOpen,
  onClose,
  onSelectCategory,
  onCreateCategory,
  categories,
  currentCategory = '',
  position
}: CategorySelectionFlyoutProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Monthly Bills', 'Credit Card Payment']));
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedGroupForNew, setSelectedGroupForNew] = useState('Monthly Bills');

  // Get all budget names for searching - ALWAYS run this hook
  const allBudgets = useMemo(() => {
    const budgets: Array<{ name: string; group: string; data: any }> = [];
    categories.forEach(group => {
      group.budgets.forEach(budget => {
        budgets.push({
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
    const grouped: { [key: string]: Array<{ name: string; data: any }> } = {};
    filteredBudgets.forEach(budget => {
      if (!grouped[budget.group]) {
        grouped[budget.group] = [];
      }
      grouped[budget.group].push({ name: budget.name, data: budget.data });
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

  const handleCreateNewCategory = () => {
    if (newCategoryName.trim() && selectedGroupForNew) {
      onCreateCategory(newCategoryName.trim(), selectedGroupForNew);
      setNewCategoryName('');
      setShowNewCategoryForm(false);
      onClose();
    }
  };

  const availableGroups = categories.map(cat => cat.name);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose}></div>
      
      {/* Blur shadow area around flyout with feathered edges */}
      <div 
        className="fixed z-45 backdrop-blur-md"
        style={{
          top: position.top - 100,
          left: position.left - 100,
          width: '600px',
          height: '700px',
          maskImage: 'radial-gradient(ellipse at center, white 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, white 40%, transparent 100%)'
        }}
      ></div>
      
      {/* Flyout */}
      <div 
        className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-2xl"
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
            <h3 className="text-lg font-semibold text-found-text">Select Category</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-found-divider rounded transition-colors"
            >
              <X className="w-4 h-4 text-found-text" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary focus:border-found-primary"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {!showNewCategoryForm ? (
            <>
              {/* Quick Access - To Be Assigned */}
              {!searchTerm && (
                <div className="border-b border-found-divider">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Quick Access
                  </div>
                  <button
                    onClick={() => onSelectCategory('To Be Assigned')}
                    className={`w-full px-4 py-3 text-left hover:bg-found-divider/30 transition-colors flex items-center space-x-3 ${
                      currentCategory === 'To Be Assigned' ? 'bg-found-primary/10 text-found-primary' : 'text-found-text'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-medium">To Be Assigned</span>
                    <span className="text-xs text-gray-500 ml-auto">Income</span>
                  </button>
                </div>
              )}
              
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
                        {budgets.map((budget) => (
                          <button
                            key={budget.name}
                            onClick={() => {
                              onSelectCategory(budget.name);
                              onClose();
                            }}
                            className={`w-full px-8 py-2 text-left hover:bg-found-primary/10 transition-colors flex items-center justify-between ${
                              budget.name === currentCategory ? 'bg-found-primary/20 border-r-4 border-found-primary' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-found-text">{budget.name}</span>
                              {budget.name === currentCategory && (
                                <div className="w-2 h-2 bg-found-primary rounded-full"></div>
                              )}
                            </div>
                            <div className="text-xs text-found-text opacity-60">
                              ${budget.data.available.toFixed(0)} left
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {Object.keys(groupedFilteredBudgets).length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Tag className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p>No categories found</p>
                  <p className="text-sm">Try a different search term</p>
                </div>
              )}
            </>
          ) : (
            /* New Category Form */
            <div className="p-4">
              <h4 className="font-medium text-found-text mb-3">Create New Category</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-found-text mb-1">Category Name</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name..."
                    className="w-full px-3 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary focus:border-found-primary"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-found-text mb-1">Category Group</label>
                  <select
                    value={selectedGroupForNew}
                    onChange={(e) => setSelectedGroupForNew(e.target.value)}
                    className="w-full px-3 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary focus:border-found-primary"
                  >
                    {availableGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowNewCategoryForm(false)}
                  className="px-3 py-2 text-sm text-found-text hover:bg-found-divider rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-3 py-2 text-sm bg-found-primary text-white rounded-md hover:bg-found-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Category
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showNewCategoryForm && (
          <div className="p-3 border-t border-found-divider bg-found-divider/30">
            <button
              onClick={() => setShowNewCategoryForm(true)}
              className="w-full flex items-center justify-center space-x-2 py-2 text-sm text-found-primary hover:bg-found-primary/10 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Category</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}