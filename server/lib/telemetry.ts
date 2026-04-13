import type { Sql } from 'postgres';
import {
  buildReliabilityState,
  createProjectSeed,
  normalizeIsoTimestamp,
  type MoldRepairAction,
  type ReliabilityEventRecord,
  type ReliabilityProjectSeed,
} from './reliability-engine.js';

type QueryableSql = Pick<Sql<{}>, 'unsafe'>;

type ProjectSeedRow = {
  projectId: string | null;
  moldId: string | null;
  moldNo: string | null;
  moldStatus: string | null;
  reliabilityMetrics: unknown;
};

type MaintenanceLogRow = {
  id: string;
  moldId: string;
  moldNo: string | null;
  type: 'SICKNESS' | 'SURGERY' | 'CHECKUP';
  symptom: string;
  diagnosis: string;
  procedure: string;
  operator: string | null;
  repairAction: MoldRepairAction | null;
  occurredAt: string;
  currentShots: number;
  recoveryRating: number;
  downtimeHours: number;
  cost: number;
  imageUrl: string | null;
  estimatedCompletion: string | null;
  createdAt: string;
};

type MaintenanceSummaryRow = {
  sicknessCount: number;
  surgeryCount: number;
  checkupCount: number;
  totalDowntimeHours: number;
  totalCost: number;
  avgRecoveryRating: number;
  maxCurrentShots: number;
};

const DESIGN_LIFE_SHOTS = 1_000_000;

function roundValue(value: number, fractionDigits: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(fractionDigits));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapMaintenanceLogRows(rows: MaintenanceLogRow[]): ReliabilityEventRecord[] {
  return rows.map((row) => ({
    id: row.id,
    moldId: row.moldId,
    moldNo: row.moldNo,
    type: row.type,
    symptom: row.symptom,
    diagnosis: row.diagnosis,
    procedure: row.procedure,
    operator: row.operator,
    repairAction: row.repairAction,
    occurredAt: normalizeIsoTimestamp(row.occurredAt),
    currentShots: readFiniteNumber(row.currentShots),
    recoveryRating: readFiniteNumber(row.recoveryRating),
    downtimeHours: readFiniteNumber(row.downtimeHours),
    cost: readFiniteNumber(row.cost),
    imageUrl: row.imageUrl,
    estimatedCompletion: row.estimatedCompletion,
    createdAt: normalizeIsoTimestamp(row.createdAt),
  }));
}

async function readProjectSeed(sqlClient: QueryableSql, moldId: string): Promise<ReliabilityProjectSeed> {
  const rows = await sqlClient.unsafe<ProjectSeedRow[]>(
    `
      SELECT
        id AS "projectId",
        COALESCE(NULLIF(TRIM(mold_number), ''), id) AS "moldId",
        NULLIF(TRIM(index_no), '') AS "moldNo",
        mold_status AS "moldStatus",
        reliability_metrics AS "reliabilityMetrics"
      FROM projects
      WHERE id = $1 OR mold_number = $1
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `,
    [moldId],
  );

  const row = rows[0];
  return createProjectSeed({
    projectId: row?.projectId ?? null,
    moldId: row?.moldId || moldId,
    moldNo: row?.moldNo ?? null,
    moldStatus: row?.moldStatus ?? null,
    metrics: row?.reliabilityMetrics ?? null,
  });
}

async function readMaintenanceLogs(sqlClient: QueryableSql, moldId: string): Promise<ReliabilityEventRecord[]> {
  const rows = await sqlClient.unsafe<MaintenanceLogRow[]>(
    `
      SELECT
        id::text AS id,
        mold_number AS "moldId",
        mold_no AS "moldNo",
        event_type AS type,
        symptom,
        diagnosis,
        procedure,
        operator,
        repair_action AS "repairAction",
        occurred_at::text AS "occurredAt",
        current_shots AS "currentShots",
        recovery_rating AS "recoveryRating",
        downtime_hours AS "downtimeHours",
        cost,
        image_url AS "imageUrl",
        estimated_completion AS "estimatedCompletion",
        created_at::text AS "createdAt"
      FROM mold_maintenance_logs
      WHERE mold_number = $1
      ORDER BY occurred_at DESC, id DESC
    `,
    [moldId],
  );

  return mapMaintenanceLogRows(rows);
}

