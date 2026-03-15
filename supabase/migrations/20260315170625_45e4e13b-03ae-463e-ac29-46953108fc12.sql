
-- Enable RLS on all three tables
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_chat_history ENABLE ROW LEVEL SECURITY;

-- documents: authenticated users only
CREATE POLICY "Authenticated users can select documents"
  ON public.documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON public.documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update documents"
  ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
  ON public.documents FOR DELETE TO authenticated USING (true);

-- document_chunks: authenticated users only
CREATE POLICY "Authenticated users can select chunks"
  ON public.document_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chunks"
  ON public.document_chunks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update chunks"
  ON public.document_chunks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chunks"
  ON public.document_chunks FOR DELETE TO authenticated USING (true);

-- advisor_chat_history: authenticated users only
CREATE POLICY "Authenticated users can select chat history"
  ON public.advisor_chat_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chat history"
  ON public.advisor_chat_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update chat history"
  ON public.advisor_chat_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chat history"
  ON public.advisor_chat_history FOR DELETE TO authenticated USING (true);
