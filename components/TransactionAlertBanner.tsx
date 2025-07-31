import React from 'react';
import { AlertTriangle, Clock, Tag, ChevronRight } from 'lucide-react';

interface AlertTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  account: { accountName: string };
}

interface TransactionAlertBannerProps {
  unapprovedTransactions: AlertTransaction[];
  uncategorizedTransactions: AlertTransaction[];
  onViewUnapproved: () => void;
  onViewUncategorized: () => void;
}

export default function TransactionAlertBanner({ 
  unapprovedTransactions, 
  uncategorizedTransactions, 
  onViewUnapproved,
  onViewUncategorized 
}: TransactionAlertBannerProps) {
  const hasUnapproved = unapprovedTransactions.length > 0;
  const hasUncategorized = uncategorizedTransactions.length > 0;

  // Don't show banner if no issues
  if (!hasUnapproved && !hasUncategorized) {
    return null;
  }

  const totalIssues = unapprovedTransactions.length + uncategorizedTransactions.length;

  return (
    <div className="bg-last-lettuce text-teal-midnight p-3 mb-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex items-center space-x-4">
            <span className="font-medium">
              {totalIssues} transaction{totalIssues !== 1 ? 's' : ''} need attention
            </span>
            <div className="flex items-center space-x-2 text-sm opacity-90">
              {hasUnapproved && (
                <span className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{unapprovedTransactions.length} unapproved</span>
                </span>
              )}
              {hasUncategorized && (
                <span className="flex items-center space-x-1">
                  <Tag className="w-4 h-4" />
                  <span>{uncategorizedTransactions.length} uncategorized</span>
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasUnapproved && (
            <button
              onClick={onViewUnapproved}
              className="flex items-center space-x-1 text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
            >
              <span>Review</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          {hasUncategorized && (
            <button
              onClick={onViewUncategorized}
              className="flex items-center space-x-1 text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
            >
              <span>Categorize</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}