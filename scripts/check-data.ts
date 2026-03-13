import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function check() {
  const { data, error } = await sb
    .from('tasks')
    .select('id, wbs_id, name_cn, phase, track, stage, baseline_start, baseline_end, actual_start, actual_end, status, is_milestone, is_merge_point, duration_days')
    .eq('project_id', 'LA25463')
    .order('baseline_start', { ascending: true })

  if (error) { console.error('Error:', error.message); return }
  if (!data) { console.error('No data'); return }

  console.log(`\n总行数: ${data.length}`)

  // Leaf tasks (has baseline dates)
  const leaves = data.filter(t => !!t.baseline_start && !!t.baseline_end)
  console.log(`叶子任务 (有baseline): ${leaves.length}`)

  // Tasks with actual_end
  const withActual = leaves.filter(t => !!t.actual_end)
  console.log(`有 actual_end: ${withActual.length}`)

  // Today gate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const doneToday = leaves.filter(t => {
    if (!t.actual_end) return false
    const parts = t.actual_end.split('-')
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return d <= today
  })
  console.log(`actual_end <= today: ${doneToday.length}`)

  // Breakdown by category
  const prep = leaves.filter(t => ['1','2','3','4'].includes(t.wbs_id))
  const trackTasks = leaves.filter(t => t.track && ['cavity_core','cavity_insert','lifter','slider'].includes(t.track))
  const postMerge = leaves.filter(t => !['1','2','3','4'].includes(t.wbs_id) && !t.track)

  console.log(`\n=== 分类 ===`)
  console.log(`前置工序 (WBS 1-4): ${prep.length}`)
  console.log(`泳道工序 (4 tracks): ${trackTasks.length}`)
  console.log(`后续节点 (post-merge): ${postMerge.length}`)
  console.log(`合计: ${prep.length + trackTasks.length + postMerge.length}`)

  // Per track
  for (const tr of ['cavity_core', 'cavity_insert', 'lifter', 'slider']) {
    const tasks = trackTasks.filter(t => t.track === tr)
    const done = tasks.filter(t => {
      if (!t.actual_end) return false
      const parts = t.actual_end.split('-')
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return d <= today
    })
    console.log(`  ${tr}: ${tasks.length} 工序, ${done.length} 完成`)
  }

  // Prep done
  const prepDone = prep.filter(t => {
    if (!t.actual_end) return false
    const parts = t.actual_end.split('-')
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return d <= today
  })
  console.log(`\n前置完成: ${prepDone.length}/${prep.length}`)
  for (const t of prep) {
    console.log(`  WBS ${t.wbs_id} ${t.name_cn}: actual_end=${t.actual_end || '—'}`)
  }

  // Post-merge done
  const postDone = postMerge.filter(t => {
    if (!t.actual_end) return false
    const parts = t.actual_end.split('-')
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return d <= today
  })
  console.log(`\n后续完成: ${postDone.length}/${postMerge.length}`)

  // Show actual_end distribution for track tasks
  console.log(`\n=== 泳道 actual_end 分布 ===`)
  for (const tr of ['cavity_core', 'cavity_insert', 'lifter', 'slider']) {
    const tasks = trackTasks.filter(t => t.track === tr).sort((a,b) => (a.wbs_id||'').localeCompare(b.wbs_id||''))
    console.log(`\n${tr}:`)
    for (const t of tasks) {
      const ae = t.actual_end || '—'
      const isFuture = t.actual_end ? (() => {
        const parts = t.actual_end.split('-')
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        return d > today ? ' ⚠ FUTURE' : ' ✓'
      })() : ''
      console.log(`  ${t.wbs_id} ${t.name_cn}: actual_end=${ae}${isFuture}`)
    }
  }

  // Summary
  console.log(`\n=== 总结 ===`)
  console.log(`分母: ${leaves.length}`)
  console.log(`分子 (done today): ${doneToday.length}`)
  console.log(`有actual_end但在未来: ${withActual.length - doneToday.length}`)
  console.log(`进度: ${(doneToday.length / leaves.length * 100).toFixed(1)}%`)
}

check()
