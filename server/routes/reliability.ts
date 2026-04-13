import type { Request, Response } from 'express';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { sql as dbSql } from '../db.js';
import { buildMoldTelemetry } from '../lib/telemetry.js';
import {
  buildReliabilityState,
  computeActionRecoveryRating,
  computePmRecoveryRating,
  createProjectSeed,
  normalizeIsoTimestamp,
  reliabilityEventPayloadSchema,
  reliabilityWorkOrderPayloadSchema,
  type MoldRepairAction,
  type ReliabilityEventPayload,
  type ReliabilityEventRecord,
  type ReliabilityProjectSeed,
  type ReliabilityState,
  type ReliabilityWorkOrderPayload,
} from '../lib/reliability-engine.js';

type ReliabilityRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'CURRENT_SHOTS_REGRESSION'
  | 'INVALID_REPAIR_ACTION_FOR_EVENT_TYPE'
  | 'INVALID_EVENT_PAYLOAD'
  | 'INVALID_WORK_ORDER_PAYLOAD'
  | 'INTERNAL_ERROR'
  | 'MOLD_ID_REQUIRED'
  | 'MOLD_LOG_DELETE_FAILED'
  | 'MOLD_LOG_ID_REQUIRED'
  | 'MOLD_LOG_NOT_FOUND'
  | 'STATE_LOAD_FAILED'
  | 'TELEMETRY_LOAD_FAILED'
  | 'WORK_ORDER_FAILED';

type ProjectSeedRow = {
  projectId: string | null;
  moldId: string | null;
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

type DashboardProjectCountRow = {
  total: string;
};

type DeletedMaintenanceLogRow = {
  id: string;
};

type ReliabilityValidationErrorCode = Extract<
  ReliabilityRouteErrorCode,
  'CURRENT_SHOTS_REGRESSION' | 'INVALID_REPAIR_ACTION_FOR_EVENT_TYPE'
>;

const RELIABILITY_ROUTE_ERROR_MESSAGES: Record<ReliabilityRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'database not configured',
  CURRENT_SHOTS_REGRESSION: 'current shots cannot decrease',
  INVALID_REPAIR_ACTION_FOR_EVENT_TYPE: 'invalid repair action for event type',
  INVALID_EVENT_PAYLOAD: 'invalid reliability event payload',
  INVALID_WORK_ORDER_PAYLOAD: 'invalid work order payload',
  INTERNAL_ERROR: 'internal server error',
  MOLD_ID_REQUIRED: 'moldId required',
  MOLD_LOG_DELETE_FAILED: 'failed to delete mold maintenance log',
  MOLD_LOG_ID_REQUIRED: 'maintenance log id required',
  MOLD_LOG_NOT_FOUND: 'maintenance log not found',
  STATE_LOAD_FAILED: 'failed to load reliability state',
  TELEMETRY_LOAD_FAILED: 'failed to load mold telemetry',
  WORK_ORDER_FAILED: 'failed to generate work order',
};

let reliabilityTablesReady: Promise<void> | null = null;
type QueryableSql = Pick<Sql<{}>, 'unsafe'>;

class ReliabilityRouteValidationError extends Error {
  readonly code: ReliabilityValidationErrorCode;
  readonly details?: unknown;

  constructor(code: ReliabilityValidationErrorCode, details?: unknown) {
    super(code);
    this.code = code;
    this.details = details;
    this.name = 'ReliabilityRouteValidationError';
  }
}

function sendReliabilityRouteError(
  res: Response,
  status: number,
  code: ReliabilityRouteErrorCode,
  details?: unknown,
): void {
  res.status(status).json({
    error: RELIABILITY_ROUTE_ERROR_MESSAGES[code],
    code,
    details,
  });
}

function readTrimmedString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
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
    currentShots: Number.isFinite(row.currentShots) ? row.currentShots : 0,
    recoveryRating: Number.isFinite(row.recoveryRating) ? row.recoveryRating : 0,
    downtimeHours: Number.isFinite(row.downtimeHours) ? row.downtimeHours : 0,
    cost: Number.isFinite(row.cost) ? row.cost : 0,
    imageUrl: row.imageUrl,
    estimatedCompletion: row.estimatedCompletion,
    createdAt: normalizeIsoTimestamp(row.createdAt),
  }));
}

