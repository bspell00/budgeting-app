-- Create sample accounts and transactions for testing

-- Create sample accounts
INSERT INTO Account (id, userId, plaidAccountId, plaidAccessToken, accountName, accountType, accountSubtype, balance, availableBalance, createdAt, updatedAt) VALUES
('acc-checking-001', 'test-user-123', 'plaid-checking-001', 'access-token-123', 'Main Checking', 'depository', 'checking', 2500.00, 2500.00, datetime('now'), datetime('now')),
('acc-credit-001', 'test-user-123', 'plaid-credit-001', 'access-token-123', 'Chase Sapphire Preferred', 'credit', 'credit_card', -850.00, 4150.00, datetime('now'), datetime('now')),
('acc-savings-001', 'test-user-123', 'plaid-savings-001', 'access-token-123', 'High Yield Savings', 'depository', 'savings', 15000.00, 15000.00, datetime('now'), datetime('now'));

-- Create sample transactions with CORRECT credit card logic
-- Credit card purchases = positive amounts (outflows/spending)
-- Credit card payments = negative amounts (inflows/debt reduction)
-- Bank account spending = negative amounts (outflows)
-- Bank account deposits = positive amounts (inflows)

INSERT INTO "Transaction" (id, userId, accountId, plaidTransactionId, amount, description, category, subcategory, date, createdAt, updatedAt) VALUES

-- Credit Card Transactions (Chase Sapphire)
('txn-001', 'test-user-123', 'acc-credit-001', 'plaid-starbucks-001', 4.50, 'Starbucks Coffee Shop', 'Eating Out', 'Coffee Shops', '2025-07-15', datetime('now'), datetime('now')),
('txn-002', 'test-user-123', 'acc-credit-001', 'plaid-target-001', 85.32, 'Target Store #1234', 'Groceries', 'Supermarkets', '2025-07-14', datetime('now'), datetime('now')),
('txn-003', 'test-user-123', 'acc-credit-001', 'plaid-shell-001', 45.67, 'Shell Gas Station', 'Transportation', 'Gas Stations', '2025-07-12', datetime('now'), datetime('now')),
('txn-004', 'test-user-123', 'acc-credit-001', 'plaid-amazon-001', 32.99, 'Amazon.com Purchase', 'Misc. Needs', 'Online Shopping', '2025-07-11', datetime('now'), datetime('now')),
('txn-005', 'test-user-123', 'acc-credit-001', 'plaid-uber-001', 18.50, 'Uber Trip', 'Transportation', 'Ride Share', '2025-07-10', datetime('now'), datetime('now')),
('txn-006', 'test-user-123', 'acc-credit-001', 'plaid-chipotle-001', 12.75, 'Chipotle Mexican Grill', 'Eating Out', 'Fast Food', '2025-07-09', datetime('now'), datetime('now')),
('txn-007', 'test-user-123', 'acc-credit-001', 'plaid-interest-001', 2.50, 'Interest Charge', 'Interest & Fees', 'Interest', '2025-07-08', datetime('now'), datetime('now')),
('txn-008', 'test-user-123', 'acc-credit-001', 'plaid-payment-001', -150.00, 'Credit Card Payment', 'Credit Card Payment', 'Payment', '2025-07-05', datetime('now'), datetime('now')),
('txn-009', 'test-user-123', 'acc-credit-001', 'plaid-walmart-001', 67.45, 'Walmart Supercenter', 'Groceries', 'Supermarkets', '2025-07-03', datetime('now'), datetime('now')),
('txn-010', 'test-user-123', 'acc-credit-001', 'plaid-netflix-001', 15.99, 'Netflix Subscription', 'Subscriptions', 'Streaming', '2025-07-01', datetime('now'), datetime('now')),

-- Checking Account Transactions  
('txn-011', 'test-user-123', 'acc-checking-001', 'plaid-salary-001', 3000.00, 'Salary Deposit', 'Income', 'Payroll', '2025-07-15', datetime('now'), datetime('now')),
('txn-012', 'test-user-123', 'acc-checking-001', 'plaid-cc-payment-001', -150.00, 'Credit Card Payment - Chase', 'Credit Card Payment', 'Payment', '2025-07-05', datetime('now'), datetime('now')),
('txn-013', 'test-user-123', 'acc-checking-001', 'plaid-mortgage-001', -1200.00, 'Mortgage Payment', 'Mortgage', 'Housing', '2025-07-01', datetime('now'), datetime('now')),
('txn-014', 'test-user-123', 'acc-checking-001', 'plaid-electric-001', -125.50, 'Electric Company', 'Electric', 'Utilities', '2025-07-02', datetime('now'), datetime('now')),
('txn-015', 'test-user-123', 'acc-checking-001', 'plaid-internet-001', -79.99, 'Internet Service Provider', 'Internet', 'Utilities', '2025-07-03', datetime('now'), datetime('now')),
('txn-016', 'test-user-123', 'acc-checking-001', 'plaid-atm-001', -20.00, 'ATM Withdrawal', 'Misc. Needs', 'Cash', '2025-07-04', datetime('now'), datetime('now')),

-- Savings Account Transactions
('txn-017', 'test-user-123', 'acc-savings-001', 'plaid-interest-earn-001', 12.50, 'Interest Earned', 'Income', 'Interest', '2025-07-01', datetime('now'), datetime('now')),
('txn-018', 'test-user-123', 'acc-savings-001', 'plaid-transfer-001', 500.00, 'Transfer from Checking', 'Investments', 'Savings', '2025-07-10', datetime('now'), datetime('now'));

-- Output summary
SELECT 'Accounts Created:' as Summary, COUNT(*) as Count FROM Account;
SELECT 'Transactions Created:' as Summary, COUNT(*) as Count FROM "Transaction";

-- Show transaction breakdown by account type
SELECT 
  a.accountType,
  a.accountName,
  COUNT(t.id) as transaction_count,
  ROUND(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 2) as total_inflows,
  ROUND(SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END), 2) as total_outflows,
  ROUND(SUM(t.amount), 2) as net_amount
FROM Account a
LEFT JOIN "Transaction" t ON a.id = t.accountId
GROUP BY a.id, a.accountType, a.accountName
ORDER BY a.accountType, a.accountName;