import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';

type MoldHealthRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'MOLD_ID_REQUIRED'
  | 'INVALID_MAINTENANCE_PAYLOAD'
  | 'MOLD_TELEMETRY_LOAD_FAILED'
  | 'MOLD_MAINTENANCE_CREATE_FAILED'
  | 'MOLD_MAINTENANCE_DELETE_FAILED'
  | 'MOLD_MAINTENANCE_EVENT_ID_REQUIRED'
  | 'MOLD_MAINTENANCE_EVENT_NOT_FOUND';

const MOLD_HEALTH_ROUTE_ERROR_MESSAGES: Record<MoldHealthRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  MOLD_ID_REQUIRED: 'mold id is required',
  INVALID_MAINTENANCE_PAYLOAD: 'Invalid maintenance payload',
  MOLD_TELEMETRY_LOAD_FAILED: 'Failed to load mold telemetry',
  MOLD_MAINTENANCE_CREATE_FAILED: 'Failed to create maintenance log',
  MOLD_MAINTENANCE_DELETE_FAILED: 'Failed to delete maintenance log',
  MOLD_MAINTENANCE_EVENT_ID_REQUIRED: 'maintenance event id is required',
  MOLD_MAINTENANCE_EVENT_NOT_FOUND: 'maintenance event not found',
};

type MoldMaintenanceType = 'SICKNESS' | 'SURGERY' | 'CHECKUP';
type MoldRepairAction =
  | 'WEAR_PART_CLEAN_POLISH'
  | 'INSERT_REPLACEMENT_LOCAL_REFIT'
  | 'WELDING_MAJOR_MACHINING';

