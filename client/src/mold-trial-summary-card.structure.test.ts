import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial summary card hierarchy", () => {
  it("renders the four summary cards below machine parameters as a single row with two-line labels", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).toContain("labelCn: string;");
    expect(source).toContain("labelEn: string;");
    expect(source).toContain("text-[13px] font-bold tracking-[0.15em] text-slate-100 md:text-sm");
    expect(source).toContain("text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:text-[10px]");
    expect(source).toContain("原料");
    expect(source).toContain("shadow-[0_12px_30px_rgba(2,8,23,0.35)]");
    const machineHeadingIndex = source.indexOf(
      'TrialModuleHeading titleCn="机台参数" titleEn="Machine Parameters"'
    );
    const summaryCardsIndex = source.indexOf("currentData.summaryCards.map(card => (");

    expect(machineHeadingIndex).toBeGreaterThanOrEqual(0);
    expect(summaryCardsIndex).toBeGreaterThanOrEqual(0);
    expect(summaryCardsIndex).toBeGreaterThan(machineHeadingIndex);
    expect(source).toContain("grid grid-cols-2 lg:grid-cols-4 gap-4");
  });
});
