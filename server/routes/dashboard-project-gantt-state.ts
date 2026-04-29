import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type GanttTaskStatus = 'pending' | 'in-progress' | 'completed' | 'delayed';
type GanttRole = 'ADMIN' | 'USER';

type GanttTaskNode = {
  id: string;
  parentId: string | null;
  name: string;
  startDate: string;
  endDate: string;
  baseStartDate: string;
  baseEndDate: string;
  status: GanttTaskStatus;
  dependencies: string[];
  children: GanttTaskNode[];
  isExpanded?: boolean;
  reason?: string;
  assignee?: string;
  tag?: string;
  progress?: number;
  iterationPhase?: string;
};

type GanttComponentGroup = {
  id: string;
  name: string;
  tasks: GanttTaskNode[];
  isExpanded?: boolean;
};

type GanttMilestone = {
  id: string;
  name: string;
  date: string;
  type: 'commercial' | 'technical';
};

type GanttBoardState = {
  components: GanttComponentGroup[];
  milestones: GanttMilestone[];
  role: GanttRole;
};

type GanttBoardTab = {
  id: string;
  title: string;
  serial: number;
};

type DashboardProjectGanttStateRow = {
  workspace_key: string;
  boards: unknown;
  active_board_id: string;
  board_state_by_id: unknown;
  updated_at: string;
};

type DashboardProjectGanttRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'PROJECT_GANTT_STATE_DELETE_FAILED'
  | 'PROJECT_GANTT_STATE_LOAD_FAILED'
  | 'PROJECT_GANTT_STATE_SAVE_FAILED';

const DASHBOARD_PROJECT_GANTT_ROUTE_ERROR_MESSAGES: Record<
  DashboardProjectGanttRouteErrorCode,
  string
> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  PROJECT_GANTT_STATE_DELETE_FAILED: 'Failed to delete dashboard project gantt state',
  PROJECT_GANTT_STATE_LOAD_FAILED: 'Failed to load dashboard project gantt state',
  PROJECT_GANTT_STATE_SAVE_FAILED: 'Failed to save dashboard project gantt state',
};

const DASHBOARD_PROJECT_GANTT_STATE_TABLE = 'dashboard_project_gantt_states_v1';
const DEFAULT_WORKSPACE_KEY = 'dashboard-project-gantt-workspace';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TASK_STATUS_SET = new Set<GanttTaskStatus>(['pending', 'in-progress', 'completed', 'delayed']);

let dashboardProjectGanttTableReady: Promise<void> | null = null;

function applyNoStoreHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendDashboardProjectGanttRouteError(
  res: Response,
  status: number,
  code: DashboardProjectGanttRouteErrorCode,
): void {
  res.status(status).json({
    error: DASHBOARD_PROJECT_GANTT_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  const text = normalizeText(value, maxLength);
  return text || undefined;
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  const text = normalizeText(value, 10, fallback);
  return ISO_DATE_PATTERN.test(text) ? text : fallback;
}

function normalizeRole(value: unknown): GanttRole {
  return value === 'USER' ? 'USER' : 'ADMIN';
}

function normalizeTaskStatus(value: unknown): GanttTaskStatus {
  const status = normalizeText(value, 20, 'pending') as GanttTaskStatus;
  return TASK_STATUS_SET.has(status) ? status : 'pending';
}

function sanitizeDependencies(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((dependencyId) => normalizeText(dependencyId, 120))
        .filter((dependencyId): dependencyId is string => Boolean(dependencyId)),
    ),
  );
}

