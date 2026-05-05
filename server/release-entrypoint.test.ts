import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPowerShellArgs, parseCliArgs } from "../scripts/release-entrypoint.mjs";

describe("release-entrypoint", () => {
  it("strips pnpm separator while preserving forwarded release arguments", () => {
    expect(parseCliArgs(["all", "--", "-ReleaseNote", "DOE release"])).toEqual({
      mode: "all",
      forwardedArgs: ["-ReleaseNote", "DOE release"],
    });
  });

  it("keeps direct arguments when no separator is present", () => {
    expect(parseCliArgs(["build", "-ReleaseNote", "artifact only", "-SkipVerification"])).toEqual({
      mode: "build",
      forwardedArgs: ["-ReleaseNote", "artifact only", "-SkipVerification"],
    });
  });

  it("builds the PowerShell wrapper invocation with explicit mode forwarding", () => {
    const repoRoot = "D:\\V6.3\\HT\\V3";

    expect(buildPowerShellArgs("deploy", ["-ReleaseNote", "ship it"], repoRoot)).toEqual([
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(repoRoot, "scripts", "release-from-clean-worktree.ps1"),
      "-Mode",
      "deploy",
      "-ReleaseNote",
      "ship it",
    ]);
  });
});
