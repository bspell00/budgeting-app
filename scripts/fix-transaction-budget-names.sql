-- Fix transaction-budget linking by matching transaction.category with budget.name
BEGIN;

-- Show current state
SELECT 
  'BEFORE NAME FIX' as status,
  COUNT(*) as total_transactions,
  COUNT("budgetId") as linked_transactions
FROM "Transaction" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Reset all budget spent amounts 
UPDATE "Budget" 
SET spent = 0 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Link transactions to budgets by matching transaction.category with budget.name
-- for August 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.name  -- Match category with budget NAME
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 8 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 8
  AND EXTRACT(year FROM "Transaction".date) = 2025;

-- Link for July 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.name
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 7 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 7
  AND EXTRACT(year FROM "Transaction".date) = 2025
  AND "Transaction"."budgetId" IS NULL;

-- Link for June 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.name
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 6 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 6
  AND EXTRACT(year FROM "Transaction".date) = 2025
  AND "Transaction"."budgetId" IS NULL;

-- Link for May 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.name
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 5 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 5
  AND EXTRACT(year FROM "Transaction".date) = 2025
  AND "Transaction"."budgetId" IS NULL;

-- Update budget spent amounts based on linked expense transactions
UPDATE "Budget" 
SET spent = COALESCE(transaction_totals.total_spent, 0)
FROM (
  SELECT 
    "budgetId",
    SUM(ABS(amount)) as total_spent
  FROM "Transaction" 
  WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv'
    AND amount < 0  -- Only expenses (negative amounts)
    AND "budgetId" IS NOT NULL
  GROUP BY "budgetId"
) as transaction_totals
WHERE "Budget".id = transaction_totals."budgetId"
  AND "Budget"."userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Show final results
SELECT 
  'AFTER NAME FIX' as status,
  COUNT(*) as total_transactions,
  COUNT("budgetId") as linked_transactions,
  COUNT(*) - COUNT("budgetId") as unlinked_transactions
FROM "Transaction" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Show which categories are now linked
SELECT 
  t.category as transaction_category,
  b.name as budget_name,
  b.category as budget_group,
  COUNT(*) as transaction_count,
  SUM(ABS(t.amount)) as total_spent
FROM "Transaction" t
JOIN "Budget" b ON t."budgetId" = b.id
WHERE t."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND t.amount < 0  -- Only expenses
GROUP BY t.category, b.name, b.category
ORDER BY total_spent DESC;

-- Show budget spending after fix
SELECT 
  b.name,
  b.category as group_name,
  b.spent,
  COUNT(t.id) as linked_transactions
FROM "Budget" b
LEFT JOIN "Transaction" t ON t."budgetId" = b.id AND t.amount < 0
WHERE b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 8 AND b.year = 2025
GROUP BY b.id, b.name, b.category, b.spent
HAVING b.spent > 0 OR COUNT(t.id) > 0
ORDER BY b.spent DESC;

COMMIT;