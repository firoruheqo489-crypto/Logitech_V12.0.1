import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('tooling FAI identity wiring', () => {
  it('passes moldId, moldNo, and trialStage into remote load/save/delete calls', async () => {
    const source = await loadSource('./pages/dashboard/components/tooling-fai-parser.tsx');

    expect(source).toContain('fetchToolingFaiState({ moldId, moldNo, trialStage })');
    expect(source).toContain('deleteToolingFaiState({ moldId, moldNo, trialStage })');
    expect(source).toContain('moldId,');
    expect(source).toContain('moldNo,');
    expect(source).toContain('trialStage,');
  });
});