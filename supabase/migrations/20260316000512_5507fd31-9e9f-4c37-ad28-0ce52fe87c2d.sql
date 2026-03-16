
DROP POLICY "Authenticated users can select chunks" ON public.document_chunks;

CREATE POLICY "Users can select chunks for own documents"
ON public.document_chunks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_chunks.document_id
    AND d.owner_id = auth.uid()
  )
);
