import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants, mkdtempSync, writeFileSync } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const serverRoot = path.resolve(repoRoot, "server");
const packageJsonPath = path.resolve(repoRoot, "package.json");
const serverIndexPath = path.resolve(serverRoot, "index.ts");

type UnknownRecord = Record<string, unknown>;
type PackageJsonScripts = Record<string, string>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function expectMatch(source: string, pattern: RegExp, message: string): void {
  assert.match(source, pattern, message);
}

function findMatchIndex(source: string, pattern: RegExp): number {
  const match = pattern.exec(source);
  return match?.index ?? -1;
}

async function importFresh<T>(relativePath: string): Promise<T> {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const url = pathToFileURL(absolutePath).href;
  return import(`${url}?v=${Date.now()}-${Math.random()}`) as Promise<T>;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.resolve(repoRoot, relativePath), "utf8");
}

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await access(path.resolve(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectServerSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return collectServerSourceFiles(fullPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
        return [];
      }

      return [fullPath];
    })
  );

  return files.flat();
}

async function loadPackageScripts(): Promise<PackageJsonScripts> {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, unknown>;
  };

  const scripts = packageJson.scripts ?? {};
  return Object.fromEntries(
    Object.entries(scripts).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function createMockResponse() {
  const state = {
    headers: {} as Record<string, string>,
    statusCode: null as number | null,
    jsonBody: null as unknown,
  };

  const res = {
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    sendStatus(code: number) {
      state.statusCode = code;
      return this;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.jsonBody = body;
      return this;
    },
  };

  return { res, state };
}

function createMockRequest(input: {
  method: string;
  origin?: string;
  headers?: Record<string, string | undefined>;
  hostname?: string;
}) {
  return {
    method: input.method,
    headers: {
      ...(input.headers ?? {}),
      ...(input.origin ? { origin: input.origin } : {}),
    },
    hostname: input.hostname ?? "example.com",
  };
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function runCheck(
  name: string,
  callback: () => Promise<void>
): Promise<void> {
  await callback();
  console.log(`[release-guard] ${name}`);
}

async function verifyServerIndexStructure(): Promise<void> {
  const source = await readFile(serverIndexPath, "utf8");

  expectMatch(
    source,
    /import\s*\{\s*registerApiAccessPolicy\s*\}\s*from\s*["']\.\/middleware\/apiAccessPolicy\.js["'];/,
    "server/index.ts must import registerApiAccessPolicy from the shared middleware module"
  );
  expectMatch(
    source,
    /import\s*\{\s*getReleaseInfoHandler\s*\}\s*from\s*["']\.\/release\.js["'];/,
    "server/index.ts must import getReleaseInfoHandler from server/release.ts"
  );

  const securityHeadersIndex = findMatchIndex(
    source,
    /app\.use\(securityHeaders\);/
  );
  const registerPolicyIndex = findMatchIndex(
    source,
    /registerApiAccessPolicy\(app\);/
  );
  const firstApiRouteIndex = findMatchIndex(
    source,
    /app\.get\(["']\/api\/health["']/
  );

  assert.ok(securityHeadersIndex >= 0, "securityHeaders must be registered");
  assert.ok(
    registerPolicyIndex > securityHeadersIndex,
    "api access policy must be registered after security headers"
  );
  assert.ok(
    firstApiRouteIndex > registerPolicyIndex,
    "api access policy must be registered before API routes"
  );
  assert.ok(
    !/app\.use\(['"]\/api['"],\s*\(req,\s*res,\s*next\)\s*=>/.test(source),
    "server/index.ts must not inline /api access policy middleware"
  );

  for (const forbidden of [
    "TRUSTED_ORIGINS",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Credentials",
    "CORS origin denied",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `server/index.ts must not contain ${forbidden}`
    );
  }

  const releaseRouteIndex = findMatchIndex(
    source,
    /app\.get\(["']\/api\/release["'],\s*getReleaseInfoHandler\);/
  );
  const healthRouteIndex = findMatchIndex(
    source,
    /app\.get\(["']\/api\/health["']/
  );
  assert.ok(releaseRouteIndex >= 0, "/api/release route must be registered");
  assert.ok(
    healthRouteIndex > releaseRouteIndex,
    "/api/release must be registered before /api/health"
  );

  const batchUpsertIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/product-data\/batch-upsert["'],\s*batchUpsertDashboardProductData\);/
  );
  const clearProjectsIndex = findMatchIndex(
    source,
    /app\.delete\(["']\/api\/dashboard\/projects["'],\s*clearDashboardProjects\);/
  );
  const healthCheckIndex = findMatchIndex(
    source,
    /app\.get\(["']\/api\/dashboard\/health-check["'],\s*getDashboardHealthCheck\);/
  );
  assert.ok(
    batchUpsertIndex >= 0,
    "dashboard batch-upsert route must be present"
  );
  assert.ok(
    clearProjectsIndex > batchUpsertIndex,
    "dashboard clear route must stay after batch-upsert"
  );
  assert.ok(
    healthCheckIndex > clearProjectsIndex,
    "dashboard health route must stay after clear route"
  );

  const entryRouteIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/progress-notes\/:moldNumber\/entry["'],\s*upsertProgressNote\);/
  );
  const createBackupIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/progress-notes\/:moldNumber\/create-backup["'],\s*createProgressBackup\);/
  );
  const restoreLatestIndex = findMatchIndex(
    source,
    /app\.post\(["']\/api\/dashboard\/progress-notes\/:moldNumber\/restore-latest["'],\s*restoreLatestProgressNotes\);/
  );
  assert.ok(entryRouteIndex >= 0, "progress note entry route must be present");
  assert.ok(
    createBackupIndex > entryRouteIndex,
    "backup route must remain after entry route"
  );
  assert.ok(
    restoreLatestIndex > createBackupIndex,
    "restore route must remain after backup route"
  );

  expectMatch(
    source,
    /res\.status\(404\)\.json\(\{\s*error:\s*"not found \(dev API only\)",\s*code:\s*"ROUTE_NOT_FOUND"\s*\}\);/,
    "dev-api-only fallback must keep a machine-readable error payload"
  );
}

async function verifyServerErrorPayloadStructure(): Promise<void> {
  const files = await collectServerSourceFiles(serverRoot);
  const violationsWithoutCode: string[] = [];
  const messageLeaks: string[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(serverRoot, filePath);
    const inlineJsonBlocks = Array.from(
      source.matchAll(
        /res\.status\([^)]*\)\.json\(\{\s*error\s*:[\s\S]*?\}\);/g
      ),
      match => match[0]
    );

    for (const block of inlineJsonBlocks) {
      if (!/\bcode\b\s*(?::|,)/.test(block)) {
        violationsWithoutCode.push(`${relativePath}: ${block}`);
      }
    }

    const matches = source.match(
      /res\.(?:status\([^)]*\)\.)?json\([\s\S]*?(?:err|error)\.message[\s\S]*?\);/g
    );

    for (const match of matches ?? []) {
      messageLeaks.push(`${relativePath}: ${match}`);
    }
  }

  assert.deepStrictEqual(
    violationsWithoutCode,
    [],
    "all inline server JSON errors must include an error code"
  );
  assert.deepStrictEqual(
    messageLeaks,
    [],
    "server JSON responses must not expose raw error.message values"
  );
}

async function verifyCriticalEntrypoints(): Promise<void> {
  const scripts = await loadPackageScripts();

  const requiredScriptFragments = [
    [
      "dev:dashboard:local",
      [
        "node scripts/start-local-dashboard.mjs",
        "-File scripts/report-local-dashboard-state.ps1",
      ],
    ],
    [
      "dev:dashboard:status",
      ["-File scripts/report-local-dashboard-state.ps1"],
    ],
    [
      "verify:release-guards",
      [
        "node --import ./scripts/register-ts-path-loader.mjs --experimental-strip-types ./scripts/verify-release-guards.ts",
      ],
    ],
    ["release", ["node scripts/release-entrypoint.mjs all"]],
    ["_release:build", ["node scripts/release-entrypoint.mjs build"]],
    ["_release:deploy", ["node scripts/release-entrypoint.mjs deploy"]],
    ["release:preview", ["board-flow-preview.cmd"]],
  ] as const;

  for (const [name, fragments] of requiredScriptFragments) {
    const command = scripts[name];
    assert.equal(typeof command, "string", `missing package script: ${name}`);
    for (const fragment of fragments) {
      assert.ok(
        command.includes(fragment),
        `package script ${name} must include: ${fragment}`
      );
    }
  }

  for (const relativePath of [
    "scripts/start-local-dashboard.mjs",
    "scripts/report-local-dashboard-state.ps1",
    "scripts/show-release-sop.ps1",
    "scripts/release-entrypoint.mjs",
    "scripts/release-from-clean-worktree.ps1",
    "scripts/release-build.ps1",
    "scripts/single-track-flow.ps1",
    "scripts/board-flow-preview.cmd",
    "docs/release-sop.md",
  ]) {
    assert.equal(
      await fileExists(relativePath),
      true,
      `critical wrapper file missing: ${relativePath}`
    );
  }

  const releaseEntrypointSource = await readText(
    "scripts/release-entrypoint.mjs"
  );
  assert.ok(
    releaseEntrypointSource.includes("release-from-clean-worktree.ps1"),
    "scripts/release-entrypoint.mjs must forward to scripts/release-from-clean-worktree.ps1"
  );
}

async function verifyReleaseSopVisibility(): Promise<void> {
  const sourceFiles = [
    "scripts/release-from-clean-worktree.ps1",
    "scripts/release-build.ps1",
    "deploy.ps1",
  ] as const;

  for (const relativePath of sourceFiles) {
    const source = await readText(relativePath);
    assert.ok(
      source.includes("scripts/show-release-sop.ps1"),
      `${relativePath} must display the shared release SOP before continuing`
    );
  }
}

async function verifyReleaseWrapperCleanWorkspacePolicy(): Promise<void> {
  const source = await readText("scripts/release-from-clean-worktree.ps1");

  assert.ok(
    source.includes("Require-CleanWorkspace -RepoRootPath $repoRoot"),
    "release wrapper must require a clean workspace before backup/build flows"
  );
  assert.ok(
    !source.includes("Invoke-AutoCommit"),
    "release wrapper must not auto-commit workspace changes"
  );

  const cleanCheckIndex = source.indexOf(
    "Require-CleanWorkspace -RepoRootPath $repoRoot"
  );
  const backupIndex = source.indexOf(
    'Log "Creating physical backup snapshot..."'
  );
  assert.ok(
    cleanCheckIndex >= 0,
    "release wrapper clean-workspace check must exist"
  );
  assert.ok(
    backupIndex > cleanCheckIndex,
    "release wrapper must refuse dirty workspaces before backup"
  );
}

async function verifyReleaseGateBypassPolicy(): Promise<void> {
  const releaseBuildSource = await readText("scripts/release-build.ps1");
  assert.ok(
    !releaseBuildSource.includes("AllowDirtyWorkspace"),
    "release build script must not allow dirty workspaces"
  );
  assert.ok(
    !releaseBuildSource.includes("SkipVerification"),
    "release build script must not allow verification bypass"
  );
  assert.ok(
    releaseBuildSource.includes(
      'Err "DeepVerification is required for release builds."'
    ),
    "release build script must require deep verification for artifact builds"
  );

  const deploySource = await readText("scripts/deploy-release-artifact.ps1");
  assert.ok(
    !deploySource.includes("SkipRemoteSmoke"),
    "artifact deploy script must not allow remote smoke to be skipped"
  );
  assert.ok(
    deploySource.includes('Log "Running remote OSS upload/delete smoke..."'),
    "artifact deploy script must always run the remote OSS smoke gate"
  );
  assert.ok(
    deploySource.includes('Log "Running remote reliability smoke..."'),
    "artifact deploy script must always run the remote reliability smoke gate"
  );
}

async function verifyDashboardApi(): Promise<void> {
  const {
    DashboardApiError,
    getDashboardApiErrorDisplayMessage,
    normalizeDashboardApiError,
  } = await importFresh<
    typeof import("../client/src/pages/dashboard/lib/dashboardApi.ts")
  >("client/src/pages/dashboard/lib/dashboardApi.ts");

  const normalized = normalizeDashboardApiError(
    { error: "raw backend detail", code: "PROJECT_ASSET_SAVE_FAILED" },
    500,
    "UNKNOWN_ERROR"
  );
  assert.ok(
    normalized instanceof DashboardApiError,
    "normalizeDashboardApiError must return DashboardApiError"
  );
  assert.equal(normalized.code, "PROJECT_ASSET_SAVE_FAILED");
  assert.equal(normalized.status, 500);

  assert.equal(
    getDashboardApiErrorDisplayMessage(
      new DashboardApiError(
        "raw backend detail",
        "PROJECT_ASSET_SAVE_FAILED",
        500
      ),
      "fallback"
    ),
    "Image save failed, please retry"
  );
  assert.equal(
    getDashboardApiErrorDisplayMessage(
      new DashboardApiError(
        "raw backend detail",
        "INVALID_ASSET_DELETE_REQUEST",
        400
      ),
      "fallback"
    ),
    "Missing mold number or slot type for delete"
  );
  assert.equal(
    getDashboardApiErrorDisplayMessage(
      new DashboardApiError(
        "destructive snapshot confirmation required",
        "SNAPSHOT_DESTRUCTIVE_CONFIRMATION_REQUIRED",
        409
      ),
      "fallback"
    ),
    "The server blocked this snapshot because it would remove too many progress notes at once"
  );
}

async function verifyApiCors(): Promise<void> {
  const { API_TRUSTED_ORIGINS, createApiCorsMiddleware } = await importFresh<
    typeof import("../server/middleware/apiCors.ts")
  >("server/middleware/apiCors.ts");

  assert.equal(API_TRUSTED_ORIGINS.has("http://localhost:3001"), true);

  const middleware = createApiCorsMiddleware(
    new Set(["http://trusted.example"])
  );

  {
    const req = createMockRequest({
      method: "OPTIONS",
      origin: "http://trusted.example",
    });
    const { res, state } = createMockResponse();
    let nextCalls = 0;
    middleware(req as never, res as never, () => {
      nextCalls += 1;
    });
    assert.equal(nextCalls, 0);
    assert.equal(state.statusCode, 204);
    assert.equal(
      state.headers["Access-Control-Allow-Origin"],
      "http://trusted.example"
    );
    assert.equal(state.headers.Vary, "Origin");
    assert.equal(
      state.headers["Access-Control-Allow-Methods"],
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
    assert.equal(
      state.headers["Access-Control-Allow-Headers"],
      "Content-Type, x-api-key"
    );
    assert.equal(state.headers["Access-Control-Allow-Credentials"], "true");
  }

  {
    const req = createMockRequest({
      method: "OPTIONS",
      origin: "http://untrusted.example",
    });
    const { res, state } = createMockResponse();
    let nextCalls = 0;
    middleware(req as never, res as never, () => {
      nextCalls += 1;
    });
    assert.equal(nextCalls, 0);
    assert.equal(state.statusCode, 204);
    assert.equal(state.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(state.headers.Vary, undefined);
    assert.equal(state.headers["Access-Control-Allow-Methods"], "GET, OPTIONS");
    assert.equal(state.headers["Access-Control-Allow-Headers"], undefined);
    assert.equal(state.headers["Access-Control-Allow-Credentials"], undefined);
  }

  {
    const req = createMockRequest({ method: "OPTIONS" });
    const { res, state } = createMockResponse();
    let nextCalls = 0;
    middleware(req as never, res as never, () => {
      nextCalls += 1;
    });
    assert.equal(nextCalls, 0);
    assert.equal(state.statusCode, 204);
    assert.equal(state.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(state.headers.Vary, undefined);
    assert.equal(state.headers["Access-Control-Allow-Methods"], "GET, OPTIONS");
  }

  {
    const req = createMockRequest({
      method: "GET",
      origin: "http://trusted.example",
    });
    const { res, state } = createMockResponse();
    let nextCalls = 0;
    middleware(req as never, res as never, () => {
      nextCalls += 1;
    });
    assert.equal(nextCalls, 1);
    assert.equal(
      state.headers["Access-Control-Allow-Origin"],
      "http://trusted.example"
    );
    assert.equal(state.headers["Access-Control-Allow-Credentials"], "true");
  }

  {
    const req = createMockRequest({
      method: "GET",
      origin: "http://untrusted.example",
    });
    const { res, state } = createMockResponse();
    let nextCalls = 0;
    middleware(req as never, res as never, () => {
      nextCalls += 1;
    });
    assert.equal(nextCalls, 1);
    assert.equal(state.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(state.headers.Vary, undefined);
    assert.equal(state.headers["Access-Control-Allow-Credentials"], undefined);
  }
}

async function verifyApiAccessPolicy(): Promise<void> {
  const { apiCors } = await importFresh<
    typeof import("../server/middleware/apiCors.ts")
  >("server/middleware/apiCors.ts");

  async function loadAuthModule(env: Record<string, string | undefined>) {
    return withEnv(env, () =>
      importFresh<typeof import("../server/middleware/auth.ts")>(
        "server/middleware/auth.ts"
      )
    );
  }

  function runPipeline(
    middlewares: Array<(req: never, res: never, next: () => void) => void>,
    req: unknown,
    res: unknown
  ) {
    let nextCalls = 0;
    const dispatch = (index: number): void => {
      const middleware = middlewares[index];
      if (!middleware) {
        nextCalls += 1;
        return;
      }
      middleware(req as never, res as never, () => dispatch(index + 1));
    };
    dispatch(0);
    return nextCalls;
  }

  {
    const { apiKeyAuth, dashboardAccessAuth } = await loadAuthModule({
      NODE_ENV: "production",
      API_SECRET_KEY: "expected-key",
      DEV_API: undefined,
    });
    const req = createMockRequest({
      method: "GET",
      headers: {
        origin: "http://untrusted.example",
        "x-api-key": "expected-key",
      },
    });
    const { res, state } = createMockResponse();
    const nextCalls = runPipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res
    );
    assert.equal(nextCalls, 1);
    assert.equal(state.statusCode, null);
    assert.equal(state.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(state.headers.Vary, undefined);
    assert.equal(state.headers["Access-Control-Allow-Credentials"], undefined);
  }

  {
    const {
      apiKeyAuth,
      createDashboardAccessSessionToken,
      dashboardAccessAuth,
      DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
    } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
      DEV_API: undefined,
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        origin: "http://untrusted.example",
        cookie: `${DASHBOARD_ACCESS_SESSION_COOKIE_NAME}=${createDashboardAccessSessionToken()}`,
      },
    });
    const { res, state } = createMockResponse();
    const nextCalls = runPipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res
    );
    assert.equal(nextCalls, 0);
    assert.equal(state.statusCode, 403);
    assert.deepStrictEqual(state.jsonBody, {
      error: "api key missing or invalid",
      code: "API_KEY_INVALID",
    });
    assert.equal(state.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(state.headers["Access-Control-Allow-Credentials"], undefined);
  }

  {
    const { apiKeyAuth, dashboardAccessAuth } = await loadAuthModule({
      DEV_API: "1",
      NODE_ENV: "development",
      API_SECRET_KEY: undefined,
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "localhost:3001",
        origin: "http://localhost:3000",
      },
      hostname: "localhost",
    });
    const { res, state } = createMockResponse();
    const nextCalls = runPipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res
    );
    assert.equal(nextCalls, 1);
    assert.equal(state.statusCode, null);
    assert.equal(
      state.headers["Access-Control-Allow-Origin"],
      "http://localhost:3000"
    );
    assert.equal(state.headers["Access-Control-Allow-Credentials"], "true");
  }

  {
    const { apiKeyAuth, dashboardAccessAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
      DEV_API: undefined,
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "120.27.153.140:3000",
        origin: "http://120.27.153.140:3000",
        "x-api-key": "expected-key",
      },
      hostname: "120.27.153.140",
    });
    const { res, state } = createMockResponse();
    const nextCalls = runPipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res
    );
    assert.equal(nextCalls, 1);
    assert.equal(state.statusCode, null);
    assert.equal(
      state.headers["Access-Control-Allow-Origin"],
      "http://120.27.153.140:3000"
    );
    assert.equal(state.headers["Access-Control-Allow-Credentials"], "true");
  }

  {
    const { API_ACCESS_POLICY_PATH, registerApiAccessPolicy } =
      await importFresh<
        typeof import("../server/middleware/apiAccessPolicy.ts")
      >("server/middleware/apiAccessPolicy.ts");
    const { apiKeyAuth, dashboardAccessAuth } = await loadAuthModule({
      NODE_ENV: "production",
      API_SECRET_KEY: undefined,
      DEV_API: undefined,
    });

    const calls: Array<{ path: string; handler: unknown }> = [];
    registerApiAccessPolicy({
      use(pathValue, handler) {
        calls.push({ path: pathValue, handler });
      },
    });

    assert.equal(calls.length, 3);
    assert.equal(calls[0]?.path, API_ACCESS_POLICY_PATH);
    assert.equal(typeof calls[0]?.handler, "function");
    assert.equal(calls[1]?.path, API_ACCESS_POLICY_PATH);
    assert.equal(typeof calls[1]?.handler, "function");
    assert.equal(calls[2]?.path, API_ACCESS_POLICY_PATH);
    assert.equal(typeof calls[2]?.handler, "function");
  }
}

async function verifyReleaseMetadata(): Promise<void> {
  const {
    buildReleaseInfo,
    normalizeReleaseManifest,
    readReleaseManifestFromFile,
  } =
    await importFresh<typeof import("../server/release.ts")>(
      "server/release.ts"
    );

  assert.deepStrictEqual(
    normalizeReleaseManifest({
      name: "mold-gantt-v3",
      version: "1.0.0",
      commit: "1234567890abcdef1234567890abcdef12345678",
      builtAt: "2026-03-19T14:00:00.000Z",
      dirty: false,
      buildSource: "clean-worktree",
      sourceWorkspaceDirty: true,
    }),
    {
      name: "mold-gantt-v3",
      version: "1.0.0",
      commit: "1234567890abcdef1234567890abcdef12345678",
      commitShort: "1234567",
      builtAt: "2026-03-19T14:00:00.000Z",
      dirty: false,
      buildSource: "clean-worktree",
      sourceWorkspaceDirty: true,
    }
  );

  const tempDir = mkdtempSync(path.join(tmpdir(), "release-manifest-"));
  const manifestPath = path.join(tempDir, "release.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      name: "mold-gantt-v3",
      version: "1.0.0",
      commit: "abcdef1234567890abcdef1234567890abcdef12",
      commitShort: "abcdef1",
      builtAt: "2026-03-19T14:00:00.000Z",
      dirty: false,
      buildSource: "workspace",
      sourceWorkspaceDirty: false,
    }),
    "utf8"
  );

  assert.deepStrictEqual(readReleaseManifestFromFile(manifestPath), {
    name: "mold-gantt-v3",
    version: "1.0.0",
    commit: "abcdef1234567890abcdef1234567890abcdef12",
    commitShort: "abcdef1",
    builtAt: "2026-03-19T14:00:00.000Z",
    dirty: false,
    buildSource: "workspace",
    sourceWorkspaceDirty: false,
  });

  assert.deepStrictEqual(
    buildReleaseInfo({
      manifest: null,
      manifestFound: false,
      packageVersion: "1.0.0",
      runtimeStartedAt: "2026-03-19T14:00:00.000Z",
      nodeEnv: "production",
    }),
    {
      name: "mold-gantt-v3",
      version: "1.0.0",
      commit: null,
      commitShort: null,
      builtAt: null,
      dirty: null,
      buildSource: null,
      sourceWorkspaceDirty: null,
      manifestFound: false,
      nodeEnv: "production",
      runtimeStartedAt: "2026-03-19T14:00:00.000Z",
    }
  );
}

async function verifyProgressNotesGuardrails(): Promise<void> {
  const {
    SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER,
    SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE,
    assessProgressSnapshotRisk,
    selectLatestRestorableBackup,
  } = await importFresh<typeof import("../server/routes/progress-notes.ts")>(
    "server/routes/progress-notes.ts"
  );

  assert.deepStrictEqual(
    assessProgressSnapshotRisk({
      beforeCount: 6,
      afterCount: 5,
      deletedCount: 1,
    }),
    {
      beforeCount: 6,
      afterCount: 5,
      deletedCount: 1,
      reason: "none",
      requiresConfirmation: false,
    }
  );
  assert.deepStrictEqual(
    assessProgressSnapshotRisk({
      beforeCount: 2,
      afterCount: 0,
      deletedCount: 2,
    }),
    {
      beforeCount: 2,
      afterCount: 0,
      deletedCount: 2,
      reason: "clear-all",
      requiresConfirmation: true,
    }
  );
  assert.deepStrictEqual(
    assessProgressSnapshotRisk({
      beforeCount: 20,
      afterCount: 1,
      deletedCount: 19,
    }),
    {
      beforeCount: 20,
      afterCount: 1,
      deletedCount: 19,
      reason: "majority-delete",
      requiresConfirmation: true,
    }
  );
  assert.equal(
    SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER,
    "x-snapshot-confirmation"
  );
  assert.equal(SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE, "allow-destructive");

  const selected = selectLatestRestorableBackup([
    {
      id: 203,
      created_at: "2026-03-19T09:30:00.000Z",
      snapshot: [
        { id: "note-1", date: "2026-03-19", content: "only surviving row" },
      ],
    },
    {
      id: 202,
      created_at: "2026-03-19T09:00:00.000Z",
      snapshot: [
        { id: "note-1", date: "2026-03-19", content: "row 1" },
        { id: "note-2", date: "2026-03-18", content: "row 2" },
        { id: "note-3", date: "2026-03-17", content: "row 3" },
        { id: "note-4", date: "2026-03-16", content: "row 4" },
        { id: "note-5", date: "2026-03-15", content: "row 5" },
      ],
    },
    {
      id: 201,
      created_at: "2026-03-19T08:00:00.000Z",
      snapshot: [
        { id: "note-1", date: "2026-03-19", content: "row 1" },
        { id: "note-2", date: "2026-03-18", content: "row 2" },
        { id: "note-3", date: "2026-03-17", content: "row 3" },
        { id: "note-4", date: "2026-03-16", content: "row 4" },
        { id: "note-5", date: "2026-03-15", content: "row 5" },
      ],
    },
  ]);

  assert.ok(selected);
  assert.equal(selected?.id, 202);
  assert.equal(selected?.backupAt, "2026-03-19T09:00:00.000Z");
  assert.equal(selected?.snapshot.length, 5);
  assert.equal(selected?.snapshot[0]?.id, "note-1");

  const fallbackSelected = selectLatestRestorableBackup([
    { id: 303, created_at: "2026-03-19T10:00:00.000Z", snapshot: "not-json" },
    { id: 302, created_at: "2026-03-19T09:30:00.000Z", snapshot: [] },
    {
      id: 301,
      created_at: "2026-03-19T09:00:00.000Z",
      snapshot: [{ id: "note-a", date: "2026-03-19", content: "safe row" }],
    },
  ]);

  assert.equal(fallbackSelected?.id, 301);
  assert.equal(fallbackSelected?.backupAt, "2026-03-19T09:00:00.000Z");
}

async function main(): Promise<void> {
  await runCheck("server/index.ts structure", verifyServerIndexStructure);
  await runCheck(
    "server error payload structure",
    verifyServerErrorPayloadStructure
  );
  await runCheck("critical entrypoints", verifyCriticalEntrypoints);
  await runCheck("release SOP visibility", verifyReleaseSopVisibility);
  await runCheck(
    "release wrapper clean workspace policy",
    verifyReleaseWrapperCleanWorkspacePolicy
  );
  await runCheck("release gate bypass policy", verifyReleaseGateBypassPolicy);
  await runCheck("dashboard API error normalization", verifyDashboardApi);
  await runCheck("api CORS policy", verifyApiCors);
  await runCheck("api access policy", verifyApiAccessPolicy);
  await runCheck("release metadata", verifyReleaseMetadata);
  await runCheck("progress note guardrails", verifyProgressNotesGuardrails);
  console.log("[release-guard] all checks passed");
}

main().catch(error => {
  console.error("[release-guard] failed");
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error
  );
  process.exitCode = 1;
});
