import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('gantt ui error boundaries', () => {
  it('keeps product image upload failures on a generic message before legacy payload parsing', async () => {
    const source = await loadSource('./components/ProductImageUpload.tsx');

    expect(source).toMatch(
      /if \(!res\.ok\) \{\s*throw new Error\('Project image update failed'\);\s*const j = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\);/s,
    );
  });

  it('keeps evidence upload failures on a generic message before legacy payload parsing', async () => {
    const source = await loadSource('./components/v3/EvidenceUpload.tsx');

    expect(source).toMatch(
      /if \(!res\.ok\) \{\s*throw new Error\('Evidence save failed'\);\s*const j = await res\.json\(\)\.catch\(\(\) => \(\{\}\)\);/s,
    );
  });

  it('keeps gantt clear failures on a generic toast only', async () => {
    const source = await loadSource('./pages/GanttV3.tsx');

    expect(source).toMatch(
      /\} else \{\s*toast\.error\('Clear failed, please retry'\);\s*return;\s*\}/s,
    );
    expect(source).toMatch(
      /\} catch \{\s*toast\.error\('Clear failed, please retry'\);\s*return;\s*\}/s,
    );
    expect(source).not.toContain('res.statusText');
  });
});
