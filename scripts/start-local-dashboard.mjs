import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync, openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const stateFile = path.join(repoRoot, ".codex-local-dashboard.state.json");
const failureFile = path.join(repoRoot, ".codex-local-dashboard.failure.json");
const apiOutLog = path.join(repoRoot, ".codex-local-dashboard.out.log");
const apiErrLog = path.join(repoRoot, ".codex-local-dashboard.err.log");
const viteOutLog = path.join(repoRoot, ".codex-local-vite.out.log");
const viteErrLog = path.join(repoRoot, ".codex-local-vite.err.log");
const apiPort = 3001;
const frontendPort = 3000;
const parsedTimeoutSeconds = Number.parseInt(
  process.env.LOCAL_DASHBOARD_START_TIMEOUT_SECONDS ?? "30",
  10,
);
const timeoutSeconds = Number.isFinite(parsedTimeoutSeconds)
  ? Math.min(Math.max(parsedTimeoutSeconds, 10), 180)
  : 30;

function log(message) {
  process.stdout.write(`[local-dashboard] ${message}\n`);
}

function removeFileIfExists(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
  }
}

function readJsonIfExists(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readTail(filePath, lineCount = 30) {
  try {
    if (!existsSync(filePath)) return "";
    const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(-lineCount).join("\n");
  } catch {
    return "";
  }
}

function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
}

function stopTrackedProcesses() {
  const state = readJsonIfExists(stateFile);
  if (!state) {
    removeFileIfExists(stateFile);
    return;
  }

  const trackedPids = [
    state.apiPid,
    state.apiLauncherPid,
    state.vitePid,
    state.viteLauncherPid,
  ].map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);

  for (const pid of new Set(trackedPids)) {
    killProcessTree(pid);
  }

  removeFileIfExists(stateFile);
}

function getListeningPids(port) {
  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  const pids = [];
  const pattern = new RegExp(`:${port}\\s`, "i");
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!pattern.test(line) || !/LISTENING/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isInteger(pid) && pid > 0) {
      pids.push(pid);
    }
  }

  return [...new Set(pids)];
}

async function waitForPortFree(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getListeningPids(port).length === 0) {
      return;
    }
    await delay(300);
  }

  const remaining = getListeningPids(port);
  if (remaining.length > 0) {
    throw new Error(`port ${port} is still occupied after waiting ${Math.ceil(timeoutMs / 1000)} seconds. PIDs: ${remaining.join(", ")}`);
  }
}

function launchProcess(name, args, outLogPath, errLogPath, extraEnv = {}) {
  const outFd = openSync(outLogPath, "w");
  const errFd = openSync(errLogPath, "w");
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", outFd, errFd],
    detached: true,
  });
  child.unref();
  log(`started ${name} launcher (PID ${child.pid})`);
  return { process: child, outLogPath, errLogPath };
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function freeListeningPort(port) {
  const pids = getListeningPids(port);
  for (const pid of pids) {
    killProcessTree(pid);
  }
}

async function launchApiProcessWithRetry(maxAttempts = 3) {
  let lastProcessInfo = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastProcessInfo = launchProcess(
      "api",
      ["--watch", "--import", "./scripts/register-ts-path-loader.mjs", "--experimental-strip-types", "server/index.ts"],
      apiOutLog,
      apiErrLog,
      {
        DEV_API: "1",
        PORT: String(apiPort),
      },
    );

    await delay(1200);
    if (isProcessAlive(lastProcessInfo.process.pid)) {
      return lastProcessInfo;
    }

    const apiErrTail = readTail(apiErrLog, 80);
    const isAddressInUse = /EADDRINUSE/.test(apiErrTail);
    if (isAddressInUse && attempt < maxAttempts) {
      log(`api port ${apiPort} conflict detected (attempt ${attempt}/${maxAttempts}), retrying`);
      freeListeningPort(apiPort);
      await waitForPortFree(apiPort, 8000).catch(() => {});
      await delay(1000);
      continue;
    }

    return lastProcessInfo;
  }

  return lastProcessInfo;
}

