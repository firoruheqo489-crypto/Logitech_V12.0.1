import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

type SourceName =
  | 'dashboard_project_assets'
  | 'projects'
  | 'evidence'
  | 'issues'
  | 'progress_notes';

type MigrationOptions = {
  apply: boolean;
  limit: number | null;
  timeoutMs: number;
  reportPath: string;
  sources: Set<SourceName>;
  uploadBaseUrl: string;
  uploadApiKey: string;
};

type UrlMapping = {
  oldUrl: string;
  newUrl: string;
  source: SourceName;
  rowKey: string;
  objectKey?: string;
};

type FailedUrlMigration = {
  oldUrl: string;
  source: SourceName;
  rowKey: string;
  error: string;
};

type RowUpdateResult = {
  source: SourceName;
  rowKey: string;
  updated: boolean;
  reason?: string;
};

type DashboardAssetCandidate = {
  kind: 'dashboard_project_assets';
  source: SourceName;
  rowKey: string;
  moldNumber: string;
  slotType: string;
  oldUrl: string;
};

type ProjectCandidate = {
  kind: 'projects';
  source: SourceName;
  rowKey: string;
  projectId: string;
  oldUrl: string;
};

type EvidenceCandidate = {
  kind: 'evidence';
  source: SourceName;
  rowKey: string;
  evidenceId: string;
  oldUrl: string;
};

type IssueCandidate = {
  kind: 'issues';
  source: SourceName;
  rowKey: string;
  issueId: string;
  modules: unknown;
  legacyUrls: string[];
};

type ProgressNoteCandidate = {
  kind: 'progress_notes';
  source: SourceName;
  rowKey: string;
  noteId: string;
  moldNumber: string;
  content: string;
  legacyUrls: string[];
};

type Candidate =
  | DashboardAssetCandidate
  | ProjectCandidate
  | EvidenceCandidate
  | IssueCandidate
  | ProgressNoteCandidate;

type UploadAssetParams = {
  fileBuffer: Buffer;
  filename: string;
  mimeType?: string;
  category?: string;
  entityId?: string;
  slot?: string;
};

type UploadAssetResult = {
  url: string;
  objectKey: string;
  mimeType: string;
  size: number;
};

type UploadAssetFn = (params: UploadAssetParams) => Promise<UploadAssetResult>;
type BuildAssetProxyUrlFn = (objectKey: string) => string;

type SqlClient = {
  unsafe: (query: string, params?: unknown[]) => Promise<unknown[]>;
};

const ALL_SOURCES: SourceName[] = [
  'dashboard_project_assets',
  'projects',
  'evidence',
  'issues',
  'progress_notes',
];

const LEGACY_URL_HINT = 'supabase.co';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'text/plain': '.txt',
};

function printUsage(): void {
  console.log(`
Legacy Supabase Asset Migration ETL

Usage:
  pnpm tsx scripts/migrate-legacy-supabase-assets.ts [options]

Options:
  --apply                       Execute upload + database update (default is dry-run)
  --limit <n>                   Limit unique legacy URLs to process
  --sources <csv>               Comma-separated sources
                                (${ALL_SOURCES.join(',')})
  --timeout-ms <n>              Download timeout per asset in ms (default 30000)
  --report <path>               JSON report output path
  --upload-base-url <url>       Backend base URL for /api/uploads/assets fallback
                                (default http://120.27.153.140:3000)
  --upload-api-key <key>        API key for backend upload fallback
                                (default from API_SECRET_KEY env)
  --help                        Show this help

Examples:
  pnpm tsx scripts/migrate-legacy-supabase-assets.ts
  pnpm tsx scripts/migrate-legacy-supabase-assets.ts --sources dashboard_project_assets,projects
  pnpm tsx scripts/migrate-legacy-supabase-assets.ts --upload-base-url http://120.27.153.140:3000
  pnpm tsx scripts/migrate-legacy-supabase-assets.ts --apply --limit 10
`);
}

