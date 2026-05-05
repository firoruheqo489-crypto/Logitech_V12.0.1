import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial stage isolation", () => {
  it("keeps each round in its own evidence bucket and creates new rounds empty", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );
    const normalized = source.replace(/\s+/g, " ");

    expect(source).toContain("version: 3");
    expect(source).toContain("stagesByScope: evidenceByTrial");
    expect(source).toContain("fetchDashboardMoldTrialEvidenceState({");
    expect(source).toContain("saveDashboardMoldTrialEvidenceState({");
    expect(normalized).toContain(
      "const currentEvidenceState = evidenceByTrial[activeTrial] || buildEmptyTrialEvidenceStageState(activeTrial);"
    );
    expect(source).toContain(
      "[nextStage]: buildEmptyTrialEvidenceStageState(nextStage),"
    );
    expect(source).toContain("normalizeStoredEvidenceStateMap(");
    expect(source).toContain("const trialScopeKey = `${moldId}:${moldNo || \"default\"}:${activeTrial}`;");
    expect(source).toContain("setIsEvidenceHydrated(false);");
    expect(source).toContain("setIsEvidenceHydrated(true);");
    expect(source).toContain("canPersistEvidenceRef");
    expect(source).toContain("const enablePersistTimer = window.setTimeout(() => {");
    expect(source).toContain("if (!canPersistEvidenceRef.current) {");
    expect(source).toContain("<Fragment key={trialScopeKey}>");
  });
});
