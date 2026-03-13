/**
 * 数据修复脚本 V2：恢复 Excel 真实 baseline_end
 *
 * 问题：线性分配脚本人为膨胀了 baseline_end，导致 1 天工序变成 7 天。
 * 修复：baseline_end = baseline_start + (duration_days - 1) 个工作日
 *       duration_days=1 → baseline_end = baseline_start（同一天）
 *
 * 用法：
 *   cd V3
 *   npx tsx scripts/restore-excel-baseline.ts --dry-run
 *   npx tsx scripts/restore-excel-baseline.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const PROJECT_ID = 'LA25463'
const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function addWorkDays(start: Date, days: number): Date {
  const d = new Date(start)
  if (days <= 0) return d
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) added++
  }
  return d
}

async function main() {
  console.log(`\n🔧 Restore Excel Baseline Dates`)
  console.log(`   Project: ${PROJECT_ID}`)
  console.log(`   Rule: baseline_end = baseline_start + (duration_days - 1) work days`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}\n`)

  const { data, error } = await supabase
    .from('tasks')
    .select('id, name_cn, wbs_id, baseline_start, baseline_end, duration_days, is_milestone, is_merge_point')
    .eq('project_id', PROJECT_ID)
    .order('baseline_start', { ascending: true })

  if (error || !data) { console.error('❌', error?.message); process.exit(1) }

  const leaves = data.filter(t =>
    !t.is_milestone && !t.is_merge_point && !!t.baseline_start && !!t.baseline_end
  )

  console.log(`📊 Total: ${data.length}, Leaves: ${leaves.length}\n`)

  interface Fix {
    id: string
    name: string
    wbs: string
    start: string
    oldEnd: string
    newEnd: string
    dur: number
  }

  const fixes: Fix[] = []

  for (const t of leaves) {
    const dur = Math.max(t.duration_days || 1, 1)
    const start = parseLocal(t.baseline_start)
    // duration=1 → same day; duration=2 → next work day; etc.
    const correctEnd = dur <= 1 ? start : addWorkDays(start, dur - 1)
    const correctEndStr = toStr(correctEnd)

    if (correctEndStr !== t.baseline_end) {
      fixes.push({
        id: t.id,
        name: t.name_cn,
        wbs: t.wbs_id || '',
        start: t.baseline_start,
        oldEnd: t.baseline_end,
        newEnd: correctEndStr,
        dur,
      })
    }
  }

  console.log(`📝 Tasks to fix: ${fixes.length} / ${leaves.length}`)

  if (fixes.length === 0) {
    console.log('✅ All baseline_end dates already match Excel truth.')
    return
  }

  console.log('\n📋 Sample fixes (first 15):')
  console.table(fixes.slice(0, 15).map(f => ({
    wbs: f.wbs,
    name: f.name.slice(0, 12),
    dur: `${f.dur}d`,
    start: f.start,
    old_end: f.oldEnd,
    new_end: f.newEnd,
  })))

  // Show distribution after fix
  const afterDist: Record<string, number> = {}
  for (const t of leaves) {
    const fix = fixes.find(f => f.id === t.id)
    const endStr = fix ? fix.newEnd : t.baseline_end
    const m = endStr.slice(0, 7)
    afterDist[m] = (afterDist[m] || 0) + 1
  }
  console.log('\n📅 AFTER fix — baseline_end distribution:')
  for (const [month, count] of Object.entries(afterDist).sort()) {
    console.log(`   ${month}: ${'█'.repeat(count)} (${count})`)
  }

  // Validate: planned progress at Feb 18
  const feb18Count = leaves.filter(t => {
    const fix = fixes.find(f => f.id === t.id)
    const endStr = fix ? fix.newEnd : t.baseline_end
    return endStr <= '2026-02-18'
  }).length
  console.log(`\n🎯 Planned at Feb 18: ${feb18Count}/${leaves.length} = ${((feb18Count/leaves.length)*100).toFixed(1)}%`)

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN complete. Run without --dry-run to apply.')
    return
  }

  console.log(`\n⚡ Writing ${fixes.length} updates...`)
  let ok = 0, fail = 0
  const BATCH = 20
  for (let i = 0; i < fixes.length; i += BATCH) {
    const batch = fixes.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(f => supabase.from('tasks').update({ baseline_end: f.newEnd }).eq('id', f.id))
    )
    for (const r of results) {
      if (r.error) { fail++; console.error(`   ❌ ${r.error.message}`) } else { ok++ }
    }
    process.stdout.write(`   ${Math.min(i + BATCH, fixes.length)}/${fixes.length}\r`)
  }

  console.log(`\n\n✅ Done! Fixed: ${ok}, Errors: ${fail}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
