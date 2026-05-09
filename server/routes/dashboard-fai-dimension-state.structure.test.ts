import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(): Promise<string> {
  return readFile(path.resolve(__dirname, 'dashboard-fai-dimension-state.ts'), 'utf8');
}

describe('dashboard FAI dimension state payload storage', () => {
  it('persists parsed workbook JSON in the FAI dimension state table', async () => {
    const source = await loadSource();

    expect(source).toContain('payload_json JSONB');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS payload_json JSONB');
    expect(source).toContain('payload: row.payload_json ?? null');
    expect(source).toContain('const payloadJson = body.payload === undefined ? null : JSON.stringify(body.payload);');
    expect(source).toContain('payload_json = EXCLUDED.payload_json');
  });
});
