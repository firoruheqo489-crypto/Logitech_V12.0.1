import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';
import { deleteAssetsFromOssUrls } from '../lib/oss.js';

type IssueStatus = 'draft' | 'submitted';

type IssueWritePayload = {
  id: string;
  projectId: string;
  types: string[];
  date: string | null;
  process: string;
  modules: Record<string, unknown>;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
};

type IssueDbRow = {
  id: string;
  project_id: string;
  types: string[] | null;
  date: string | null;
  process: string | null;
  modules: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type IssueRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'INVALID_ISSUE_PAYLOAD'
  | 'ISSUE_CREATE_FAILED'
  | 'ISSUE_DELETE_FAILED'
  | 'ISSUE_ID_REQUIRED'
  | 'ISSUE_NOT_FOUND'
  | 'ISSUE_UPDATE_FAILED'
  | 'ISSUES_LOAD_FAILED';

const ISSUES_ROUTE_ERROR_MESSAGES: Record<IssueRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  INVALID_ISSUE_PAYLOAD: 'Invalid issue payload',
  ISSUE_CREATE_FAILED: 'Failed to create issue',
  ISSUE_DELETE_FAILED: 'Failed to delete issue',
  ISSUE_ID_REQUIRED: 'issue id is required',
  ISSUE_NOT_FOUND: 'Issue not found',
  ISSUE_UPDATE_FAILED: 'Failed to update issue',
  ISSUES_LOAD_FAILED: 'Failed to load issues',
};

let issuesTableReady: Promise<void> | null = null;

function sendIssuesRouteError(
  res: Response,
  status: number,
  code: IssueRouteErrorCode,
): void {
  res.status(status).json({
    error: ISSUES_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function readTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeIssueTypes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const item of value) {
    const nextType = readTrimmedString(item, 64);
    if (nextType) {
      deduped.add(nextType);
    }
  }

  return [...deduped];
}

function normalizeIssueModules(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeIssueStatus(value: unknown): IssueStatus {
  return value === 'submitted' ? 'submitted' : 'draft';
}

function normalizeIssuePayload(
  body: unknown,
  fallbackId?: string,
): IssueWritePayload | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const id = readTrimmedString(fallbackId ?? record.id, 80);
  const projectId = readTrimmedString(record.project_id, 80);

  if (!id || !projectId) {
    return null;
  }

  return {
    id,
    projectId,
    types: normalizeIssueTypes(record.types),
    date: readTrimmedString(record.date, 32),
    process: readTrimmedString(record.process, 128) ?? '',
    modules: normalizeIssueModules(record.modules),
    status: normalizeIssueStatus(record.status),
    createdAt: readTrimmedString(record.created_at, 64) ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function extractImageUrlsFromModules(modules: unknown): string[] {
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) {
    return [];
  }

  const result = new Set<string>();
  for (const moduleData of Object.values(modules as Record<string, unknown>)) {
    if (!moduleData || typeof moduleData !== 'object' || Array.isArray(moduleData)) {
      continue;
    }

    const images = (moduleData as { images?: unknown }).images;
    if (!Array.isArray(images)) {
      continue;
    }

    for (const image of images) {
      if (!image || typeof image !== 'object' || Array.isArray(image)) {
        continue;
      }
      const preview = readTrimmedString((image as { preview?: unknown }).preview, 4096);
      if (preview) {
        result.add(preview);
      }
    }
  }

  return [...result];
}

export function ensureIssuesTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!issuesTableReady) {
    issuesTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS issues (
          id VARCHAR(80) PRIMARY KEY,
          project_id VARCHAR(80) NOT NULL,
          types TEXT[] NOT NULL DEFAULT '{}',
          date VARCHAR(32),
          process VARCHAR(128) NOT NULL DEFAULT '',
          modules JSONB NOT NULL DEFAULT '{}'::jsonb,
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS project_id VARCHAR(80)
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS types TEXT[] DEFAULT '{}'
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS date VARCHAR(32)
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS process VARCHAR(128) DEFAULT ''
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}'::jsonb
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await dbSql.unsafe(`
        ALTER TABLE issues
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS issues_project_id_idx ON issues (project_id)
      `);
    })();
  }
  return issuesTableReady;
}

