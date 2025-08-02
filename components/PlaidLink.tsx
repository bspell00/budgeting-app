import React, { useCallback, useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAccounts } from '../hooks/useAccounts';

interface PlaidLinkProps {
  onSuccess: (token: string, metadata: any) => void;
  onExit?: (err: any, metadata: any) => void;
  children: React.ReactNode;
}

export default function PlaidLink({ onSuccess, onExit, children }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState(null);
  const [shouldOpen, setShouldOpen] = useState(false);
  
  // Use optimistic accounts hook
  const { connectAccountOptimistic } = useAccounts();

  // Create link token
  const createLinkToken = useCallback(async () => {
    try {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
    }
  }, []);

  const config = {
    token: linkToken,
    onSuccess: async (public_token: string, metadata: any) => {
      try {
        console.log('🔗 Plaid Link successful, connecting accounts optimistically...');
        
        // Show optimistic feedback for connecting accounts
        if (metadata.accounts && metadata.accounts.length > 0) {
          for (const account of metadata.accounts) {
            await connectAccountOptimistic({
              accountName: account.name,
              accountType: account.type,
              accountSubtype: account.subtype,
              mask: account.mask,
            });
          }
        }
        
        // Exchange token with server
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ public_token }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to exchange token');
        }
        
        const data = await response.json();
        console.log('✅ Plaid accounts connected successfully');
        onSuccess(data, metadata);
      } catch (error) {
        console.error('❌ Error exchanging token:', error);
      }
    },
    onExit: (err: any, metadata: any) => {
      if (onExit) onExit(err, metadata);
    },
  };

  const { open, ready } = usePlaidLink(config);

  // Auto-open when ready and should open
  useEffect(() => {
    if (ready && shouldOpen) {
      open();
      setShouldOpen(false);
    }
  }, [ready, shouldOpen, open]);

  const handleClick = useCallback(async () => {
    if (!linkToken) {
      await createLinkToken();
      setShouldOpen(true);
    } else if (ready) {
      open();
    }
  }, [linkToken, ready, open, createLinkToken]);

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
}