import React from 'react';
import { X, CreditCard, Building2 } from 'lucide-react';
import PlaidLink from './PlaidLink';

interface AccountTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManualAccount: () => void;
  onPlaidSuccess: (data: any, metadata: any) => void;
  onPlaidExit: (err: any, metadata: any) => void;
}

export default function AccountTypeModal({ 
  isOpen, 
  onClose, 
  onManualAccount, 
  onPlaidSuccess, 
  onPlaidExit 
}: AccountTypeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-white/20 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-halyard font-bold text-found-text tracking-tight">Add Account</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-found-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Plaid Option */}
          <PlaidLink 
            onSuccess={(data, metadata) => {
              console.log('🔗 [AccountTypeModal] Plaid success, triggering callback...');
              onPlaidSuccess(data, metadata);
            }}
            onExit={onPlaidExit}
          >
            <button className="w-full group">
              <div className="flex items-center p-6 rounded-2xl bg-gradient-to-r from-evergreen to-coach-green hover:from-coach-green hover:to-evergreen transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border border-white/10">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm mr-4">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-halyard font-bold text-white">Connect Bank Account</h3>
                  <p className="text-white/80 font-halyard-micro text-sm">
                    Automatically sync transactions from your bank
                  </p>
                </div>
                <div className="text-white/60 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          </PlaidLink>

          {/* Manual Option */}
          <button 
            onClick={() => {
              onManualAccount();
              onClose();
            }}
            className="w-full group"
          >
            <div className="flex items-center p-6 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-gray-200/50">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/60 backdrop-blur-sm mr-4">
                <CreditCard className="w-6 h-6 text-gray-700" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-halyard font-bold text-gray-800">Add Manual Account</h3>
                <p className="text-gray-600 font-halyard-micro text-sm">
                  Create an account and enter transactions manually
                </p>
              </div>
              <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200/50">
          <p className="text-xs text-gray-500 font-halyard-micro text-center">
            Bank connections are secured with 256-bit encryption via Plaid
          </p>
        </div>
      </div>
    </div>
  );
}