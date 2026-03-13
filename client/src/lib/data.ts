/**
 * Tesla Mission Control — Gantt V3 Data Model
 * Project: LA26006 Logitech Bicko M END CAP
 * 
 * Design: Morandi blue (#4A90E2) for Physical, Smart purple (#A29BFE) for Data,
 * Forest green (#00B894) for Production. Critical path highlighted with #D63031 breathing effect.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PhaseType = 'physical' | 'data' | 'production';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'blocked';
export type StreamId = 'cavity_core' | 'cavity_insert' | 'slider' | 'lifter';

export interface GanttTask {
  id: string;
  name: string;
  nameCn: string;
  phase: PhaseType;
  stream?: StreamId;
  plannedStart: string; // YYYY-MM-DD
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number; // 0-100
  status: TaskStatus;
  isCritical: boolean;
  isMergePoint?: boolean;
  dependencies: string[];
  assignee?: string;
  notes?: string;
}

export interface Milestone {
  id: string;
  name: string;
  nameCn: string;
  date: string;
  type: 'T0_trial' | 'T0_closure' | 'trial_to_mass' | 'SOP';
  status: 'pending' | 'active' | 'completed';
  description: string;
}

export interface ProjectInfo {
  id: string;
  brand: string;
  productName: string;
  moldNumber: string;
  productImage: string;
  moldImage: string;
  startDate: string;
  endDate: string;
}

// ─── Stream Labels ───────────────────────────────────────────────────────────

export const STREAM_LABELS: Record<StreamId, { name: string; nameCn: string }> = {
  cavity_core: { name: 'Cavity Core', nameCn: '前模仁' },
  cavity_insert: { name: 'Cavity Insert', nameCn: '后模仁' },
  slider: { name: 'Slider', nameCn: '滑块' },
  lifter: { name: 'Lifter', nameCn: '镶件' },
};

// ─── Process Steps (工序流) ──────────────────────────────────────────────────

export const PROCESS_STEPS = [
  { id: 'milling', name: 'Milling', nameCn: '铣床' },
  { id: 'roughing', name: 'CNC Roughing', nameCn: 'CNC开粗' },
  { id: 'hrc', name: 'HRC', nameCn: 'HRC热处理' },
  { id: 'grinding', name: 'Grinding', nameCn: '磨床' },
  { id: 'finishing', name: 'CNC Finishing', nameCn: 'CNC精加工' },
  { id: 'electrode', name: 'Electrode', nameCn: '电极' },
  { id: 'edm', name: 'EDM', nameCn: '放电加工' },
  { id: 'cmm', name: 'CMM', nameCn: 'CMM检测' },
  { id: 'bench', name: 'Bench Work', nameCn: '钳工' },
];

// ─── Phase Colors ────────────────────────────────────────────────────────────

export const PHASE_COLORS: Record<PhaseType, { primary: string; light: string; text: string; bg: string }> = {
  physical: {
    primary: '#4A90E2',
    light: 'rgba(74, 144, 226, 0.18)',
    text: '#2D6CB5',
    bg: 'rgba(74, 144, 226, 0.06)',
  },
  data: {
    primary: '#A29BFE',
    light: 'rgba(162, 155, 254, 0.18)',
    text: '#7C6FE0',
    bg: 'rgba(162, 155, 254, 0.06)',
  },
  production: {
    primary: '#00B894',
    light: 'rgba(0, 184, 148, 0.18)',
    text: '#009B7D',
    bg: 'rgba(0, 184, 148, 0.06)',
  },
};

// ─── Helper: Skip Sundays ────────────────────────────────────────────────────

function addWorkdays(startDate: string, days: number): string {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) { // Skip Sunday
      added++;
    }
  }
  return d.toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── Project Info ────────────────────────────────────────────────────────────

export const PROJECT_INFO: ProjectInfo = {
  id: 'LA26006',
  brand: 'Logitech',
  productName: 'Bicko M END CAP',
  moldNumber: 'LA26006',
  productImage: '', // Will be set from CDN URL
  moldImage: '', // Will be set from CDN URL
  startDate: '2026-01-05',
  endDate: '2026-05-15',
};

// ─── Generate Stream Tasks ──────────────────────────────────────────────────

function generateStreamTasks(
  streamId: StreamId,
  baseStart: string,
  offsetDays: number,
  isCriticalStream: boolean
): GanttTask[] {
  const streamStart = addWorkdays(baseStart, offsetDays);
  const tasks: GanttTask[] = [];
  
  // Duration in workdays for each step
  const durations: Record<string, number> = {
    milling: 2,
    roughing: 4,
    hrc: 3,
    grinding: 2,
    finishing: 5,
    electrode: 3,
    edm: 4,
    cmm: 2,
    bench: 3,
  };

  // Actual progress offsets (simulate some delays)
  const progressMap: Record<string, Record<string, { progress: number; delayDays: number; status: TaskStatus }>> = {
    cavity_core: {
      milling: { progress: 100, delayDays: 0, status: 'completed' },
      roughing: { progress: 100, delayDays: 1, status: 'completed' },
      hrc: { progress: 100, delayDays: 0, status: 'completed' },
      grinding: { progress: 100, delayDays: 0, status: 'completed' },
      finishing: { progress: 80, delayDays: 2, status: 'in_progress' },
      electrode: { progress: 0, delayDays: 0, status: 'not_started' },
      edm: { progress: 0, delayDays: 0, status: 'not_started' },
      cmm: { progress: 0, delayDays: 0, status: 'not_started' },
      bench: { progress: 0, delayDays: 0, status: 'not_started' },
    },
    cavity_insert: {
      milling: { progress: 100, delayDays: 0, status: 'completed' },
      roughing: { progress: 100, delayDays: 0, status: 'completed' },
      hrc: { progress: 100, delayDays: 1, status: 'completed' },
      grinding: { progress: 100, delayDays: 0, status: 'completed' },
      finishing: { progress: 60, delayDays: 1, status: 'in_progress' },
      electrode: { progress: 0, delayDays: 0, status: 'not_started' },
      edm: { progress: 0, delayDays: 0, status: 'not_started' },
      cmm: { progress: 0, delayDays: 0, status: 'not_started' },
      bench: { progress: 0, delayDays: 0, status: 'not_started' },
    },
    slider: {
      milling: { progress: 100, delayDays: 0, status: 'completed' },
      roughing: { progress: 100, delayDays: 0, status: 'completed' },
      hrc: { progress: 100, delayDays: 0, status: 'completed' },
      grinding: { progress: 100, delayDays: 2, status: 'completed' },
      finishing: { progress: 40, delayDays: 0, status: 'in_progress' },
      electrode: { progress: 0, delayDays: 0, status: 'not_started' },
      edm: { progress: 0, delayDays: 0, status: 'not_started' },
      cmm: { progress: 0, delayDays: 0, status: 'not_started' },
      bench: { progress: 0, delayDays: 0, status: 'not_started' },
    },
    lifter: {
      milling: { progress: 100, delayDays: 0, status: 'completed' },
      roughing: { progress: 100, delayDays: 0, status: 'completed' },
      hrc: { progress: 100, delayDays: 0, status: 'completed' },
      grinding: { progress: 70, delayDays: 1, status: 'in_progress' },
      finishing: { progress: 0, delayDays: 0, status: 'not_started' },
      electrode: { progress: 0, delayDays: 0, status: 'not_started' },
      edm: { progress: 0, delayDays: 0, status: 'not_started' },
      cmm: { progress: 0, delayDays: 0, status: 'not_started' },
      bench: { progress: 0, delayDays: 0, status: 'not_started' },
    },
  };

  let currentStart = streamStart;
  
  PROCESS_STEPS.forEach((step, idx) => {
    const duration = durations[step.id];
    const plannedEnd = addWorkdays(currentStart, duration);
    const pm = progressMap[streamId]?.[step.id] || { progress: 0, delayDays: 0, status: 'not_started' as TaskStatus };
    
    const actualStart = pm.progress > 0 ? (pm.delayDays > 0 ? addDays(currentStart, pm.delayDays) : currentStart) : undefined;
    const actualEnd = pm.progress === 100 
      ? addWorkdays(actualStart || currentStart, duration + pm.delayDays)
      : undefined;

    const prevId = idx > 0 ? `${streamId}_${PROCESS_STEPS[idx - 1].id}` : undefined;

    tasks.push({
      id: `${streamId}_${step.id}`,
      name: step.name,
      nameCn: step.nameCn,
      phase: 'physical',
      stream: streamId,
      plannedStart: currentStart,
      plannedEnd,
      actualStart,
      actualEnd,
      progress: pm.progress,
      status: pm.status,
      isCritical: isCriticalStream && ['finishing', 'edm', 'cmm', 'bench'].includes(step.id),
      dependencies: prevId ? [prevId] : [],
    });

    currentStart = plannedEnd;
  });

  return tasks;
}

// ─── Merge Point & Post-merge Tasks ─────────────────────────────────────────

function generateMergeAndPostTasks(streamTasks: GanttTask[]): GanttTask[] {
  // Find the latest bench work end date across all streams
  const benchTasks = streamTasks.filter(t => t.id.endsWith('_bench'));
  const latestBenchEnd = benchTasks.reduce((latest, t) => {
    return t.plannedEnd > latest ? t.plannedEnd : latest;
  }, '2026-01-01');

  const mergeStart = addWorkdays(latestBenchEnd, 1);

  const postTasks: GanttTask[] = [
    // FIT模 / QC 检验 (Merge point)
    {
      id: 'fit_qc',
      name: 'FIT Mold / QC Inspection',
      nameCn: 'FIT模 / QC检验',
      phase: 'physical',
      plannedStart: mergeStart,
      plannedEnd: addWorkdays(mergeStart, 5),
      progress: 0,
      status: 'not_started',
      isCritical: true,
      isMergePoint: true,
      dependencies: benchTasks.map(t => t.id),
    },
    // 钳工 Fin/Cpk
    {
      id: 'bench_fin_cpk',
      name: 'Bench Fin / Cpk',
      nameCn: '钳工精修/Cpk',
      phase: 'physical',
      plannedStart: addWorkdays(mergeStart, 6),
      plannedEnd: addWorkdays(mergeStart, 9),
      progress: 0,
      status: 'not_started',
      isCritical: true,
      dependencies: ['fit_qc'],
    },
    // T0 试模
    {
      id: 't0_trial',
      name: 'T0 Trial Molding',
      nameCn: 'T0 试模',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 10),
      plannedEnd: addWorkdays(mergeStart, 13),
      progress: 0,
      status: 'not_started',
      isCritical: true,
      dependencies: ['bench_fin_cpk'],
    },
    // 试模 FAI CPK
    {
      id: 'fai_cpk',
      name: 'Trial FAI / CPK',
      nameCn: '试模FAI/CPK',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 14),
      plannedEnd: addWorkdays(mergeStart, 17),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['t0_trial'],
    },
    // 试模外观修改
    {
      id: 'appearance_fix',
      name: 'Appearance Modification',
      nameCn: '试模外观修改',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 14),
      plannedEnd: addWorkdays(mergeStart, 19),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['t0_trial'],
    },
    // 试模3D修改
    {
      id: '3d_modification',
      name: '3D Modification',
      nameCn: '试模3D修改',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 14),
      plannedEnd: addWorkdays(mergeStart, 19),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['t0_trial'],
    },
    // T0M 合格报告
    {
      id: 't0m_report',
      name: 'T0M Qualification Report',
      nameCn: 'T0M合格报告',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 20),
      plannedEnd: addWorkdays(mergeStart, 22),
      progress: 0,
      status: 'not_started',
      isCritical: true,
      dependencies: ['fai_cpk', 'appearance_fix', '3d_modification'],
    },
    // 检主管签核
    {
      id: 'supervisor_signoff',
      name: 'Supervisor Sign-off',
      nameCn: '检主管/副总签核',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 23),
      plannedEnd: addWorkdays(mergeStart, 24),
      progress: 0,
      status: 'not_started',
      isCritical: true,
      dependencies: ['t0m_report'],
    },
    // T1 试模
    {
      id: 't1_trial',
      name: 'T1 Trial Molding',
      nameCn: 'T1 试模',
      phase: 'data',
      plannedStart: addWorkdays(mergeStart, 25),
      plannedEnd: addWorkdays(mergeStart, 28),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['supervisor_signoff'],
    },
    // G/L
    {
      id: 'gl',
      name: 'G/L Verification',
      nameCn: 'G/L验证',
      phase: 'production',
      plannedStart: addWorkdays(mergeStart, 29),
      plannedEnd: addWorkdays(mergeStart, 31),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['t1_trial'],
    },
    // VMP
    {
      id: 'vmp',
      name: 'VMP',
      nameCn: 'VMP验证',
      phase: 'production',
      plannedStart: addWorkdays(mergeStart, 32),
      plannedEnd: addWorkdays(mergeStart, 34),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['gl'],
    },
    // MP
    {
      id: 'mp',
      name: 'Mass Production',
      nameCn: 'MP量产',
      phase: 'production',
      plannedStart: addWorkdays(mergeStart, 35),
      plannedEnd: addWorkdays(mergeStart, 38),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['vmp'],
    },
    // SVP
    {
      id: 'svp',
      name: 'SVP',
      nameCn: 'SVP',
      phase: 'production',
      plannedStart: addWorkdays(mergeStart, 35),
      plannedEnd: addWorkdays(mergeStart, 37),
      progress: 0,
      status: 'not_started',
      isCritical: false,
      dependencies: ['vmp'],
    },
    // SOP
    {
      id: 'sop',
      name: 'SOP Release',
      nameCn: 'SOP正式发布',
      phase: 'production',
      plannedStart: addWorkdays(mergeStart, 38),
      plannedEnd: addWorkdays(mergeStart, 40),
      progress: 0,
      status: 'not_started',
      isCritical: true,
      dependencies: ['mp', 'svp'],
    },
  ];

  return postTasks;
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export function generateMilestones(tasks: GanttTask[]): Milestone[] {
  const t0Trial = tasks.find(t => t.id === 't0_trial');
  const t0mReport = tasks.find(t => t.id === 't0m_report');
  const supervisorSignoff = tasks.find(t => t.id === 'supervisor_signoff');
  const sop = tasks.find(t => t.id === 'sop');

  return [
    {
      id: 'ms_t0_trial',
      name: 'T0 Trial',
      nameCn: 'T0 试模',
      date: t0Trial?.plannedStart || '2026-03-16',
      type: 'T0_trial',
      status: 'pending',
      description: '首次试模，需上传试模报告',
    },
    {
      id: 'ms_t0_closure',
      name: 'T0 Closure',
      nameCn: 'T0 闭环',
      date: t0mReport?.plannedEnd || '2026-04-03',
      type: 'T0_closure',
      status: 'pending',
      description: '所有异常标记为 Done',
    },
    {
      id: 'ms_trial_to_mass',
      name: 'Trial → Mass',
      nameCn: '试产转量产签核',
      date: supervisorSignoff?.plannedEnd || '2026-04-10',
      type: 'trial_to_mass',
      status: 'pending',
      description: '具备 Signoff 动效',
    },
    {
      id: 'ms_sop',
      name: 'SOP',
      nameCn: 'SOP 正式结案',
      date: sop?.plannedEnd || '2026-05-08',
      type: 'SOP',
      status: 'pending',
      description: '正式结案里程碑',
    },
  ];
}

// ─── Build All Data ──────────────────────────────────────────────────────────

export function buildProjectData() {
  const baseStart = '2026-01-05';

  // Generate 4 parallel streams
  const cavityCoreTasks = generateStreamTasks('cavity_core', baseStart, 0, true);
  const cavityInsertTasks = generateStreamTasks('cavity_insert', baseStart, 2, false);
  const sliderTasks = generateStreamTasks('slider', baseStart, 3, false);
  const lifterTasks = generateStreamTasks('lifter', baseStart, 1, false);

  const allStreamTasks = [...cavityCoreTasks, ...cavityInsertTasks, ...sliderTasks, ...lifterTasks];
  const postTasks = generateMergeAndPostTasks(allStreamTasks);

  const allTasks = [...allStreamTasks, ...postTasks];
  const milestones = generateMilestones(allTasks);

  return { tasks: allTasks, milestones, projectInfo: PROJECT_INFO };
}

// ─── Date Utilities ──────────────────────────────────────────────────────────

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

export function getDateRange(tasks: GanttTask[]): { start: Date; end: Date } {
  let minDate = new Date('2099-12-31');
  let maxDate = new Date('2000-01-01');

  tasks.forEach(task => {
    const start = new Date(task.plannedStart);
    const end = new Date(task.plannedEnd);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
    if (task.actualStart) {
      const as = new Date(task.actualStart);
      if (as < minDate) minDate = as;
    }
    if (task.actualEnd) {
      const ae = new Date(task.actualEnd);
      if (ae > maxDate) maxDate = ae;
    }
  });

  // Add padding
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 7);

  return { start: minDate, end: maxDate };
}

export function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatDateFull(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
