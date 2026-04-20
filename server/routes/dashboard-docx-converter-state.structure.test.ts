import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard docx converter namespace', () => {
  it('stores docx converter state by moldId + moldNo with independent trial maps', async () => {
    const source = await loadSource('./dashboard-docx-converter-state.ts');

    expect(source).toContain('dashboard_docx_converter_states_v1');
    expect(source).toContain('UNIQUE (mold_id, mold_no)');
    expect(source).toContain('trial_stages JSONB NOT NULL DEFAULT');
    expect(source).toContain('active_trial VARCHAR(50) NOT NULL');
    expect(source).toContain('stage_state_by_trial JSONB NOT NULL DEFAULT');
    expect(source).toContain('WHERE mold_id = $1 AND mold_no = $2');
  });
});