async function readMaintenanceSummary(sqlClient: QueryableSql, moldId: string): Promise<MaintenanceSummaryRow> {
  const rows = await sqlClient.unsafe<MaintenanceSummaryRow[]>(
    `
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE event_type = 'SICKNESS'), 0)::int AS "sicknessCount",
        COALESCE(COUNT(*) FILTER (WHERE event_type = 'SURGERY'), 0)::int AS "surgeryCount",
        COALESCE(COUNT(*) FILTER (WHERE event_type = 'CHECKUP'), 0)::int AS "checkupCount",
        ROUND(COALESCE(SUM(downtime_hours), 0)::numeric, 2)::float8 AS "totalDowntimeHours",
        ROUND(COALESCE(SUM(cost), 0)::numeric, 2)::float8 AS "totalCost",
        ROUND(COALESCE(AVG(recovery_rating), 0)::numeric, 4)::float8 AS "avgRecoveryRating",
        COALESCE(MAX(current_shots), 0)::int AS "maxCurrentShots"
      FROM mold_maintenance_logs
      WHERE mold_number = $1
    `,
    [moldId],
  );

  return rows[0] ?? {
    sicknessCount: 0,
    surgeryCount: 0,
    checkupCount: 0,
    totalDowntimeHours: 0,
    totalCost: 0,
    avgRecoveryRating: 0,
    maxCurrentShots: 0,
  };
}

function computeCorrectiveMtbfDays(events: ReliabilityEventRecord[]): number {
  if (events.length < 2) {
    return 0;
  }

  const deltas: number[] = [];
  for (let index = 1; index < events.length; index += 1) {
    const previous = new Date(events[index - 1].occurredAt).getTime();
    const next = new Date(events[index].occurredAt).getTime();
    if (!Number.isFinite(previous) || !Number.isFinite(next)) {
      continue;
    }

    const days = (next - previous) / 864e5;
    if (days > 0) {
      deltas.push(days);
    }
  }

  if (deltas.length === 0) {
    return 0;
  }

  return Math.round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length);
}

export async function buildMoldTelemetry(sqlClient: QueryableSql, moldId: string) {
  const [seed, events, summary] = await Promise.all([
    readProjectSeed(sqlClient, moldId),
    readMaintenanceLogs(sqlClient, moldId),
    readMaintenanceSummary(sqlClient, moldId),
  ]);

  const currentShotsFromMetrics = readFiniteNumber(seed.metrics?.currentShots);
  const currentShotsFromLogs = readFiniteNumber(summary.maxCurrentShots);
  const currentShots = Math.max(currentShotsFromMetrics, currentShotsFromLogs, 0);

  const state = buildReliabilityState({
    moldId,
    seed,
    events,
    currentShotsOverride: currentShots,
  });

  const correctiveEvents = events
    .filter((eventRecord) => eventRecord.type === 'SICKNESS' || eventRecord.type === 'SURGERY')
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  const sicknessCount = readFiniteNumber(summary.sicknessCount);
  const surgeryCount = readFiniteNumber(summary.surgeryCount);
  const checkupCount = readFiniteNumber(summary.checkupCount);
  const totalDowntimeHours = roundValue(readFiniteNumber(summary.totalDowntimeHours), 2);
  const totalCost = roundValue(readFiniteNumber(summary.totalCost), 2);
  const avgRecoveryRating = roundValue(readFiniteNumber(summary.avgRecoveryRating), 4);
  const currentReliability =
    currentShots === 0 && events.length === 0 && !seed.metrics
      ? 1
      : roundValue(readFiniteNumber(state.metrics.currentReliability), 6);
  const healthScore = clamp(Math.round(currentReliability * 100), 0, 100);

  return {
    asset: {
      moldId: state.moldId,
      moldNo: state.moldNo,
      projectId: seed.projectId ?? state.moldId,
      designLife: DESIGN_LIFE_SHOTS,
      currentShots,
      totalRepairCount: sicknessCount + surgeryCount,
    },
    stats: {
      healthScore,
      lifeConsumedPct: roundValue(currentShots / DESIGN_LIFE_SHOTS, 6),
      currentReliability,
      nextPmDate: null,
      nextPmDays: 0,
      sicknessCount,
      surgeryCount,
      checkupCount,
      totalDowntimeHours,
      totalCost,
      mtbfDays: computeCorrectiveMtbfDays(correctiveEvents),
      avgRecoveryRating,
    },
    events: [...events]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .map((eventRecord) => ({
        id: eventRecord.id,
        type: eventRecord.type,
        occurredAt: eventRecord.occurredAt,
        currentShots: readFiniteNumber(eventRecord.currentShots),
        repairAction: eventRecord.repairAction ?? null,
        symptom: eventRecord.symptom,
        diagnosis: eventRecord.diagnosis,
        procedure: eventRecord.procedure,
        downtimeHours: readFiniteNumber(eventRecord.downtimeHours),
        recoveryRating: readFiniteNumber(eventRecord.recoveryRating),
        cost: readFiniteNumber(eventRecord.cost),
      })),
  };
}