function sanitizeTaskNode(
  value: unknown,
  fallbackId: string,
  forcedParentId: string | null,
): GanttTaskNode | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const taskId = normalizeText(record.id, 120, fallbackId);
  const startDate = normalizeIsoDate(record.startDate, normalizeIsoDate(record.baseStartDate, '1970-01-01'));
  const endDate = normalizeIsoDate(record.endDate, normalizeIsoDate(record.baseEndDate, startDate));
  const baseStartDate = normalizeIsoDate(record.baseStartDate, startDate);
  const baseEndDate = normalizeIsoDate(record.baseEndDate, endDate);
  const children = Array.isArray(record.children)
    ? record.children
        .map((child, index) => sanitizeTaskNode(child, `${taskId}__child_${index + 1}`, taskId))
        .filter((child): child is GanttTaskNode => child !== null)
    : [];

  const rawProgress = Number(record.progress);
  const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, Math.round(rawProgress))) : undefined;

  return {
    id: taskId,
    parentId: forcedParentId,
    name: normalizeText(record.name, 255, 'Untitled Task'),
    startDate,
    endDate: endDate >= startDate ? endDate : startDate,
    baseStartDate,
    baseEndDate: baseEndDate >= baseStartDate ? baseEndDate : baseStartDate,
    status: normalizeTaskStatus(record.status),
    dependencies: sanitizeDependencies(record.dependencies),
    children,
    isExpanded: typeof record.isExpanded === 'boolean' ? record.isExpanded : true,
    reason: normalizeOptionalText(record.reason, 4000),
    assignee: normalizeOptionalText(record.assignee, 255),
    tag: normalizeOptionalText(record.tag, 4000),
    progress,
    iterationPhase: normalizeOptionalText(record.iterationPhase, 50),
  };
}

function sanitizeTaskList(value: unknown): GanttTaskNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((task, index) => sanitizeTaskNode(task, `task_${index + 1}`, null))
    .filter((task): task is GanttTaskNode => task !== null);
}

function sanitizeComponents(value: unknown): GanttComponentGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((acc, component, index) => {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      return acc;
    }

    const record = component as Record<string, unknown>;
    acc.push({
      id: normalizeText(record.id, 120, `component_${index + 1}`),
      name: normalizeText(record.name, 255, `Component ${index + 1}`),
      tasks: sanitizeTaskList(record.tasks),
      isExpanded: typeof record.isExpanded === 'boolean' ? record.isExpanded : true,
    });
    return acc;
  }, [] as GanttComponentGroup[]);
}

function sanitizeMilestones(value: unknown): GanttMilestone[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((milestone, index) => {
      if (!milestone || typeof milestone !== 'object' || Array.isArray(milestone)) {
        return null;
      }

      const record = milestone as Record<string, unknown>;
      const date = normalizeIsoDate(record.date, '');
      if (!date) {
        return null;
      }

      const type = record.type === 'technical' ? 'technical' : 'commercial';
      return {
        id: normalizeText(record.id, 120, `milestone_${index + 1}`),
        name: normalizeText(record.name, 255, `Milestone ${index + 1}`),
        date,
        type,
      } satisfies GanttMilestone;
    })
    .filter((milestone): milestone is GanttMilestone => milestone !== null);
}

function sanitizeBoardState(value: unknown): GanttBoardState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    components: sanitizeComponents(record.components),
    milestones: sanitizeMilestones(record.milestones),
    role: normalizeRole(record.role),
  };
}

function sanitizeBoards(value: unknown): GanttBoardTab[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((board, index) => {
      if (!board || typeof board !== 'object' || Array.isArray(board)) {
        return null;
      }

      const record = board as Record<string, unknown>;
      const serial = Number(record.serial);
      return {
        id: normalizeText(record.id, 120, `board_${index + 1}`),
        title: normalizeText(record.title, 80, `项目${index + 1}甘特图`),
        serial: Number.isFinite(serial) && serial > 0 ? Math.floor(serial) : index + 1,
      } satisfies GanttBoardTab;
    })
    .filter((board): board is GanttBoardTab => board !== null);
}

function sanitizeBoardStateById(
  value: unknown,
  boards: GanttBoardTab[],
): Record<string, GanttBoardState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const allowedBoardIds = new Set(boards.map((board) => board.id));

  return Object.entries(value as Record<string, unknown>).reduce((acc, [boardId, boardState]) => {
    const normalizedBoardId = normalizeText(boardId, 120);
    if (!normalizedBoardId || !allowedBoardIds.has(normalizedBoardId)) {
      return acc;
    }

    const sanitizedBoardState = sanitizeBoardState(boardState);
    if (!sanitizedBoardState) {
      return acc;
    }

    acc[normalizedBoardId] = sanitizedBoardState;
    return acc;
  }, {} as Record<string, GanttBoardState>);
}

