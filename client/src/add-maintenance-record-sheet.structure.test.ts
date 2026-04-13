import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("add maintenance record sheet symptom layout", () => {
  it("keeps symptom as a single-line input without a diagnosis field", async () => {
    const source = await loadSource(
      "./components/mold-health/add-maintenance-record-sheet.tsx"
    );

    expect(source).toContain('value={form.symptom}');
    expect(source).not.toContain('value={form.diagnosis}');
    expect(source).not.toContain('FieldLabel zh="诊断" en="DIAGNOSIS"');
    expect(source).toContain('className="h-11 border-slate-700 bg-slate-950/70 text-slate-100"');
    expect(source).not.toContain('rows={3}');
    expect(source).not.toContain('min-h-24 rounded-xl border-slate-700 bg-slate-950/70 text-slate-100');
    expect(source).not.toContain('md:col-span-2');
  });
});
