import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('mold trial stage persistence', () => {
  it('keeps trial stage state persisted across refreshes', async () => {
    const source = await loadSource('./pages/dashboard/components/MoldTrialDatabase.tsx');

    expect(source).toContain('mold-trial-cleared-stages:');
    expect(source).toContain('setClearedTrialStages(');
    expect(source).toContain('writeStoredTrialStages(trialStageStorageKey, nextTrialStages)');
    expect(source).toContain('writeStoredClearedTrialStages(');
  });
});
