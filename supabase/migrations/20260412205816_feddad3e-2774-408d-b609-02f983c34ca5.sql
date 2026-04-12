-- Fix bonds - fund_names contain ISIN + uppercase company names
UPDATE documents SET category = 'bond'
WHERE type = 'factsheet' AND category = 'other' AND (
  fund_name ILIKE '%Bond Data%'
);

-- Fix ETFs that were missed (fund_name has ISIN format)
UPDATE documents SET category = 'etf'
WHERE type = 'factsheet' AND category = 'other' AND (
  fund_name ILIKE '%ETF Data%' OR fund_name ILIKE '%ETF %'
);