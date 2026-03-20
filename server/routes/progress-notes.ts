/**
 * Progress Notes API — 项目推进细节 CRUD
 * 
 * GET    /api/dashboard/progress-notes/:moldNumber — 获取某模具的所有推进记录
 * GET    /api/dashboard/progress-notes/:moldNumber/latest-backup — 获取最近一次备份时间
 * POST   /api/dashboard/progress-notes/:moldNumber — 保存（全量替换）某模具的推进记录
 * POST   /api/dashboard/progress-notes/:moldNumber/entry — 单条新增/更新推进记录
 * POST   /api/dashboard/progress-notes/:moldNumber/create-backup — 手动创建一次备份
 * POST   /api/dashboard/progress-notes/:moldNumber/restore-latest — 恢复到最近一次备份
 * DELETE /api/dashboard/progress-notes/:moldNumber/:noteId — 删除单条记录
 */

import type { Request, Response } from 'express';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { db, sql as dbSql } from '../db.js';
import { progressNotes } from '../../shared/schema.js';

type ProgressNotePayload = {
  id: string;
  date: string;
  content: string;
  imageUrl?: string;
  assignee?: string;
  estimatedNodeCompletion?: string;
  createdAt?: string;
  updatedAt?: string;
};

type BackupEntry = {
  id: string;
  date: string;
  content: string;
  imageUrl?: string;
  assignee?: string;
  estimatedNodeCompletion?: string;
  createdAt?: string;
  updatedAt?: string;
};

type NoteAuditAction = 'create-entry' | 'update-entry' | 'delete-entry' | 'delete-image' | 'restore-backup';
type ProgressNotesErrorCode =
  | 'BACKUP_NOT_FOUND'
  | 'BODY_MUST_BE_ARRAY'
  | 'DATABASE_NOT_CONFIGURED'
  | 'INTERNAL_ERROR'
  | 'MOLD_NUMBER_REQUIRED'
  | 'NOTE_ID_REQUIRED'
  | 'SNAPSHOT_DESTRUCTIVE_CONFIRMATION_REQUIRED';

const DEFAULT_AUDIT_CONTENT_PREVIEW_LENGTH = 160;
const DEFAULT_BACKUP_KEEP_LIMIT_PER_MOLD = 1;
const DEFAULT_BACKUP_RETENTION_DAYS = 30;
const DEFAULT_AUDIT_RETENTION_DAYS = 3;
const PROGRESS_NOTES_ERROR_MESSAGES: Record<ProgressNotesErrorCode, string> = {
  BACKUP_NOT_FOUND: 'latest backup not found',
  BODY_MUST_BE_ARRAY: 'request body must be an array',
  DATABASE_NOT_CONFIGURED: 'database not configured',
  INTERNAL_ERROR: 'internal server error',
  MOLD_NUMBER_REQUIRED: 'moldNumber required',
  NOTE_ID_REQUIRED: 'noteId required',
  SNAPSHOT_DESTRUCTIVE_CONFIRMATION_REQUIRED: 'destructive snapshot confirmation required',
};

export const SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER = 'x-snapshot-confirmation';
export const SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE = 'allow-destructive';

const SNAPSHOT_CLEAR_ALL_MIN_COUNT = 2;
const SNAPSHOT_MAJORITY_DELETE_MIN_BASELINE = 4;
const SNAPSHOT_MAJORITY_DELETE_MIN_COUNT = 3;
const SNAPSHOT_MAJORITY_DELETE_RATIO = 0.5;

type SnapshotMutationRiskReason = 'none' | 'clear-all' | 'majority-delete';

export type SnapshotMutationRisk = {
  beforeCount: number;
  afterCount: number;
  deletedCount: number;
  reason: SnapshotMutationRiskReason;
  requiresConfirmation: boolean;
};

type BackupSnapshotRow = {
  id?: number | string | null;
  snapshot?: BackupEntry[] | string | null;
  created_at?: string | Date | null;
};

export type RestorableBackup = {
  id: number;
  backupAt: string;
  snapshot: BackupEntry[];
};

let progressBackupTableReady: Promise<void> | null = null;
let progressAuditTableReady: Promise<void> | null = null;

function readPositiveIntEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

