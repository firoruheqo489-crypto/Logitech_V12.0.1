import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("cyber confirm dialog keyboard support", () => {
  it("confirms with Enter and cancels with Escape", async () => {
    const source = await loadSource("./components/ui/CyberConfirmDialog.tsx");

    expect(source).toContain("if (e.key === 'Escape') onCancel();");
    expect(source).toContain("if (e.key === 'Enter') {");
    expect(source).toContain("onConfirm();");
  });
});