function timestampForFile(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function parseArgs(argv: string[]): MigrationOptions {
  let apply = false;
  let limit: number | null = null;
  let timeoutMs = 30_000;
  let reportPath = path.resolve(
    process.cwd(),
    'scripts',
    'out',
    `legacy-supabase-assets-report-${timestampForFile()}.json`,
  );
  let sources = new Set<SourceName>(ALL_SOURCES);
  let uploadBaseUrl = 'http://120.27.153.140:3000';
  let uploadApiKey = process.env.API_SECRET_KEY?.trim() || '';

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--apply') {
      apply = true;
      continue;
    }
    if (token === '--limit') {
      const raw = argv[i + 1];
      if (!raw) throw new Error('--limit requires a number');
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--limit must be a positive integer');
      }
      limit = parsed;
      i += 1;
      continue;
    }
    if (token === '--timeout-ms') {
      const raw = argv[i + 1];
      if (!raw) throw new Error('--timeout-ms requires a number');
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--timeout-ms must be a positive integer');
      }
      timeoutMs = parsed;
      i += 1;
      continue;
    }
    if (token === '--report') {
      const raw = argv[i + 1];
      if (!raw) throw new Error('--report requires a file path');
      reportPath = path.resolve(process.cwd(), raw);
      i += 1;
      continue;
    }
    if (token === '--sources') {
      const raw = argv[i + 1];
      if (!raw) throw new Error('--sources requires a csv value');
      const parsed = raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (parsed.length === 0) {
        throw new Error('--sources must include at least one value');
      }
      const nextSources = new Set<SourceName>();
      for (const value of parsed) {
        if (!ALL_SOURCES.includes(value as SourceName)) {
          throw new Error(`unknown source: ${value}`);
        }
        nextSources.add(value as SourceName);
      }
      sources = nextSources;
      i += 1;
      continue;
    }
    if (token === '--upload-base-url') {
      const raw = argv[i + 1];
      if (!raw) throw new Error('--upload-base-url requires a URL');
      uploadBaseUrl = raw.trim().replace(/\/+$/, '');
      i += 1;
      continue;
    }
    if (token === '--upload-api-key') {
      const raw = argv[i + 1];
      if (!raw) throw new Error('--upload-api-key requires a key value');
      uploadApiKey = raw.trim();
      i += 1;
      continue;
    }

    throw new Error(`unknown argument: ${token}`);
  }

  return { apply, limit, timeoutMs, reportPath, sources, uploadBaseUrl, uploadApiKey };
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function toPortablePath(targetPath: string): string {
  const relativePath = path.relative(process.cwd(), targetPath);
  const normalized = relativePath || path.basename(targetPath);
  return normalized.split(path.sep).join('/');
}

function isLegacyAssetUrl(value: string): boolean {
  if (!value || !value.includes(LEGACY_URL_HINT)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.hostname.includes('supabase.co') && parsed.pathname.includes('/storage');
  } catch {
    return false;
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectLegacyUrlsFromValue(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    if (isLegacyAssetUrl(value.trim())) {
      found.add(value.trim());
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLegacyUrlsFromValue(item, found);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectLegacyUrlsFromValue(item, found);
    }
  }
}

function replaceLegacyUrlsDeep(value: unknown, urlMap: Map<string, string>): { next: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const mapped = urlMap.get(value.trim());
    if (!mapped) {
      return { next: value, changed: false };
    }
    return { next: mapped, changed: true };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const nextArray = value.map((item) => {
      const replaced = replaceLegacyUrlsDeep(item, urlMap);
      if (replaced.changed) changed = true;
      return replaced.next;
    });
    return { next: nextArray, changed };
  }

  if (!value || typeof value !== 'object') {
    return { next: value, changed: false };
  }

  let changed = false;
  const nextRecord: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const replaced = replaceLegacyUrlsDeep(item, urlMap);
    if (replaced.changed) changed = true;
    nextRecord[key] = replaced.next;
  }
  return { next: nextRecord, changed };
}

async function tableExists(sql: SqlClient, tableName: string): Promise<boolean> {
  const rows = await sql.unsafe(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [tableName],
  );
  return rows.length > 0;
}

