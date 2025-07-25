import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import BudgetItem from './BudgetItem';

interface CategoryGroupProps {
  groupName: string;
  categories: any[];
  formatCurrency: (amount: number) => string;
  getStatusColor: (status: string) => string;
  onEditBudget: (id: string, updates: { name?: string; amount?: number; category?: string }) => void;
  onDeleteBudget: (id: string) => void;
  onInitiateMoveMoney: (budget: any) => void;
  showProgressBars: boolean;
}

export default function CategoryGroup({
  groupName,
  categories,
  formatCurrency,
  getStatusColor,
  onEditBudget,
  onDeleteBudget,
  onInitiateMoveMoney,
  showProgressBars,
}: CategoryGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${groupName}`,
    data: {
      type: 'category',
      groupName,
    },
  });

  // Calculate group totals
  const groupBudgeted = categories.reduce((sum, cat) => sum + cat.budgeted, 0);
  const groupSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const groupAvailable = groupBudgeted - groupSpent;

  return (
    <div 
      ref={setNodeRef}
      className={`mb-4 border border-gray-200 rounded-lg transition-colors ${
        isOver 
          ? 'bg-blue-50 border-blue-400' 
          : ''
      }`}
    >
      {/* Group Header */}
      <div className="bg-blue-50 px-4 py-3 rounded-t-lg border-b border-blue-200">
        <div className="flex items-center">
          <div className="w-6"></div> {/* Space for drag handle */}
          <div className="flex-1">
            <h3 className="text-md font-semibold text-gray-900">{groupName}</h3>
          </div>
          <div className="w-20 sm:w-24 lg:w-32 text-right">
            <span className="font-semibold text-gray-900">{formatCurrency(groupBudgeted)}</span>
          </div>
          <div className="w-20 sm:w-24 lg:w-32 text-right hidden sm:block">
            <span className="font-semibold text-gray-900">{formatCurrency(groupSpent)}</span>
          </div>
          <div className="w-20 sm:w-24 lg:w-32 text-right">
            <span className={`font-semibold ${groupAvailable < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(groupAvailable)}
            </span>
          </div>
          <div className="w-8 sm:w-12"></div> {/* Space for action buttons */}
        </div>
        
        {/* Group Progress Bar */}
        {showProgressBars && (
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full ${
                groupAvailable < 0 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min(100, groupBudgeted > 0 ? (groupSpent / groupBudgeted) * 100 : 0)}%`
              }}
            ></div>
          </div>
        )}
      </div>
      
      {/* Budget Items */}
      <div className="min-h-[50px]">
        <SortableContext items={categories.map(cat => cat.id)} strategy={verticalListSortingStrategy}>
          {categories.map((category) => (
            <BudgetItem
              key={category.id}
              budget={category}
              onEdit={onEditBudget}
              onDelete={onDeleteBudget}
              onInitiateMoveMoney={onInitiateMoveMoney}
              formatCurrency={formatCurrency}
              getStatusColor={getStatusColor}
              showProgressBars={showProgressBars}
            />
          ))}
        </SortableContext>
        
        {/* Empty State */}
        {categories.length === 0 && (
          <div className="flex items-center justify-center h-16 text-gray-400 text-sm border-2 border-dashed border-gray-300 mx-6 my-2 rounded-lg">
            <div className="text-center">
              <p>Drop budget items here or create a new budget in this category</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}