type MoldMaintenanceLogRow = {
  id: string;
  mold_id: string;
  mold_no: string | null;
  type: string;
  repair_action: string | null;
  current_shots: number | string;
  symptom: string | null;
  diagnosis: string | null;
  procedure: string | null;
  operator: string | null;
  downtime_hours: number | string | null;
  recovery_rating: number | string | null;
  cost: number | string | null;
  image_url: string | null;
  estimated_completion: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

type MaintenanceCreatePayload = {
  moldNo: string | null;
  type: MoldMaintenanceType;
  repairAction: MoldRepairAction;
  currentShots: number;
  symptom: string;
  diagnosis: string;
  procedure: string;
  downtimeHours: number;
  recoveryRating: number;
  operator: string;
  cost: number;
  imageUrl: string | null;
  estimatedCompletion: string | null;
};

const DESIGN_LIFE_SHOTS = 1_000_000;
const THEORETICAL_BETA = 1.85;
const THEORETICAL_ETA = 1_000_000;
const PM_INTERVAL_SHOTS = 50_000;
const SHOTS_PER_DAY = 5_000;
const EARLY_FAILURE_END_RATIO = 0.15;
const USEFUL_LIFE_END_RATIO = 0.85;
const CHART_WIDTH = 1_000;
const CHART_HEIGHT = 256;

let moldMaintenanceTableReady: Promise<void> | null = null;

function sendMoldHealthRouteError(
  res: Response,
  status: number,
  code: MoldHealthRouteErrorCode,
): void {
  res.status(status).json({
    error: MOLD_HEALTH_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function readTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeMaintenanceType(value: unknown): MoldMaintenanceType {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'SURGERY') return 'SURGERY';
  if (normalized === 'CHECKUP') return 'CHECKUP';
  return 'SICKNESS';
}

function normalizeRepairAction(value: unknown): MoldRepairAction {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'INSERT_REPLACEMENT_LOCAL_REFIT') return 'INSERT_REPLACEMENT_LOCAL_REFIT';
  if (normalized === 'WELDING_MAJOR_MACHINING') return 'WELDING_MAJOR_MACHINING';
  return 'WEAR_PART_CLEAN_POLISH';
}

function round(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeIso(value: unknown): string | null {
  const raw = readTrimmedString(value, 128);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function computeRecoveryRating(currentShots: number, repairAction: MoldRepairAction): number {
  const baseRecoveryMap: Record<MoldRepairAction, number> = {
    WEAR_PART_CLEAN_POLISH: 0.98,
    INSERT_REPLACEMENT_LOCAL_REFIT: 0.85,
    WELDING_MAJOR_MACHINING: 0.7,
  };
  const base = baseRecoveryMap[repairAction] ?? 0.98;
  const lifeRatio = clamp(Math.trunc(currentShots) / DESIGN_LIFE_SHOTS, 0, 1);
  const recovery = base * (1 - lifeRatio * 0.2);
  return round(clamp(recovery, Number.EPSILON, base));
}

function normalizeMaintenanceCreatePayload(body: unknown): MaintenanceCreatePayload | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const currentShots = Math.trunc(readFiniteNumber(record.currentShots) ?? Number.NaN);
  const symptom = readTrimmedString(record.symptom, 500);
  const diagnosis = readTrimmedString(record.diagnosis, 255);
  const procedure = readTrimmedString(record.procedure, 1000);
  const operator = readTrimmedString(record.operator, 255);

  if (!Number.isFinite(currentShots) || currentShots < 0 || !symptom || !diagnosis || !procedure || !operator) {
    return null;
  }

  const repairAction = normalizeRepairAction(record.repairAction);
  const fallbackRecovery = computeRecoveryRating(currentShots, repairAction);
  const recoveryRating = clamp(readFiniteNumber(record.recoveryRating) ?? fallbackRecovery, 0, 1);
  const downtimeHours = clamp(readFiniteNumber(record.downtimeHours) ?? 0, 0, 10_000);
  const cost = clamp(readFiniteNumber(record.cost) ?? 0, 0, 1_000_000_000);

  return {
    moldNo: readTrimmedString(record.moldNo, 80),
    type: normalizeMaintenanceType(record.type),
    repairAction,
    currentShots,
    symptom,
    diagnosis,
    procedure,
    downtimeHours,
    recoveryRating: round(recoveryRating),
    operator,
    cost: round(cost, 2),
    imageUrl: readTrimmedString(record.imageUrl, 4096),
    estimatedCompletion: normalizeIso(record.estimatedCompletion),
  };
}

function readRowNumber(value: number | string | null | undefined): number {
  const parsed = readFiniteNumber(value);
  return parsed ?? 0;
}

function toIso(value: string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

function toMaintenanceEvent(row: MoldMaintenanceLogRow) {
  return {
    id: row.id,
    moldId: String(row.mold_id || ''),
    moldNo: readTrimmedString(row.mold_no, 80),
    type: String(row.type || 'SICKNESS').toUpperCase(),
    symptom: String(row.symptom || ''),
    diagnosis: String(row.diagnosis || ''),
    procedure: String(row.procedure || ''),
    operator: readTrimmedString(row.operator, 255),
    occurredAt: toIso(row.occurred_at),
    currentShots: Math.max(0, Math.trunc(readRowNumber(row.current_shots))),
    recoveryRating: round(readRowNumber(row.recovery_rating)),
    downtimeHours: round(readRowNumber(row.downtime_hours), 2),
    cost: round(readRowNumber(row.cost), 2),
    imageUrl: readTrimmedString(row.image_url, 4096),
    estimatedCompletion: normalizeIso(row.estimated_completion),
    createdAt: toIso(row.created_at),
  };
}

function computeHazard(shots: number, maxShots: number): number {
  const ratio = clamp(shots / maxShots, 0, 1);
  const infantDecay = 0.8 * Math.exp(-12 * ratio);
  const wearOutRamp = ratio > 0.75 ? 0.9 * Math.pow((ratio - 0.75) / 0.25, 3) : 0;
  return infantDecay + 0.05 + wearOutRamp;
}

function buildCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const c1x = prev.x + (curr.x - prev.x) * 0.5;
    const c2x = prev.x + (curr.x - prev.x) * 0.5;
    path += ` C ${round(c1x)} ${round(prev.y)} ${round(c2x)} ${round(curr.y)} ${round(curr.x)} ${round(curr.y)}`;
  }
  return path;
}

function buildChartData(
  currentShots: number,
  beta: number,
  eta: number,
  events: ReturnType<typeof toMaintenanceEvent>[],
) {
  const curvePoints = Array.from({ length: 201 }, (_, index) => {
    const shot = (index / 200) * DESIGN_LIFE_SHOTS;
    const hazard = computeHazard(shot, DESIGN_LIFE_SHOTS);
    const reliability = Math.exp(-Math.pow(Math.max(0, shot / Math.max(eta, 1)), beta));
    const x = (index / 200) * CHART_WIDTH;
    return {
      shot: Math.round(shot),
      hazard: round(hazard, 6),
      reliability: round(reliability, 8),
      x: round(x),
      y: 0,
    };
  });

  const maxHazard = Math.max(...curvePoints.map((point) => point.hazard), Number.EPSILON);
  const normalizedCurvePoints = curvePoints.map((point) => {
    const y = CHART_HEIGHT - (point.hazard / maxHazard) * (CHART_HEIGHT * 0.85) - CHART_HEIGHT * 0.05;
    return {
      ...point,
      y: round(y),
    };
  });

  const curvePath = buildCurvePath(normalizedCurvePoints.map((point) => ({ x: point.x, y: point.y })));
  const fillPath = `${curvePath} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  const markerShot = clamp(currentShots, 0, DESIGN_LIFE_SHOTS);
  const markerHazard = computeHazard(markerShot, DESIGN_LIFE_SHOTS);
  const markerY = CHART_HEIGHT - (markerHazard / maxHazard) * (CHART_HEIGHT * 0.85) - CHART_HEIGHT * 0.05;
  const markerX = (markerShot / DESIGN_LIFE_SHOTS) * CHART_WIDTH;

  const currentZoneId =
    markerShot / DESIGN_LIFE_SHOTS < EARLY_FAILURE_END_RATIO
      ? 'early_failure'
      : markerShot / DESIGN_LIFE_SHOTS < USEFUL_LIFE_END_RATIO
        ? 'useful_life'
        : 'wear_out';

  const eventMarkers = [...events]
    .sort((left, right) => left.currentShots - right.currentShots)
    .map((event) => {
      const shot = clamp(event.currentShots, 0, DESIGN_LIFE_SHOTS);
      const hazard = computeHazard(shot, DESIGN_LIFE_SHOTS);
      const x = (shot / DESIGN_LIFE_SHOTS) * CHART_WIDTH;
      const y = CHART_HEIGHT - (hazard / maxHazard) * (CHART_HEIGHT * 0.85) - CHART_HEIGHT * 0.05;

      return {
        id: event.id,
        shot,
        physicalShot: event.currentShots,
        hazard: round(hazard, 6),
        x: round(x),
        y: round(y),
        xPct: round((shot / DESIGN_LIFE_SHOTS) * 100, 2),
        type: event.type || 'SICKNESS',
        labelKey: null as string | null,
      };
    });

  return {
    svgWidth: CHART_WIDTH,
    svgHeight: CHART_HEIGHT,
    maxShots: DESIGN_LIFE_SHOTS,
    maxHazard: round(maxHazard, 6),
    earlyFailureEndPct: EARLY_FAILURE_END_RATIO,
    usefulLifeEndPct: USEFUL_LIFE_END_RATIO,
    currentZoneId,
    curvePoints: normalizedCurvePoints,
    curvePath,
    fillPath,
    currentMarker: {
      id: 'current',
      shot: markerShot,
      physicalShot: markerShot,
      hazard: round(markerHazard, 6),
      x: round(markerX),
      y: round(markerY),
      xPct: round((markerShot / DESIGN_LIFE_SHOTS) * 100, 2),
      type: 'CURRENT',
      labelKey: null as string | null,
    },
    eventMarkers,
    gridLines: Array.from({ length: 11 }, (_, index) => {
      const shot = Math.round((index / 10) * DESIGN_LIFE_SHOTS);
      return {
        shot,
        xPct: round((index / 10) * 100, 2),
        label: null as string | null,
      };
    }),
    xAxisLabels: ['0', '250K', '500K', '750K', '1,000K'].map((label, index) => ({
      xPct: index * 25,
      label,
    })),
  };
}

function buildTelemetryPayload(
  moldId: string,
  moldNo: string | null,
  rows: MoldMaintenanceLogRow[],
) {
  const events = rows.map(toMaintenanceEvent);
  const now = new Date();

  const currentShots = events.length > 0 ? Math.max(...events.map((event) => event.currentShots), 0) : 0;
  const checkupEventCount = events.filter((event) => event.type === 'CHECKUP').length;
  const correctiveEvents = events.filter((event) => event.type === 'SICKNESS' || event.type === 'SURGERY');
  const correctiveEventCount = correctiveEvents.length;
  const sicknessCount = events.filter((event) => event.type === 'SICKNESS').length;
  const surgeryCount = events.filter((event) => event.type === 'SURGERY').length;
  const totalEventCount = events.length;

  const thirtyDayThreshold = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const thirtyDaySicknessCount = events.filter((event) => {
    if (event.type !== 'SICKNESS') return false;
    const occurredAtTs = new Date(event.occurredAt).getTime();
    return Number.isFinite(occurredAtTs) && occurredAtTs >= thirtyDayThreshold;
  }).length;

  const avgRecoveryRating =
    totalEventCount > 0
      ? round(events.reduce((sum, event) => sum + (Number.isFinite(event.recoveryRating) ? event.recoveryRating : 0), 0) / totalEventCount)
      : 0;
  const totalDowntimeHours = round(
    events.reduce((sum, event) => sum + (Number.isFinite(event.downtimeHours) ? event.downtimeHours : 0), 0),
    2,
  );
  const totalCost = round(
    events.reduce((sum, event) => sum + (Number.isFinite(event.cost) ? event.cost : 0), 0),
    2,
  );

  const betaPenalty = round(clamp(correctiveEventCount * 0.02, 0, 0.45), 4);
  const beta = round(Math.max(1.1, THEORETICAL_BETA + betaPenalty), 4);

  const etaPenaltyFactor = round(
    avgRecoveryRating > 0 ? clamp(avgRecoveryRating, 0.6, 1) : 1,
    4,
  );
  const eta = Math.max(1, Math.round(THEORETICAL_ETA * etaPenaltyFactor));

  const lifeRatio = clamp(currentShots / eta, 0, 2);
  const currentReliabilityRatio = Math.exp(-Math.pow(lifeRatio, beta));
  const currentReliability = round(clamp(currentReliabilityRatio * 100, 0, 100), 4);
  const hazardRate = round((beta / eta) * Math.pow(Math.max(lifeRatio, Number.EPSILON), beta - 1), 8);
  const wearOutThreshold = Math.round(eta * USEFUL_LIFE_END_RATIO);

  const nextPmShots = Math.max(
    PM_INTERVAL_SHOTS,
    Math.ceil(Math.max(currentShots, 1) / PM_INTERVAL_SHOTS) * PM_INTERVAL_SHOTS,
  );
  const pmDue = currentShots > 0 && currentShots % PM_INTERVAL_SHOTS === 0;
  const recommendedEol = currentShots >= wearOutThreshold;

  const sortedCorrectiveShots = correctiveEvents
    .map((event) => event.currentShots)
    .sort((left, right) => left - right);
  const intervals: number[] = [];
  for (let index = 1; index < sortedCorrectiveShots.length; index += 1) {
    const diff = sortedCorrectiveShots[index] - sortedCorrectiveShots[index - 1];
    if (diff > 0) intervals.push(diff);
  }
  const theoreticalMtbfShots = round(THEORETICAL_ETA / THEORETICAL_BETA, 2);
  const actualMtbfShots = round(
    intervals.length > 0
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : theoreticalMtbfShots,
    2,
  );
  const mtbfRatio = round(
    theoreticalMtbfShots > 0 ? clamp(actualMtbfShots / theoreticalMtbfShots, 0, 10) : 0,
    4,
  );

  const lifeConsumedPct = round(clamp((currentShots / DESIGN_LIFE_SHOTS) * 100, 0, 100), 2);
  const healthScore = round(clamp(currentReliability, 0, 100), 2);
  const nextPmDays = Math.max(0, Math.ceil((nextPmShots - currentShots) / SHOTS_PER_DAY));
  const nextPmDate = new Date(now.getTime() + nextPmDays * 24 * 60 * 60 * 1000).toISOString();
  const mtbfDays = round(actualMtbfShots / SHOTS_PER_DAY, 2);

  const latestEvent = [...events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  const metrics = {
    version: 1,
    moldId,
    moldNo: moldNo ?? 'NO. 1',
    currentShots,
    effectiveShots: currentShots,
    theoreticalBeta: THEORETICAL_BETA,
    beta,
    betaPenalty,
    theoreticalEta: THEORETICAL_ETA,
    eta,
    etaPenaltyFactor,
    currentReliability,
    hazardRate,
    wearOutThreshold,
    nextPmShots,
    pmIntervalShots: PM_INTERVAL_SHOTS,
    hazardThreshold: 0.00001,
    pmDue,
    recommendedEol,
    avgRecoveryRating,
    actualMtbfShots,
    theoreticalMtbfShots,
    mtbfRatio,
    thirtyDaySicknessCount,
    correctiveEventCount,
    checkupEventCount,
    totalEventCount,
    lastEventAt: latestEvent?.occurredAt ?? null,
    lastEventType: latestEvent?.type ?? null,
    moldStatus: recommendedEol ? 'WEAR_OUT' : 'ACTIVE',
    updatedAt: new Date().toISOString(),
    chart: buildChartData(currentShots, beta, eta, events),
  };

  return {
    telemetry: {
      asset: {
        moldId,
        moldNo: moldNo ?? 'NO. 1',
        projectId: moldId,
        designLife: DESIGN_LIFE_SHOTS,
        currentShots,
        totalRepairCount: correctiveEventCount,
      },
      stats: {
        healthScore,
        lifeConsumedPct,
        currentReliability,
        nextPmDate,
        nextPmDays,
        sicknessCount,
        surgeryCount,
        checkupCount: checkupEventCount,
        totalDowntimeHours,
        totalCost,
        mtbfDays,
        avgRecoveryRating,
      },
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt,
        currentShots: event.currentShots,
        symptom: event.symptom,
        diagnosis: event.diagnosis,
        procedure: event.procedure,
        downtimeHours: event.downtimeHours,
        recoveryRating: event.recoveryRating,
        cost: event.cost,
      })),
    },
    postResponse: {
      moldId,
      moldNo: moldNo ?? 'NO. 1',
      metrics,
      events,
    },
  };
}

async function listMoldMaintenanceRows(moldId: string): Promise<MoldMaintenanceLogRow[]> {
  if (!dbSql) return [];

  const rows = (await dbSql.unsafe(
    `
      SELECT
        id,
        mold_id,
        mold_no,
        type,
        repair_action,
        current_shots,
        symptom,
        diagnosis,
        procedure,
        operator,
        downtime_hours,
        recovery_rating,
        cost,
        image_url,
        estimated_completion,
        occurred_at,
        created_at,
        updated_at
      FROM mold_maintenance_logs
      WHERE mold_id = $1
      ORDER BY occurred_at DESC, current_shots DESC, created_at DESC
    `,
    [moldId],
  )) as MoldMaintenanceLogRow[];

  return rows;
}

export function ensureMoldMaintenanceTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!moldMaintenanceTableReady) {
    moldMaintenanceTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS mold_maintenance_logs (
          id VARCHAR(80) PRIMARY KEY,
          mold_id VARCHAR(80) NOT NULL,
          mold_no VARCHAR(80),
          type VARCHAR(20) NOT NULL,
          repair_action VARCHAR(100),
          current_shots BIGINT NOT NULL,
          symptom TEXT NOT NULL DEFAULT '',
          diagnosis TEXT NOT NULL DEFAULT '',
          procedure TEXT NOT NULL DEFAULT '',
          operator VARCHAR(255),
          downtime_hours NUMERIC(12,2) NOT NULL DEFAULT 0,
          recovery_rating NUMERIC(8,6) NOT NULL DEFAULT 0,
          cost NUMERIC(12,2) NOT NULL DEFAULT 0,
          image_url TEXT,
          estimated_completion TIMESTAMPTZ,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      // Legacy deployments may already have this table with partial or different columns.
      // Normalize schema in-place so new reliability endpoints can work without manual DBA steps.
      await dbSql.unsafe(`
        ALTER TABLE mold_maintenance_logs
          ADD COLUMN IF NOT EXISTS id VARCHAR(80),
          ADD COLUMN IF NOT EXISTS mold_id VARCHAR(80),
          ADD COLUMN IF NOT EXISTS mold_no VARCHAR(80),
          ADD COLUMN IF NOT EXISTS type VARCHAR(20),
          ADD COLUMN IF NOT EXISTS repair_action VARCHAR(100),
          ADD COLUMN IF NOT EXISTS current_shots BIGINT,
          ADD COLUMN IF NOT EXISTS symptom TEXT,
          ADD COLUMN IF NOT EXISTS diagnosis TEXT,
          ADD COLUMN IF NOT EXISTS procedure TEXT,
          ADD COLUMN IF NOT EXISTS operator VARCHAR(255),
          ADD COLUMN IF NOT EXISTS downtime_hours NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS recovery_rating NUMERIC(8,6),
          ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2),
          ADD COLUMN IF NOT EXISTS image_url TEXT,
          ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
      `);
      await dbSql.unsafe(`
        UPDATE mold_maintenance_logs
        SET
          mold_id = COALESCE(NULLIF(TRIM(CAST(mold_id AS TEXT)), ''), NULLIF(TRIM(CAST(mold_no AS TEXT)), ''), 'UNKNOWN'),
          symptom = COALESCE(symptom, ''),
          diagnosis = COALESCE(diagnosis, ''),
          procedure = COALESCE(procedure, ''),
          current_shots = COALESCE(current_shots, 0),
          downtime_hours = COALESCE(downtime_hours, 0),
          recovery_rating = COALESCE(recovery_rating, 0),
          cost = COALESCE(cost, 0),
          occurred_at = COALESCE(occurred_at, NOW()),
          created_at = COALESCE(created_at, NOW()),
          updated_at = COALESCE(updated_at, NOW())
        WHERE
          mold_id IS NULL
          OR TRIM(CAST(mold_id AS TEXT)) = ''
          OR symptom IS NULL
          OR diagnosis IS NULL
          OR procedure IS NULL
          OR current_shots IS NULL
          OR downtime_hours IS NULL
          OR recovery_rating IS NULL
          OR cost IS NULL
          OR occurred_at IS NULL
          OR created_at IS NULL
          OR updated_at IS NULL
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS mold_maintenance_logs_mold_id_idx
        ON mold_maintenance_logs (mold_id)
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS mold_maintenance_logs_mold_id_occurred_at_idx
        ON mold_maintenance_logs (mold_id, occurred_at DESC)
      `);
    })();
  }
  return moldMaintenanceTableReady;
}

export async function getMoldTelemetry(req: Request, res: Response): Promise<void> {
  const moldId = readTrimmedString(req.params.moldId, 80);
  if (!moldId) {
    sendMoldHealthRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  if (!dbSql) {
    sendMoldHealthRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureMoldMaintenanceTable();
    const rows = await listMoldMaintenanceRows(moldId);
    const moldNo = readTrimmedString(rows[0]?.mold_no, 80) ?? null;
    const payload = buildTelemetryPayload(moldId, moldNo, rows);
    res.status(200).json(payload.telemetry);
  } catch (error) {
    console.error('GET /api/mold/:moldId/telemetry error:', error);
    sendMoldHealthRouteError(res, 500, 'MOLD_TELEMETRY_LOAD_FAILED');
  }
}

export async function createMoldMaintenanceLog(req: Request, res: Response): Promise<void> {
  const moldId = readTrimmedString(req.params.moldId, 80);
  if (!moldId) {
    sendMoldHealthRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  if (!dbSql) {
    sendMoldHealthRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const payload = normalizeMaintenanceCreatePayload(req.body);
  if (!payload) {
    sendMoldHealthRouteError(res, 400, 'INVALID_MAINTENANCE_PAYLOAD');
    return;
  }

  try {
    await ensureMoldMaintenanceTable();

    const nowIso = new Date().toISOString();
    await dbSql.unsafe(
      `
        INSERT INTO mold_maintenance_logs (
          id,
          mold_id,
          mold_no,
          type,
          repair_action,
          current_shots,
          symptom,
          diagnosis,
          procedure,
          operator,
          downtime_hours,
          recovery_rating,
          cost,
          image_url,
          estimated_completion,
          occurred_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
      `,
      [
        randomUUID(),
        moldId,
        payload.moldNo,
        payload.type,
        payload.repairAction,
        payload.currentShots,
        payload.symptom,
        payload.diagnosis,
        payload.procedure,
        payload.operator,
        payload.downtimeHours,
        payload.recoveryRating,
        payload.cost,
        payload.imageUrl,
        payload.estimatedCompletion,
        nowIso,
        nowIso,
        nowIso,
      ],
    );

    const rows = await listMoldMaintenanceRows(moldId);
    const moldNo = payload.moldNo ?? readTrimmedString(rows[0]?.mold_no, 80) ?? 'NO. 1';
    const responsePayload = buildTelemetryPayload(moldId, moldNo, rows);
    res.status(201).json(responsePayload.postResponse);
  } catch (error) {
    console.error('POST /api/mold/:moldId/maintenance-logs error:', error);
    sendMoldHealthRouteError(res, 500, 'MOLD_MAINTENANCE_CREATE_FAILED');
  }
}

export async function deleteMoldMaintenanceLog(req: Request, res: Response): Promise<void> {
  const moldId = readTrimmedString(req.params.moldId, 80);
  if (!moldId) {
    sendMoldHealthRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const eventId = readTrimmedString(req.params.eventId, 80);
  if (!eventId) {
    sendMoldHealthRouteError(res, 400, 'MOLD_MAINTENANCE_EVENT_ID_REQUIRED');
    return;
  }

  if (!dbSql) {
    sendMoldHealthRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureMoldMaintenanceTable();

    const deletedRows = (await dbSql.unsafe(
      `
        DELETE FROM mold_maintenance_logs
        WHERE mold_id = $1 AND id = $2
        RETURNING id
      `,
      [moldId, eventId],
    )) as Array<{ id: string }>;

    if (deletedRows.length === 0) {
      sendMoldHealthRouteError(res, 404, 'MOLD_MAINTENANCE_EVENT_NOT_FOUND');
      return;
    }

    res.status(200).json({ success: true, id: eventId });
  } catch (error) {
    console.error('DELETE /api/mold/:moldId/maintenance-logs/:eventId error:', error);
    sendMoldHealthRouteError(res, 500, 'MOLD_MAINTENANCE_DELETE_FAILED');
  }
}
