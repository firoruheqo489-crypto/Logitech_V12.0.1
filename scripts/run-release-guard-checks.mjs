import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverRoot = path.join(repoRoot, 'server');

function parseBundlePath() {
  const index = process.argv.indexOf('--bundle-path');
  if (index === -1 || !process.argv[index + 1]) {
    return path.join(repoRoot, '.codex-local', 'release-guards', 'entry.mjs');
  }

  return path.resolve(repoRoot, process.argv[index + 1]);
}

const bundlePath = parseBundlePath();

async function importFreshBundle() {
  const bundleUrl = pathToFileURL(bundlePath).href;
  return import(`${bundleUrl}?t=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function withEnv(env, fn) {
  const previous = new Map();

  for (const [name, value] of Object.entries(env)) {
    previous.set(name, process.env[name]);
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [name, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

async function loadSource(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function findMatchIndex(source, pattern) {
  const match = pattern.exec(source);
  return match ? match.index : -1;
}

async function collectServerSourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectServerSourceFiles(fullPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) {
      return [];
    }

    return [fullPath];
  }));

  return files.flat();
}

function findInlineErrorJsonBlocks(source) {
  return Array.from(
    source.matchAll(/res\.status\([^)]*\)\.json\(\{\s*error\s*:[\s\S]*?\}\);/g),
    (match) => match[0],
  );
}

function createSpy() {
  const spy = (...args) => {
    spy.calls.push(args);
  };

  spy.calls = [];
  return spy;
}

function createMockRequest(input) {
  return {
    method: input.method,
    headers: input.headers ?? (input.origin ? { origin: input.origin } : {}),
    hostname: input.hostname ?? 'example.com',
  };
}

function createMockResponse() {
  const state = {
    headers: {},
    statusCode: null,
    jsonBody: null,
  };

  const res = {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader(name, value) {
      state.headers[name] = value;
      return this;
    },
    sendStatus(code) {
      state.statusCode = code;
      return this;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.jsonBody = body;
      return this;
    },
  };

  return { res, state };
}

function runMiddlewarePipeline(middlewares, req, res, done) {
  let index = -1;

  const dispatch = (nextIndex) => {
    if (nextIndex <= index) {
      throw new Error('middleware next() called multiple times');
    }

    index = nextIndex;
    const middleware = middlewares[nextIndex];
    if (!middleware) {
      done();
      return;
    }

    middleware(req, res, () => dispatch(nextIndex + 1));
  };

  dispatch(0);
}

const checks = [];

function addCheck(name, fn) {
  checks.push({ name, fn });
}

addCheck('server/index.ts keeps the shared API policy and route order intact', async () => {
  const source = await loadSource(path.join('server', 'index.ts'));

  assert.match(
    source,
    /import\s*\{\s*registerApiAccessPolicy\s*\}\s*from\s*["']\.\/middleware\/apiAccessPolicy\.js["'];/,
  );
  assert.match(
    source,
    /import\s*\{\s*getReleaseInfoHandler\s*\}\s*from\s*["']\.\/release\.js["'];/,
  );

  const securityHeadersIndex = findMatchIndex(source, /app\.use\(securityHeaders\);/);
  const registerPolicyIndex = findMatchIndex(source, /registerApiAccessPolicy\(app\);/);
  const firstApiRouteIndex = findMatchIndex(source, /app\.get\(["']\/api\/health["']/);

  assert.ok(securityHeadersIndex >= 0);
  assert.ok(registerPolicyIndex > securityHeadersIndex);
  assert.ok(firstApiRouteIndex > registerPolicyIndex);
  assert.doesNotMatch(source, /app\.use\(['"]\/api['"],\s*\(req,\s*res,\s*next\)\s*=>/);

  for (const token of [
    'TRUSTED_ORIGINS',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Credentials',
    'CORS origin denied',
  ]) {
    assert.ok(!source.includes(token), `server/index.ts should not contain ${token}`);
  }

  const releaseRouteIndex = findMatchIndex(
    source,
    /app\.get\(["']\/api\/release["'],\s*getReleaseInfoHandler\);/,
  );
  const healthRouteIndex = findMatchIndex(source, /app\.get\(["']\/api\/health["']/);
  assert.ok(releaseRouteIndex >= 0);
  assert.ok(healthRouteIndex > releaseRouteIndex);

  const batchUpsertIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/product-data\/batch-upsert["'],\s*batchUpsertDashboardProductData\);/,
  );
  const clearProjectsIndex = findMatchIndex(
    source,
    /app\.delete\(["']\/api\/dashboard\/projects["'],\s*clearDashboardProjects\);/,
  );
  const healthCheckIndex = findMatchIndex(
    source,
    /app\.get\(["']\/api\/dashboard\/health-check["'],\s*getDashboardHealthCheck\);/,
  );
  assert.ok(batchUpsertIndex >= 0);
  assert.ok(clearProjectsIndex > batchUpsertIndex);
  assert.ok(healthCheckIndex > clearProjectsIndex);

  const entryRouteIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/progress-notes\/:moldNumber\/entry["'],\s*upsertProgressNote\);/,
  );
  const createBackupIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/progress-notes\/:moldNumber\/create-backup["'],\s*createProgressBackup\);/,
  );
  const restoreLatestIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/progress-notes\/:moldNumber\/restore-latest["'],\s*restoreLatestProgressNotes\);/,
  );
  assert.ok(entryRouteIndex >= 0);
  assert.ok(createBackupIndex > entryRouteIndex);
  assert.ok(restoreLatestIndex > createBackupIndex);

  assert.match(
    source,
    /res\.status\(404\)\.json\(\{\s*error:\s*"not found \(dev API only\)",\s*code:\s*"ROUTE_NOT_FOUND"\s*\}\);/,
  );
});

addCheck('server error payloads stay machine-readable', async () => {
  const files = await collectServerSourceFiles(serverRoot);
  const sources = await Promise.all(files.map(async (filePath) => ({
    path: path.relative(serverRoot, filePath),
    source: await readFile(filePath, 'utf8'),
  })));

  const missingCodeViolations = sources.flatMap(({ path: filePath, source }) =>
    findInlineErrorJsonBlocks(source)
      .filter((block) => !/\bcode\b\s*(?::|,)/.test(block))
      .map((block) => `${filePath}: ${block}`),
  );

  const leakedMessageViolations = sources.flatMap(({ path: filePath, source }) => {
    const matches = source.match(
      /res\.(?:status\([^)]*\)\.)?json\([\s\S]*?(?:err|error)\.message[\s\S]*?\);/g,
    );

    return (matches ?? []).map((match) => `${filePath}: ${match}`);
  });

  assert.deepEqual(missingCodeViolations, []);
  assert.deepEqual(leakedMessageViolations, []);
});

addCheck('dashboard API error normalization keeps typed safe messages', async () => {
  const { dashboardApiModule } = await importFreshBundle();
  const {
    DashboardApiError,
    getDashboardApiErrorDisplayMessage,
    normalizeDashboardApiError,
  } = dashboardApiModule;

  const saveError = normalizeDashboardApiError(
    { error: 'raw backend detail', code: 'PROJECT_ASSET_SAVE_FAILED' },
    500,
    'UNKNOWN_ERROR',
  );

  assert.ok(saveError instanceof DashboardApiError);
  assert.equal(saveError.code, 'PROJECT_ASSET_SAVE_FAILED');
  assert.equal(saveError.status, 500);
  assert.equal(
    getDashboardApiErrorDisplayMessage(saveError, 'fallback'),
    'Image save failed, please retry',
  );

  const deleteError = new DashboardApiError('raw backend detail', 'INVALID_ASSET_DELETE_REQUEST', 400);
  assert.equal(
    getDashboardApiErrorDisplayMessage(deleteError, 'fallback'),
    'Missing mold number or slot type for delete',
  );

  const destructiveError = new DashboardApiError(
    'destructive snapshot confirmation required',
    'SNAPSHOT_DESTRUCTIVE_CONFIRMATION_REQUIRED',
    409,
  );
  assert.equal(
    getDashboardApiErrorDisplayMessage(destructiveError, 'fallback'),
    'The server blocked this snapshot because it would remove too many progress notes at once',
  );
});

addCheck('API CORS middleware keeps trusted and public flows stable', async () => {
  const { apiCorsModule } = await importFreshBundle();
  const { API_TRUSTED_ORIGINS, createApiCorsMiddleware } = apiCorsModule;
  const middleware = createApiCorsMiddleware(new Set(['http://trusted.example']));

  assert.equal(API_TRUSTED_ORIGINS.has('http://localhost:3001'), true);

  {
    const req = createMockRequest({ method: 'OPTIONS', origin: 'http://trusted.example' });
    const { res, state } = createMockResponse();
    const next = createSpy();
    middleware(req, res, next);

    assert.equal(next.calls.length, 0);
    assert.equal(state.statusCode, 204);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://trusted.example');
    assert.equal(state.headers.Vary, 'Origin');
    assert.equal(state.headers['Access-Control-Allow-Methods'], 'GET, POST, PATCH, DELETE, OPTIONS');
    assert.equal(state.headers['Access-Control-Allow-Headers'], 'Content-Type, x-api-key');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], 'true');
  }

  {
    const req = createMockRequest({ method: 'OPTIONS', origin: 'http://untrusted.example' });
    const { res, state } = createMockResponse();
    const next = createSpy();
    middleware(req, res, next);

    assert.equal(next.calls.length, 0);
    assert.equal(state.statusCode, 204);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://untrusted.example');
    assert.equal(state.headers.Vary, 'Origin');
    assert.equal(state.headers['Access-Control-Allow-Methods'], 'GET, OPTIONS');
    assert.equal(state.headers['Access-Control-Allow-Headers'], undefined);
    assert.equal(state.headers['Access-Control-Allow-Credentials'], undefined);
  }

  {
    const req = createMockRequest({ method: 'OPTIONS' });
    const { res, state } = createMockResponse();
    const next = createSpy();
    middleware(req, res, next);

    assert.equal(next.calls.length, 0);
    assert.equal(state.statusCode, 204);
    assert.equal(state.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(state.headers.Vary, undefined);
    assert.equal(state.headers['Access-Control-Allow-Methods'], 'GET, OPTIONS');
  }

  {
    const req = createMockRequest({ method: 'GET', origin: 'http://trusted.example' });
    const { res, state } = createMockResponse();
    const next = createSpy();
    middleware(req, res, next);

    assert.equal(next.calls.length, 1);
    assert.equal(state.statusCode, null);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://trusted.example');
    assert.equal(state.headers.Vary, 'Origin');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], 'true');
  }

  {
    const req = createMockRequest({ method: 'GET', origin: 'http://untrusted.example' });
    const { res, state } = createMockResponse();
    const next = createSpy();
    middleware(req, res, next);

    assert.equal(next.calls.length, 1);
    assert.equal(state.statusCode, null);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://untrusted.example');
    assert.equal(state.headers.Vary, 'Origin');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], undefined);
  }
});

addCheck('API access policy keeps public reads open and write checks ordered', async () => {
  await withEnv({ API_SECRET_KEY: undefined, DEV_API: undefined, NODE_ENV: 'production' }, async () => {
    const { apiCorsModule, authModule } = await importFreshBundle();
    const req = createMockRequest({
      method: 'GET',
      headers: { origin: 'http://untrusted.example' },
    });
    const { res, state } = createMockResponse();
    const done = createSpy();

    runMiddlewarePipeline([apiCorsModule.apiCors, authModule.apiKeyAuth], req, res, done);

    assert.equal(done.calls.length, 1);
    assert.equal(state.statusCode, null);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://untrusted.example');
    assert.equal(state.headers.Vary, 'Origin');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], undefined);
  });

  await withEnv({ API_SECRET_KEY: 'expected-key', DEV_API: undefined, NODE_ENV: 'production' }, async () => {
    const { apiCorsModule, authModule } = await importFreshBundle();
    const req = createMockRequest({
      method: 'POST',
      headers: { origin: 'http://untrusted.example' },
    });
    const { res, state } = createMockResponse();
    const done = createSpy();

    runMiddlewarePipeline([apiCorsModule.apiCors, authModule.apiKeyAuth], req, res, done);

    assert.equal(done.calls.length, 0);
    assert.equal(state.statusCode, 403);
    assert.deepEqual(state.jsonBody, {
      error: 'api key missing or invalid',
      code: 'API_KEY_INVALID',
    });
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://untrusted.example');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], undefined);
  });

  await withEnv({ API_SECRET_KEY: undefined, DEV_API: '1', NODE_ENV: 'development' }, async () => {
    const { apiCorsModule, authModule } = await importFreshBundle();
    const req = createMockRequest({
      method: 'POST',
      headers: {
        host: 'localhost:3001',
        origin: 'http://localhost:3000',
      },
      hostname: 'localhost',
    });
    const { res, state } = createMockResponse();
    const done = createSpy();

    runMiddlewarePipeline([apiCorsModule.apiCors, authModule.apiKeyAuth], req, res, done);

    assert.equal(done.calls.length, 1);
    assert.equal(state.statusCode, null);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], 'true');
  });

  await withEnv({ API_SECRET_KEY: 'expected-key', DEV_API: undefined, NODE_ENV: 'production' }, async () => {
    const { apiCorsModule, authModule } = await importFreshBundle();
    const req = createMockRequest({
      method: 'POST',
      headers: {
        host: '120.27.153.140:3000',
        origin: 'http://120.27.153.140:3000',
      },
      hostname: '120.27.153.140',
    });
    const { res, state } = createMockResponse();
    const done = createSpy();

    runMiddlewarePipeline([apiCorsModule.apiCors, authModule.apiKeyAuth], req, res, done);

    assert.equal(done.calls.length, 1);
    assert.equal(state.statusCode, null);
    assert.equal(state.headers['Access-Control-Allow-Origin'], 'http://120.27.153.140:3000');
    assert.equal(state.headers['Access-Control-Allow-Credentials'], 'true');
  });

  await withEnv({ API_SECRET_KEY: undefined, DEV_API: undefined, NODE_ENV: undefined }, async () => {
    const { apiAccessPolicyModule, apiCorsModule, authModule } = await importFreshBundle();
    const calls = [];
    const app = {
      use(routePath, handler) {
        calls.push({ path: routePath, handler });
      },
    };

    apiAccessPolicyModule.registerApiAccessPolicy(app);

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], {
      path: apiAccessPolicyModule.API_ACCESS_POLICY_PATH,
      handler: apiCorsModule.apiCors,
    });
    assert.deepEqual(calls[1], {
      path: apiAccessPolicyModule.API_ACCESS_POLICY_PATH,
      handler: authModule.apiKeyAuth,
    });
  });
});

addCheck('release metadata helpers stay stable', async () => {
  const { releaseModule } = await importFreshBundle();
  const { buildReleaseInfo, normalizeReleaseManifest, readReleaseManifestFromFile } = releaseModule;

  const manifest = normalizeReleaseManifest({
    name: 'mold-gantt-v3',
    version: '1.0.0',
    commit: '1234567890abcdef1234567890abcdef12345678',
    builtAt: '2026-03-19T14:00:00.000Z',
    dirty: false,
  });

  assert.deepEqual(manifest, {
    name: 'mold-gantt-v3',
    version: '1.0.0',
    commit: '1234567890abcdef1234567890abcdef12345678',
    commitShort: '1234567',
    builtAt: '2026-03-19T14:00:00.000Z',
    dirty: false,
  });

  const tempDir = mkdtempSync(path.join(tmpdir(), 'release-manifest-'));
  const manifestPath = path.join(tempDir, 'release.json');
  writeFileSync(manifestPath, JSON.stringify({
    name: 'mold-gantt-v3',
    version: '1.0.0',
    commit: 'abcdef1234567890abcdef1234567890abcdef12',
    commitShort: 'abcdef1',
    builtAt: '2026-03-19T14:00:00.000Z',
    dirty: false,
  }), 'utf8');

  assert.deepEqual(readReleaseManifestFromFile(manifestPath), {
    name: 'mold-gantt-v3',
    version: '1.0.0',
    commit: 'abcdef1234567890abcdef1234567890abcdef12',
    commitShort: 'abcdef1',
    builtAt: '2026-03-19T14:00:00.000Z',
    dirty: false,
  });

  assert.deepEqual(
    buildReleaseInfo({
      manifest: null,
      manifestFound: false,
      packageVersion: '1.0.0',
      runtimeStartedAt: '2026-03-19T14:00:00.000Z',
      nodeEnv: 'production',
    }),
    {
      name: 'mold-gantt-v3',
      version: '1.0.0',
      commit: null,
      commitShort: null,
      builtAt: null,
      dirty: null,
      manifestFound: false,
      nodeEnv: 'production',
      runtimeStartedAt: '2026-03-19T14:00:00.000Z',
    },
  );
});

addCheck('progress note destructive snapshot safeguards stay intact', async () => {
  const { progressNotesModule } = await importFreshBundle();
  const {
    SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER,
    SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE,
    assessProgressSnapshotRisk,
    selectLatestRestorableBackup,
  } = progressNotesModule;

  assert.deepEqual(
    assessProgressSnapshotRisk({ beforeCount: 6, afterCount: 5, deletedCount: 1 }),
    {
      beforeCount: 6,
      afterCount: 5,
      deletedCount: 1,
      reason: 'none',
      requiresConfirmation: false,
    },
  );

  assert.deepEqual(
    assessProgressSnapshotRisk({ beforeCount: 2, afterCount: 0, deletedCount: 2 }),
    {
      beforeCount: 2,
      afterCount: 0,
      deletedCount: 2,
      reason: 'clear-all',
      requiresConfirmation: true,
    },
  );

  assert.deepEqual(
    assessProgressSnapshotRisk({ beforeCount: 20, afterCount: 1, deletedCount: 19 }),
    {
      beforeCount: 20,
      afterCount: 1,
      deletedCount: 19,
      reason: 'majority-delete',
      requiresConfirmation: true,
    },
  );

  assert.equal(SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER, 'x-snapshot-confirmation');
  assert.equal(SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE, 'allow-destructive');

  const selected = selectLatestRestorableBackup([
    {
      id: 203,
      created_at: '2026-03-19T09:30:00.000Z',
      snapshot: [{ id: 'note-1', date: '2026-03-19', content: 'only surviving row' }],
    },
    {
      id: 202,
      created_at: '2026-03-19T09:00:00.000Z',
      snapshot: [
        { id: 'note-1', date: '2026-03-19', content: 'row 1' },
        { id: 'note-2', date: '2026-03-18', content: 'row 2' },
        { id: 'note-3', date: '2026-03-17', content: 'row 3' },
        { id: 'note-4', date: '2026-03-16', content: 'row 4' },
        { id: 'note-5', date: '2026-03-15', content: 'row 5' },
      ],
    },
    {
      id: 201,
      created_at: '2026-03-19T08:00:00.000Z',
      snapshot: [
        { id: 'note-1', date: '2026-03-19', content: 'row 1' },
        { id: 'note-2', date: '2026-03-18', content: 'row 2' },
        { id: 'note-3', date: '2026-03-17', content: 'row 3' },
        { id: 'note-4', date: '2026-03-16', content: 'row 4' },
        { id: 'note-5', date: '2026-03-15', content: 'row 5' },
      ],
    },
  ]);

  assert.ok(selected);
  assert.equal(selected.id, 202);
  assert.equal(selected.backupAt, '2026-03-19T09:00:00.000Z');
  assert.equal(selected.snapshot.length, 5);
  assert.equal(selected.snapshot[0].id, 'note-1');

  const fallbackSelected = selectLatestRestorableBackup([
    { id: 303, created_at: '2026-03-19T10:00:00.000Z', snapshot: 'not-json' },
    { id: 302, created_at: '2026-03-19T09:30:00.000Z', snapshot: [] },
    {
      id: 301,
      created_at: '2026-03-19T09:00:00.000Z',
      snapshot: [{ id: 'note-a', date: '2026-03-19', content: 'safe row' }],
    },
  ]);

  assert.ok(fallbackSelected);
  assert.equal(fallbackSelected.id, 301);
  assert.equal(fallbackSelected.backupAt, '2026-03-19T09:00:00.000Z');
});

addCheck('uploads route error helper stays double-write safe', async () => {
  const { uploadsModule } = await importFreshBundle();
  const { sendUploadsRouteError } = uploadsModule;

  {
    const res = {
      headersSent: true,
      writableEnded: false,
      destroyed: false,
      statusCalled: false,
      jsonCalled: false,
      status() {
        this.statusCalled = true;
        return this;
      },
      json() {
        this.jsonCalled = true;
        return this;
      },
    };

    sendUploadsRouteError(res, 500, 'ASSET_UPLOAD_FAILED');

    assert.equal(res.statusCalled, false);
    assert.equal(res.jsonCalled, false);
  }

  {
    const state = { statusCode: null, jsonBody: null };
    const res = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      status(code) {
        state.statusCode = code;
        return this;
      },
      json(body) {
        state.jsonBody = body;
        return this;
      },
    };

    sendUploadsRouteError(res, 404, 'ASSET_NOT_FOUND');

    assert.equal(state.statusCode, 404);
    assert.deepEqual(state.jsonBody, {
      error: 'Asset not found',
      code: 'ASSET_NOT_FOUND',
    });
  }
});

let failures = 0;

for (const { name, fn } of checks) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error instanceof Error ? error.stack : error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log('[SUCCESS] Release guard checks passed.');
}
