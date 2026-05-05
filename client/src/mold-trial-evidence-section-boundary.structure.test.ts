import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial evidence section boundary", () => {
  it("keeps mold-temperature and appearance evidence uploads in separate slot ranges", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).toContain("getEvidenceSectionRangeBySlotId");
    expect(source).toContain("getEvidenceSectionSlots");
    expect(source).toContain("MOLD_TEMP_EVIDENCE_SLOT_COUNT");
    expect(source).toContain("DEFECT_EVIDENCE_SLOT_COUNT");
    expect(source).toContain(
      "const boundedSlots = getEvidenceSectionSlots(currentSlots, startSlotId)"
    );
    expect(source).toContain("boundedSlots.slice(startIndex)");
    expect(source).not.toContain(
      "startIndex >= 0 ? currentSlots.slice(startIndex) : currentSlots"
    );
  });
});
