-- Script to create budgets for all months where transactions exist and link them
BEGIN;

-- Show current unlinked transactions by month
SELECT 
  'UNLINKED TRANSACTIONS BY MONTH' as status,
  EXTRACT(month FROM t.date) as month,
  EXTRACT(year FROM t.date) as year,
  t.category,
  COUNT(*) as count
FROM "Transaction" t 
WHERE t."userId" IS NOT NULL 
  AND t."budgetId" IS NULL
GROUP BY EXTRACT(month FROM t.date), EXTRACT(year FROM t.date), t.category
ORDER BY year, month, t.category;

-- Create missing budgets for all months where unlinked transactions exist
DO $$
DECLARE
    user_record RECORD;
    tx_record RECORD;
    budget_exists BOOLEAN;
    new_budget_id TEXT;
    category_group TEXT;
BEGIN
    -- Loop through each user
    FOR user_record IN 
        SELECT DISTINCT "userId" FROM "Transaction" WHERE "userId" IS NOT NULL
    LOOP
        -- Loop through each unique month/year/category combination with unlinked transactions
        FOR tx_record IN 
            SELECT DISTINCT 
                EXTRACT(month FROM date) as tx_month,
                EXTRACT(year FROM date) as tx_year,
                category as tx_category
            FROM "Transaction" 
            WHERE "userId" = user_record."userId" 
              AND "budgetId" IS NULL
              AND category NOT IN ('To Be Assigned') -- Skip To Be Assigned as it should already exist
        LOOP
            -- Check if budget already exists for this month/year/category
            SELECT EXISTS(
                SELECT 1 FROM "Budget" 
                WHERE "userId" = user_record."userId" 
                  AND name = tx_record.tx_category 
                  AND month = tx_record.tx_month 
                  AND year = tx_record.tx_year
            ) INTO budget_exists;

            -- Create budget if it doesn't exist
            IF NOT budget_exists THEN
                -- Determine category group
                category_group := 'General';
                IF tx_record.tx_category IN ('Transportation', 'Gas & Fuel', 'Eating Out', 'Groceries', 'Shopping') THEN
                    category_group := 'Frequent Spending';
                ELSIF tx_record.tx_category IN ('Hobbies', 'Fun Money', 'Entertainment') THEN
                    category_group := 'Just for Fun';
                ELSIF tx_record.tx_category IN ('Mortgage/Rent', 'Electric', 'Gas', 'Water', 'Internet', 'Car Insurance', 'Cellphone') THEN
                    category_group := 'Monthly Bills';
                ELSIF tx_record.tx_category = 'Credit Card Payments' THEN
                    category_group := 'Credit Card Payments';
                END IF;

                -- Generate unique ID
                new_budget_id := lower(substring(tx_record.tx_category, 1, 8)) || '_' || 
                                tx_record.tx_month || tx_record.tx_year || '_' || 
                                substr(md5(random()::text), 1, 8);

                INSERT INTO "Budget" (
                    id, "userId", name, category, amount, spent, month, year, "createdAt", "updatedAt"
                ) VALUES (
                    new_budget_id,
                    user_record."userId",
                    tx_record.tx_category,
                    category_group,
                    0,
                    0,
                    tx_record.tx_month,
                    tx_record.tx_year,
                    NOW(),
                    NOW()
                );

                RAISE NOTICE 'Created budget: % for %/% in group %', 
                    tx_record.tx_category, tx_record.tx_month, tx_record.tx_year, category_group;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Now link all unlinked transactions to their corresponding budgets
UPDATE "Transaction" 
SET "budgetId" = b.id
FROM "Budget" b
WHERE "Transaction"."userId" = b."userId"
  AND "Transaction".category = b.name
  AND "Transaction"."budgetId" IS NULL
  AND EXTRACT(month FROM "Transaction".date) = b.month
  AND EXTRACT(year FROM "Transaction".date) = b.year;

-- Update budget spent amounts for all budgets with linked transactions
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

-- Show final results
SELECT 
  'FINAL RESULTS' as status,
  t.category,
  EXTRACT(month FROM t.date) as month,
  EXTRACT(year FROM t.date) as year,
  COUNT(*) as total_transactions,
  COUNT(t."budgetId") as linked_transactions,
  b.spent as budget_spent
FROM "Transaction" t 
LEFT JOIN "Budget" b ON t."budgetId" = b.id
WHERE t."userId" IS NOT NULL 
GROUP BY t.category, EXTRACT(month FROM t.date), EXTRACT(year FROM t.date), b.spent
ORDER BY year, month, t.category;

COMMIT;