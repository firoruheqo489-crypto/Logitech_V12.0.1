import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const testId = 'TEST-999';

  const { error: insertErr } = await supabase.from('issues').insert({
    id: testId,
    types: ['外观问题'],
    date: '2026-02-21',
    process: '注塑工序',
    modules: { evidence: { text: 'test', images: [] } },
    status: 'draft',
  });
  console.log('INSERT:', insertErr ? `FAIL ${insertErr.message}` : 'OK');

  const { data, error: selectErr } = await supabase.from('issues').select('*').eq('id', testId).single();
  console.log('SELECT:', selectErr ? `FAIL ${selectErr.message}` : `OK id=${data?.id}, status=${data?.status}`);

  const { error: updateErr } = await supabase.from('issues').update({ status: 'submitted' }).eq('id', testId);
  console.log('UPDATE:', updateErr ? `FAIL ${updateErr.message}` : 'OK');

  const { error: deleteErr } = await supabase.from('issues').delete().eq('id', testId);
  console.log('DELETE:', deleteErr ? `FAIL ${deleteErr.message}` : 'OK');

  console.log('\nIssue table CRUD test complete.');
  console.log('Attachment uploads must be validated through the backend OSS API.');
}

test().catch((error) => {
  console.error(error);
  process.exit(1);
});
