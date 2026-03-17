
-- Deactivate all Growth holdings first
UPDATE public.portfolio_holdings 
SET is_active = false, updated_at = now()
WHERE portfolio_name = 'Growth';

-- Update existing Growth assets with Feb/26 contributions and reactivate
UPDATE public.portfolio_holdings 
SET is_active = true, monthly_contribution = 0.14, contribution_month = '2026-02-01', updated_at = now()
WHERE portfolio_name = 'Growth' AND ticker = 'ACWI US';

UPDATE public.portfolio_holdings 
SET is_active = true, monthly_contribution = 0.11, contribution_month = '2026-02-01', updated_at = now()
WHERE portfolio_name = 'Growth' AND ticker = 'UTES US';

UPDATE public.portfolio_holdings 
SET is_active = true, monthly_contribution = -0.05, contribution_month = '2026-02-01', updated_at = now()
WHERE portfolio_name = 'Growth' AND ticker = 'MGK US';

UPDATE public.portfolio_holdings 
SET is_active = true, monthly_contribution = -0.07, contribution_month = '2026-02-01', updated_at = now()
WHERE portfolio_name = 'Growth' AND ticker = 'KBWB US';

UPDATE public.portfolio_holdings 
SET is_active = true, monthly_contribution = -0.44, contribution_month = '2026-02-01', updated_at = now()
WHERE portfolio_name = 'Growth' AND ticker = 'KWEB US';

-- Update ALTS ticker from .ALTS_CIX F to ALTS AMC
UPDATE public.portfolio_holdings 
SET is_active = true, ticker = 'ALTS AMC', asset_name = 'ALTS AMC', monthly_contribution = -0.07, contribution_month = '2026-02-01', updated_at = now()
WHERE portfolio_name = 'Growth' AND ticker = '.ALTS_CIX F';

-- Insert new assets not yet in the table
INSERT INTO public.portfolio_holdings (portfolio_name, asset_name, ticker, asset_class, weight_percentage, is_active, monthly_contribution, contribution_month)
VALUES 
  ('Growth', 'iShares JP Morgan EM Local Gov Bond', 'EMGA LN', 'Fixed Income', 3.50, true, 0.08, '2026-02-01'),
  ('Growth', 'iShares TIPS 0-5 UCITS ETF', 'TIP5 LN', 'Fixed Income', 3.50, true, 0.05, '2026-02-01')
ON CONFLICT DO NOTHING;
