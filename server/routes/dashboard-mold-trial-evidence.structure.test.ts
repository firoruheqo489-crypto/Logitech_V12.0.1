import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard mold trial evidence namespace', () => {
  it('uses a dedicated v2 table and isolates state by moldId plus moldNo', async () => {
    const source = await loadSource('./dashboard-mold-trial-evidence.ts');

    expect(source).toContain('dashboard_mold_trial_evidence_states_v2');
    expect(source).toContain('UNIQUE (mold_id, mold_no)');
    expect(source).toContain('trial_stages JSONB NOT NULL DEFAULT');
    expect(source).toContain('cleared_trial_stages JSONB NOT NULL DEFAULT');
    expect(source).toContain('WHERE mold_id = $1 AND mold_no = $2');
    expect(source).toContain('DELETE FROM ${MOLD_TRIAL_EVIDENCE_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2');
  });
});
