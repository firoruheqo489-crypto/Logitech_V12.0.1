/**
 * Issue Service - Supabase CRUD + Storage for 问题汇总库
 * 
 * Supabase setup required:
 * 1. Create table `issues` (SQL below)
 * 2. Create storage bucket `issue-images` (public)
 * 
 * SQL:
 * CREATE TABLE issues (
 *   id TEXT PRIMARY KEY,
 *   project_id TEXT DEFAULT '',
 *   types TEXT[] DEFAULT '{}',
 *   date DATE,
 *   process TEXT DEFAULT '',
 *   modules JSONB DEFAULT '{}',
 *   status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
 *   created_at TIMESTAMPTZ DEFAULT now(),
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE INDEX idx_issues_project_id ON issues(project_id);
 * 
 * -- Migration for existing table:
 * -- ALTER TABLE issues ADD COLUMN IF NOT EXISTS project_id TEXT DEFAULT '';
 * -- CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
 * 
 * -- Storage bucket (run in Supabase dashboard > Storage):
 * -- Create bucket "issue-images" with public access
 */

import {
  normalizeIssueProcessStepId,
  normalizeIssueTypes,
  type IssueModuleKey,
  type IssueProcessStepId,
  type IssueTypeId,
} from './issueDomain';
import { supabase } from './supabase';

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface ImageItem {
  id: string;
  file?: File;
  preview: string;  // Supabase public URL or blob URL
  name: string;
  size: number;
  compressed: boolean;
  storagePath?: string;  // path in Supabase storage
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

const BUCKET = 'issue-images';

// ═══════════════════════════════════════════════
// Image Upload / Delete
// ═══════════════════════════════════════════════

export async function uploadImage(issueId: string, moduleKey: string, file: File): Promise<{ storagePath: string; publicUrl: string } | null> {
  if (!supabase) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${issueId}/${moduleKey}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) { console.error('Upload error:', error); return null; }
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { storagePath: path, publicUrl: urlData.publicUrl };
}

export async function deleteImage(storagePath: string): Promise<void> {
  if (!supabase || !storagePath) return;
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

// ═══════════════════════════════════════════════
// DB Row <-> IssueRecord conversion
// ═══════════════════════════════════════════════

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
        storagePath: sanitizeString(record.storagePath) || undefined,
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

function recordToRow(r: IssueRecord) {
  // Strip file objects from images before saving to DB
  const cleanModules: Record<string, unknown> = Object.fromEntries(
    (Object.entries(r.modules) as Array<[IssueModuleKey, ModuleData]>).map(([k, v]) => [
      k,
      { text: v.text, images: v.images.map((img: ImageItem) => ({ ...img, file: undefined })) },
    ])
  );
  // Store extra fields inside modules JSONB as _meta (no DB migration needed)
  cleanModules._meta = {
    projectName: r.projectName || '',
    productName: r.productName || '',
    quantity: r.quantity || '',
    technician: r.technician || '',
    machine: r.machine || '',
    cavity: r.cavity || '',
  };
  return {
    id: r.id,
    project_id: r.projectId || '',
    types: normalizeIssueTypes(r.types),
    date: r.date || null,
    process: normalizeIssueProcessStepId(r.process),
    modules: cleanModules,
    status: r.status,
    updated_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════
// CRUD Operations
// ═══════════════════════════════════════════════

/** Fetch issues, optionally filtered by project_id */
export async function fetchIssues(projectId?: string): Promise<IssueRecord[]> {
  if (!supabase) return [];
  let query = supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  const { data, error } = await query;
  if (error) { console.error('Fetch issues error:', error); return []; }
  return (data || []).map(rowToRecord);
}

/** Insert a new issue */
export async function createIssue(record: IssueRecord): Promise<boolean> {
  if (!supabase) return false;
  const row = recordToRow(record);
  const { error } = await supabase.from('issues').insert({ ...row, created_at: record.createdAt });
  if (error) { console.error('Create issue error:', error); return false; }
  return true;
}

/** Update an existing issue */
export async function updateIssue(record: IssueRecord): Promise<boolean> {
  if (!supabase) return false;
  const row = recordToRow(record);
  const { error } = await supabase.from('issues').update(row).eq('id', record.id);
  if (error) { console.error('Update issue error:', error); return false; }
  return true;
}

/** Delete an issue and its images from storage */
export async function deleteIssue(id: string, modules: IssueRecord['modules']): Promise<boolean> {
  if (!supabase) return false;
  // Delete all images from storage
  const allImages = Object.values(modules).flatMap(m => m.images);
  const paths = allImages.map(img => img.storagePath).filter(Boolean) as string[];
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
  // Delete the folder too (best effort)
  const { data: remaining } = await supabase.storage.from(BUCKET).list(id);
  if (remaining && remaining.length > 0) {
    await supabase.storage.from(BUCKET).remove(remaining.map(f => `${id}/${f.name}`));
  }
  const { error } = await supabase.from('issues').delete().eq('id', id);
  if (error) { console.error('Delete issue error:', error); return false; }
  return true;
}

/** Check if Supabase is connected */
export function isSupabaseReady(): boolean {
  return supabase !== null;
}
