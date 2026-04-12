import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('mold trial stage sync', () => {
  it('only saves trial stages after an explicit user add or delete request', async () => {
    const source = await loadSource('./pages/dashboard/components/MoldTrialDatabase.tsx');

    expect(source).toContain('const [trialStageSaveRequestId, setTrialStageSaveRequestId] = useState(0);');
    expect(source).toContain('setTrialStageSaveRequestId(0);');
    expect(source).toContain('if (trialStageSaveRequestId === 0) return;');
    expect(source).toContain('setTrialStageSaveRequestId(current => current + 1);');
  });
});
