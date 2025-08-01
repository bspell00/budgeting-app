import React, { useState, useEffect } from 'react';
import { Trash2, PlusCircle, ArrowUpDown, Clock, CheckCircle, Check, X, Flag, Move, MoreHorizontal } from 'lucide-react';
import CategorySelectionFlyout from './CategorySelectionFlyout';
import AccountSelectionFlyout from './AccountSelectionFlyout';
import PayeeSelectionFlyout from './PayeeSelectionFlyout';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  cleared: boolean;
  isManual: boolean;
  approved: boolean;
  account: { id: string; accountName: string };
  budget?: { name: string; category: string };
  flagColor?: string;
}

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  balance?: number;
}

interface TransactionListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: (transaction: {
    date: string;
    description: string;
    category: string;
    amount: number;
    accountId: string;
  }) => void;
  onCreateCreditCardPaymentTransfer?: (checkingData: any, creditCardData: any) => Promise<any>;
  onUpdateTransaction?: (id: string, updates: {
    date?: string;
    description?: string;
    category?: string;
    amount?: number;
    accountId?: string;
  }) => void;
  onToggleCleared?: (id: string, cleared: boolean) => void;
  onFlagTransactions?: (transactionIds: string[], color: string) => void;
  onFlagSingleTransaction?: (transactionId: string, color: string) => void;
  onMoveTransactions?: (transactionIds: string[], targetAccountId: string) => void;
  onApproveTransactions?: (transactionIds: string[], approved: boolean) => void;
  accounts?: Account[];
  categories?: string[];
  categoryGroups?: Array<{
    id: string;
    name: string;
    budgets: Array<{
      id: string;
      name: string;
      budgeted: number;
      spent: number;
      available: number;
    }>;
  }>;
  onCreateCategory?: (categoryName: string, groupName: string) => void;
  isAccountView?: boolean; // New prop to indicate if viewing specific account
}

