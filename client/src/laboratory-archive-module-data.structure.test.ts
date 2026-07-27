import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("laboratory archive module data restoration", () => {
  it("passes archive snapshots into every laboratory workspace", async () => {
    const source = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    expect(source.match(/initialSummary=\{context\?\.initialSummary\}/g)).toHaveLength(11);
    expect(source).toContain("initialSummary={nodeSummaries[node.id]}");
  });

  it("stores complete module payloads instead of summary-only records", async () => {
    const sources = await Promise.all([
      loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx"),
      loadSource("./pages/dashboard/components/DarkroomTelemetryWorkspace.tsx"),
      loadSource("./pages/dashboard/components/FlickerTelemetryWorkspace.tsx"),
      loadSource("./pages/dashboard/components/EmcRadiationWorkspace.tsx"),
      loadSource("./pages/dashboard/components/HarmonicTelemetryWorkspace.tsx"),
      loadSource("./pages/dashboard/components/ReliabilityCalculatorDashboard.tsx"),
      loadSource("./pages/dashboard/components/TimeSeriesDashboard.tsx"),
      loadSource("./pages/dashboard/components/battery-cycle/BatteryCycleDashboard.tsx"),
      loadSource("./pages/dashboard/components/laboratory/ProductIllustrationGallery.tsx"),
    ]);

    for (const source of sources) {
      expect(source).toContain("moduleData:");
      expect(source).toContain("initialSummary");
    }
  });

  it("clears the completed draft after archiving and starts from an empty node", async () => {
    const source = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    expect(source).toContain("clearLaboratoryWorkspaceDraft(projectId)");
    expect(source).toContain("setNodes([{ id: 1, type: null, isConfirmed: false }])");
    expect(source).toContain("setDraftSelections({ 1: \"\" })");
    expect(source).toContain("setNodeSummaries({})");
    expect(source).toContain("reportMeta, selectedSpecId");
    expect(source).toContain('dashboard:laboratory-workspace-draft:v2');
    expect(source).toContain("clearDraftAfterArchiveRef.current = true");
    expect(source).toContain("window.localStorage.removeItem(`${LEGACY_LABORATORY_WORKSPACE_DRAFT_PREFIX}:${projectId}`)");
    expect(source).toMatch(/const handleReturnToArchiveLedger[\s\S]*clearLaboratoryWorkspaceDraft\(projectId\)/);
    expect(source).toMatch(/const handleReturnToArchiveLedger[\s\S]*setNodes\(\[\{ id: 1, type: null, isConfirmed: false \}\]\)/);
  });

  it("uses only the engineering specification image in the archive ledger", async () => {
    const dashboardSource = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    const panelSource = await loadSource("./pages/dashboard/components/laboratory/LaboratoryArchivePanel.tsx");
    const serverSource = await loadSource("../../server/routes/dashboard-laboratory-archive.ts");

    expect(dashboardSource).toContain("imageUrl: displayedSpecImageUrl");
    expect(serverSource).toContain("await resolveEngineeringSpecMapping(projectId, state.selectedSpecId)");
    expect(serverSource).toContain("const imageUrl = normalizeText(state.imageUrl, 400000) || undefined");
    expect(serverSource).toContain("state.inspectionTestProject")
    expect(panelSource).toContain('className="text-center">实物图</span>');
    expect(panelSource).toContain('className="text-center">样品类型</span>');
    expect(panelSource).not.toContain("<span>报告编号</span>");
    expect(panelSource).toContain("台账序号");
    expect(panelSource).toContain('record.specSequence ?? "--"');
    expect(serverSource).toContain("const specSequence = Number(document.sequence) || undefined");
  });

  it("locks archived report headers and ledger sequences in both UI and API updates", async () => {
    const dashboardSource = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    const panelSource = await loadSource("./pages/dashboard/components/laboratory/LaboratoryArchivePanel.tsx");
    const archiveApiSource = await loadSource("./lib/laboratory-archive-api.ts");
    const serverSource = await loadSource("../../server/routes/dashboard-laboratory-archive.ts");

    expect(dashboardSource).toContain('台账序号 · {isArchiveHeaderLocked ? "归档锁定" : "可选择"}');
    expect(dashboardSource).toContain("已归档报告的台账序号和映射表头不可修改");
    expect(dashboardSource).toContain("if (isArchiveHeaderLocked) return");
    expect(dashboardSource).toContain("documentId: wasEditingArchivedReport ? restoredArchiveDocumentId : undefined");
    expect(panelSource).toContain("onRestoreArchive(snapshot)");
    expect(archiveApiSource).toContain("documentId: documentId?.trim() || undefined");
    expect(serverSource).toContain("reportMeta: requestedSnapshot.state.reportMeta");
    expect(serverSource).toContain("requestedSnapshot.state.selectedSpecSequence ?? requestedSnapshot.document.specSequence");
  });

  it("maps the manual PASS or FAIL decision into archives and printed reports", async () => {
    const dashboardSource = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    const printSource = await loadSource("./pages/dashboard/components/laboratory/LaboratoryPrintSurface.tsx");
    const archiveApiSource = await loadSource("./lib/laboratory-archive-api.ts");
    const serverSource = await loadSource("../../server/routes/dashboard-laboratory-archive.ts");

    expect(dashboardSource).toContain("useState<LaboratoryFinalVerdict | null>(null)");
    expect(dashboardSource).toContain('onClick={() => setFinalVerdict("PASS")}');
    expect(dashboardSource).toContain('onClick={() => setFinalVerdict("FAIL")}');
    expect(dashboardSource).toContain('toast.error("请先选择最终判定"');
    expect(dashboardSource).toContain('finalVerdict={finalVerdict ?? "FAIL"}');
    expect(printSource).toContain("最终判定：{finalVerdict}");
    expect(archiveApiSource).toContain("finalVerdict?: LaboratoryFinalVerdict");
    expect(serverSource).toContain('INVALID_LABORATORY_ARCHIVE_FINAL_VERDICT');
    expect(serverSource).toContain("verdict: finalVerdict");
    expect(serverSource).toContain('snapshot.state.finalVerdict === "PASS" || snapshot.state.finalVerdict === "FAIL"');
    expect(serverSource).toContain("document.verdict !== verdict");
  });

  it("keeps the laboratory final-sample initial source stable after uploads", async () => {
    const dashboardSource = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    const contextSource = await loadSource("./pages/dashboard/components/final-sample-report/report-data-context.tsx");

    expect(dashboardSource).toContain("useState<PersistedReportSource | undefined>(() => (");
    expect(dashboardSource).toContain("enableBrowserPersistence={false}");
    expect(contextSource).toContain("enableBrowserPersistence = true");
    expect(contextSource).toContain("const persisted = enableBrowserPersistence ? readPersistedSource() : null");
    expect(contextSource).toContain("[enableBrowserPersistence, initialSource]");
  });

  it("persists matching delivery and completion date fields in the specification workspace", async () => {
    const source = await loadSource("./pages/dashboard/components/ProductSpecExcelParserDashboard.tsx");
    const workspaceApi = await loadSource("./pages/dashboard/lib/engineering-spec-workspace-state-api.ts");
    const archiveApi = await loadSource("./lib/engineering-spec-ledger-api.ts");

    expect(source).toContain(">完成日期</p>");
    expect(source).toContain("ref={completionDateInputRef}");
    expect(source).toContain("completionDate: inspectionTestProject.completionDate || undefined");
    expect(source).not.toContain(">测试项目</p>");
    expect(workspaceApi).toContain("completionDate?: string;");
    expect(archiveApi).toContain("completionDate?: string;");
  });

  it("maps only the specification completion date into the laboratory archive ledger", async () => {
    const dashboardSource = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    const panelSource = await loadSource("./pages/dashboard/components/laboratory/LaboratoryArchivePanel.tsx");
    const archiveApiSource = await loadSource("./lib/laboratory-archive-api.ts");
    const serverSource = await loadSource("../../server/routes/dashboard-laboratory-archive.ts");

    expect(panelSource).toContain('className="text-center">完成日期</span>');
    expect(panelSource).toContain('record.completionDate || "--"');
    expect(panelSource).not.toContain('record.completionDate || record.testDate');
    expect(dashboardSource).toMatch(/completionDate:\s*state\?\.inspectionTestProject\?\.completionDate\?\.trim\(\)\s*\|\|/);
    expect(dashboardSource).not.toMatch(/completionDate:[\s\S]{0,100}record\?\.testDate/);
    expect(dashboardSource).toContain("title={specHeader.completionDate}>{specHeader.completionDate}");
    expect(dashboardSource).toContain("xl:grid-cols-3");
    expect(dashboardSource).toContain("测试类型 · 自动映射");
    expect(dashboardSource).toContain("h-[248px] min-h-[248px] max-h-[248px]");
    expect(dashboardSource).toContain("max-h-full max-w-full object-contain");
    expect(dashboardSource).toContain("getLaboratoryArchiveDocument({");
    expect(dashboardSource).toContain("specificationSnapshot.state.inspectionTestProject?.completionDate?.trim()");
    expect(dashboardSource).toContain("buildLockedArchiveSpecHeader(state, document.completionDate)");
    expect(archiveApiSource).toContain("completionDate?: string");
    expect(serverSource).toContain("const completionDate = normalizeText(inspectionTestProject.completionDate, 64) || undefined");
    expect(serverSource).toContain("normalizeText(state.specHeader?.completionDate, 64)");
  });

  it("converges the laboratory archive ledger to ten rows per page", async () => {
    const panelSource = await loadSource("./pages/dashboard/components/laboratory/LaboratoryArchivePanel.tsx");

    expect(panelSource).toContain("const LABORATORY_ARCHIVE_PAGE_SIZE = 10");
    expect(panelSource).toContain("archives.slice(pageStart, pageStart + LABORATORY_ARCHIVE_PAGE_SIZE)");
    expect(panelSource).toContain("pageArchives.map((record)");
    expect(panelSource).toContain("上一页");
    expect(panelSource).toContain("下一页");
  });

  it("disables specification sequences that already have laboratory archives", async () => {
    const dashboardSource = await loadSource("./pages/dashboard/components/LaboratoryPdfParserDashboard.tsx");
    const serverSource = await loadSource("../../server/routes/dashboard-laboratory-archive.ts");

    expect(dashboardSource).toContain("listLaboratoryArchives(projectId)");
    expect(dashboardSource).toContain("archivedSpecSequences.has(record.sequence)");
    expect(dashboardSource).toContain("disabled={isArchived}");
    expect(dashboardSource).toContain("!isArchiveOccupancyReady");
    expect(dashboardSource).toContain("已归档</span>");
    expect(serverSource).toContain("LABORATORY_ARCHIVE_DUPLICATE_SPEC_SEQUENCE");
    expect(serverSource).toContain("if (!requestedDocument && occupiedDocument)");
  });
});
