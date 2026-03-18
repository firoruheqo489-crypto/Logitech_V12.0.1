import type {
  PhaseType,
  ProjectInfo,
  TaskNode,
  TaskStatusType,
  TrackId,
} from '../../shared/ganttEngine.js';
import type { Task } from '../../shared/schema.js';

const VALID_PHASES = ['physical', 'data', 'production'] as const;
const VALID_TRACKS = ['cavity_core', 'cavity_insert', 'slider', 'lifter'] as const;
const VALID_STATUSES = ['NotStart', 'InProgress', 'Blocked', 'Done'] as const;
const VALID_EVIDENCE_TYPES = [
  'photo',
  'video',
  'document',
  'fai_report',
  'cmm_report',
  'dimension_report',
] as const;

type EvidenceType = (typeof VALID_EVIDENCE_TYPES)[number];

type RecordLike = Record<string, unknown>;

export interface NormalizedTaskRow {
  projectId: string;
  logicalId: string;
  wbsId: string | null;
  name: string;
  nameCn: string;
  phase: PhaseType;
  track: TrackId | null;
  stage: string | null;
  stageOrder: number;
  weight: number;
  durationDays: number;
  baselineStart: string;
  baselineEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  progress: number;
  status: TaskStatusType;
  isCritical: boolean;
  isMergePoint: boolean;
  isMilestone: boolean;
  assignee: string | null;
  notes: string | null;
  updatedAt: Date;
}

export interface NormalizedEvidencePayload {
  type: EvidenceType;
  url: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
}

export type NormalizedGanttImportResult =
  | {
      ok: true;
      projectId: string;
      projectInfo: ProjectInfo;
      tasks: TaskNode[];
    }
  | {
      ok: false;
      error: string;
    };

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function asRecord(value: unknown): RecordLike | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordLike)
    : null;
}

