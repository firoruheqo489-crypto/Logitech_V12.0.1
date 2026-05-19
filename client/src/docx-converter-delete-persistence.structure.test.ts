import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("docx converter delete persistence", () => {
  it("flushes trial deletes immediately and prevents stale remote stage resurrection", async () => {
    const source = await loadSource(
      "./pages/dashboard/components/DocxConvertModule.tsx"
    );

    expect(source).toContain("persistDocxSnapshotNow");
    expect(source).toContain("isLocalSnapshotNewerThanRemote");
    expect(source).toContain("filterStageStateByTrial");
    expect(source).toContain(
      "void persistDocxSnapshotNow(nextTrialStages, nextActiveTrial, nextStageStateByTrial)"
    );
    expect(source).toContain(
      "void persistDocxSnapshotNow(trimmedTrialStages, nextActiveTrial, nextStageStateByTrial)"
    );
    expect(source).toContain(
      "void persistDocxSnapshotNow(parsedTrialStages, trialStage, parsedStageStateByTrial)"
    );
    expect(source).toContain(
      "void persistDocxSnapshotNow(finalTrialStages, trialStage, finalStageStateByTrial)"
    );
    expect(source).toContain(
      "void persistDocxSnapshotNow(nextTrialStages, nextStage, nextStageStateByTrial)"
    );
    expect(source).toContain(
      "await setStageResultCache(panelIdentity, trialStage, parsed)"
    );
    expect(source).toContain(
      "await setStageResultCache(panelIdentity, activeTrial, parsed)"
    );
    expect(source).toContain("const trialStagesStateRef = useRef");
    expect(source).toContain("const stageStateByTrialRef = useRef");
    expect(source).toContain(
      "filterStageStateByTrial(localSnapshot?.stageStateByTrial || {}, localTrialStages)"
    );
    expect(source).toContain(
      "const remoteTrialStages = normalizeTrialStages(remote.trialStages || [])"
    );
    expect(source).toContain(
      "const localStageStateByRemoteTrial = filterStageStateByTrial(localStageStateByTrial, remoteTrialStages)"
    );
    expect(source).toContain(
      "const localCanOverrideRemote = !remoteHasContent && localIsNewer && localTrialStages.length > 0"
    );
    expect(source).toContain(
      "const localStageStateForMerge = localIsNewer ? localStageStateByTrial : localStageStateByRemoteTrial"
    );
    expect(source).toContain(
      "mergeStageStateByTrial(localStageStateForMerge, remote.stageStateByTrial || {})"
    );
    expect(source).toContain("...(localIsNewer ? localTrialStages : [])");
    expect(source).toContain("trimTrailingEmptyTrialStages");
    expect(source).toContain("deleteLocalSnapshot");
    expect(source).toContain("function shouldPersistDocxSnapshot");
    expect(source).toContain("!hasDefaultTrialStages(trialStages)");
    expect(source).toContain(
      "if (!shouldPersistDocxSnapshot(payload.trialStages, payload.stageStateByTrial || {}))"
    );
    expect(source).toContain(
      "if (!shouldPersistDocxSnapshot(finalTrialStages, filteredRemoteStageStateByTrial))"
    );

    const persistStart = source.indexOf("const persistDocxSnapshotNow");
    const localSnapshotIndex = source.indexOf("writeLocalSnapshot({", persistStart);
    const remoteGuardIndex = source.indexOf(
      "if (!isHydrated || !canPersistRef.current)",
      persistStart
    );
    expect(persistStart).toBeGreaterThan(-1);
    expect(localSnapshotIndex).toBeGreaterThan(persistStart);
    expect(remoteGuardIndex).toBeGreaterThan(localSnapshotIndex);

    const trimStart = source.indexOf("function trimTrailingEmptyTrialStages");
    const trimEnd = source.indexOf("function buildStageResultCacheKey", trimStart);
    const trimSource = source.slice(trimStart, trimEnd);
    expect(trimSource).not.toContain(".pop()");
    expect(trimSource).toContain("return normalizedTrialStages;");
  });
});
