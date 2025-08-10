// hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { io as ioClient, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { useSWRConfig } from 'swr';

declare global {
  interface Window {
    __socket?: Socket;
    __socketJoinedOnce?: boolean;
  }
}

export function useWebSocket() {
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();
  const listenerAttached = useRef(false);

  // 1) Wake up the API route that initializes the socket server
  useEffect(() => {
    fetch('/api/socket').catch(() => {});
  }, []);

  // 2) Create socket connection only once
  useEffect(() => {
    if (window.__socket) return;

    const s = ioClient('/', {
      path: '/api/socket',
      // If you see flaky connects on Safari/dev proxies, remove this line to allow fallback polling
      transports: ['websocket'],
    });

    s.on('connect', () => {
      console.log('[ws] client connected', s.id);
    });

    window.__socket = s;

    // Don't hard-close the global socket on unmount;
    // let it persist across pages in the SPA.
    return () => {};
  }, []);

  // 3) Join the user room once after we have a socket + user id
  useEffect(() => {
    const s = window.__socket;
    const userId = (session?.user as any)?.id;
    if (!s || !userId || window.__socketJoinedOnce) return;

    const joinRoom = () => {
      if (window.__socketJoinedOnce) return;
      console.log('[ws] join-user-room', userId);
      s.emit('join-user-room', userId);
      window.__socketJoinedOnce = true;
    };

    if (s.connected) {
      joinRoom();
    } else {
      s.once('connect', joinRoom);
    }
  }, [session?.user]);

  // 4) Attach transactions:changed listener once
  useEffect(() => {
    const s = window.__socket;
    if (!s || listenerAttached.current) return;
    listenerAttached.current = true;

    const onChanged = async (payload: { accountId?: string | null; reason?: string }) => {
      console.log('[ws] transactions:changed received', payload);

      // Always refresh all dashboard and transaction data (including month/year variants)
      await Promise.allSettled([
        mutate((key) => typeof key === 'string' && key.startsWith('/api/transactions')),
        mutate((key) => typeof key === 'string' && key.startsWith('/api/dashboard')),
      ]);

      // Refresh account-specific data if accountId provided
      const aid = payload?.accountId ?? null;
      if (aid) {
        await Promise.allSettled([
          mutate((key) => typeof key === 'string' && key.includes(`accountId=${aid}`)),
          // If you also use a tuple key anywhere, this covers it:
          mutate(['/api/transactions', aid]),
        ]);
      }
    };

    s.on('transactions:changed', onChanged);

    return () => {
      try {
        s.off('transactions:changed', onChanged);
      } finally {
        listenerAttached.current = false;
      }
    };
  }, [mutate]);
}