import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ganttMergeLinesPath = path.resolve(__dirname, 'components', 'v3', 'GanttMergeLines.tsx');

async function loadSource(): Promise<string> {
  return readFile(ganttMergeLinesPath, 'utf8');
}

describe('GanttMergeLines structure', () => {
  it('uses canonical ids and stages instead of localized names for merge detection', async () => {
    const source = await loadSource();

    expect(source).toContain("r.task.id === 'mold_fai_cpk'");
    expect(source).toContain("r.task.stage === 'mtd'");
    expect(source).toContain("r.task.stage === 'milling'");
  });

  it('keeps localized task names out of merge-line matching logic', async () => {
    const source = await loadSource();

    expect(source).not.toContain("task.nameCn.includes('模具Fai')");
    expect(source).not.toContain("task.nameCn === '铣床'");
    expect(source).not.toContain("task.nameCn === 'MTD'");
  });
});
