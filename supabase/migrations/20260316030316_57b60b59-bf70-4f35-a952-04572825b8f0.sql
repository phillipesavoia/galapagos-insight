ALTER TABLE public.asset_knowledge ADD COLUMN isin text;
ALTER TABLE public.asset_knowledge ALTER COLUMN ticker SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asset_knowledge_isin_unique ON public.asset_knowledge(isin) WHERE isin IS NOT NULL AND isin != '';