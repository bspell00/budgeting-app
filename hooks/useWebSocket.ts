import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { mutate } from 'swr';

interface WebSocketData {
  accounts?: any[];
  budgets?: any[];
  transactions?: any[];
  toBeAssigned?: number;
  accountBalances?: Record<string, number>;
  totalBalance?: number;
}

interface UseWebSocketReturn {
  connected: boolean;
  requestSync: () => void;
  triggerUpdate: (type: 'budget' | 'transaction' | 'account') => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const userId = (session?.user as any)?.id;

  useEffect(() => {
    if (!userId) return;

    // Initialize socket connection
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXTAUTH_URL || ''
      : 'http://localhost:3001';

    const socket = io(socketUrl, {
      path: '/api/socket',
      transports: ['polling', 'websocket'], // Fallback for production
      upgrade: true,
      rememberUpgrade: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setConnected(true);
      
      // Join user-specific room
      socket.emit('join-user-room', userId);
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setConnected(false);
    });

    // Listen for budget updates
    socket.on('budget-updated', (data) => {
      console.log('📊 Budget update received:', data);
      
      // Update SWR cache with new budget data
      mutate('/api/dashboard', (currentData: any) => {
        if (!currentData) return currentData;
        
        return {
          ...currentData,
          categories: data.budgets,
          toBeAssigned: data.toBeAssigned
        };
      }, false);
      
      mutate('/api/budgets', data.budgets, false);
    });

    // Listen for transaction updates
    socket.on('transaction-updated', (data) => {
      console.log('💳 Transaction update received:', data);
      
      // Update all transaction caches
      mutate('/api/transactions', { transactions: data.transactions }, false);
      mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions'), 
        { transactions: data.transactions }, false);
      
      // Update account balances in dashboard
      mutate('/api/dashboard', (currentData: any) => {
        if (!currentData) return currentData;
        
        return {
          ...currentData,
          accountBalances: data.accountBalances
        };
      }, false);
    });

    // Listen for account updates
    socket.on('account-updated', (data) => {
      console.log('🏦 Account update received:', data);
      
      mutate('/api/accounts', data.accounts, false);
      mutate('/api/dashboard', (currentData: any) => {
        if (!currentData) return currentData;
        
        return {
          ...currentData,
          totalBalance: data.totalBalance
        };
      }, false);
    });

    // Listen for complete sync (most important)
    socket.on('calculation-sync', (data) => {
      console.log('🔄 Full calculation sync received:', data);
      
      // Update all caches simultaneously for perfect consistency
      const dashboardData = {
        accounts: data.accounts,
        categories: formatBudgetCategories(data.budgets),
        toBeAssigned: data.toBeAssigned,
        totalBalance: data.accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0),
        totalCashBalance: data.accounts
          .filter((acc: any) => acc.accountType === 'depository' || acc.accountType === 'investment' || (acc.accountType === 'other' && acc.balance > 0))
          .reduce((sum: number, acc: any) => sum + Math.max(0, acc.balance), 0),
        totalBudgeted: data.budgets.reduce((sum: number, budget: any) => sum + (budget.name !== 'To Be Assigned' ? budget.amount : 0), 0),
        totalSpent: data.budgets.reduce((sum: number, budget: any) => sum + budget.spent, 0)
      };

      // Atomic update of all related caches
      mutate('/api/dashboard', dashboardData, false);
      mutate('/api/accounts', data.accounts, false);
      mutate('/api/budgets', data.budgets, false);
      
      console.log('✅ All caches updated synchronously');
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const requestSync = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request-sync');
      console.log('🔄 Manual sync requested');
    }
  };

  const triggerUpdate = (type: 'budget' | 'transaction' | 'account') => {
    // For immediate user feedback, we'll trigger sync after any update
    setTimeout(requestSync, 50); // Small delay to ensure server processing
  };

  return {
    connected,
    requestSync,
    triggerUpdate
  };
};

// Helper function to format budgets into categories for dashboard
const formatBudgetCategories = (budgets: any[]) => {
  const budgetsByCategory = budgets.reduce((acc, budget) => {
    // Skip "To Be Assigned" - it's handled separately
    if (budget.name === 'To Be Assigned') {
      return acc;
    }
    
    // Normalize credit card categories
    let categoryGroup = budget.category || 'Misc';
    if (categoryGroup === 'Credit Card Payment' || 
        categoryGroup.startsWith('Credit Card Payments:') ||
        categoryGroup.includes('Credit Card')) {
      categoryGroup = 'Credit Card Payments';
    }
    
    if (!acc[categoryGroup]) {
      acc[categoryGroup] = [];
    }
    
    acc[categoryGroup].push({
      id: budget.id,
      name: budget.name,
      budgeted: budget.amount,
      spent: budget.spent,
      available: budget.amount - budget.spent,
      status: budget.spent > budget.amount ? 'overspent' : 'on-track',
    });
    
    return acc;
  }, {} as { [key: string]: any[] });

  return Object.entries(budgetsByCategory)
    .map((entry) => {
      const [categoryName, budgetItems] = entry;
      const items = budgetItems as any[];
      return {
        id: categoryName.toLowerCase().replace(/\s+/g, '-'),
        name: categoryName,
        category: categoryName,
        budgets: items,
        totalBudgeted: items.reduce((sum: number, item: any) => sum + item.budgeted, 0),
        totalSpent: items.reduce((sum: number, item: any) => sum + item.spent, 0),
        totalAvailable: items.reduce((sum: number, item: any) => sum + item.available, 0),
      };
    })
    .sort((a, b) => {
      if (a.name === 'Credit Card Payments') return -1;
      if (b.name === 'Credit Card Payments') return 1;
      return a.name.localeCompare(b.name);
    });
};