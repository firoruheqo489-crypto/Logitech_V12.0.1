import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard project gantt state namespace', () => {
  it('stores workspace shell and per-board gantt snapshots independently', async () => {
    const source = await loadSource('./dashboard-project-gantt-state.ts');

    expect(source).toContain('dashboard_project_gantt_states_v1');
    expect(source).toContain('workspace_key VARCHAR(120) PRIMARY KEY');
    expect(source).toContain('boards JSONB NOT NULL DEFAULT');
    expect(source).toContain('active_board_id VARCHAR(120) NOT NULL');
    expect(source).toContain('board_state_by_id JSONB NOT NULL DEFAULT');
    expect(source).toContain('WHERE workspace_key = $1');
  });
});
