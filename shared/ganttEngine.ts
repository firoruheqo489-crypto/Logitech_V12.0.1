/**
 * Gantt Engine V3 — V4.5 Excel 日期唯一真理 + 全线延期传导
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  V4.5 Override: 日期渲染“唯一真理” — 仅读取 Excel 原始日期        ║
 * ║  - 废弃“跳过周日”“24小时物理冷却”对 baseline 的覆盖               ║
 * ║  - 任务条位置/长度严格与 Excel 单元格日期 1:1 对齐                  ║
 * ║  - isOverdue = 实际完成时间 > 计划完成时间 → 红光警示              ║
 * ║  - predictedStart/End = 延迟传导后预测线日期（保持工期间隔）        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Core structure: multi-track, 4-to-1 convergence, dependencies (no date overwrite).
 */

import { addWorkDays, toDateString } from './workdays';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type PhaseType = 'physical' | 'data' | 'production';
export type TrackId = 'cavity_core' | 'cavity_insert' | 'slider' | 'lifter';
export type TaskStatusType = 'NotStart' | 'InProgress' | 'Blocked' | 'Done';

export interface TaskNode {
  id: string;
  dbId?: string; // database UUID for evidence FK
  projectId: string;
  wbsId?: string;          // WBS 层级编号 (e.g., "5-1-1-3")
  name: string;
  nameCn: string;
  phase: PhaseType;
  track?: TrackId;
  stage?: string;
  stageOrder: number;
  weight: number;
  durationDays: number;
  baselineStart: string; // YYYY-MM-DD
  baselineEnd: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number; // 0-100
  status: TaskStatusType;
  isCritical: boolean;
  isMergePoint: boolean;
  isMilestone: boolean;    // 里程碑节点 (序号 6, 11, 16, 21)
  milestoneLabel?: string; // e.g., "里程碑1"
  assignee?: string;
  notes?: string;
  /** V4.5: 实际完成时间晚于计划完成时间时为 true，用于红光警示 */
  isOverdue?: boolean;
  /** V4.5: 全线延期传导后的预测开始/结束日期（仅当存在前置延迟时存在） */
  predictedStart?: string;
  predictedEnd?: string;
  predecessors?: string[];
}

export interface DependencyEdge {
  id?: string;
  taskId: string;
  predecessorId: string;
  lagType: 'Hard' | 'Soft';
  lagHours: number;
}

export interface TrackGroup {
  id: TrackId;
  name: string;
  nameCn: string;
  tasks: TaskNode[];
}

export interface MilestoneView {
  id: string;
  name: string;
  nameCn: string;
  date: string;
  type: 'T0_trial' | 'T0_closure' | 'trial_to_mass' | 'SOP';
  status: 'pending' | 'active' | 'completed';
  description: string;
}

export interface GanttData {
  projectId: string;
  projectInfo: ProjectInfo;
  tracks: TrackGroup[];
  tasks: TaskNode[];
  postMergeTasks: TaskNode[];
  dependencies: DependencyEdge[];
  milestones: MilestoneView[];
  mergePointId?: string;
  dateRange: { start: string; end: string };
}

