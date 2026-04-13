import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial machine parameter typography", () => {
  it("renders the three parameter columns with larger typography", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).toContain("text-xl font-mono tabular-nums text-slate-50 md:text-2xl");
    expect(source).toContain("text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 md:text-xs");
    expect(source).toContain("flex flex-col leading-tight");
    expect(source).toContain("text-[13px] font-bold text-slate-100 uppercase tracking-[0.15em] md:text-sm");
    expect(source).toContain("mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 md:text-[11px]");
    expect(source).toContain("rounded-2xl p-6 shadow-inner flex flex-col gap-4 md:p-7 md:gap-5");
    expect(source).not.toContain("1~4段");
    expect(source).not.toContain("Z1~Z8");
  });
});
