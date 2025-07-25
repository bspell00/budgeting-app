import React, { useState, useMemo } from 'react';
import { Search, User, CreditCard, X, ArrowRightLeft } from 'lucide-react';

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  balance?: number;
}

interface PayeeSelectionFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPayee: (payeeName: string) => void;
  existingPayees: string[];
  accounts: Account[];
  currentPayee?: string;
  position: { top: number; left: number };
  currentAccountId?: string; // The account this transaction is being created in
}

export default function PayeeSelectionFlyout({
  isOpen,
  onClose,
  onSelectPayee,
  existingPayees,
  accounts,
  currentPayee = '',
  position,
  currentAccountId
}: PayeeSelectionFlyoutProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Generate transfer options for credit cards
  const transferOptions = useMemo(() => {
    if (!currentAccountId) return [];
    
    const currentAccount = accounts.find(acc => acc.id === currentAccountId);
    if (!currentAccount) return [];
    
    // Get credit card accounts (excluding current account)
    const creditCards = accounts.filter(acc => 
      acc.accountType === 'credit' && acc.id !== currentAccountId
    );
    
    // Generate transfer options - always show as "Payment: [Credit Card Name]"
    return creditCards.map(creditCard => {
      return `Payment: ${creditCard.accountName}`;
    });
  }, [accounts, currentAccountId]);

  // Filter payees based on search term
  const filteredPayees = useMemo(() => {
    const allPayees = [...existingPayees, ...transferOptions];
    if (!searchTerm.trim()) return allPayees;
    
    return allPayees.filter(payee =>
      payee.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [existingPayees, transferOptions, searchTerm]);

  // Group payees
  const groupedPayees = useMemo(() => {
    const transfers: string[] = [];
    const regular: string[] = [];
    
    filteredPayees.forEach(payee => {
      if (payee.startsWith('Payment:')) {
        transfers.push(payee);
      } else {
        regular.push(payee);
      }
    });
    
    return { transfers, regular };
  }, [filteredPayees]);

  // Early return AFTER all hooks have been called
  if (!isOpen) return null;

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
          width: '350px',
          maxHeight: '400px',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-found-divider">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-found-text">Select Payee</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-found-divider rounded transition-colors"
            >
              <X className="w-4 h-4 text-found-text" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search or type new payee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-found-divider rounded-md focus:outline-none focus:ring-2 focus:ring-found-primary focus:border-found-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  onSelectPayee(searchTerm.trim());
                  onClose();
                }
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-64 overflow-y-auto">
          {/* Transfer Options */}
          {groupedPayees.transfers.length > 0 && (
            <div className="border-b border-found-divider">
              <div className="px-4 py-2 bg-found-divider/30">
                <div className="flex items-center space-x-2">
                  <ArrowRightLeft className="w-4 h-4 text-found-primary" />
                  <span className="text-sm font-medium text-found-text">Credit Card Payments</span>
                </div>
              </div>
              {groupedPayees.transfers.map((payee) => (
                <button
                  key={payee}
                  onClick={() => {
                    onSelectPayee(payee);
                    onClose();
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-found-primary/10 transition-colors flex items-center space-x-3 ${
                    payee === currentPayee ? 'bg-found-primary/20 border-r-4 border-found-primary' : ''
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-found-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-found-text truncate">{payee}</div>
                  </div>
                  {payee === currentPayee && (
                    <div className="w-2 h-2 bg-found-primary rounded-full flex-shrink-0"></div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Regular Payees */}
          {groupedPayees.regular.length > 0 && (
            <div>
              {groupedPayees.transfers.length > 0 && (
                <div className="px-4 py-2 bg-found-divider/30">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-found-primary" />
                    <span className="text-sm font-medium text-found-text">Recent Payees</span>
                  </div>
                </div>
              )}
              {groupedPayees.regular.map((payee) => (
                <button
                  key={payee}
                  onClick={() => {
                    onSelectPayee(payee);
                    onClose();
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-found-primary/10 transition-colors flex items-center space-x-3 ${
                    payee === currentPayee ? 'bg-found-primary/20 border-r-4 border-found-primary' : ''
                  }`}
                >
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-found-text truncate">{payee}</div>
                  </div>
                  {payee === currentPayee && (
                    <div className="w-2 h-2 bg-found-primary rounded-full flex-shrink-0"></div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* New Payee Option */}
          {searchTerm.trim() && !filteredPayees.includes(searchTerm.trim()) && (
            <div className="border-t border-found-divider">
              <button
                onClick={() => {
                  onSelectPayee(searchTerm.trim());
                  onClose();
                }}
                className="w-full px-4 py-3 text-left hover:bg-found-primary/10 transition-colors flex items-center space-x-3"
              >
                <div className="w-4 h-4 border border-dashed border-found-primary rounded flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-found-text">
                    Create new payee: <span className="font-medium">"{searchTerm.trim()}"</span>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredPayees.length === 0 && !searchTerm.trim() && (
            <div className="p-8 text-center text-gray-500">
              <User className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p>No payees yet</p>
              <p className="text-sm">Start typing to create a new payee</p>
            </div>
          )}

          {filteredPayees.length === 0 && searchTerm.trim() && (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p>No payees found</p>
              <p className="text-sm">Press Enter to create "{searchTerm.trim()}"</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}