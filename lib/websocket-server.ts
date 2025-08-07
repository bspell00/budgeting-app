import { Server } from 'socket.io';
import { NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import prisma from './prisma';

export interface ServerToClientEvents {
  'budget-updated': (data: { budgets: any[], toBeAssigned: number }) => void;
  'transaction-updated': (data: { transactions: any[], accountBalances: Record<string, number> }) => void;
  'account-updated': (data: { accounts: any[], totalBalance: number }) => void;
  'calculation-sync': (data: { accounts: any[], budgets: any[], toBeAssigned: number }) => void;
}

export interface ClientToServerEvents {
  'join-user-room': (userId: string) => void;
  'request-sync': () => void;
}

let io: Server<ClientToServerEvents, ServerToClientEvents> | undefined;

export const initSocket = (res: NextApiResponse) => {
  const server = (res.socket as any)?.server;
  if (!server?.io) {
    console.log('🔌 Initializing Socket.IO server...');
    
    io = new Server(server, {
      path: '/api/socket',
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.NEXTAUTH_URL!, 'https://budgeting-app-staging-29118750c1e6.herokuapp.com']
          : ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST']
      }
    });

    io.on('connection', (socket) => {
      console.log('🔗 Client connected:', socket.id);

      socket.on('join-user-room', (userId) => {
        socket.join(`user:${userId}`);
        console.log(`👤 User ${userId} joined room`);
      });

      socket.on('request-sync', async () => {
        // Force a full data sync for this user
        const rooms = Array.from(socket.rooms);
        const userRoom = rooms.find(room => room.startsWith('user:'));
        
        if (userRoom) {
          const userId = userRoom.replace('user:', '');
          await broadcastFullSync(userId);
        }
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    server.io = io;
    console.log('✅ Socket.IO server initialized');
  } else {
    io = server.io;
  }
  
  return io;
};

export const getSocket = () => io;

/**
 * Broadcast updated data to all clients for a specific user
 */
export const broadcastToUser = (userId: string, event: keyof ServerToClientEvents, data: any) => {
  if (!io) {
    console.warn('⚠️ Socket.IO not initialized, cannot broadcast');
    return;
  }
  
  io.to(`user:${userId}`).emit(event, data);
  console.log(`📡 Broadcasted ${event} to user ${userId}`);
};

/**
 * Calculate and broadcast complete financial sync for a user
 */
export const broadcastFullSync = async (userId: string) => {
  try {
    console.log(`🔄 Full sync requested for user: ${userId}`);
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Get all data in parallel
    const [accounts, budgets, recentTransactions] = await Promise.all([
      // Accounts
      prisma.account.findMany({
        where: { userId },
        orderBy: { accountName: 'asc' }
      }),
      
      // Current month budgets
      prisma.budget.findMany({
        where: {
          userId,
          month: currentMonth,
          year: currentYear,
        },
        orderBy: { name: 'asc' }
      }),
      
      // Recent transactions (last 50)
      prisma.transaction.findMany({
        where: { userId },
        include: {
          account: true,
          budget: true
        },
        orderBy: { date: 'desc' },
        take: 50
      })
    ]);

    // Calculate financial totals
    const cashAccounts = accounts.filter(account => 
      account.accountType === 'depository' || 
      account.accountType === 'investment' ||
      (account.accountType === 'other' && account.balance > 0)
    );
    
    const totalCashBalance = cashAccounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0);
    const allBudgetsExceptTBA = budgets.filter(budget => budget.name !== 'To Be Assigned');
    const totalBudgetedByUser = allBudgetsExceptTBA.reduce((sum, budget) => sum + budget.amount, 0);
    const correctToBeAssigned = totalCashBalance - totalBudgetedByUser;

    // Update "To Be Assigned" budget if needed
    const toBeAssignedBudget = budgets.find(budget => budget.name === 'To Be Assigned');
    if (toBeAssignedBudget && Math.abs(toBeAssignedBudget.amount - correctToBeAssigned) > 0.01) {
      await prisma.budget.update({
        where: { id: toBeAssignedBudget.id },
        data: { amount: correctToBeAssigned }
      });
      // Update local array for broadcast
      toBeAssignedBudget.amount = correctToBeAssigned;
    }

    // Create account balance map
    const accountBalances = accounts.reduce((acc, account) => {
      acc[account.id] = account.balance;
      return acc;
    }, {} as Record<string, number>);

    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

    // Broadcast complete sync
    broadcastToUser(userId, 'calculation-sync', {
      accounts,
      budgets,
      toBeAssigned: correctToBeAssigned
    });

    console.log(`✅ Full sync completed for user ${userId}`);
    console.log(`💰 Cash: $${totalCashBalance}, Budgeted: $${totalBudgetedByUser}, To Be Assigned: $${correctToBeAssigned}`);

  } catch (error) {
    console.error('❌ Full sync failed:', error);
  }
};

/**
 * Trigger updates after financial changes
 */
export const triggerFinancialSync = async (userId: string) => {
  await broadcastFullSync(userId);
};