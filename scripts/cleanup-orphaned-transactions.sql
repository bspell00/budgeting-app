-- Cleanup script to remove orphaned transactions with invalid account references
-- Run this to clean up any transactions that reference non-existent accounts

-- First, let's see what we have
SELECT 'Orphaned transactions with invalid accountId:' as status;
SELECT 
    t.id,
    t.userId,
    t.accountId,
    t.description,
    t.amount,
    t.date
FROM "Transaction" t 
LEFT JOIN "Account" a ON t.accountId = a.id 
WHERE a.id IS NULL;

-- Show count of orphaned transactions
SELECT 'Total orphaned transactions:' as status, COUNT(*) as count
FROM "Transaction" t 
LEFT JOIN "Account" a ON t.accountId = a.id 
WHERE a.id IS NULL;

-- Specifically remove seed-account transactions
DELETE FROM "Transaction" WHERE accountId = 'seed-account';

-- Show final count after cleanup
SELECT 'Remaining transactions after cleanup:' as status, COUNT(*) as count FROM "Transaction";

-- Verify all transactions now have valid account references
SELECT 'Transactions without valid accounts (should be 0):' as status, COUNT(*) as count
FROM "Transaction" t 
LEFT JOIN "Account" a ON t.accountId = a.id 
WHERE a.id IS NULL;