function extractFrontendUrlFromLog(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf8");
    const normalized = content.replace(/\x1B\[[0-9;]*m/g, "");
    const matches = [...normalized.matchAll(/http:\/\/localhost:\d+\//g)];
    if (matches.length === 0) {
      return null;
    }

    return matches[matches.length - 1][0].replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function testUrl(url) {
  try {
    const response = await fetchWithTimeout(url, 2000);
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServices(apiHealthUrl, preferredPort, apiProcessInfo, viteProcessInfo, timeoutSecondsValue) {
  const deadline = Date.now() + timeoutSecondsValue * 1000;
  let apiReady = false;
  let frontendReady = false;
  let frontendUrl = null;

  while (Date.now() < deadline) {
    if (!apiReady) {
      try {
        const response = await fetchWithTimeout(apiHealthUrl, 2000);
        const payload = await response.json();
        const apiAvailable = payload?.api === true;
        if (apiAvailable) {
          apiReady = true;
          const dbState = payload?.ok === true ? "db-ready" : "db-degraded";
          log(`api ready at ${apiHealthUrl} (${dbState})`);
        }
      } catch {
      }
    }

    if (!frontendReady) {
      const loggedUrl = extractFrontendUrlFromLog(viteProcessInfo.outLogPath);
      if (loggedUrl && await testUrl(loggedUrl)) {
        frontendReady = true;
        frontendUrl = loggedUrl;
        log(`frontend ready at ${frontendUrl}`);
      }
    }

    if (apiReady && frontendReady && frontendUrl) {
      return frontendUrl;
    }

    await delay(500);
  }

  throw new Error(`probe acceptance failed: services were not ready within ${timeoutSecondsValue} seconds. Review logs: ${apiProcessInfo.outLogPath}, ${apiProcessInfo.errLogPath}, ${viteProcessInfo.outLogPath}, ${viteProcessInfo.errLogPath}`);
}

function writeFailure(message, apiProcessInfo, viteProcessInfo) {
  writeJson(failureFile, {
    failedAt: new Date().toISOString(),
    message,
    apiOutLog: apiProcessInfo?.outLogPath ?? apiOutLog,
    apiErrLog: apiProcessInfo?.errLogPath ?? apiErrLog,
    viteOutLog: viteProcessInfo?.outLogPath ?? viteOutLog,
    viteErrLog: viteProcessInfo?.errLogPath ?? viteErrLog,
    stateFile,
  });
}

async function main() {
  removeFileIfExists(failureFile);
  log(`repo root: ${repoRoot}`);

  stopTrackedProcesses();

  log("freeing dev ports");
  const freePortsResult = spawnSync(process.execPath, [path.join("scripts", "free-dev-ports.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (freePortsResult.status !== 0) {
    throw new Error(`free-dev-ports.mjs exited with code ${freePortsResult.status ?? "null"}`);
  }

  log(`waiting for ports ${frontendPort} and ${apiPort} to become free`);
  await waitForPortFree(frontendPort);
  await waitForPortFree(apiPort);

  const apiProcessInfo = await launchApiProcessWithRetry();

  const apiUrl = `http://localhost:${apiPort}`;
  const apiHealthUrl = `${apiUrl}/api/health`;

  const viteProcessInfo = launchProcess(
    "vite",
    ["./node_modules/vite/bin/vite.js", "--host", "--configLoader", "native"],
    viteOutLog,
    viteErrLog,
    {
      PORT: String(frontendPort),
    },
  );

  log("waiting for api/frontend readiness in parallel");
  let frontendUrl;
  try {
    frontendUrl = await waitForServices(apiHealthUrl, frontendPort, apiProcessInfo, viteProcessInfo, timeoutSeconds);
  } catch (err) {
    console.error('[Health Check Failed]:', err?.message || err?.code || String(err));
    throw err;
  }

  const state = {
    startedAt: new Date().toISOString(),
    apiPid: apiProcessInfo.process.pid,
    vitePid: viteProcessInfo.process.pid,
    apiLauncherPid: apiProcessInfo.process.pid,
    viteLauncherPid: viteProcessInfo.process.pid,
    apiUrl,
    apiHealthUrl,
    frontendUrl,
    apiOutLog: apiProcessInfo.outLogPath,
    apiErrLog: apiProcessInfo.errLogPath,
    viteOutLog: viteProcessInfo.outLogPath,
    viteErrLog: viteProcessInfo.errLogPath,
  };

  writeJson(stateFile, state);

  process.stdout.write("LOCAL_DASHBOARD_READY\n");
  process.stdout.write(`FRONTEND_URL=${frontendUrl}\n`);
  process.stdout.write(`API_URL=${apiUrl}\n`);
  process.stdout.write(`API_HEALTH=${apiHealthUrl}\n`);
  process.stdout.write(`API_PID=${state.apiPid}\n`);
  process.stdout.write(`VITE_PID=${state.vitePid}\n`);
  process.stdout.write(`STATE_FILE=${stateFile}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  writeFailure(message, null, null);
  process.exitCode = 1;
}
