import React from 'react';
import { X, Check } from 'lucide-react';

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  balance?: number;
}

interface AccountSelectionFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (accountId: string) => void;
  accounts: Account[];
  currentAccountId?: string;
  position: { top: number; left: number };
}

export default function AccountSelectionFlyout({
  isOpen,
  onClose,
  onSelectAccount,
  accounts,
  currentAccountId,
  position
}: AccountSelectionFlyoutProps) {
  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getAccountTypeColor = (accountType: string) => {
    switch (accountType.toLowerCase()) {
      case 'credit':
        return 'bg-red-100 text-red-800';
      case 'checking':
        return 'bg-blue-100 text-blue-800';
      case 'savings':
        return 'bg-green-100 text-green-800';
      case 'investment':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      
      {/* Flyout */}
      <div 
        className="fixed z-50 bg-found-surface border border-found-divider rounded-lg shadow-xl"
        style={{
          top: position.top,
          left: position.left,
          minWidth: '320px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-found-divider">
          <h3 className="text-lg font-semibold text-found-text">Select Account</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-found-text hover:bg-found-divider rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account List */}
        <div className="py-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                onSelectAccount(account.id);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-found-divider transition-colors flex items-center justify-between group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-found-text truncate">
                        {account.accountName}
                      </span>
                      {currentAccountId === account.id && (
                        <Check className="w-4 h-4 text-found-accent flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(account.accountType)}`}>
                        {account.accountType}
                      </span>
                      {account.balance !== undefined && (
                        <span className="text-sm text-found-text opacity-60">
                          {formatCurrency(account.balance)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="p-8 text-center text-found-text opacity-60">
            <p>No accounts available</p>
            <p className="text-sm mt-1">Connect a bank account to get started</p>
          </div>
        )}
      </div>
    </>
  );
}