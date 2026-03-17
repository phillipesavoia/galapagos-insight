
-- Model Allocations table: stores portfolio allocation weights by asset class
CREATE TABLE public.model_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_name text NOT NULL,
  asset_class text NOT NULL,
  weight_pct numeric NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_name, asset_class)
);

ALTER TABLE public.model_allocations ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated users
CREATE POLICY "Authenticated users can select model_allocations"
  ON public.model_allocations FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE for admins only
CREATE POLICY "Admins can insert model_allocations"
  ON public.model_allocations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update model_allocations"
  ON public.model_allocations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete model_allocations"
  ON public.model_allocations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Seed initial allocation data
INSERT INTO public.model_allocations (portfolio_name, asset_class, weight_pct) VALUES
  ('Liquidity', 'Cash & Equivalents', 85),
  ('Liquidity', 'Short-Term Bonds', 15),
  ('Bonds', 'Fixed Income', 70),
  ('Bonds', 'EM Bonds', 20),
  ('Bonds', 'Cash', 10),
  ('Conservative', 'Fixed Income', 55),
  ('Conservative', 'Equities', 25),
  ('Conservative', 'Alternatives', 12),
  ('Conservative', 'Cash', 8),
  ('Income', 'Fixed Income', 40),
  ('Income', 'Equities', 35),
  ('Income', 'Alternatives', 18),
  ('Income', 'Cash', 7),
  ('Balanced', 'Equities', 50),
  ('Balanced', 'Fixed Income', 30),
  ('Balanced', 'Alternatives', 15),
  ('Balanced', 'Cash', 5),
  ('Growth', 'Equities', 70),
  ('Growth', 'Alternatives', 20),
  ('Growth', 'Cash', 10);
