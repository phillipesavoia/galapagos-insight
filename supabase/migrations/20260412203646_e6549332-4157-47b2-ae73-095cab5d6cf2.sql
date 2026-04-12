ALTER TABLE documents ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);