function parseEventPayload(body: unknown): ReliabilityEventPayload {
  return reliabilityEventPayloadSchema.parse(body);
}

function parseWorkOrderPayload(body: unknown): ReliabilityWorkOrderPayload {
  return reliabilityWorkOrderPayloadSchema.parse(body);
}

export function ensureReliabilityTables(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!reliabilityTablesReady) {
    reliabilityTablesReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS mold_maintenance_logs (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL,
          mold_no VARCHAR(64),
          event_type VARCHAR(32) NOT NULL,
          symptom TEXT NOT NULL,
          diagnosis VARCHAR(255) NOT NULL,
          procedure TEXT NOT NULL,
          operator VARCHAR(255),
          repair_action VARCHAR(64),
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          current_shots INTEGER NOT NULL DEFAULT 0,
          recovery_rating REAL NOT NULL,
          downtime_hours REAL NOT NULL DEFAULT 0,
          cost REAL NOT NULL DEFAULT 0,
          image_url VARCHAR(2048),
          estimated_completion VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS mold_maintenance_logs_mold_idx
        ON mold_maintenance_logs (mold_number, occurred_at DESC, id DESC)
      `);
      await dbSql.unsafe(`
        ALTER TABLE mold_maintenance_logs
        ADD COLUMN IF NOT EXISTS repair_action VARCHAR(64)
      `);
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS reliability_work_orders (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL,
          mold_no VARCHAR(64),
          work_order_type VARCHAR(64) NOT NULL,
          status VARCHAR(64) NOT NULL DEFAULT 'OPEN',
          reason TEXT,
          requested_by VARCHAR(255),
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS reliability_work_orders_mold_idx
        ON reliability_work_orders (mold_number, created_at DESC, id DESC)
      `);
      await dbSql.unsafe(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS reliability_metrics JSONB DEFAULT '{}'::jsonb
      `);
      await dbSql.unsafe(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS mold_status VARCHAR(64) DEFAULT 'ACTIVE'
      `);
    })();
  }
  return reliabilityTablesReady;
}

