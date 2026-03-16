ALTER TABLE public.asset_knowledge ADD COLUMN IF NOT EXISTS portfolios text[] DEFAULT '{}';
ALTER TABLE public.asset_knowledge ADD COLUMN IF NOT EXISTS weight_pct jsonb DEFAULT '{}';
COMMENT ON COLUMN public.asset_knowledge.portfolios IS 'List of portfolio names where this asset is present';
COMMENT ON COLUMN public.asset_knowledge.weight_pct IS 'Weight per portfolio as JSON, e.g. {"Income": 5.2, "Growth": 3.1}';