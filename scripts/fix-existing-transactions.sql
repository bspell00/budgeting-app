-- Fix existing credit card transactions with proper amounts and categories

-- First, let's update credit card transactions to have proper amounts
-- Credit card purchases should be positive (outflows)
-- Credit card payments should be negative (inflows)

-- Fix credit card purchases (non-payments) that have negative amounts
UPDATE "Transaction" SET 
  amount = ABS(amount)
WHERE id IN (
  SELECT t.id 
  FROM "Transaction" t 
  JOIN Account a ON t.accountId = a.id 
  WHERE a.accountType = 'credit' 
    AND t.amount < 0 
    AND t.category != 'Credit Card Payment'
);

-- Fix credit card payments that have positive amounts
UPDATE "Transaction" SET 
  amount = -ABS(amount)
WHERE id IN (
  SELECT t.id 
  FROM "Transaction" t 
  JOIN Account a ON t.accountId = a.id 
  WHERE a.accountType = 'credit' 
    AND t.amount > 0 
    AND t.category = 'Credit Card Payment'
);

-- Fix categorization for common merchants
UPDATE "Transaction" SET category = 'Eating Out' 
WHERE category = 'Other' AND (
  LOWER(description) LIKE '%starbucks%' OR
  LOWER(description) LIKE '%mcdonalds%' OR
  LOWER(description) LIKE '%restaurant%' OR
  LOWER(description) LIKE '%cafe%' OR
  LOWER(description) LIKE '%pizza%'
);

UPDATE "Transaction" SET category = 'Groceries' 
WHERE category = 'Other' AND (
  LOWER(description) LIKE '%target%' OR
  LOWER(description) LIKE '%walmart%' OR
  LOWER(description) LIKE '%kroger%' OR
  LOWER(description) LIKE '%grocery%' OR
  LOWER(description) LIKE '%supermarket%'
);

UPDATE "Transaction" SET category = 'Transportation' 
WHERE category = 'Other' AND (
  LOWER(description) LIKE '%shell%' OR
  LOWER(description) LIKE '%exxon%' OR
  LOWER(description) LIKE '%chevron%' OR
  LOWER(description) LIKE '%gas%' OR
  LOWER(description) LIKE '%uber%' OR
  LOWER(description) LIKE '%lyft%'
);

UPDATE "Transaction" SET category = 'Monthly Bills' 
WHERE category = 'Other' AND (
  LOWER(description) LIKE '%electric%' OR
  LOWER(description) LIKE '%internet%' OR
  LOWER(description) LIKE '%phone%' OR
  LOWER(description) LIKE '%utility%' OR
  LOWER(description) LIKE '%insurance%'
);

-- Fix any interest charges
UPDATE "Transaction" SET category = 'Interest & Fees' 
WHERE (
  LOWER(description) LIKE '%interest%' OR
  LOWER(description) LIKE '%fee%' OR
  LOWER(description) LIKE '%charge%'
) AND category != 'Credit Card Payment';

-- Fix income transactions
UPDATE "Transaction" SET category = 'Income' 
WHERE (
  LOWER(description) LIKE '%salary%' OR
  LOWER(description) LIKE '%payroll%' OR
  LOWER(description) LIKE '%deposit%' OR
  LOWER(description) LIKE '%income%'
) AND amount > 0;

-- Set proper categories for transfers and payments
UPDATE "Transaction" SET category = 'Credit Card Payment'
WHERE (
  LOWER(description) LIKE '%payment%' AND
  LOWER(description) LIKE '%credit%'
) OR (
  LOWER(description) LIKE '%autopay%'
);

UPDATE "Transaction" SET category = 'Mortgage'
WHERE LOWER(description) LIKE '%mortgage%';

-- Output summary of changes
SELECT 
  'Summary of Transaction Fixes' as Status,
  COUNT(*) as Total_Transactions
FROM "Transaction";

SELECT 
  category,
  COUNT(*) as count,
  ROUND(AVG(amount), 2) as avg_amount,
  ROUND(SUM(amount), 2) as total_amount
FROM "Transaction" t
JOIN Account a ON t.accountId = a.id
GROUP BY category
ORDER BY category;