-- Comprehensive script to fix transaction-budget linking for 2025
-- This will link transactions to existing budgets and create missing budgets as needed

BEGIN;

-- Show current state
SELECT 
  'BEFORE FIX' as status,
  COUNT(*) as total_transactions,
  COUNT("budgetId") as linked_transactions
FROM "Transaction" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Reset spent amounts for all existing budgets
UPDATE "Budget" 
SET spent = 0 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Link transactions to existing budgets for August 2025 (where most budgets exist)
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.category
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 8
  AND b.year = 2025
  AND "Transaction"."budgetId" IS NULL
  AND EXTRACT(month FROM "Transaction".date) = 8
  AND EXTRACT(year FROM "Transaction".date) = 2025;

-- For other months (May, June, July), create missing budgets by copying from August
-- First, create budgets for July 2025
INSERT INTO "Budget" (id, "userId", name, amount, spent, category, month, year, "createdAt", "updatedAt")
SELECT 
  'july_' || substr(id, 1, 20) || '_' || substr(md5(random()::text), 1, 6) as id,
  "userId",
  name,
  0 as amount,  -- Start with 0 budget
  0 as spent,
  category,
  7 as month,   -- July
  2025 as year,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Budget" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND month = 8 
  AND year = 2025
  AND category NOT IN ('Credit Card Payments', 'Income')  -- Skip special categories
  AND NOT EXISTS (
    SELECT 1 FROM "Budget" b2 
    WHERE b2."userId" = 'cme33z2h100000mjk3mzh2lxv' 
    AND b2.category = "Budget".category 
    AND b2.month = 7 
    AND b2.year = 2025
  );

-- Create budgets for June 2025
INSERT INTO "Budget" (id, "userId", name, amount, spent, category, month, year, "createdAt", "updatedAt")
SELECT 
  'june_' || substr(id, 1, 20) || '_' || substr(md5(random()::text), 1, 6) as id,
  "userId",
  name,
  0 as amount,
  0 as spent,
  category,
  6 as month,   -- June
  2025 as year,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Budget" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND month = 8 
  AND year = 2025
  AND category NOT IN ('Credit Card Payments', 'Income')
  AND NOT EXISTS (
    SELECT 1 FROM "Budget" b2 
    WHERE b2."userId" = 'cme33z2h100000mjk3mzh2lxv' 
    AND b2.category = "Budget".category 
    AND b2.month = 6 
    AND b2.year = 2025
  );

-- Create budgets for May 2025
INSERT INTO "Budget" (id, "userId", name, amount, spent, category, month, year, "createdAt", "updatedAt")
SELECT 
  'may_' || substr(id, 1, 20) || '_' || substr(md5(random()::text), 1, 6) as id,
  "userId",
  name,
  0 as amount,
  0 as spent,
  category,
  5 as month,   -- May
  2025 as year,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Budget" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND month = 8 
  AND year = 2025
  AND category NOT IN ('Credit Card Payments', 'Income')
  AND NOT EXISTS (
    SELECT 1 FROM "Budget" b2 
    WHERE b2."userId" = 'cme33z2h100000mjk3mzh2lxv' 
    AND b2.category = "Budget".category 
    AND b2.month = 5 
    AND b2.year = 2025
  );

-- Now link transactions to budgets for all months
-- July 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.category
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 7 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 7
  AND EXTRACT(year FROM "Transaction".date) = 2025
  AND "Transaction"."budgetId" IS NULL;

-- June 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.category
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 6 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 6
  AND EXTRACT(year FROM "Transaction".date) = 2025
  AND "Transaction"."budgetId" IS NULL;

-- May 2025
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND "Transaction".category = b.category
  AND b."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND b.month = 5 AND b.year = 2025
  AND EXTRACT(month FROM "Transaction".date) = 5
  AND EXTRACT(year FROM "Transaction".date) = 2025
  AND "Transaction"."budgetId" IS NULL;

-- Update all budget spent amounts based on linked expense transactions
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

-- Show final state
SELECT 
  'AFTER FIX' as status,
  COUNT(*) as total_transactions,
  COUNT("budgetId") as linked_transactions,
  COUNT(*) - COUNT("budgetId") as unlinked_transactions
FROM "Transaction" 
WHERE "userId" = 'cme33z2h100000mjk3mzh2lxv';

-- Show sample of linked transactions
SELECT 
  t.description,
  t.category,
  t.amount,
  b.name as budget_name,
  EXTRACT(month FROM t.date) as transaction_month
FROM "Transaction" t
JOIN "Budget" b ON t."budgetId" = b.id
WHERE t."userId" = 'cme33z2h100000mjk3mzh2lxv'
  AND t.amount < 0  -- Only expenses
ORDER BY t.date DESC
LIMIT 10;

COMMIT;