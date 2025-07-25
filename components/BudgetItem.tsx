import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit, Trash2, Check, X, GripVertical } from 'lucide-react';

interface BudgetItemProps {
  budget: {
    id: string;
    name: string;
    budgeted: number;
    spent: number;
    available: number;
    status: string;
    category: string;
  };
  onEdit: (id: string, updates: { name?: string; amount?: number; category?: string }) => void;
  onDelete: (id: string) => void;
  onInitiateMoveMoney?: (budget: any, event?: MouseEvent) => void;
  formatCurrency: (amount: number) => string;
  getStatusColor: (status: string) => string;
  isDragging?: boolean;
  showProgressBars?: boolean;
}

export default function BudgetItem({ 
  budget, 
  onEdit, 
  onDelete, 
  onInitiateMoveMoney,
  formatCurrency, 
  getStatusColor,
  isDragging = false,
  showProgressBars = true
}: BudgetItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editName, setEditName] = useState(budget.name);
  const [editAmount, setEditAmount] = useState(budget.budgeted.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: budget.id,
    data: {
      type: 'budget',
      budget,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingAmount && amountRef.current) {
      amountRef.current.focus();
      amountRef.current.select();
    }
  }, [isEditingAmount]);

  const handleSave = () => {
    if (editName.trim() && editAmount !== '') {
      onEdit(budget.id, {
        name: editName.trim(),
        amount: parseFloat(editAmount),
      });
      setIsEditing(false);
    }
  };

  const handleSaveAmount = () => {
    if (editAmount !== '' && !isNaN(parseFloat(editAmount))) {
      onEdit(budget.id, {
        amount: parseFloat(editAmount),
      });
      setIsEditingAmount(false);
    }
  };


  const handleCancel = () => {
    setEditName(budget.name);
    setEditAmount(budget.budgeted.toString());
    setIsEditing(false);
  };

  const handleCancelAmount = () => {
    setEditAmount(budget.budgeted.toString());
    setIsEditingAmount(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveAmount();
    } else if (e.key === 'Escape') {
      handleCancelAmount();
    }
  };


  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center px-2 sm:px-4 py-2 border-b border-found-divider last:border-b-0 hover:bg-found-divider transition-colors group ${
        isDragging ? 'opacity-50 bg-found-surface shadow-lg rounded-lg' : ''
      }`}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-found-text opacity-0 group-hover:opacity-100 transition-opacity mr-2 hidden sm:block"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Budget Name Column */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 font-medium text-found-text bg-found-surface border border-found-primary rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-found-primary"
              placeholder="Budget name"
            />
            <button
              onClick={handleSave}
              className="p-1 text-found-accent hover:text-found-primary transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-red-600 hover:text-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span 
              className="text-sm font-medium text-found-text cursor-pointer hover:text-found-primary transition-colors truncate"
              onDoubleClick={handleDoubleClick}
            >
              {budget.name}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(budget.status)}`}>
              {budget.status === 'overspent' ? 'Over' : 
               budget.status === 'goal' ? 'Goal' : 'OK'}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        {showProgressBars && (
          <div className="mt-1 w-full bg-found-divider rounded-full h-1">
            <div 
              className={`h-1 rounded-full ${
                budget.available < 0 ? 'bg-red-500' : 'bg-found-accent'
              }`}
              style={{
                width: `${Math.min(100, (budget.spent / budget.budgeted) * 100)}%`
              }}
            ></div>
          </div>
        )}
      </div>

      {/* Budgeted Column */}
      <div className="w-20 sm:w-24 lg:w-32 text-right">
        {isEditingAmount ? (
          <input
            ref={amountRef}
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={handleAmountKeyDown}
            onBlur={handleSaveAmount}
            className="w-full bg-found-surface border border-found-primary rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-found-primary text-right"
            placeholder="Amount"
            step="0.01"
            min="0"
          />
        ) : (
          <span 
            className="text-sm font-medium text-found-text cursor-pointer hover:text-found-primary transition-colors px-1 py-1 rounded hover:bg-found-divider"
            onClick={() => {
              setEditAmount(budget.budgeted.toString());
              setIsEditingAmount(true);
            }}
            title="Click to edit budget amount"
          >
            {formatCurrency(budget.budgeted)}
          </span>
        )}
      </div>

      {/* Spent Column */}
      <div className="w-20 sm:w-24 lg:w-32 text-right hidden sm:block">
        <span className="text-sm font-medium text-found-text">{formatCurrency(budget.spent)}</span>
      </div>

      {/* Available Column */}
      <div className="w-20 sm:w-24 lg:w-32 text-right">
        <span 
          className={`text-sm font-medium transition-colors px-1 py-1 rounded ${
            budget.available > 0 && onInitiateMoveMoney
              ? 'text-green-600 hover:text-green-700 hover:bg-found-divider cursor-pointer' 
              : budget.available > 0
              ? 'text-green-600'
              : budget.available < 0
              ? 'text-red-600'
              : 'text-found-text'
          }`}
          onClick={(e) => {
            if (budget.available > 0 && onInitiateMoveMoney) {
              onInitiateMoveMoney(budget, e.nativeEvent);
            }
          }}
          title={budget.available > 0 && onInitiateMoveMoney ? "Click to move money to another budget" : undefined}
        >
          {formatCurrency(budget.available)}
        </span>
      </div>

      {/* Action Buttons */}
      {!isEditing && !isEditingAmount && (
        <div className="flex items-center space-x-1 opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1 sm:ml-3">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-found-primary transition-colors"
            title="Edit budget name"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(budget.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete budget"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}