const PROGRESS_NOTES_BACKUP_KEEP_LIMIT = readPositiveIntEnv(
  'PROGRESS_NOTES_BACKUP_KEEP_LIMIT',
  DEFAULT_BACKUP_KEEP_LIMIT_PER_MOLD,
  1,
  10,
);
const PROGRESS_NOTES_BACKUP_RETENTION_DAYS = readPositiveIntEnv(
  'PROGRESS_NOTES_BACKUP_RETENTION_DAYS',
  DEFAULT_BACKUP_RETENTION_DAYS,
  1,
  90,
);
const PROGRESS_NOTES_AUDIT_RETENTION_DAYS = readPositiveIntEnv(
  'PROGRESS_NOTES_AUDIT_RETENTION_DAYS',
  DEFAULT_AUDIT_RETENTION_DAYS,
  1,
  30,
);

function sendProgressNotesError(res: Response, status: number, code: ProgressNotesErrorCode): void {
  res.status(status).json({
    error: PROGRESS_NOTES_ERROR_MESSAGES[code],
    code,
  });
}

function sendSnapshotDestructiveConfirmationRequired(res: Response, risk: SnapshotMutationRisk): void {
  res.status(409).json({
    error: PROGRESS_NOTES_ERROR_MESSAGES.SNAPSHOT_DESTRUCTIVE_CONFIRMATION_REQUIRED,
    code: 'SNAPSHOT_DESTRUCTIVE_CONFIRMATION_REQUIRED',
    beforeCount: risk.beforeCount,
    afterCount: risk.afterCount,
    deletedCount: risk.deletedCount,
    reason: risk.reason,
    confirmation: {
      header: SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER,
      value: SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE,
    },
  });
}

function readAuditLogLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.trunc(parsed)));
}

function toIsoTimestamp(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }

  const raw = String(value).trim();
  if (!raw) return '';

  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }

  const normalized = raw.replace(' ', 'T');
  const parsedUtc = new Date(`${normalized}Z`);
  if (!Number.isNaN(parsedUtc.getTime())) {
    return parsedUtc.toISOString();
  }

  const parsedLocal = new Date(normalized);
  return Number.isNaN(parsedLocal.getTime()) ? raw : parsedLocal.toISOString();
}

function decodeNoteContent(raw: string): { content: string; imageUrl?: string; assignee?: string; estimatedNodeCompletion?: string } {
  if (!raw) return { content: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
      return {
        content: parsed.content,
        imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : undefined,
        assignee: typeof parsed.assignee === 'string' ? parsed.assignee : undefined,
        estimatedNodeCompletion: typeof parsed.estimatedNodeCompletion === 'string' ? parsed.estimatedNodeCompletion : undefined,
      };
    }
  } catch {
    // legacy plain-text record
  }
  return { content: raw };
}

function encodeNoteContent(content: string, imageUrl?: string, assignee?: string, estimatedNodeCompletion?: string): string {
  if (!imageUrl && !assignee && !estimatedNodeCompletion) return content;
  const obj: Record<string, string> = { content };
  if (imageUrl) obj.imageUrl = imageUrl;
  if (assignee) obj.assignee = assignee;
  if (estimatedNodeCompletion) obj.estimatedNodeCompletion = estimatedNodeCompletion;
  return JSON.stringify(obj);
}

