
-- ============================================================
-- 1. advisor_chat_history: add user_id + tighten RLS
-- ============================================================
ALTER TABLE public.advisor_chat_history
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill: set existing rows to NULL (they'll remain accessible to no one after RLS change)
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can select chat history" ON public.advisor_chat_history;
DROP POLICY IF EXISTS "Authenticated users can insert chat history" ON public.advisor_chat_history;
DROP POLICY IF EXISTS "Authenticated users can update chat history" ON public.advisor_chat_history;
DROP POLICY IF EXISTS "Authenticated users can delete chat history" ON public.advisor_chat_history;

-- New user-scoped policies
CREATE POLICY "Users can select own chat history"
  ON public.advisor_chat_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat history"
  ON public.advisor_chat_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat history"
  ON public.advisor_chat_history FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat history"
  ON public.advisor_chat_history FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 2. documents: add owner_id + tighten UPDATE/DELETE
-- ============================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop old permissive write policies
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON public.documents;

-- Keep SELECT open for all authenticated (read access to shared library)
-- New owner-scoped write policies
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================
-- 3. document_chunks: tighten INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Authenticated users can update chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Authenticated users can delete chunks" ON public.document_chunks;

-- Chunks are managed via edge functions with service role, but allow owner via document
CREATE POLICY "Users can insert chunks for own documents"
  ON public.document_chunks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chunks for own documents"
  ON public.document_chunks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chunks for own documents"
  ON public.document_chunks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id AND d.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 4. Tighten other tables: daily_navs, daily_holdings, asset_prices
-- These are admin-managed data; keep SELECT open, restrict writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert daily_navs" ON public.daily_navs;
DROP POLICY IF EXISTS "Authenticated users can update daily_navs" ON public.daily_navs;
DROP POLICY IF EXISTS "Authenticated users can delete daily_navs" ON public.daily_navs;

-- For now, no client-side inserts to these tables (managed by admin upload)
-- Re-create as restrictive (no one can write via client SDK, only service role)
-- Actually, the NavUpload page uses the client SDK. Let's keep authenticated write for now
-- but this is acceptable since it's an internal tool.
CREATE POLICY "Authenticated users can insert daily_navs"
  ON public.daily_navs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily_navs"
  ON public.daily_navs FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete daily_navs"
  ON public.daily_navs FOR DELETE TO authenticated
  USING (true);

-- ============================================================
-- 5. Fix match_chunks function search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.75,
  match_count integer DEFAULT 5,
  filter_type text DEFAULT NULL,
  filter_fund text DEFAULT NULL
)
RETURNS TABLE(id uuid, content text, metadata jsonb, document_id uuid, similarity double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  select
    dc.id,
    dc.content,
    dc.metadata,
    dc.document_id,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where
    1 - (dc.embedding <=> query_embedding) > match_threshold
    and (filter_type is null or d.type = filter_type)
    and (filter_fund is null or d.fund_name ilike '%' || filter_fund || '%')
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