function getAliasedValue(record: RecordLike | null, keys: readonly string[]): unknown {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

export function readTrimmedString(value: unknown, maxLength = 1024): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function readNullableString(value: unknown, maxLength = 1024): string | null {
  return readTrimmedString(value, maxLength) ?? null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeInteger(value: unknown, fallback: number): number {
  const parsed = parseNumber(value);
  return parsed === null ? fallback : Math.trunc(parsed);
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = parseNumber(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed !== null && parsed >= 0 ? Math.trunc(parsed) : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toDateStr(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return null;
}

function normalizePhase(value: unknown): PhaseType {
  return isOneOf(VALID_PHASES, value) ? value : 'physical';
}

function normalizeTrack(value: unknown): TrackId | undefined {
  return isOneOf(VALID_TRACKS, value) ? value : undefined;
}

function normalizeStatus(value: unknown): TaskStatusType {
  return isOneOf(VALID_STATUSES, value) ? value : 'NotStart';
}

function normalizeEvidenceType(value: unknown): EvidenceType | undefined {
  return isOneOf(VALID_EVIDENCE_TYPES, value) ? value : undefined;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildProjectInfo(record: RecordLike | null, fallbackProjectId: string): ProjectInfo {
  return {
    id: readTrimmedString(getAliasedValue(record, ['id']), 50) ?? fallbackProjectId,
    brand: readTrimmedString(getAliasedValue(record, ['brand']), 50) ?? 'Logitech',
    productName: readTrimmedString(getAliasedValue(record, ['productName', 'product_name']), 255) ?? '',
    moldNumber: readTrimmedString(getAliasedValue(record, ['moldNumber', 'mold_number']), 50) ?? fallbackProjectId,
    startDate: toDateStr(getAliasedValue(record, ['startDate', 'start_date'])) ?? '',
    endDate: toDateStr(getAliasedValue(record, ['endDate', 'end_date'])) ?? '',
    index_no: readTrimmedString(getAliasedValue(record, ['index_no', 'indexNo']), 50),
    project_name: readTrimmedString(getAliasedValue(record, ['project_name', 'projectName']), 255),
    fitter_group: readTrimmedString(getAliasedValue(record, ['fitter_group', 'fitterGroup']), 255),
    product_image_url: readTrimmedString(
      getAliasedValue(record, ['product_image_url', 'productImageUrl']),
      1024,
    ),
  };
}

function normalizeTaskNode(input: unknown, fallbackProjectId: string, index: number): TaskNode | null {
  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const baselineStart = toDateStr(record.baselineStart) ?? todayDateString();
  const baselineEnd = toDateStr(record.baselineEnd) ?? baselineStart;
  const name = readTrimmedString(record.name, 255) ?? '';

  return {
    id: readTrimmedString(record.id, 255) ?? `${fallbackProjectId}_${index}`,
    dbId: readTrimmedString(record.dbId, 64),
    projectId: readTrimmedString(record.projectId, 50) ?? fallbackProjectId,
    wbsId: readTrimmedString(record.wbsId, 100),
    name,
    nameCn: readTrimmedString(record.nameCn, 255) ?? name,
    phase: normalizePhase(record.phase),
    track: normalizeTrack(record.track),
    stage: readTrimmedString(record.stage, 100),
    stageOrder: normalizeInteger(record.stageOrder, 0),
    weight: normalizePositiveNumber(record.weight, 1),
    durationDays: Math.max(1, normalizeInteger(record.durationDays, 1)),
    baselineStart,
    baselineEnd,
    actualStart: toDateStr(record.actualStart) ?? undefined,
    actualEnd: toDateStr(record.actualEnd) ?? undefined,
    progress: clamp(normalizeInteger(record.progress, 0), 0, 100),
    status: normalizeStatus(record.status),
    isCritical: normalizeBoolean(record.isCritical),
    isMergePoint: normalizeBoolean(record.isMergePoint),
    isMilestone: normalizeBoolean(record.isMilestone),
    assignee: readTrimmedString(record.assignee, 255),
    notes: readTrimmedString(record.notes, 10_000),
  };
}

function findDuplicateTaskId(taskNodes: readonly TaskNode[]): string | null {
  const seen = new Set<string>();

  for (const task of taskNodes) {
    const logicalId = task.id.trim();
    if (seen.has(logicalId)) {
      return logicalId;
    }
    seen.add(logicalId);
  }

  return null;
}

export function taskRowToTaskNode(row: Task): TaskNode {
  const logicalId = readTrimmedString(row.logicalId, 255) ?? String(row.id);

  return {
    id: logicalId,
    dbId: String(row.id),
    projectId: row.projectId,
    wbsId: row.wbsId ?? undefined,
    name: row.name,
    nameCn: row.nameCn,
    phase: normalizePhase(row.phase),
    track: normalizeTrack(row.track),
    stage: row.stage ?? undefined,
    stageOrder: Number(row.stageOrder) || 0,
    weight: Number(row.weight) || 1,
    durationDays: Number(row.durationDays) || 1,
    baselineStart: String(row.baselineStart).slice(0, 10),
    baselineEnd: String(row.baselineEnd).slice(0, 10),
    actualStart: row.actualStart != null ? String(row.actualStart).slice(0, 10) : undefined,
    actualEnd: row.actualEnd != null ? String(row.actualEnd).slice(0, 10) : undefined,
    progress: Number(row.progress) || 0,
    status: normalizeStatus(row.status),
    isCritical: Boolean(row.isCritical),
    isMergePoint: Boolean(row.isMergePoint),
    isMilestone: Boolean(row.isMilestone),
    assignee: row.assignee ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function taskNodeToRow(task: TaskNode, projectId: string, index: number): NormalizedTaskRow {
  const baselineStart = toDateStr(task.baselineStart) ?? todayDateString();
  const baselineEnd = toDateStr(task.baselineEnd) ?? baselineStart;

  return {
    projectId,
    logicalId: readTrimmedString(task.id, 255) ?? `${projectId}_${index}`,
    wbsId: readNullableString(task.wbsId, 100),
    name: (readTrimmedString(task.name, 255) ?? '').slice(0, 255),
    nameCn: (readTrimmedString(task.nameCn, 255) ?? readTrimmedString(task.name, 255) ?? '').slice(0, 255),
    phase: normalizePhase(task.phase),
    track: normalizeTrack(task.track) ?? null,
    stage: readNullableString(task.stage, 100),
    stageOrder: normalizeInteger(task.stageOrder, 0),
    weight: normalizePositiveNumber(task.weight, 1),
    durationDays: Math.max(1, normalizeInteger(task.durationDays, 1)),
    baselineStart,
    baselineEnd,
    actualStart: toDateStr(task.actualStart),
    actualEnd: toDateStr(task.actualEnd),
    progress: clamp(normalizeInteger(task.progress, 0), 0, 100),
    status: normalizeStatus(task.status),
    isCritical: normalizeBoolean(task.isCritical),
    isMergePoint: normalizeBoolean(task.isMergePoint),
    isMilestone: normalizeBoolean(task.isMilestone),
    assignee: readNullableString(task.assignee, 255),
    notes: readNullableString(task.notes, 10_000),
    updatedAt: new Date(),
  };
}

export function normalizeGanttImportPayload(
  body: unknown,
  fallbackProjectId: string,
): NormalizedGanttImportResult {
  const record = asRecord(body);
  if (!record) {
    return { ok: false, error: 'Request body must be an object' };
  }

  const rawTasks = record.tasks;
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    return { ok: false, error: 'tasks array is required and non-empty' };
  }

  const projectInfoRecord = asRecord(record.projectInfo);
  const firstTaskRecord = asRecord(rawTasks[0]);
  const projectId =
    readTrimmedString(getAliasedValue(projectInfoRecord, ['id']), 50) ??
    readTrimmedString(record.projectId, 50) ??
    readTrimmedString(firstTaskRecord?.projectId, 50) ??
    fallbackProjectId;

  const taskNodes: TaskNode[] = [];
  for (const [index, rawTask] of rawTasks.entries()) {
    const taskNode = normalizeTaskNode(rawTask, projectId, index);
    if (!taskNode) {
      return { ok: false, error: `tasks[${index}] must be an object` };
    }

    taskNodes.push(taskNode);
  }

  const duplicateTaskId = findDuplicateTaskId(taskNodes);
  if (duplicateTaskId) {
    return { ok: false, error: `Duplicate task id "${duplicateTaskId}" detected in import payload` };
  }

  return {
    ok: true,
    projectId,
    projectInfo: buildProjectInfo(projectInfoRecord, projectId),
    tasks: taskNodes,
  };
}

export function normalizeProjectImagePayload(body: unknown): { productImageUrl: string } | null {
  const record = asRecord(body);
  const productImageUrl = readTrimmedString(
    getAliasedValue(record, ['productImageUrl', 'product_image_url']),
    1024,
  );

  return productImageUrl ? { productImageUrl } : null;
}

export function normalizeEvidencePayload(body: unknown): NormalizedEvidencePayload | null {
  const record = asRecord(body);
  if (!record) {
    return null;
  }

  const type = normalizeEvidenceType(record.type);
  const url = readTrimmedString(record.url, 1024);

  if (!type || !url) {
    return null;
  }

  return {
    type,
    url,
    fileName: readNullableString(record.fileName, 255),
    fileSize: normalizeNonNegativeInteger(record.fileSize),
    mimeType: readNullableString(record.mimeType, 100),
    description: readNullableString(record.description, 10_000),
  };
}
