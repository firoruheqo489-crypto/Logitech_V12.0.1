import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..', 'server');

async function collectServerSourceFiles(root: string): Promise<string[]> {
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

async function loadServerSources(): Promise<Array<{ path: string; source: string }>> {
  const files = await collectServerSourceFiles(serverRoot);
  return Promise.all(files.map(async (filePath) => ({
    path: path.relative(serverRoot, filePath),
    source: await readFile(filePath, 'utf8'),
  })));
}

function findInlineErrorJsonBlocks(source: string): string[] {
  return Array.from(
    source.matchAll(/res\.status\([^)]*\)\.json\(\{\s*error\s*:[\s\S]*?\}\);/g),
    (match) => match[0],
  );
}

describe('server error payload structure', () => {
  it('keeps every inline error JSON response machine-readable with an error code', async () => {
    const sources = await loadServerSources();
    const violations = sources.flatMap(({ path: filePath, source }) =>
      findInlineErrorJsonBlocks(source)
        .filter((block) => !/\bcode\b\s*(?::|,)/.test(block))
        .map((block) => `${filePath}: ${block}`),
    );

    expect(violations).toEqual([]);
  });

  it('does not expose err.message or error.message inside JSON responses', async () => {
    const sources = await loadServerSources();
    const violations = sources.flatMap(({ path: filePath, source }) => {
      const matches = source.match(
        /res\.(?:status\([^)]*\)\.)?json\([\s\S]*?(?:err|error)\.message[\s\S]*?\);/g,
      );

      return (matches ?? []).map((match) => `${filePath}: ${match}`);
    });

    expect(violations).toEqual([]);
  });
});
