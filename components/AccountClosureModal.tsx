import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, DollarSign, CreditCard } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useTransactions } from '../hooks/useTransactions';

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  balance: number;
  availableBalance: number | null;
}

interface AccountClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onAccountClosed: () => void;
}

const AccountClosureModal: React.FC<AccountClosureModalProps> = ({
  isOpen,
  onClose,
  account,
  onAccountClosed
}) => {
  const [loading, setLoading] = useState(false);
  
  // Use optimistic hooks
  const { deleteAccountOptimistic } = useAccounts();
  const { createTransactionOptimistic } = useTransactions();

  const handleManualAdjustment = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      const adjustmentAmount = -account.balance; // Amount needed to zero out the account
      const isInflow = adjustmentAmount > 0; // Positive amount means money coming in (inflow)
      
      // Use optimistic transaction creation
      await createTransactionOptimistic({
        accountId: account.id,
        amount: adjustmentAmount, // Keep the sign - positive for inflow, negative for outflow
        description: 'Reconciliation Balance Adjustment',
        payee: 'Reconciliation Balance Adjustment',
        category: isInflow ? 'Inflow: Ready to Assign' : 'Outflow', // Match YNAB categories
        date: new Date().toISOString(),
        isManual: true,
        cleared: true
      });
      
      // After adjustment, close the account (skip balance check since we just adjusted it)
      await handleCloseAccountWithSkip();
    } catch (error) {
      console.error('Error creating adjustment:', error);
      alert(`Failed to create balance adjustment: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      // Use optimistic account deletion
      await deleteAccountOptimistic(account.id);
      onAccountClosed();
      onClose();
    } catch (error: any) {
      console.error('Error closing account:', error);
      if (error.message?.includes('reconciliation') || error.message?.includes('balance')) {
        alert(error.message || 'Account must have $0 balance before closing.');
      } else {
        alert(`Failed to close account: ${error.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAccountWithSkip = async () => {
    if (!account) return;
    
    try {
      // Use optimistic account deletion with skip balance check
      await deleteAccountOptimistic(account.id);
      onAccountClosed();
      onClose();
    } catch (error) {
      console.error('Error closing account after adjustment:', error);
      alert('Failed to close account. Please try again.');
      throw error; // Re-throw so the loading state gets cleared properly
    }
  };

  if (!isOpen || !account) return null;

  const balance = account.balance;
  const hasBalance = Math.abs(balance) > 0.01;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate mr-2">
            Close Account: {account.accountName}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-4 sm:p-6">
          {/* Current Balance Display */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Current Balance:</span>
              <span className={`font-semibold ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                ${Math.abs(balance).toFixed(2)} {balance < 0 ? '(debt)' : balance > 0 ? '(credit)' : ''}
              </span>
            </div>
          </div>

          {/* Balance Warning or Ready Status */}
          {hasBalance ? (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 mb-2">Account Must Have $0 Balance</p>
                <p className="text-yellow-700 text-sm mb-4">
                  To close this account, an adjustment will be made in the amount of ${Math.abs(balance).toFixed(2)}.
                </p>
                
                {/* Manual Adjustment Option */}
                <div className="space-y-3">
                  <button
                    onClick={handleManualAdjustment}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#aed274] text-white rounded-lg hover:bg-[#9bc267] disabled:opacity-50 transition-colors min-h-[44px] text-sm sm:text-base"
                  >
                    <DollarSign size={18} />
                    {loading ? 'Adjusting & Closing...' : `Adjust to $0 & Close Account`}
                  </button>
                  
                  <p className="text-xs text-gray-600 text-center">
                    This will add a {balance > 0 ? 'withdrawal' : 'deposit'} of ${Math.abs(balance).toFixed(2)} and immediately close the account.
                  </p>
                  
                  <p className="text-xs text-yellow-700 text-center">
                    Or manually reconcile the account first, then try closing again.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="text-green-600" size={20} />
              <div>
                <p className="font-medium text-green-800">Account Ready to Close</p>
                <p className="text-green-700 text-sm">
                  Balance is $0. This account can be safely closed.
                </p>
              </div>
            </div>
          )}

          {/* What Happens When Closing */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">What happens when closing:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Account will be marked as "(Closed)"</li>
              <li>• All transaction history is preserved</li>
              <li>• No new transactions can be added</li>
              <li>• Account appears in reports as closed</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center p-4 sm:p-6 border-t bg-gray-50 space-y-3 sm:space-y-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          
          {!hasBalance && (
            <button
              onClick={handleCloseAccount}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 w-full sm:w-auto min-h-[44px]"
            >
              <X size={16} />
              {loading ? 'Closing Account...' : 'Close Account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountClosureModal;