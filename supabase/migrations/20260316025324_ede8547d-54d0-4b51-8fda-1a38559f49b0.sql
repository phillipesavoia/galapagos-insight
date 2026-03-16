
CREATE TABLE public.asset_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  name text NOT NULL,
  asset_class text NOT NULL,
  official_thesis text NOT NULL DEFAULT '',
  risk_profile text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ticker)
);

ALTER TABLE public.asset_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select asset_knowledge"
  ON public.asset_knowledge FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert asset_knowledge"
  ON public.asset_knowledge FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update asset_knowledge"
  ON public.asset_knowledge FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete asset_knowledge"
  ON public.asset_knowledge FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
