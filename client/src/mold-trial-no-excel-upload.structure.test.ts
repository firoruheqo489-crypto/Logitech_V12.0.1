import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial database document surface", () => {
  it("removes Excel import affordances and keeps the landscape A4 page independent", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).toContain("\u6a2a\u5411 A4 \u9875\u9762");
    expect(source).toContain("LANDSCAPE A4");
    expect(source).toContain("A4 Landscape Page");
    expect(source).toContain("showA4Preview");
    expect(source).toContain("A4_GALLERY_ITEM_ID");
    expect(source).toContain("evidenceLightboxScope");
    expect(source).toContain("evidenceLightboxItemId");
    expect(source).toContain("a4ImageUrl");
    expect(source).toContain("a4ImageInputRef");
    expect(source).toContain("handleA4ImageUpload");
    expect(source).toContain("renderLandscapeA4Preview");
    expect(source).toContain("renderA4PageCanvas");
    expect(source).toContain("aspect-[297/210]");
    expect(source).toContain("border border-slate-700 bg-slate-950/40 p-6 text-left text-slate-100");
    expect(source).toContain("border border-dashed border-slate-600 bg-slate-950/40");
    expect(source).toContain("cursor-zoom-in");
    expect(source).toContain("openEvidenceLightbox(");
    expect(source).toContain("renderEvidenceSlotGrid(moldTempEvidenceSlots, \"mold-temp\")");
    expect(source).toContain("renderEvidenceSlotGrid(defectEvidenceSlots, \"defect\")");
    expect(source).toContain("ChevronLeft");
    expect(source).toContain("ChevronRight");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("\u4e0a\u4f20\u6a2a\u5411A4\u56fe\u7247");
    expect(source).toContain("\u6253\u5f00\u6a2a\u5411A4\u56fe\u7247");
    expect(source).toContain("mold-trial-a4");

    expect(source).not.toContain("\u5bfc\u5165Excel");
    expect(source).not.toContain("handleExcelImport");
    expect(source).not.toContain("handleExcelImportClick");
    expect(source).not.toContain("parseImportedMoldTrialWorkbook");
    expect(source).not.toContain('accept=".xlsx,.xls"');
    expect(source).not.toContain("FileSpreadsheet");
    expect(source).not.toContain("handleExportExcel");
    expect(source).not.toContain("exportMoldTrialWorkbook");
    expect(source).not.toContain("renderA4ImageTile");
    expect(source).not.toContain("isA4LightboxOpen");
    expect(source).not.toContain("border border-slate-300 bg-white p-6 text-left text-slate-900");
    expect(source).not.toContain("border border-dashed border-slate-300 bg-white");
    expect(source).not.toContain("moldTempEvidenceSlots.map");
    expect(source).not.toContain("defectEvidenceSlots.map");
  });
});
