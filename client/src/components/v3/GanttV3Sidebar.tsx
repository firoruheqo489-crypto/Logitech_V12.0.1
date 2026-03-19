/**
 * GanttV3Sidebar — 4-Level Hierarchy (VS Code File Tree)
 *
 * L1 (项目头): Shown in fixed sidebar header (GanttV3Chart)
 * L2 (大阶段): 开模 / T0试模 / 闭环T0 / 试生产
 * L3 (子系统): 热流道 / 模架 (only under 开模)
 * Track (泳道): 前模仁 / 后模仁 / 镶件 / 滑块
 * L4 (工序): 铣床 / CNC开粗 / HRC ... / 钳工 / FIT模
 *
 * Every level supports collapse. Collapse syncs with Gantt body.
 */

import type React from 'react';
import {
  ChevronRight,
  Layers,
  Wrench,
  Zap,
  ShieldCheck,
  Rocket,
  Flame,
  Box,
  FileText,
} from 'lucide-react';
import type { TaskNode, TrackGroup, PhaseType } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';
import { calcTaskPerformance } from '@shared/workdays';
import { getGanttTaskStatusColor, isGanttTaskDone } from '@/lib/ganttTaskStatus';

// ═══════════════════════════════════════════════════════════════════════════════
// Hierarchy Types
// ═══════════════════════════════════════════════════════════════════════════════

export type HierarchyType = 'l2' | 'l3' | 'track' | 'task';