async function scanDashboardProjectAssets(sql: SqlClient): Promise<DashboardAssetCandidate[]> {
  if (!(await tableExists(sql, 'dashboard_project_assets'))) return [];
  const rows = await sql.unsafe(
    `
      SELECT mold_number, slot_type, image_url
      FROM dashboard_project_assets
      WHERE image_url ILIKE '%supabase.co%'
    `,
  ) as Array<{ mold_number: string; slot_type: string; image_url: string }>;

  return rows
    .filter((row) => isLegacyAssetUrl(String(row.image_url || '').trim()))
    .map((row) => ({
      kind: 'dashboard_project_assets',
      source: 'dashboard_project_assets',
      rowKey: `${row.mold_number}:${row.slot_type}`,
      moldNumber: row.mold_number,
      slotType: row.slot_type,
      oldUrl: String(row.image_url).trim(),
    }));
}

async function scanProjects(sql: SqlClient): Promise<ProjectCandidate[]> {
  if (!(await tableExists(sql, 'projects'))) return [];
  const rows = await sql.unsafe(
    `
      SELECT id, product_image_url
      FROM projects
      WHERE product_image_url IS NOT NULL
        AND product_image_url ILIKE '%supabase.co%'
    `,
  ) as Array<{ id: string; product_image_url: string | null }>;

  return rows
    .map((row) => ({ id: row.id, url: String(row.product_image_url || '').trim() }))
    .filter((row) => isLegacyAssetUrl(row.url))
    .map((row) => ({
      kind: 'projects',
      source: 'projects',
      rowKey: row.id,
      projectId: row.id,
      oldUrl: row.url,
    }));
}

async function scanEvidence(sql: SqlClient): Promise<EvidenceCandidate[]> {
  if (!(await tableExists(sql, 'evidence'))) return [];
  const rows = await sql.unsafe(
    `
      SELECT id, url
      FROM evidence
      WHERE url ILIKE '%supabase.co%'
    `,
  ) as Array<{ id: string; url: string }>;

  return rows
    .map((row) => ({ id: row.id, url: String(row.url || '').trim() }))
    .filter((row) => isLegacyAssetUrl(row.url))
    .map((row) => ({
      kind: 'evidence',
      source: 'evidence',
      rowKey: row.id,
      evidenceId: row.id,
      oldUrl: row.url,
    }));
}

async function scanIssues(sql: SqlClient): Promise<IssueCandidate[]> {
  if (!(await tableExists(sql, 'issues'))) return [];
  const rows = await sql.unsafe(
    `
      SELECT id, modules
      FROM issues
      WHERE modules::text ILIKE '%supabase.co%'
    `,
  ) as Array<{ id: string; modules: unknown }>;

  const candidates: IssueCandidate[] = [];
  for (const row of rows) {
    let modules = row.modules;
    if (typeof modules === 'string') {
      modules = tryParseJson(modules);
    }
    const found = new Set<string>();
    collectLegacyUrlsFromValue(modules, found);
    if (found.size === 0) continue;
    candidates.push({
      kind: 'issues',
      source: 'issues',
      rowKey: row.id,
      issueId: row.id,
      modules,
      legacyUrls: [...found],
    });
  }

  return candidates;
}

async function scanProgressNotes(sql: SqlClient): Promise<ProgressNoteCandidate[]> {
  if (!(await tableExists(sql, 'progress_notes'))) return [];
  const rows = await sql.unsafe(
    `
      SELECT id, mold_number, content
      FROM progress_notes
      WHERE content ILIKE '%supabase.co%'
    `,
  ) as Array<{ id: string; mold_number: string; content: string }>;

  const candidates: ProgressNoteCandidate[] = [];
  for (const row of rows) {
    const rawContent = String(row.content || '');
    const parsed = tryParseJson(rawContent);
    const sourceValue = parsed ?? rawContent;
    const found = new Set<string>();
    collectLegacyUrlsFromValue(sourceValue, found);
    if (found.size === 0) continue;
    candidates.push({
      kind: 'progress_notes',
      source: 'progress_notes',
      rowKey: `${row.mold_number}:${row.id}`,
      noteId: row.id,
      moldNumber: row.mold_number,
      content: rawContent,
      legacyUrls: [...found],
    });
  }

  return candidates;
}

