/**
 * 数据修复脚本：重新分布 baseline_end 日期
 *
 * 问题：LA25463 项目的 72 个叶子任务的 baseline_end 集中在 2026-02/03，
 *       导致计划曲线（Cyan）在 3 月就冲到 100%，与项目实际跨度（01/26 ~ 06/22）严重脱节。
 *
 * 方案：按任务原始排序（baseline_start → wbs_id → id），将 baseline_end 线性分布到
 *       项目全周期 [PROJECT_START, PROJECT_END]，跳过周日。
 *
 * 用法：
 *   cd V3
 *   npx tsx scripts/fix-baseline-dates.ts --dry-run    # 预览，不写库
 *   npx tsx scripts/fix-baseline-dates.ts               # 执行写库
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const PROJECT_ID = 'LA25463'
const PROJECT_START = '2026-01-26' // 项目起点
const PROJECT_END   = '2026-03-23' // 项目终点（Excel 真实数据：WBS 21 巡检SPC数据 = 03/23）

const DRY_RUN = process.argv.includes('--dry-run')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ═══════════════════════════════════════════════════════════════
// Date Utilities (mirrors shared/workdays.ts — skip Sundays)
// ═══════════════════════════════════════════════════════════════

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add N work days (skip Sundays) */
function addWorkDays(start: Date, days: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) added++ // skip Sunday
  }
  return d
}

