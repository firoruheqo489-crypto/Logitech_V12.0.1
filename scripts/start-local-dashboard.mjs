import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const startScript = path.join(repoRoot, "scripts", "start-local-dashboard.ps1");
const stateFile = path.join(repoRoot, ".codex-local-dashboard.state.json");
const failureFile = path.join(repoRoot, ".codex-local-dashboard.failure.json");

function getPowerShellCommand() {
  return process.platform === "win32" ? "powershell.exe" : "pwsh";
}

function runStartScript() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      getPowerShellCommand(),
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        startScript,
      ],
      {
        cwd: repoRoot,
        stdio: "ignore",
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`start-local-dashboard.ps1 exited with code ${code ?? "null"}`));
    });
  });
}

function printState() {
  const raw = readFileSync(stateFile, "utf8").replace(/^\uFEFF/, "");
  const state = JSON.parse(raw);
  const lines = [
    "LOCAL_DASHBOARD_READY",
    `FRONTEND_URL=${state.frontendUrl}`,
    `API_URL=${state.apiUrl}`,
    `API_HEALTH=${state.apiHealthUrl}`,
    `API_PID=${state.apiPid}`,
    `VITE_PID=${state.vitePid}`,
    `STATE_FILE=${stateFile}`,
  ];

  const output = `${lines.join("\n")}\n`;
  process.stdout.write(output);
  writeFileSync(path.join(repoRoot, ".codex-local-dashboard.last-output.txt"), output, "utf8");
}

function readTail(filePath, lineCount = 30) {
  try {
    const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(-lineCount).join("\n");
  } catch {
    return "";
  }
}

function findLatestLog(prefix) {
  try {
    const entries = readdirSync(repoRoot)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".log"))
      .map((name) => ({
        name,
        path: path.join(repoRoot, name),
        mtimeMs: statSync(path.join(repoRoot, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return entries[0]?.path ?? "";
  } catch {
    return "";
  }
}

function printFailureContext() {
  let apiErrLog = findLatestLog(".codex-local-dashboard.err");
  let apiOutLog = findLatestLog(".codex-local-dashboard.out");
  let viteErrLog = findLatestLog(".codex-local-vite.err");
  let failureMessage = "";

  try {
    const failure = JSON.parse(readFileSync(failureFile, "utf8").replace(/^\uFEFF/, ""));
    apiErrLog = failure.apiErrLog || apiErrLog;
    apiOutLog = failure.apiOutLog || apiOutLog;
    viteErrLog = failure.viteErrLog || viteErrLog;
    failureMessage = failure.message || "";
  } catch {
  }

  if (failureMessage) {
    console.error(`START_FAILURE=${failureMessage}`);
  }

  const apiErrTail = readTail(apiErrLog);
  const apiOutTail = readTail(apiOutLog);
  const viteErrTail = readTail(viteErrLog);

  if (apiErrTail) {
    console.error("--- API ERR TAIL ---");
    console.error(apiErrTail);
  }

  if (apiOutTail) {
    console.error("--- API OUT TAIL ---");
    console.error(apiOutTail);
  }

  if (viteErrTail) {
    console.error("--- VITE ERR TAIL ---");
    console.error(viteErrTail);
  }
}

try {
  await runStartScript();
  printState();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  printFailureContext();
  process.exitCode = 1;
}
