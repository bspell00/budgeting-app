import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAccounts } from '../hooks/useAccounts';

interface PlaidLinkProps {
  onSuccess: (token: string, metadata: any) => void;
  onExit?: (err: any, metadata: any) => void;
  children: React.ReactNode;
}

export default function PlaidLink({ onSuccess, onExit, children }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shouldOpen, setShouldOpen] = useState(false);

  const fetchingRef = useRef(false);   // avoid multiple token requests
  const openedRef = useRef(false);     // avoid double open
  const destroyedRef = useRef(false);  // mark if handler was destroyed

  const { connectAccountOptimistic } = useAccounts();

  const createLinkToken = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
      if (!res.ok) throw new Error('create-link-token failed');
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error creating link token:', err);
      setShouldOpen(false);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Build config ONLY when we actually have a token
  const config = useMemo(() => {
    if (!linkToken) return null;
    return {
      token: linkToken,
      onSuccess: async (public_token: string, metadata: any) => {
        try {
          if (Array.isArray(metadata?.accounts)) {
            for (const account of metadata.accounts) {
              await connectAccountOptimistic({
                accountName: account.name,
                accountType: account.type,
                accountSubtype: account.subtype,
                mask: account.mask,
              });
            }
          }
          const resp = await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              public_token,
              institution: metadata?.institution?.name,
            }),
          });
          if (!resp.ok) throw new Error('Failed to exchange token');
          const data = await resp.json();
          onSuccess(data, metadata);
        } catch (err) {
          console.error('❌ Error exchanging token:', err);
        } finally {
          openedRef.current = false;     // allow a future open
          // If you want a fresh token for each flow, uncomment:
          // setLinkToken(null);
        }
      },
      onExit: (err: any, metadata: any) => {
        openedRef.current = false;
        setShouldOpen(false);
        onExit?.(err, metadata);
      },
      onEvent: () => {},
    };
  }, [linkToken, connectAccountOptimistic, onSuccess, onExit]);

  // Call hook with real config only after token exists
  const { open, ready } = usePlaidLink(config ?? ({} as any));

  // Open exactly once when ready & requested
  useEffect(() => {
    if (ready && shouldOpen && !openedRef.current && !destroyedRef.current) {
      openedRef.current = true;
      open();
      setShouldOpen(false);
    }
  }, [ready, shouldOpen, open]);

  // Hard cleanup: mark as destroyed on unmount/HMR
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      openedRef.current = false;
      fetchingRef.current = false;
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (openedRef.current) return;     // debounce rapid clicks
    if (!linkToken) {
      await createLinkToken();
      setShouldOpen(true);
      return;
    }
    if (ready && !destroyedRef.current) {
      openedRef.current = true;
      open();
    } else {
      setShouldOpen(true);
    }
  }, [linkToken, ready, open, createLinkToken]);

  return <div onClick={handleClick}>{children}</div>;
}
