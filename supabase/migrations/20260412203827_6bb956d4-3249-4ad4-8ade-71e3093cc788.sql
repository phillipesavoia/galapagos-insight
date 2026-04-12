-- ETFs
UPDATE documents SET category = 'etf' 
WHERE type = 'factsheet' AND (
  fund_name ILIKE '%iShares%' OR fund_name ILIKE '%Vanguard%' OR
  fund_name ILIKE '%SPDR%' OR fund_name ILIKE '%Invesco%' OR
  fund_name ILIKE '%WisdomTree%' OR fund_name ILIKE '%State Street%' OR
  fund_name ILIKE '%KWEB%' OR fund_name ILIKE '%VOO%' OR
  fund_name ILIKE '%MGK%' OR fund_name ILIKE '%VCLT%' OR fund_name ILIKE '%SJNK%'
);

-- Bonds
UPDATE documents SET category = 'bond'
WHERE type = 'factsheet' AND (
  fund_name ILIKE '%Wells Fargo%' OR fund_name ILIKE '%Vodafone%' OR
  fund_name ILIKE '%UnitedHealth%' OR fund_name ILIKE '%Microsoft%' OR
  fund_name ILIKE '%Intel%' OR fund_name ILIKE '%Duke Energy%' OR
  fund_name ILIKE '%General Motors%'
);

-- Internal
UPDATE documents SET category = 'relatorio' WHERE type = 'relatorio';
UPDATE documents SET category = 'apresentacao' WHERE type = 'apresentacao';