export interface ProjectInfo {
  id: string;
  brand: string;
  productName: string;
  moldNumber: string;
  startDate: string;
  endDate: string;
  /** No.1, No.2 — 序号，用于 V1 看板跳转 data-id */
  index_no?: string;
  /** 项目名称，如 Ziti */
  project_name?: string;
  /** 钳工组 */
  fitter_group?: string;
  /** 产品图 URL，从 Supabase Storage 持久化 */
  product_image_url?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

export const TRACK_LABELS: Record<TrackId, { name: string; nameCn: string }> = {
  cavity_core: { name: 'Cavity Core', nameCn: '前模仁' },
  cavity_insert: { name: 'Cavity Insert', nameCn: '后模仁' },
  slider: { name: 'Slider', nameCn: '滑块' },
  lifter: { name: 'Lifter', nameCn: '镶件' },
};

export const PROCESS_STEPS = [
  { id: 'milling', name: 'Milling', nameCn: '铣床', order: 1, defaultDuration: 1 },
  { id: 'roughing', name: 'CNC Roughing', nameCn: 'CNC开粗', order: 2, defaultDuration: 1 },
  { id: 'hrc', name: 'HRC', nameCn: 'HRC热处理', order: 3, defaultDuration: 1 },
  { id: 'grinding', name: 'Grinding', nameCn: '磨床', order: 4, defaultDuration: 1 },
  { id: 'finishing', name: 'CNC Finishing', nameCn: 'CNC精加工', order: 5, defaultDuration: 1 },
  { id: 'electrode', name: 'Electrode', nameCn: '电极', order: 6, defaultDuration: 1 },
  { id: 'wire_edm', name: 'Wire EDM', nameCn: '电极线割', order: 7, defaultDuration: 1 },
  { id: 'edm', name: 'EDM', nameCn: '放电加工', order: 8, defaultDuration: 1 },
  { id: 'cmm', name: 'CMM', nameCn: 'CMM检测', order: 9, defaultDuration: 1 },
  { id: 'bench', name: 'Bench Work', nameCn: '钳工', order: 10, defaultDuration: 1 },
  { id: 'assembly_edm', name: 'Assembly EDM', nameCn: '组立放电', order: 11, defaultDuration: 1 },
  { id: 'qc', name: 'QC Inspection', nameCn: 'QC检验', order: 12, defaultDuration: 1 },
  { id: 'polishing', name: 'Polishing', nameCn: '省模', order: 13, defaultDuration: 1 },
  { id: 'fit', name: 'FIT Mold', nameCn: 'FIT模', order: 14, defaultDuration: 1 },
];

/** 4-to-1 汇聚点 ID — 模具Fai Cpk报告 */
export const MERGE_POINT_ID = 'mold_fai_cpk';

/** 所有已知 post-merge 阶段 ID（包含项目准备 + 汇聚点 + T0 + T1 + 转量产 + 新模板全工序） */
export const KNOWN_POST_MERGE_STAGES = new Set([
  // 项目准备
  'project_launch', 'drawing_2d', 'drawing_3d', 'mtd',
  // 开模 (新模板无四泳道时平铺)
  'mold_dev_pioneer', 'open_mold', 'close_mold',
  // 汇聚点
  MERGE_POINT_ID,
  // T0 试模 (旧模板)
  't0_trial', 't0_fai_report', 't0_appearance', 't0_3d_report', 't0_summary',
  't0_machine_params', // 机台参数表 (当出现在 T0 区段时)
  // T0 试模 (新模板 — 收敛黑盒A)
  'blackbox_a_converge', 't0_first_trial', 't0_appearance_eval',
  'issue_review_repair_flow', 't0_issue_summary', 'repair_plan',
  'moldbao_repair', 't0_sample_send', 'white_mold_buffer_pool',
  'tn_trial_repair_loop',
  // 咬花前置
  'etching_gate', 'dimension_ready', 'structure_interference_clear',
  // T1 问题闭环 (旧模板)
  't1_trial', 'gl', 't1_dimension', 'trial_count', 't0_closure_report',
  't1_fai_report', 't1_appearance', 't1_3d_report', // T1 区段同名工序变体
  // T1 收敛闭环 (新模板 — 收敛黑盒B)
  'blackbox_b_converge', 'etching_process', 'post_etch_trial_validation',
  't0_trial_post_etch', 'gloss_roughness_test', 'post_etch_fai_recheck',
  'post_etch_3d_recheck', 'issue_closure_confirm', 'post_etch_sample_send',
  'texture_appearance_tuning_loop',
  // 转量产 (旧模板)
  'vmp', 'sip', 'sop', 'machine_params', 'spc_inspection',
  // 转量产 (新模板)
  'prr_trial_gate', 'system_data_localize', 'moldbao_upload_new_mold_data',
  'ms_upload_new_mold_data', 'notify_trial_by_email', 'formal_trial_run',
  'sample_signoff', 'customer_sample_confirmation', 'cpk_32_measurement',
  'trial_3d_scan', 'customer_other_tests', 'transfer_to_mp',
  'customer_pilot_run', 'customer_pilot_passed', 'internal_mail_mold_to_mp',
]);

export const PHASE_COLORS: Record<PhaseType, { gradient: string; primary: string; dark: string; text: string }> = {
  physical: {
    gradient: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
    primary: '#4A90E2',
    dark: '#2D6CB5',
    text: '#82B1FF',
  },
  data: {
    gradient: 'linear-gradient(135deg, #A29BFE 0%, #7C6FE0 100%)',
    primary: '#A29BFE',
    dark: '#6C5CE7',
    text: '#B8B0FF',
  },
  production: {
    gradient: 'linear-gradient(135deg, #00B894 0%, #009B7D 100%)',
    primary: '#00B894',
    dark: '#00856F',
    text: '#55EFC4',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Core Algorithm Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Step 1: Build intra-track dependencies (topological chaining).
 * Each task within a track depends on the previous task by stageOrder.
 */
function buildIntraTrackDependencies(tasks: TaskNode[]): DependencyEdge[] {
  const sorted = [...tasks].sort((a, b) => a.stageOrder - b.stageOrder);
  const deps: DependencyEdge[] = [];

  for (let i = 1; i < sorted.length; i++) {
    deps.push({
      taskId: sorted[i].id,
      predecessorId: sorted[i - 1].id,
      lagType: 'Hard',
      lagHours: 0,
    });
  }

  return deps;
}

/**
 * Step 2: Find terminal task (last by stageOrder) in each track.
 */
function findTrackTerminals(tracks: TrackGroup[]): Map<TrackId, TaskNode> {
  const terminals = new Map<TrackId, TaskNode>();

  for (const track of tracks) {
    if (track.tasks.length === 0) continue;
    const sorted = [...track.tasks].sort((a, b) => b.stageOrder - a.stageOrder);
    terminals.set(track.id, sorted[0]);
  }

  return terminals;
}

/**
 * Step 3: Build 4-to-1 convergence — FIT模 depends on all track terminals.
 */
function buildConvergenceDependencies(
  mergeTask: TaskNode,
  terminals: Map<TrackId, TaskNode>,
  existingDeps: DependencyEdge[],
): DependencyEdge[] {
  const deps: DependencyEdge[] = [];

  terminals.forEach((terminal) => {
    const exists = existingDeps.some(
      (d) => d.taskId === mergeTask.id && d.predecessorId === terminal.id,
    );

    if (!exists) {
      deps.push({
        taskId: mergeTask.id,
        predecessorId: terminal.id,
        lagType: 'Hard',
        lagHours: 0,
      });
    }
  });

  return deps;
}

/** V4.5: 禁用 — 不再用“跳过周日/24h冷却”覆盖 Excel 日期。保留函数仅供 buildDemoData 等内部可选使用。 */
function _computeEffectiveDate_disabled(
  _taskId: string,
  taskMap: Map<string, TaskNode>,
  _dependencies: DependencyEdge[],
  _computed: Map<string, { start: string; end: string }>,
  _visited: Set<string>,
): { start: string; end: string } {
  const task = taskMap.get(_taskId);
  if (!task) throw new Error(`Task not found: ${_taskId}`);
  return { start: task.baselineStart, end: task.baselineEnd };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Milestone Generation
// ═══════════════════════════════════════════════════════════════════════════════

/** 里程碑 stage ID → 展示信息 */
const MILESTONE_META: Record<string, { name: string; nameCn: string; type: MilestoneView['type']; desc: string }> = {
  mold_fai_cpk:      { name: 'Mold FAI/CPK', nameCn: '模具Fai Cpk报告', type: 'T0_trial', desc: '4合1汇聚 — 模具FAI/CPK报告' },
};


function generateMilestones(tasks: TaskNode[]): MilestoneView[] {
  const today = toDateString(new Date());

  const getStatus = (date: string, task?: TaskNode): 'pending' | 'active' | 'completed' => {
    if (task?.status === 'Done') return 'completed';
    if (date <= today) return 'active';
    return 'pending';
  };

  // 优先从数据中提取 isMilestone 标记的任务（按 stage 去重，避免重复导入产生两组）
  // 仅保留 mold_fai_cpk 作为里程碑
  const milestoneTasks = tasks.filter((t) => t.isMilestone && (t.stage === 'mold_fai_cpk' || t.id === 'mold_fai_cpk'));
  if (milestoneTasks.length > 0) {
    const seen = new Set<string>();
    const deduped = milestoneTasks.filter((t) => {
      const key = t.stage || t.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.map((t, i) => {
      const meta = MILESTONE_META[t.stage || ''];
      return {
        id: `ms_${t.stage || i}`,
        name: meta?.name || t.name,
        nameCn: meta?.nameCn || t.nameCn,
        date: t.baselineStart,
        type: meta?.type || 'T0_trial',
        status: getStatus(t.baselineStart, t),
        description: meta?.desc || t.milestoneLabel || t.nameCn,
      };
    });
  }


  const findByStage = (stage: string) => tasks.find((t) => t.stage === stage);
  const entries: [string, TaskNode | undefined][] = [
    ['mold_fai_cpk', findByStage('mold_fai_cpk')],
  ];

  return entries
    .filter(([, t]) => !!t)
    .map(([stageId, t]) => {
      const meta = MILESTONE_META[stageId];
      const date = t!.baselineStart;
      return {
        id: `ms_${stageId}`,
        name: meta.name,
        nameCn: meta.nameCn,
        date,
        type: meta.type,
        status: getStatus(date, t),
        description: meta.desc,
      };
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sequence Guard — Enforce Milestone & Task Ordering
// ═══════════════════════════════════════════════════════════════════════════════

/** V4.5: 禁用 — 不再自动推移任务日期，以保持 Excel 原始日期为唯一真理。 */
function enforceSequenceConstraints(_tasks: TaskNode[]): void {
  // No-op: do not mutate baseline dates from Excel.
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Entry Point — getGanttData
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Master function: Parse tasks + dependencies → produce complete Gantt data.
 *
 * Algorithm:
 * 1. Group physical tasks by track (sub_path)
 * 2. Build intra-track topological dependencies
 * 3. Build 4-to-1 convergence for merge point
 * 4. Compute effective dates with PreLag injection
 * 5. Generate milestones
 * 6. Return structured GanttData
 */
export function getGanttData(
  inputTasks: TaskNode[],
  inputDependencies: DependencyEdge[],
  projectInfo: ProjectInfo,
): GanttData {
  const trackIds: TrackId[] = ['cavity_core', 'cavity_insert', 'slider', 'lifter'];

  // ── Step 1: Group physical tasks by track ──
  const tracks: TrackGroup[] = [];
  for (const trackId of trackIds) {
    const trackTasks = inputTasks
      .filter((t) => t.track === trackId)
      .sort((a, b) => a.stageOrder - b.stageOrder);

    if (trackTasks.length > 0) {
      tracks.push({
        id: trackId,
        ...TRACK_LABELS[trackId],
        tasks: trackTasks,
      });
    }
  }

  // ── Step 2: Build intra-track topological dependencies ──
  const allDeps = [...inputDependencies];
  for (const track of tracks) {
    const intraDeps = buildIntraTrackDependencies(track.tasks);
    for (const dep of intraDeps) {
      const exists = allDeps.some(
        (d) => d.taskId === dep.taskId && d.predecessorId === dep.predecessorId,
      );
      if (!exists) {
        allDeps.push(dep);
      }
    }
  }

  // ── Step 3: Build 4-to-1 convergence for merge point (模具Fai Cpk报告) ──
  // Each track's terminal task (FIT模) → 模具Fai Cpk报告
  // If any track's FIT模 delays, the impact propagates to all downstream tasks
  const terminals = findTrackTerminals(tracks);
  const mergeTask = inputTasks.find((t) => t.isMergePoint);

  if (mergeTask) {
    const convergenceDeps = buildConvergenceDependencies(mergeTask, terminals, allDeps);
    allDeps.push(...convergenceDeps);
  }

  // ── Step 4 (V4.5): Excel 日期唯一真理 — 不覆盖 baseline/actual，仅附加 isOverdue 与预测线 ──
  const taskMap = new Map(inputTasks.map((t) => [t.id, t]));

  const predecessorMap = new Map<string, string[]>();
  for (const dependency of allDeps) {
    const predecessors = predecessorMap.get(dependency.taskId) ?? [];
    if (!predecessors.includes(dependency.predecessorId)) {
      predecessors.push(dependency.predecessorId);
      predecessorMap.set(dependency.taskId, predecessors);
    }
  }

  const updatedTasks = inputTasks.map((task) => {
    const baselineEnd = task.baselineEnd ? new Date(task.baselineEnd) : null;
    const actualEnd = task.actualEnd ? new Date(task.actualEnd) : null;
    const isOverdue = !!(
      baselineEnd &&
      actualEnd &&
      actualEnd.getTime() > baselineEnd.getTime()
    );
    return {
      ...task,
      isOverdue,
      predecessors: predecessorMap.get(task.id) ?? [],
    };
  });

  // 全线延期传导：按 stageOrder 顺序，前置的“预测结束日”作为本任务预测开始；保持工期间隔
  const byStageOrder = [...updatedTasks].sort((a, b) => a.stageOrder - b.stageOrder);
  const predEndByTaskId = new Map<string, Date>();

  for (const task of byStageOrder) {
    const predDeps = allDeps.filter((d) => d.taskId === task.id);
    let latestPredEnd: Date | null = null;
    for (const dep of predDeps) {
      const preTask = taskMap.get(dep.predecessorId);
      const preEnd = predEndByTaskId.get(dep.predecessorId) ?? (preTask ? new Date(preTask.actualEnd || preTask.baselineEnd) : null);
      if (preEnd && (!latestPredEnd || preEnd > latestPredEnd)) latestPredEnd = preEnd;
    }
    const baseStart = new Date(task.baselineStart);
    const baseEnd = new Date(task.baselineEnd);
    const durationDays = Math.max(1, Math.ceil((baseEnd.getTime() - baseStart.getTime()) / 86400000) + 1);
    let predStart: Date;
    let predEnd: Date;
    if (latestPredEnd) {
      predStart = new Date(latestPredEnd);
      predStart.setDate(predStart.getDate() + 1);
      predEnd = new Date(predStart);
      predEnd.setDate(predEnd.getDate() + durationDays - 1);
    } else {
      predStart = baseStart;
      predEnd = baseEnd;
    }
    predEndByTaskId.set(task.id, predEnd);
    const wasShifted = predStart.getTime() > baseStart.getTime() || predEnd.getTime() > baseEnd.getTime();
    if (wasShifted) {
      const idx = updatedTasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        updatedTasks[idx] = {
          ...updatedTasks[idx],
          predictedStart: toDateString(predStart),
          predictedEnd: toDateString(predEnd),
        };
      }
    }
  }

  // ── Step 4b (V4.5): 不再推移 Excel 日期 ──
  enforceSequenceConstraints(updatedTasks);

  // ── Step 5: Separate track tasks vs post-merge tasks ──
  // 只保留已知的后汇聚阶段，排除无归属的孤儿任务（如 项目立项/2D图纸 等项目里程碑）
  const trackTaskIds = new Set(tracks.flatMap((t) => t.tasks.map((tt) => tt.id)));
  const postMergeTasks = updatedTasks
    .filter((t) => !trackTaskIds.has(t.id) && KNOWN_POST_MERGE_STAGES.has(t.stage || ''))
    .sort((a, b) => a.stageOrder - b.stageOrder);

  // Update tracks with computed dates
  const updatedTracks = tracks.map((track) => ({
    ...track,
    tasks: updatedTasks
      .filter((t) => t.track === track.id)
      .sort((a, b) => a.stageOrder - b.stageOrder),
  }));

  // ── Step 6: Generate milestones ──
  const milestones = generateMilestones(updatedTasks);

  // ── Step 7: Compute date range ──
  const allDates = updatedTasks.flatMap((t) => [
    new Date(t.baselineStart),
    new Date(t.baselineEnd),
    ...(t.actualStart ? [new Date(t.actualStart)] : []),
    ...(t.actualEnd ? [new Date(t.actualEnd)] : []),
  ]);

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 5);
  maxDate.setDate(maxDate.getDate() + 25);

  return {
    projectId: projectInfo.id,
    projectInfo,
    tracks: updatedTracks,
    tasks: updatedTasks,
    postMergeTasks,
    dependencies: allDeps,
    milestones,
    mergePointId: mergeTask?.id,
    dateRange: {
      start: toDateString(minDate),
      end: toDateString(maxDate),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Demo Data Builder — Generates full project data for UI testing
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDemoData(): GanttData {
  const projectInfo: ProjectInfo = {
    id: 'LA26006',
    brand: 'Logitech',
    productName: 'Bicko M END CAP',
    moldNumber: 'LA26006',
    startDate: '2026-01-05',
    endDate: '2026-05-15',
    index_no: '1',
    project_name: 'Ziti',
  };

  const baseStart = '2026-01-05';
  const tasks: TaskNode[] = [];
  const dependencies: DependencyEdge[] = [];

  // Track configs: { trackId, offsetDays from baseStart, isCritical }
  const trackConfigs: { id: TrackId; offset: number; critical: boolean }[] = [
    { id: 'cavity_core', offset: 0, critical: true },
    { id: 'cavity_insert', offset: 2, critical: false },
    { id: 'slider', offset: 3, critical: false },
    { id: 'lifter', offset: 1, critical: false },
  ];

  // Progress simulation per track
  const progressMap: Record<TrackId, Record<string, { progress: number; delay: number; status: TaskStatusType }>> = {
    cavity_core: {
      milling: { progress: 100, delay: 0, status: 'Done' },
      roughing: { progress: 100, delay: 1, status: 'Done' },
      hrc: { progress: 100, delay: 0, status: 'Done' },
      grinding: { progress: 100, delay: 0, status: 'Done' },
      finishing: { progress: 80, delay: 2, status: 'InProgress' },
      electrode: { progress: 0, delay: 0, status: 'NotStart' },
      edm: { progress: 0, delay: 0, status: 'NotStart' },
      cmm: { progress: 0, delay: 0, status: 'NotStart' },
      bench: { progress: 0, delay: 0, status: 'NotStart' },
      fit: { progress: 0, delay: 0, status: 'NotStart' },
    },
    cavity_insert: {
      milling: { progress: 100, delay: 0, status: 'Done' },
      roughing: { progress: 100, delay: 0, status: 'Done' },
      hrc: { progress: 100, delay: 1, status: 'Done' },
      grinding: { progress: 100, delay: 0, status: 'Done' },
      finishing: { progress: 60, delay: 1, status: 'InProgress' },
      electrode: { progress: 0, delay: 0, status: 'NotStart' },
      edm: { progress: 0, delay: 0, status: 'NotStart' },
      cmm: { progress: 0, delay: 0, status: 'NotStart' },
      bench: { progress: 0, delay: 0, status: 'NotStart' },
      fit: { progress: 0, delay: 0, status: 'NotStart' },
    },
    slider: {
      milling: { progress: 100, delay: 0, status: 'Done' },
      roughing: { progress: 100, delay: 0, status: 'Done' },
      hrc: { progress: 100, delay: 0, status: 'Done' },
      grinding: { progress: 100, delay: 2, status: 'Done' },
      finishing: { progress: 40, delay: 0, status: 'InProgress' },
      electrode: { progress: 0, delay: 0, status: 'NotStart' },
      edm: { progress: 0, delay: 0, status: 'NotStart' },
      cmm: { progress: 0, delay: 0, status: 'NotStart' },
      bench: { progress: 0, delay: 0, status: 'NotStart' },
      fit: { progress: 0, delay: 0, status: 'NotStart' },
    },
    lifter: {
      milling: { progress: 100, delay: 0, status: 'Done' },
      roughing: { progress: 100, delay: 0, status: 'Done' },
      hrc: { progress: 100, delay: 0, status: 'Done' },
      grinding: { progress: 70, delay: 1, status: 'InProgress' },
      finishing: { progress: 0, delay: 0, status: 'NotStart' },
      electrode: { progress: 0, delay: 0, status: 'NotStart' },
      edm: { progress: 0, delay: 0, status: 'NotStart' },
      cmm: { progress: 0, delay: 0, status: 'NotStart' },
      bench: { progress: 0, delay: 0, status: 'NotStart' },
      fit: { progress: 0, delay: 0, status: 'NotStart' },
    },
  };

  const defaultPm = { progress: 0, delay: 0, status: 'NotStart' as TaskStatusType };

  // ── Generate tasks for each track ──
  for (const config of trackConfigs) {
    const trackStart = addWorkDays(baseStart, config.offset);
    let currentStart = toDateString(trackStart);

    for (const step of PROCESS_STEPS) {
      const taskId = `${config.id}_${step.id}`;
      // Inclusive end: duration 1 → end = start; duration 2 → end = start + 1; etc.
      const endDate = addWorkDays(currentStart, Math.max(0, step.defaultDuration - 1));
      const pm = progressMap[config.id]?.[step.id] ?? defaultPm;

      const actualStart =
        pm.progress > 0
          ? pm.delay > 0
            ? toDateString(addWorkDays(currentStart, pm.delay))
            : currentStart
          : undefined;

      const actualEnd =
        pm.progress === 100
          ? toDateString(addWorkDays(actualStart || currentStart, Math.max(0, step.defaultDuration + pm.delay - 1)))
          : undefined;

      tasks.push({
        id: taskId,
        projectId: 'LA26006',
        name: step.name,
        nameCn: step.nameCn,
        phase: 'physical',
        track: config.id,
        stage: step.id,
        stageOrder: step.order,
        weight: 1,
        durationDays: step.defaultDuration,
        baselineStart: currentStart,
        baselineEnd: toDateString(endDate),
        actualStart,
        actualEnd,
        progress: pm.progress,
        status: pm.status,
        isCritical: config.critical && ['finishing', 'edm', 'cmm', 'bench', 'fit'].includes(step.id),
        isMergePoint: false,
        isMilestone: false,
      });

      // Next task starts on the next workday after this task's inclusive end
      currentStart = toDateString(addWorkDays(endDate, 1));
    }
  }

  // ── Generate post-merge tasks ──
  // 4-to-1 汇聚：所有支线的 FIT模 → 模具Fai Cpk报告
  const lastFitDates = trackConfigs.map((tc) => {
    const fitTask = tasks.find((t) => t.id === `${tc.id}_fit`);
    return fitTask?.baselineEnd || '2026-03-01';
  });
  const latestFitEnd = lastFitDates.sort().pop() || '2026-03-01';
  const mergeStart = toDateString(addWorkDays(latestFitEnd, 1));

  const postMergeSteps: {
    id: string;
    name: string;
    nameCn: string;
    phase: PhaseType;
    duration: number;
    offsetFromMerge: number;
    isCritical: boolean;
    deps: string[];
    lagHours?: number;
  }[] = [
    // ═══════════════════════════════════════════════════════════════
    // 开模 尾端汇聚点 (4-to-1)
    // ═══════════════════════════════════════════════════════════════
    { id: 'mold_fai_cpk', name: 'Mold FAI / CPK Report', nameCn: '模具Fai Cpk报告', phase: 'physical', duration: 4, offsetFromMerge: 0, isCritical: true, deps: [] },

    // ═══════════════════════════════════════════════════════════════
    // T0 试模 — 5 steps, ends at T0综合报告
    // T0试模 → 试模全尺寸Fai报告 ─┐
    // T0试模 → 试模外观报告 ───────┤→ T0综合报告
    // T0试模 → 试模3D报告 ─────────┘
    // ═══════════════════════════════════════════════════════════════
    { id: 't0_trial', name: 'T0 Trial Molding', nameCn: 'T0试模', phase: 'data', duration: 2, offsetFromMerge: 4, isCritical: true, deps: ['mold_fai_cpk'] },
    { id: 't0_fai_report', name: 'T0 Full-Dim FAI Report', nameCn: '试模全尺寸Fai报告', phase: 'data', duration: 2, offsetFromMerge: 6, isCritical: false, deps: ['t0_trial'] },
    { id: 't0_appearance', name: 'T0 Appearance Report', nameCn: '试模外观报告', phase: 'data', duration: 2, offsetFromMerge: 6, isCritical: false, deps: ['t0_trial'] },
    { id: 't0_3d_report', name: 'T0 3D Report', nameCn: '试模3D报告', phase: 'data', duration: 1, offsetFromMerge: 6, isCritical: false, deps: ['t0_trial'] },
    { id: 't0_summary', name: 'T0 Summary Report', nameCn: 'T0综合报告', phase: 'data', duration: 2, offsetFromMerge: 8, isCritical: true, deps: ['t0_fai_report', 't0_appearance', 't0_3d_report'] },

    // ═══════════════════════════════════════════════════════════════
    // T1 问题闭环 — 5 steps, ends at T0问题闭环报告
    // ═══════════════════════════════════════════════════════════════
    { id: 't1_trial', name: 'T1 Trial Molding', nameCn: 'T1试模', phase: 'data', duration: 2, offsetFromMerge: 11, isCritical: true, deps: ['t0_summary'], lagHours: 24 },
    { id: 'gl', name: 'G/L Verification', nameCn: 'G/L', phase: 'data', duration: 2, offsetFromMerge: 13, isCritical: false, deps: ['t1_trial'] },
    { id: 't1_dimension', name: 'T1 Dimension Target Date', nameCn: 'T1尺寸达标日期', phase: 'data', duration: 2, offsetFromMerge: 15, isCritical: false, deps: ['gl'] },
    { id: 'trial_count', name: 'Trial Count Tracking', nameCn: '试模次数', phase: 'data', duration: 1, offsetFromMerge: 17, isCritical: false, deps: ['t1_dimension'] },
    { id: 't0_closure_report', name: 'T0 Issue Closure Report', nameCn: 'T0问题闭环报告', phase: 'data', duration: 2, offsetFromMerge: 18, isCritical: true, deps: ['trial_count'] },

    // ═══════════════════════════════════════════════════════════════
    // 转量产 — 5 steps, final acceptance: 巡检SPC数据
    // ═══════════════════════════════════════════════════════════════
    { id: 'vmp', name: 'VMP Validation', nameCn: 'VMP', phase: 'production', duration: 2, offsetFromMerge: 21, isCritical: false, deps: ['t0_closure_report'], lagHours: 24 },
    { id: 'sip', name: 'SIP', nameCn: 'SIP', phase: 'production', duration: 1, offsetFromMerge: 23, isCritical: false, deps: ['vmp'] },
    { id: 'sop', name: 'SOP Release', nameCn: 'SOP', phase: 'production', duration: 2, offsetFromMerge: 24, isCritical: true, deps: ['sip'] },
    { id: 'machine_params', name: 'Machine Parameter Sheet', nameCn: '机台参数表', phase: 'production', duration: 1, offsetFromMerge: 26, isCritical: false, deps: ['sop'] },
    { id: 'spc_inspection', name: 'SPC Inspection (1 Week)', nameCn: '巡检SPC数据', phase: 'production', duration: 5, offsetFromMerge: 27, isCritical: true, deps: ['machine_params'] },
  ];

  for (const step of postMergeSteps) {
    const startDate = toDateString(addWorkDays(mergeStart, step.offsetFromMerge));
    // Inclusive end: duration 1 → end = start; duration 2 → end = start + 1; etc.
    const endDate = toDateString(addWorkDays(startDate, Math.max(0, step.duration - 1)));

    const isMsDemo = step.id === 'mold_fai_cpk';
    tasks.push({
      id: step.id,
      projectId: 'LA26006',
      name: step.name,
      nameCn: step.nameCn,
      phase: step.phase,
      stage: step.id,
      stageOrder: step.offsetFromMerge,
      weight: 1,
      durationDays: step.duration,
      baselineStart: startDate,
      baselineEnd: endDate,
      progress: 0,
      status: 'NotStart',
      isCritical: step.isCritical,
      isMergePoint: step.id === MERGE_POINT_ID,
      isMilestone: isMsDemo,
      milestoneLabel: isMsDemo ? `里程碑` : undefined,
    });

    // Build explicit dependencies
    for (const depId of step.deps) {
      dependencies.push({
        taskId: step.id,
        predecessorId: depId,
        lagType: 'Hard',
        lagHours: step.lagHours || 0,
      });
    }
  }

  return getGanttData(tasks, dependencies, projectInfo);
}
