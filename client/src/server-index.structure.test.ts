import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverIndexPath = path.resolve(__dirname, '..', '..', 'server', 'index.ts');

async function loadServerIndexSource(): Promise<string> {
  return readFile(serverIndexPath, 'utf8');
}

function findMatchIndex(source: string, pattern: RegExp): number {
  const match = pattern.exec(source);
  return match?.index ?? -1;
}

describe('server/index.ts structure', () => {
  it('imports the shared api access policy from the middleware module', async () => {
    const source = await loadServerIndexSource();

    expect(source).toMatch(
      /import\s*\{\s*registerApiAccessPolicy\s*\}\s*from\s*["']\.\/middleware\/apiAccessPolicy\.js["'];/,
    );
  });

  it('imports the release metadata handler from the shared server module', async () => {
    const source = await loadServerIndexSource();

    expect(source).toMatch(
      /import\s*\{\s*getReleaseInfoHandler\s*\}\s*from\s*["']\.\/release\.js["'];/,
    );
  });

  it('registers the shared api access policy before api routes are declared', async () => {
    const source = await loadServerIndexSource();
    const securityHeadersIndex = findMatchIndex(source, /app\.use\(securityHeaders\);/);
    const registerPolicyIndex = findMatchIndex(source, /registerApiAccessPolicy\(app\);/);
    const firstApiRouteIndex = findMatchIndex(source, /app\.get\(["']\/api\/health["']/);

    expect(securityHeadersIndex).toBeGreaterThanOrEqual(0);
    expect(registerPolicyIndex).toBeGreaterThan(securityHeadersIndex);
    expect(firstApiRouteIndex).toBeGreaterThan(registerPolicyIndex);
  });

  it('keeps api access policy wiring out of server/index.ts inline middleware blocks', async () => {
    const source = await loadServerIndexSource();

    expect(source).not.toMatch(/app\.use\(['"]\/api['"],\s*\(req,\s*res,\s*next\)\s*=>/);
  });

  it('keeps trusted origin and access-control header details inside shared middleware modules', async () => {
    const source = await loadServerIndexSource();

    expect(source).not.toContain('TRUSTED_ORIGINS');
    expect(source).not.toContain('Access-Control-Allow-Origin');
    expect(source).not.toContain('Access-Control-Allow-Methods');
    expect(source).not.toContain('Access-Control-Allow-Headers');
    expect(source).not.toContain('Access-Control-Allow-Credentials');
    expect(source).not.toContain('CORS origin denied');
  });

  it('registers the release metadata route before the health route', async () => {
    const source = await loadServerIndexSource();
    const releaseRouteIndex = findMatchIndex(
      source,
      /app\.get\(["']\/api\/release["'],\s*getReleaseInfoHandler\);/,
    );
    const healthRouteIndex = findMatchIndex(source, /app\.get\(["']\/api\/health["']/);

    expect(releaseRouteIndex).toBeGreaterThanOrEqual(0);
    expect(healthRouteIndex).toBeGreaterThan(releaseRouteIndex);
  });

  it('keeps the dashboard clear route in the verified route cluster order', async () => {
    const source = await loadServerIndexSource();
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

    expect(batchUpsertIndex).toBeGreaterThanOrEqual(0);
    expect(clearProjectsIndex).toBeGreaterThan(batchUpsertIndex);
    expect(healthCheckIndex).toBeGreaterThan(clearProjectsIndex);
  });

  it('registers the granular progress note write route before backup and restore tools', async () => {
    const source = await loadServerIndexSource();
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

    expect(entryRouteIndex).toBeGreaterThanOrEqual(0);
    expect(createBackupIndex).toBeGreaterThan(entryRouteIndex);
    expect(restoreLatestIndex).toBeGreaterThan(createBackupIndex);
  });

  it('keeps the dev-api-only fallback on a machine-readable error payload', async () => {
    const source = await loadServerIndexSource();

    expect(source).toMatch(
      /res\.status\(404\)\.json\(\{\s*error:\s*"not found \(dev API only\)",\s*code:\s*"ROUTE_NOT_FOUND"\s*\}\);/,
    );
  });
});
