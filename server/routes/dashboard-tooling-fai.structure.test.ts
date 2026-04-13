import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard tooling FAI namespace', () => {
  it('uses a v2 table so legacy browser-only state is ignored', async () => {
    const source = await loadSource('./dashboard-tooling-fai.ts');

    expect(source).toContain('dashboard_tooling_fai_states_v2');
  });

  it('isolates state by moldId, moldNo, and trialStage at the database level', async () => {
    const source = await loadSource('./dashboard-tooling-fai.ts');

    expect(source).toContain('UNIQUE (mold_id, mold_no, trial_stage)');
    expect(source).toContain('WHERE mold_id = $1 AND mold_no = $2 AND trial_stage = $3');
    expect(source).toContain('DELETE FROM ${TOOLING_FAI_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2 AND trial_stage = $3');
  });
});