export default function TransactionList({ 
  transactions, 
  onDeleteTransaction, 
  onAddTransaction, 
  onCreateCreditCardPaymentTransfer,
  onUpdateTransaction,
  onToggleCleared,
  onFlagTransactions,
  onFlagSingleTransaction,
  onMoveTransactions,
  onApproveTransactions,
  accounts = [],
  categories = [],
  categoryGroups = [],
  onCreateCategory,
  isAccountView = false
}: TransactionListProps) {
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Inline transaction entry state
  const [showNewRow, setShowNewRow] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: '',
    outflow: '',
    inflow: '',
    accountId: accounts[0]?.id || ''
  });
  
  // Inline editing state
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editFilteredCategories, setEditFilteredCategories] = useState<string[]>([]);
  
  // Selection state
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Popover state
  const [showFlagPopover, setShowFlagPopover] = useState(false);
  const [showMovePopover, setShowMovePopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  
  // Individual flag popover state
  const [showIndividualFlagPopover, setShowIndividualFlagPopover] = useState(false);
  const [selectedTransactionForFlag, setSelectedTransactionForFlag] = useState<string | null>(null);
  const [individualFlagPosition, setIndividualFlagPosition] = useState({ top: 0, left: 0 });

  // Category selection flyout state
  const [showCategoryFlyout, setShowCategoryFlyout] = useState(false);
  const [selectedTransactionForCategory, setSelectedTransactionForCategory] = useState<string | null>(null);
  const [categoryFlyoutPosition, setCategoryFlyoutPosition] = useState({ top: 0, left: 0 });
  
  // New transaction category flyout state
  const [showNewTransactionCategoryFlyout, setShowNewTransactionCategoryFlyout] = useState(false);
  const [newTransactionCategoryFlyoutPosition, setNewTransactionCategoryFlyoutPosition] = useState({ top: 0, left: 0 });
  
  // New transaction account flyout state
  const [showNewTransactionAccountFlyout, setShowNewTransactionAccountFlyout] = useState(false);
  const [newTransactionAccountFlyoutPosition, setNewTransactionAccountFlyoutPosition] = useState({ top: 0, left: 0 });
  
  // Transaction menu state
  const [showTransactionMenu, setShowTransactionMenu] = useState<string | null>(null);
  const [transactionMenuPosition, setTransactionMenuPosition] = useState({ top: 0, left: 0 });
  
  // Existing transaction account flyout state
  const [showAccountFlyout, setShowAccountFlyout] = useState(false);
  const [selectedTransactionForAccount, setSelectedTransactionForAccount] = useState<string | null>(null);
  const [accountFlyoutPosition, setAccountFlyoutPosition] = useState({ top: 0, left: 0 });
  
  // Payee selection flyout state
  const [showPayeeFlyout, setShowPayeeFlyout] = useState(false);
  const [selectedTransactionForPayee, setSelectedTransactionForPayee] = useState<string | null>(null);
  const [payeeFlyoutPosition, setPayeeFlyoutPosition] = useState({ top: 0, left: 0 });
  
  // New transaction payee flyout state
  const [showNewTransactionPayeeFlyout, setShowNewTransactionPayeeFlyout] = useState(false);
  const [newTransactionPayeeFlyoutPosition, setNewTransactionPayeeFlyoutPosition] = useState({ top: 0, left: 0 });
  
  // Get unique payees from existing transactions
  const uniquePayees = React.useMemo(() => 
    Array.from(new Set(transactions.map(t => t.description).filter(Boolean))), 
    [transactions]
  );
  


  // Filter categories and payees for editing
  useEffect(() => {
    if (editingField === 'category' && editValue) {
      setEditFilteredCategories(
        categories.filter(cat => 
          cat.toLowerCase().includes(editValue.toLowerCase())
        ).slice(0, 5)
      );
    } else {
      setEditFilteredCategories([]);
    }
  }, [editValue, categories, editingField]);
  

  // Use transactions as-is (no demo flags - empty flags that can be clicked)
  const transactionsWithDemoFlags = transactions;

  const sortedTransactions = [...transactionsWithDemoFlags].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'amount':
        aValue = Math.abs(a.amount);
        bValue = Math.abs(b.amount);
        break;
      case 'category':
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        break;
      default:
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSort = (field: 'date' | 'amount' | 'category') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const handleAddTransaction = () => {
    setShowNewRow(true);
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: '',
      outflow: '',
      inflow: '',
      accountId: accounts[0]?.id || ''
    });
  };

  // Handle Enter key press for inline transaction creation
  const handleNewTransactionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const outflowAmount = newTransaction.outflow ? parseFloat(newTransaction.outflow) : 0;
      const inflowAmount = newTransaction.inflow ? parseFloat(newTransaction.inflow) : 0;
      
      // Check if all required fields are filled
      if (newTransaction.description && newTransaction.category && (outflowAmount > 0 || inflowAmount > 0)) {
        handleSaveTransaction();
      }
    }
  };

  const handleSaveTransaction = async () => {
    const outflowAmount = newTransaction.outflow ? parseFloat(newTransaction.outflow) : 0;
    const inflowAmount = newTransaction.inflow ? parseFloat(newTransaction.inflow) : 0;
    
    if (!newTransaction.description || !newTransaction.category || (outflowAmount === 0 && inflowAmount === 0)) {
      return; // Validation
    }

    // Determine final amount (outflow is negative, inflow is positive)
    const finalAmount = inflowAmount > 0 ? inflowAmount : -outflowAmount;
    
    // Check if this is a credit card payment from checking account
    const sourceAccount = accounts.find(acc => acc.id === newTransaction.accountId);
    const isCreditCardPayment = (sourceAccount?.accountType === 'checking' || sourceAccount?.accountType === 'depository') && 
                                outflowAmount > 0 && 
                                (newTransaction.category.toLowerCase().includes('credit card') ||
                                 newTransaction.category.toLowerCase().includes('payment') ||
                                 newTransaction.description.toLowerCase().includes('credit card') ||
                                 newTransaction.description.toLowerCase().includes('payment to:'));
    
    console.log('🔍 Credit card payment detection:', {
      sourceAccount: sourceAccount ? { id: sourceAccount.id, name: sourceAccount.accountName, type: sourceAccount.accountType } : 'not found',
      outflowAmount,
      inflowAmount,
      finalAmount,
      category: newTransaction.category,
      description: newTransaction.description,
      isCreditCardPayment,
      hasTransferFunction: !!onCreateCreditCardPaymentTransfer
    });
    
    try {
      // If it's a credit card payment, use the special transfer function
      console.log('🚀 Checking credit card payment flow:', { 
        isCreditCardPayment, 
        hasTransferFunction: !!onCreateCreditCardPaymentTransfer,
        shouldExecuteTransfer: isCreditCardPayment && onCreateCreditCardPaymentTransfer
      });
      
      if (isCreditCardPayment && onCreateCreditCardPaymentTransfer) {
        // Find credit card accounts
        const creditCards = accounts.filter(acc => acc.accountType === 'credit');
        console.log('💳 Found credit cards:', creditCards.map(cc => ({ id: cc.id, name: cc.accountName })));
        
        if (creditCards.length > 0) {
          // Try to match the specific credit card from the description
          let targetCreditCard = creditCards[0]; // Default to first one
          
          // Look for specific credit card name in description
          const descriptionLower = newTransaction.description.toLowerCase();
          for (const cc of creditCards) {
            if (descriptionLower.includes(cc.accountName.toLowerCase())) {
              targetCreditCard = cc;
              break;
            }
          }
          
          console.log('🎯 Target credit card:', { id: targetCreditCard.id, name: targetCreditCard.accountName });
          
          // Create both transactions optimistically at the same time
          const checkingTransactionData = {
            date: newTransaction.date,
            description: newTransaction.description,
            category: newTransaction.category,
            amount: finalAmount,
            accountId: newTransaction.accountId
          };
          
          const creditCardTransactionData = {
            date: newTransaction.date,
            description: `Payment from ${sourceAccount?.accountName}`,
            category: 'Transfer',
            amount: outflowAmount, // Positive amount for credit card (reduces debt)  
            accountId: targetCreditCard.id
          };
          
          console.log('📤 About to create credit card payment transfer:', {
            checkingData: checkingTransactionData,
            creditCardData: creditCardTransactionData
          });
          
          await onCreateCreditCardPaymentTransfer(checkingTransactionData, creditCardTransactionData);
          console.log('✅ Credit card payment transfer created successfully to:', targetCreditCard.accountName);
        } else {
          console.warn('⚠️ No credit card accounts found for transfer');
          // Fallback to regular transaction creation
          await onAddTransaction({
            date: newTransaction.date,
            description: newTransaction.description,
            category: newTransaction.category,
            amount: finalAmount,
            accountId: newTransaction.accountId
          });
        }
      } else {
        // Regular transaction creation
        console.log('📝 Creating regular transaction (not credit card payment)');
        await onAddTransaction({
          date: newTransaction.date,
          description: newTransaction.description,
          category: newTransaction.category,
          amount: finalAmount,
          accountId: newTransaction.accountId
        });
      }

      // Reset form
      setShowNewRow(false);
      setNewTransaction({
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: '',
        outflow: '',
        inflow: '',
        accountId: accounts[0]?.id || ''
      });
    } catch (error) {
      console.error('❌ Failed to create transaction:', error);
      alert('Failed to create transaction. Please try again.');
    }
  };

  const handleCancelTransaction = () => {
    setShowNewRow(false);
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: '',
      outflow: '',
      inflow: '',
      accountId: accounts[0]?.id || ''
    });
  };

  // Helper function to manually create credit card transfer for existing transactions
  const createCreditCardTransfer = async (transaction: Transaction) => {
    const sourceAccount = accounts.find(acc => acc.id === transaction.account.id);
    const isCreditCardPayment = (sourceAccount?.accountType === 'checking' || sourceAccount?.accountType === 'depository') && 
                                transaction.amount < 0 && // Negative amount means outflow from checking
                                (transaction.category.toLowerCase().includes('credit card') ||
                                 transaction.category.toLowerCase().includes('payment') ||
                                 transaction.description.toLowerCase().includes('credit card') ||
                                 transaction.description.toLowerCase().includes('payment to:'));
    
    if (!isCreditCardPayment) {
      alert('This transaction does not appear to be a credit card payment.');
      return;
    }

    // Find credit card accounts
    const creditCards = accounts.filter(acc => acc.accountType === 'credit');
    if (creditCards.length === 0) {
      alert('No credit card accounts found.');
      return;
    }

    // Try to match the specific credit card from the description
    let targetCreditCard = creditCards[0]; // Default to first one
    const descriptionLower = transaction.description.toLowerCase();
    for (const cc of creditCards) {
      if (descriptionLower.includes(cc.accountName.toLowerCase())) {
        targetCreditCard = cc;
        break;
      }
    }

    try {
      if (onCreateCreditCardPaymentTransfer) {
        // Use the optimistic transfer function for better performance
        const checkingData = {
          date: transaction.date,
          description: transaction.description,
          category: transaction.category,
          amount: transaction.amount,
          accountId: transaction.account.id
        };
        
        const creditCardData = {
          date: transaction.date,
          description: `Payment from ${sourceAccount?.accountName}`,
          category: 'Transfer',
          amount: Math.abs(transaction.amount),
          accountId: targetCreditCard.id
        };
        
        await onCreateCreditCardPaymentTransfer(checkingData, creditCardData);
      } else {
        // Fallback to regular transaction creation
        await onAddTransaction({
          date: transaction.date,
          description: `Payment from ${sourceAccount?.accountName}`,
          category: 'Transfer',
          amount: Math.abs(transaction.amount), // Positive amount for credit card (reduces debt)
          accountId: targetCreditCard.id
        });
      }
      alert(`Credit card transfer created successfully to ${targetCreditCard.accountName}!`);
    } catch (error) {
      console.error('❌ Failed to create credit card payment transfer:', error);
      alert('Failed to create credit card transfer. Please try again.');
    }
  };

  // Inline editing handlers
  const handleStartEdit = (transactionId: string, field: string, currentValue: string) => {
    setEditingTransaction(transactionId);
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setEditingField(null);
    setEditValue('');
    setEditFilteredCategories([]);
  };

  const handleSaveEdit = () => {
    if (!editingTransaction || !editingField || !onUpdateTransaction) return;

    const updates: any = {};
    
    if (editingField === 'date') {
      updates.date = editValue;
    } else if (editingField === 'description') {
      updates.description = editValue;
    } else if (editingField === 'category') {
      updates.category = editValue;
    } else if (editingField === 'amount') {
      updates.amount = parseFloat(editValue);
    }

    onUpdateTransaction(editingTransaction, updates);
    handleCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="bg-found-surface rounded-xl shadow-sm border border-found-divider">
      <div className="p-6 border-b border-found-divider">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-found-text">Transactions</h2>
            <p className="text-sm text-found-text opacity-60">{transactionsWithDemoFlags.length} total transactions</p>
          </div>
          <button
            onClick={handleAddTransaction}
            className="flex items-center space-x-2 px-4 py-2 bg-evergreen text-white rounded-full hover:bg-[#003527] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {sortedTransactions.length > 0 ? (
        <div className="bg-found-surface border-found-divider overflow-hidden">
          {/* Table Header */}
          <div className="bg-found-divider border-b border-found-divider px-2 sm:px-4 py-3 hidden sm:block">
            <div className="grid grid-cols-9 gap-2 text-sm font-medium text-found-text">
              <div className="flex justify-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    setSelectAll(e.target.checked);
                    if (e.target.checked) {
                      setSelectedTransactions(new Set(sortedTransactions.map(t => t.id)));
                    } else {
                      setSelectedTransactions(new Set());
                    }
                  }}
                  className="w-4 h-4 text-found-primary bg-found-surface border-found-divider rounded focus:ring-found-primary focus:ring-2"
                />
              </div>
              <div className="flex justify-center text-xs">Flag</div>
              <div>Date</div>
              <div>Payee</div>
              <div>Category</div>
              <div className="text-right">Outflow</div>
              <div className="text-right">Inflow</div>
              <div className="text-center">Clear</div>
              <div></div>
            </div>
          </div>
          
          {/* Transaction Rows */}
          <div className="divide-y divide-found-divider max-h-96 overflow-y-auto">
            {/* Inline Transaction Entry Row */}
            {showNewRow && (
              <div className="group px-2 sm:px-4 py-3 bg-found-surface hover:bg-found-divider/30 transition-colors border-l-4 border-evergreen">
                <div className="grid grid-cols-9 gap-2 text-sm">
                  {/* Empty checkbox column */}
                  <div></div>
                  {/* Empty flag column */}
                  <div></div>
                  {/* Date */}
                  <div>
                    <input
                      type="date"
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-2 py-1 border border-found-divider rounded text-sm focus:outline-none focus:ring-2 focus:ring-evergreen"
                    />
                  </div>
                  
                  {/* Payee */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setNewTransactionPayeeFlyoutPosition({
                          top: rect.bottom + 10,
                          left: rect.left
                        });
                        setShowNewTransactionPayeeFlyout(true);
                        // Close other flyouts
                        setShowNewTransactionCategoryFlyout(false);
                        setShowNewTransactionAccountFlyout(false);
                      }}
                      className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-left ${
                        !newTransaction.description || newTransaction.description.trim() === '' 
                          ? 'text-gray-400' 
                          : 'text-gray-700'
                      }`}
                    >
                      {newTransaction.description && newTransaction.description.trim() !== '' ? newTransaction.description : 'Payee'}
                    </button>
                  </div>
                  
                  {/* Category */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setNewTransactionCategoryFlyoutPosition({
                          top: rect.bottom + 10,
                          left: rect.left
                        });
                        setShowNewTransactionCategoryFlyout(true);
                        // Close other flyouts
                        setShowCategoryFlyout(false);
                        setShowNewTransactionAccountFlyout(false);
                      }}
                      className={`w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-left ${
                        !newTransaction.category || newTransaction.category.trim() === '' 
                          ? 'text-gray-400' 
                          : 'text-gray-700'
                      }`}
                    >
                      {newTransaction.category && newTransaction.category.trim() !== '' ? newTransaction.category : 'Category'}
                    </button>
                  </div>
                  
                  {/* Outflow Field */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newTransaction.outflow}
                      onChange={(e) => {
                        setNewTransaction(prev => ({ 
                          ...prev, 
                          outflow: e.target.value,
                          inflow: e.target.value && parseFloat(e.target.value) > 0 ? '' : prev.inflow 
                        }));
                      }}
                      onKeyDown={handleNewTransactionKeyDown}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Inflow Field */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newTransaction.inflow}
                      onChange={(e) => {
                        setNewTransaction(prev => ({ 
                          ...prev, 
                          inflow: e.target.value,
                          outflow: e.target.value && parseFloat(e.target.value) > 0 ? '' : prev.outflow
                        }));
                      }}
                      onKeyDown={handleNewTransactionKeyDown}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Clear Column */}
                  <div className="flex justify-center space-x-1">
                    <button
                      onClick={handleSaveTransaction}
                      className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelTransaction}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Empty action column */}
                  <div></div>
                </div>
              </div>
            )}
            
            {sortedTransactions.map((transaction) => (
              <div key={transaction.id} className={`group px-2 sm:px-4 py-3 hover:bg-found-divider/30 transition-colors ${
                selectedTransactions.has(transaction.id) ? 'bg-found-primary/5 border-l-4 border-found-primary' : ''
              } ${!transaction.approved ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                {/* Mobile Card Layout */}
                <div className="sm:hidden space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.id)}
                        onChange={(e) => {
                          const newSelection = new Set(selectedTransactions);
                          if (e.target.checked) {
                            newSelection.add(transaction.id);
                          } else {
                            newSelection.delete(transaction.id);
                            setSelectAll(false);
                          }
                          setSelectedTransactions(newSelection);
                          setSelectAll(newSelection.size === sortedTransactions.length);
                        }}
                        className="w-4 h-4 text-found-primary bg-found-surface border-found-divider rounded focus:ring-found-primary focus:ring-2 flex-shrink-0"
                      />
                      <span className="font-medium text-found-text truncate">{transaction.description}</span>
                    </div>
                    <span className={`font-semibold flex-shrink-0 ml-2 ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(transaction.amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{new Date(transaction.date).toLocaleDateString()}</span>
                    <span className="truncate ml-2">
                      {(transaction.budget?.category === 'Credit Card Payment' || 
                        transaction.budget?.category === 'Credit Card Payments' ||
                        (transaction.budget?.name?.includes('Payment') && transaction.budget?.name?.includes('Card')) ||
                        transaction.description?.startsWith('Payment:') || transaction.description?.startsWith('Payment To:')) ? (
                        <span className="text-gray-400 italic">
                          {(transaction.description?.startsWith('Payment:') || transaction.description?.startsWith('Payment To:')) 
                            ? `Credit Card Payments: ${transaction.description.replace(/Payment(?:\s+To)?:\s*/, '')}`
                            : `Credit Card Payments: ${transaction.account?.accountName || 'Credit Card'}`
                          }
                        </span>
                      ) : (
                        transaction.category || 'Uncategorized'
                      )}
                    </span>
                  </div>
                </div>
                
                {/* Desktop Grid Layout */}
                <div className="hidden sm:grid grid-cols-9 gap-2 text-sm">
                  {/* Selection Checkbox */}
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(transaction.id)}
                      onChange={(e) => {
                        const newSelection = new Set(selectedTransactions);
                        if (e.target.checked) {
                          newSelection.add(transaction.id);
                        } else {
                          newSelection.delete(transaction.id);
                          setSelectAll(false);
                        }
                        setSelectedTransactions(newSelection);
                        
                        // Update select all state
                        setSelectAll(newSelection.size === sortedTransactions.length);
                      }}
                      className="w-4 h-4 text-found-primary bg-found-surface border-found-divider rounded focus:ring-found-primary focus:ring-2"
                    />
                  </div>
                  
                  {/* Flag Column */}
                  <div className="flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setIndividualFlagPosition({
                          top: rect.top - 180,
                          left: rect.left + rect.width / 2 - 100
                        });
                        setSelectedTransactionForFlag(transaction.id);
                        setShowIndividualFlagPopover(true);
                        // Close bulk action popovers
                        setShowFlagPopover(false);
                        setShowMovePopover(false);
                      }}
                      className="p-1 hover:bg-found-divider rounded transition-colors"
                      title={transaction.flagColor ? `Flagged - click to change` : 'Click to flag'}
                    >
                      <Flag 
                        className="w-4 h-4" 
                        style={{ 
                          color: transaction.flagColor || '#E5E7EB',
                          fill: transaction.flagColor || 'transparent'
                        }}
                      />
                    </button>
                  </div>

                  {/* Date Field */}
                  <div className="text-gray-900">
                    {editingTransaction === transaction.id && editingField === 'date' ? (
                      <input
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveEdit}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                        onClick={() => handleStartEdit(transaction.id, 'date', transaction.date)}
                      >
                        {formatDate(transaction.date)}
                      </div>
                    )}
                  </div>
                  
                  {/* Payee/Description Field */}
                  <div className="relative">
                    <div 
                      className="font-medium text-gray-900 truncate cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPayeeFlyoutPosition({
                          top: rect.bottom + 10,
                          left: rect.left
                        });
                        setSelectedTransactionForPayee(transaction.id);
                        setShowPayeeFlyout(true);
                        // Close other flyouts
                        setShowCategoryFlyout(false);
                        setShowNewTransactionCategoryFlyout(false);
                        setShowNewTransactionAccountFlyout(false);
                        setShowNewTransactionPayeeFlyout(false);
                        setShowAccountFlyout(false);
                      }}
                    >
                      {/* Show payee or transfer description */}
                      {transaction.description}
                    </div>
                  </div>
                  
                  {/* Category Field */}
                  <div className="relative">
                    {/* Check if this is a credit card payment - if so, show the credit card payment category */}
                    {(transaction.budget?.category === 'Credit Card Payment' || 
                      transaction.budget?.category === 'Credit Card Payments' ||
                      (transaction.budget?.name?.includes('Payment') && transaction.budget?.name?.includes('Card')) ||
                      transaction.description?.startsWith('Payment:') || transaction.description?.startsWith('Payment To:')) ? (
                      <div className="px-2 py-1 text-gray-400 italic text-sm truncate">
                        {(transaction.description?.startsWith('Payment:') || transaction.description?.startsWith('Payment To:')) 
                          ? `Credit Card Payments: ${transaction.description.replace(/Payment(?:\s+To)?:\s*/, '')}`
                          : `Credit Card Payments: ${transaction.account?.accountName || 'Credit Card'}`
                        }
                      </div>
                    ) : editingTransaction === transaction.id && editingField === 'category' ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSaveEdit}
                          className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        {editFilteredCategories.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-32 overflow-y-auto">
                            {editFilteredCategories.map((category, index) => (
                              <div
                                key={index}
                                onClick={() => {
                                  setEditValue(category);
                                  handleSaveEdit();
                                }}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                              >
                                {category}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div 
                        className={`truncate cursor-pointer hover:bg-gray-100 px-2 py-1 rounded ${
                          !transaction.category || transaction.category.trim() === '' 
                            ? 'text-gray-400 italic' 
                            : 'text-gray-700'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setCategoryFlyoutPosition({
                            top: rect.bottom + 10,
                            left: rect.left
                          });
                          setSelectedTransactionForCategory(transaction.id);
                          setShowCategoryFlyout(true);
                          // Close other popovers
                          setShowFlagPopover(false);
                          setShowMovePopover(false);
                          setShowIndividualFlagPopover(false);
                          setShowAccountFlyout(false);
                          setShowNewTransactionCategoryFlyout(false);
                          setShowNewTransactionAccountFlyout(false);
                        }}
                      >
                        {transaction.category && transaction.category.trim() !== '' ? transaction.category : 'Uncategorized'}
                      </div>
                    )}
                  </div>
                  
                  
                  {/* Amount Fields - Outflow */}
                  <div className="text-right">
                    {editingTransaction === transaction.id && editingField === 'amount' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveEdit}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                        onClick={() => handleStartEdit(transaction.id, 'amount', transaction.amount.toString())}
                      >
                        {transaction.amount < 0 ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(Math.abs(transaction.amount))}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Amount Fields - Inflow */}
                  <div className="text-right">
                    {editingTransaction === transaction.id && editingField === 'amount' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSaveEdit}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                        onClick={() => handleStartEdit(transaction.id, 'amount', transaction.amount.toString())}
                      >
                        {transaction.amount > 0 ? (
                          <span className="font-medium text-green-600">
                            {formatCurrency(transaction.amount)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {onToggleCleared ? (
                      <button
                        onClick={() => onToggleCleared(transaction.id, !transaction.cleared)}
                        className="flex items-center justify-center w-6 h-6 hover:bg-gray-100 rounded transition-colors"
                        title={transaction.cleared ? "Mark as Uncleared" : "Mark as Cleared"}
                      >
                        {transaction.cleared ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-orange-500" />
                        )}
                      </button>
                    ) : (
                      transaction.isManual && (
                        <div className="flex items-center justify-center">
                          {transaction.cleared ? (
                            <div title="Cleared">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </div>
                          ) : (
                            <div title="Uncleared">
                              <Clock className="w-4 h-4 text-orange-500" />
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  
                  {/* Menu Button (replaces individual delete) */}
                  <div className="flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTransactionMenuPosition({
                          top: rect.bottom + 5,
                          left: rect.left - 100
                        });
                        setShowTransactionMenu(transaction.id);
                        // Close other menus
                        setShowFlagPopover(false);
                        setShowMovePopover(false);
                        setShowIndividualFlagPopover(false);
                      }}
                      className="p-1 text-gray-400 hover:text-found-text hover:bg-found-divider rounded transition-all duration-150"
                      title="More options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">
          <p>No transactions yet</p>
          <button
            onClick={handleAddTransaction}
            className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Add your first transaction
          </button>
        </div>
      )}
      
      {/* Floating Action Bar */}
      {selectedTransactions.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-found-surface border border-found-divider rounded-lg shadow-xl px-6 py-4 flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-found-text">
                {selectedTransactions.size} selected
              </span>
            </div>
            
            <div className="w-px h-6 bg-found-divider"></div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPopoverPosition({
                    top: rect.top - 200, // Position above the button
                    left: rect.left + rect.width / 2 - 100 // Center horizontally
                  });
                  setShowFlagPopover(true);
                  setShowMovePopover(false);
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-found-text hover:bg-found-divider rounded-md transition-colors"
                title="Flag transactions"
              >
                <Flag className="w-4 h-4" />
                <span>Flag</span>
              </button>
              
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPopoverPosition({
                    top: rect.top - 200, // Position above the button
                    left: rect.left + rect.width / 2 - 100 // Center horizontally
                  });
                  setShowMovePopover(true);
                  setShowFlagPopover(false);
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-found-text hover:bg-found-divider rounded-md transition-colors"
                title="Move to different account"
              >
                <Move className="w-4 h-4" />
                <span>Move</span>
              </button>
              
              {/* Show approve/unapprove based on selected transactions */}
              {(() => {
                const selectedTransactionsList = Array.from(selectedTransactions);
                const hasUnapproved = selectedTransactionsList.some(id => {
                  const transaction = sortedTransactions.find(t => t.id === id);
                  return transaction && !transaction.approved;
                });
                const hasApproved = selectedTransactionsList.some(id => {
                  const transaction = sortedTransactions.find(t => t.id === id);
                  return transaction && transaction.approved;
                });
                
                return (
                  <>
                    {hasUnapproved && (
                      <button
                        onClick={() => {
                          if (onApproveTransactions) {
                            onApproveTransactions(Array.from(selectedTransactions), true);
                          }
                          setSelectedTransactions(new Set());
                          setSelectAll(false);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md transition-colors"
                        title="Approve transactions"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                    )}
                    {hasApproved && (
                      <button
                        onClick={() => {
                          if (onApproveTransactions) {
                            onApproveTransactions(Array.from(selectedTransactions), false);
                          }
                          setSelectedTransactions(new Set());
                          setSelectAll(false);
                        }}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                        title="Mark as unapproved"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Unapprove</span>
                      </button>
                    )}
                  </>
                );
              })()}
              
              <button
                onClick={() => {
                  const transactionIds = Array.from(selectedTransactions);
                  if (confirm(`Are you sure you want to delete ${transactionIds.length} transaction(s)?`)) {
                    // Delete each selected transaction
                    transactionIds.forEach(id => onDeleteTransaction(id));
                    setSelectedTransactions(new Set());
                    setSelectAll(false);
                  }
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Delete selected transactions"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
            
            <div className="w-px h-6 bg-found-divider"></div>
            
            <button
              onClick={() => {
                setSelectedTransactions(new Set());
                setSelectAll(false);
              }}
              className="p-2 text-gray-400 hover:text-found-text rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Flag Color Popover */}
      {showFlagPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowFlagPopover(false)}></div>
          <div 
            className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-xl p-4"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
              minWidth: '200px'
            }}
          >
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-found-text mb-2">Choose Flag Color</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'Red', color: '#EF4444', bg: 'bg-red-500' },
                  { name: 'Orange', color: '#F97316', bg: 'bg-orange-500' },
                  { name: 'Yellow', color: '#EAB308', bg: 'bg-yellow-500' },
                  { name: 'Green', color: '#22C55E', bg: 'bg-green-500' },
                  { name: 'Blue', color: '#3B82F6', bg: 'bg-blue-500' },
                  { name: 'Purple', color: '#8B5CF6', bg: 'bg-purple-500' },
                  { name: 'Pink', color: '#EC4899', bg: 'bg-pink-500' },
                  { name: 'Gray', color: '#6B7280', bg: 'bg-gray-500' }
                ].map((flagColor) => (
                  <button
                    key={flagColor.name}
                    onClick={() => {
                      if (onFlagTransactions) {
                        onFlagTransactions(Array.from(selectedTransactions), flagColor.color);
                      }
                      setShowFlagPopover(false);
                      setSelectedTransactions(new Set());
                      setSelectAll(false);
                    }}
                    className={`w-8 h-8 rounded-full ${flagColor.bg} hover:scale-110 transition-transform border-2 border-white shadow-sm`}
                    title={`Flag as ${flagColor.name}`}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-found-divider pt-2">
              <button
                onClick={() => {
                  if (onFlagTransactions) {
                    onFlagTransactions(Array.from(selectedTransactions), '');
                  }
                  setShowFlagPopover(false);
                  setSelectedTransactions(new Set());
                  setSelectAll(false);
                }}
                className="text-xs text-gray-500 hover:text-found-text transition-colors"
              >
                Remove flags
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Move Account Popover */}
      {showMovePopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMovePopover(false)}></div>
          <div 
            className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-xl p-4"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
              minWidth: '250px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}
          >
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-found-text mb-2">Move to Account</h3>
              <div className="space-y-1">
                {accounts.filter(account => {
                  // Filter out accounts that selected transactions are already in
                  const selectedTransactionsList = Array.from(selectedTransactions);
                  const transactionAccountIds = selectedTransactionsList.map(id => {
                    const transaction = sortedTransactions.find(t => t.id === id);
                    return transaction?.account?.accountName;
                  });
                  // Only show accounts that aren't already the source of selected transactions
                  return !transactionAccountIds.includes(account.accountName);
                }).map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      if (onMoveTransactions) {
                        onMoveTransactions(Array.from(selectedTransactions), account.id);
                      }
                      setShowMovePopover(false);
                      setSelectedTransactions(new Set());
                      setSelectAll(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-found-divider transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-found-text text-sm">{account.accountName}</div>
                      <div className="text-xs text-found-text opacity-60">{account.accountType}</div>
                    </div>
                    <div className="w-2 h-2 bg-found-accent rounded-full"></div>
                  </button>
                ))}
              </div>
              {accounts.filter(account => {
                // Same filter logic
                const selectedTransactionsList = Array.from(selectedTransactions);
                const transactionAccountIds = selectedTransactionsList.map(id => {
                  const transaction = sortedTransactions.find(t => t.id === id);
                  return transaction?.account?.accountName;
                });
                return !transactionAccountIds.includes(account.accountName);
              }).length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  {accounts.length === 0 ? 'No other accounts available' : 'No different accounts to move to'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Individual Transaction Flag Color Popover */}
      {showIndividualFlagPopover && selectedTransactionForFlag && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => {
            setShowIndividualFlagPopover(false);
            setSelectedTransactionForFlag(null);
          }}></div>
          <div 
            className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-xl p-4"
            style={{
              top: individualFlagPosition.top,
              left: individualFlagPosition.left,
              minWidth: '200px'
            }}
          >
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-found-text mb-2">Choose Flag Color</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'Red', color: '#EF4444', bg: 'bg-red-500' },
                  { name: 'Orange', color: '#F97316', bg: 'bg-orange-500' },
                  { name: 'Yellow', color: '#EAB308', bg: 'bg-yellow-500' },
                  { name: 'Green', color: '#22C55E', bg: 'bg-green-500' },
                  { name: 'Blue', color: '#3B82F6', bg: 'bg-blue-500' },
                  { name: 'Purple', color: '#8B5CF6', bg: 'bg-purple-500' },
                  { name: 'Pink', color: '#EC4899', bg: 'bg-pink-500' },
                  { name: 'Gray', color: '#6B7280', bg: 'bg-gray-500' }
                ].map((flagColor) => (
                  <button
                    key={flagColor.name}
                    onClick={() => {
                      if (onFlagSingleTransaction && selectedTransactionForFlag) {
                        onFlagSingleTransaction(selectedTransactionForFlag, flagColor.color);
                      }
                      setShowIndividualFlagPopover(false);
                      setSelectedTransactionForFlag(null);
                    }}
                    className={`w-8 h-8 rounded-full ${flagColor.bg} hover:scale-110 transition-transform border-2 border-white shadow-sm`}
                    title={`Flag as ${flagColor.name}`}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-found-divider pt-2">
              <button
                onClick={() => {
                  if (onFlagSingleTransaction && selectedTransactionForFlag) {
                    onFlagSingleTransaction(selectedTransactionForFlag, '');
                  }
                  setShowIndividualFlagPopover(false);
                  setSelectedTransactionForFlag(null);
                }}
                className="text-xs text-gray-500 hover:text-found-text transition-colors"
              >
                Remove flag
              </button>
            </div>
          </div>
        </>
      )}

      {/* Category Selection Flyout */}
      <CategorySelectionFlyout
        isOpen={showCategoryFlyout}
        onClose={() => {
          setShowCategoryFlyout(false);
          setSelectedTransactionForCategory(null);
        }}
        onSelectCategory={(categoryName) => {
          if (selectedTransactionForCategory && onUpdateTransaction) {
            onUpdateTransaction(selectedTransactionForCategory, { category: categoryName });
          }
        }}
        onCreateCategory={(categoryName, groupName) => {
          if (onCreateCategory) {
            onCreateCategory(categoryName, groupName);
          }
          // After creating, update the transaction
          if (selectedTransactionForCategory && onUpdateTransaction) {
            onUpdateTransaction(selectedTransactionForCategory, { category: categoryName });
          }
        }}
        categories={categoryGroups}
        currentCategory={selectedTransactionForCategory ? 
          transactions.find(t => t.id === selectedTransactionForCategory)?.category || 'Uncategorized' : 
          undefined
        }
        position={categoryFlyoutPosition}
      />
      
      {/* New Transaction Category Selection Flyout */}
      <CategorySelectionFlyout
        isOpen={showNewTransactionCategoryFlyout}
        onClose={() => {
          setShowNewTransactionCategoryFlyout(false);
        }}
        onSelectCategory={(categoryName) => {
          setNewTransaction(prev => ({ ...prev, category: categoryName }));
          setShowNewTransactionCategoryFlyout(false);
        }}
        onCreateCategory={(categoryName, groupName) => {
          if (onCreateCategory) {
            onCreateCategory(categoryName, groupName);
          }
          // After creating, set the category for the new transaction
          setNewTransaction(prev => ({ ...prev, category: categoryName }));
          setShowNewTransactionCategoryFlyout(false);
        }}
        categories={categoryGroups}
        currentCategory={newTransaction.category || 'Uncategorized'}
        position={newTransactionCategoryFlyoutPosition}
      />
      
      {/* New Transaction Account Selection Flyout */}
      <AccountSelectionFlyout
        isOpen={showNewTransactionAccountFlyout}
        onClose={() => {
          setShowNewTransactionAccountFlyout(false);
        }}
        onSelectAccount={(accountId) => {
          setNewTransaction(prev => ({ ...prev, accountId }));
          setShowNewTransactionAccountFlyout(false);
        }}
        accounts={accounts}
        currentAccountId={newTransaction.accountId}
        position={newTransactionAccountFlyoutPosition}
      />
      
      {/* Existing Transaction Account Selection Flyout */}
      <AccountSelectionFlyout
        isOpen={showAccountFlyout}
        onClose={() => {
          setShowAccountFlyout(false);
          setSelectedTransactionForAccount(null);
        }}
        onSelectAccount={(accountId) => {
          if (selectedTransactionForAccount && onUpdateTransaction) {
            onUpdateTransaction(selectedTransactionForAccount, { accountId });
          }
          setShowAccountFlyout(false);
          setSelectedTransactionForAccount(null);
        }}
        accounts={accounts}
        currentAccountId={selectedTransactionForAccount ? 
          transactions.find(t => t.id === selectedTransactionForAccount)?.account?.id : 
          undefined
        }
        position={accountFlyoutPosition}
      />
      
      {/* Payee Selection Flyout - for existing transactions */}
      <PayeeSelectionFlyout
        isOpen={showPayeeFlyout}
        onClose={() => {
          setShowPayeeFlyout(false);
          setSelectedTransactionForPayee(null);
        }}
        onSelectPayee={(payeeName) => {
          if (selectedTransactionForPayee && onUpdateTransaction) {
            const updates: { description: string; category?: string } = { description: payeeName };
            
            // If it's a credit card payment, automatically set the category
            if (payeeName.startsWith('Payment:') || payeeName.startsWith('Payment To:')) {
              const creditCardName = payeeName.replace(/Payment(?:\s+To)?:\s*/, '');
              updates.category = `Credit Card Payments: ${creditCardName}`;
            }
            
            onUpdateTransaction(selectedTransactionForPayee, updates);
          }
          setShowPayeeFlyout(false);
          setSelectedTransactionForPayee(null);
        }}
        existingPayees={uniquePayees}
        accounts={accounts}
        currentPayee={selectedTransactionForPayee ? 
          transactions.find(t => t.id === selectedTransactionForPayee)?.description : 
          undefined
        }
        position={payeeFlyoutPosition}
        currentAccountId={selectedTransactionForPayee ? 
          transactions.find(t => t.id === selectedTransactionForPayee)?.account?.id : 
          undefined
        }
      />
      
      {/* New Transaction Payee Selection Flyout */}
      <PayeeSelectionFlyout
        isOpen={showNewTransactionPayeeFlyout}
        onClose={() => {
          setShowNewTransactionPayeeFlyout(false);
        }}
        onSelectPayee={(payeeName) => {
          setNewTransaction(prev => {
            const updates = { ...prev, description: payeeName };
            
            // If it's a credit card payment, automatically set the category
            if (payeeName.startsWith('Payment:') || payeeName.startsWith('Payment To:')) {
              const creditCardName = payeeName.replace(/Payment(?:\s+To)?:\s*/, '');
              updates.category = `Credit Card Payments: ${creditCardName}`;
            }
            
            return updates;
          });
          setShowNewTransactionPayeeFlyout(false);
        }}
        existingPayees={uniquePayees}
        accounts={accounts}
        currentPayee={newTransaction.description}
        position={newTransactionPayeeFlyoutPosition}
        currentAccountId={newTransaction.accountId}
      />

      {/* Transaction Menu */}
      {showTransactionMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowTransactionMenu(null)}
          ></div>
          
          {/* Menu */}
          <div 
            className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-xl py-2 min-w-[200px]"
            style={{
              top: transactionMenuPosition.top,
              left: transactionMenuPosition.left
            }}
          >
            {(() => {
              const transaction = transactions.find(t => t.id === showTransactionMenu);
              if (!transaction) return null;
              
              const sourceAccount = accounts.find(acc => acc.id === transaction.account.id);
              const isCreditCardPayment = (sourceAccount?.accountType === 'checking' || sourceAccount?.accountType === 'depository') && 
                                          transaction.amount < 0 && 
                                          (transaction.category.toLowerCase().includes('credit card') ||
                                           transaction.category.toLowerCase().includes('payment') ||
                                           transaction.description.toLowerCase().includes('credit card') ||
                                           transaction.description.toLowerCase().includes('payment to:'));
              
              return (
                <>
                  {isCreditCardPayment && (
                    <button
                      onClick={() => {
                        createCreditCardTransfer(transaction);
                        setShowTransactionMenu(null);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-found-text hover:bg-found-divider transition-colors flex items-center space-x-2"
                    >
                      <span>💳</span>
                      <span>Create Credit Card Transfer</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      onDeleteTransaction(transaction.id);
                      setShowTransactionMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Transaction</span>
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}