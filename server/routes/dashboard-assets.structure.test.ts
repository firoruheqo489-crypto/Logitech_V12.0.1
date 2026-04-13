import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), 'utf8');
}

describe('dashboard project asset slot registry', () => {
  it('accepts the secondary product module slots while keeping legacy slot compatibility', async () => {
    const source = await loadSource('./dashboard-assets.ts');

    expect(source).toContain("'product2d'");
    expect(source).toContain("'product3dExtra'");
    expect(source).toContain("'productPhotoExtra'");
    expect(source).toContain("'mold3dExtra'");
    expect(source).toContain("'moldPhotoExtra'");
  });
});
