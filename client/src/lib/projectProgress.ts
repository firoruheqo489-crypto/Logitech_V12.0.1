import { buildDemoData, type GanttData, type TaskNode } from '@shared/ganttEngine';

import type { SCurvePointMilestoneId } from '@/components/logitech-s-curve-machine';

export interface TaskItem {
  id: string;
  project_id: string;
  name: string;
  name_cn: string;
  phase: string;
  track?: string;
  stage?: string;
  weight?: number;
  duration_days: number;
  baseline_start: string;
  baseline_end: string;
  actual_start?: string;
  actual_end?: string;
  progress: number;
  status: string;
  is_milestone?: boolean;
  is_merge_point?: boolean;
}

export interface SCurvePoint {
  week: number;
  dateLabel: string;
  timestamp: number;
  planned: number;
  actual: number | null;
  forecast: number | null;
  dateIso?: string;
  plannedWeight?: number;
  actualWeight?: number | null;
  forecastWeight?: number | null;
  variance?: number | null;
  isToday?: boolean;
  milestoneId?: SCurvePointMilestoneId;
  milestoneShortLabel?: string;
  isForecastMilestone?: boolean;
}

export interface ProjectProgressSeed {
  moduleName: string;
  projectId: string;
  moldNumber: string;
  ganttData: GanttData;
  taskItems: TaskItem[];
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function deriveTaskWeight(task: TaskNode): number {
  const baseWeight = task.weight > 0 ? task.weight : 1;
  const phaseMultiplier =
    task.phase === 'physical' ? 1.35 : task.phase === 'production' ? 1.1 : 0.9;
  const stageMultiplierMap: Record<string, number> = {
    roughing: 2.4,
    finishing: 2.1,
    edm: 1.9,
    bench: 1.6,
    fit: 1.8,
    mold_fai_cpk: 1.7,
    t0_trial: 1.3,
    t0_summary: 1.4,
    t1_trial: 1.2,
    t0_closure_report: 1.4,
    sop: 1.2,
    spc_inspection: 1.35,
  };
  const stageMultiplier = stageMultiplierMap[task.stage || ''] ?? 1;
  const criticalMultiplier = task.isCritical ? 1.15 : 1;
  const milestoneMultiplier = task.isMilestone || task.isMergePoint ? 1.1 : 1;

  return roundTo(baseWeight * phaseMultiplier * stageMultiplier * criticalMultiplier * milestoneMultiplier);
}

function mapTaskNodeToTaskItem(task: TaskNode): TaskItem {
  return {
    id: task.id,
    project_id: task.projectId,
    name: task.name,
    name_cn: task.nameCn,
    phase: task.phase,
    track: task.track,
    stage: task.stage,
    weight: deriveTaskWeight(task),
    duration_days: task.durationDays,
    baseline_start: task.baselineStart,
    baseline_end: task.baselineEnd,
    actual_start: task.actualStart,
    actual_end: task.actualEnd,
    progress: task.progress,
    status: task.status,
    is_milestone: task.isMilestone,
    is_merge_point: task.isMergePoint,
  };
}

export function buildProjectProgressSeed(moduleName?: string): ProjectProgressSeed {
  const demoData = buildDemoData();
  const resolvedModuleName = moduleName?.trim() || demoData.projectInfo.project_name || 'Ziti';

  const ganttData: GanttData = {
    ...demoData,
    projectInfo: {
      ...demoData.projectInfo,
      project_name: resolvedModuleName,
    },
    tasks: demoData.tasks.map((task) => ({ ...task })),
    postMergeTasks: demoData.postMergeTasks.map((task) => ({ ...task })),
    tracks: demoData.tracks.map((track) => ({
      ...track,
      tasks: track.tasks.map((task) => ({ ...task })),
    })),
    dependencies: demoData.dependencies.map((dependency) => ({ ...dependency })),
    milestones: demoData.milestones.map((milestone) => ({ ...milestone })),
    dateRange: { ...demoData.dateRange },
  };

  return {
    moduleName: resolvedModuleName,
    projectId: ganttData.projectInfo.id,
    moldNumber: ganttData.projectInfo.moldNumber,
    ganttData,
    taskItems: ganttData.tasks.map(mapTaskNodeToTaskItem),
  };
}
