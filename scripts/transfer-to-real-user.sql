-- Create real user account and transfer all data from test user

-- Create the real user account
INSERT INTO User (id, email, password, name, createdAt, updatedAt) VALUES 
('user-bspell-001', 'bspell00@gmail.com', '$2a$12$LQv3c1yqBwEHxv68fq.vVuv4k7Z1D2Z3Y4Z5A6B7C8D9E0F1G2H3', 'Brandon Spell', datetime('now'), datetime('now'));

-- Update all accounts to belong to the real user
UPDATE Account SET userId = 'user-bspell-001' WHERE userId = 'test-user-123';

-- Update all budgets to belong to the real user  
UPDATE Budget SET userId = 'user-bspell-001' WHERE userId = 'test-user-123';

-- Update all transactions to belong to the real user
UPDATE "Transaction" SET userId = 'user-bspell-001' WHERE userId = 'test-user-123';

-- Update any goals to belong to the real user
UPDATE Goal SET userId = 'user-bspell-001' WHERE userId = 'test-user-123';

-- Delete the test user
DELETE FROM User WHERE id = 'test-user-123';

-- Show summary of what was transferred
SELECT 'Data Transfer Summary:' as Status;

SELECT 'Users:' as Type, COUNT(*) as Count FROM User;
SELECT 'Accounts:' as Type, COUNT(*) as Count FROM Account WHERE userId = 'user-bspell-001';
SELECT 'Budgets:' as Type, COUNT(*) as Count FROM Budget WHERE userId = 'user-bspell-001';
SELECT 'Transactions:' as Type, COUNT(*) as Count FROM "Transaction" WHERE userId = 'user-bspell-001';
SELECT 'Goals:' as Type, COUNT(*) as Count FROM Goal WHERE userId = 'user-bspell-001';

-- Show the real user account
SELECT 'Real User Account:' as Status;
SELECT id, email, name FROM User WHERE email = 'bspell00@gmail.com';