export async function listIssues(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendIssuesRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const projectId = readTrimmedString(req.query.projectId, 80);

  try {
    await ensureIssuesTable();
    const rows = (projectId
      ? await dbSql.unsafe(
          `
            SELECT id, project_id, types, date, process, modules, status, created_at, updated_at
            FROM issues
            WHERE project_id = $1
            ORDER BY created_at DESC
          `,
          [projectId],
        )
      : await dbSql.unsafe(`
          SELECT id, project_id, types, date, process, modules, status, created_at, updated_at
          FROM issues
          ORDER BY created_at DESC
        `)) as IssueDbRow[];

    res.status(200).json(rows);
  } catch (error) {
    console.error('GET /api/issues error:', error);
    sendIssuesRouteError(res, 500, 'ISSUES_LOAD_FAILED');
  }
}

export async function createIssue(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendIssuesRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const payload = normalizeIssuePayload(req.body);
  if (!payload) {
    sendIssuesRouteError(res, 400, 'INVALID_ISSUE_PAYLOAD');
    return;
  }

  try {
    await ensureIssuesTable();

    await dbSql.unsafe(
      `
        INSERT INTO issues (
          id,
          project_id,
          types,
          date,
          process,
          modules,
          status,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3::text[],
          $4,
          $5,
          $6::jsonb,
          $7,
          $8,
          $9
        )
      `,
      [
        payload.id,
        payload.projectId,
        payload.types,
        payload.date,
        payload.process,
        JSON.stringify(payload.modules),
        payload.status,
        payload.createdAt,
        payload.updatedAt,
      ],
    );

    res.status(201).json({ success: true, id: payload.id });
  } catch (error) {
    console.error('POST /api/issues error:', error);
    sendIssuesRouteError(res, 500, 'ISSUE_CREATE_FAILED');
  }
}

export async function updateIssue(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendIssuesRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const issueId = readTrimmedString(req.params.id, 80);
  if (!issueId) {
    sendIssuesRouteError(res, 400, 'ISSUE_ID_REQUIRED');
    return;
  }

  const payload = normalizeIssuePayload(req.body, issueId);
  if (!payload) {
    sendIssuesRouteError(res, 400, 'INVALID_ISSUE_PAYLOAD');
    return;
  }

  try {
    await ensureIssuesTable();

    const rows = await dbSql.unsafe(
      `
        UPDATE issues
        SET
          project_id = $1,
          types = $2::text[],
          date = $3,
          process = $4,
          modules = $5::jsonb,
          status = $6,
          updated_at = $7
        WHERE id = $8
        RETURNING id
      `,
      [
        payload.projectId,
        payload.types,
        payload.date,
        payload.process,
        JSON.stringify(payload.modules),
        payload.status,
        payload.updatedAt,
        issueId,
      ],
    ) as Array<{ id: string }>;

    if (rows.length === 0) {
      sendIssuesRouteError(res, 404, 'ISSUE_NOT_FOUND');
      return;
    }

    res.status(200).json({ success: true, id: issueId });
  } catch (error) {
    console.error('PATCH /api/issues/:id error:', error);
    sendIssuesRouteError(res, 500, 'ISSUE_UPDATE_FAILED');
  }
}

export async function deleteIssue(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendIssuesRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const issueId = readTrimmedString(req.params.id, 80);
  if (!issueId) {
    sendIssuesRouteError(res, 400, 'ISSUE_ID_REQUIRED');
    return;
  }

  try {
    await ensureIssuesTable();

    const rows = (await dbSql.unsafe(
      `
        DELETE FROM issues
        WHERE id = $1
        RETURNING modules
      `,
      [issueId],
    )) as Array<{ modules: Record<string, unknown> | null }>;

    if (rows.length === 0) {
      sendIssuesRouteError(res, 404, 'ISSUE_NOT_FOUND');
      return;
    }

    const requestModules =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as { modules?: unknown }).modules
        : undefined;
    const imageUrls = extractImageUrlsFromModules(requestModules ?? rows[0].modules);
    if (imageUrls.length > 0) {
      try {
        await deleteAssetsFromOssUrls(imageUrls);
      } catch (error) {
        console.warn(`[issues-assets] issue:${issueId} cleanup failed:`, error);
      }
    }

    res.status(200).json({ success: true, id: issueId });
  } catch (error) {
    console.error('DELETE /api/issues/:id error:', error);
    sendIssuesRouteError(res, 500, 'ISSUE_DELETE_FAILED');
  }
}
