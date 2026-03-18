/**
 * Progress Notes API — 项目推进细节 CRUD
 * 
 * GET    /api/dashboard/progress-notes/:moldNumber — 获取某模具的所有推进记录
 * GET    /api/dashboard/progress-notes/:moldNumber/latest-backup — 获取最近一次备份时间
 * POST   /api/dashboard/progress-notes/:moldNumber — 保存（全量替换）某模具的推进记录
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
  | 'MOLD_NUMBER_REQUIRED';

const BACKUP_KEEP_LIMIT_PER_MOLD = 30;
const PROGRESS_NOTES_ERROR_MESSAGES: Record<ProgressNotesErrorCode, string> = {
  BACKUP_NOT_FOUND: 'latest backup not found',
  BODY_MUST_BE_ARRAY: 'request body must be an array',
  DATABASE_NOT_CONFIGURED: 'database not configured',
  INTERNAL_ERROR: 'internal server error',
  MOLD_NUMBER_REQUIRED: 'moldNumber required',
};

let progressBackupTableReady: Promise<void> | null = null;
let progressAuditTableReady: Promise<void> | null = null;

function sendProgressNotesError(res: Response, status: number, code: ProgressNotesErrorCode): void {
  res.status(status).json({
    error: PROGRESS_NOTES_ERROR_MESSAGES[code],
    code,
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
      JSON.stringify(params.oldPayload ?? null),
      JSON.stringify(params.newPayload ?? null),
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
    'SELECT snapshot FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC LIMIT 1',
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

  await dbSql.unsafe(
    `
      DELETE FROM progress_note_backups
      WHERE mold_number = $1
        AND id NOT IN (
          SELECT id FROM progress_note_backups
          WHERE mold_number = $1
          ORDER BY created_at DESC, id DESC
          LIMIT ${BACKUP_KEEP_LIMIT_PER_MOLD}
        )
    `,
    [moldNumber]
  );

  return true;
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
    const rows = await dbSql.unsafe(
      'SELECT created_at FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC LIMIT 1',
      [moldNumber]
    );
    const latest = rows?.[0] as { created_at?: string } | undefined;
    res.json({ backupAt: latest?.created_at ? toIsoTimestamp(latest.created_at) : null });
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

    const backupCreated = await backupCurrentNotes(moldNumber);
    const backupRows = await dbSql?.unsafe(
      'SELECT created_at FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC LIMIT 1',
      [moldNumber],
    );
    const latestBackupAt = (backupRows?.[0] as { created_at?: string } | undefined)?.created_at || null;

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

    res.json({ success: true, count: entries.length, backupCreated, backupAt: latestBackupAt });
  } catch (err) {
    console.error('POST progress-notes error:', err);
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
    const backups = await dbSql.unsafe(
      'SELECT snapshot, created_at FROM progress_note_backups WHERE mold_number = $1 ORDER BY created_at DESC LIMIT 1',
      [moldNumber]
    );

    if (!backups.length) {
      sendProgressNotesError(res, 404, 'BACKUP_NOT_FOUND');
      return;
    }

    const latest = backups[0] as unknown as { snapshot: BackupEntry[] | string; created_at: string };
    const snapshot: BackupEntry[] = Array.isArray(latest.snapshot)
      ? latest.snapshot
      : JSON.parse(String(latest.snapshot || '[]'));
    const normalizedSnapshot = snapshot.map((entry) => normalizeEntryPayload(entry));
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
      newPayload: { restoredCount: snapshot.length, backupAt: latest.created_at },
    });

    res.json({ success: true, restoredCount: snapshot.length, backupAt: toIsoTimestamp(latest.created_at) });
  } catch (err) {
    console.error('POST restore-latest progress-notes error:', err);
    sendProgressNotesError(res, 500, 'INTERNAL_ERROR');
  }
}

/** DELETE /api/dashboard/progress-notes/:moldNumber/:noteId */
export async function deleteProgressNote(req: Request, res: Response): Promise<void> {
  if (!db) { sendProgressNotesError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const { moldNumber, noteId } = req.params;
  try {
    await ensureBackupTable();
    await backupCurrentNotes(moldNumber);

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

    res.json({ success: true });
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
