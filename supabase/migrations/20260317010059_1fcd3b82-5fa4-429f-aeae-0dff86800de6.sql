CREATE TABLE public.portfolio_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_name text NOT NULL,
  asset_name text NOT NULL,
  ticker text,
  asset_class text NOT NULL,
  weight_percentage numeric(5, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select portfolio_holdings"
  ON public.portfolio_holdings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert portfolio_holdings"
  ON public.portfolio_holdings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update portfolio_holdings"
  ON public.portfolio_holdings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete portfolio_holdings"
  ON public.portfolio_holdings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));