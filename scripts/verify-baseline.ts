import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function verify() {
  const { data } = await sb
    .from('tasks')
    .select('name_cn, baseline_start, baseline_end, is_milestone, is_merge_point')
    .eq('project_id', 'LA25463')
    .order('baseline_start', { ascending: true })

  const leaves = (data || []).filter(t => !t.is_milestone && !t.is_merge_point && !!t.baseline_start && !!t.baseline_end)
  
  console.log(`Total leaves: ${leaves.length}`)
  
  // Month distribution
  const dist: Record<string, number> = {}
  for (const t of leaves) {
    const m = t.baseline_end.slice(0, 7)
    dist[m] = (dist[m] || 0) + 1
  }
  console.log('\nbaseline_end month distribution:')
  for (const [month, count] of Object.entries(dist).sort()) {
    console.log(`  ${month}: ${'█'.repeat(count)} (${count})`)
  }

  // Count <= Feb 18
  const feb18 = leaves.filter(t => t.baseline_end <= '2026-02-18').length
  console.log(`\nbaseline_end <= 2026-02-18: ${feb18}/${leaves.length} = ${((feb18/leaves.length)*100).toFixed(1)}%`)

  // Show all tasks sorted by baseline_end
  console.log('\nAll leaf tasks by baseline_end:')
  const sorted = [...leaves].sort((a, b) => a.baseline_end.localeCompare(b.baseline_end))
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    const marker = t.baseline_end <= '2026-02-18' ? '✓' : ' '
    console.log(`  ${String(i+1).padStart(2)}. [${marker}] ${t.baseline_end}  ${t.baseline_start}  ${t.name_cn}`)
  }
}

verify().catch(console.error)
