
-- Table: daily_navs
CREATE TABLE public.daily_navs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_name text NOT NULL,
  date date NOT NULL,
  nav numeric NOT NULL,
  daily_return numeric,
  ytd_return numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (portfolio_name, date)
);

ALTER TABLE public.daily_navs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select daily_navs"
  ON public.daily_navs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert daily_navs"
  ON public.daily_navs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily_navs"
  ON public.daily_navs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete daily_navs"
  ON public.daily_navs FOR DELETE TO authenticated USING (true);

-- Table: daily_holdings
CREATE TABLE public.daily_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_name text NOT NULL,
  date date NOT NULL,
  ticker text NOT NULL,
  weight_percentage numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (portfolio_name, date, ticker)
);

ALTER TABLE public.daily_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select daily_holdings"
  ON public.daily_holdings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert daily_holdings"
  ON public.daily_holdings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily_holdings"
  ON public.daily_holdings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete daily_holdings"
  ON public.daily_holdings FOR DELETE TO authenticated USING (true);

-- Table: asset_prices
CREATE TABLE public.asset_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  date date NOT NULL,
  price numeric NOT NULL,
  daily_return numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ticker, date)
);

ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select asset_prices"
  ON public.asset_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert asset_prices"
  ON public.asset_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update asset_prices"
  ON public.asset_prices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete asset_prices"
  ON public.asset_prices FOR DELETE TO authenticated USING (true);