export interface HierarchyItem {
  type: HierarchyType;
  id: string;
  label: string;
  phase: PhaseType;
  task?: TaskNode;
  parentIds: string[];
  taskCount?: number;
  completedCount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Post-Merge Task Categorization (严格按 WBS 层级)
// ═══════════════════════════════════════════════════════════════════════════════

/** 4-to-1 汇聚点 — sits at the end of 开模 phase */
const MERGE_POINT_ID = 'mold_fai_cpk';

/** 新模板开模相关（无四泳道时平铺在开模分组） */
const KAIMO_FLAT_IDS = new Set([
  'mold_dev_pioneer',
  'open_mold',
  'close_mold',
]);

/** 项目准备 阶段 (WBS 1-4) */
const PROJECT_PREP_IDS = new Set([
  'project_launch', 'drawing_2d', 'drawing_3d', 'mtd',
]);

/** T0试模 阶段 (WBS 7-11) — T0试模 → 三份报告 → T0综合报告 */
const T0_TRIAL_IDS = new Set([
  't0_trial', 't0_fai_report', 't0_appearance', 't0_3d_report', 't0_summary',
  'blackbox_a_converge',
  't0_first_trial',
  't0_appearance_eval',
  'issue_review_repair_flow',
  't0_issue_summary',
  'repair_plan',
  'moldbao_repair',
  't0_sample_send',
  'white_mold_buffer_pool',
  'tn_trial_repair_loop',
  'etching_gate',
  'dimension_ready',
  'structure_interference_clear',
]);

/** T1问题闭环 阶段 (WBS 12-16) — T1试模 → G/L → T1尺寸达标 → 试模次数 → T0问题闭环报告 */
const T1_CLOSURE_IDS = new Set([
  't1_trial', 'gl', 't1_dimension', 'trial_count', 't0_closure_report',
  'blackbox_b_converge',
  'etching_process',
  'post_etch_trial_validation',
  't0_trial_post_etch',
  'gloss_roughness_test',
  'post_etch_fai_recheck',
  'post_etch_3d_recheck',
  'issue_closure_confirm',
  'post_etch_sample_send',
  'texture_appearance_tuning_loop',
]);

/** 转量产 阶段 (WBS 17-21) — VMP → SIP → SOP → 机台参数表 → 巡检SPC数据 */
const PRODUCTION_IDS = new Set([
  'vmp', 'sip', 'sop', 'machine_params', 'spc_inspection',
  'prr_trial_gate',
  'system_data_localize',
  'moldbao_upload_new_mold_data',
  'ms_upload_new_mold_data',
  'notify_trial_by_email',
  'formal_trial_run',
  'sample_signoff',
  'customer_sample_confirmation',
  'cpk_32_measurement',
  'trial_3d_scan',
  'customer_other_tests',
  'transfer_to_mp',
  'customer_pilot_run',
  'customer_pilot_passed',
  'internal_mail_mold_to_mp',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Hierarchy Builder
// ═══════════════════════════════════════════════════════════════════════════════

function stats(tasks: TaskNode[]) {
  return {
    taskCount: tasks.length,
    completedCount: tasks.filter((t) => t.status === 'Done').length,
  };
}

export function buildHierarchy(
  tracks: TrackGroup[],
  postMergeTasks: TaskNode[],
): HierarchyItem[] {
  const items: HierarchyItem[] = [];

  // ─── Find merge task (模具Fai Cpk报告) ───
  const mergeTask = postMergeTasks.find((t) => (t.stage ?? t.id) === MERGE_POINT_ID);
  const kaimoFlatTasks = postMergeTasks
    .filter((t) => KAIMO_FLAT_IDS.has(t.stage ?? t.id))
    .sort((a, b) => a.stageOrder - b.stageOrder);
  const allTrackTasks = tracks.flatMap((t) => t.tasks);
  const kaimoTotalTasks = [...allTrackTasks, ...kaimoFlatTasks, ...(mergeTask ? [mergeTask] : [])];

  // ═══ L2: 项目准备 (WBS 1-4) ═══
  const prepId = 'l2:project_prep';
  const prepTasks = postMergeTasks
    .filter((t) => PROJECT_PREP_IDS.has(t.stage ?? t.id))
    .sort((a, b) => a.stageOrder - b.stageOrder);
  if (prepTasks.length > 0) {
    items.push({
      type: 'l2', id: prepId, label: '项目准备', phase: 'data',
      parentIds: [], ...stats(prepTasks),
    });
    for (const task of prepTasks) {
      items.push({
        type: 'task', id: task.id, label: task.nameCn, phase: task.phase,
        task, parentIds: [prepId],
      });
    }
  }

  // ═══ L2: 开模 ═══
  const kaimoId = 'l2:kaimo';
  items.push({
    type: 'l2', id: kaimoId, label: '开模', phase: 'physical',
    parentIds: [], ...stats(kaimoTotalTasks),
  });

  for (const task of kaimoFlatTasks) {
    items.push({
      type: 'task', id: task.id, label: task.nameCn, phase: 'physical',
      task, parentIds: [kaimoId],
    });
  }

  // L3: 热流道 (前模仁 cavity_core + 后模仁 cavity_insert)
  const hotRunnerId = 'l3:hot_runner';
  const hrTracks = tracks.filter((t) => t.id === 'cavity_core' || t.id === 'cavity_insert');
  if (hrTracks.length > 0) {
    items.push({
      type: 'l3', id: hotRunnerId, label: '热流道', phase: 'physical',
      parentIds: [kaimoId], ...stats(hrTracks.flatMap((t) => t.tasks)),
    });

    for (const track of hrTracks) {
      if (track.tasks.length === 0) continue; // 空泳道不渲染
      const trackId = `track:${track.id}`;
      items.push({
        type: 'track', id: trackId, label: track.nameCn, phase: 'physical',
        parentIds: [kaimoId, hotRunnerId], ...stats(track.tasks),
      });
      for (const task of [...track.tasks].sort((a, b) => a.stageOrder - b.stageOrder)) {
        items.push({
          type: 'task', id: task.id, label: task.nameCn, phase: 'physical',
          task, parentIds: [kaimoId, hotRunnerId, trackId],
        });
      }
    }
  }

  // L3: 模架 (镶件 lifter + 滑块 slider)
  const moldBaseId = 'l3:mold_base';
  const mbTracks = tracks.filter((t) => t.id === 'slider' || t.id === 'lifter');
  if (mbTracks.length > 0) {
    items.push({
      type: 'l3', id: moldBaseId, label: '模架', phase: 'physical',
      parentIds: [kaimoId], ...stats(mbTracks.flatMap((t) => t.tasks)),
    });

    for (const track of mbTracks) {
      if (track.tasks.length === 0) continue; // 空泳道不渲染
      const trackId = `track:${track.id}`;
      items.push({
        type: 'track', id: trackId, label: track.nameCn, phase: 'physical',
        parentIds: [kaimoId, moldBaseId], ...stats(track.tasks),
      });
      for (const task of [...track.tasks].sort((a, b) => a.stageOrder - b.stageOrder)) {
        items.push({
          type: 'task', id: task.id, label: task.nameCn, phase: 'physical',
          task, parentIds: [kaimoId, moldBaseId, trackId],
        });
      }
    }
  }

  // ── 汇聚点：模具Fai Cpk报告 (flat under 开模, after all tracks) ──
  if (mergeTask) {
    items.push({
      type: 'task', id: mergeTask.id, label: mergeTask.nameCn, phase: 'physical',
      task: mergeTask, parentIds: [kaimoId],
    });
  }

  // ═══ L2: T0 试模 (flat tasks — no sub-components) ═══
  // 严禁为空分组预留行 — 无任务则跳过
  const t0TrialId = 'l2:t0_trial';
  const t0Tasks = postMergeTasks
    .filter((t) => T0_TRIAL_IDS.has(t.stage ?? t.id))
    .sort((a, b) => a.stageOrder - b.stageOrder);
  if (t0Tasks.length > 0) {
    items.push({
      type: 'l2', id: t0TrialId, label: 'T0 试模', phase: 'data',
      parentIds: [], ...stats(t0Tasks),
    });
    for (const task of t0Tasks) {
      items.push({
        type: 'task', id: task.id,
        label: (task.stage ?? task.id) === 't0_trial_post_etch' ? 't0试模(咬花后)' : task.nameCn,
        phase: task.phase,
        task, parentIds: [t0TrialId],
      });
    }
  }

  // ═══ L2: T1 问题闭环 (flat tasks) ═══
  const closureId = 'l2:t0_closure';
  const closureTasks = postMergeTasks
    .filter((t) => T1_CLOSURE_IDS.has(t.stage ?? t.id))
    .sort((a, b) => a.stageOrder - b.stageOrder);
  if (closureTasks.length > 0) {
    items.push({
      type: 'l2', id: closureId, label: '收敛闭环', phase: 'data',
      parentIds: [], ...stats(closureTasks),
    });
    for (const task of closureTasks) {
      items.push({
        type: 'task', id: task.id,
        label: (task.stage ?? task.id) === 't0_trial_post_etch' ? 't0试模(咬花后)' : task.nameCn,
        phase: task.phase,
        task, parentIds: [closureId],
      });
    }
  }

  // ═══ L2: 转量产 (flat tasks) ═══
  const prodId = 'l2:production';
  const prodTasks = postMergeTasks
    .filter((t) => PRODUCTION_IDS.has(t.stage ?? t.id))
    .sort((a, b) => a.stageOrder - b.stageOrder);
  if (prodTasks.length > 0) {
    items.push({
      type: 'l2', id: prodId, label: '转量产', phase: 'production',
      parentIds: [], ...stats(prodTasks),
    });
    for (const task of prodTasks) {
      items.push({
        type: 'task', id: task.id, label: task.nameCn, phase: task.phase,
        task, parentIds: [prodId],
      });
    }
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Visibility
// ═══════════════════════════════════════════════════════════════════════════════

function isVisible(item: HierarchyItem, collapsed: Set<string>): boolean {
  return !item.parentIds.some((pid) => collapsed.has(pid));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Visual Constants
// ═══════════════════════════════════════════════════════════════════════════════

const L2_ICONS: Record<string, React.ReactNode> = {
  'l2:project_prep': <FileText className="w-3.5 h-3.5" />,
  'l2:kaimo': <Wrench className="w-3.5 h-3.5" />,
  'l2:t0_trial': <Zap className="w-3.5 h-3.5" />,
  'l2:t0_closure': <ShieldCheck className="w-3.5 h-3.5" />,
  'l2:production': <Rocket className="w-3.5 h-3.5" />,
};

const L3_ICONS: Record<string, React.ReactNode> = {
  'l3:hot_runner': <Flame className="w-3 h-3" />,
  'l3:mold_base': <Box className="w-3 h-3" />,
};

// Indentation per level (in px)
const INDENT: Record<HierarchyType, number> = {
  l2: 8,
  l3: 20,
  track: 32,
  task: 40,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar Props
// ═══════════════════════════════════════════════════════════════════════════════

interface SidebarProps {
  tracks: TrackGroup[];
  postMergeTasks: TaskNode[];
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  collapsedGroups: Set<string>;
  onTaskClick: (task: TaskNode) => void;
  onToggleGroup: (groupId: string) => void;
  onHoverTask: (taskId: string | null) => void;
  rowHeight: number;
  groupHeaderHeight: number;
  evidenceCounts?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function GanttV3Sidebar({
  tracks,
  postMergeTasks,
  selectedTaskId,
  hoveredTaskId,
  collapsedGroups,
  onTaskClick,
  onToggleGroup,
  onHoverTask,
  rowHeight,
  groupHeaderHeight,
  evidenceCounts,
}: SidebarProps) {
  const items = buildHierarchy(tracks, postMergeTasks);

  // Global task row counter for zebra-stripe (synced with gantt body)
  let taskRowIdx = 0;

  return (
    <div className="h-full">
      {items.map((item) => {
        if (!isVisible(item, collapsedGroups)) return null;

        // ── L2 Header (大阶段) ──
        if (item.type === 'l2') {
          const isCollapsed = collapsedGroups.has(item.id);
          const colors = PHASE_COLORS[item.phase];
          const icon = L2_ICONS[item.id];

          return (
            <div
              key={item.id}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 border-b border-white/[0.04] hover:bg-white/[0.04] box-border"
              style={{
                height: groupHeaderHeight,
                paddingLeft: INDENT.l2,
                paddingRight: 12,
                background: `linear-gradient(90deg, ${colors.primary}10, transparent 60%)`,
              }}
              onClick={() => onToggleGroup(item.id)}
            >
              <span
                className="text-white/30 transition-transform duration-200 shrink-0"
                style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
              >
                <ChevronRight className="w-3 h-3" />
              </span>
              <span className="shrink-0" style={{ color: colors.primary }}>{icon}</span>
              <span
                className="text-[13px] font-extrabold text-white/80 flex-1 tracking-wide truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {item.label}
              </span>
              <span
                className="text-[11px] px-1.5 py-0.5 rounded-full text-white/40 shrink-0"
                style={{ fontFamily: 'var(--font-mono)', backgroundColor: `${colors.primary}12` }}
              >
                {item.completedCount}/{item.taskCount}
              </span>
            </div>
          );
        }

        // ── L3 Header (子系统) ──
        if (item.type === 'l3') {
          const isCollapsed = collapsedGroups.has(item.id);
          const colors = PHASE_COLORS[item.phase];
          const icon = L3_ICONS[item.id] || <Box className="w-3 h-3" />;

          return (
            <div
              key={item.id}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 border-b border-white/[0.02] hover:bg-white/[0.03] box-border"
              style={{
                height: groupHeaderHeight,
                paddingLeft: INDENT.l3,
                paddingRight: 12,
                background: `linear-gradient(90deg, ${colors.primary}06, transparent 50%)`,
              }}
              onClick={() => onToggleGroup(item.id)}
            >
              <span
                className="text-white/25 transition-transform duration-200 shrink-0"
                style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
              >
                <ChevronRight className="w-2.5 h-2.5" />
              </span>
              <span className="shrink-0" style={{ color: `${colors.primary}90` }}>{icon}</span>
              <span
                className="text-[12px] font-bold text-white/60 flex-1 tracking-wide truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {item.label}
              </span>
              <span
                className="text-[10px] px-1 py-0.5 rounded-full text-white/30 shrink-0"
                style={{ fontFamily: 'var(--font-mono)', backgroundColor: `${colors.primary}08` }}
              >
                {item.completedCount}/{item.taskCount}
              </span>
            </div>
          );
        }

        // ── Track Header (泳道) ──
        if (item.type === 'track') {
          const isCollapsed = collapsedGroups.has(item.id);
          const colors = PHASE_COLORS[item.phase];

          return (
            <div
              key={item.id}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 border-b border-white/[0.02] hover:bg-white/[0.03] box-border"
              style={{
                height: groupHeaderHeight,
                paddingLeft: INDENT.track,
                paddingRight: 12,
              }}
              onClick={() => onToggleGroup(item.id)}
            >
              <span
                className="text-white/20 transition-transform duration-200 shrink-0"
                style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
              >
                <ChevronRight className="w-2.5 h-2.5" />
              </span>
              <Layers className="w-3 h-3 shrink-0" style={{ color: `${colors.primary}70` }} />
              <span
                className="text-[12px] font-semibold text-white/50 flex-1 truncate"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {item.label}
              </span>
              <span
                className="text-[10px] px-1 py-0.5 rounded-full text-white/25 shrink-0"
                style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                {item.completedCount}/{item.taskCount}
              </span>
            </div>
          );
        }

        // ── Task Row (L4 工序) ──
        if (item.type === 'task' && item.task) {
          const task = item.task;
          const localIdx = taskRowIdx++;
          const isSelected = task.id === selectedTaskId;
          const isHovered = task.id === hoveredTaskId;
          const statusColor = getGanttTaskStatusColor(task.status);
          const isOverdue =
            !isGanttTaskDone(task.status) &&
            new Date(task.baselineEnd) < new Date() &&
            task.progress < 100;
          const isMerge = task.isMergePoint;
          const isMilestone = task.isMilestone;

          // S曲线同步：绩效 < 80% 时红色脉冲
          const perf = calcTaskPerformance(task.baselineStart, task.baselineEnd, task.actualEnd);
          const shouldPulseRed = perf?.shouldPulseRed || isOverdue;

          const zebraBg = localIdx % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent';
          const rowBg = isHovered
            ? 'rgba(34, 211, 238, 0.05)'
            : isSelected
              ? 'rgba(255,255,255,0.06)'
              : (isMerge || isMilestone)
                ? 'rgba(0, 255, 255, 0.03)'
                : zebraBg;

          const colors = PHASE_COLORS[item.phase] || PHASE_COLORS.physical;

          return (
            <div
              key={task.id}
              className="flex items-center gap-2 pr-3 cursor-pointer transition-all duration-150 box-border"
              style={{
                height: rowHeight,
                paddingLeft: item.parentIds.length >= 3 ? INDENT.task : INDENT.l3,
                borderLeft: isSelected ? `2px solid ${colors.primary}` : isMilestone ? '2px solid rgba(0,255,255,0.3)' : '2px solid transparent',
                borderTop: isHovered ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                borderBottom: isHovered ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                background: rowBg,
              }}
              onClick={() => onTaskClick(task)}
              onMouseEnter={() => onHoverTask(task.id)}
              onMouseLeave={() => onHoverTask(null)}
            >

              {/* Evidence count badge */}
              {(() => {
                const NUMS = ['\u2460','\u2461','\u2462'];
                const cnt = task.dbId && evidenceCounts ? (evidenceCounts[task.dbId] || 0) : 0;
                if (cnt === 0) return null;
                return (
                  <span
                    className="shrink-0 text-[11px] font-normal"
                    style={{ color: 'rgba(251, 191, 36, 0.85)', fontFamily: 'var(--font-mono)' }}
                  >{NUMS[Math.min(cnt, 3) - 1]}</span>
                );
              })()}
              {/* Status indicator: Holographic Crystal for milestone/merge, dot for normal */}
              {(isMerge || isMilestone) ? (
                <svg
                  width="16" height="16" viewBox="-1 -1 16 16"
                  className="shrink-0"
                  style={{
                    animation: isHovered ? 'neonPulseFast 1.5s linear infinite' : 'neonPulse 3s linear infinite',
                    overflow: 'visible',
                  }}
                >
                  <defs>
                    <radialGradient id="crystal-core-fill" cx="50%" cy="50%" r="50%">
                      <stop offset="10%" stopColor="#ffffff" />
                      <stop offset="80%" stopColor="rgba(0,255,255,0.6)" />
                    </radialGradient>
                  </defs>
                  {/* Outer diamond frame */}
                  <polygon points="7,0.5 13.5,7 7,13.5 0.5,7" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.85" />
                  {/* Inner diamond — radial gradient core */}
                  <polygon points="7,3 11,7 7,11 3,7" fill="url(#crystal-core-fill)" stroke="#00ffff" strokeWidth="0.5" opacity="0.9" />
                  {/* Center white spark */}
                  <circle cx="7" cy="7" r="1.2" fill="#ffffff" opacity="0.95" />
                  {/* HUD L-bracket marks — static frame (no animation) */}
                  {/* Top-left bracket */}
                  <polyline points="0,3 0,0 3,0" fill="none" stroke="#00ffff" strokeWidth="0.7" opacity="0.5" />
                  {/* Top-right bracket */}
                  <polyline points="11,0 14,0 14,3" fill="none" stroke="#00ffff" strokeWidth="0.7" opacity="0.5" />
                  {/* Bottom-right bracket */}
                  <polyline points="14,11 14,14 11,14" fill="none" stroke="#00ffff" strokeWidth="0.7" opacity="0.5" />
                  {/* Bottom-left bracket */}
                  <polyline points="3,14 0,14 0,11" fill="none" stroke="#00ffff" strokeWidth="0.7" opacity="0.5" />
                </svg>
              ) : (
                <div
                  className={`w-[5px] h-[5px] rounded-full shrink-0 ${shouldPulseRed ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: shouldPulseRed ? '#ff3131' : perf ? perf.intensity.color : statusColor }}
                />
              )}

              {/* Task name */}
              <span
                className={`text-[12px] truncate flex-1 ${
                  (isMerge || isMilestone)
                    ? 'font-bold'
                    : 'font-medium text-white/60'
                }`}
                style={(isMerge || isMilestone) ? { color: 'rgba(0,255,255,0.75)', textShadow: '0 0 6px rgba(0,255,255,0.2)', fontFamily: 'var(--font-display)' } : { fontFamily: 'var(--font-body)' }}
              >
                {task.nameCn}
              </span>

              {/* Delay Intensity — 延误战况 */}
              {(() => {
                const perf2 = calcTaskPerformance(task.baselineStart, task.baselineEnd, task.actualEnd);
                if (!perf2) {
                  return (
                    <span
                      className="text-[10px] w-[32px] text-right text-white/20 shrink-0"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      —
                    </span>
                  );
                }
                const di = perf2.intensity;
                const delay = perf2.delayDays;
                // 显示延误天数而非强度百分比
                const delayLabel = delay > 0 ? `+${delay}d` : delay === 0 ? '准时' : `${delay}d`;
                const delayColor = delay > 0 ? di.color : '#00ffff';
                return (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 强度条 */}
                    <div className="w-[24px] h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(di.value, 200)}%`,
                          backgroundColor: di.color,
                          boxShadow: di.value > 130 ? `0 0 4px ${di.color}40` : undefined,
                        }}
                      />
                    </div>
                    {/* 延误天数 */}
                    <span
                      className="text-[11px] w-[32px] text-right font-semibold shrink-0"
                      style={{ fontFamily: 'var(--font-mono)', color: delayColor }}
                    >
                      {delayLabel}
                    </span>
                    {/* ⚠ 严重超期警告 */}
                    {di.isWarning && (
                      <span className="text-[10px] text-red-400 animate-pulse shrink-0" title="严重超期">⚠</span>
                    )}
                  </div>
                );
              })()}

              {/* S曲线联动：绩效不足红色脉冲 — 已移除小红点 */}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Helper Functions (used by GanttV3Chart for layout sync)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate total height of sidebar content (for scroll area).
 */
export function calcSidebarHeight(
  tracks: TrackGroup[],
  postMergeTasks: TaskNode[],
  collapsedGroups: Set<string>,
  rowHeight: number,
  groupHeaderHeight: number,
): number {
  const items = buildHierarchy(tracks, postMergeTasks);
  let h = 0;
  for (const item of items) {
    if (!isVisible(item, collapsedGroups)) continue;
    h += item.type === 'task' ? rowHeight : groupHeaderHeight;
  }
  return h + 40; // bottom padding
}

/**
 * Get flat task row list for gantt body rendering.
 */
export function getFlatRows(
  tracks: TrackGroup[],
  postMergeTasks: TaskNode[],
  collapsedGroups: Set<string>,
  rowHeight: number,
  groupHeaderHeight: number,
): { task: TaskNode; yOffset: number; groupId: string; phase: PhaseType }[] {
  const items = buildHierarchy(tracks, postMergeTasks);
  const rows: { task: TaskNode; yOffset: number; groupId: string; phase: PhaseType }[] = [];
  let y = 0;

  for (const item of items) {
    if (!isVisible(item, collapsedGroups)) continue;

    if (item.type === 'task' && item.task) {
      rows.push({
        task: item.task,
        yOffset: y,
        groupId: item.parentIds[item.parentIds.length - 1] || '',
        phase: item.phase,
      });
      y += rowHeight;
    } else {
      y += groupHeaderHeight;
    }
  }

  return rows;
}

/**
 * Get group header positions for gantt body overlay rendering.
 */
export function getGroupHeaderPositions(
  tracks: TrackGroup[],
  postMergeTasks: TaskNode[],
  collapsedGroups: Set<string>,
  rowHeight: number,
  groupHeaderHeight: number,
): { id: string; label: string; phase: PhaseType; yOffset: number; type: HierarchyType }[] {
  const items = buildHierarchy(tracks, postMergeTasks);
  const positions: { id: string; label: string; phase: PhaseType; yOffset: number; type: HierarchyType }[] = [];
  let y = 0;

  for (const item of items) {
    if (!isVisible(item, collapsedGroups)) continue;

    if (item.type !== 'task') {
      positions.push({
        id: item.id,
        label: item.label,
        phase: item.phase,
        yOffset: y,
        type: item.type,
      });
      y += groupHeaderHeight;
    } else {
      y += rowHeight;
    }
  }

  return positions;
}