function toDateObject(value: unknown): Date | undefined {
  const iso = toIsoTimestamp(value);
  if (!iso) return undefined;

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isProgressNotePayload(value: unknown): value is ProgressNotePayload {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readSnapshotConfirmation(req: Request): string {
  const rawValue = req.headers[SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER];
  if (typeof rawValue === 'string') {
    return rawValue.trim();
  }
  if (Array.isArray(rawValue)) {
    return String(rawValue[0] || '').trim();
  }
  return '';
}

function hasDestructiveSnapshotConfirmation(req: Request): boolean {
  return readSnapshotConfirmation(req) === SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE;
}

export function assessProgressSnapshotRisk(input: {
  beforeCount: number;
  afterCount: number;
  deletedCount: number;
}): SnapshotMutationRisk {
  const beforeCount = Math.max(0, Math.trunc(input.beforeCount));
  const afterCount = Math.max(0, Math.trunc(input.afterCount));
  const deletedCount = Math.max(0, Math.trunc(input.deletedCount));

  if (beforeCount >= SNAPSHOT_CLEAR_ALL_MIN_COUNT && afterCount === 0 && deletedCount >= beforeCount) {
    return {
      beforeCount,
      afterCount,
      deletedCount,
      reason: 'clear-all',
      requiresConfirmation: true,
    };
  }

  const deleteRatio = beforeCount > 0 ? deletedCount / beforeCount : 0;
  if (
    beforeCount >= SNAPSHOT_MAJORITY_DELETE_MIN_BASELINE
    && deletedCount >= SNAPSHOT_MAJORITY_DELETE_MIN_COUNT
    && deleteRatio >= SNAPSHOT_MAJORITY_DELETE_RATIO
  ) {
    return {
      beforeCount,
      afterCount,
      deletedCount,
      reason: 'majority-delete',
      requiresConfirmation: true,
    };
  }

  return {
    beforeCount,
    afterCount,
    deletedCount,
    reason: 'none',
    requiresConfirmation: false,
  };
}

function buildProgressNoteRow(
  moldNumber: string,
  entry: ProgressNotePayload | BackupEntry,
  createdAt?: Date,
) {
  return {
    id: entry.id,
    moldNumber,
    date: entry.date,
    content: encodeNoteContent(entry.content, entry.imageUrl, entry.assignee, entry.estimatedNodeCompletion),
    createdAt,
  };
}

export function ensureBackupTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!progressBackupTableReady) {
    progressBackupTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS progress_note_backups (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL,
          snapshot JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS progress_note_backups_mold_idx
        ON progress_note_backups(mold_number, created_at DESC)
      `);
    })();
  }
  return progressBackupTableReady;
}

export function ensureProgressAuditTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!progressAuditTableReady) {
    progressAuditTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS progress_note_audit_logs (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL,
          note_id VARCHAR(100),
          action VARCHAR(50) NOT NULL,
          operator VARCHAR(255),
          ip_address VARCHAR(64),
          old_payload JSONB,
          new_payload JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS progress_note_audit_mold_idx
        ON progress_note_audit_logs(mold_number, created_at DESC)
      `);
    })();
  }
  return progressAuditTableReady;
}

function getOperator(req: Request): string {
  const fromHeader = String(req.header('x-operator') || req.header('x-user') || '').trim();
  if (fromHeader) return fromHeader;
  return 'anonymous';
}

function getClientIp(req: Request): string {
  const forwarded = String(req.header('x-forwarded-for') || '').split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return req.ip || '';
}

function summarizeAuditPayload(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  const copyStringField = (key: string) => {
    const raw = record[key];
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    summary[key] = trimmed.slice(0, 255);
  };

  for (const key of ['id', 'date', 'imageUrl', 'assignee', 'estimatedNodeCompletion', 'createdAt', 'updatedAt', 'backupAt', 'reason']) {
    copyStringField(key);
  }

  if (typeof record.content === 'string') {
    const content = record.content;
    summary.contentPreview = content.slice(0, DEFAULT_AUDIT_CONTENT_PREVIEW_LENGTH);
    summary.contentLength = content.length;
  }

  if (typeof record.restoredCount === 'number' && Number.isFinite(record.restoredCount)) {
    summary.restoredCount = record.restoredCount;
  }

  if (typeof record.backupId === 'number' && Number.isFinite(record.backupId)) {
    summary.backupId = Math.trunc(record.backupId);
  }

  return Object.keys(summary).length > 0 ? summary : null;
}

async function pruneProgressBackups(moldNumber?: string): Promise<void> {
  if (!dbSql) return;
  await ensureBackupTable();

  if (moldNumber) {
    await dbSql.unsafe(
      `
        DELETE FROM progress_note_backups
        WHERE mold_number = $1
          AND id NOT IN (
            SELECT id
            FROM progress_note_backups
            WHERE mold_number = $1
            ORDER BY created_at DESC, id DESC
            LIMIT ${PROGRESS_NOTES_BACKUP_KEEP_LIMIT}
          )
      `,
      [moldNumber],
    );
  }

  await dbSql.unsafe(
    `
      DELETE FROM progress_note_backups
      WHERE created_at < NOW() - INTERVAL '${PROGRESS_NOTES_BACKUP_RETENTION_DAYS} days'
    `,
  );
}

async function pruneProgressAuditLogs(): Promise<void> {
  if (!dbSql) return;
  await ensureProgressAuditTable();
  await dbSql.unsafe(
    `
      DELETE FROM progress_note_audit_logs
      WHERE created_at < NOW() - INTERVAL '${PROGRESS_NOTES_AUDIT_RETENTION_DAYS} days'
    `,
  );
}

