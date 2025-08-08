import { useEffect } from 'react';
import { io as ioClient, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { useSWRConfig } from 'swr';

declare global { interface Window { __socket?: Socket } }

export function useWebSocket() {
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();

  // Wake the server route
  useEffect(() => {
    fetch('/api/socket')
      .then(() => console.log('[ws] /api/socket woke'))
      .catch(e => console.warn('[ws] wake failed', e));
  }, []);

  // Connect once
  useEffect(() => {
    if (window.__socket) return;

    const socket = ioClient('', {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      timeout: 10000,
    });
    window.__socket = socket;

    socket.on('connect', () => {
      console.log('[ws] client connected', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ws] connect_error', err?.message || err);
    });

    socket.on('reconnect_attempt', (n) => console.log('[ws] reconnect_attempt', n));
    socket.on('reconnect_error', (e) => console.log('[ws] reconnect_error', e?.message || e));
    socket.on('reconnect', (n) => console.log('[ws] reconnect', n));

    socket.on('calculation-sync', async () => {
      console.log('[ws] calculation-sync received → refetching');
      await Promise.allSettled([
        mutate('/api/accounts'),
        mutate('/api/transactions'),
        mutate('/api/dashboard'),
      ]);
    });
  }, [mutate]);

  // Join the user room once we have an id
  useEffect(() => {
    const id = (session?.user as any)?.id;
    if (window.__socket && id) {
      console.log('[ws] join-user-room', id);
      window.__socket.emit('join-user-room', id);
    }
  }, [session?.user]);
}