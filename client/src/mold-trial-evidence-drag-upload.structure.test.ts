import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial evidence drag upload", () => {
  it("keeps the evidence gallery as a bounded drag-and-drop batch uploader", async () => {
    const source = await loadSource("./pages/dashboard/components/MoldTrialDatabase.tsx");

    expect(source).toContain("handleEvidenceFilesUpload");
    expect(source).toContain("multiple");
    expect(source).toContain("onDrop={handleEvidenceDrop}");
    expect(source).toContain("松开即可批量上传图片，最多自动填充 10 张");
    expect(source).toContain("支持拖拽多张图片到这里，或点击空位多选上传，最多补满 10 张。");
    expect(source).toContain("证据位已满");
  });
});
