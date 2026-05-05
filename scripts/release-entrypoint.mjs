import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VALID_MODES = new Set(["all", "build", "deploy"]);

function resolveRepoRoot() {
  const scriptFilePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(scriptFilePath), "..");
}

export function parseCliArgs(argv) {
  const tokens = [...argv];
  let mode = "all";

  if (tokens[0] && VALID_MODES.has(tokens[0])) {
    mode = tokens.shift();
  }

  const forwardedArgs = tokens.filter((token) => token !== "--");
  return { mode, forwardedArgs };
}

export function buildPowerShellArgs(mode, forwardedArgs, repoRoot = resolveRepoRoot()) {
  const releaseScriptPath = path.join(repoRoot, "scripts", "release-from-clean-worktree.ps1");

  return [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    releaseScriptPath,
    "-Mode",
    mode,
    ...forwardedArgs,
  ];
}

export async function runReleaseEntrypoint(rawArgs = process.argv.slice(2)) {
  const { mode, forwardedArgs } = parseCliArgs(rawArgs);
  const repoRoot = resolveRepoRoot();
  const powerShellArgs = buildPowerShellArgs(mode, forwardedArgs, repoRoot);
  const powerShellCommand = process.platform === "win32" ? "powershell.exe" : "pwsh";

  await new Promise((resolve, reject) => {
    const child = spawn(powerShellCommand, powerShellArgs, {
      cwd: repoRoot,
      stdio: "inherit",
      windowsHide: true,
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (typeof code === "number") {
        process.exitCode = code;
      } else {
        process.exitCode = 1;
      }
      resolve();
    });
  });
}

const isDirectRun = (() => {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
})();

if (isDirectRun) {
  runReleaseEntrypoint().catch((error) => {
    console.error("[release-entrypoint] failed to launch release wrapper");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
