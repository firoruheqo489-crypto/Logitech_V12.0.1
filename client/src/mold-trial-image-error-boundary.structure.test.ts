import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('mold trial image error boundary', () => {
  it('keeps evidence image processing failures on a generic alert message', async () => {
    const source = await loadSource('./pages/dashboard/components/MoldTrialDatabase.tsx');

    expect(source).toContain('window.alert("图片处理失败，请稍后重试");');
    expect(source).not.toContain('window.alert(error instanceof Error ? error.message : "图片处理失败");');
  });
});
