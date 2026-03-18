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
    backupCreated: Boolean(row?.backupCreated),
    backupAt: readOptionalString(row?.backupAt) ?? '',
  };
}

export function normalizeDashboardLatestBackupAt(payload: unknown): string {
  const row = asRecord(payload);
  return readOptionalString(row?.backupAt) ?? '';
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
