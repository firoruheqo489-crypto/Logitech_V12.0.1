import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Clock, Target, TrendingUp } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import type { SCurvePoint, TaskItem } from '@/lib/projectProgress';
import { cn } from '@/lib/utils';

import {
  FORECAST_COMPLETION_MILESTONE_ID,
  SCURVE_MILESTONES,
  getNextSCurveMilestoneId,
  type SCurveMilestoneId,
} from './logitech-s-curve-machine';
import {
  formatSCurveCurrentStageLabel,
  getSCurveMilestoneBadgeLabel,
  getSCurveMilestoneLabel,
} from './logitech-s-curve-labels';

const SCURVE_RETRY_DELAY_MS = 3000;
const MIN_SPI = 0.15;
const MAX_SPI = 1.35;

type TaskRow = TaskItem;

interface LogitechSCurveProps {
  projectId: string;
  moldNumber?: string;
  className?: string;
  taskItems?: TaskItem[];
  disableRemoteFetch?: boolean;
  fillHeight?: boolean;
}

interface SCurveMetrics {
  deltaQ: number;
  deltaT: number;
  predictedMpDate: Date | null;
  actualProgress: number;
  plannedProgress: number;
  forecastAtTarget: number | null;
  totalCompletion: number;
  currentStageId: SCurveMilestoneId | 'unknown';
  currentStageComplete: boolean;
  doneCount: number;
  taskCount: number;
  targetDate: Date | null;
  spi: number;
  forecastSlipDays: number;
  totalWeight: number;
  earnedWeight: number;
  plannedWeight: number;
}

type ExtractedMilestone = {
  date: Date;
  actualDate: Date | null;
  milestoneId: SCurveMilestoneId;
  shortLabel: string;
  label: string;
  task: TaskRow;
};

type UnknownRecord = Record<string, unknown>;
type SCurveSeriesKey = 'planned' | 'actual' | 'forecast';

type SCurveTooltipEntry = {
  dataKey?: string;
  value?: number | string | null;
  payload?: SCurvePoint;
};

type SCurveTooltipProps = {
  active?: boolean;
  payload?: SCurveTooltipEntry[];
  label?: string | number;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function readString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  return String(value);
}

function readOptionalString(value: unknown): string | undefined {
  const normalized = readString(value).trim();
  return normalized ? normalized : undefined;
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
}

function normalizeTaskRow(raw: unknown): TaskRow | null {
  const row = asRecord(raw);
  if (!row) {
    return null;
  }

  return {
    id: readString(row.id),
    project_id: readString(row.project_id),
    name: readString(row.name),
    name_cn: readString(row.name_cn),
    phase: readString(row.phase),
    track: readOptionalString(row.track),
    stage: readOptionalString(row.stage),
    weight: readOptionalNumber(row.weight),
    duration_days: readNumber(row.duration_days),
    baseline_start: readString(row.baseline_start),
    baseline_end: readString(row.baseline_end),
    actual_start: readOptionalString(row.actual_start),
    actual_end: readOptionalString(row.actual_end),
    progress: readNumber(row.progress),
    status: readString(row.status),
    is_milestone: readBoolean(row.is_milestone),
    is_merge_point: readBoolean(row.is_merge_point),
  };
}

function normalizeTaskRows(payload: unknown): TaskRow[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((row) => normalizeTaskRow(row))
    .filter((row): row is TaskRow => row !== null);
}

