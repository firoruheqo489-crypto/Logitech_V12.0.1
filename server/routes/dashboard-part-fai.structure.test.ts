import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard part FAI namespace', () => {
  it('uses a v2 table so legacy contaminated rows are ignored', async () => {
    const source = await loadSource('./dashboard-part-fai.ts');

    expect(source).toContain("dashboard_part_fai_states_v2");
  });
});
