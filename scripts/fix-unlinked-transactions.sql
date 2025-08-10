-- Script to create missing budgets and link existing unlinked transactions
BEGIN;

-- Check current state
SELECT 
  'BEFORE FIX' as status,
  t.category,
  COUNT(*) as transaction_count,
  COUNT(t."budgetId") as linked_count
FROM "Transaction" t 
WHERE t."userId" IS NOT NULL 
GROUP BY t.category
ORDER BY transaction_count DESC;

-- Create missing budgets for existing transaction categories
-- Get current month/year for budget creation
DO $$
DECLARE
    user_record RECORD;
    current_month INTEGER := EXTRACT(month FROM NOW());
    current_year INTEGER := EXTRACT(year FROM NOW());
BEGIN
    -- Loop through each user (in case there are multiple)
    FOR user_record IN 
        SELECT DISTINCT "userId" FROM "Transaction" WHERE "userId" IS NOT NULL
    LOOP
        -- Create "Transportation" budget in Frequent Spending
        INSERT INTO "Budget" (id, "userId", name, category, amount, spent, month, year, "createdAt", "updatedAt")
        SELECT 
            'transp_' || substr(user_record."userId", 1, 20) || '_' || substr(md5(random()::text), 1, 6),
            user_record."userId",
            'Transportation',
            'Frequent Spending',
            0,
            0,
            current_month,
            current_year,
            NOW(),
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "Budget" 
            WHERE "userId" = user_record."userId" 
            AND name = 'Transportation' 
            AND month = current_month 
            AND year = current_year
        );

        -- Create "Eating Out" budget in Frequent Spending  
        INSERT INTO "Budget" (id, "userId", name, category, amount, spent, month, year, "createdAt", "updatedAt")
        SELECT 
            'eating_' || substr(user_record."userId", 1, 20) || '_' || substr(md5(random()::text), 1, 6),
            user_record."userId",
            'Eating Out',
            'Frequent Spending',
            0,
            0,
            current_month,
            current_year,
            NOW(),
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "Budget" 
            WHERE "userId" = user_record."userId" 
            AND name = 'Eating Out' 
            AND month = current_month 
            AND year = current_year
        );

        -- Create "Hobbies" budget in Just for Fun
        INSERT INTO "Budget" (id, "userId", name, category, amount, spent, month, year, "createdAt", "updatedAt")
        SELECT 
            'hobbies_' || substr(user_record."userId", 1, 20) || '_' || substr(md5(random()::text), 1, 6),
            user_record."userId",
            'Hobbies',
            'Just for Fun',
            0,
            0,
            current_month,
            current_year,
            NOW(),
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "Budget" 
            WHERE "userId" = user_record."userId" 
            AND name = 'Hobbies' 
            AND month = current_month 
            AND year = current_year
        );

        -- Create "Needs a Category" budget in General
        INSERT INTO "Budget" (id, "userId", name, category, amount, spent, month, year, "createdAt", "updatedAt")
        SELECT 
            'needscat_' || substr(user_record."userId", 1, 20) || '_' || substr(md5(random()::text), 1, 6),
            user_record."userId",
            'Needs a Category',
            'General',
            0,
            0,
            current_month,
            current_year,
            NOW(),
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "Budget" 
            WHERE "userId" = user_record."userId" 
            AND name = 'Needs a Category' 
            AND month = current_month 
            AND year = current_year
        );

    END LOOP;
END $$;

-- Link unlinked transactions to their corresponding budgets
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = b."userId"
  AND "Transaction".category = b.name
  AND "Transaction"."budgetId" IS NULL
  AND EXTRACT(month FROM "Transaction".date) = b.month
  AND EXTRACT(year FROM "Transaction".date) = b.year;

-- Update budget spent amounts for newly linked transactions
UPDATE "Budget" 
SET spent = COALESCE(transaction_totals.total_spent, 0)
FROM (
  SELECT 
    "budgetId",
    SUM(ABS(amount)) as total_spent
  FROM "Transaction" 
  WHERE amount < 0  -- Only expenses (negative amounts)
    AND "budgetId" IS NOT NULL
  GROUP BY "budgetId"
) as transaction_totals
WHERE "Budget".id = transaction_totals."budgetId";

-- Show results
SELECT 
  'AFTER FIX' as status,
  t.category,
  COUNT(*) as transaction_count,
  COUNT(t."budgetId") as linked_count,
  b.name as budget_name,
  b.category as budget_group,
  b.spent as budget_spent
FROM "Transaction" t 
LEFT JOIN "Budget" b ON t."budgetId" = b.id
WHERE t."userId" IS NOT NULL 
GROUP BY t.category, b.name, b.category, b.spent
ORDER BY transaction_count DESC;

COMMIT;