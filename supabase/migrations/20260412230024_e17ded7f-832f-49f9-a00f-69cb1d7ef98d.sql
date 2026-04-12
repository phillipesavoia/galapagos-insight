UPDATE documents SET category = 'etf' WHERE category = 'other' AND name ILIKE '%ETF Data%';
UPDATE documents SET category = 'bond' WHERE category = 'other' AND name ILIKE '%Bond Data%';