
-- Clear existing holdings
DELETE FROM public.portfolio_holdings;

-- ==================== GROWTH ====================
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active) VALUES
('Growth', 'iShares MSCI ACWI ETF', 'ACWI US', 'Equities', 35.00, true),
('Growth', 'KraneShares CSI China Internet', 'KWEB US', 'Equities', 3.50, true),
('Growth', 'iShares AI Innovation & Tech', 'BAI US', 'Equities', 3.50, true),
('Growth', 'Vanguard Mega Cap Growth ETF', 'MGK US', 'Equities', 3.50, true),
('Growth', 'Vanguard S&P 500 ETF', 'VOO US', 'Equities', 3.50, true),
('Growth', 'Invesco KBW Bank ETF', 'KBWB US', 'Equities', 7.00, true),
('Growth', 'JPMorgan Hedged Equity ETF', 'HELO US', 'Equities', 3.50, true),
('Growth', 'Virtus Reaves Utilities ETF', 'UTES US', 'Equities', 3.50, true),
('Growth', 'iShares US Treasury 0-1Y', 'IB01 LN', 'Fixed Income', 5.00, true),
('Growth', 'ALTS_CIX', '.ALTS_CIX F', 'Alternatives', 25.00, true),
('Growth', 'EM USD Aggregate', 'EMUSTRUU', 'Fixed Income', 5.00, true),
('Growth', 'SPDR Gold Shares', 'GLD US', 'Commodities', 1.50, true);

-- ==================== BALANCED ====================
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active) VALUES
('Balanced', 'iShares MSCI ACWI ETF', 'ACWI US', 'Equities', 20.00, true),
('Balanced', 'KraneShares CSI China Internet', 'KWEB US', 'Equities', 2.00, true),
('Balanced', 'iShares AI Innovation & Tech', 'BAI US', 'Equities', 2.00, true),
('Balanced', 'Vanguard Mega Cap Growth ETF', 'MGK US', 'Equities', 2.00, true),
('Balanced', 'Vanguard S&P 500 ETF', 'VOO US', 'Equities', 2.00, true),
('Balanced', 'Invesco KBW Bank ETF', 'KBWB US', 'Equities', 4.00, true),
('Balanced', 'JPMorgan Hedged Equity ETF', 'HELO US', 'Equities', 2.00, true),
('Balanced', 'Virtus Reaves Utilities ETF', 'UTES US', 'Equities', 2.00, true),
('Balanced', 'iShares US Treasury 0-1Y', 'IB01 LN', 'Fixed Income', 5.00, true),
('Balanced', 'ISH USD Treasury 20+ Year', 'DTLA LN', 'Fixed Income', 9.625, true),
('Balanced', 'iShares USD TIPS 0-5', 'TIP5 LN', 'Fixed Income', 4.375, true),
('Balanced', 'iShares JPM EM Local Gov', 'EMGA LN', 'Fixed Income', 3.50, true),
('Balanced', 'iShares USD HY Corp', 'IHYA LN', 'Fixed Income', 1.75, true),
('Balanced', 'iShares Global HY Corp', 'HYLA LN', 'Fixed Income', 1.75, true),
('Balanced', 'iShares US MBS USD', 'IMBA LN', 'Fixed Income', 1.75, true),
('Balanced', 'iShares USD Treasury 3-7Y', 'CBU7 LN', 'Fixed Income', 1.225, true),
('Balanced', 'iShares USD Treasury 1-3Y', 'IBTA LN', 'Fixed Income', 1.225, true),
('Balanced', 'JPM Green Social Sustainable Bond', 'JGRN LN', 'Fixed Income', 1.05, true),
('Balanced', 'ALTS_CIX', '.ALTS_CIX F', 'Alternatives', 20.00, true),
('Balanced', 'SPDR Gold Shares', 'GLD US', 'Commodities', 1.50, true);

-- ==================== INCOME ====================
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active) VALUES
('Income', 'iShares MSCI ACWI ETF', 'ACWI US', 'Equities', 10.00, true),
('Income', 'iShares AI Innovation & Tech', 'BAI US', 'Equities', 1.50, true),
('Income', 'Vanguard Mega Cap Growth ETF', 'MGK US', 'Equities', 1.50, true),
('Income', 'Vanguard S&P 500 ETF', 'VOO US', 'Equities', 1.50, true),
('Income', 'Invesco KBW Bank ETF', 'KBWB US', 'Equities', 2.00, true),
('Income', 'JPMorgan Hedged Equity ETF', 'HELO US', 'Equities', 1.50, true),
('Income', 'Virtus Reaves Utilities ETF', 'UTES US', 'Equities', 1.50, true),
('Income', 'KraneShares CSI China Internet', 'KWEB US', 'Equities', 1.50, true),
('Income', 'iShares US Treasury 0-1Y', 'IB01 LN', 'Fixed Income', 5.00, true),
('Income', 'ISH USD Treasury 20+ Year', 'DTLA LN', 'Fixed Income', 16.50, true),
('Income', 'iShares USD TIPS 0-5', 'TIP5 LN', 'Fixed Income', 7.50, true),
('Income', 'iShares JPM EM Local Gov', 'EMGA LN', 'Fixed Income', 6.00, true),
('Income', 'iShares USD HY Corp', 'IHYA LN', 'Fixed Income', 3.00, true),
('Income', 'iShares Global HY Corp', 'HYLA LN', 'Fixed Income', 3.00, true),
('Income', 'iShares US MBS USD', 'IMBA LN', 'Fixed Income', 3.00, true),
('Income', 'iShares USD Treasury 3-7Y', 'CBU7 LN', 'Fixed Income', 2.10, true),
('Income', 'iShares USD Treasury 1-3Y', 'IBTA LN', 'Fixed Income', 2.10, true),
('Income', 'JPM Green Social Sustainable Bond', 'JGRN LN', 'Fixed Income', 1.80, true),
('Income', 'ABR SV I-FTR MKT B', 'AFMEI2A LX', 'Fixed Income', 1.50, true),
('Income', 'ALTS_CIX', '.ALTS_CIX F', 'Alternatives', 15.00, true),
('Income', 'SPDR Gold Shares', 'GLD US', 'Commodities', 1.00, true);

