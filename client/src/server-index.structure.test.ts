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

  it('registers the shared api access policy before api routes are declared', async () => {
    const source = await loadServerIndexSource();
    const securityHeadersIndex = findMatchIndex(source, /app\.use\(securityHeaders\);/);
    const registerPolicyIndex = findMatchIndex(source, /registerApiAccessPolicy\(app\);/);
    const firstApiRouteIndex = findMatchIndex(source, /app\.get\(["']\/api\/health["']/);

    expect(securityHeadersIndex).toBeGreaterThanOrEqual(0);
    expect(registerPolicyIndex).toBeGreaterThan(securityHeadersIndex);
    expect(firstApiRouteIndex).toBeGreaterThan(registerPolicyIndex);
  });

  it('keeps the dev-api-only fallback on a machine-readable error payload', async () => {
    const source = await loadServerIndexSource();

    expect(source).toMatch(
      /res\.status\(404\)\.json\(\{\s*error:\s*"not found \(dev API only\)",\s*code:\s*"ROUTE_NOT_FOUND"\s*\}\);/,
    );
  });
});