function readWorkspaceKey(source: Request['query'] | Record<string, unknown>): string {
  return normalizeText(source.workspaceKey, 120, DEFAULT_WORKSPACE_KEY);
}

export function ensureDashboardProjectGanttStateTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!dashboardProjectGanttTableReady) {
    dashboardProjectGanttTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${DASHBOARD_PROJECT_GANTT_STATE_TABLE} (
          workspace_key VARCHAR(120) PRIMARY KEY,
          boards JSONB NOT NULL DEFAULT '[]'::jsonb,
          active_board_id VARCHAR(120) NOT NULL DEFAULT '',
          board_state_by_id JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }

  return dashboardProjectGanttTableReady;
}

export async function getDashboardProjectGanttState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  if (!dbSql) {
    sendDashboardProjectGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const workspaceKey = readWorkspaceKey(req.query);

  try {
    await ensureDashboardProjectGanttStateTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT workspace_key, boards, active_board_id, board_state_by_id, updated_at
        FROM ${DASHBOARD_PROJECT_GANTT_STATE_TABLE}
        WHERE workspace_key = $1
        LIMIT 1
      `,
      [workspaceKey],
    )) as DashboardProjectGanttStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    const boards = sanitizeBoards(row.boards);
    if (boards.length === 0) {
      res.status(200).json({ state: null });
      return;
    }

    const boardStateById = sanitizeBoardStateById(row.board_state_by_id, boards);
    const activeBoardId = boards.some((board) => board.id === row.active_board_id)
      ? row.active_board_id
      : boards[0].id;

    res.status(200).json({
      state: {
        workspaceKey: row.workspace_key,
        boards,
        activeBoardId,
        boardStateById,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/project-gantt-state error:', error);
    sendDashboardProjectGanttRouteError(res, 500, 'PROJECT_GANTT_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardProjectGanttState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardProjectGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const workspaceKey = readWorkspaceKey(body);
  const boards = sanitizeBoards(body.boards);

  try {
    await ensureDashboardProjectGanttStateTable();

    if (boards.length === 0) {
      await dbSql.unsafe(
        `DELETE FROM ${DASHBOARD_PROJECT_GANTT_STATE_TABLE} WHERE workspace_key = $1`,
        [workspaceKey],
      );
      res.status(200).json({ success: true });
      return;
    }

    const activeBoardId = boards.some((board) => board.id === body.activeBoardId)
      ? String(body.activeBoardId)
      : boards[0].id;
    const boardStateById = sanitizeBoardStateById(body.boardStateById, boards);

    await dbSql.unsafe(
      `
        INSERT INTO ${DASHBOARD_PROJECT_GANTT_STATE_TABLE} (
          workspace_key,
          boards,
          active_board_id,
          board_state_by_id,
          created_at,
          updated_at
        ) VALUES ($1, $2::jsonb, $3, $4::jsonb, NOW(), NOW())
        ON CONFLICT (workspace_key)
        DO UPDATE SET
          boards = EXCLUDED.boards,
          active_board_id = EXCLUDED.active_board_id,
          board_state_by_id = EXCLUDED.board_state_by_id,
          updated_at = NOW()
      `,
      [
        workspaceKey,
        JSON.stringify(boards),
        activeBoardId,
        JSON.stringify(boardStateById),
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/project-gantt-state error:', error);
    sendDashboardProjectGanttRouteError(res, 500, 'PROJECT_GANTT_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardProjectGanttState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardProjectGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const workspaceKey = readWorkspaceKey(req.query);

  try {
    await ensureDashboardProjectGanttStateTable();
    await dbSql.unsafe(
      `DELETE FROM ${DASHBOARD_PROJECT_GANTT_STATE_TABLE} WHERE workspace_key = $1`,
      [workspaceKey],
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/project-gantt-state error:', error);
    sendDashboardProjectGanttRouteError(res, 500, 'PROJECT_GANTT_STATE_DELETE_FAILED');
  }
}
