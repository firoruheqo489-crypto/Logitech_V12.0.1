import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("mold trial persistence guard", () => {
  it("keeps local snapshots per mold/cavity and flushes critical mutations immediately", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/MoldTrialDatabase.tsx"
    );
    const normalized = source.replace(/\s+/g, " ");

    expect(source).toContain("MOLD_TRIAL_LOCAL_SNAPSHOT_PREFIX");
    expect(source).toContain("buildMoldTrialLocalSnapshotKey");
    expect(source).toContain("readLocalMoldTrialSnapshot");
    expect(source).toContain("writeLocalMoldTrialSnapshot");
    expect(source).toContain("isLocalMoldTrialSnapshotNewer");
    expect(source).toContain("persistMoldTrialStateNow");
    expect(source).toContain("void persistMoldTrialStateNow(nextEvidenceState)");
    expect(normalized).toContain(
      "void persistMoldTrialStateNow( nextEvidenceState, nextTrialStages, nextClearedTrialStages )"
    );
    expect(source).not.toContain("if (shouldRevalidateAfterSave) {\n          void reloadRemoteTrialDatabaseState({ background: true });");
  });
});
