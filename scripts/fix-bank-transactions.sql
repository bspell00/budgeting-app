-- Fix bank account transactions that have incorrect amounts based on their categories

-- For bank accounts (depository), spending should be negative, income should be positive
-- Airlines, travel, transportation spending should be negative outflows
UPDATE "Transaction" SET amount = -ABS(amount)
WHERE id IN (
  SELECT t.id 
  FROM "Transaction" t 
  JOIN Account a ON t.accountId = a.id 
  WHERE a.accountType = 'depository' 
    AND t.amount > 0 
    AND (
      LOWER(t.description) LIKE '%airline%' OR
      LOWER(t.description) LIKE '%united%' OR
      LOWER(t.description) LIKE '%flight%' OR
      LOWER(t.description) LIKE '%travel%' OR
      LOWER(t.description) LIKE '%hotel%' OR
      t.category = 'Transportation' OR
      t.category = 'Food & Dining' OR
      t.category = 'Eating Out' OR
      t.category = 'Entertainment' OR
      t.category = 'Misc. Needs'
    )
    AND t.category != 'Income'
);

-- McDonald's, Starbucks, Uber, etc. should be negative outflows for bank accounts
UPDATE "Transaction" SET amount = -ABS(amount)
WHERE id IN (
  SELECT t.id 
  FROM "Transaction" t 
  JOIN Account a ON t.accountId = a.id 
  WHERE a.accountType = 'depository' 
    AND t.amount > 0 
    AND (
      LOWER(t.description) LIKE '%mcdonald%' OR
      LOWER(t.description) LIKE '%starbucks%' OR
      LOWER(t.description) LIKE '%uber%' OR
      LOWER(t.description) LIKE '%sparkfun%' OR
      LOWER(t.description) LIKE '%restaurant%' OR
      LOWER(t.description) LIKE '%coffee%'
    )
    AND t.category != 'Income'
);

-- Show summary of bank account transactions after fixes
SELECT 
  'Bank Account Transactions After Fix:' as Summary;

SELECT 
  t.description,
  t.amount,
  t.category,
  CASE 
    WHEN t.amount > 0 THEN 'INFLOW' 
    ELSE 'OUTFLOW' 
  END as flow_type
FROM "Transaction" t 
JOIN Account a ON t.accountId = a.id 
WHERE a.accountType = 'depository' 
ORDER BY t.date DESC;