function candidateUrls(candidate: Candidate): string[] {
  switch (candidate.kind) {
    case 'dashboard_project_assets':
    case 'projects':
    case 'evidence':
      return [candidate.oldUrl];
    case 'issues':
    case 'progress_notes':
      return candidate.legacyUrls;
    default:
      return [];
  }
}

function pickFirstOccurrence(url: string, candidates: Candidate[]): Candidate | null {
  return candidates.find((candidate) => candidateUrls(candidate).includes(url)) ?? null;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80);
}

function inferFileExtensionFromMime(mimeType: string | null): string {
  if (!mimeType) return '';
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  return MIME_EXTENSION_MAP[normalized] || '';
}

function inferFilename(url: string, mimeType: string | null): string {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname || '');
    let base = path.posix.basename(pathname);
    if (!base || base === '/' || base === '.') {
      base = `legacy-asset-${Date.now()}`;
    }
    base = sanitizeSegment(base) || `legacy-asset-${Date.now()}`;
    const ext = path.posix.extname(base);
    if (ext) return base;
    const inferredExt = inferFileExtensionFromMime(mimeType);
    return `${base}${inferredExt}`;
  } catch {
    const ext = inferFileExtensionFromMime(mimeType);
    return `legacy-asset-${Date.now()}${ext}`;
  }
}

function buildUploadContext(candidate: Candidate): { category: string; entityId: string; slot: string } {
  switch (candidate.kind) {
    case 'dashboard_project_assets':
      return {
        category: 'legacy-dashboard-assets',
        entityId: sanitizeSegment(candidate.moldNumber) || 'unknown-mold',
        slot: sanitizeSegment(candidate.slotType) || 'asset',
      };
    case 'projects':
      return {
        category: 'legacy-project-images',
        entityId: sanitizeSegment(candidate.projectId) || 'unknown-project',
        slot: 'product-image',
      };
    case 'evidence':
      return {
        category: 'legacy-evidence',
        entityId: sanitizeSegment(candidate.evidenceId) || 'unknown-evidence',
        slot: 'evidence',
      };
    case 'issues':
      return {
        category: 'legacy-issues',
        entityId: sanitizeSegment(candidate.issueId) || 'unknown-issue',
        slot: 'module-image',
      };
    case 'progress_notes':
      return {
        category: 'legacy-progress-notes',
        entityId: sanitizeSegment(candidate.noteId) || 'unknown-note',
        slot: 'note-image',
      };
    default:
      return {
        category: 'legacy-migration',
        entityId: 'unknown',
        slot: 'default',
      };
  }
}

function inferExtensionFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const ext = path.posix.extname(parsed.pathname || '').toLowerCase();
    if (ext && /^[.][a-z0-9]+$/.test(ext)) {
      return ext;
    }
  } catch {
    return '';
  }
  return '';
}

function buildDryRunPreviewObjectKey(url: string, candidate: Candidate): string {
  const context = buildUploadContext(candidate);
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 20);
  const extension = inferExtensionFromUrl(url);
  const suffix = extension || '.bin';
  return [
    'dry-run-preview',
    sanitizeSegment(context.category) || 'legacy',
    sanitizeSegment(context.entityId) || 'unknown',
    sanitizeSegment(context.slot) || 'asset',
    `${hash}${suffix}`,
  ].join('/');
}

async function downloadAsset(url: string, timeoutMs: number): Promise<{ buffer: Buffer; mimeType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type');
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } finally {
    clearTimeout(timer);
  }
}