-- ==================== CONSERVATIVE ====================
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active) VALUES
('Conservative', 'iShares MSCI ACWI ETF', 'ACWI US', 'Equities', 2.50, true),
('Conservative', 'iShares AI Innovation & Tech', 'BAI US', 'Equities', 1.00, true),
('Conservative', 'Vanguard Mega Cap Growth ETF', 'MGK US', 'Equities', 1.00, true),
('Conservative', 'Vanguard S&P 500 ETF', 'VOO US', 'Equities', 1.00, true),
('Conservative', 'Invesco KBW Bank ETF', 'KBWB US', 'Equities', 1.00, true),
('Conservative', 'JPMorgan Hedged Equity ETF', 'HELO US', 'Equities', 1.00, true),
('Conservative', 'Virtus Reaves Utilities ETF', 'UTES US', 'Equities', 1.00, true),
('Conservative', 'KraneShares CSI China Internet', 'KWEB US', 'Equities', 1.00, true),
('Conservative', 'iShares US Treasury 0-1Y', 'IB01 LN', 'Fixed Income', 5.00, true),
('Conservative', 'ISH USD Treasury 20+ Year', 'DTLA LN', 'Fixed Income', 22.00, true),
('Conservative', 'iShares USD TIPS 0-5', 'TIP5 LN', 'Fixed Income', 10.00, true),
('Conservative', 'iShares JPM EM Local Gov', 'EMGA LN', 'Fixed Income', 8.00, true),
('Conservative', 'iShares USD HY Corp', 'IHYA LN', 'Fixed Income', 4.00, true),
('Conservative', 'iShares Global HY Corp', 'HYLA LN', 'Fixed Income', 4.00, true),
('Conservative', 'iShares US MBS USD', 'IMBA LN', 'Fixed Income', 4.00, true),
('Conservative', 'iShares USD Treasury 3-7Y', 'CBU7 LN', 'Fixed Income', 2.80, true),
('Conservative', 'iShares USD Treasury 1-3Y', 'IBTA LN', 'Fixed Income', 2.80, true),
('Conservative', 'JPM Green Social Sustainable Bond', 'JGRN LN', 'Fixed Income', 2.40, true),
('Conservative', 'ABR SV I-FTR MKT B', 'AFMEI2A LX', 'Fixed Income', 2.00, true),
('Conservative', 'ALTS_CIX', '.ALTS_CIX F', 'Alternatives', 10.00, true),
('Conservative', 'SPDR Gold Shares', 'GLD US', 'Commodities', 0.50, true);

-- ==================== LIQUIDITY ====================
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active) VALUES
('Liquidity', 'iShares Ultrashort Bond', 'ERNA LN', 'Fixed Income', 70.00, true),
('Liquidity', 'iShares Global HY Corp', 'HYLA LN', 'Fixed Income', 10.00, true),
('Liquidity', 'PIMCO Adv EM Market Local Bond', 'EMLB LN', 'Fixed Income', 10.00, true),
('Liquidity', 'iShares USD TIPS', 'IDTP LN', 'Fixed Income', 10.00, true);

-- ==================== BOND PORTFOLIO ====================
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active) VALUES
('Bonds', '3M Company', 'MMM', 'Fixed Income', 5.00, true),
('Bonds', 'Ally Financial Inc', 'ALLY', 'Fixed Income', 5.00, true),
('Bonds', 'Apple Inc', 'AAPL', 'Fixed Income', 5.00, true),
('Bonds', 'AstraZeneca PLC', 'AZN', 'Fixed Income', 5.00, true),
('Bonds', 'BHP Billiton Finance', 'BHP', 'Fixed Income', 5.00, true),
('Bonds', 'Broadcom Inc', 'AVGO', 'Fixed Income', 5.00, true),
('Bonds', 'Citigroup Inc', 'C', 'Fixed Income', 5.00, true),
('Bonds', 'Duke Energy Corp', 'DUK', 'Fixed Income', 5.00, true),
('Bonds', 'Florida Power & Light', 'NEE', 'Fixed Income', 5.00, true),
('Bonds', 'General Motors Financial', 'GM', 'Fixed Income', 5.00, true),
('Bonds', 'Intel Corp', 'INTC', 'Fixed Income', 5.00, true),
('Bonds', 'Microsoft Corp', 'MSFT', 'Fixed Income', 5.00, true),
('Bonds', 'Oracle Corp', 'ORCL', 'Fixed Income', 5.00, true),
('Bonds', 'Philip Morris Intl', 'PM', 'Fixed Income', 5.00, true),
('Bonds', 'Republic of Brazil', 'EWZ', 'Fixed Income', 5.00, true),
('Bonds', 'Republic of Panama', 'PAN', 'Fixed Income', 5.00, true),
('Bonds', 'Republic of South Africa', 'EZA', 'Fixed Income', 5.00, true),
('Bonds', 'Schlumberger NV', 'SLB', 'Fixed Income', 5.00, true),
('Bonds', 'United Mexican States', 'EWW', 'Fixed Income', 5.00, true),
('Bonds', 'Wells Fargo & Company', 'WFC', 'Fixed Income', 5.00, true);
