import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial database excel import", () => {
  it("keeps import in the header and removes export affordances", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );

    expect(source).toContain("导入Excel");
    expect(source).toContain("handleExcelImport");
    expect(source).toContain("handleExcelImportClick");
    expect(source).toContain("parseImportedMoldTrialWorkbook");
    expect(source).toContain('accept=".xlsx,.xls"');
    expect(source).toContain("FileSpreadsheet");
    expect(source).not.toContain("导出Excel");
    expect(source).not.toContain("handleExportExcel");
    expect(source).not.toContain("exportMoldTrialWorkbook");
    expect(source).not.toContain("Download");
  });
});