async function applyRowUpdate(sql: SqlClient, candidate: Candidate, urlMap: Map<string, string>): Promise<RowUpdateResult> {
  const urls = candidateUrls(candidate);
  const missing = urls.filter((url) => !urlMap.has(url));
  if (missing.length > 0) {
    return {
      source: candidate.source,
      rowKey: candidate.rowKey,
      updated: false,
      reason: `missing migrated mapping for ${missing.length} URL(s)`,
    };
  }

  switch (candidate.kind) {
    case 'dashboard_project_assets': {
      const nextUrl = urlMap.get(candidate.oldUrl);
      if (!nextUrl || nextUrl === candidate.oldUrl) {
        return { source: candidate.source, rowKey: candidate.rowKey, updated: false, reason: 'no URL change' };
      }
      await sql.unsafe(
        `
          UPDATE dashboard_project_assets
          SET image_url = $1, updated_at = NOW()
          WHERE mold_number = $2 AND slot_type = $3
        `,
        [nextUrl, candidate.moldNumber, candidate.slotType],
      );
      return { source: candidate.source, rowKey: candidate.rowKey, updated: true };
    }
    case 'projects': {
      const nextUrl = urlMap.get(candidate.oldUrl);
      if (!nextUrl || nextUrl === candidate.oldUrl) {
        return { source: candidate.source, rowKey: candidate.rowKey, updated: false, reason: 'no URL change' };
      }
      await sql.unsafe(
        `
          UPDATE projects
          SET product_image_url = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [nextUrl, candidate.projectId],
      );
      return { source: candidate.source, rowKey: candidate.rowKey, updated: true };
    }
    case 'evidence': {
      const nextUrl = urlMap.get(candidate.oldUrl);
      if (!nextUrl || nextUrl === candidate.oldUrl) {
        return { source: candidate.source, rowKey: candidate.rowKey, updated: false, reason: 'no URL change' };
      }
      await sql.unsafe(
        `
          UPDATE evidence
          SET url = $1
          WHERE id = $2
        `,
        [nextUrl, candidate.evidenceId],
      );
      return { source: candidate.source, rowKey: candidate.rowKey, updated: true };
    }
    case 'issues': {
      const replaced = replaceLegacyUrlsDeep(candidate.modules, urlMap);
      if (!replaced.changed) {
        return { source: candidate.source, rowKey: candidate.rowKey, updated: false, reason: 'no URL change' };
      }
      await sql.unsafe(
        `
          UPDATE issues
          SET modules = $1::jsonb, updated_at = NOW()
          WHERE id = $2
        `,
        [JSON.stringify(replaced.next ?? {}), candidate.issueId],
      );
      return { source: candidate.source, rowKey: candidate.rowKey, updated: true };
    }
    case 'progress_notes': {
      const parsed = tryParseJson(candidate.content);
      const sourceValue = parsed ?? candidate.content;
      const replaced = replaceLegacyUrlsDeep(sourceValue, urlMap);
      if (!replaced.changed) {
        return { source: candidate.source, rowKey: candidate.rowKey, updated: false, reason: 'no URL change' };
      }
      const nextContent =
        typeof parsed === 'string' || parsed === null
          ? String(replaced.next ?? candidate.content)
          : JSON.stringify(replaced.next);
      await sql.unsafe(
        `
          UPDATE progress_notes
          SET content = $1
          WHERE id = $2 AND mold_number = $3
        `,
        [nextContent, candidate.noteId, candidate.moldNumber],
      );
      return { source: candidate.source, rowKey: candidate.rowKey, updated: true };
    }
  }

  throw new Error('unsupported candidate');
}

async function writeReport(reportPath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function uploadViaBackendApi(
  options: {
    baseUrl: string;
    apiKey: string;
    fileBuffer: Buffer;
    filename: string;
    mimeType?: string;
    category?: string;
    entityId?: string;
    slot?: string;
  },
): Promise<UploadAssetResult> {
  if (!options.baseUrl) {
    throw new Error('upload base url is missing');
  }
  if (!options.apiKey) {
    throw new Error('upload api key is missing');
  }

  const endpoint = `${options.baseUrl.replace(/\/+$/, '')}/api/uploads/assets`;
  const formData = new FormData();
  const blob = new Blob([options.fileBuffer], {
    type: options.mimeType || 'application/octet-stream',
  });

  formData.append('file', blob, options.filename);
  if (options.category) formData.append('category', options.category);
  if (options.entityId) formData.append('entityId', options.entityId);
  if (options.slot) formData.append('slot', options.slot);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': options.apiKey,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null) as Partial<UploadAssetResult> & { error?: string } | null;
  if (!response.ok || !payload?.url || !payload.objectKey) {
    const reason = payload?.error || `${response.status} ${response.statusText}`;
    throw new Error(`backend upload failed: ${reason}`);
  }

  return {
    url: payload.url,
    objectKey: payload.objectKey,
    mimeType: payload.mimeType || options.mimeType || 'application/octet-stream',
    size: typeof payload.size === 'number' ? payload.size : options.fileBuffer.byteLength,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  await import('../server/env.js');
  const dbModule = await import('../server/db.js');
  const ossModule = await import('../server/lib/oss.js');
  const sql = dbModule.sql as SqlClient | null;
  const uploadAssetToOss = ossModule.uploadAssetToOss as UploadAssetFn;
  const buildAssetProxyUrl = ossModule.buildAssetProxyUrl as BuildAssetProxyUrlFn;

  if (!sql) {
    throw new Error('DATABASE_URL not configured. Cannot run migration.');
  }

  const selectedSources = [...options.sources];
  console.log(`[INFO] Mode: ${options.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[INFO] Sources: ${selectedSources.join(', ')}`);
  if (options.limit) {
    console.log(`[INFO] URL limit: ${options.limit}`);
  }

  const allCandidates: Candidate[] = [];
  if (options.sources.has('dashboard_project_assets')) {
    allCandidates.push(...(await scanDashboardProjectAssets(sql)));
  }
  if (options.sources.has('projects')) {
    allCandidates.push(...(await scanProjects(sql)));
  }
  if (options.sources.has('evidence')) {
    allCandidates.push(...(await scanEvidence(sql)));
  }
  if (options.sources.has('issues')) {
    allCandidates.push(...(await scanIssues(sql)));
  }
  if (options.sources.has('progress_notes')) {
    allCandidates.push(...(await scanProgressNotes(sql)));
  }

  const uniqueLegacyUrls = [...new Set(allCandidates.flatMap((candidate) => candidateUrls(candidate)))];
  const limitedLegacyUrls = options.limit ? uniqueLegacyUrls.slice(0, options.limit) : uniqueLegacyUrls;
  const limitedSet = new Set(limitedLegacyUrls);
  const candidates = allCandidates.filter((candidate) => candidateUrls(candidate).some((url) => limitedSet.has(url)));

  const countsBySource: Record<string, number> = {};
  for (const candidate of candidates) {
    countsBySource[candidate.source] = (countsBySource[candidate.source] || 0) + 1;
  }

  console.log(`[INFO] Candidate rows: ${candidates.length}`);
  console.log(`[INFO] Unique legacy URLs: ${limitedLegacyUrls.length}`);
  for (const source of ALL_SOURCES) {
    if (countsBySource[source]) {
      console.log(`[INFO]   ${source}: ${countsBySource[source]} row(s)`);
    }
  }

  const urlMappings: UrlMapping[] = [];
  const failedUrlMigrations: FailedUrlMigration[] = [];
  const rowUpdateResults: RowUpdateResult[] = [];
  const urlMap = new Map<string, string>();

  if (!options.apply) {
    console.log('[INFO] Dry-run only. No asset upload and no DB update executed.');
    for (let index = 0; index < limitedLegacyUrls.length; index += 1) {
      const oldUrl = limitedLegacyUrls[index];
      const occurrence = pickFirstOccurrence(oldUrl, candidates);
      if (!occurrence) continue;
      const objectKey = buildDryRunPreviewObjectKey(oldUrl, occurrence);
      const newUrl = buildAssetProxyUrl(objectKey);
      urlMappings.push({
        oldUrl,
        newUrl,
        source: occurrence.source,
        rowKey: occurrence.rowKey,
        objectKey,
      });
    }
  } else {
    const hasDirectOssEnv = Boolean(
      process.env.ALIYUN_OSS_REGION
      && process.env.ALIYUN_OSS_BUCKET
      && process.env.ALIYUN_OSS_ACCESS_KEY_ID
      && process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    );
    console.log(
      `[INFO] Upload strategy: ${hasDirectOssEnv ? 'direct-oss-client' : `backend-api(${options.uploadBaseUrl})`}`,
    );

    for (let index = 0; index < limitedLegacyUrls.length; index += 1) {
      const oldUrl = limitedLegacyUrls[index];
      const occurrence = pickFirstOccurrence(oldUrl, candidates);
      if (!occurrence) {
        continue;
      }

      const context = buildUploadContext(occurrence);
      console.log(`[MIGRATE] (${index + 1}/${limitedLegacyUrls.length}) ${oldUrl}`);
      try {
        const downloaded = await downloadAsset(oldUrl, options.timeoutMs);
        const filename = inferFilename(oldUrl, downloaded.mimeType);
        const uploaded = hasDirectOssEnv
          ? await uploadAssetToOss({
              fileBuffer: downloaded.buffer,
              filename,
              mimeType: downloaded.mimeType || undefined,
              category: context.category,
              entityId: context.entityId,
              slot: context.slot,
            })
          : await uploadViaBackendApi({
              baseUrl: options.uploadBaseUrl,
              apiKey: options.uploadApiKey,
              fileBuffer: downloaded.buffer,
              filename,
              mimeType: downloaded.mimeType || undefined,
              category: context.category,
              entityId: context.entityId,
              slot: context.slot,
            });
        urlMap.set(oldUrl, uploaded.url);
        urlMappings.push({
          oldUrl,
          newUrl: uploaded.url,
          source: occurrence.source,
          rowKey: occurrence.rowKey,
          objectKey: uploaded.objectKey,
        });
        console.log(`  [OK] -> ${uploaded.url}`);
      } catch (error) {
        const message = asErrorMessage(error);
        failedUrlMigrations.push({
          oldUrl,
          source: occurrence.source,
          rowKey: occurrence.rowKey,
          error: message,
        });
        console.log(`  [FAIL] ${message}`);
      }
    }

    for (const candidate of candidates) {
      try {
        const result = await applyRowUpdate(sql, candidate, urlMap);
        rowUpdateResults.push(result);
      } catch (error) {
        rowUpdateResults.push({
          source: candidate.source,
          rowKey: candidate.rowKey,
          updated: false,
          reason: asErrorMessage(error),
        });
      }
    }
  }

  const updatedRows = rowUpdateResults.filter((item) => item.updated).length;
  const skippedRows = rowUpdateResults.filter((item) => !item.updated).length;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    options: {
      apply: options.apply,
      limit: options.limit,
      timeoutMs: options.timeoutMs,
      sources: [...options.sources],
      reportPath: toPortablePath(options.reportPath),
      uploadBaseUrl: options.uploadBaseUrl,
      uploadApiKeyConfigured: Boolean(options.uploadApiKey),
    },
    summary: {
      candidateRows: candidates.length,
      uniqueLegacyUrls: limitedLegacyUrls.length,
      migratedUrls: options.apply ? urlMappings.length : 0,
      previewMappedUrls: options.apply ? 0 : urlMappings.length,
      failedUrlMigrations: failedUrlMigrations.length,
      updatedRows,
      skippedRows,
      countsBySource,
    },
    uniqueLegacyUrls: limitedLegacyUrls,
    urlMappings,
    failedUrlMigrations,
    rowUpdateResults,
  };

  await writeReport(options.reportPath, report);
  console.log(`[INFO] Report written: ${toPortablePath(options.reportPath)}`);

  if (!options.apply) {
    return;
  }

  if (failedUrlMigrations.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('[FATAL]', asErrorMessage(error));
  process.exit(1);
});
