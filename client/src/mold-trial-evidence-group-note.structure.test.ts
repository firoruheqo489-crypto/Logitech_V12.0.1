import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial evidence group note module", () => {
  it("keeps the group note UI and persistence envelope in the trial database", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).toContain("证据总记录 / GROUP NOTE");
    expect(source).toContain("保存记录 / SAVE");
    expect(source).toContain("删除记录 / DELETE");
    expect(source).toContain("RECORDED AT");
    expect(source).toContain("version: 3");
    expect(source).toContain("stagesByScope: evidenceByTrial");
    expect(source).toContain("groupNote: normalizedNote");
    expect(source).toContain("EVIDENCE_SLOT_COUNT = 15");
    expect(source).toContain("uploadAssetViaServer");
    expect(source).toContain("deleteAssetViaServer");
    expect(source).toContain("mold-trial-evidence");
    expect(source).toContain("saveDashboardMoldTrialEvidenceState({");
    expect(source).toContain("fetchDashboardMoldTrialEvidenceState({");
    expect(source).toContain("isEvidenceHydrated");
    expect(source).not.toContain("shadow-[0_0_0_1px_rgba(34,211,238,0.2)]");
    expect(source).not.toContain("% evidenceSlotsWithImages.length");
    expect(source).toContain("if (nextIndex < 0 || nextIndex >= evidenceSlotsWithImages.length) {");
    expect(source).toContain('event.key === "ArrowLeft"');
    expect(source).toContain('event.key === "ArrowRight"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("setShowDeleteGroupNoteConfirm(true)");
    expect(source).toContain("open={showDeleteGroupNoteConfirm}");
    expect(source).toContain("openEvidenceLightbox(slot.imageUrl)");
    expect(source).toContain('position: "bottom-right"');
  });
});
