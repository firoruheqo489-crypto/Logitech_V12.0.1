import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readServerFile(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('production dashboard performance guards', () => {
  it('keeps database connections alive longer than the dashboard list cache', async () => {
    const [dbSource, dashboardSource] = await Promise.all([
      readServerFile('db.ts'),
      readServerFile('routes/dashboard.ts'),
    ]);

    expect(dbSource).toContain("process.env.DB_IDLE_TIMEOUT_SECONDS || '600'");
    expect(dbSource).toContain('idle_timeout: idleTimeoutSeconds');
    expect(dashboardSource).toContain("process.env.DASHBOARD_PROJECTS_CACHE_TTL_MS || '300000'");
    expect(dashboardSource).toContain('invalidateDashboardProjectsListCache();');

    const idleSeconds = Number(dbSource.match(/DB_IDLE_TIMEOUT_SECONDS \|\| '(\d+)'/)?.[1]);
    const cacheMilliseconds = Number(dashboardSource.match(/DASHBOARD_PROJECTS_CACHE_TTL_MS \|\| '(\d+)'/)?.[1]);
    expect(idleSeconds * 1_000).toBeGreaterThan(cacheMilliseconds);
  });

  it('compresses production responses before security and api routes run', async () => {
    const source = await readServerFile('index.ts');
    const compressionIndex = source.indexOf('app.use(compression({ threshold: 1_024 }));');
    const securityIndex = source.indexOf('app.use(securityHeaders);');
    const firstApiRouteIndex = source.indexOf('app.get("/api/release"');

    expect(source).toContain('import compression from "compression";');
    expect(compressionIndex).toBeGreaterThanOrEqual(0);
    expect(securityIndex).toBeGreaterThan(compressionIndex);
    expect(firstApiRouteIndex).toBeGreaterThan(securityIndex);
  });

  it('short-circuits repeated requests for missing OSS objects', async () => {
    const source = await readServerFile('routes/uploads.ts');

    expect(source).toContain('const MISSING_OSS_OBJECT_CACHE_TTL_MS = 60_000;');
    expect(source).toContain('if (isMissingOssObjectCached(objectKey))');
    expect(source).toContain('rememberMissingOssObject(objectKey);');
    expect(source).toContain("res.setHeader('Cache-Control', 'private, max-age=60');");
  });
});
