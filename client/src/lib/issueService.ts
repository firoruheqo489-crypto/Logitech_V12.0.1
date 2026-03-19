import {
  normalizeIssueProcessStepId,
  normalizeIssueTypes,
  type IssueModuleKey,
  type IssueProcessStepId,
  type IssueTypeId,
} from './issueDomain';
import { deleteAssetViaServer, uploadAssetViaServer } from './ossUpload';
import { supabase } from './supabase';

export interface ImageItem {
  id: string;
  file?: File;
  preview: string;
  name: string;
  size: number;
  compressed: boolean;
}

export interface ModuleData {
  text: string;
  images: ImageItem[];
}

export interface IssueModules {
  evidence: ModuleData;
  description: ModuleData;
  rootCause: ModuleData;
  solution: ModuleData;
  verification: ModuleData;
}

export interface IssueRecord {
  id: string;
  projectId: string;
  projectName?: string;
  productName?: string;
  types: IssueTypeId[];
  date: string;
  process: IssueProcessStepId | '';
  quantity?: string;
  technician?: string;
  machine?: string;
  cavity?: string;
  modules: IssueModules;
  status: 'draft' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  id: string;
  project_id: string;
  types: string[];
  date: string;
  process: string;
  modules: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

type IssueMetaPayload = {
  projectName?: unknown;
  productName?: unknown;
  quantity?: unknown;
  technician?: unknown;
  machine?: unknown;
  cavity?: unknown;
};

type StoredModuleData = {
  text?: unknown;
  images?: unknown;
};

type StoredModulesPayload = Partial<Record<IssueModuleKey, StoredModuleData>> & {
  _meta?: IssueMetaPayload;
};

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sanitizeImageItems(value: unknown): ImageItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<ImageItem[]>((items, item, index) => {
    if (!item || typeof item !== 'object') {
      return items;
    }

    const record = item as Record<string, unknown>;
    const preview = sanitizeString(record.preview);
    const name = sanitizeString(record.name);
    if (!preview) {
      return items;
    }

    items.push({
      id: sanitizeString(record.id) || `img-${index}`,
      preview,
      name,
      size: typeof record.size === 'number' && Number.isFinite(record.size) ? record.size : 0,
      compressed: Boolean(record.compressed),
    });

    return items;
  }, []);
}

function sanitizeModuleData(value: unknown): ModuleData {
  if (!value || typeof value !== 'object') {
    return { text: '', images: [] };
  }

  const record = value as StoredModuleData;
  return {
    text: sanitizeString(record.text),
    images: sanitizeImageItems(record.images),
  };
}

function rowToRecord(row: DbRow): IssueRecord {
  const modulesPayload = (row.modules && typeof row.modules === 'object'
    ? row.modules
    : {}) as StoredModulesPayload;
  const meta = modulesPayload._meta ?? {};

  return {
    id: row.id,
    projectId: row.project_id || '',
    projectName: sanitizeString(meta.projectName),
    productName: sanitizeString(meta.productName),
    types: normalizeIssueTypes(row.types || []),
    date: row.date || '',
    process: normalizeIssueProcessStepId(row.process),
    quantity: sanitizeString(meta.quantity),
    technician: sanitizeString(meta.technician),
    machine: sanitizeString(meta.machine),
    cavity: sanitizeString(meta.cavity),
    modules: {
      evidence: sanitizeModuleData(modulesPayload.evidence),
      description: sanitizeModuleData(modulesPayload.description),
      rootCause: sanitizeModuleData(modulesPayload.rootCause),
      solution: sanitizeModuleData(modulesPayload.solution),
      verification: sanitizeModuleData(modulesPayload.verification),
    },
    status: (row.status as 'draft' | 'submitted') || 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordToRow(record: IssueRecord) {
  const cleanModules: Record<string, unknown> = Object.fromEntries(
    (Object.entries(record.modules) as Array<[IssueModuleKey, ModuleData]>).map(([key, value]) => [
      key,
      {
        text: value.text,
        images: value.images.map((image) => ({
          id: image.id,
          preview: image.preview,
          name: image.name,
          size: image.size,
          compressed: image.compressed,
        })),
      },
    ]),
  );

  cleanModules._meta = {
    projectName: record.projectName || '',
    productName: record.productName || '',
    quantity: record.quantity || '',
    technician: record.technician || '',
    machine: record.machine || '',
    cavity: record.cavity || '',
  };

  return {
    id: record.id,
    project_id: record.projectId || '',
    types: normalizeIssueTypes(record.types),
    date: record.date || null,
    process: normalizeIssueProcessStepId(record.process),
    modules: cleanModules,
    status: record.status,
    updated_at: new Date().toISOString(),
  };
}

export async function uploadImage(
  issueId: string,
  moduleKey: string,
  file: File,
): Promise<{ publicUrl: string } | null> {
  try {
    const result = await uploadAssetViaServer({
      file,
      category: 'issue-image',
      entityId: issueId,
      slot: moduleKey,
    });

    return { publicUrl: result.url };
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export async function deleteImage(imageUrl: string): Promise<void> {
  await deleteAssetViaServer(imageUrl);
}

export async function fetchIssues(projectId?: string): Promise<IssueRecord[]> {
  if (!supabase) return [];

  let query = supabase.from('issues').select('*').order('created_at', { ascending: false });
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Fetch issues error:', error);
    return [];
  }

  return (data || []).map(rowToRecord);
}

export async function createIssue(record: IssueRecord): Promise<boolean> {
  if (!supabase) return false;

  const row = recordToRow(record);
  const { error } = await supabase.from('issues').insert({ ...row, created_at: record.createdAt });
  if (error) {
    console.error('Create issue error:', error);
    return false;
  }

  return true;
}

export async function updateIssue(record: IssueRecord): Promise<boolean> {
  if (!supabase) return false;

  const row = recordToRow(record);
  const { error } = await supabase.from('issues').update(row).eq('id', record.id);
  if (error) {
    console.error('Update issue error:', error);
    return false;
  }

  return true;
}

export async function deleteIssue(id: string, modules: IssueRecord['modules']): Promise<boolean> {
  if (!supabase) return false;

  const allImageUrls = (Object.values(modules) as ModuleData[]).flatMap((moduleData) =>
    moduleData.images.map((image) => image.preview),
  );
  await Promise.allSettled(allImageUrls.map((imageUrl) => deleteAssetViaServer(imageUrl)));

  const { error } = await supabase.from('issues').delete().eq('id', id);
  if (error) {
    console.error('Delete issue error:', error);
    return false;
  }

  return true;
}