/** Count work days between two dates (inclusive both ends, skip Sundays) */
function workDaysBetween(start: Date, end: Date): number {
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    if (d.getDay() !== 0) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n🔧 Baseline Date Redistribution Script`)
  console.log(`   Project: ${PROJECT_ID}`)
  console.log(`   Range:   ${PROJECT_START} → ${PROJECT_END}`)
  console.log(`   Mode:    ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '⚡ LIVE (will update DB)'}\n`)

  // ── 1. Fetch all tasks ──
  const { data: allTasks, error } = await supabase
    .from('tasks')
    .select('id, name_cn, wbs_id, phase, track, stage, baseline_start, baseline_end, actual_end, is_milestone, is_merge_point, duration_days, weight')
    .eq('project_id', PROJECT_ID)
    .order('baseline_start', { ascending: true })

  if (error) { console.error('❌ Supabase error:', error.message); process.exit(1) }
  if (!allTasks || allTasks.length === 0) { console.error('❌ No tasks found'); process.exit(1) }

  console.log(`📊 Total rows fetched: ${allTasks.length}`)

  // ── 2. Filter leaf tasks (same logic as S-curve filterLeafTasks) ──
  const leafTasks = allTasks.filter(t =>
    !t.is_milestone &&
    !t.is_merge_point &&
    !!t.baseline_start &&
    !!t.baseline_end
  )

  console.log(`🍃 Leaf tasks: ${leafTasks.length}`)
  console.log(`🚫 Filtered out: ${allTasks.length - leafTasks.length} (milestones/merge points/no dates)\n`)

  // ── 3. Show BEFORE distribution ──
  const beforeDist: Record<string, number> = {}
  for (const t of leafTasks) {
    const d = parseLocalDate(t.baseline_end)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    beforeDist[key] = (beforeDist[key] || 0) + 1
  }
  console.log('📅 BEFORE — baseline_end month distribution:')
  for (const [month, count] of Object.entries(beforeDist).sort()) {
    const bar = '█'.repeat(count)
    console.log(`   ${month}: ${bar} (${count})`)
  }

  // ── 4. Sort leaf tasks by baseline_start → wbs_id → id (preserve logical order) ──
  leafTasks.sort((a, b) => {
    const cmpStart = (a.baseline_start || '').localeCompare(b.baseline_start || '')
    if (cmpStart !== 0) return cmpStart
    const cmpWbs = (a.wbs_id || '').localeCompare(b.wbs_id || '', undefined, { numeric: true })
    if (cmpWbs !== 0) return cmpWbs
    return (a.id || '').localeCompare(b.id || '')
  })

  // ── 5. Redistribute baseline_end across project span ──
  //
  // Strategy: Each task i (0-indexed) gets:
  //   baseline_end = PROJECT_START + floor(i / N * totalWorkDays) work days
  //
  // This ensures task 0 ends near the start, task N-1 ends at PROJECT_END,
  // and the distribution is perfectly linear.
  //
  // We also enforce: baseline_end >= baseline_start + duration_days
  // (a task can't end before its own planned duration)

  const projStart = parseLocalDate(PROJECT_START)
  const projEnd = parseLocalDate(PROJECT_END)
  const totalWorkDays = workDaysBetween(projStart, projEnd)
  const N = leafTasks.length

  console.log(`\n⏱️  Project work days: ${totalWorkDays} (${PROJECT_START} → ${PROJECT_END})`)
  console.log(`📐 Distributing ${N} tasks linearly...\n`)

  interface Update {
    id: string
    name_cn: string
    old_baseline_end: string
    new_baseline_end: string
    baseline_start: string
  }

  const updates: Update[] = []

  for (let i = 0; i < N; i++) {
    const t = leafTasks[i]

    // Linear slot: task i ends at (i+1)/N fraction of the total span
    const slotWorkDays = Math.floor(((i + 1) / N) * totalWorkDays)
    let newEnd = addWorkDays(projStart, slotWorkDays)

    // Enforce minimum: baseline_end >= baseline_start + duration_days
    const taskStart = parseLocalDate(t.baseline_start)
    const dur = Math.max(t.duration_days || 1, 1)
    const minEnd = addWorkDays(taskStart, dur)
    if (newEnd < minEnd) newEnd = minEnd

    // Don't exceed project end
    if (newEnd > projEnd) newEnd = projEnd

    const newEndStr = toDateStr(newEnd)

    if (newEndStr !== t.baseline_end) {
      updates.push({
        id: t.id,
        name_cn: t.name_cn,
        old_baseline_end: t.baseline_end,
        new_baseline_end: newEndStr,
        baseline_start: t.baseline_start,
      })
    }
  }

  console.log(`📝 Tasks to update: ${updates.length} / ${N}`)
  if (updates.length === 0) {
    console.log('✅ No changes needed.')
    return
  }

  // Show sample changes
  console.log('\n📋 Sample changes (first 10):')
  console.table(updates.slice(0, 10).map(u => ({
    name: u.name_cn.slice(0, 20),
    start: u.baseline_start,
    old_end: u.old_baseline_end,
    new_end: u.new_baseline_end,
  })))

  // ── 6. Show AFTER distribution ──
  const afterDist: Record<string, number> = {}
  for (let i = 0; i < N; i++) {
    const t = leafTasks[i]
    const upd = updates.find(u => u.id === t.id)
    const endStr = upd ? upd.new_baseline_end : t.baseline_end
    const d = parseLocalDate(endStr)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    afterDist[key] = (afterDist[key] || 0) + 1
  }
  console.log('\n📅 AFTER — baseline_end month distribution:')
  for (const [month, count] of Object.entries(afterDist).sort()) {
    const bar = '█'.repeat(count)
    console.log(`   ${month}: ${bar} (${count})`)
  }

  // ── 7. Validate: planned progress at Feb 18 should be ~14-18% ──
  const feb18 = new Date(2026, 1, 18) // Feb 18, 2026
  let plannedByFeb18 = 0
  for (let i = 0; i < N; i++) {
    const t = leafTasks[i]
    const upd = updates.find(u => u.id === t.id)
    const endStr = upd ? upd.new_baseline_end : t.baseline_end
    const d = parseLocalDate(endStr)
    if (d <= feb18) plannedByFeb18++
  }
  const plannedPct = ((plannedByFeb18 / N) * 100).toFixed(1)
  console.log(`\n🎯 Validation: Planned progress at Feb 18 = ${plannedByFeb18}/${N} = ${plannedPct}%`)
  if (Number(plannedPct) >= 14 && Number(plannedPct) <= 20) {
    console.log('   ✅ Within target range (14-20%)')
  } else {
    console.log(`   ⚠️  Outside target range (14-20%), got ${plannedPct}%`)
  }

  // ── 8. Execute DB updates ──
  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN complete. No database changes made.')
    console.log('   Run without --dry-run to apply changes.')
    return
  }

  console.log(`\n⚡ Writing ${updates.length} updates to Supabase...`)

  let successCount = 0
  let errorCount = 0

  // Batch in groups of 20 to avoid rate limits
  const BATCH_SIZE = 20
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    const promises = batch.map(u =>
      supabase
        .from('tasks')
        .update({ baseline_end: u.new_baseline_end })
        .eq('id', u.id)
    )
    const results = await Promise.all(promises)
    for (const r of results) {
      if (r.error) {
        errorCount++
        console.error(`   ❌ ${r.error.message}`)
      } else {
        successCount++
      }
    }
    process.stdout.write(`   Progress: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}\r`)
  }

  console.log(`\n\n✅ Done! Updated: ${successCount}, Errors: ${errorCount}`)
  console.log('   Refresh the S-curve page to verify the Cyan line now spans Jan → June.')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