async function writeProgressAuditLog(params: {
  moldNumber: string;
  noteId?: string;
  action: NoteAuditAction;
  operator: string;
  ipAddress: string;
  oldPayload?: Record<string, unknown> | null;
  newPayload?: Record<string, unknown> | null;
}) {
  if (!dbSql) return;
  await ensureProgressAuditTable();
  await dbSql.unsafe(
    `
      INSERT INTO progress_note_audit_logs
      (mold_number, note_id, action, operator, ip_address, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
    `,
    [
      params.moldNumber,
      params.noteId || null,
      params.action,
      params.operator,
      params.ipAddress,
      JSON.stringify(summarizeAuditPayload(params.oldPayload)),
      JSON.stringify(summarizeAuditPayload(params.newPayload)),
    ],
  );
}

function normalizeEntryPayload(entry: ProgressNotePayload | BackupEntry): BackupEntry {
  return {
    id: String(entry.id || ''),
    date: String(entry.date || ''),
    content: String(entry.content || ''),
    imageUrl: entry.imageUrl ? String(entry.imageUrl) : undefined,
    assignee: entry.assignee ? String(entry.assignee) : undefined,
    estimatedNodeCompletion: entry.estimatedNodeCompletion ? String(entry.estimatedNodeCompletion) : undefined,
    createdAt: entry.createdAt ? String(entry.createdAt) : undefined,
  };
}

