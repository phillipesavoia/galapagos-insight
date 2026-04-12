UPDATE documents SET category = 'etf' WHERE category = 'other' AND fund_name ILIKE '%ETF Data%';
UPDATE documents SET category = 'bond' WHERE category = 'other' AND fund_name ILIKE '%Bond Data%';