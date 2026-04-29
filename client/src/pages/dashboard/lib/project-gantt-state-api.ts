import { apiFetch } from '@/lib/api';
import type { ComponentGroup, Milestone, Role, TaskNode, TaskStatus } from '@/lib/gantt/types';
import { normalizeDashboardApiError } from './dashboardApi';

export type DashboardProjectGanttBoardTab = {
  id: string;
  title: string;
  serial: number;
};

export type DashboardProjectGanttBoardState = {
  components: ComponentGroup[];
  milestones: Milestone[];
  role: Role;
};

export type DashboardProjectGanttRemoteState = {
  workspaceKey: string;
  boards: DashboardProjectGanttBoardTab[];
  activeBoardId: string;
  boardStateById: Record<string, DashboardProjectGanttBoardState>;
  updatedAt?: string;
};

type DashboardProjectGanttIdentity = {
  workspaceKey?: string;
};

const DEFAULT_WORKSPACE_KEY = 'dashboard-project-gantt-workspace';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TASK_STATUS_SET = new Set<TaskStatus>(['pending', 'in-progress', 'completed', 'delayed']);

function buildProjectGanttStateUrl({ workspaceKey = DEFAULT_WORKSPACE_KEY }: DashboardProjectGanttIdentity): string {
  const params = new URLSearchParams({ workspaceKey });
  return `/api/dashboard/project-gantt-state?${params.toString()}`;
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  const text = normalizeText(value, fallback);
  return ISO_DATE_PATTERN.test(text) ? text : fallback;
}

function sanitizeDependencies(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((dependencyId) => normalizeText(dependencyId))
        .filter((dependencyId): dependencyId is string => Boolean(dependencyId)),
    ),
  );
}

function sanitizeTaskStatus(value: unknown): TaskStatus {
  const status = normalizeText(value, 'pending') as TaskStatus;
  return TASK_STATUS_SET.has(status) ? status : 'pending';
}

function sanitizeTaskNode(value: unknown, fallbackId: string, parentId: string | null): TaskNode | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id, fallbackId);
  const startDate = normalizeIsoDate(record.startDate, normalizeIsoDate(record.baseStartDate, '1970-01-01'));
  const endDate = normalizeIsoDate(record.endDate, normalizeIsoDate(record.baseEndDate, startDate));
  const baseStartDate = normalizeIsoDate(record.baseStartDate, startDate);
  const baseEndDate = normalizeIsoDate(record.baseEndDate, endDate);
  const rawProgress = Number(record.progress);

  return {
    id,
    parentId,
    name: normalizeText(record.name, 'Untitled Task'),
    startDate,
    endDate: endDate >= startDate ? endDate : startDate,
    baseStartDate,
    baseEndDate: baseEndDate >= baseStartDate ? baseEndDate : baseStartDate,
    status: sanitizeTaskStatus(record.status),
    dependencies: sanitizeDependencies(record.dependencies),
    children: Array.isArray(record.children)
      ? record.children
          .map((child, index) => sanitizeTaskNode(child, `${id}__child_${index + 1}`, id))
          .filter((child): child is TaskNode => child !== null)
      : [],
    isExpanded: typeof record.isExpanded === 'boolean' ? record.isExpanded : true,
    reason: normalizeText(record.reason) || undefined,
    assignee: normalizeText(record.assignee) || undefined,
    tag: normalizeText(record.tag) || undefined,
    progress: Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, Math.round(rawProgress))) : undefined,
    iterationPhase: normalizeText(record.iterationPhase) || undefined,
  };
}

function sanitizeComponents(value: unknown): ComponentGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce((acc, component, index) => {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      return acc;
    }

    const record = component as Record<string, unknown>;
    acc.push({
      id: normalizeText(record.id, `component_${index + 1}`),
      name: normalizeText(record.name, `Component ${index + 1}`),
      tasks: Array.isArray(record.tasks)
        ? record.tasks
            .map((task, taskIndex) => sanitizeTaskNode(task, `task_${taskIndex + 1}`, null))
            .filter((task): task is TaskNode => task !== null)
        : [],
      isExpanded: typeof record.isExpanded === 'boolean' ? record.isExpanded : true,
    });
    return acc;
  }, [] as ComponentGroup[]);
}

