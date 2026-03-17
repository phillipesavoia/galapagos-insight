
CREATE TABLE public.benchmark_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticker, date)
);

ALTER TABLE public.benchmark_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select benchmark_prices"
  ON public.benchmark_prices FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert benchmark_prices"
  ON public.benchmark_prices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update benchmark_prices"
  ON public.benchmark_prices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete benchmark_prices"
  ON public.benchmark_prices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
