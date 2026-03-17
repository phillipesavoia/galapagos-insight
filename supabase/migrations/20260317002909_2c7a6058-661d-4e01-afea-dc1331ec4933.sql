
-- Add unique constraint on daily_navs for upsert support
ALTER TABLE public.daily_navs ADD CONSTRAINT daily_navs_date_portfolio_unique UNIQUE (date, portfolio_name);
