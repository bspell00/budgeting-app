// lib/websocket-server.ts
import { Server as IOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: IOServer | null = null;

// TS globals so you can read/write these without errors
declare global {
  // eslint-disable-next-line no-var
  var __io: IOServer | undefined;
  // eslint-disable-next-line no-var
  var triggerFinancialSync:
    | ((userId: string, payload?: TxnChangePayload) => Promise<void>)
    | undefined;
}

type TxnChangePayload = {
  accountId?: string | null;
  reason?: 'create' | 'update' | 'delete' | 'recat' | 'import' | 'sync';
};

/** Initialize a single Socket.IO server instance and cache it across HMR. */
export function initWebSocket(server: HTTPServer): IOServer {
  // Reuse if already created (HMR/dev)
  if (io) return io;
  if (global.__io) {
    io = global.__io;
    return io;
  }

  io = new IOServer(server, {
    path: '/api/socket',
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://budgeting-app-staging-29118750c1e6.herokuapp.com',
        'https://budgeting-app-production-161abe3ba542.herokuapp.com',
        'https://aamoney.co',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // attach engine error hook once
  try {
    const engine: any = (io as any).engine;
    if (engine?.on && !(global as any).__ioEngineHooked) {
      engine.on('connection_error', (err: any) => {
        console.warn('[ws] engine connection_error', { code: err.code, message: err.message });
      });
      (global as any).__ioEngineHooked = true;
    }
  } catch {
    /* ignore */
  }

  global.__io = io;           // persist for HMR
  (global as any).io = io;     // (optional) convenience for manual emits

  console.log('[ws] Socket.IO initialized');

  io.on('connection', (socket) => {
    console.log('[ws] connected', socket.id);

    socket.on('join-user-room', (userId: string) => {
      if (!userId) return;
      const room = `user:${userId}`;
      socket.join(room);
      console.log('[ws] join', { socket: socket.id, room });
    });

    socket.on('disconnect', (reason) => {
      console.log('[ws] disconnected', socket.id, reason);
    });
  });

  return io;
}

/** Broadcast a "transactions:changed" event to a user's room. */
export async function triggerFinancialSync(
  userId: string,
  payload: TxnChangePayload = {}
) {
  if (!userId) return;
  const existing = global.__io || io;
  if (!existing) {
    console.warn('[ws] triggerFinancialSync called before IO was ready');
    return;
  }
  const room = `user:${userId}`;
  console.log('[ws] emit transactions:changed →', room, payload);
  existing.to(room).emit('transactions:changed', { ts: Date.now(), ...payload });
}

// 🔴 make the trigger discoverable from any API route (no require needed)
global.triggerFinancialSync = triggerFinancialSync;