
-- Add monthly_contribution column to portfolio_holdings
ALTER TABLE public.portfolio_holdings 
ADD COLUMN IF NOT EXISTS monthly_contribution numeric DEFAULT NULL;

-- Add contribution_month to track which month the contribution refers to
ALTER TABLE public.portfolio_holdings 
ADD COLUMN IF NOT EXISTS contribution_month date DEFAULT NULL;
