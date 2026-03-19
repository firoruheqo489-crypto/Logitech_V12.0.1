import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_ANON_KEY!;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function setup() {
  console.log('Checking issues table...\n');

  const { error: tableError } = await supabase.from('issues').select('id').limit(1);

  if (tableError && tableError.code === '42P01') {
    console.log('Table "issues" does not exist.');
    console.log('Run the following SQL in Supabase Dashboard > SQL Editor:\n');
    console.log(`
CREATE TABLE issues (
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
    `);
  } else if (tableError) {
    console.log('Table check error:', tableError.message);
  } else {
    console.log('Table "issues" exists');
  }

  console.log('\nAttachment uploads are served by the backend OSS gateway now.');
  console.log('No Supabase Storage bucket setup is required for issue images.');
}

setup().catch(console.error);
