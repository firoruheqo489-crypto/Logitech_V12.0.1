import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('generic ui error boundaries', () => {
  it('keeps product image upload errors on a generic ui message', async () => {
    const source = await loadSource('./components/ProductImageUpload.tsx');

    expect(source).toContain("throw new Error('Project image update failed');");
    expect(source).toContain("setError('项目图片更新失败，请稍后重试');");
    expect(source).not.toContain("setError(e instanceof Error ? e.message : '上传失败');");
  });

  it('keeps evidence upload errors on a generic ui message', async () => {
    const source = await loadSource('./components/v3/EvidenceUpload.tsx');

    expect(source).toContain("throw new Error('Evidence save failed');");
    expect(source).toContain("setError('证据上传失败，请稍后重试');");
    expect(source).not.toContain("setError(e instanceof Error ? e.message : '上传失败');");
  });

  it('keeps project lobby load failures on a generic ui message', async () => {
    const source = await loadSource('./components/ProjectLobby.tsx');

    expect(source).toContain('throw new Error("Project list load failed");');
    expect(source).toContain('setError("项目列表加载失败，请稍后重试");');
    expect(source).not.toContain('throw new Error(`HTTP ${response.status}`);');
    expect(source).not.toContain('setError(err instanceof Error ? err.message : "数据加载失败");');
  });

  it('keeps s-curve load failures on a generic ui message', async () => {
    const source = await loadSource('./components/logitech-s-curve.tsx');

    expect(source).toContain("throw new Error('S-curve data load failed')");
    expect(source).toContain("setError('数据加载失败，请稍后重试')");
    expect(source).not.toContain("const message = typeof record?.error === 'string' ? record.error : `HTTP ${res.status}`");
    expect(source).not.toContain("setError(error instanceof Error ? error.message : '数据加载失败')");
  });
});