function sanitizeMilestones(value: unknown): Milestone[] {
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

      return {
        id: normalizeText(record.id, `milestone_${index + 1}`),
        name: normalizeText(record.name, `Milestone ${index + 1}`),
        date,
        type: record.type === 'technical' ? 'technical' : 'commercial',
      } satisfies Milestone;
    })
    .filter((milestone): milestone is Milestone => milestone !== null);
}

function sanitizeBoardState(value: unknown): DashboardProjectGanttBoardState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    components: sanitizeComponents(record.components),
    milestones: sanitizeMilestones(record.milestones),
    role: record.role === 'USER' ? 'USER' : 'ADMIN',
  };
}

function sanitizeBoards(value: unknown): DashboardProjectGanttBoardTab[] {
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
        id: normalizeText(record.id, `board_${index + 1}`),
        title: normalizeText(record.title, `项目${index + 1}甘特图`),
        serial: Number.isFinite(serial) && serial > 0 ? Math.floor(serial) : index + 1,
      } satisfies DashboardProjectGanttBoardTab;
    })
    .filter((board): board is DashboardProjectGanttBoardTab => board !== null);
}

function sanitizeBoardStateById(
  value: unknown,
  boards: DashboardProjectGanttBoardTab[],
): Record<string, DashboardProjectGanttBoardState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const allowedBoardIds = new Set(boards.map((board) => board.id));

  return Object.entries(value as Record<string, unknown>).reduce((acc, [boardId, boardState]) => {
    const normalizedBoardId = normalizeText(boardId);
    if (!normalizedBoardId || !allowedBoardIds.has(normalizedBoardId)) {
      return acc;
    }

    const sanitizedBoardState = sanitizeBoardState(boardState);
    if (!sanitizedBoardState) {
      return acc;
    }

    acc[normalizedBoardId] = sanitizedBoardState;
    return acc;
  }, {} as Record<string, DashboardProjectGanttBoardState>);
}

export async function fetchDashboardProjectGanttState(
  identity: DashboardProjectGanttIdentity = {},
): Promise<DashboardProjectGanttRemoteState | null> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildProjectGanttStateUrl({ workspaceKey }));
  const payload = (await response.json().catch(() => null)) as
    | { state?: DashboardProjectGanttRemoteState | null; error?: string }
    | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, 'UNKNOWN_ERROR');
  }

  const state = payload?.state ?? null;
  if (!state) {
    return null;
  }

  const boards = sanitizeBoards((state as { boards?: unknown }).boards);
  if (boards.length === 0) {
    return null;
  }

  const boardStateById = sanitizeBoardStateById(
    (state as { boardStateById?: unknown }).boardStateById,
    boards,
  );
  const activeBoardId = boards.some((board) => board.id === state.activeBoardId)
    ? state.activeBoardId
    : boards[0].id;

  return {
    workspaceKey: normalizeText(state.workspaceKey, workspaceKey),
    boards,
    activeBoardId,
    boardStateById,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
  };
}

export async function saveDashboardProjectGanttState(
  state: DashboardProjectGanttRemoteState,
): Promise<void> {
  const response = await apiFetch('/api/dashboard/project-gantt-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceKey: state.workspaceKey || DEFAULT_WORKSPACE_KEY,
      boards: state.boards,
      activeBoardId: state.activeBoardId,
      boardStateById: state.boardStateById,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, 'UNKNOWN_ERROR');
  }
}

export async function deleteDashboardProjectGanttState(
  identity: DashboardProjectGanttIdentity = {},
): Promise<void> {
  const response = await apiFetch(buildProjectGanttStateUrl(identity), {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, 'UNKNOWN_ERROR');
  }
}

export { DEFAULT_WORKSPACE_KEY as DEFAULT_DASHBOARD_PROJECT_GANTT_WORKSPACE_KEY };
