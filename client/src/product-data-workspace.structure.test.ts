import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('product data workspace error boundaries', () => {
  it('keeps project asset save failures on normalized dashboard api errors only', async () => {
    const source = await loadSource('./pages/dashboard/components/ProductDataWorkspace.tsx');

    expect(source).toContain(
      "throw normalizeDashboardApiError(normalizedPayload, response.status, 'PROJECT_ASSET_SAVE_FAILED');",
    );
    expect(source).not.toContain("throw new Error((payload as { error?: string }).error || '数据库保存失败');");
  });

  it('keeps project asset delete failures on normalized dashboard api errors only', async () => {
    const source = await loadSource('./pages/dashboard/components/ProductDataWorkspace.tsx');

    expect(source).toContain(
      "throw normalizeDashboardApiError(normalizedPayload, response.status, 'PROJECT_ASSET_DELETE_FAILED');",
    );
    expect(source).not.toContain("throw new Error((payload as { error?: string }).error || '数据库删除失败');");
  });

  it('keeps upload and delete slot errors on generic display mapping only', async () => {
    const source = await loadSource('./pages/dashboard/components/ProductDataWorkspace.tsx');

    expect(source).toContain("[slotKey]: getDashboardApiErrorDisplayMessage(error, 'Delete failed'),");
    expect(source).toContain("[slotKey]: getDashboardApiErrorDisplayMessage(error, 'Upload failed'),");
    expect(source).not.toContain("const message = error instanceof Error ? error.message : '删除失败';");
    expect(source).not.toContain("const message = error instanceof Error ? error.message : '上传失败';");
    expect(source).not.toContain("setSlotErrors((prev) => ({ ...prev, [slotKey]: message }));");
  });

  it('keeps stored asset bootstrap failures silent instead of leaking raw HTTP status text', async () => {
    const source = await loadSource('./pages/dashboard/components/ProductDataWorkspace.tsx');

    expect(source).toMatch(/if \(!response\.ok\) \{\s*return;\s*\}/s);
    expect(source).not.toContain('throw new Error(`HTTP ${response.status}`);');
  });
});
