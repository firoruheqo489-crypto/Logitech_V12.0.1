import type { DashboardProject } from '@shared/schema';
import { apiFetch } from '@/lib/api';
import type { ProjectData } from '../types/project';
import { transformProjectToData } from './dataTransformer';

type DashboardProjectBoundaryRow = Omit<DashboardProject, 'createdAt' | 'updatedAt'> & {
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

type UnknownRecord = Record<string, unknown>;

const DASHBOARD_PROJECTS_ENDPOINT = '/api/dashboard/projects';
const DASHBOARD_PROGRESS_ENDPOINT = '/api/dashboard/progress-notes';

export type DashboardProgressEntry = {
  id: string;
  date: string;
  content: string;
  imageUrl?: string;
  assignee?: string;
  estimatedNodeCompletion?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DashboardProgressSaveResult = {
  backupCreated: boolean;
  backupAt: string;
};

export type DashboardProgressBackupMutationResult = {
  created: boolean;
  restoredCount: number;
  backupAt: string;
};

export type DashboardProjectViewData = ProjectData & {
  projectName: string;
  productName: string;
  moldNumber: string;
  currentNode: string;
  detailDate: string;
  detailProgress: string;
  projectEngineer: string;
  projectManager: string;
};

export type DashboardApiErrorCode =
  | 'API_KEY_INVALID'
  | 'API_KEY_NOT_CONFIGURED'
  | 'BACKUP_NOT_FOUND'
  | 'BODY_MUST_BE_ARRAY'
  | 'DATABASE_NOT_CONFIGURED'
  | 'INTERNAL_ERROR'
  | 'MOLD_NUMBER_REQUIRED'
  | 'NOTE_ID_REQUIRED'
  | 'UNKNOWN_ERROR';

const DASHBOARD_API_ERROR_CODES = new Set<DashboardApiErrorCode>([
  'API_KEY_INVALID',
  'API_KEY_NOT_CONFIGURED',
  'BACKUP_NOT_FOUND',
  'BODY_MUST_BE_ARRAY',
  'DATABASE_NOT_CONFIGURED',
  'INTERNAL_ERROR',
  'MOLD_NUMBER_REQUIRED',
  'NOTE_ID_REQUIRED',
  'UNKNOWN_ERROR',
]);

export class DashboardApiError extends Error {
  readonly code: DashboardApiErrorCode;
  readonly status: number;

  constructor(message: string, code: DashboardApiErrorCode, status: number) {
    super(message);
    this.name = 'DashboardApiError';
    this.code = code;
    this.status = status;
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function readNullableString(value: unknown): string | null {
  if (value == null) return null;
  return readString(value);
}

function readOptionalString(value: unknown): string | undefined {
  const normalized = readString(value).trim();
  return normalized ? normalized : undefined;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return Boolean(value);
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readDateLike(value: unknown): string | Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const normalized = readString(value).trim();
  return normalized ? normalized : null;
}

function readDashboardApiErrorCode(value: unknown, fallbackCode: DashboardApiErrorCode): DashboardApiErrorCode {
  const normalized = readOptionalString(value);
  if (!normalized) return fallbackCode;
  return DASHBOARD_API_ERROR_CODES.has(normalized as DashboardApiErrorCode)
    ? normalized as DashboardApiErrorCode
    : fallbackCode;
}

function normalizeDashboardProjectRow(raw: unknown): DashboardProjectBoundaryRow | null {
  const row = asRecord(raw);
  if (!row) return null;

  return {
    id: readNumber(row.id),
    customerName: readNullableString(row.customerName),
    customerBase: readNullableString(row.customerBase),
    projectName: readNullableString(row.projectName),
    productName: readNullableString(row.productName),
    factoryLocation: readNullableString(row.factoryLocation),
    moldCount: readNullableString(row.moldCount),
    partNumber: readNullableString(row.partNumber),
    cavityNumber: readNullableString(row.cavityNumber),
    moldId: readNullableString(row.moldId),
    pmName: readNullableString(row.pmName),
    peName: readNullableString(row.peName),
    moldLead: readNullableString(row.moldLead),
    pqeName: readNullableString(row.pqeName),
    riskLevel: readNullableString(row.riskLevel),
    fitterGroup: readNullableString(row.fitterGroup),
    designEngineer: readNullableString(row.designEngineer),
    kickoffDate: readNullableString(row.kickoffDate),
    t1Date: readNullableString(row.t1Date),
    glDate: readNullableString(row.glDate),
    vmpDate: readNullableString(row.vmpDate),
    mpDate: readNullableString(row.mpDate),
    currentStage: readNullableString(row.currentStage),
    t1DimensionOk: readNullableString(row.t1DimensionOk),
    trialCount: readNullableString(row.trialCount),
    toolingFai: readNullableString(row.toolingFai),
    partFai: readNullableString(row.partFai),
    currentNode: readNullableString(row.currentNode),
    estimatedCompletion: readNullableString(row.estimatedCompletion),
    progressDetails: readNullableString(row.progressDetails),
    updateDate: readNullableString(row.updateDate),
    createdAt: readDateLike(row.createdAt),
    updatedAt: readDateLike(row.updatedAt),
  };
}

function normalizeDashboardProjectRows(payload: unknown): DashboardProjectBoundaryRow[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((row) => normalizeDashboardProjectRow(row))
    .filter((row): row is DashboardProjectBoundaryRow => row !== null);
}

function normalizeProgressEntry(raw: unknown): DashboardProgressEntry | null {
  const row = asRecord(raw);
  if (!row) return null;

  return {
    id: readString(row.id),
    date: readString(row.date),
    content: readString(row.content),
    imageUrl: readOptionalString(row.imageUrl),
    assignee: readOptionalString(row.assignee),
    estimatedNodeCompletion: readOptionalString(row.estimatedNodeCompletion),
    createdAt: readOptionalString(row.createdAt),
    updatedAt: readOptionalString(row.updatedAt),
  };
}

export function normalizeDashboardProgressEntries(payload: unknown): DashboardProgressEntry[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) => normalizeProgressEntry(entry))
    .filter((entry): entry is DashboardProgressEntry => entry !== null)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function normalizeDashboardProgressSaveResult(payload: unknown): DashboardProgressSaveResult {
  const row = asRecord(payload);
  return {
    backupCreated: readBoolean(row?.backupCreated),
    backupAt: readOptionalString(row?.backupAt) ?? '',
  };
}

export function normalizeDashboardProgressBackupMutationResult(payload: unknown): DashboardProgressBackupMutationResult {
  const row = asRecord(payload);
  return {
    created: readBoolean(row?.created),
    restoredCount: readNumber(row?.restoredCount),
    backupAt: readOptionalString(row?.backupAt) ?? '',
  };
}

export function normalizeDashboardLatestBackupAt(payload: unknown): string {
  const row = asRecord(payload);
  return readOptionalString(row?.backupAt) ?? '';
}

export function normalizeDashboardApiError(
  payload: unknown,
  status: number,
  fallbackCode: DashboardApiErrorCode = 'UNKNOWN_ERROR',
): DashboardApiError {
  const row = asRecord(payload);
  const code = readDashboardApiErrorCode(row?.code, fallbackCode);
  const message = readOptionalString(row?.error) ?? `Request failed (${status})`;
  return new DashboardApiError(message, code, status);
}

export function getDashboardApiErrorDisplayMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof DashboardApiError) {
    switch (error.code) {
      case 'API_KEY_INVALID':
        return '当前会话未授权，请刷新后重试';
      case 'API_KEY_NOT_CONFIGURED':
        return '服务端写接口授权未配置，暂时无法提交';
      case 'BACKUP_NOT_FOUND':
        return '暂无可恢复备份';
      case 'BODY_MUST_BE_ARRAY':
        return '提交数据格式无效，请刷新页面后重试';
      case 'DATABASE_NOT_CONFIGURED':
        return '服务端数据库未配置，暂时无法执行此操作';
      case 'INTERNAL_ERROR':
        return '服务暂时异常，请稍后重试';
      case 'MOLD_NUMBER_REQUIRED':
        return '缺少模具编号，无法继续操作';
      case 'NOTE_ID_REQUIRED':
        return '缺少记录标识，无法继续操作';
      case 'UNKNOWN_ERROR':
        break;
    }
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallbackMessage;
  }

  return fallbackMessage;
}

function decorateProjectData(project: ProjectData): DashboardProjectViewData {
  return {
    ...project,
    projectName: project.identity.projectName,
    productName: project.identity.productName,
    moldNumber: project.identity.moldNumber,
    currentNode: project.milestones.currentNode,
    detailDate: project.details.detailDate,
    detailProgress: project.details.detailProgress,
    projectEngineer: project.identity.projectEngineer,
    projectManager: project.identity.projectManager,
  };
}

export async function fetchDashboardProjectData(): Promise<DashboardProjectViewData[]> {
  const response = await apiFetch(DASHBOARD_PROJECTS_ENDPOINT);
  if (!response.ok) return [];
  const payload = await response.json();
  return normalizeDashboardProjectRows(payload)
    .map(transformProjectToData)
    .map(decorateProjectData);
}

export async function fetchDashboardProgressEntries(moldNumber: string): Promise<DashboardProgressEntry[]> {
  try {
    const response = await apiFetch(`${DASHBOARD_PROGRESS_ENDPOINT}/${encodeURIComponent(moldNumber)}`);
    if (!response.ok) return [];
    return normalizeDashboardProgressEntries(await response.json());
  } catch {
    return [];
  }
}