function readTooltipValue(payload: SCurveTooltipEntry[] | undefined, key: SCurveSeriesKey): number | null {
  const value = payload?.find((entry) => entry.dataKey === key)?.value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return startOfDay(date);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function diffDays(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86400000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fmtShort(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function fmtLong(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toIsoDate(date: Date): string {
  return fmtLong(date);
}

function isOnOrBefore(date: Date | null, cutoff: Date): boolean {
  return !!date && date.getTime() <= cutoff.getTime();
}

function filterLeafTasks(tasks: TaskRow[]): TaskRow[] {
  return tasks.filter((task) => !!task.baseline_start && !!task.baseline_end);
}

function getTaskDateRange(task: TaskRow): { baselineStart: Date; baselineEnd: Date } | null {
  const baselineStart = parseDate(task.baseline_start);
  const baselineEnd = parseDate(task.baseline_end);
  if (!baselineStart || !baselineEnd) {
    return null;
  }

  return {
    baselineStart,
    baselineEnd: baselineEnd < baselineStart ? baselineStart : baselineEnd,
  };
}

function getEffectiveTaskWeight(task: TaskRow): number {
  const range = getTaskDateRange(task);
  const durationFromDates = range ? Math.max(diffDays(range.baselineEnd, range.baselineStart) + 1, 1) : 1;
  const duration = Math.max(task.duration_days || durationFromDates, 1);
  const baseWeight = task.weight && task.weight > 0 ? task.weight : 1;
  return roundTo(Math.max(baseWeight * duration, 0.5), 3);
}

function getPlannedTaskRatioAtDate(task: TaskRow, date: Date): number {
  const range = getTaskDateRange(task);
  if (!range) {
    return 0;
  }

  if (date < range.baselineStart) {
    return 0;
  }
  if (date >= range.baselineEnd) {
    return 1;
  }

  const totalDays = Math.max(diffDays(range.baselineEnd, range.baselineStart) + 1, 1);
  const elapsedDays = Math.max(diffDays(date, range.baselineStart) + 1, 0);
  return clamp(elapsedDays / totalDays, 0, 1);
}

function getActualTaskRatioAtDate(task: TaskRow, date: Date, today: Date): number {
  const currentProgress = clamp((task.progress || 0) / 100, 0, 1);
  const actualEnd = parseDate(task.actual_end);
  if (actualEnd && date >= actualEnd) {
    return 1;
  }

  const actualStart = parseDate(task.actual_start) ?? actualEnd;
  if (!actualStart || date < actualStart) {
    return 0;
  }

  const cappedDate = date > today ? today : date;
  if (cappedDate < actualStart) {
    return 0;
  }

  if (actualEnd) {
    const totalDays = Math.max(diffDays(actualEnd, actualStart) + 1, 1);
    const elapsedDays = Math.max(diffDays(cappedDate, actualStart) + 1, 0);
    return clamp(elapsedDays / totalDays, 0, 1);
  }

  if (currentProgress <= 0) {
    return 0;
  }

  const elapsedWindow = Math.max(diffDays(today, actualStart) + 1, 1);
  const elapsedDays = Math.max(diffDays(cappedDate, actualStart) + 1, 0);
  return clamp(currentProgress * (elapsedDays / elapsedWindow), 0, currentProgress);
}

function findBoundaryDates(tasks: TaskRow[]): {
  chartStart: Date | null;
  baselineStart: Date | null;
  baselineEnd: Date | null;
} {
  let baselineStart: Date | null = null;
  let baselineEnd: Date | null = null;

  for (const task of tasks) {
    const range = getTaskDateRange(task);
    if (!range) {
      continue;
    }

    if (!baselineStart || range.baselineStart < baselineStart) {
      baselineStart = range.baselineStart;
    }
    if (!baselineEnd || range.baselineEnd > baselineEnd) {
      baselineEnd = range.baselineEnd;
    }
  }

  return {
    baselineStart,
    baselineEnd,
    chartStart: baselineStart ? addDays(baselineStart, -1) : null,
  };
}

function extractMilestonesFromTasks(tasks: TaskRow[]): ExtractedMilestone[] {
  const results: ExtractedMilestone[] = [];

  for (const node of SCURVE_MILESTONES) {
    const matched = tasks.find((task) => {
      const canonicalId = (task.stage || task.id || '').replace(/\s+/g, '');
      return node.stageIds.includes(canonicalId);
    });

    if (!matched) {
      continue;
    }

    const baselineDate = parseDate(matched.baseline_end) ?? parseDate(matched.baseline_start);
    if (!baselineDate) {
      continue;
    }

    results.push({
      date: baselineDate,
      actualDate: parseDate(matched.actual_end),
      milestoneId: node.id,
      shortLabel: node.shortLabel,
      label: getSCurveMilestoneLabel(node.id),
      task: matched,
    });
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function sumWeightedProgress(
  tasks: TaskRow[],
  weights: Map<string, number>,
  getRatio: (task: TaskRow) => number,
): number {
  return tasks.reduce((sum, task) => sum + (weights.get(task.id) ?? 0) * getRatio(task), 0);
}

function buildSCurveData(
  tasks: TaskRow[],
): { points: SCurvePoint[]; metrics: SCurveMetrics; milestones: ExtractedMilestone[] } {
  const emptyMetrics: SCurveMetrics = {
    deltaQ: 0,
    deltaT: 0,
    predictedMpDate: null,
    actualProgress: 0,
    plannedProgress: 0,
    forecastAtTarget: null,
    totalCompletion: 0,
    currentStageId: 'unknown',
    currentStageComplete: false,
    doneCount: 0,
    taskCount: 0,
    targetDate: null,
    spi: 1,
    forecastSlipDays: 0,
    totalWeight: 0,
    earnedWeight: 0,
    plannedWeight: 0,
  };

  const today = startOfDay(new Date());
  const leafTasks = filterLeafTasks(tasks);
  if (leafTasks.length === 0) {
    return { points: [], metrics: emptyMetrics, milestones: [] };
  }

  const milestones = extractMilestonesFromTasks(leafTasks);
  const bounds = findBoundaryDates(leafTasks);
  if (!bounds.chartStart || !bounds.baselineStart || !bounds.baselineEnd) {
    return { points: [], metrics: emptyMetrics, milestones };
  }

  const targetDate = milestones[milestones.length - 1]?.date ?? bounds.baselineEnd;
  const weights = new Map(leafTasks.map((task) => [task.id, getEffectiveTaskWeight(task)]));
  const totalWeight = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return { points: [], metrics: emptyMetrics, milestones };
  }

  const plannedWeightAt = (date: Date) =>
    sumWeightedProgress(leafTasks, weights, (task) => getPlannedTaskRatioAtDate(task, date));
  const actualWeightAt = (date: Date) =>
    sumWeightedProgress(leafTasks, weights, (task) => getActualTaskRatioAtDate(task, date, today));
  const progressFromWeight = (weight: number) => roundTo((weight / totalWeight) * 100);

  const plannedProgressLookup = new Map<string, number>();
  const baselineDailyIncrements: number[] = [];
  const timelineDates: Date[] = [];
  let previousPlanned = 0;

  for (let date = bounds.chartStart; date.getTime() <= targetDate.getTime(); date = addDays(date, 1)) {
    const isoDate = toIsoDate(date);
    const plannedWeight = date < bounds.baselineStart ? 0 : plannedWeightAt(date);
    const plannedProgress = progressFromWeight(plannedWeight);

    plannedProgressLookup.set(isoDate, plannedProgress);
    baselineDailyIncrements.push(Math.max(0, roundTo(plannedProgress - previousPlanned, 4)));
    timelineDates.push(date);
    previousPlanned = plannedProgress;
  }

  const plannedWeightToday = plannedWeightAt(today);
  const actualWeightToday = actualWeightAt(today);
  const plannedToday = progressFromWeight(plannedWeightToday);
  const actualToday = progressFromWeight(actualWeightToday);
  const deltaQ = roundTo(plannedToday - actualToday);
  const doneCount = leafTasks.filter((task) => isOnOrBefore(parseDate(task.actual_end), today)).length;

  let plannedDateForActual = bounds.baselineStart;
  if (actualToday > 0) {
    for (const date of timelineDates) {
      const plannedProgress = plannedProgressLookup.get(toIsoDate(date)) ?? 0;
      if (plannedProgress >= actualToday) {
        plannedDateForActual = date;
        break;
      }
    }
  }

  const deltaT = actualToday > 0 ? diffDays(today, plannedDateForActual) : 0;
  const spiRaw = plannedWeightToday > 0.0001 ? actualWeightToday / plannedWeightToday : actualToday > 0 ? 1 : 1;
  const spi = actualToday >= 100 ? 1 : clamp(roundTo(spiRaw, 3), MIN_SPI, MAX_SPI);

  const forecastLookup = new Map<string, number>();
  let predictedMpDate: Date | null = null;
  const todayIso = toIsoDate(today);

  if (actualToday > 0) {
    forecastLookup.set(todayIso, actualToday);
  }

  if (actualToday >= 99.95) {
    const latestActualEnd = leafTasks.reduce<Date | null>((latest, task) => {
      const actualEnd = parseDate(task.actual_end);
      if (!actualEnd) {
        return latest;
      }
      if (!latest || actualEnd > latest) {
        return actualEnd;
      }
      return latest;
    }, null);
    predictedMpDate = latestActualEnd ?? today;
  } else {
    const targetIso = toIsoDate(targetDate);
    const targetIndex = timelineDates.findIndex((date) => toIsoDate(date) === targetIso);
    const todayIndex = timelineDates.findIndex((date) => toIsoDate(date) === todayIso);
    const templateStartIndex = todayIndex >= 0 ? todayIndex + 1 : 0;
    const remainingTemplate = targetIndex >= 0 ? baselineDailyIncrements.slice(templateStartIndex, targetIndex + 1) : [];
    const remainingPlannedProgress = Math.max(0, 100 - plannedToday);

    if (remainingTemplate.length > 0 && remainingPlannedProgress > 0.0001) {
      const verticalScale = Math.max((100 - actualToday) / remainingPlannedProgress, 0);
      let forecastDate = today;
      let forecastProgress = actualToday;
      let templateCursor = 0;
      let guard = 0;

      while (forecastProgress < 99.95 && guard < 1600) {
        guard += 1;
        forecastDate = addDays(forecastDate, 1);

        let templateBudget = spi;
        let templateDelta = 0;
        while (templateBudget > 0.000001 && templateCursor < remainingTemplate.length) {
          const bucketIndex = Math.floor(templateCursor);
          const bucketRemaining = 1 - (templateCursor - bucketIndex);
          const consumed = Math.min(templateBudget, bucketRemaining);
          templateDelta += remainingTemplate[bucketIndex] * consumed;
          templateCursor += consumed;
          templateBudget -= consumed;
        }

        if (templateDelta <= 0.000001) {
          const elapsedDays = Math.max(diffDays(today, bounds.baselineStart), 1);
          const actualRate = Math.max(actualToday / elapsedDays, 0.12);
          forecastProgress = Math.min(100, roundTo(forecastProgress + actualRate));
        } else {
          forecastProgress = Math.min(100, roundTo(forecastProgress + templateDelta * verticalScale));
        }

        forecastLookup.set(toIsoDate(forecastDate), forecastProgress);
        if (forecastProgress >= 99.95) {
          predictedMpDate = forecastDate;
        }
      }

      predictedMpDate = predictedMpDate ?? forecastDate;
    } else {
      const elapsedDays = Math.max(diffDays(today, bounds.baselineStart), 1);
      const actualRate = Math.max(actualToday / elapsedDays, 0.12);
      const remainingDays = Math.max(1, Math.ceil((100 - actualToday) / actualRate));
      let forecastDate = today;

      for (let day = 1; day <= remainingDays; day += 1) {
        forecastDate = addDays(today, day);
        const progressRatio = day / remainingDays;
        const easedRatio = 1 - (1 - progressRatio) ** 1.6;
        const forecastProgress = roundTo(actualToday + (100 - actualToday) * easedRatio);
        forecastLookup.set(toIsoDate(forecastDate), Math.min(100, forecastProgress));
      }

      predictedMpDate = forecastDate;
    }
  }

  const forecastAtTarget = forecastLookup.get(toIsoDate(targetDate)) ?? null;
  const domainEnd = [targetDate, today, predictedMpDate].reduce((latest, current) => {
    if (!current) {
      return latest;
    }
    if (!latest || current > latest) {
      return current;
    }
    return latest;
  }, bounds.baselineEnd as Date | null) ?? bounds.baselineEnd;

  const milestoneLookup = new Map<string, ExtractedMilestone>();
  for (const milestone of milestones) {
    milestoneLookup.set(toIsoDate(milestone.date), milestone);
  }

  const points: SCurvePoint[] = [];
  let axisIndex = 0;
  for (let date = bounds.chartStart; date.getTime() <= domainEnd.getTime(); date = addDays(date, 1)) {
    const isoDate = toIsoDate(date);
    const plannedWeight = date < bounds.baselineStart ? 0 : plannedWeightAt(date);
    const actualWeight = date.getTime() <= today.getTime() ? actualWeightAt(date) : null;
    const milestone = milestoneLookup.get(isoDate);
    const forecastProgress = forecastLookup.get(isoDate) ?? null;
    const plannedProgress = progressFromWeight(plannedWeight);
    const actualProgress = actualWeight == null ? null : progressFromWeight(actualWeight);

    points.push({
      week: axisIndex,
      dateLabel: fmtShort(date),
      dateIso: isoDate,
      timestamp: date.getTime(),
      planned: plannedProgress,
      actual: actualProgress,
      forecast: forecastProgress,
      plannedWeight: roundTo(plannedWeight, 3),
      actualWeight: actualWeight == null ? null : roundTo(actualWeight, 3),
      forecastWeight:
        forecastProgress == null ? null : roundTo((forecastProgress / 100) * totalWeight, 3),
      variance: actualProgress == null ? null : roundTo(plannedProgress - actualProgress),
      isToday: isoDate === todayIso,
      milestoneId:
        milestone?.milestoneId ??
        (predictedMpDate && isoDate === toIsoDate(predictedMpDate)
          ? FORECAST_COMPLETION_MILESTONE_ID
          : undefined),
      milestoneShortLabel:
        milestone?.shortLabel ??
        (predictedMpDate && isoDate === toIsoDate(predictedMpDate) ? 'FCST' : undefined),
      isForecastMilestone: !!predictedMpDate && isoDate === toIsoDate(predictedMpDate),
    });

    axisIndex += 1;
  }

  let currentStageId: SCurveMilestoneId | 'unknown' = milestones[0]?.milestoneId ?? 'unknown';
  let currentStageComplete = false;
  for (const milestone of milestones) {
    if (isOnOrBefore(milestone.actualDate, today)) {
      const nextStageId = getNextSCurveMilestoneId(milestone.milestoneId);
      currentStageId = nextStageId ?? milestone.milestoneId;
      currentStageComplete = nextStageId === null;
    }
  }

  const forecastSlipDays =
    predictedMpDate && predictedMpDate.getTime() > targetDate.getTime()
      ? diffDays(predictedMpDate, targetDate)
      : 0;

  return {
    points,
    milestones,
    metrics: {
      deltaQ,
      deltaT,
      predictedMpDate,
      actualProgress: actualToday,
      plannedProgress: plannedToday,
      forecastAtTarget,
      totalCompletion: actualToday,
      currentStageId,
      currentStageComplete,
      doneCount,
      taskCount: leafTasks.length,
      targetDate,
      spi,
      forecastSlipDays,
      totalWeight: roundTo(totalWeight, 3),
      earnedWeight: roundTo(actualWeightToday, 3),
      plannedWeight: roundTo(plannedWeightToday, 3),
    },
  };
}

function SCurveTooltip({ active, payload }: SCurveTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  const planned = readTooltipValue(payload, 'planned');
  const actual = readTooltipValue(payload, 'actual');
  const forecast = readTooltipValue(payload, 'forecast');
  const milestoneId = point?.milestoneId;
  const milestoneLabel = milestoneId ? getSCurveMilestoneBadgeLabel(milestoneId) : undefined;
  const variance = point?.variance;

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/95 p-4 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="mb-2 flex items-center gap-2 font-bold text-white">
        <span>{point?.dateIso ?? point?.dateLabel}</span>
        {milestoneLabel && (
          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
            {milestoneLabel}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {planned != null && (
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            <span className="text-sm text-gray-400">基线累计</span>
            <span className="font-bold text-cyan-400">{planned.toFixed(1)}%</span>
          </div>
        )}

        {actual != null && (
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <span className="text-sm text-gray-400">实际累计</span>
            <span className="font-bold text-yellow-400">{actual.toFixed(1)}%</span>
          </div>
        )}

        {forecast != null && (
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
            <span className="text-sm text-gray-400">SPI 预测</span>
            <span className="font-bold text-orange-400">{forecast.toFixed(1)}%</span>
          </div>
        )}

        {variance != null && actual != null && planned != null && (
          <div className="border-t border-white/10 pt-2">
            <div className="flex items-center gap-2">
              <TrendingUp
                className={cn('h-4 w-4', variance <= 0 ? 'text-emerald-400' : 'rotate-180 text-red-400')}
              />
              <span className="text-sm text-gray-400">ΔQ</span>
              <span className={cn('font-bold', variance <= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {variance > 0 ? '+' : ''}
                {variance.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LogitechSCurve({
  projectId,
  moldNumber,
  className = '',
  taskItems,
  disableRemoteFetch = false,
  fillHeight = false,
}: LogitechSCurveProps) {
  const hasInjectedTasks = Array.isArray(taskItems) && taskItems.length > 0;
  const [tasks, setTasks] = useState<TaskRow[]>(() => taskItems ?? []);
  const [loading, setLoading] = useState(() => !hasInjectedTasks && !disableRemoteFetch);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskItems) {
      return;
    }
    setTasks(taskItems);
    setError(null);
    setLoading(false);
  }, [taskItems]);

  useEffect(() => {
    if (disableRemoteFetch || hasInjectedTasks) {
      return;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const clearRetry = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer !== null) {
        return;
      }

      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void fetchData(false);
      }, SCURVE_RETRY_DELAY_MS);
    };

    async function fetchData(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const response = await apiFetch(`/api/tasks?projectId=${encodeURIComponent(projectId)}`);
        if (!response.ok) {
          throw new Error('S-curve data load failed');
        }
        const taskRows = normalizeTaskRows(await response.json());
        if (!cancelled) {
          setTasks(taskRows);
          setError(null);
          clearRetry();
        }
      } catch {
        if (!cancelled) {
          setError('数据加载失败，请稍后重试');
          scheduleRetry();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchData(true);
    return () => {
      cancelled = true;
      clearRetry();
    };
  }, [disableRemoteFetch, hasInjectedTasks, projectId]);

  const { points, metrics, milestones } = useMemo(() => buildSCurveData(tasks), [tasks]);

  const todayLabel = useMemo(() => {
    const today = startOfDay(new Date());
    return fmtShort(today);
  }, []);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center rounded-2xl border border-white/10 bg-[#1a1a1a] p-6', className)}>
        <span className="mr-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
        <span className="text-sm text-white/40">正在生成交付审计 S 曲线...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('rounded-2xl border border-white/10 bg-[#1a1a1a] p-6', className)}>
        <div className="flex items-center gap-3 text-white/40">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-white/10 bg-[#1a1a1a] p-6', className)}>
        <div className="mb-3 flex items-center gap-3 text-white/40">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className="text-sm">当前没有足够的任务日期数据，无法生成 S 曲线。</span>
        </div>
        {tasks.length > 0 && (
          <div className="space-y-1 text-[10px] text-white/20">
            <div>要求至少存在 baseline_start / baseline_end。</div>
            <div>当前任务数：{tasks.length}</div>
          </div>
        )}
      </div>
    );
  }

  const isPredictedLate = !!(
    metrics.predictedMpDate &&
    metrics.targetDate &&
    metrics.predictedMpDate.getTime() > metrics.targetDate.getTime()
  );
  const statusColor = isPredictedLate ? 'text-orange-400' : metrics.deltaQ <= 0 ? 'text-emerald-400' : 'text-red-400';
  const tickInterval =
    points.length > 150 ? 13 : points.length > 110 ? 10 : points.length > 80 ? 7 : points.length > 45 ? 4 : 2;
  const responsiveContainerProps = fillHeight
    ? { width: '100%', height: '100%' }
    : { width: '100%', aspect: 4.8 };
  const targetLabel = metrics.targetDate ? fmtShort(metrics.targetDate) : null;
  const predictedLabel = metrics.predictedMpDate ? fmtShort(metrics.predictedMpDate) : null;

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 backdrop-blur-xl',
        fillHeight && 'flex h-full flex-col',
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
            <Activity className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">项目进度 S 曲线审计</h3>
            <p className="text-sm text-gray-400">
              {projectId}
              {moldNumber && moldNumber !== projectId && (
                <span className="ml-2 text-gray-500">({moldNumber})</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">实际累计</div>
            <div className="text-2xl font-bold tabular-nums text-yellow-400">{metrics.actualProgress.toFixed(1)}%</div>
          </div>

          <div className="h-10 w-px bg-white/10" />
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-gray-500">
              <Target className="h-3 w-3" />
              ΔQ 偏差
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', statusColor)}>
              {metrics.deltaQ > 0 ? '+' : ''}
              {metrics.deltaQ.toFixed(1)}%
            </div>
          </div>

          <div className="h-10 w-px bg-white/10" />
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-gray-500">
              <Clock className="h-3 w-3" />
              ΔT 偏差
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', metrics.deltaT > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {metrics.deltaT > 0 ? '+' : ''}
              {metrics.deltaT}d
            </div>
          </div>

          <div className="h-10 w-px bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">SPI</div>
            <div className={cn('text-2xl font-bold tabular-nums', metrics.spi < 1 ? 'text-orange-400' : 'text-cyan-400')}>
              {metrics.spi.toFixed(2)}
            </div>
          </div>

          {metrics.predictedMpDate && (
            <>
              <div className="h-10 w-px bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">预测完工</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: isPredictedLate ? '#ff6b6b' : '#fb923c' }}>
                  {fmtShort(metrics.predictedMpDate)}
                </div>
              </div>
            </>
          )}

          {metrics.targetDate && (
            <>
              <div className="h-10 w-px bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">目标结案</div>
                <div className="text-lg font-bold tabular-nums text-cyan-400">{fmtShort(metrics.targetDate)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={cn('relative', fillHeight && 'min-h-0 flex-1')}>
        <ResponsiveContainer {...responsiveContainerProps}>
          <ComposedChart data={points} margin={{ top: 28, right: 28, left: 16, bottom: 24 }}>
            <defs>
              <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur result="coloredBlur" stdDeviation="4" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur result="coloredBlur" stdDeviation="3" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur result="coloredBlur" stdDeviation="3" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="actual-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#facc15" stopOpacity={0.82} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.62} />
              </linearGradient>
              <linearGradient id="area-planned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />

            {targetLabel && predictedLabel && isPredictedLate && targetLabel !== predictedLabel && (
              <ReferenceArea x1={targetLabel} x2={predictedLabel} fill="rgba(239,68,68,0.08)" strokeOpacity={0} />
            )}

            <XAxis
              dataKey="dateLabel"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              interval={tickInterval}
              minTickGap={18}
            />

            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value: number) => `${value}%`}
            />

            <Tooltip content={<SCurveTooltip />} />

            <Legend
              wrapperStyle={{ paddingTop: '18px', display: 'flex', justifyContent: 'flex-end' }}
              align="right"
              iconType="line"
              payload={[
                { value: '基线', type: 'line', color: '#22d3ee', id: 'planned-line' },
                { value: '实际', type: 'line', color: '#facc15', id: 'actual-line' },
                { value: '预测', type: 'line', color: '#fb923c', id: 'forecast-line' },
              ]}
              formatter={(value: string) => <span style={{ color: '#e5e7eb', fontSize: '12px', fontWeight: 700 }}>{value}</span>}
            />

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

            {targetLabel && (
              <ReferenceLine
                x={targetLabel}
                stroke="rgba(34,211,238,0.45)"
                strokeDasharray="4 4"
                label={{
                  value: 'TARGET',
                  position: 'insideTopRight',
                  fill: '#67e8f9',
                  fontSize: 9,
                }}
              />
            )}

            {predictedLabel && (
              <ReferenceLine
                x={predictedLabel}
                stroke="rgba(251,146,60,0.65)"
                strokeDasharray="6 4"
                label={{
                  value: 'FCST',
                  position: 'insideTopLeft',
                  fill: '#fdba74',
                  fontSize: 9,
                }}
              />
            )}

            {milestones.map((milestone, index) => (
              <ReferenceLine
                key={`${milestone.milestoneId}-${milestone.date.getTime()}`}
                x={fmtShort(milestone.date)}
                stroke="rgba(255,255,255,0.16)"
                strokeDasharray="2 4"
                label={{
                  value: milestone.shortLabel,
                  position: index % 2 === 0 ? 'insideTopLeft' : 'insideTopRight',
                  fill: '#94a3b8',
                  fontSize: 9,
                }}
              />
            ))}

            <Area
              type="monotone"
              dataKey="planned"
              fill="url(#area-planned)"
              stroke="none"
              legendType="none"
            />

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

            <Line
              type="monotone"
              dataKey="actual"
              stroke="url(#actual-gradient)"
              strokeWidth={4}
              dot={{ fill: '#facc15', r: 3.6, strokeWidth: 0 }}
              activeDot={{ r: 7, fill: '#facc15', stroke: '#fff', strokeWidth: 2 }}
              style={{ filter: 'url(#glow-yellow)' }}
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#fb923c"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 5, fill: '#fb923c', stroke: '#fff', strokeWidth: 2 }}
              connectNulls
              style={{ filter: 'url(#glow-orange)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {milestones.map((milestone) => (
          <div
            key={milestone.milestoneId}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300"
          >
            <span className="font-semibold text-cyan-300">{milestone.shortLabel}</span>
            <span>{milestone.label}</span>
            <span className="font-mono text-slate-500">{fmtShort(milestone.date)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400">当前阶段</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-cyan-400">
            {formatSCurveCurrentStageLabel(metrics.currentStageId, metrics.currentStageComplete)}
          </div>
        </div>

        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400">权重进度</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-yellow-400 tabular-nums">
            {metrics.earnedWeight.toFixed(1)} / {metrics.totalWeight.toFixed(1)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            任务完成 {metrics.doneCount}/{metrics.taskCount}
          </div>
        </div>

        <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-orange-400" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400">目标日预测值</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-orange-400 tabular-nums">
            {metrics.forecastAtTarget == null ? 'N/A' : `${metrics.forecastAtTarget.toFixed(1)}%`}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">SPI 拉伸剩余基线后的落点</div>
        </div>

        <div
          className={cn(
            'rounded-lg border p-3',
            isPredictedLate ? 'border-red-500/20 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/10',
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', isPredictedLate ? 'bg-red-400 animate-pulse' : 'bg-emerald-400')} />
            <span className="text-[10px] uppercase tracking-wider text-gray-400">审计结论</span>
          </div>
          <div className={cn('mt-1 text-sm font-semibold', isPredictedLate ? 'text-red-400' : 'text-emerald-400')}>
            {isPredictedLate ? `预计延误 ${metrics.forecastSlipDays} 天` : '按当前效率仍可收敛'}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            {metrics.deltaQ > 0 ? `当前落后 ${metrics.deltaQ.toFixed(1)}%` : `当前领先 ${Math.abs(metrics.deltaQ).toFixed(1)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
