/**
 * Setup issues table and storage bucket in Supabase
 * Run: npx tsx scripts/setup-issues.ts
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const url = process.env.VITE_SUPABASE_URL!
const key = process.env.VITE_SUPABASE_ANON_KEY!

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)

async function setup() {
  console.log('🔧 Setting up issues table and storage...\n')

  // 1. Create table via REST (using rpc or raw SQL isn't available with anon key)
  // Instead, test if table exists by trying a select
  const { error: tableError } = await supabase.from('issues').select('id').limit(1)
  
  if (tableError && tableError.code === '42P01') {
    console.log('❌ Table "issues" does not exist.')
    console.log('   Please run the following SQL in Supabase Dashboard > SQL Editor:\n')
    console.log(`
CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  types TEXT[] DEFAULT '{}',
  date DATE,
  process TEXT DEFAULT '',
  modules JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON issues FOR ALL USING (true) WITH CHECK (true);
    `)
  } else if (tableError) {
    console.log('⚠️  Table check error:', tableError.message)
  } else {
    console.log('✅ Table "issues" exists')
  }

  // 2. Check/create storage bucket
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some(b => b.name === 'issue-images')
  
  if (!exists) {
    const { error: bucketError } = await supabase.storage.createBucket('issue-images', {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    })
    if (bucketError) {
      console.log('⚠️  Bucket creation error:', bucketError.message)
      console.log('   You may need to create it manually in Supabase Dashboard > Storage')
    } else {
      console.log('✅ Storage bucket "issue-images" created')
    }
  } else {
    console.log('✅ Storage bucket "issue-images" exists')
  }

  // 3. Test upload
  const testBlob = new Blob(['test'], { type: 'text/plain' })
  const { error: uploadErr } = await supabase.storage.from('issue-images').upload('_test.txt', testBlob, { upsert: true })
  if (uploadErr) {
    console.log('⚠️  Upload test failed:', uploadErr.message)
    console.log('   You may need to add storage policies. Run in SQL Editor:')
    console.log(`
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'issue-images');
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'issue-images');
CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'issue-images');
    `)
  } else {
    console.log('✅ Storage upload test passed')
    await supabase.storage.from('issue-images').remove(['_test.txt'])
  }

  console.log('\n🎉 Setup complete!')
}

setup().catch(console.error)
