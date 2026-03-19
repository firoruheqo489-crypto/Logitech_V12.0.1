import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('product module upload error mapping', () => {
  it('keeps unknown upload failures on a generic fallback message', async () => {
    const source = await loadSource('./pages/dashboard/components/ProductModuleAdminModal.tsx');

    expect(source).toContain('return DEFAULT_UPLOAD_ERROR_MESSAGE;');
    expect(source).not.toContain('return normalized;');
  });
});
