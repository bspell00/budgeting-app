// lib/websocket-server.ts
import { Server as IOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: IOServer | null = null;

/** Initialize a single Socket.IO server instance and cache it across HMR. */
export function initWebSocket(server: HTTPServer): IOServer {
  // Reuse if already created (HMR/dev)
  if (io) return io;
  if ((global as any).__io) {
    io = (global as any).__io as IOServer;
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
  } catch (_) {
    // ignore
  }

  (global as any).__io = io; // persist for HMR
  (global as any).io = io;   // convenient global for emitters
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

/** Broadcast a "calculation-sync" event to a user's room. */
export async function triggerFinancialSync(userId: string) {
  if (!userId) return;
  const existing = io || ((global as any).__io as IOServer | undefined);
  if (!existing) {
    console.warn('[ws] triggerFinancialSync called before IO was ready');
    return;
  }
  const room = `user:${userId}`;
  console.log('[ws] emit calculation-sync →', room);
  existing.to(room).emit('calculation-sync', { ts: Date.now() });
}