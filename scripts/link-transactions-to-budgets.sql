-- Script to link existing transactions to budgets and update spending amounts
-- Run this in the budgeting_app_dev database

BEGIN;

-- First, let's see the current state
SELECT 
  'BEFORE FIX' as status,
  COUNT(*) as total_transactions,
  COUNT("budgetId") as linked_transactions,
  COUNT(*) - COUNT("budgetId") as unlinked_transactions
FROM "Transaction" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Reset all budget spent amounts to 0 first
UPDATE "Budget" 
SET spent = 0 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Link transactions to budgets based on matching categories
-- for current month (December 2024)
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.category
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 12  -- Current month
  AND b.year = 2024  -- Current year
  AND "Transaction"."budgetId" IS NULL;  -- Only update unlinked transactions

-- Update budget spent amounts based on linked transactions
-- Only count negative amounts (expenses)
UPDATE "Budget" 
SET spent = COALESCE(transaction_totals.total_spent, 0)
FROM (
  SELECT 
    "budgetId",
    SUM(ABS(amount)) as total_spent
  FROM "Transaction" 
  WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv'
    AND amount < 0  -- Only expenses
    AND "budgetId" IS NOT NULL
  GROUP BY "budgetId"
) as transaction_totals
WHERE "Budget".id = transaction_totals."budgetId"
  AND "Budget"."userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Show the results
SELECT 
  'AFTER FIX' as status,
  COUNT(*) as total_transactions,
  COUNT("budgetId") as linked_transactions,
  COUNT(*) - COUNT("budgetId") as unlinked_transactions
FROM "Transaction" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Show budget spending amounts after fix
SELECT 
  b.name,
  b.category,
  b.amount as budgeted,
  b.spent,
  COUNT(t.id) as transaction_count
FROM "Budget" b
LEFT JOIN "Transaction" t ON t."budgetId" = b.id AND t.amount < 0
WHERE b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 12 
  AND b.year = 2024
GROUP BY b.id, b.name, b.category, b.amount, b.spent
ORDER BY b.category, b.name;

COMMIT;