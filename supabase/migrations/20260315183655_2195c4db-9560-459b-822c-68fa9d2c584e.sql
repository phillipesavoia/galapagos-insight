ALTER TABLE public.daily_navs ADD COLUMN currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.asset_prices ADD COLUMN currency text NOT NULL DEFAULT 'USD';