function normalizeBackupSnapshot(snapshot: unknown): BackupEntry[] | null {
  let parsed = snapshot;
  if (typeof snapshot === 'string') {
    try {
      parsed = JSON.parse(snapshot || '[]');
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const normalized: BackupEntry[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    normalized.push(normalizeEntryPayload(entry as BackupEntry));
  }

  return normalized;
}

function countDeletedSnapshotEntries(beforeEntries: BackupEntry[], afterEntries: BackupEntry[]): number {
  const afterIds = new Set(
    afterEntries
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  );

  return beforeEntries.reduce((count, entry) => (
    afterIds.has(entry.id) ? count : count + 1
  ), 0);
}

export function selectLatestRestorableBackup(rows: BackupSnapshotRow[]): RestorableBackup | null {
  for (let index = 0; index < rows.length; index += 1) {
    const candidateRow = rows[index];
    const candidateSnapshot = normalizeBackupSnapshot(candidateRow?.snapshot);
    if (!candidateSnapshot || candidateSnapshot.length === 0) {
      continue;
    }

    let olderSnapshot: BackupEntry[] | null = null;
    for (let olderIndex = index + 1; olderIndex < rows.length; olderIndex += 1) {
      const parsedOlderSnapshot = normalizeBackupSnapshot(rows[olderIndex]?.snapshot);
      if (parsedOlderSnapshot && parsedOlderSnapshot.length > 0) {
        olderSnapshot = parsedOlderSnapshot;
        break;
      }
    }

    if (olderSnapshot) {
      const deletedCount = countDeletedSnapshotEntries(olderSnapshot, candidateSnapshot);
      const risk = assessProgressSnapshotRisk({
        beforeCount: olderSnapshot.length,
        afterCount: candidateSnapshot.length,
        deletedCount,
      });

      if (risk.requiresConfirmation) {
        continue;
      }
    }

    const backupId = Number(candidateRow?.id);
    if (!Number.isFinite(backupId)) {
      continue;
    }

    return {
      id: Math.trunc(backupId),
      backupAt: toIsoTimestamp(candidateRow?.created_at),
      snapshot: candidateSnapshot,
    };
  }

  return null;
}

function entriesEqual(a: BackupEntry, b: BackupEntry): boolean {
  return a.id === b.id
    && a.date === b.date
    && a.content === b.content
    && (a.imageUrl || '') === (b.imageUrl || '')
    && (a.assignee || '') === (b.assignee || '')
    && (a.estimatedNodeCompletion || '') === (b.estimatedNodeCompletion || '');
}

function classifyUpdateAction(before: BackupEntry, after: BackupEntry): NoteAuditAction {
  if ((before.imageUrl || '') && !(after.imageUrl || '')) return 'delete-image';
  return 'update-entry';
}

async function backupCurrentNotes(moldNumber: string): Promise<boolean> {
  if (!dbSql || !db) return false;
  const currentRows = await db.select().from(progressNotes)
    .where(eq(progressNotes.moldNumber, moldNumber))
    .orderBy(desc(progressNotes.createdAt));

  const snapshot: BackupEntry[] = currentRows.map((row) => {
    const decoded = decodeNoteContent(row.content);
    return {
      id: row.id,
      date: row.date,
      content: decoded.content,
      imageUrl: decoded.imageUrl,
      assignee: decoded.assignee,
      estimatedNodeCompletion: decoded.estimatedNodeCompletion,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || ''),
    };
  });

  const latestRows = await dbSql.unsafe(
    'SELECT snapshot FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [moldNumber]
  );
  const latestRaw = latestRows?.[0] as { snapshot?: BackupEntry[] | string } | undefined;
  const latestSnapshot = latestRaw?.snapshot;
  const latestJson = typeof latestSnapshot === 'string'
    ? latestSnapshot
    : JSON.stringify(latestSnapshot || []);
  const currentJson = JSON.stringify(snapshot);
  if (latestJson === currentJson) {
    return false;
  }

  await dbSql.unsafe(
    'INSERT INTO progress_note_backups (mold_number, snapshot) VALUES ($1, $2::jsonb)',
    [moldNumber, currentJson]
  );

  await pruneProgressBackups(moldNumber);

  return true;
}

async function getLatestBackupTimestamp(moldNumber: string): Promise<string | null> {
  if (!dbSql) return null;

  const rows = await dbSql.unsafe(
    'SELECT created_at FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [moldNumber],
  );
  const latest = rows?.[0] as { created_at?: string } | undefined;
  return latest?.created_at || null;
}

async function getLatestRestorableBackup(moldNumber: string): Promise<RestorableBackup | null> {
  if (!dbSql) return null;

  const rows = await dbSql.unsafe(
    `
      SELECT id, snapshot, created_at
      FROM progress_note_backups
      WHERE mold_number = $1
      ORDER BY created_at DESC, id DESC
      LIMIT ${PROGRESS_NOTES_BACKUP_KEEP_LIMIT}
    `,
    [moldNumber],
  );

  return selectLatestRestorableBackup(rows as BackupSnapshotRow[]);
}

type NoteAuditTimestamps = {
  createdAt?: string;
  updatedAt?: string;
};

async function getNoteAuditTimestampsByNoteId(moldNumber: string): Promise<Map<string, NoteAuditTimestamps>> {
  const recovered = new Map<string, NoteAuditTimestamps>();
  if (!dbSql) return recovered;

  try {
    await ensureProgressAuditTable();
    const rows = await dbSql.unsafe(
      `
        SELECT
          note_id,
          MIN(CASE WHEN action = 'create-entry' THEN created_at END) AS created_at,
          MAX(created_at) AS updated_at
        FROM progress_note_audit_logs
        WHERE mold_number = $1
          AND note_id IS NOT NULL
          AND action IN ('create-entry', 'update-entry', 'delete-image')
        GROUP BY note_id
      `,
      [moldNumber],
    );

    for (const row of rows as Array<{ note_id?: string; created_at?: string | Date; updated_at?: string | Date }>) {
      const noteId = String(row?.note_id || '').trim();
      if (!noteId) continue;
      const createdAt = row?.created_at ? toIsoTimestamp(row.created_at) : '';
      const updatedAt = row?.updated_at ? toIsoTimestamp(row.updated_at) : '';
      if (!createdAt && !updatedAt) continue;
      recovered.set(noteId, {
        createdAt: createdAt || undefined,
        updatedAt: updatedAt || createdAt || undefined,
      });
    }
  } catch (err) {
    console.error('recover note audit timestamps failed:', err);
  }

  return recovered;
}

/** GET /api/dashboard/progress-notes/:moldNumber/latest-backup */
export async function getLatestProgressBackup(req: Request, res: Response): Promise<void> {
  if (!dbSql) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }
  try {
    await ensureBackupTable();
    const latest = await getLatestRestorableBackup(moldNumber);
    res.json({ backupAt: latest?.backupAt || null, backupId: latest?.id ?? null });
  } catch (err) {
    console.error('GET latest-backup progress-notes error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** GET /api/dashboard/progress-notes/:moldNumber */
export async function getProgressNotes(req: Request, res: Response): Promise<void> {
  if (!db) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }
  try {
    const includeAuditTimestamps = req.query.includeAuditTimestamps === '1';
    const rows = await db.select().from(progressNotes)
      .where(eq(progressNotes.moldNumber, moldNumber))
      .orderBy(desc(progressNotes.createdAt));
    const noteAuditTimestampsById = includeAuditTimestamps
      ? await getNoteAuditTimestampsByNoteId(moldNumber)
      : new Map<string, NoteAuditTimestamps>();

    res.json(rows.map((row) => {
      const decoded = decodeNoteContent(row.content);
      const persistedCreatedAt = row.createdAt ? toIsoTimestamp(row.createdAt) : '';
      const auditTimestamps = noteAuditTimestampsById.get(row.id);
      const effectiveCreatedAt = auditTimestamps?.createdAt || persistedCreatedAt || undefined;
      const effectiveUpdatedAt = auditTimestamps?.updatedAt || effectiveCreatedAt;

      return {
        ...row,
        content: decoded.content,
        imageUrl: decoded.imageUrl,
        assignee: decoded.assignee,
        estimatedNodeCompletion: decoded.estimatedNodeCompletion,
        createdAt: effectiveCreatedAt,
        updatedAt: effectiveUpdatedAt,
      };
    }));
  } catch (err) {
    console.error('GET progress-notes error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** POST /api/dashboard/progress-notes/:moldNumber — snapshot sync */
export async function saveProgressNotes(req: Request, res: Response): Promise<void> {
  if (!db) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }
  const entries: ProgressNotePayload[] = req.body;
  if (!Array.isArray(entries)) { sendProgressNotesError(res, 400, 'BODY_MUST_BE_ARRAY'); return; }
  try {
    await ensureBackupTable();
    const beforeRows = await db.select().from(progressNotes)
      .where(eq(progressNotes.moldNumber, moldNumber))
      .orderBy(desc(progressNotes.createdAt));
    const existingCreatedAtById = new Map(
      beforeRows.map((row) => [row.id, row.createdAt] as const),
    );
    const normalizedEntries = entries.map((entry) => normalizeEntryPayload(entry));
    const incomingIds = normalizedEntries
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const incomingIdSet = new Set(incomingIds);
    const deletedCount = beforeRows.reduce((count, row) => (
      incomingIdSet.has(row.id) ? count : count + 1
    ), 0);
    const snapshotRisk = assessProgressSnapshotRisk({
      beforeCount: beforeRows.length,
      afterCount: normalizedEntries.length,
      deletedCount,
    });

    if (snapshotRisk.requiresConfirmation && !hasDestructiveSnapshotConfirmation(req)) {
      sendSnapshotDestructiveConfirmationRequired(res, snapshotRisk);
      return;
    }

    const backupCreated = await backupCurrentNotes(moldNumber);
    const latestBackupAt = await getLatestBackupTimestamp(moldNumber);

    await db.transaction(async (tx) => {
      if (incomingIds.length === 0) {
        await tx.delete(progressNotes).where(eq(progressNotes.moldNumber, moldNumber));
      } else {
        await tx.delete(progressNotes).where(
          and(eq(progressNotes.moldNumber, moldNumber), notInArray(progressNotes.id, incomingIds)),
        );
      }

      for (const entry of normalizedEntries) {
        const row = buildProgressNoteRow(
          moldNumber,
          entry,
          existingCreatedAtById.get(entry.id) ?? toDateObject(entry.createdAt),
        );

        await tx.insert(progressNotes).values(row).onConflictDoUpdate({
          target: progressNotes.id,
          set: {
            moldNumber: row.moldNumber,
            date: row.date,
            content: row.content,
          },
        });
      }
    });

    const operator = getOperator(req);
    const ipAddress = getClientIp(req);
    const beforeMap = new Map<string, BackupEntry>();
    const afterMap = new Map<string, BackupEntry>();

    beforeRows.forEach((row) => {
      const decoded = decodeNoteContent(row.content);
      const normalized = normalizeEntryPayload({
        id: row.id,
        date: row.date,
        content: decoded.content,
        imageUrl: decoded.imageUrl,
      });
      beforeMap.set(normalized.id, normalized);
    });

    normalizedEntries.forEach((entry) => {
      afterMap.set(entry.id, entry);
    });

    for (const [id, afterEntry] of Array.from(afterMap.entries())) {
      const beforeEntry = beforeMap.get(id);
      if (!beforeEntry) {
        await writeProgressAuditLog({
          moldNumber,
          noteId: id,
          action: 'create-entry',
          operator,
          ipAddress,
          oldPayload: null,
          newPayload: afterEntry,
        });
        continue;
      }
      if (!entriesEqual(beforeEntry, afterEntry)) {
        await writeProgressAuditLog({
          moldNumber,
          noteId: id,
          action: classifyUpdateAction(beforeEntry, afterEntry),
          operator,
          ipAddress,
          oldPayload: beforeEntry,
          newPayload: afterEntry,
        });
      }
    }

    for (const [id, beforeEntry] of Array.from(beforeMap.entries())) {
      if (afterMap.has(id)) continue;
      await writeProgressAuditLog({
        moldNumber,
        noteId: id,
        action: 'delete-entry',
        operator,
        ipAddress,
        oldPayload: beforeEntry,
        newPayload: null,
      });
    }

    await pruneProgressAuditLogs();
    res.json({ success: true, count: entries.length, backupCreated, backupAt: latestBackupAt });
  } catch (err) {
    console.error('POST progress-notes error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** POST /api/dashboard/progress-notes/:moldNumber/entry — single entry upsert */
export async function upsertProgressNote(req: Request, res: Response): Promise<void> {
  if (!db) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }

  const entry = normalizeEntryPayload(
    isProgressNotePayload(req.body)
      ? req.body
      : { id: '', date: '', content: '' },
  );
  if (!entry.id) { sendProgressNotesError(res, 400, 'NOTE_ID_REQUIRED'); return; }

  try {
    await ensureBackupTable();
    const backupCreated = await backupCurrentNotes(moldNumber);
    const latestBackupAt = await getLatestBackupTimestamp(moldNumber);

    const beforeRows = await db.select().from(progressNotes).where(
      and(eq(progressNotes.id, entry.id), eq(progressNotes.moldNumber, moldNumber)),
    ).limit(1);
    const before = beforeRows[0];
    const row = buildProgressNoteRow(
      moldNumber,
      entry,
      before?.createdAt ?? toDateObject(entry.createdAt),
    );

    await db.insert(progressNotes).values(row).onConflictDoUpdate({
      target: progressNotes.id,
      set: {
        moldNumber: row.moldNumber,
        date: row.date,
        content: row.content,
      },
    });

    const operator = getOperator(req);
    const ipAddress = getClientIp(req);

    if (!before) {
      await writeProgressAuditLog({
        moldNumber,
        noteId: entry.id,
        action: 'create-entry',
        operator,
        ipAddress,
        oldPayload: null,
        newPayload: entry,
      });
    } else {
      const decoded = decodeNoteContent(before.content);
      const beforeEntry = normalizeEntryPayload({
        id: before.id,
        date: before.date,
        content: decoded.content,
        imageUrl: decoded.imageUrl,
        assignee: decoded.assignee,
        estimatedNodeCompletion: decoded.estimatedNodeCompletion,
        createdAt: before.createdAt instanceof Date ? before.createdAt.toISOString() : String(before.createdAt || ''),
      });

      if (!entriesEqual(beforeEntry, entry)) {
        await writeProgressAuditLog({
          moldNumber,
          noteId: entry.id,
          action: classifyUpdateAction(beforeEntry, entry),
          operator,
          ipAddress,
          oldPayload: beforeEntry,
          newPayload: entry,
        });
      }
    }

    await pruneProgressAuditLogs();
    res.json({ success: true, backupCreated, backupAt: latestBackupAt, entry });
  } catch (err) {
    console.error('POST upsert progress-note error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** POST /api/dashboard/progress-notes/:moldNumber/create-backup */
export async function createProgressBackup(req: Request, res: Response): Promise<void> {
  if (!dbSql) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }
  try {
    await ensureBackupTable();
    const created = await backupCurrentNotes(moldNumber);
    const rows = await dbSql.unsafe(
      'SELECT created_at FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC LIMIT 1',
      [moldNumber]
    );
    const latest = rows?.[0] as { created_at?: string } | undefined;
    res.json({ success: true, created, backupAt: latest?.created_at ? toIsoTimestamp(latest.created_at) : null });
  } catch (err) {
    console.error('POST create-backup progress-notes error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** POST /api/dashboard/progress-notes/:moldNumber/restore-latest */
export async function restoreLatestProgressNotes(req: Request, res: Response): Promise<void> {
  if (!db || !dbSql) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }

  try {
    await ensureBackupTable();
    const backup = await getLatestRestorableBackup(moldNumber);
    if (!backup) {
      sendProgressNotesError(res, 404, 'BACKUP_NOT_FOUND');
      return;
    }

    const normalizedSnapshot = backup.snapshot.map((entry) => normalizeEntryPayload(entry));
    const incomingIds = normalizedSnapshot
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const currentRows = await db.select().from(progressNotes)
      .where(eq(progressNotes.moldNumber, moldNumber))
      .orderBy(desc(progressNotes.createdAt));
    const existingCreatedAtById = new Map(
      currentRows.map((row) => [row.id, row.createdAt] as const),
    );

    await db.transaction(async (tx) => {
      if (incomingIds.length === 0) {
        await tx.delete(progressNotes).where(eq(progressNotes.moldNumber, moldNumber));
      } else {
        await tx.delete(progressNotes).where(
          and(eq(progressNotes.moldNumber, moldNumber), notInArray(progressNotes.id, incomingIds)),
        );
      }

      for (const entry of normalizedSnapshot) {
        const row = buildProgressNoteRow(
          moldNumber,
          entry,
          existingCreatedAtById.get(entry.id) ?? toDateObject(entry.createdAt),
        );

        await tx.insert(progressNotes).values(row).onConflictDoUpdate({
          target: progressNotes.id,
          set: {
            moldNumber: row.moldNumber,
            date: row.date,
            content: row.content,
          },
        });
      }
    });

    await writeProgressAuditLog({
      moldNumber,
      action: 'restore-backup',
      operator: getOperator(req),
      ipAddress: getClientIp(req),
      oldPayload: null,
      newPayload: { restoredCount: normalizedSnapshot.length, backupAt: backup.backupAt, backupId: backup.id },
    });

    await pruneProgressAuditLogs();
    res.json({ success: true, restoredCount: normalizedSnapshot.length, backupAt: backup.backupAt, backupId: backup.id });
  } catch (err) {
    console.error('POST restore-latest progress-notes error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** DELETE /api/dashboard/progress-notes/:moldNumber/:noteId */
export async function deleteProgressNote(req: Request, res: Response): Promise<void> {
  if (!db) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber, noteId } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }
  if (!noteId) { sendProgressNotesError(res, 400, 'NOTE_ID_REQUIRED'); return; }
  try {
    await ensureBackupTable();
    const backupCreated = await backupCurrentNotes(moldNumber);
    const latestBackupAt = await getLatestBackupTimestamp(moldNumber);

    const beforeRows = await db.select().from(progressNotes).where(
      and(eq(progressNotes.id, noteId), eq(progressNotes.moldNumber, moldNumber))
    ).limit(1);

    await db.delete(progressNotes).where(
      and(eq(progressNotes.id, noteId), eq(progressNotes.moldNumber, moldNumber))
    );

    const before = beforeRows[0];
    if (before) {
      const decoded = decodeNoteContent(before.content);
      await writeProgressAuditLog({
        moldNumber,
        noteId,
        action: 'delete-entry',
        operator: getOperator(req),
        ipAddress: getClientIp(req),
        oldPayload: {
          id: before.id,
          date: before.date,
          content: decoded.content,
          imageUrl: decoded.imageUrl,
        },
        newPayload: null,
      });
    }

    await pruneProgressAuditLogs();
    res.json({ success: true, backupCreated, backupAt: latestBackupAt });
  } catch (err) {
    console.error('DELETE progress-note error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** GET /api/dashboard/progress-notes/:moldNumber/audit */
export async function getProgressNoteAuditLogs(req: Request, res: Response): Promise<void> {
  if (!dbSql) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber } = req.params;
  if (!moldNumber) { sendProgressNotesError(res, 400, 'MOLD_NUMBER_REQUIRED'); return; }

  const limit = readAuditLogLimit(req.query.limit);
  try {
    await ensureProgressAuditTable();
    const rows = await dbSql.unsafe(
      `
        SELECT id, mold_number, note_id, action, operator, ip_address, old_payload, new_payload, created_at
        FROM progress_note_audit_logs
        WHERE mold_number = $1
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `,
      [moldNumber],
    );
    res.json(
      (rows as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        created_at: row.created_at ? toIsoTimestamp(row.created_at) : row.created_at,
      })),
    );
  } catch (err) {
    console.error('GET progress-note-audit error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}
