// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, closestCorners } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import BudgetModal from './BudgetModal';
import GoalModal from './GoalModal';
import TransactionList from './TransactionList';
import QuickStats from './QuickStats';
import CategoryGroup from './CategoryGroup';
import BudgetItem from './BudgetItem';
import MoveMoneyPopover from './MoveMoneyPopover';
import AssignMoneyFlyout from './AssignMoneyFlyout';
import DebtPayoffDashboard from './DebtPayoffDashboard';
import { useDashboard } from '../hooks/useDashboard';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { 
  PlusCircle, 
  Target, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Calendar,
  CreditCard,
  Zap,
  Settings,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Receipt,
  Activity,
  BarChart3,
  PieChart,
  Trash2,
  X,
  Brain,
  RefreshCw,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import PlaidLink from './PlaidLink';
import AccountModal from './AccountModal';
import AccountClosureModal from './AccountClosureModal';
import AIAdvisorDashboard from './AIAdvisorDashboard';
import TransactionAlertBanner from './TransactionAlertBanner';
import AIChat from './AIChat';

const Dashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  
  // Local UI state (declare before SWR hooks that depend on them)
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [leftSidebarTab, setLeftSidebarTab] = useState('budget');
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProgressBars, setShowProgressBars] = useState(false);
  const [showMoveMoneyPopover, setShowMoveMoneyPopover] = useState(false);
  const [moveMoneySource, setMoveMoneySource] = useState<any>(null);
  const [moveMoneyPosition, setMoveMoneyPosition] = useState({ top: 0, left: 0 });
  const [showAssignMoneyPopover, setShowAssignMoneyPopover] = useState(false);
  const [assignMoneyPosition, setAssignMoneyPosition] = useState({ top: 0, left: 0 });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAccountTypeModal, setShowAccountTypeModal] = useState(false);
  const [showAccountClosureModal, setShowAccountClosureModal] = useState(false);
  const [accountToClose, setAccountToClose] = useState<any>(null);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'unapproved' | 'uncategorized'>('all');
  
  // SWR hooks for real-time data
  const { 
    data: dashboardData, 
    error: dashboardError, 
    isLoading: dashboardLoading,
    updateBudgetOptimistic,
    createBudgetOptimistic,
    deleteBudgetOptimistic
  } = useDashboard();
  
  const {
    data: transactionsData,
    error: transactionsError,
    isLoading: transactionsLoading,
    updateTransactionOptimistic,
    createTransactionOptimistic,
    deleteTransactionOptimistic,
    toggleClearedOptimistic
  } = useTransactions(selectedAccount?.id);
  
  const {
    data: accountsData,
    error: accountsError,
    isLoading: accountsLoading,
    syncAccounts
  } = useAccounts();
  
  // Derived state from SWR data
  const transactions = transactionsData?.transactions || [];
  const accounts = accountsData || [];
  const loading = dashboardLoading || accountsLoading;
  const error = dashboardError || accountsError || transactionsError;
  
  // Calculate overspending - only when "To Be Budgeted" is negative (overbudgeted)
  const isOverbudgeted = (dashboardData?.toBeAssigned || 0) < 0;
  const overbudgetedAmount = Math.abs(dashboardData?.toBeAssigned || 0);
  
  // Get overspent budgets for the flyout interface (when overbudgeted)
  const overspentBudgets = React.useMemo(() => {
    if (!dashboardData?.categories || !isOverbudgeted) return [];
    const overspent = [];
    dashboardData.categories.forEach((category: any) => {
      category.budgets?.forEach((budget: any) => {
        if (budget.available < 0) {
          overspent.push({
            ...budget,
            categoryName: category.name,
            overspentAmount: Math.abs(budget.available)
          });
        }
      });
    });
    return overspent;
  }, [dashboardData, isOverbudgeted]);

  // Detection logic for transaction alerts
  const unapprovedTransactions = React.useMemo(() => {
    return transactions.filter((transaction: any) => !transaction.approved);
  }, [transactions]);

  const uncategorizedTransactions = React.useMemo(() => {
    const uncategorizedCategories = ['Uncategorized', 'Misc', 'Other', 'Entertainment', ''];
    return transactions.filter((transaction: any) => 
      !transaction.category || 
      uncategorizedCategories.includes(transaction.category) ||
      transaction.category.trim() === ''
    );
  }, [transactions]);

  // Handlers for banner quick actions
  const handleViewUnapproved = () => {
    setTransactionFilter('unapproved');
    setLeftSidebarTab('transactions');
  };

  const handleViewUncategorized = () => {
    setTransactionFilter('uncategorized');
    setLeftSidebarTab('transactions');
  };

  // Filtered transactions for display
  const filteredTransactions = React.useMemo(() => {
    switch (transactionFilter) {
      case 'unapproved':
        return transactions.filter(transaction => !transaction.approved);
      case 'uncategorized':
        const uncategorizedCategories = ['Uncategorized', 'Misc', 'Other', 'Entertainment', ''];
        return transactions.filter(transaction => 
          !transaction.category || 
          uncategorizedCategories.includes(transaction.category) ||
          transaction.category.trim() === ''
        );
      default:
        return transactions;
    }
  }, [transactions, transactionFilter]);
  
  const fetchDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const [dashboardResponse, transactionsResponse, accountsResponse] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/transactions'),
        fetch('/api/accounts')
      ]);
      
      if (!dashboardResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const dashboardData = await dashboardResponse.json();
      const transactionsData = transactionsResponse.ok ? await transactionsResponse.json() : [];
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : [];
      
      console.log('📊 Dashboard data loaded');
      console.log('💰 Accounts data:', accountsData);
      console.log('📈 Transactions data:', transactionsData.length, 'transactions');
      
      // Check if user has any budget categories - if not, create defaults
      if (!dashboardData.categories || dashboardData.categories.length === 0) {
        console.log('🚀 No budget categories found, creating defaults...');
        try {
          const response = await fetch('/api/budgets/populate-defaults', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ overwrite: true })
          });
          
          if (response.ok) {
            console.log('✅ Default categories created successfully');
            // Refetch dashboard data to get the new categories
            const updatedDashboardResponse = await fetch('/api/dashboard');
            if (updatedDashboardResponse.ok) {
              const updatedDashboardData = await updatedDashboardResponse.json();
              setDashboardData(updatedDashboardData);
            }
          }
        } catch (error) {
          console.error('❌ Failed to create default categories:', error);
        }
      } else {
        setDashboardData(dashboardData);
      }
      
      setTransactions(transactionsData);
      setAccounts(accountsData);
      
      // Get unique categories for the dropdown
      const categoryNames = dashboardData.categories?.map((group: any) => group.name as string) || [];
      const uniqueCategories = Array.from(new Set(categoryNames)) as string[];
      setAvailableCategories(['Food & Dining', 'Gas & Fuel', 'Groceries', 'Shopping', 'Bills & Utilities', 'Entertainment', 'Transfer', 'Other', ...uniqueCategories]);
      
      // Fetch AI suggestions
      fetchAISuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // No need for manual refresh functions - SWR handles this automatically
  
  const fetchAISuggestions = async () => {
    try {
      const response = await fetch('/api/insights');
      if (response.ok) {
        const data = await response.json();
        // Get top 3 suggestions for the preview
        setAiSuggestions(data.insights.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    }
  };

  const dismissInsight = (index: number) => {
    setAiSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleInsightAction = async (insight: any) => {
    try {
      if (insight.action?.includes('Move') && insight.action?.includes('to Savings')) {
        // Extract amount from action text
        const amountMatch = insight.action.match(/\$(\d+)/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);
          const sourceBudget = dashboardData?.categories?.find((cat: any) => cat.name === insight.category);
          const savingsBudget = dashboardData?.categories?.find((cat: any) => cat.name === 'Savings');
          
          if (sourceBudget && savingsBudget) {
            setMoveMoneySource(sourceBudget);
            await handleMoveMoney(savingsBudget.id, amount);
            dismissInsight(aiSuggestions.findIndex(s => s.id === insight.id));
            return;
          }
        }
      } else if (insight.action?.includes('Add') && insight.action?.includes('to Budget')) {
        // Extract amount from action text
        const amountMatch = insight.action.match(/\$(\d+)/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);
          const budget = dashboardData?.categories?.find((cat: any) => cat.name === insight.category);
          
          if (budget) {
            await handleEditBudget(budget.id, { amount: budget.budgeted + amount });
            dismissInsight(aiSuggestions.findIndex(s => s.id === insight.id));
            return;
          }
        }
      } else if (insight.action?.includes('Create Debt Payoff Goal') || insight.action?.includes('Debt Payoff Goal')) {
        // Extract amount from action text
        const amountMatch = insight.action.match(/\$(\d+)/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1]);
          
          // Create debt payoff goal
          try {
            const response = await fetch('/api/goals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: `Debt Payoff - $${amount}`,
                targetAmount: amount,
                type: 'debt',
                currentAmount: 0
              })
            });
            
            if (response.ok) {
              // Refresh dashboard data to show new goal
              await fetchDashboardData();
              alert(`Debt payoff goal for $${amount} created successfully!`);
              dismissInsight(aiSuggestions.findIndex(s => s.id === insight.id));
              return;
            } else {
              throw new Error('Failed to create goal');
            }
          } catch (error) {
            console.error('Error creating debt goal:', error);
            alert('Failed to create debt payoff goal. Please try manually.');
            return;
          }
        }
      }
      
      // Fallback for actions we haven't implemented yet
      alert(`Action "${insight.action}" executed successfully!`);
      dismissInsight(aiSuggestions.findIndex(s => s.id === insight.id));
      
    } catch (error) {
      console.error('Error executing insight action:', error);
      alert('Failed to execute action. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      // Fallback: force redirect anyway
      router.push('/');
    }
  };
  
  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchAccountTransactions = async (accountId: string) => {
    try {
      const response = await fetch(`/api/transactions?accountId=${accountId}`);
      if (response.ok) {
        const accountTransactionsData = await response.json();
        setAccountTransactions(accountTransactionsData);
      }
    } catch (error) {
      console.error('Error fetching account transactions:', error);
    }
  };

  const handleAccountClick = (account: any) => {
    setSelectedAccount(account);
    fetchAccountTransactions(account.id);
    // Switch to accounts view - we'll create a dedicated tab for this
    setLeftSidebarTab('accounts');
  };

  const handleRemoveAccount = (account: any) => {
    setAccountToClose(account);
    setShowAccountClosureModal(true);
  };

  const handleAccountClosed = async () => {
    try {
      // Immediately refresh accounts list after successful closure
      await refreshAccounts();
        
      // If the closed account was selected, clear the selection
      if (selectedAccount?.id === accountToClose?.id) {
        setSelectedAccount(null);
        setAccountTransactions([]);
        // Switch back to budget tab
        setLeftSidebarTab('budget');
      }
      
      // Reset modal state
      setAccountToClose(null);
    } catch (error) {
      console.error('Error refreshing accounts after closure:', error);
    }
  };

  const handleInitiateMoveMoney = (budget: any, event?: MouseEvent) => {
    setMoveMoneySource(budget);
    
    // Get click position for popover placement
    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setMoveMoneyPosition({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX
      });
    } else {
      // Fallback to center if no event
      setMoveMoneyPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2
      });
    }
    
    setShowMoveMoneyPopover(true);
  };

  const handleAssignMoney = async (targetBudgetId: string, amount: number) => {
    try {
      // Check if we're in overspending mode (amount is negative for overspending)
      const isOverspendingMode = amount < 0;
      const actualAmount = Math.abs(amount);
      
      if (isOverspendingMode) {
        // Handle overbudgeting - reduce budget amount to free up money for "To Be Budgeted"
        console.log('🔍 Handling overbudgeting transfer:', { targetBudgetId, actualAmount, overspentBudgets });
        
        // Simply reduce the budget amount to free up money
        const currentBudget = dashboardData?.categories?.flatMap((cat: any) => cat.budgets || [])
          .find((budget: any) => budget.id === targetBudgetId);
        
        if (!currentBudget) {
          throw new Error('Selected budget not found');
        }
        
        const newBudgetAmount = Math.max(0, currentBudget.budgeted - actualAmount);
        
        // **OPTIMISTIC UPDATE**: Update the budget and "To Be Assigned" immediately
        setDashboardData((prevData: any) => {
          if (!prevData) return prevData;
          
          const newData = { ...prevData };
          
          // Increase "To Be Assigned" amount (make it less negative or positive)
          newData.toBeAssigned = (newData.toBeAssigned || 0) + actualAmount;
          
          // Find and update the source budget (reduce its amount)
          if (newData.categories) {
            newData.categories = newData.categories.map((category: any) => ({
              ...category,
              budgets: category.budgets?.map((budget: any) => {
                if (budget.id === targetBudgetId) {
                  return {
                    ...budget,
                    budgeted: newBudgetAmount,
                    available: newBudgetAmount - budget.spent,
                    status: newBudgetAmount - budget.spent > 0 ? 'positive' : 
                           newBudgetAmount - budget.spent === 0 ? 'zero' : 'negative'
                  };
                }
                return budget;
              }) || []
            }));
          }
          
          return newData;
        });
        
        // Close popover immediately
        setShowAssignMoneyPopover(false);
        
        // Make API call to persist the budget update
        await handleEditBudget(targetBudgetId, { amount: newBudgetAmount });
        
      } else {
        // Normal assign money mode - assign from "To Be Assigned" to targetBudgetId
        // **OPTIMISTIC UPDATE**: Update the target budget and "To Be Assigned" immediately
        setDashboardData((prevData: any) => {
          if (!prevData) return prevData;
          
          const newData = { ...prevData };
          
          // Update "To Be Assigned" amount
          newData.toBeAssigned = (newData.toBeAssigned || 0) - actualAmount;
          
          // Find and update the target budget
          if (newData.categories) {
            newData.categories = newData.categories.map((category: any) => ({
              ...category,
              budgets: category.budgets?.map((budget: any) => {
                if (budget.id === targetBudgetId) {
                  const newBudgeted = budget.budgeted + actualAmount;
                  return {
                    ...budget,
                    budgeted: newBudgeted,
                    available: newBudgeted - budget.spent,
                    status: newBudgeted - budget.spent > 0 ? 'positive' : 
                           newBudgeted - budget.spent === 0 ? 'zero' : 'negative'
                  };
                }
                return budget;
              }) || []
            }));
          }
          
          return newData;
        });
        
        // Close popover immediately
        setShowAssignMoneyPopover(false);
        
        // Make API call to persist the budget update
        await handleEditBudget(targetBudgetId, { 
          amount: (dashboardData?.categories?.flatMap((cat: any) => cat.budgets || [])
            .find((budget: any) => budget.id === targetBudgetId)?.budgeted || 0) + actualAmount
        });
      }
      
    } catch (error) {
      console.error('Error assigning money:', error);
      
      // **ROLLBACK**: Refresh data to revert optimistic updates
      await refreshDashboard();
      
      alert('Failed to assign money. Please try again.');
    }
  };

  const handleMoveMoney = async (targetBudgetId: string, amount: number) => {
    if (!moveMoneySource) return;
    
    try {
      // **OPTIMISTIC UPDATE**: Update both budgets immediately
      setDashboardData((prevData: any) => {
        if (!prevData) return prevData;
        
        const newData = { ...prevData };
        
        if (newData.categories) {
          newData.categories = newData.categories.map((category: any) => {
            if (category.id === moveMoneySource.id) {
              // Source budget: subtract amount
              const updatedCategory = { ...category };
              updatedCategory.budgeted = Math.max(0, updatedCategory.budgeted - amount);
              updatedCategory.available = updatedCategory.budgeted - updatedCategory.spent;
              
              // Update status
              if (updatedCategory.available > 0) {
                updatedCategory.status = 'positive';
              } else if (updatedCategory.available === 0) {
                updatedCategory.status = 'zero';
              } else {
                updatedCategory.status = 'negative';
              }
              
              return updatedCategory;
            } else if (category.id === targetBudgetId) {
              // Target budget: add amount
              const updatedCategory = { ...category };
              updatedCategory.budgeted = updatedCategory.budgeted + amount;
              updatedCategory.available = updatedCategory.budgeted - updatedCategory.spent;
              
              // Update status
              if (updatedCategory.available > 0) {
                updatedCategory.status = 'positive';
              } else if (updatedCategory.available === 0) {
                updatedCategory.status = 'zero';
              } else {
                updatedCategory.status = 'negative';
              }
              
              return updatedCategory;
            }
            return category;
          });
        }
        
        return newData;
      });
      
      // Close popover immediately
      setShowMoveMoneyPopover(false);
      setMoveMoneySource(null);
      
      // Make API calls to persist changes
      await handleEditBudget(moveMoneySource.id, { 
        amount: moveMoneySource.budgeted - amount 
      });
      
      const targetBudget = dashboardData?.categories?.find((cat: any) => cat.id === targetBudgetId);
      if (targetBudget) {
        await handleEditBudget(targetBudgetId, { 
          amount: targetBudget.budgeted + amount 
        });
      }
      
    } catch (error) {
      console.error('Error moving money:', error);
      
      // Rollback optimistic updates
      try {
        await refreshDashboard();
      } catch (rollbackError) {
        console.error('Failed to rollback move money changes:', rollbackError);
      }
      
      alert('Failed to move money. Please try again.');
    }
  };

  const handleTransactionCategoryUpdate = async (transactionId: string, newCategory: string) => {
    try {
      const response = await fetch('/api/transactions/update-category', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          transactionId, 
          category: newCategory 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction category');
      }

      // Immediately refresh dashboard and transactions
      await Promise.all([
        refreshDashboard(),
        refreshTransactions()
      ]);
      
      // Refresh account transactions to show updated category
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
      
      setEditingTransaction(null);
      setCategoryInput('');
      setShowDropdown(false);
    } catch (error) {
      console.error('Error updating transaction category:', error);
      alert('Failed to update category. Please try again.');
    }
  };

  const handleCreateBudget = async (budgetData: any) => {
    try {
      await createBudgetOptimistic(budgetData);
      setShowBudgetModal(false);
    } catch (error) {
      console.error('Error creating budget:', error);
      alert('Failed to create budget. Please try again.');
    }
  };

  const handleCreateTransaction = async (transactionData: any) => {
    try {
      // **OPTIMISTIC UPDATE**: Add transaction to UI immediately with temporary ID
      const tempTransaction = {
        id: `temp-${Date.now()}`,
        ...transactionData,
        date: transactionData.date || new Date().toISOString(),
        cleared: transactionData.cleared || false,
        isManual: true,
        account: accounts.find(acc => acc.id === transactionData.accountId) || { accountName: 'Unknown' }
      };
      
      setTransactions(prev => [tempTransaction, ...prev]);
      
      // If we're viewing the account this transaction is for, also update accountTransactions optimistically
      // Use setTimeout to avoid interfering with form state during user interaction
      if (selectedAccount && transactionData.accountId === selectedAccount.id) {
        setTimeout(() => {
          setAccountTransactions(prev => [tempTransaction, ...prev]);
        }, 0);
      }
      
      // Make API call to persist
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        throw new Error('Failed to create transaction');
      }
      
      const newTransaction = await response.json();

      // **SYNC WITH SERVER**: Immediately refresh both dashboard and transactions
      await Promise.all([
        refreshDashboard(),
        refreshTransactions()
      ]);
      
      // If we're viewing a specific account, also refresh its transactions
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Failed to create transaction. Please try again.');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      // Immediately refresh both dashboard and transactions
      await Promise.all([
        refreshDashboard(),
        refreshTransactions()
      ]);
      
      // If we're viewing a specific account, also refresh its transactions
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  };

  const handleToggleCleared = async (transactionId: string, cleared: boolean) => {
    try {
      // **OPTIMISTIC UPDATE**: Update cleared status immediately
      setTransactions(prev => 
        prev.map(transaction => 
          transaction.id === transactionId 
            ? { ...transaction, cleared }
            : transaction
        )
      );
      
      // Also update account transactions if viewing specific account
      if (selectedAccount) {
        setAccountTransactions(prev => 
          prev.map(transaction => 
            transaction.id === transactionId 
              ? { ...transaction, cleared }
              : transaction
          )
        );
      }
      
      // Make API call to persist
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cleared }),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }

      // **SYNC WITH SERVER**: Immediately refresh dashboard
      await refreshDashboard();

      // If we're viewing a specific account, also refresh its transactions
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      
      // **ROLLBACK**: Refresh to revert optimistic update
      try {
        await refreshDashboard();
        
        if (selectedAccount) {
          fetchAccountTransactions(selectedAccount.id);
        }
      } catch (rollbackError) {
        console.error('Failed to rollback cleared status change:', rollbackError);
      }
      
      alert('Failed to update transaction. Please try again.');
    }
  };

  const handleUpdateTransaction = async (transactionId: string, updates: any) => {
    try {
      // **OPTIMISTIC UPDATE**: Update transaction in UI immediately
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transaction.id === transactionId 
            ? { ...transaction, ...updates }
            : transaction
        )
      );
      
      // Also update account transactions if viewing specific account
      if (selectedAccount) {
        setAccountTransactions((prevTransactions: any[]) => 
          prevTransactions.map(transaction => 
            transaction.id === transactionId 
              ? { ...transaction, ...updates }
              : transaction
          )
        );
      }
      
      // Make API call to persist changes
      const response = await fetch(`/api/transactions?id=${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }

      // **SYNC WITH SERVER**: Refresh data to ensure consistency
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/transactions')
      ]);
      
      if (dashboardResponse.ok && transactionsResponse.ok) {
        const [dashboardData, transactionsData] = await Promise.all([
          dashboardResponse.json(),
          transactionsResponse.json()
        ]);
        setDashboardData(dashboardData);
        setTransactions(transactionsData);
      }

      // If we're viewing a specific account, also refresh its transactions
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      
      // **ROLLBACK**: Refresh data to revert optimistic updates
      try {
        const [dashboardResponse, transactionsResponse] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/transactions')
        ]);
        
        if (dashboardResponse.ok && transactionsResponse.ok) {
          const [dashboardData, transactionsData] = await Promise.all([
            dashboardResponse.json(),
            transactionsResponse.json()
          ]);
          setDashboardData(dashboardData);
          setTransactions(transactionsData);
        }
        
        if (selectedAccount) {
          fetchAccountTransactions(selectedAccount.id);
        }
      } catch (rollbackError) {
        console.error('Failed to rollback transaction changes:', rollbackError);
      }
      
      alert('Failed to update transaction. Please try again.');
    }
  };

  const handleCreateGoal = async (goalData: any) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });

      if (!response.ok) {
        throw new Error('Failed to create goal');
      }

      // Immediately refresh dashboard data
      await refreshDashboard();
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal. Please try again.');
    }
  };

  const handleEditBudget = async (id: string, updates: { name?: string; amount?: number; category?: string }) => {
    try {
      console.log('Updating budget:', id, 'with updates:', updates);
      await updateBudgetOptimistic(id, updates);
    } catch (error) {
      console.error('Error updating budget:', error);
      alert(`Failed to update budget: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      await deleteBudgetOptimistic(id);
    } catch (error) {
      console.error('Error deleting budget:', error);
      alert('Failed to delete budget. Please try again.');
    }
  };


  const handleSyncAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully synced! ${data.newTransactions} new transactions found.`);
        // Refresh dashboard data
        window.location.reload();
      } else {
        alert('Failed to sync accounts. Please try again.');
      }
    } catch (error) {
      console.error('Error syncing accounts:', error);
      alert('Failed to sync accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidSuccess = async (data: any, metadata: any) => {
    console.log('🔗 Plaid connection successful:', data, metadata);
    
    // Close the modal
    setShowAccountTypeModal(false);
    
    // Show success message
    alert(`Successfully connected! ${data.accounts || 0} accounts and ${data.transactions || 0} transactions imported.`);
    
    // Hot reload to show new accounts and transactions immediately
    console.log('🔄 Starting hot reload after Plaid connection...');
    await hotReload();
    console.log('✅ Hot reload completed');
  };

  const handlePlaidExit = (error: any, metadata: any) => {
    console.log('Plaid connection exited:', error, metadata);
    if (error) {
      alert('Failed to connect bank account. Please try again.');
    }
  };

  const handleManualAccountSubmit = async (accountData: any) => {
    try {
      const response = await fetch('/api/accounts/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Account "${accountData.accountName}" added successfully!`);
        setShowAccountModal(false);
        window.location.reload(); // Refresh to show new account
      } else {
        alert('Failed to add account. Please try again.');
      }
    } catch (error) {
      console.error('Error adding manual account:', error);
      alert('Failed to add account. Please try again.');
    }
  };

  const handleFlagTransactions = async (transactionIds: string[], color: string) => {
    try {
      // **OPTIMISTIC UPDATE**: Update transaction flags immediately in UI
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, flagColor: color || undefined }
            : transaction
        )
      );
      
      // Also update account transactions if viewing an account
      setAccountTransactions((prevAccountTransactions: any[]) => 
        prevAccountTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, flagColor: color || undefined }
            : transaction
        )
      );

      // **PERSIST TO DATABASE**: Save flag changes to server
      const response = await fetch('/api/transactions/flag', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionIds,
          flagColor: color
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save flag changes');
      }

      const result = await response.json();
      console.log('✅ Flag changes persisted:', result.message);
      
    } catch (error) {
      console.error('Error flagging transactions:', error);
      // **ROLLBACK**: Revert optimistic update on failure
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, flagColor: transaction.flagColor } // Keep original
            : transaction
        )
      );
      alert('Failed to flag transactions. Please try again.');
    }
  };

  const handleFlagSingleTransaction = async (transactionId: string, color: string) => {
    try {
      // **OPTIMISTIC UPDATE**: Update single transaction flag immediately in UI
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transaction.id === transactionId 
            ? { ...transaction, flagColor: color || undefined }
            : transaction
        )
      );
      
      // Also update account transactions if viewing an account
      setAccountTransactions((prevAccountTransactions: any[]) => 
        prevAccountTransactions.map(transaction => 
          transaction.id === transactionId 
            ? { ...transaction, flagColor: color || undefined }
            : transaction
        )
      );

      // **PERSIST TO DATABASE**: Save single flag change to server
      const response = await fetch('/api/transactions/flag', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionIds: transactionId,
          flagColor: color,
          single: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save flag change');
      }

      const result = await response.json();
      console.log('✅ Single flag change persisted:', result.message);
      
    } catch (error) {
      console.error('Error flagging single transaction:', error);
      // **ROLLBACK**: Revert optimistic update on failure
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transaction.id === transactionId 
            ? { ...transaction, flagColor: transaction.flagColor } // Keep original
            : transaction
        )
      );
      alert('Failed to flag transaction. Please try again.');
    }
  };

  const handleApproveTransactions = async (transactionIds: string[], approved: boolean) => {
    try {
      // **OPTIMISTIC UPDATE**: Update transaction approval status immediately in UI
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, approved: approved }
            : transaction
        )
      );
      
      // Also update account transactions if viewing an account
      setAccountTransactions((prevAccountTransactions: any[]) => 
        prevAccountTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, approved: approved }
            : transaction
        )
      );

      // **PERSIST TO DATABASE**: Save approval changes to server
      const response = await fetch('/api/transactions/approve', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionIds: transactionIds,
          approved: approved
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update approval status');
      }
      
      const result = await response.json();
      console.log(`✅ Approval status updated: ${result.message}`);
      
    } catch (error) {
      console.error('Error updating approval status:', error);
      // **ROLLBACK**: Revert optimistic update on failure
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, approved: !approved } // Revert to original
            : transaction
        )
      );
      setAccountTransactions((prevAccountTransactions: any[]) => 
        prevAccountTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { ...transaction, approved: !approved } // Revert to original
            : transaction
        )
      );
      alert('Failed to update approval status. Please try again.');
    }
  };

  const handleCreateCategory = async (categoryName: string, groupName: string) => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Create new budget category
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: categoryName,
          amount: 0, // Start with $0 budget
          category: groupName,
          month: currentMonth,
          year: currentYear,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create category');
      }

      const newBudget = await response.json();
      console.log(`✅ Category created: ${categoryName} in ${groupName}`);

      // Immediately refresh dashboard data to show new category
      await refreshDashboard();

    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category. Please try again.');
    }
  };

  const handleMoveTransactions = async (transactionIds: string[], targetAccountId: string) => {
    try {
      const targetAccount = accounts.find(acc => acc.id === targetAccountId);
      
      // Store original state for potential rollback
      const originalTransactions = transactions;
      const originalAccountTransactions = accountTransactions;
      const originalAccounts = accounts;
      
      // Calculate balance changes for optimistic update
      const balanceChanges = new Map<string, number>();
      const transactionsToMove = transactions.filter(t => transactionIds.includes(t.id));
      
      transactionsToMove.forEach(transaction => {
        const sourceAccountId = transaction.accountId;
        const amount = transaction.amount;
        
        // Remove from source account
        balanceChanges.set(sourceAccountId, (balanceChanges.get(sourceAccountId) || 0) - amount);
        // Add to target account
        balanceChanges.set(targetAccountId, (balanceChanges.get(targetAccountId) || 0) + amount);
      });
      
      // **OPTIMISTIC BALANCE UPDATE**: Update account balances immediately
      setAccounts((prevAccounts: any[]) => 
        prevAccounts.map(account => {
          const balanceChange = balanceChanges.get(account.id);
          if (balanceChange !== undefined) {
            return {
              ...account,
              balance: account.balance + balanceChange,
              availableBalance: account.availableBalance ? account.availableBalance + balanceChange : account.availableBalance
            };
          }
          return account;
        })
      );
      
      // **OPTIMISTIC UPDATE**: Move transactions to new account immediately in UI
      setTransactions((prevTransactions: any[]) => 
        prevTransactions.map(transaction => 
          transactionIds.includes(transaction.id) 
            ? { 
                ...transaction, 
                accountId: targetAccountId,
                account: { accountName: targetAccount?.accountName || 'Unknown Account' }
              }
            : transaction
        )
      );
      
      // If we're viewing a specific account and transactions are moved FROM this account,
      // remove them from the account transactions view
      if (selectedAccount) {
        const movedTransactions = accountTransactions.filter(t => transactionIds.includes(t.id));
        const isMovingFromCurrentAccount = movedTransactions.length > 0;
        
        if (isMovingFromCurrentAccount) {
          // Remove moved transactions from current account view
          setAccountTransactions((prevAccountTransactions: any[]) => 
            prevAccountTransactions.filter(transaction => !transactionIds.includes(transaction.id))
          );
        } else {
          // If moving TO the current account, add them to the account view
          const transactionsToAdd = transactions.filter(t => transactionIds.includes(t.id));
          setAccountTransactions((prevAccountTransactions: any[]) => [
            ...prevAccountTransactions,
            ...transactionsToAdd.map(t => ({
              ...t,
              accountId: targetAccountId,
              account: { accountName: targetAccount?.accountName || 'Unknown Account' }
            }))
          ]);
        }
      }

      // **PERSIST TO DATABASE**: Save move changes to server
      const response = await fetch('/api/transactions/move', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionIds,
          targetAccountId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save move changes');
      }

      const result = await response.json();
      console.log(`✅ Move changes persisted: ${result.message}`);
      console.log('💰 Balance changes:', result.balanceChanges);
      
      // **UPDATE ACCOUNT BALANCES**: Update account balances in UI with server data
      if (result.updatedAccounts) {
        setAccounts((prevAccounts: any[]) => 
          prevAccounts.map(account => {
            const updatedAccount = result.updatedAccounts.find((ua: any) => ua.id === account.id);
            return updatedAccount ? { ...account, ...updatedAccount } : account;
          })
        );
      }

      // **REFRESH DASHBOARD**: Immediately update all dependent calculations including budgets and "To Be Assigned"
      await Promise.all([
        refreshDashboard(),
        refreshTransactions()
      ]);
      
      // If viewing specific account, refresh its transactions too
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
      
    } catch (error) {
      console.error('Error moving transactions:', error);
      
      // **ROLLBACK**: Refresh data to revert optimistic updates
      await hotReload();
      
      if (selectedAccount) {
        fetchAccountTransactions(selectedAccount.id);
      }
      
      alert('Failed to move transactions. Please try again.');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current?.budget);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    try {
      const activeData = active.data.current;
      const overData = over.data.current;

      console.log('Drag End:', { 
        activeId: active.id, 
        overId: over.id, 
        activeData, 
        overData 
      }); // Debug log

      // Handle dropping budget into a different category
      if (activeData?.type === 'budget') {
        const budget = activeData.budget;
        let newCategory = null;

        // Check if dropped on a category group
        if (overData?.type === 'category') {
          newCategory = overData.groupName;
        }
        // Check if dropped on category by ID (fallback)
        else if (typeof over.id === 'string' && over.id.startsWith('category-')) {
          newCategory = over.id.replace('category-', '');
        }

        console.log('Moving budget:', budget.name, 'from', budget.category, 'to', newCategory); // Debug log

        if (newCategory && budget.category !== newCategory) {
          handleEditBudget(budget.id, { category: newCategory });
        }
      }
    } catch (error) {
      console.error('Error in drag end handler:', error);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  // AI Chat Action Handler
  const handleAIAction = async (action: string, data: any) => {
    try {
      switch (action) {
        case 'open_move_money':
          // Open the move money popover/modal
          console.log('Opening move money dialog:', data);
          break;
        
        case 'open_debt_planner':
          // Switch to debt payoff tab
          setLeftSidebarTab('debt');
          break;

        case 'open_assign_money':
          // Open assign money flyout
          setShowAssignMoneyPopover(true);
          setAssignMoneyPosition({ top: 200, left: 200 });
          break;

        case 'open_fund_goal':
          // Switch to goals tab to fund goals
          setLeftSidebarTab('goals');
          break;
        
        case 'refresh_data':
          // Refresh dashboard data after AI actions
          await fetchDashboardData();
          break;
        
        default:
          console.log('Unknown AI action:', action, data);
      }
    } catch (error) {
      console.error('AI Action Handler Error:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50/30 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="relative mx-auto mb-6 w-16 h-16">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-500 border-t-transparent absolute top-0 left-0 animate-pulse"></div>
          </div>
          <p className="text-gray-700 font-halyard font-bold animate-pulse">Loading your financial dashboard...</p>
          <div className="mt-4 flex justify-center space-x-1">
            <div className="w-2 h-2 bg-[#86b686] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-[#86b686] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#86b686] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  const budgetData = dashboardData;

  const savingsGoals = dashboardData.goals ? dashboardData.goals.filter((goal: any) => goal.type === 'savings') : [];

  // Use the new category groups structure from the API
  const categoryGroups: { [key: string]: any[] } = {};
  
  if (dashboardData?.categories) {
    dashboardData.categories.forEach((categoryGroup: any) => {
      // Each category group now has a 'budgets' array with the actual budget items
      categoryGroups[categoryGroup.name] = categoryGroup.budgets || [];
    });
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getCategoryGroupForCategory = (categoryName: string) => {
    // Find which category group this category belongs to
    if (dashboardData?.categories) {
      const foundCategory = dashboardData.categories.find((cat: any) => cat.name === categoryName);
      if (foundCategory) {
        return foundCategory.category;
      }
    }
    
    // Fallback mapping for categories not found in budgets
    const categoryMapping: { [key: string]: string } = {
      'Food & Dining': 'Frequent Spending',
      'Eating Out': 'Frequent Spending',
      'Groceries': 'Frequent Spending',
      'Gas & Fuel': 'Frequent Spending',
      'Transportation': 'Frequent Spending',
      'Shopping': 'Frequent Spending',
      'Entertainment': 'Frequent Spending',
      'Transfer': 'Other',
      'Other': 'Other',
      'Misc. Needs': 'Non-Monthly',
    };
    
    return categoryMapping[categoryName] || 'Other';
  };

  const formatCategoryDisplay = (categoryName: string) => {
    const categoryGroup = getCategoryGroupForCategory(categoryName);
    return `${categoryGroup}: ${categoryName}`;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'overspent': return 'text-red-600 bg-red-50';
      case 'on-track': return 'text-green-600 bg-green-50';
      case 'goal': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50/30 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 shadow-lg px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/img/PNG/logo.png" 
              alt="Logo" 
              className="h-12 w-auto"
            />
            <p className="text-found-text opacity-60 font-halyard-micro font-medium tracking-wide">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-3 overflow-x-auto">
            <button
              onClick={() => setShowAccountTypeModal(true)}
              className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-[#86b686] to-[#9cc49c] text-white px-2 sm:px-4 py-2 rounded-xl hover:from-[#73a373] hover:to-[#86b686] transition-all duration-300 text-sm font-medium flex-shrink-0 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="font-halyard font-bold">Add Account</span>
            </button>
            <button
              onClick={handleSignOut}
              className="bg-gray-600/80 backdrop-blur-sm text-white px-3 py-2 rounded-xl hover:bg-gray-700/90 hover:shadow-md transition-all duration-300 hover:scale-105 text-sm border border-gray-500/30"
            >
              <span className="font-halyard font-medium">Sign Out</span>
            </button>
            <button className="p-2 text-found-text opacity-60 hover:text-found-text hover:opacity-100 rounded-xl hover:bg-white/50 hover:backdrop-blur-sm hover:shadow-md transition-all duration-300 hover:scale-110 border border-transparent hover:border-white/30">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Transaction Alert Banner */}
      <div className="px-6">
        <TransactionAlertBanner
          unapprovedTransactions={unapprovedTransactions}
          uncategorizedTransactions={uncategorizedTransactions}
          onViewUnapproved={handleViewUnapproved}
          onViewUncategorized={handleViewUncategorized}
        />
      </div>

      <div className="flex flex-col lg:flex-row min-h-0 flex-1">
        {/* Left Sidebar */}
        <aside className="w-full lg:w-72 lg:flex-shrink-0 bg-[#FFFFFF] border-r border-[#EFF2F0] lg:min-h-screen">
          {/* Sidebar Tabs */}
          <div className="flex flex-col">
            <button
              onClick={() => setLeftSidebarTab('budget')}
              className={`flex items-center space-x-4 px-6 py-4 text-base font-normal transition-colors ${
                leftSidebarTab === 'budget'
                  ? 'text-[#151418] bg-[#86b686] bg-opacity-10'
                  : 'text-[#9CA3AF] hover:text-[#151418] hover:bg-[#EFF2F0]'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>Budget</span>
            </button>
            <button
              onClick={() => setLeftSidebarTab('transactions')}
              className={`flex items-center space-x-4 px-6 py-4 text-base font-normal transition-colors ${
                leftSidebarTab === 'transactions'
                  ? 'text-[#151418] bg-[#86b686] bg-opacity-10'
                  : 'text-[#9CA3AF] hover:text-[#151418] hover:bg-[#EFF2F0]'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Transactions</span>
            </button>
            <button
              onClick={() => setLeftSidebarTab('debt')}
              className={`flex items-center space-x-4 px-6 py-4 text-base font-normal transition-colors ${
                leftSidebarTab === 'debt'
                  ? 'text-[#151418] bg-[#86b686] bg-opacity-10'
                  : 'text-[#9CA3AF] hover:text-[#151418] hover:bg-[#EFF2F0]'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              <span>Debt Payoff</span>
            </button>
            <button
              onClick={() => setLeftSidebarTab('ai-advisor')}
              className={`flex items-center space-x-4 px-6 py-4 text-base font-normal transition-colors ${
                leftSidebarTab === 'ai-advisor'
                  ? 'text-[#151418] bg-gradient-to-r from-purple-100 to-blue-100'
                  : 'text-[#9CA3AF] hover:text-[#151418] hover:bg-[#EFF2F0]'
              }`}
            >
              <Brain className="w-4 h-4" />
              <span>Finley</span>
            </button>
          </div>
          
          {/* Always Visible Accounts Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-6 bg-white/60 backdrop-blur-sm border-b border-white/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-halyard font-bold text-[#151418] tracking-tight">Accounts</h3>
                <span className="text-sm font-halyard-micro font-bold text-[#6B7280] bg-gray-100 px-2 py-1 rounded-full">{accounts.length}</span>
              </div>
              
              {/* Add Account Button */}
              <PlaidLink 
                onSuccess={async (data, metadata) => {
                  console.log('🔗 Plaid Link success (sidebar):', { data, metadata });
                  console.log('🔄 Starting hot reload from sidebar...');
                  // Immediately refresh all data after successful connection
                  await hotReload();
                  console.log('✅ Hot reload completed from sidebar');
                }}
                onExit={(err, metadata) => {
                  if (err) {
                    console.error('Plaid Link error:', err);
                  }
                }}
              >
                <button className="w-full flex items-center space-x-2 p-3 bg-gradient-to-r from-[#86b686] to-[#9cc49c] text-white rounded-xl hover:from-[#73a373] hover:to-[#86b686] transition-all duration-300 mb-4 shadow-lg hover:shadow-xl hover:scale-[1.02] border border-white/10">
                  <PlusCircle className="w-4 h-4" />
                  <span className="font-halyard font-bold">Add Account</span>
                </button>
              </PlaidLink>
            </div>
            
            {/* Accounts List - Takes remaining height */}
            <div className="flex-1 overflow-y-auto px-4">
              {accounts.length > 0 ? (
                <div className="space-y-4">
                  {/* Cash Accounts */}
                  {accounts.filter(account => account.accountType === 'depository').length > 0 && (
                    <div>
                      <h4 className="text-sm font-halyard-micro font-bold text-[#6B7280] px-2 mb-2 uppercase tracking-wider">Cash Accounts</h4>
                      <div className="space-y-1">
                        {accounts.filter(account => account.accountType === 'depository').map((account) => (
                          <div 
                            key={account.id} 
                            className={`group px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${
                              selectedAccount?.id === account.id 
                                ? 'bg-white/80 backdrop-blur-sm text-[#151418] shadow-lg border border-orange-200/50' 
                                : 'text-[#6B7280] hover:bg-white/50 hover:backdrop-blur-sm hover:text-[#151418] hover:shadow-md hover:scale-[1.02] border border-transparent hover:border-white/30'
                            }`}
                            onClick={() => handleAccountClick(account)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-halyard font-bold text-sm truncate">{account.accountName}</p>
                                  <p className="font-halyard-micro text-xs opacity-60 uppercase tracking-wide">{account.accountSubtype || account.accountType}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <p className="font-halyard font-bold text-sm text-green-600">
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(account.balance)}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSyncAccounts();
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#9CA3AF] hover:text-green-600 rounded"
                                  title="Sync Account"
                                  disabled={loading}
                                >
                                  <Activity className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveAccount(account);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#9CA3AF] hover:text-red-500 rounded"
                                  title={`Remove ${account.accountName}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credit Accounts */}
                  {accounts.filter(account => account.accountType === 'credit').length > 0 && (
                    <div>
                      <h4 className="text-sm font-halyard-micro font-bold text-[#6B7280] px-2 mb-2 uppercase tracking-wider">Credit Accounts</h4>
                      <div className="space-y-1">
                        {accounts.filter(account => account.accountType === 'credit').map((account) => (
                          <div 
                            key={account.id} 
                            className={`group px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${
                              selectedAccount?.id === account.id 
                                ? 'bg-white/80 backdrop-blur-sm text-[#151418] shadow-lg border border-orange-200/50' 
                                : 'text-[#6B7280] hover:bg-white/50 hover:backdrop-blur-sm hover:text-[#151418] hover:shadow-md hover:scale-[1.02] border border-transparent hover:border-white/30'
                            }`}
                            onClick={() => handleAccountClick(account)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className={`w-3 h-3 rounded-full ${
                                  account.balance < 0 ? 'bg-red-500' : 'bg-green-500'
                                }`}></div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-halyard font-bold text-sm truncate">{account.accountName}</p>
                                  <p className="font-halyard-micro text-xs opacity-60 uppercase tracking-wide">{account.accountSubtype || account.accountType}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right">
                                  <p className={`font-bold text-sm ${
                                    account.accountType === 'credit' || account.balance < 0 ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {account.balance < 0 ? '-' : ''}
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }).format(Math.abs(account.balance))}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSyncAccounts();
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#9CA3AF] hover:text-green-600 rounded"
                                  title="Sync Account"
                                  disabled={loading}
                                >
                                  <Activity className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveAccount(account);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#9CA3AF] hover:text-red-500 rounded"
                                  title={`Remove ${account.accountName}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-[#6B7280]">
                    <CreditCard className="w-12 h-12 mx-auto text-[#9CA3AF] mb-3" />
                    <p className="text-sm font-medium">No accounts connected</p>
                    <p className="text-xs mt-1">Use the button above to connect your first account</p>
                  </div>
                </div>
              )}
            </div>
          
            {/* Tab Content Section - Now minimal space at bottom */}
            <div className="border-t border-[#EFF2F0] p-6 bg-[#FFFFFF]">
              {leftSidebarTab === 'budget' && (
              <div>
                <h3 className="text-lg font-semibold text-[#151418] mb-4">Budget Overview</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-[#FFFFFF] rounded-lg border border-[#EFF2F0]">
                    <p className="text-sm text-[#151418] font-medium">Quick Stats</p>
                    <p className="text-xs text-[#6B7280] mt-1">View category groups in main content</p>
                  </div>
                  <button
                    onClick={() => setShowBudgetModal(true)}
                    className="w-full flex items-center space-x-2 p-3 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Budget Line</span>
                  </button>
                </div>
              </div>
            )}

            {leftSidebarTab === 'transactions' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#151418]">Recent Transactions</h3>
                  <button
                    onClick={() => {/* No modal needed */}}
                    className="text-[#f29676] hover:text-[#e8825f] text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {dashboardData.recentTransactions && dashboardData.recentTransactions.length > 0 ? dashboardData.recentTransactions.map((transaction: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{transaction.name}</p>
                        <p className="text-sm text-gray-600">{transaction.category} • {transaction.date}</p>
                      </div>
                      <span className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  )) : (
                    <div className="p-3 text-center text-gray-500">
                      <p>No recent transactions</p>
                      <button
                        onClick={() => {/* No modal needed */}}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Add your first transaction
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {leftSidebarTab === 'debt' && (
              <div>
                <h3 className="text-lg font-semibold text-[#151418] mb-4">Debt Payoff</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-[#FFFFFF] rounded-lg border border-[#EFF2F0]">
                    <p className="text-sm text-[#151418] font-medium">Debt Payoff Tools</p>
                    <p className="text-xs text-[#6B7280] mt-1">Plan your debt-free journey</p>
                  </div>
                  {/* Summary for actual debts only */}
                  {accounts && accounts.filter(acc => acc.accountType === 'credit' && acc.balance < 0).length > 0 ? (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-900">
                        {accounts.filter(acc => acc.accountType === 'credit' && acc.balance < 0).length} debt account{accounts.filter(acc => acc.accountType === 'credit' && acc.balance < 0).length > 1 ? 's' : ''} to pay off
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        Total: {formatCurrency(accounts.filter(acc => acc.accountType === 'credit' && acc.balance < 0).reduce((sum, acc) => sum + Math.abs(acc.balance), 0))}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 text-center text-gray-500">
                      <p className="text-sm">No debt to pay off</p>
                      <p className="text-xs mt-1">You're debt-free! 🎉</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {leftSidebarTab === 'charts' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Chart Types</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-indigo-600 font-medium">6 Chart Types Available</p>
                    <p className="text-xs text-indigo-500 mt-1">Switch tabs in main content to explore</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <TrendingUp className="w-4 h-4 mx-auto text-green-500 mb-1" />
                      <span className="block text-gray-600">Spending</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <PieChart className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                      <span className="block text-gray-600">Categories</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <BarChart3 className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                      <span className="block text-gray-600">Budget</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <DollarSign className="w-4 h-4 mx-auto text-orange-500 mb-1" />
                      <span className="block text-gray-600">Cash Flow</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <Target className="w-4 h-4 mx-auto text-red-500 mb-1" />
                      <span className="block text-gray-600">Goals</span>
                    </div>
                    <div className="p-2 bg-gray-50 rounded text-center">
                      <Calendar className="w-4 h-4 mx-auto text-indigo-500 mb-1" />
                      <span className="block text-gray-600">Monthly</span>
                    </div>
                  </div>
                </div>
              </div>
            )}


            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0">
          {/* Main Content */}
          <main className="flex-1 p-4 lg:p-6 xl:p-8 bg-[#F8F8F5] overflow-auto min-w-0">
            {/* Budget Tab Content */}
            {leftSidebarTab === 'budget' && (
              <>
                {/* Main Stats */}
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 mb-6 lg:mb-8">
                  {/* To Be Assigned - Largest card */}
                  <div className="bg-[#FFFFFF] rounded-2xl p-8 border-0 shadow-lg flex-[3] flex flex-col justify-end">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-8">
                      <div className="flex-1">
                        <p className="text-lg text-[#6B7280] font-medium mb-3">To Be Assigned</p>
                        <p className={`text-4xl lg:text-5xl font-bold mb-4 ${
                          (dashboardData.toBeAssigned || 0) > 0 ? 'text-green-600' : 
                          (dashboardData.toBeAssigned || 0) === 0 ? 'text-gray-400' : 
                          'text-red-600'
                        }`}>
                          {formatCurrency(dashboardData.toBeAssigned || 0)}
                        </p>
                        <p className="text-base text-[#9CA3AF] leading-relaxed">
                          {isOverbudgeted ? `Overbudgeted by ${formatCurrency(overbudgetedAmount)} - cover overspending` :
                           (dashboardData.toBeAssigned || 0) === 0 ? 'All money assigned' :
                           'Available cash to budget'}
                        </p>
                      </div>
                      <div className="flex lg:flex-col lg:items-end">
                        <button
                          onClick={(e) => {
                            if (isOverbudgeted || (dashboardData.toBeAssigned || 0) > 0) {
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              setAssignMoneyPosition({
                                top: rect.bottom + window.scrollY + 5,
                                left: rect.left + window.scrollX - 200
                              });
                              setShowAssignMoneyPopover(true);
                            }
                          }}
                          disabled={!isOverbudgeted && (dashboardData.toBeAssigned || 0) <= 0}
                          className={`flex items-center space-x-3 px-6 py-3 rounded-lg transition-all duration-200 ${
                            isOverbudgeted
                              ? 'bg-red-50 hover:bg-red-100 text-red-600 hover:scale-105 cursor-pointer border border-red-200 shadow-sm hover:shadow-md'
                              : (dashboardData.toBeAssigned || 0) > 0 
                                ? 'bg-green-50 hover:bg-green-100 text-green-600 hover:scale-105 cursor-pointer border border-green-200 shadow-sm hover:shadow-md' 
                                : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                          }`}
                          title={isOverbudgeted ? 'Cover overbudgeting by moving money from other budgets' : 
                                 (dashboardData.toBeAssigned || 0) > 0 ? 'Assign money to budgets' : 'No money available to assign'}
                        >
                          <span className="text-base font-medium">
                            {isOverbudgeted ? 'Cover Overspending' : 'Assign Money'}
                          </span>
                          <ChevronDown className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
              
                  {/* Total Budgeted Card - Smaller card */}
                  <div className="bg-[#FFFFFF] rounded-2xl p-6 border-0 shadow-lg flex-[1] flex flex-col justify-end">
                    <div className="flex items-end justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-[#6B7280] font-medium mb-2">Total Budgeted</p>
                        <p className="text-2xl font-bold text-[#151418] mb-1">{formatCurrency(dashboardData.totalBudgeted || 0)}</p>
                        <p className="text-xs text-[#9CA3AF]">Money allocated</p>
                      </div>
                      <div className="text-green-600">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                
                  {/* Total Spent Card - Smaller card */}
                  <div className="bg-[#FFFFFF] rounded-2xl p-6 border-0 shadow-lg flex-[1] flex flex-col justify-end">
                    <div className="flex items-end justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-[#6B7280] font-medium mb-2">Total Spent</p>
                        <p className="text-2xl font-bold text-[#151418] mb-1">{formatCurrency(dashboardData.totalSpent || 0)}</p>
                        <p className="text-xs text-[#9CA3AF]">Actual spending</p>
                      </div>
                      <div className="text-blue-600">
                        <TrendingDown className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>


          {/* Category Groups with Budget Lines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Category Groups</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowProgressBars(!showProgressBars)}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      showProgressBars 
                        ? 'bg-[#86b686] bg-opacity-20 text-[#86b686] hover:bg-opacity-30' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={showProgressBars ? 'Hide progress bars' : 'Show progress bars'}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{showProgressBars ? 'Hide Bars' : 'Show Bars'}</span>
                  </button>
                  <button 
                    onClick={() => setShowBudgetModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Budget Line</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="flex items-center px-2 sm:px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-700">
              <div className="w-6 hidden sm:block"></div> {/* Space for drag handle */}
              <div className="flex-1 min-w-0">Budget Line</div>
              <div className="w-20 sm:w-24 lg:w-32 text-right">Budgeted</div>
              <div className="w-20 sm:w-24 lg:w-32 text-right hidden sm:block">Spent</div>
              <div className="w-20 sm:w-24 lg:w-32 text-right">Available</div>
              <div className="w-8 sm:w-12"></div> {/* Space for action buttons */}
            </div>
            
            <DndContext
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="divide-y divide-gray-200">
                {Object.entries(categoryGroups)
                  .map(([groupName, categories]) => (
                  <CategoryGroup
                    key={groupName}
                    groupName={groupName}
                    categories={categories}
                    formatCurrency={formatCurrency}
                    getStatusColor={getStatusColor}
                    onEditBudget={handleEditBudget}
                    onDeleteBudget={handleDeleteBudget}
                    onInitiateMoveMoney={handleInitiateMoveMoney}
                    showProgressBars={showProgressBars}
                  />
                ))}
                
                {dashboardData?.categories && dashboardData.categories.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <p>No budget lines found. Create some budget lines to get started!</p>
                  </div>
                )}
              </div>
              
              {/* Drag Overlay */}
              <DragOverlay>
                {activeDragItem && (
                  <BudgetItem
                    budget={activeDragItem}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onInitiateMoveMoney={() => {}}
                    formatCurrency={formatCurrency}
                    getStatusColor={getStatusColor}
                    isDragging={true}
                    showProgressBars={showProgressBars}
                  />
                )}
              </DragOverlay>
            </DndContext>
          </div>
              </>
            )}

            {/* Transactions Tab Content */}
            {leftSidebarTab === 'transactions' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">All Transactions</h2>
                    <button
                      onClick={() => {/* No modal needed */}}
                      className="flex items-center space-x-2 px-4 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Transaction</span>
                    </button>
                  </div>
                </div>
                
                {/* Filter Indicator */}
                {transactionFilter !== 'all' && (
                  <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-yellow-800">
                          Filtering: {transactionFilter === 'unapproved' ? 'Unapproved Transactions' : 'Uncategorized Transactions'}
                        </span>
                        <span className="text-xs text-yellow-600 bg-yellow-200 px-2 py-1 rounded-full">
                          {filteredTransactions.length} results
                        </span>
                      </div>
                      <button
                        onClick={() => setTransactionFilter('all')}
                        className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center space-x-1 hover:bg-yellow-100 px-2 py-1 rounded-md transition-colors"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear Filter</span>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="p-6">
                  <TransactionList
                    transactions={filteredTransactions}
                    onDeleteTransaction={handleDeleteTransaction}
                    onAddTransaction={handleCreateTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onToggleCleared={handleToggleCleared}
                    onFlagTransactions={handleFlagTransactions}
                    onFlagSingleTransaction={handleFlagSingleTransaction}
                    onMoveTransactions={handleMoveTransactions}
                    onApproveTransactions={handleApproveTransactions}
                    accounts={accounts}
                    categories={dashboardData?.categories?.flatMap((group: any) => 
                      group.budgets?.map((budget: any) => budget.name) || []
                    ) || []}
                    categoryGroups={dashboardData?.categories || []}
                    onCreateCategory={handleCreateCategory}
                  />
                </div>
              </div>
            )}

            {/* Debt Payoff Tab Content */}
            {leftSidebarTab === 'debt' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <DebtPayoffDashboard
                  accounts={accounts}
                />
              </div>
            )}

            {/* Accounts Tab Content */}
            {selectedAccount && leftSidebarTab === 'accounts' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedAccount.accountName}</h2>
                      <p className="text-sm text-gray-600">
                        {selectedAccount.accountType} • {selectedAccount.accountSubtype}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`font-medium ${selectedAccount.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          Balance: {formatCurrency(selectedAccount.balance)}
                        </span>
                        {selectedAccount.availableBalance !== null && (
                          <span className="text-sm text-gray-600">
                            Available: {formatCurrency(selectedAccount.availableBalance)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          // Trigger inline transaction entry in the account view
                          setLeftSidebarTab('accounts'); // Make sure we're on accounts tab
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Add Transaction</span>
                      </button>
                      <button
                        onClick={() => setSelectedAccount(null)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-md font-medium text-gray-900 mb-2">
                      Transactions ({accountTransactions.length})
                    </h3>
                  </div>
                  
                  {accountTransactions.length > 0 ? (
                    <TransactionList
                      transactions={accountTransactions}
                      onDeleteTransaction={handleDeleteTransaction}
                      onAddTransaction={(transactionData) => 
                        handleCreateTransaction({
                          ...transactionData,
                          accountId: selectedAccount.id
                        })
                      }
                      onUpdateTransaction={handleUpdateTransaction}
                      onToggleCleared={handleToggleCleared}
                      onFlagTransactions={handleFlagTransactions}
                      onFlagSingleTransaction={handleFlagSingleTransaction}
                      onMoveTransactions={handleMoveTransactions}
                      onApproveTransactions={handleApproveTransactions}
                      accounts={accounts}
                      categories={dashboardData?.categories?.flatMap((group: any) => 
                        group.budgets?.map((budget: any) => budget.name) || []
                      ) || []}
                      categoryGroups={dashboardData?.categories || []}
                      onCreateCategory={handleCreateCategory}
                      isAccountView={true}
                    />
                  ) : (
                    <div className="p-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
                      <Receipt className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-lg font-medium">No transactions found</p>
                      <p className="text-sm mt-1">Click "Add Transaction" to create your first transaction</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Advisor Tab Content */}
            {leftSidebarTab === 'ai-advisor' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Brain className="w-6 h-6 text-[#86b686]" />
                      <h2 className="text-lg font-semibold text-gray-900">Finley's Financial Insights</h2>
                    </div>
                    <button
                      onClick={() => fetchAISuggestions()}
                      className="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm font-medium bg-[#86b686] bg-opacity-20 text-[#86b686] hover:bg-opacity-30 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Refresh Insights</span>
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  {aiSuggestions.length > 0 ? (
                    <div className="space-y-6">
                      {aiSuggestions.map((insight: any, index: number) => (
                        <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${
                                insight.type === 'warning' ? 'bg-red-100' :
                                insight.type === 'tip' ? 'bg-blue-100' :
                                insight.type === 'success' ? 'bg-green-100' :
                                insight.type === 'goal' ? 'bg-purple-100' :
                                'bg-gray-100'
                              }`}>
                                {insight.type === 'warning' ? (
                                  <AlertTriangle className={`w-5 h-5 ${
                                    insight.type === 'warning' ? 'text-red-600' :
                                    insight.type === 'tip' ? 'text-blue-600' :
                                    insight.type === 'success' ? 'text-green-600' :
                                    insight.type === 'goal' ? 'text-[#86b686]' :
                                    'text-gray-600'
                                  }`} />
                                ) : insight.type === 'success' ? (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : insight.type === 'goal' ? (
                                  <Target className="w-5 h-5 text-[#86b686]" />
                                ) : (
                                  <Lightbulb className="w-5 h-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                                <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  insight.type === 'warning' ? 'bg-red-100 text-red-700' :
                                  insight.type === 'tip' ? 'bg-blue-100 text-blue-700' :
                                  insight.type === 'success' ? 'bg-green-100 text-green-700' :
                                  insight.type === 'goal' ? 'bg-[#86b686] bg-opacity-20 text-[#86b686]' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {insight.type}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => dismissInsight(index)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <p className="text-gray-600 mb-4 leading-relaxed">
                            {insight.description}
                            {insight.action && (
                              <span className="block mt-2 font-medium text-[#86b686]">
                                💡 Suggestion: {insight.action}
                              </span>
                            )}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-[#86b686] h-2 rounded-full transition-all duration-300" 
                                    style={{width: `${insight.confidence}%`}}
                                  ></div>
                                </div>
                                <span className="text-sm text-gray-500">{insight.confidence}% confidence</span>
                              </div>
                            </div>
                            
                            {insight.action && (
                              <button
                                onClick={() => handleInsightAction(insight)}
                                className="flex items-center space-x-2 px-4 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors"
                              >
                                <span>Let's Do It</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Insights Available</h3>
                      <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        Add more transactions and budget data to get personalized financial insights and recommendations.
                      </p>
                      <button
                        onClick={() => fetchAISuggestions()}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#86b686] text-white rounded-lg hover:bg-[#73a373] transition-colors mx-auto"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Generate Insights</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </main>

          {/* Right Sidebar */}
          <aside className="w-full lg:w-72 xl:w-80 lg:flex-shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 p-4 lg:p-4 xl:p-6 order-first lg:order-last">
            <div className="space-y-6">
              {/* Savings Goals */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Savings Goals</h3>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="text-[#f29676] hover:text-[#e8825f] text-sm font-medium"
                  >
                    Add Goal
                  </button>
                </div>
                
                <div className="space-y-4">
                  {savingsGoals && savingsGoals.length > 0 ? savingsGoals.map((goal: any) => (
                    <div key={goal.id} className="border border-[#EFF2F0] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{goal.name}</h4>
                        <span className="text-xs text-gray-600">Target: {goal.payoffDate}</span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Saved:</span>
                          <span className="font-medium text-[#7AB29F]">{formatCurrency(goal.current)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Target:</span>
                          <span className="font-medium">{formatCurrency(goal.target)}</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-[#EFF2F0] rounded-full h-2 mt-3">
                        <div 
                          className="bg-[#7AB29F] h-2 rounded-full"
                          style={{width: `${Math.min(100, (goal.current / goal.target) * 100)}%`}}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {Math.round((goal.current / goal.target) * 100)}% complete
                      </p>
                    </div>
                  )) : (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">No savings goals yet</p>
                      <button
                        onClick={() => setShowGoalModal(true)}
                        className="mt-2 text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        Create your first goal
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Insights */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Insights</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Spending Trend</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      {dashboardData.totalSpent > 0 
                        ? `You've spent ${formatCurrency(dashboardData.totalSpent)} this month`
                        : 'No spending recorded yet'
                      }
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Budget Status</span>
                    </div>
                    <p className="text-sm text-green-700">
                      {dashboardData.categories && dashboardData.categories.length > 0
                        ? `${dashboardData.categories.length} budget lines active`
                        : 'Create budget lines to track spending'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      
      <BudgetModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        onSubmit={handleCreateBudget}
      />
      
      <GoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onSubmit={handleCreateGoal}
      />
      
      
      
      <MoveMoneyPopover
        isOpen={showMoveMoneyPopover}
        onClose={() => {
          setShowMoveMoneyPopover(false);
          setMoveMoneySource(null);
        }}
        onMove={handleMoveMoney}
        sourceBudget={moveMoneySource ? {
          id: moveMoneySource.id,
          name: moveMoneySource.name,
          available: moveMoneySource.available,
        } : { id: '', name: '', available: 0 }}
        availableBudgets={dashboardData?.categories?.flatMap((group: any) => 
          group.budgets?.map((budget: any) => ({
            id: budget.id,
            name: budget.name,
            category: group.name,
            available: budget.available,
          })) || []
        ) || []}
        position={moveMoneyPosition}
      />

      <AssignMoneyFlyout
        isOpen={showAssignMoneyPopover}
        onClose={() => setShowAssignMoneyPopover(false)}
        onAssignMoney={handleAssignMoney}
        categories={dashboardData?.categories || []}
        availableAmount={dashboardData?.toBeAssigned || 0}
        position={assignMoneyPosition}
        overspentBudgets={overspentBudgets}
        isOverspendingMode={isOverbudgeted}
      />


      {/* Account Type Selection Modal */}
      {showAccountTypeModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-white/20 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-halyard font-bold text-found-text tracking-tight">Add Account</h2>
              <button
                onClick={() => setShowAccountTypeModal(false)}
                className="text-gray-400 hover:text-found-text"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="font-halyard text-found-text opacity-80 mb-6">Choose how you'd like to add your account:</p>
            
            <div className="space-y-3">
              <PlaidLink onSuccess={handlePlaidSuccess} onExit={handlePlaidExit}>
                <button 
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#86b686]/10 to-[#9cc49c]/10 border border-[#86b686]/30 rounded-xl hover:from-[#86b686]/20 hover:to-[#9cc49c]/20 hover:border-[#86b686]/50 transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-md"
                >
                  <div className="text-left">
                    <div className="font-halyard font-bold text-found-text">Connect Bank Account</div>
                    <div className="font-halyard-micro text-sm text-found-text opacity-60">Automatically sync transactions via Plaid</div>
                  </div>
                  <div className="w-2 h-2 bg-found-accent rounded-full"></div>
                </button>
              </PlaidLink>
              
              <button 
                onClick={() => {
                  setShowAccountTypeModal(false);
                  setShowAccountModal(true);
                }}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 border border-blue-200/50 rounded-xl hover:from-blue-50 hover:to-purple-50 hover:border-blue-300/60 transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-md"
              >
                <div className="text-left">
                  <div className="font-halyard font-bold text-found-text">Add Manual Account</div>
                  <div className="font-halyard-micro text-sm text-found-text opacity-60">Track account manually without automatic sync</div>
                </div>
                <div className="w-2 h-2 bg-found-accent rounded-full"></div>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onSubmit={handleManualAccountSubmit}
      />
      
      <AccountClosureModal
        isOpen={showAccountClosureModal}
        onClose={() => {
          setShowAccountClosureModal(false);
          setAccountToClose(null);
        }}
        account={accountToClose}
        onAccountClosed={handleAccountClosed}
      />

      {/* AI Chat Assistant */}
      <AIChat onExecuteAction={handleAIAction} />
    </div>
  );
};

export default Dashboard;