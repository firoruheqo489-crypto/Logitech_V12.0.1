import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadUploadsRouteSource(): Promise<string> {
  return readFile(path.resolve(__dirname, 'uploads.ts'), 'utf8');
}

describe('uploads route file type guard', () => {
  it('allows dimension analyzer JSON snapshots through the shared upload endpoint', async () => {
    const source = await loadUploadsRouteSource();

    expect(source).toContain("const STANDARD_JSON_MIME_TYPE = 'application/json';");
    expect(source).toContain("[STANDARD_JSON_MIME_TYPE]: new Set(['.json']),");
    expect(source).toMatch(
      /if \(extension === '\.json' && JSON_COMPATIBLE_MIME_TYPES\.has\(mimetype\)\) \{\s*return STANDARD_JSON_MIME_TYPE;\s*\}/,
    );
  });
});
