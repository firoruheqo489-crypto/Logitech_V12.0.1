import { useEffect, useMemo, useState } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  Area,
  ComposedChart,
} from 'recharts'
import { Activity, TrendingUp, AlertTriangle, Clock, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface TaskRow {
  id: string
  project_id: string
  name: string
  name_cn: string
  phase: string
  track?: string
  stage?: string
  weight?: number
  duration_days: number
  baseline_start: string
  baseline_end: string
  actual_start?: string
  actual_end?: string
  progress: number
  status: string
  is_milestone?: boolean
  is_merge_point?: boolean
}

/** S 曲线的 5 个里程碑节点定义 */
interface MilestoneNode {
  /** 匹配关键词（模糊匹配 name_cn） */
  keywords: string[]
  /** 对应的进度百分比 */
  progress: number
  /** 显示标签 */
  label: string
  /** 短标签 */
  shortLabel: string
}

/** 5 个关键里程碑节点 — 从 tasks 表中按 name_cn 模糊匹配 */
const MILESTONE_NODES: MilestoneNode[] = [
  { keywords: ['项目立项'], progress: 0, label: '项目立项', shortLabel: 'KO' },
  { keywords: ['模具Fai', '模具FAI', 'FaiCpk', 'FAICpk', 'mold_fai'], progress: 25, label: '模具FAI/CPK', shortLabel: 'FAI' },
  { keywords: ['T0综合报告', 't0_summary', 'T0综合'], progress: 50, label: 'T0综合报告', shortLabel: 'T0' },
  { keywords: ['T0问题闭环', 't0_closure', '闭环报告'], progress: 75, label: 'T0问题闭环', shortLabel: 'T1' },
  { keywords: ['巡检SPC', 'SPC数据', 'spc_inspection'], progress: 100, label: '巡检SPC数据', shortLabel: 'SPC' },
]

/** A single data point on the S-curve time axis (weekly) */
interface SCurvePoint {
  /** Week index (W0, W1, W2, ...) */
  week: number
  /** Date label for this week start */
  dateLabel: string
  /** Timestamp for sorting */
  timestamp: number
  /** Planned cumulative progress 0-100 */
  planned: number
  /** Actual cumulative progress 0-100 (null if in the future) */
  actual: number | null
  /** Forecast line (null until actual line ends) */
  forecast: number | null
  /** Milestone label if this week aligns with one */
  milestone?: string
}

interface SCurveMetrics {
  /** ΔQ: planned% - actual% at today */
  deltaQ: number
  /** ΔT: days between today and the date when planned curve hit current actual% */
  deltaT: number
  /** Predicted MP completion date based on 4-week velocity */
  predictedMpDate: Date | null
  /** Current actual progress (gated by today) */
  actualProgress: number
  /** Current planned progress (gated by today) */
  plannedProgress: number
  /** 全案达成率：所有有 actual_end 的任务 / 总数（不受 today 门控） */
  totalCompletion: number
  /** 当前阶段标签 */
  currentStage: string
  /** 任务完成数（gated by today） / 总数 */
  doneCount: number
  taskCount: number
  /** 项目目标完工日期（最后一个里程碑的 baselineStart） */
  targetDate: Date | null
}

export interface LogitechSCurveProps {
  /** Project ID used to query tasks table (e.g. "LA26006") */
  projectId: string
  /** Optional mold_id for display */
  moldNumber?: string
  className?: string
}

// ═══════════════════════════════════════════════════════════════
// Date Utilities
// ═══════════════════════════════════════════════════════════════

/** Parse VARCHAR date from DB to local Date — 与 Gantt 胶囊同源，避免 UTC 偏移 */
const parseDate = (dateStr?: string | null): Date | null => {
  if (!dateStr || dateStr.trim() === '') return null
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * 叶子任务过滤：保留所有有 baseline 日期的任务（用于图表曲线）
 */
function filterLeafTasks(tasks: TaskRow[]): TaskRow[] {
  return tasks.filter(t =>
    !!t.baseline_start &&
    !!t.baseline_end
  )
}

/** Get the Monday of the week containing this date */
const getWeekStart = (d: Date): Date => {
  const result = new Date(d)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Difference in calendar days */
const diffDays = (a: Date, b: Date): number =>
  Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))

/** Difference in weeks (floored) */
const diffWeeks = (a: Date, b: Date): number =>
  Math.floor(diffDays(a, b) / 7)

/** Format date to MM/DD */
const fmtShort = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`

// ═══════════════════════════════════════════════════════════════
// Milestone Extraction — 从 tasks 表模糊匹配 5 个关键节点
// ═══════════════════════════════════════════════════════════════

/** 从 tasks 数组中模糊匹配出 5 个里程碑节点 */
function extractMilestonesFromTasks(
  tasks: TaskRow[],
): { date: Date; actualDate: Date | null; progress: number; label: string; shortLabel: string; task: TaskRow }[] {
  const results: { date: Date; actualDate: Date | null; progress: number; label: string; shortLabel: string; task: TaskRow }[] = []

  for (const node of MILESTONE_NODES) {
    // 在所有任务中寻找 name_cn 包含任一关键词的任务
    const matched = tasks.find((t) => {
      const nameCn = (t.name_cn || '').replace(/\s+/g, '')
      const name = (t.name || '').replace(/\s+/g, '')
      const stage = (t.stage || '')
      return node.keywords.some((kw) => {
        const kwClean = kw.replace(/\s+/g, '')
        return nameCn.includes(kwClean) || name.includes(kwClean) || stage === kwClean
      })
    })

    if (matched) {
      const baselineDate = parseDate(matched.baseline_start)
      const actualDate = parseDate(matched.actual_end)
      if (baselineDate) {
        results.push({
          date: baselineDate,
          actualDate,
          progress: node.progress,
          label: node.label,
          shortLabel: node.shortLabel,
          task: matched,
        })
      }
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ═══════════════════════════════════════════════════════════════
// Core Computation Engine
// ═══════════════════════════════════════════════════════════════

/**
 * Build weekly S-curve data purely from the tasks table.
 *
 * Planned line: linear interpolation between 5 milestone tasks mapped to
 * fixed progress gates (项目立项=0%, 模具FAI=25%, T0综合=50%, T0闭环=75%, SPC=100%).
 *
 * Actual line: weighted progress from ALL tasks, bucketed by week.
 * If a milestone task has actual_end, the actual line reaches that gate's %.
 */
function buildSCurveData(
  tasks: TaskRow[],
): { points: SCurvePoint[]; metrics: SCurveMetrics } {
  const emptyMetrics: SCurveMetrics = {
    deltaQ: 0, deltaT: 0, predictedMpDate: null,
    actualProgress: 0, plannedProgress: 0, totalCompletion: 0,
    currentStage: 'N/A', doneCount: 0, taskCount: 0,
    targetDate: null,
  }

  if (tasks.length === 0) return { points: [], metrics: emptyMetrics }

  // ══════════════════════════════════════════════════════════════
  // SINGLE SOURCE OF TRUTH
  // ══════════════════════════════════════════════════════════════
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 开发模式：图表显示未来周的数据点（不截断），方便看完整曲线
  const isDev = import.meta.env.DEV

  const leafTasks = filterLeafTasks(tasks)
  const totalTasks = leafTasks.length
  if (totalTasks === 0) return { points: [], metrics: emptyMetrics }

  // ══════════════════════════════════════════════════════════════
  // UNIFIED COMPLETION LOGIC — 一个闸门，零例外
  //
  // isCompletedByDate(t, cutoff): actual_end 存在 且 <= cutoff
  // 图表曲线、摘要卡片、doneCount 全部用这一个函数
  //
  // totalCompletion: 全案达成率（不受日期门控，纯粹看有多少任务有 actual_end）
  // ══════════════════════════════════════════════════════════════
  const isCompletedByDate = (t: TaskRow, cutoff: Date): boolean => {
    const d = parseDate(t.actual_end)
    return !!d && d <= cutoff
  }

  const doneCount = leafTasks.filter(t => isCompletedByDate(t, today)).length
  const totalCompletionCount = leafTasks.filter(t => !!t.actual_end).length

  // ── 诊断日志 ──
  if (typeof console !== 'undefined') {
    const allWithActualEnd = leafTasks.filter(t => !!t.actual_end)
    console.log(
      `[S曲线·单一真相] ` +
      `模式=${isDev ? 'DEV(全量)' : 'PROD(today门控)'}, ` +
      `叶子=${totalTasks}, 有actual_end=${allWithActualEnd.length}, ` +
      `已完成=${doneCount}`
    )
  }

  // ── Milestones ──
  const milestones = extractMilestonesFromTasks(tasks)
  if (milestones.length < 2) return { points: [], metrics: emptyMetrics }

  const firstMs = milestones[0]
  const lastMs = milestones[milestones.length - 1]

  // ══════════════════════════════════════════════════════════════
  // X-AXIS: 从第一个里程碑到最后一个叶子任务的 max(baseline_end, actual_end)
  // 再加 1 周 padding，不再用 +52 周的无限延伸
  // ══════════════════════════════════════════════════════════════
  let latestDate = lastMs.date
  for (const t of leafTasks) {
    const bEnd = parseDate(t.baseline_end)
    const aEnd = parseDate(t.actual_end)
    if (bEnd && bEnd > latestDate) latestDate = bEnd
    if (aEnd && aEnd > latestDate) latestDate = aEnd
  }

  const weekStart0 = getWeekStart(firstMs.date)
  const dataEndWeek = diffWeeks(latestDate, weekStart0)
  const totalWeeks = dataEndWeek + 2 // +2 周 padding，不多不少

  // ══════════════════════════════════════════════════════════════
  // ACTUAL CURVE — 严格日期比较（actual_end <= weekDate）
  // 使用周起始日（weekDate）作为截止点，而非周末日（weekEndDate）
  // Dev:  不截断未来周，显示完整曲线直到 100%
  // Prod: 未来周返回 -1（null）
  // ══════════════════════════════════════════════════════════════
  const actualByWeek = (weekIdx: number): number => {
    const weekDate = new Date(weekStart0.getTime() + weekIdx * 7 * 86400000)
    if (!isDev && weekDate > today) return -1

    const count = leafTasks.filter(t => isCompletedByDate(t, weekDate)).length
    return (count / totalTasks) * 100
  }

  // ══════════════════════════════════════════════════════════════
  // PLANNED CURVE — 简单计数法（使用周起始日作为截止点）
  // ══════════════════════════════════════════════════════════════
  const plannedByWeek = (weekIdx: number): number => {
    const weekDate = new Date(weekStart0.getTime() + weekIdx * 7 * 86400000)
    const count = leafTasks.filter(t => {
      const d = parseDate(t.baseline_end)
      return !!d && d <= weekDate
    }).length
    return (count / totalTasks) * 100
  }

  // ── Build data points ──
  const points: SCurvePoint[] = []
  const actuals: { week: number; value: number }[] = []

  for (let w = 0; w <= totalWeeks; w++) {
    const weekDate = new Date(weekStart0.getTime() + w * 7 * 86400000)
    const planned = Math.round(plannedByWeek(w) * 100) / 100
    const rawActual = actualByWeek(w)
    const actual = rawActual >= 0 ? Math.round(rawActual * 100) / 100 : null

    let milestone: string | undefined
    for (const m of milestones) {
      if (diffWeeks(m.date, weekStart0) === w) { milestone = m.shortLabel; break }
    }

    if (actual !== null) actuals.push({ week: w, value: actual })

    points.push({
      week: w,
      dateLabel: fmtShort(weekDate),
      timestamp: weekDate.getTime(),
      planned,
      actual,
      forecast: null,
      milestone,
    })
  }

  // ── 注入精确 TODAY 数据点 ──
  const todayFractionalWeek = diffDays(today, weekStart0) / 7
  const todayExistsAsWeekPoint = points.some(p => p.dateLabel === fmtShort(today))
  if (!todayExistsAsWeekPoint) {
    const plannedAtToday = leafTasks.filter(t => {
      const d = parseDate(t.baseline_end)
      return !!d && d <= today
    }).length / totalTasks * 100
    const actualAtToday = (doneCount / totalTasks) * 100

    points.push({
      week: todayFractionalWeek,
      dateLabel: fmtShort(today),
      timestamp: today.getTime(),
      planned: Math.round(plannedAtToday * 100) / 100,
      actual: Math.round(actualAtToday * 100) / 100,
      forecast: null,
      milestone: undefined,
    })
    actuals.push({ week: todayFractionalWeek, value: Math.round(actualAtToday * 100) / 100 })
    points.sort((a, b) => a.timestamp - b.timestamp)
    actuals.sort((a, b) => a.week - b.week)
  }

  // ── Metrics at today — 统一闸门，摘要与曲线同源 ──
  const plannedTodayCount = leafTasks.filter(t => {
    const d = parseDate(t.baseline_end)
    return !!d && d <= today
  }).length
  const plannedToday = (plannedTodayCount / totalTasks) * 100
  const actualToday = (doneCount / totalTasks) * 100
  const totalCompletion = (totalCompletionCount / totalTasks) * 100
  const deltaQ = Math.round((plannedToday - actualToday) * 100) / 100

  // ── ΔT 偏差：逐日搜索 ──
  let deltaT = 0
  if (actualToday > 0) {
    const maxSearchDays = diffDays(latestDate, weekStart0) + 14
    for (let d = 0; d <= maxSearchDays; d++) {
      const searchDate = new Date(weekStart0.getTime() + d * 86400000)
      const plannedAtDate = leafTasks.filter(t => {
        const bl = parseDate(t.baseline_end)
        return !!bl && bl <= searchDate
      }).length / totalTasks * 100
      if (plannedAtDate >= actualToday) {
        deltaT = diffDays(today, searchDate)
        break
      }
    }
  }

  if (typeof console !== 'undefined') {
    console.log(
      `[S曲线] plannedToday: ${plannedTodayCount}/${totalTasks} = ${plannedToday.toFixed(1)}%, ` +
      `actual: ${doneCount}/${totalTasks} = ${actualToday.toFixed(1)}%, ΔT=${deltaT}d`
    )
  }

  // ══════════════════════════════════════════════════════════════
  // FORECAST — 21工序逻辑预测完工日期
  //
  // 旧逻辑（76叶子任务）在"四合一"后产生"斜率消失"：
  //   4个前置完成后，进度停在5.26%不动，velocity≈0 → 预测线断流
  //
  // 新逻辑：用21工序模型计算速度
  //   总工序 = 4(前置) + 14(泳道四合一) + 3(后续) = 21
  //   泳道四合一：4条泳道各14道工序，取每道工序的max(actual_end)
  //   完成判定：21工序中有多少在today之前完成
  //   速度 = 已完成工序数 / 已用天数
  //   预测完工 = today + 剩余工序 / 速度
  // ══════════════════════════════════════════════════════════════
  let predictedMpDate: Date | null = null

  // 检查是否所有叶子任务都有 actual_end（100% 数据模式）
  const allHaveActualEnd = leafTasks.every(t => !!t.actual_end)
  if (allHaveActualEnd) {
    let latest = new Date(0)
    for (const t of leafTasks) {
      const d = parseDate(t.actual_end)!
      if (d > latest) latest = d
    }
    predictedMpDate = latest
  } else {
    // ── 21工序模型 ──
    // 前置工序: 项目立项 + 2D图纸 + 3D图纸 + MTD = 4道
    const PREP_NAMES = ['项目立项', '2D图纸', '3D图纸', 'MTD']
    const prepTasks = leafTasks.filter(t => {
      const name = (t.name_cn || '').trim()
      return PREP_NAMES.includes(name)
    })
    // 泳道工序: 4条泳道各有14道工序，四合一后算14道
    const TRACKS = ['cavity_core', 'cavity_insert', 'lifter', 'slider']
    const trackTasks = leafTasks.filter(t => t.track && TRACKS.includes(t.track))
    // 后续节点: 非前置、非泳道的任务
    const postTasks = leafTasks.filter(t => {
      const name = (t.name_cn || '').trim()
      const isPrepName = PREP_NAMES.includes(name)
      const isTrack = t.track && TRACKS.includes(t.track)
      return !isPrepName && !isTrack
    })

    // 获取泳道中每道工序的唯一名称列表（用第一条泳道的工序名）
    const firstTrackTasks = trackTasks
      .filter(t => t.track === TRACKS[0])
      .sort((a, b) => {
        const da = parseDate(a.baseline_start)
        const db = parseDate(b.baseline_start)
        return (da?.getTime() || 0) - (db?.getTime() || 0)
      })

    // 计算21工序的完成数和baseline_end
    // 结构: { name, baseline_end, actual_end, completed }
    type Process21 = { name: string; baselineEnd: Date | null; actualEnd: Date | null; completed: boolean }
    const processes21: Process21[] = []

    // 1) 前置工序 (4道)
    for (const t of prepTasks) {
      const ae = parseDate(t.actual_end)
      processes21.push({
        name: t.name_cn,
        baselineEnd: parseDate(t.baseline_end),
        actualEnd: ae,
        completed: !!ae && ae <= today,
      })
    }

    // 2) 泳道四合一 (14道) — 每道工序取4条泳道中最晚的actual_end
    for (const refTask of firstTrackTasks) {
      // 找到4条泳道中同名/同stage的工序
      const siblings = trackTasks.filter(t => {
        // 匹配方式：同stage 或 同name_cn
        return (t.stage && refTask.stage && t.stage === refTask.stage) ||
               (t.name_cn === refTask.name_cn)
      })

      // 取最晚的 baseline_end
      let latestBE: Date | null = null
      for (const s of siblings) {
        const be = parseDate(s.baseline_end)
        if (be && (!latestBE || be > latestBE)) latestBE = be
      }

      // 四合一完成判定：所有4条泳道都完成了这道工序
      const allSiblingsComplete = siblings.length >= 4 &&
        siblings.every(s => {
          const ae = parseDate(s.actual_end)
          return !!ae && ae <= today
        })

      // 取最晚的 actual_end 作为四合一的完成日期
      let latestAE: Date | null = null
      if (allSiblingsComplete) {
        for (const s of siblings) {
          const ae = parseDate(s.actual_end)
          if (ae && (!latestAE || ae > latestAE)) latestAE = ae
        }
      }

      processes21.push({
        name: refTask.name_cn + '(四合一)',
        baselineEnd: latestBE,
        actualEnd: latestAE,
        completed: allSiblingsComplete,
      })
    }

    // 3) 后续节点
    for (const t of postTasks) {
      const ae = parseDate(t.actual_end)
      processes21.push({
        name: t.name_cn,
        baselineEnd: parseDate(t.baseline_end),
        actualEnd: ae,
        completed: !!ae && ae <= today,
      })
    }

    const total21 = processes21.length
    const done21 = processes21.filter(p => p.completed).length

    console.log(
      `[S曲线·21工序预测] 总工序=${total21}, 已完成=${done21}, ` +
      `前置=${prepTasks.length}, 泳道合一=${firstTrackTasks.length}, 后续=${postTasks.length}`
    )

    // ── 速度计算 ──
    // 项目开始日期 = 第一个里程碑日期
    const projectStart = firstMs.date
    const elapsedDays = diffDays(today, projectStart)

    if (done21 > 0 && elapsedDays > 0 && done21 < total21) {
      // 速度 = 已完成工序数 / 已用天数
      const velocityPerDay = done21 / elapsedDays
      const remaining21 = total21 - done21
      const daysToFinish = Math.ceil(remaining21 / velocityPerDay)
      predictedMpDate = new Date(today.getTime() + daysToFinish * 86400000)

      // 预测线：从today的actual点 → 100% at predictedMpDate
      // 用每周步进来生成forecast数据点
      const lastActual = actuals[actuals.length - 1]
      if (lastActual) {
        // 在today的数据点上设置forecast起点（与actual重合）
        const todayPoint = points.find(p => p.dateLabel === fmtShort(today))
        if (todayPoint) todayPoint.forecast = todayPoint.actual

        const predictedWeek = (predictedMpDate.getTime() - weekStart0.getTime()) / (7 * 86400000)
        const startWeek = lastActual.week
        const startPct = lastActual.value
        const weekSpan = predictedWeek - startWeek

        if (weekSpan > 0) {
          const pctPerWeek = (100 - startPct) / weekSpan
          // 生成中间点（每周一个）
          const maxForecastWeek = Math.ceil(predictedWeek) + 1
          for (let fw = Math.ceil(startWeek) + 1; fw <= maxForecastWeek; fw++) {
            const pct = Math.min(100, startPct + pctPerWeek * (fw - startWeek))
            const existing = points.find(p => p.week === fw)
            if (existing) {
              existing.forecast = Math.round(pct * 100) / 100
            } else {
              const weekDate = new Date(weekStart0.getTime() + fw * 7 * 86400000)
              points.push({
                week: fw,
                dateLabel: fmtShort(weekDate),
                timestamp: weekDate.getTime(),
                planned: 100,
                actual: null,
                forecast: Math.round(pct * 100) / 100,
                milestone: pct >= 100 ? '预测完工' : undefined,
              })
            }
          }
        }
      }

      console.log(
        `[S曲线·21工序预测] 速度=${velocityPerDay.toFixed(3)}工序/天, ` +
        `剩余=${remaining21}工序, 预计${daysToFinish}天后完工, ` +
        `预测完工=${fmtShort(predictedMpDate)}`
      )
    } else if (done21 >= total21) {
      // 全部完成
      let latest = new Date(0)
      for (const p of processes21) {
        if (p.actualEnd && p.actualEnd > latest) latest = p.actualEnd
      }
      predictedMpDate = latest
    }
  }

  points.sort((a, b) => a.week - b.week)

  // ── Current stage ──
  let currentStage = milestones[0]?.label || 'N/A'
  for (const ms of milestones) {
    if (ms.actualDate) {
      const nextIdx = milestones.indexOf(ms) + 1
      currentStage = nextIdx < milestones.length ? milestones[nextIdx].label : ms.label + ' ✓'
    }
  }

  return {
    points,
    metrics: {
      deltaQ,
      deltaT,
      predictedMpDate,
      actualProgress: Math.round(actualToday * 100) / 100,
      plannedProgress: Math.round(plannedToday * 100) / 100,
      totalCompletion: Math.round(totalCompletion * 100) / 100,
      currentStage,
      doneCount,
      taskCount: totalTasks,
      targetDate: lastMs.date,
    },
  }
}



// ═══════════════════════════════════════════════════════════════
// Custom Tooltip Component
// ═══════════════════════════════════════════════════════════════

function SCurveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const planned = payload.find((p: any) => p.dataKey === 'planned')?.value
  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value
  const forecast = payload.find((p: any) => p.dataKey === 'forecast')?.value
  const milestone = payload[0]?.payload?.milestone

  return (
    <div className="bg-gray-900/95 border border-white/10 rounded-xl p-4 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="font-bold text-white mb-2 flex items-center gap-2">
        {label}
        {milestone && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">
            {milestone}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {planned != null && (
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            <span className="text-gray-400 text-sm">计划:</span>
            <span className="text-cyan-400 font-bold">{planned.toFixed(1)}%</span>
          </div>
        )}
        {actual != null && (
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="text-gray-400 text-sm">实际:</span>
            <span className="text-yellow-400 font-bold">{actual.toFixed(1)}%</span>
          </div>
        )}
        {forecast != null && actual == null && (
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(255,156,110,0.6)]" />
            <span className="text-gray-400 text-sm">预测:</span>
            <span className="text-orange-400 font-bold">{forecast.toFixed(1)}%</span>
          </div>
        )}
        {actual != null && planned != null && (
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <TrendingUp
                className={cn('w-4 h-4', actual >= planned ? 'text-emerald-400' : 'text-red-400 rotate-180')}
              />
              <span className="text-gray-400 text-sm">偏差:</span>
              <span className={cn('font-bold', actual >= planned ? 'text-emerald-400' : 'text-red-400')}>
                {actual >= planned ? '+' : ''}{(actual - planned).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export function LogitechSCurve({ projectId, moldNumber, className = '' }: LogitechSCurveProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch ALL tasks for this project via local API (避免浏览器直连 Supabase 的跨域/网络问题) ──
  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const res = await apiFetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const taskRows = await res.json()
        if (!cancelled) setTasks((taskRows as TaskRow[]) || [])
      } catch (e: any) {
        if (!cancelled) setError(e.message || '数据加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [projectId])

  // ── Compute S-curve (purely from tasks) ──
  const { points, metrics } = useMemo(
    () => buildSCurveData(tasks),
    [tasks],
  )

  // ── Find today's label for reference line ──
  // 因为 buildSCurveData 已经注入了精确的 today 数据点，
  // 直接用 today 的 dateLabel 即可
  const todayLabel = useMemo(() => {
    if (points.length === 0) return ''
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return fmtShort(today)
  }, [points])

  // ── Debug: log matched milestones ──
  useEffect(() => {
    if (tasks.length > 0) {
      const ms = extractMilestonesFromTasks(tasks)
      const leaves = filterLeafTasks(tasks)
      console.log(`[S曲线] projectId=${projectId}, 总行=${tasks.length}, 叶子工序=${leaves.length}, 里程碑=${ms.length}:`,
        ms.map((m) => `${m.label}(${m.task.name_cn} → ${m.date.toISOString().slice(0, 10)})`))
    }
  }, [tasks, projectId])

  // ── Render ──
  if (loading) {
    return (
      <div className={cn('rounded-2xl bg-[#1a1a1a] border border-white/10 p-6 flex items-center justify-center', className)}>
        <span className="inline-block w-5 h-5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mr-3" />
        <span className="text-white/40 text-sm">加载 S 曲线数据…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-2xl bg-[#1a1a1a] border border-white/10 p-6', className)}>
        <div className="flex items-center gap-3 text-white/40">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }

  if (points.length === 0) {
    // Show diagnostic info to help debug
    const ms = extractMilestonesFromTasks(tasks)
    return (
      <div className={cn('rounded-2xl bg-[#1a1a1a] border border-white/10 p-6', className)}>
        <div className="flex items-center gap-3 text-white/40 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-sm">
            暂无里程碑数据 — 在 {tasks.length} 行中过滤出 {filterLeafTasks(tasks).length} 个叶子工序，匹配到 {ms.length}/5 个里程碑节点
          </span>
        </div>
        {tasks.length > 0 && (
          <div className="text-[10px] text-white/20 space-y-1">
            <div>需要匹配的关键词: 项目立项 / 模具FaiCpk报告 / T0综合报告 / T0问题闭环报告 / 巡检SPC数据</div>
            <div>已有工序名: {tasks.slice(0, 8).map((t) => t.name_cn).join(', ')}{tasks.length > 8 ? '…' : ''}</div>
          </div>
        )}
      </div>
    )
  }

  const isAhead = metrics.deltaQ <= 0
  const isWayAhead = metrics.deltaQ < -20 // 超前 20% 以上
  // ── Issue 1 Fix: 预测延误判定 ──
  // 即使当前 ΔQ 显示"正常"，如果预测完工日超过目标日期，状态应为"预测延误"
  const isPredictedLate = !!(
    metrics.predictedMpDate &&
    metrics.targetDate &&
    metrics.predictedMpDate > metrics.targetDate
  )
  const statusColor = isPredictedLate ? 'text-orange-400' : isAhead ? 'text-emerald-400' : 'text-red-400'

  // Decide X-axis tick interval based on total weeks
  const totalWeeks = points.length
  const tickInterval = totalWeeks > 30 ? 3 : totalWeeks > 16 ? 2 : 1

  return (
    <div className={cn('relative rounded-2xl bg-[#1a1a1a] border border-white/10 backdrop-blur-xl p-4', className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">项目进度 S 曲线</h3>
            <p className="text-sm text-gray-400">
              {projectId}
              {moldNumber && moldNumber !== projectId && (
                <span className="ml-2 text-gray-500">({moldNumber})</span>
              )}
            </p>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">实际进度</div>
            <div className="text-2xl font-bold text-yellow-400 tabular-nums">
              {metrics.actualProgress.toFixed(1)}%
            </div>
          </div>

          <div className="w-px h-10 bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1 justify-end">
              <Target className="w-3 h-3" /> ΔQ 偏差
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', statusColor)}>
              {metrics.deltaQ > 0 ? '+' : ''}{metrics.deltaQ.toFixed(1)}%
            </div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" /> ΔT 偏差
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', metrics.deltaT > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {metrics.deltaT > 0 ? '+' : ''}{metrics.deltaT}d
            </div>
          </div>
          {metrics.predictedMpDate && (
            <>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">预测完工</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: isPredictedLate ? '#ff6b6b' : '#ff9c6e' }}>
                  {fmtShort(metrics.predictedMpDate)}
                </div>
              </div>
            </>
          )}
          {metrics.targetDate && (
            <>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">目标结案</div>
                <div className="text-lg font-bold tabular-nums text-cyan-400">
                  {fmtShort(metrics.targetDate)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="relative">
        <ResponsiveContainer width="100%" aspect={5}>
          <ComposedChart
            data={points}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="actual-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#facc15" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="area-planned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />

            <XAxis
              dataKey="dateLabel"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              interval={tickInterval}
            />

            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />

            {/* Today reference line */}
            {todayLabel && (
              <ReferenceLine
                x={todayLabel}
                stroke="#22d3ee"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                  value: 'TODAY',
                  position: 'top',
                  fill: '#22d3ee',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
            )}

            {/* Milestone reference lines */}
            {points
              .filter((p: SCurvePoint) => p.milestone && p.milestone !== '预测完工')
              .map((p: SCurvePoint) => (
                <ReferenceLine
                  key={p.milestone}
                  x={p.dateLabel}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="2 4"
                  label={{
                    value: p.milestone!,
                    position: 'insideTopRight',
                    fill: '#6b7280',
                    fontSize: 9,
                  }}
                />
              ))}

            <Tooltip content={<SCurveTooltip />} />

            <Legend
              wrapperStyle={{ paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}
              iconType="line"
              align="right"
              payload={[
                { value: 'planned', type: 'line', color: '#22d3ee', id: 'planned-line' },
                { value: 'actual', type: 'line', color: '#facc15', id: 'actual-line' },
                { value: 'forecast', type: 'line', color: '#ff9c6e', id: 'forecast-line' },
              ]}
              formatter={(value: string) => {
                const labels: Record<string, { text: string; color: string }> = {
                  planned: { text: '计划曲线', color: '#22d3ee' },
                  actual: { text: '实际曲线', color: '#facc15' },
                  forecast: { text: '预测趋势', color: '#ff9c6e' },
                }
                const l = labels[value]
                return l ? <span style={{ color: l.color, fontSize: '12px', fontWeight: 700 }}>{l.text}</span> : value
              }}
            />

            {/* Planned area fill — legendType="none" to avoid duplicate legend entry */}
            <Area
              type="monotone"
              dataKey="planned"
              fill="url(#area-planned)"
              stroke="none"
              legendType="none"
            />

            {/* Planned Line – Cyan dashed with glow */}
            <Line
              type="monotone"
              dataKey="planned"
              stroke="#22d3ee"
              strokeWidth={3}
              strokeDasharray="8 4"
              dot={false}
              activeDot={{ r: 6, fill: '#22d3ee', stroke: '#1a1a1a', strokeWidth: 2 }}
              style={{ filter: 'url(#glow-cyan)' }}
            />

            {/* Actual Line – Yellow solid with glow */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="url(#actual-gradient)"
              strokeWidth={4}
              dot={{ fill: '#facc15', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 7, fill: '#facc15', stroke: '#fff', strokeWidth: 2 }}
              style={{ filter: 'url(#glow-yellow)' }}
              connectNulls={false}
            />

            {/* Forecast Line – Orange dashed with glow */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#ff9c6e"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 5, fill: '#ff9c6e', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={true}
              style={{ filter: 'url(#glow-orange)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Status Bar ── */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">当前阶段</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-cyan-400 truncate">
            {metrics.currentStage}
          </div>
        </div>

        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">任务数</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-yellow-400 tabular-nums">
            {metrics.doneCount}/{metrics.taskCount}
            <span className="text-gray-500 text-xs ml-1">完成</span>
          </div>
        </div>

        <div className={cn('rounded-lg p-2 border',
          metrics.deltaQ < 0 ? 'bg-emerald-500/10 border-emerald-500/20'
          : metrics.deltaQ === 0 ? 'bg-cyan-500/10 border-cyan-500/20'
          : 'bg-red-500/10 border-red-500/20'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full',
              metrics.deltaQ < 0 ? 'bg-emerald-400' : metrics.deltaQ === 0 ? 'bg-cyan-400' : 'bg-red-400 animate-pulse'
            )} />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">实际状态</span>
          </div>
          <div className={cn('mt-1 text-sm font-semibold',
            metrics.deltaQ < 0 ? 'text-emerald-400' : metrics.deltaQ === 0 ? 'text-cyan-400' : 'text-red-400'
          )}>
            {metrics.deltaQ < 0
              ? `超前 ${Math.abs(metrics.deltaQ).toFixed(1)}%`
              : metrics.deltaQ === 0
                ? '进度同步'
                : `落后 ${metrics.deltaQ.toFixed(1)}%`}
          </div>
        </div>
      </div>

      {/* ── 算法说明 ── */}
      <details className="mt-4 group">
        <summary className="text-[11px] text-white/25 cursor-pointer hover:text-white/40 transition-colors select-none">
          ℹ 指标算法说明
        </summary>
        <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.06] p-4 text-[11px] leading-relaxed text-white/35 space-y-3">
          <div>
            <span className="text-cyan-400/60 font-bold">ΔQ 偏差</span>
            <span className="mx-1">=</span>
            计划进度 − 实际进度。计划进度按 baseline_end ≤ 今天的叶子任务占比计算；实际进度按 actual_end ≤ 今天的叶子任务占比计算。ΔQ {'>'} 0 表示落后于计划。
          </div>
          <div>
            <span className="text-cyan-400/60 font-bold">ΔT 偏差</span>
            <span className="mx-1">=</span>
            在计划曲线上找到与当前实际进度相同的日期，与今天的天数差。ΔT {'>'} 0 表示实际进度对应的计划日期在今天之后（即落后）。
          </div>
          <div>
            <span className="text-orange-400/60 font-bold">预测完工</span>
            <span className="mx-1">—</span>
            采用 21 工序模型：将 {metrics.taskCount} 个叶子任务压缩为 4 道前置 + 14 道泳道四合一 + 后续节点 ≈ 21 道超级工序。泳道四合一要求 4 条泳道全部完成同一工序才算达成。速度 = 已完成工序数 ÷ 已用天数，预测完工 = 今天 + 剩余工序 ÷ 速度。
          </div>
          <div>
            <span className="text-red-400/60 font-bold">状态判定</span>
            <span className="mx-1">—</span>
            若预测完工日期超过目标结案日期，状态为"预测延误"；否则按 ΔQ 判断"进度正常"或"延迟"。
          </div>
        </div>
      </details>
    </div>
  )
}
