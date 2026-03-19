-- 创建 issues 表
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  types TEXT[] DEFAULT '{}',
  date DATE,
  process TEXT DEFAULT '',
  modules JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 启用 RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户完全访问（开发阶段）
CREATE POLICY "Allow all access" ON issues FOR ALL USING (true) WITH CHECK (true);

-- 创建 storage bucket（需要在 Supabase Dashboard > Storage 手动创建）
-- Bucket name: issue-images
-- Public: true
INSERT INTO storage.buckets (id, name, public) 
VALUES ('issue-images', 'issue-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: 允许匿名上传/删除
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'issue-images');
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'issue-images');
CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'issue-images');
