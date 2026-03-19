import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function test() {
  const testId = 'TEST-999'

  // INSERT
  const { error: insertErr } = await supabase.from('issues').insert({
    id: testId, types: ['外观问题'], date: '2026-02-21', process: '注塑工序',
    modules: { evidence: { text: 'test', images: [] } }, status: 'draft',
  })
  console.log('INSERT:', insertErr ? `❌ ${insertErr.message}` : '✅')

  // SELECT
  const { data, error: selectErr } = await supabase.from('issues').select('*').eq('id', testId).single()
  console.log('SELECT:', selectErr ? `❌ ${selectErr.message}` : `✅ id=${data?.id}, status=${data?.status}`)

  // UPDATE
  const { error: updateErr } = await supabase.from('issues').update({ status: 'submitted' }).eq('id', testId)
  console.log('UPDATE:', updateErr ? `❌ ${updateErr.message}` : '✅')

  // STORAGE upload
  const blob = new Blob(['hello'], { type: 'text/plain' })
  const { error: upErr } = await supabase.storage.from('issue-images').upload(`${testId}/test.txt`, blob, { upsert: true })
  console.log('UPLOAD:', upErr ? `❌ ${upErr.message}` : '✅')

  // STORAGE public url
  const { data: urlData } = supabase.storage.from('issue-images').getPublicUrl(`${testId}/test.txt`)
  console.log('PUBLIC URL:', urlData?.publicUrl ? '✅' : '❌')

  // STORAGE delete
  const { error: delStorageErr } = await supabase.storage.from('issue-images').remove([`${testId}/test.txt`])
  console.log('STORAGE DELETE:', delStorageErr ? `❌ ${delStorageErr.message}` : '✅')

  // DELETE row
  const { error: deleteErr } = await supabase.from('issues').delete().eq('id', testId)
  console.log('DELETE:', deleteErr ? `❌ ${deleteErr.message}` : '✅')

  console.log('\n🎉 All tests done!')
}

test().catch(console.error)
