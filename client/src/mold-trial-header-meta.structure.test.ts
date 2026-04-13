import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial header meta", () => {
  it("removes the inline mold id meta from the header title row", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).not.toContain("{moldNo ? `${moldId} | ${moldNo}` : moldId}");
    expect(source).not.toContain("text-xs font-mono text-slate-500");
  });
});
