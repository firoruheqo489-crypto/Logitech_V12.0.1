CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  project_id TEXT DEFAULT '',
  types TEXT[] DEFAULT '{}',
  date DATE,
  process TEXT DEFAULT '',
  modules JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON issues FOR ALL USING (true) WITH CHECK (true);

-- Attachment binaries are stored in Aliyun OSS by the backend upload gateway.
-- Supabase only stores the returned URL strings inside issues.modules.
