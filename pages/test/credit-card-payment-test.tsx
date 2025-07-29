import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import CreditCardPaymentModal from '../../components/CreditCardPaymentModal';

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  balance: number;
}

export default function CreditCardPaymentTest() {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    if (session) {
      fetchAccounts();
    }
  }, [session]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
        addTestResult(`✅ Loaded ${data.length} accounts`);
      }
    } catch (error) {
      addTestResult(`❌ Failed to load accounts: ${error}`);
    }
  };

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testCreditCardPaymentAPI = async () => {
    const checkingAccount = accounts.find(acc => 
      ['checking', 'savings', 'depository'].includes(acc.accountType.toLowerCase())
    );
    const creditCardAccount = accounts.find(acc => 
      ['credit', 'credit_card'].includes(acc.accountType.toLowerCase())
    );

    if (!checkingAccount || !creditCardAccount) {
      addTestResult('❌ Need both a checking account and credit card account for testing');
      return;
    }

    try {
      const response = await fetch('/api/transactions/credit-card-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAccountId: checkingAccount.id,
          toAccountId: creditCardAccount.id,
          amount: 100.00,
          date: new Date().toISOString().split('T')[0]
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addTestResult('✅ Credit card payment API successful');
        addTestResult(`   Outflow: "${data.transactions.outflowTransaction.description}"`);
        addTestResult(`   Inflow: "${data.transactions.inflowTransaction.description}"`);
        
        // Refresh accounts to see balance changes
        fetchAccounts();
      } else {
        addTestResult(`❌ API failed: ${data.error}`);
      }
    } catch (error) {
      addTestResult(`❌ API error: ${error}`);
    }
  };

  const testTransactionEditing = async () => {
    try {
      const response = await fetch('/api/transactions');
      if (response.ok) {
        const transactions = await response.json();
        const testTransaction = transactions[0];
        
        if (testTransaction) {
          // Test editing amount (both positive and negative)
          const editResponse = await fetch(`/api/transactions?id=${testTransaction.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: testTransaction.amount > 0 ? -50.00 : 50.00
            }),
          });

          if (editResponse.ok) {
            addTestResult('✅ Transaction amount editing works for both inflow/outflow');
          } else {
            const error = await editResponse.json();
            addTestResult(`❌ Transaction editing failed: ${error.error}`);
          }
        } else {
          addTestResult('❌ No transactions available for testing');
        }
      }
    } catch (error) {
      addTestResult(`❌ Transaction editing test failed: ${error}`);
    }
  };

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return <div className="p-8">Please sign in to test credit card payments</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Credit Card Payment Test</h1>

      {/* Account Summary */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Connected Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white border rounded-lg p-4">
              <div className="font-medium">{account.accountName}</div>
              <div className="text-sm text-gray-600 capitalize">{account.accountType}</div>
              <div className={`text-lg font-bold ${account.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${account.balance.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Buttons */}
      <div className="mb-6 space-y-3">
        <h2 className="text-lg font-semibold">Tests</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Payment Modal
          </button>
          <button
            onClick={testCreditCardPaymentAPI}
            className="px-4 py-2 text-white rounded transition-colors"
            style={{ backgroundColor: '#aed274' }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#9bc267'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#aed274'}
          >
            Test Payment API
          </button>
          <button
            onClick={testTransactionEditing}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Test Transaction Editing
          </button>
          <button
            onClick={() => setTestResults([])}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Test Results */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Test Results</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {testResults.length === 0 ? (
            <div className="text-gray-500">No test results yet...</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <CreditCardPaymentModal
          accounts={accounts}
          onClose={() => setShowPaymentModal(false)}
          onPaymentCreated={() => {
            addTestResult('✅ Payment created via modal');
            fetchAccounts();
          }}
        />
      )}
    </div>
  );
}