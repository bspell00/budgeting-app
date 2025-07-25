-- Create comprehensive YNAB-style budget structure
-- Current month and year: July 2025

-- Credit Card Payments
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('cc-chase-sapphire', 'test-user-123', 'Chase Sapphire Rewards', 0, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-adrienne-barclay', 'test-user-123', 'Adrienne''s Barclay Arrival', 70, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-brandon-barclay', 'test-user-123', 'Brandon''s Barclay Arrival', 50, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-amazon-store', 'test-user-123', 'Amazon Store Card', 120.92, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-navy-federal', 'test-user-123', 'Navy Federal Rewards Card', 70, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-delta-platinum', 'test-user-123', 'Delta Platinum Rewards', 64, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-adrienne-venture', 'test-user-123', 'Adrienne Capital One Venture', 0, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-gap-reward', 'test-user-123', 'GAP Reward Card', 50, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-amex-gold', 'test-user-123', 'American Express Gold Card', 0, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-carecredit', 'test-user-123', 'CareCredit', 113, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-venture-x', 'test-user-123', 'Venture X', 251, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now')),
('cc-home-depot', 'test-user-123', 'Home Depot CC', 0, 0, 'Credit Card Payments', 7, 2025, datetime('now'), datetime('now'));

-- Auto Loans
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('auto-ram-1500', 'test-user-123', '2021 Ram 1500', 0, 0, 'Auto Loans', 7, 2025, datetime('now'), datetime('now')),
('auto-hyundai-palisade', 'test-user-123', '2023 Hyundai Palisade', 0, 0, 'Auto Loans', 7, 2025, datetime('now'), datetime('now'));

-- Monthly Bills
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('bill-gabb-wireless', 'test-user-123', 'Gabb Wireless', 18.12, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-interest-charges', 'test-user-123', 'Interest Charges', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-heloc-payments', 'test-user-123', 'HELOC Payments', 1376.03, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-aidvantage', 'test-user-123', 'Aidvantage (Student Loan)', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-car-insurance', 'test-user-123', 'Car Insurance', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-cellphone', 'test-user-123', 'Cellphone', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-electric', 'test-user-123', 'Electric', 141, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-gas', 'test-user-123', 'Gas', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-hoa-fees', 'test-user-123', 'HOA Fees', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-internet', 'test-user-123', 'Internet', 79.99, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-mortgage', 'test-user-123', 'Mortgage', 563.31, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-subscriptions', 'test-user-123', 'Subscriptions', 123.31, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-tv', 'test-user-123', 'TV', 73, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-trash', 'test-user-123', 'Trash', 25.50, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now')),
('bill-water', 'test-user-123', 'Water', 0, 0, 'Monthly Bills', 7, 2025, datetime('now'), datetime('now'));

-- Frequent Spending
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('freq-eating-out', 'test-user-123', 'Eating Out', 786.97, 0, 'Frequent Spending', 7, 2025, datetime('now'), datetime('now')),
('freq-groceries', 'test-user-123', 'Groceries', 447.38, 0, 'Frequent Spending', 7, 2025, datetime('now'), datetime('now')),
('freq-heloc', 'test-user-123', 'HELOC', 0, 0, 'Frequent Spending', 7, 2025, datetime('now'), datetime('now')),
('freq-investments', 'test-user-123', 'Investments', 0, 0, 'Frequent Spending', 7, 2025, datetime('now'), datetime('now')),
('freq-tithing', 'test-user-123', 'Tithing', 495.48, 0, 'Frequent Spending', 7, 2025, datetime('now'), datetime('now')),
('freq-transportation', 'test-user-123', 'Transportation', 234.56, 0, 'Frequent Spending', 7, 2025, datetime('now'), datetime('now'));

-- Non-Monthly
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('nm-taxes', 'test-user-123', 'Taxes', 0, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-emergency-fund', 'test-user-123', 'Emergency Fund', 0, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-auto-maintenance', 'test-user-123', 'Auto Maintenance', 569.36, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-clothing', 'test-user-123', 'Clothing', 180.33, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-gifts', 'test-user-123', 'Gifts', 350, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-hair', 'test-user-123', 'Hair', 0, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-home-improvement', 'test-user-123', 'Home Improvement', 0, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-medical', 'test-user-123', 'Medical', 148.07, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-misc-needs', 'test-user-123', 'Misc. Needs', 100.84, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-pet-maintenance', 'test-user-123', 'Pet Maintenance', 64.26, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now')),
('nm-stuff-forgot', 'test-user-123', 'Stuff I Forgot to Budget For', 0, 0, 'Non-Monthly', 7, 2025, datetime('now'), datetime('now'));

-- Sully & Remi
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('sr-teacher-gifts', 'test-user-123', 'Teacher Gifts', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-misc-school', 'test-user-123', 'Misc School', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-birthdays', 'test-user-123', 'Birthdays', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-childcare', 'test-user-123', 'Childcare', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-clothing', 'test-user-123', 'Clothing', 85.19, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-lunch-money', 'test-user-123', 'Lunch Money', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-extracurricular', 'test-user-123', 'Extracurricular', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now')),
('sr-toys', 'test-user-123', 'Toys', 0, 0, 'Sully & Remi', 7, 2025, datetime('now'), datetime('now'));

-- Adrienne Spell Counseling
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('asc-fees-registrations', 'test-user-123', 'Fees and Registrations', 0, 0, 'Adrienne Spell Counseling', 7, 2025, datetime('now'), datetime('now')),
('asc-state-registration', 'test-user-123', 'State Registration', 0, 0, 'Adrienne Spell Counseling', 7, 2025, datetime('now'), datetime('now')),
('asc-continuing-education', 'test-user-123', 'Continuing Education', 0, 0, 'Adrienne Spell Counseling', 7, 2025, datetime('now'), datetime('now')),
('asc-affiliation-fees', 'test-user-123', 'Affiliation Fees', 0, 0, 'Adrienne Spell Counseling', 7, 2025, datetime('now'), datetime('now')),
('asc-business-insurance', 'test-user-123', 'Business Insurance', 0, 0, 'Adrienne Spell Counseling', 7, 2025, datetime('now'), datetime('now')),
('asc-office-rent', 'test-user-123', 'Office Rent', 0, 0, 'Adrienne Spell Counseling', 7, 2025, datetime('now'), datetime('now'));

-- Goals
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('goals-christmas-gifts', 'test-user-123', 'Christmas Gifts 🎁🎄', 0, 0, 'Goals', 7, 2025, datetime('now'), datetime('now')),
('goals-mexico-trip', 'test-user-123', 'Mexico Trip', 0, 0, 'Goals', 7, 2025, datetime('now'), datetime('now')),
('goals-pampering', 'test-user-123', 'Pampering', 569.33, 0, 'Goals', 7, 2025, datetime('now'), datetime('now')),
('goals-vacation', 'test-user-123', 'Vacation', 0, 0, 'Goals', 7, 2025, datetime('now'), datetime('now'));

-- Just for Fun
INSERT INTO Budget (id, userId, name, amount, spent, category, month, year, createdAt, updatedAt) VALUES
('jff-fun-money', 'test-user-123', 'Fun Money', 109.64, 0, 'Just for Fun', 7, 2025, datetime('now'), datetime('now'));