async function readProjectSeed(sqlClient: QueryableSql, moldId: string): Promise<ReliabilityProjectSeed> {
  const rows = await sqlClient.unsafe<ProjectSeedRow[]>(
    `
      SELECT
        id AS "projectId",
        COALESCE(NULLIF(TRIM(mold_number), ''), id) AS "moldId",
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

async function writeProjectReliabilityState(
  sqlClient: QueryableSql,
  state: ReliabilityState,
  projectId?: string | null,
): Promise<void> {
  const payload = JSON.stringify(state.metrics);
  const updatedRows = await sqlClient.unsafe<{ projectId: string }[]>(
    `
      UPDATE projects
      SET
        reliability_metrics = $2::jsonb,
        mold_status = $3,
        updated_at = NOW()
      WHERE id = $1 OR mold_number = $1
      RETURNING id::text AS "projectId"
    `,
    [state.moldId, payload, state.metrics.moldStatus],
  );

  if (updatedRows.length > 0) {
    return;
  }

  const fallbackProjectId = (projectId || state.moldId).trim() || state.moldId;
  await sqlClient.unsafe(
    `
      INSERT INTO projects (
        id,
        mold_number,
        reliability_metrics,
        mold_status,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3::jsonb, $4, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        mold_number = EXCLUDED.mold_number,
        reliability_metrics = EXCLUDED.reliability_metrics,
        mold_status = EXCLUDED.mold_status,
        updated_at = NOW()
    `,
    [fallbackProjectId, state.moldId, payload, state.metrics.moldStatus],
  );
}

async function loadReliabilityState(sqlClient: QueryableSql, moldId: string, moldNo?: string): Promise<ReliabilityState> {
  const seed = await readProjectSeed(sqlClient, moldId);
  const events = await readMaintenanceLogs(sqlClient, moldId);
  return buildReliabilityState({
    moldId,
    moldNo,
    seed,
    events,
  });
}

function readRequestedMoldId(req: Request): string {
  return readTrimmedString(req.params.moldId || req.params.projectId || req.query.moldId || req.query.moldNumber);
}

function readRequestedMaintenanceLogId(req: Request): string {
  return readTrimmedString(req.params.id || req.params.logId || req.query.id || req.query.logId);
}

export async function getReliabilityState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldId = readRequestedMoldId(req);
  if (!moldId) {
    sendReliabilityRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureReliabilityTables();
    const state = await loadReliabilityState(dbSql, moldId, readTrimmedString(req.query.moldNo));
    res.json(state);
  } catch (error) {
    console.error('GET /api/reliability/state/:moldId error:', error);
    sendReliabilityRouteError(res, 500, 'STATE_LOAD_FAILED');
  }
}

export async function getMoldTelemetry(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldId = readRequestedMoldId(req);
  if (!moldId) {
    sendReliabilityRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureReliabilityTables();
    const payload = await buildMoldTelemetry(dbSql, moldId);
    res.json(payload);
  } catch (error) {
    console.error('GET /api/mold/:moldId/telemetry error:', error);
    sendReliabilityRouteError(res, 500, 'TELEMETRY_LOAD_FAILED');
  }
}

async function persistReliabilityEvent(payload: ReliabilityEventPayload): Promise<ReliabilityState> {
  await ensureReliabilityTables();
  return dbSql!.begin(async (tx) => {
    const allowedActionsByType: Record<ReliabilityEventPayload['type'], readonly MoldRepairAction[]> = {
      SICKNESS: ['WEAR_PART_CLEAN_POLISH'],
      SURGERY: ['INSERT_REPLACEMENT_LOCAL_REFIT', 'WELDING_MAJOR_MACHINING'],
      CHECKUP: ['WEAR_PART_CLEAN_POLISH'],
    };

    if (
      payload.repairAction &&
      !allowedActionsByType[payload.type].includes(payload.repairAction)
    ) {
      throw new ReliabilityRouteValidationError('INVALID_REPAIR_ACTION_FOR_EVENT_TYPE', {
        type: payload.type,
        repairAction: payload.repairAction,
      });
    }

    const seedBeforeInsert = await readProjectSeed(tx, payload.moldId);
    const eventsBeforeInsert = await readMaintenanceLogs(tx, payload.moldId);
    const eventShots = payload.shotsAtEvent ?? payload.currentShots;
    const currentShots = typeof eventShots === 'number' ? eventShots : undefined;
    const occurredAt = normalizeIsoTimestamp(payload.occurredAt);

    const stateBeforeInsert = buildReliabilityState({
      moldId: payload.moldId,
      moldNo: payload.moldNo,
      seed: seedBeforeInsert,
      events: eventsBeforeInsert,
      currentShotsOverride: currentShots,
    });

    const resolvedCurrentShots = currentShots ?? stateBeforeInsert.metrics.currentShots;
    const appliedRecoveryRating = payload.repairAction
      ? computeActionRecoveryRating(
          resolvedCurrentShots,
          stateBeforeInsert.metrics.eta,
          payload.repairAction,
        )
      : payload.type === 'CHECKUP'
        ? computePmRecoveryRating(
            resolvedCurrentShots,
            stateBeforeInsert.metrics.eta,
          )
        : payload.recoveryRating;

    await tx.unsafe(
      `
        INSERT INTO mold_maintenance_logs (
          mold_number,
          mold_no,
          event_type,
          symptom,
          diagnosis,
          procedure,
          operator,
          repair_action,
          occurred_at,
          current_shots,
          recovery_rating,
          downtime_hours,
          cost,
          image_url,
          estimated_completion
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
      `,
      [
        payload.moldId,
        payload.moldNo || null,
        payload.type,
        payload.symptom,
        payload.diagnosis,
        payload.procedure,
        payload.operator || null,
        payload.repairAction || null,
        occurredAt,
        resolvedCurrentShots,
        appliedRecoveryRating,
        payload.downtimeHours ?? 0,
        payload.cost ?? 0,
        payload.imageUrl || null,
        payload.estimatedCompletion || null,
      ],
    );

    const seed = await readProjectSeed(tx, payload.moldId);
    const events = await readMaintenanceLogs(tx, payload.moldId);
    const state = buildReliabilityState({
      moldId: payload.moldId,
      moldNo: payload.moldNo,
      seed,
      events,
      currentShotsOverride: currentShots,
    });
    await writeProjectReliabilityState(tx, state, seed.projectId);
    return state;
  });
}

export async function postReliabilityEvent(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  let payload: ReliabilityEventPayload;
  try {
    payload = parseEventPayload(req.body);
  } catch (error) {
    const formatted = error instanceof z.ZodError ? error.flatten() : undefined;
    sendReliabilityRouteError(res, 400, 'INVALID_EVENT_PAYLOAD', formatted);
    return;
  }

  try {
    const nextState = await persistReliabilityEvent(payload);
    res.status(201).json(nextState);
  } catch (error) {
    if (error instanceof ReliabilityRouteValidationError) {
      sendReliabilityRouteError(res, 400, error.code, error.details);
      return;
    }
    console.error('POST /api/reliability/event error:', error);
    sendReliabilityRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

export async function postMoldMaintenanceLog(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldId = readRequestedMoldId(req);
  if (!moldId) {
    sendReliabilityRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  let payload: ReliabilityEventPayload;
  try {
    const bodyRecord = typeof req.body === 'object' && req.body !== null ? req.body : {};
    payload = parseEventPayload({
      ...bodyRecord,
      moldId,
      moldNo: readTrimmedString((bodyRecord as { moldNo?: unknown }).moldNo) || undefined,
    });
  } catch (error) {
    const formatted = error instanceof z.ZodError ? error.flatten() : undefined;
    sendReliabilityRouteError(res, 400, 'INVALID_EVENT_PAYLOAD', formatted);
    return;
  }

  try {
    const nextState = await persistReliabilityEvent(payload);
    res.status(201).json(nextState);
  } catch (error) {
    if (error instanceof ReliabilityRouteValidationError) {
      sendReliabilityRouteError(res, 400, error.code, error.details);
      return;
    }
    console.error('POST /api/mold/:moldId/maintenance-logs error:', error);
    sendReliabilityRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

export async function deleteMoldMaintenanceLog(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldId = readRequestedMoldId(req);
  if (!moldId) {
    sendReliabilityRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const logId = readRequestedMaintenanceLogId(req);
  if (!logId) {
    sendReliabilityRouteError(res, 400, 'MOLD_LOG_ID_REQUIRED');
    return;
  }

  try {
    await ensureReliabilityTables();
    const result = await dbSql.begin(async (tx) => {
      const deletedRows = await tx.unsafe<DeletedMaintenanceLogRow[]>(
        `
          DELETE FROM mold_maintenance_logs
          WHERE mold_number = $1
            AND id::text = $2
          RETURNING id::text AS id
        `,
        [moldId, logId],
      );

      if (deletedRows.length === 0) {
        return null;
      }

      const seed = await readProjectSeed(tx, moldId);
      const events = await readMaintenanceLogs(tx, moldId);
      const remainingCurrentShots = events.reduce((maxShots, eventRecord) => Math.max(maxShots, eventRecord.currentShots), 0);

      const recalibratedSeed = seed.metrics
        ? {
            ...seed,
            metrics: {
              ...seed.metrics,
              currentShots: remainingCurrentShots,
            },
          }
        : seed;

      const nextState = buildReliabilityState({
        moldId,
        seed: recalibratedSeed,
        events,
      });

      await writeProjectReliabilityState(tx, nextState, seed.projectId);
      return nextState;
    });

    if (!result) {
      sendReliabilityRouteError(res, 404, 'MOLD_LOG_NOT_FOUND');
      return;
    }

    res.status(200).json({
      success: true,
      id: logId,
      moldId: result.moldId,
      moldNo: result.moldNo,
    });
  } catch (error) {
    console.error('DELETE /api/mold/:moldId/maintenance-logs/:id error:', error);
    sendReliabilityRouteError(res, 500, 'MOLD_LOG_DELETE_FAILED');
  }
}

export async function generateReliabilityWorkOrder(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  let payload: ReliabilityWorkOrderPayload;
  try {
    payload = parseWorkOrderPayload(req.body);
  } catch (error) {
    const formatted = error instanceof z.ZodError ? error.flatten() : undefined;
    sendReliabilityRouteError(res, 400, 'INVALID_WORK_ORDER_PAYLOAD', formatted);
    return;
  }

  try {
    await ensureReliabilityTables();
    const result = await dbSql.begin(async (tx) => {
      const seed = await readProjectSeed(tx, payload.moldId);
      const events = await readMaintenanceLogs(tx, payload.moldId);
      const state = buildReliabilityState({
        moldId: payload.moldId,
        moldNo: payload.moldNo,
        seed,
        events,
      });

      const reason = payload.reason
        || `avgRecovery=${state.metrics.avgRecoveryRating.toFixed(2)}, mtbfRatio=${state.metrics.mtbfRatio.toFixed(2)}, beta=${state.metrics.beta.toFixed(2)}`;

      await tx.unsafe(
        `
          INSERT INTO reliability_work_orders (
            mold_number,
            mold_no,
            work_order_type,
            status,
            reason,
            requested_by,
            payload
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7::jsonb
          )
        `,
        [
          payload.moldId,
          payload.moldNo || state.moldNo,
          'EOL_OVERHAUL',
          'OPEN',
          reason,
          payload.requestedBy || null,
          JSON.stringify({
            recommendedEol: state.metrics.recommendedEol,
            avgRecoveryRating: state.metrics.avgRecoveryRating,
            mtbfRatio: state.metrics.mtbfRatio,
            beta: state.metrics.beta,
          }),
        ],
      );

      const underOverhaulState: ReliabilityState = {
        ...state,
        metrics: {
          ...state.metrics,
          moldStatus: 'UNDER_OVERHAUL',
          updatedAt: new Date().toISOString(),
        },
      };
      await writeProjectReliabilityState(tx, underOverhaulState, seed.projectId);
      return underOverhaulState;
    });

    res.status(201).json({
      success: true,
      moldId: payload.moldId,
      moldNo: payload.moldNo || result.moldNo,
      moldStatus: result.metrics.moldStatus,
      metrics: result.metrics,
    });
  } catch (error) {
    console.error('POST /api/reliability/work-order error:', error);
    sendReliabilityRouteError(res, 500, 'WORK_ORDER_FAILED');
  }
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReliabilityRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureReliabilityTables();
    const moldIdFromQuery = readRequestedMoldId(req);
    let moldId = moldIdFromQuery;

    if (!moldId) {
      const firstRows = await dbSql<{ moldId: string | null }[]>`
        SELECT mold_id AS "moldId"
        FROM dashboard_projects
        WHERE mold_id IS NOT NULL AND TRIM(mold_id) <> ''
        ORDER BY id ASC
        LIMIT 1
      `;
      moldId = readTrimmedString(firstRows[0]?.moldId);
    }

    const countRows = await dbSql<DashboardProjectCountRow[]>`
      SELECT COUNT(*)::text AS total
      FROM dashboard_projects
    `;
    const totalProjects = Number.parseInt(countRows[0]?.total || '0', 10) || 0;

    if (!moldId) {
      res.json({
        totalProjects,
        reliability: null,
      });
      return;
    }

    const state = await loadReliabilityState(dbSql, moldId, readTrimmedString(req.query.moldNo));
    res.json({
      totalProjects,
      reliability: state.metrics,
      moldId: state.moldId,
      moldNo: state.moldNo,
      lastEvent: state.events[0] ?? null,
    });
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error);
    sendReliabilityRouteError(res, 500, 'INTERNAL_ERROR');
  }
}
