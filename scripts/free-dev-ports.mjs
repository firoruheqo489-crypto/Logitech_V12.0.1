import { execSync } from 'node:child_process';

const ports = [3000, 3001];

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

function logFreedPort(port, pid) {
  console.log(`[dev-ports] freed port ${port} (PID ${pid})`);
}

function killOnWindows(port) {
  const output = run(`netstat -ano -p tcp | findstr :${port}`);
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /LISTENING/i.test(line));

  const pids = new Set();
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    if (pid !== String(process.pid)) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        logFreedPort(port, pid);
      } catch {
        // Ignore processes that exit before they can be killed.
      }
    }
  }
}

function killOnUnix(port) {
  const output = run(`lsof -ti tcp:${port}`);
  const pids = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const pid of pids) {
    if (pid !== String(process.pid)) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        logFreedPort(port, pid);
      } catch {
        // Ignore processes that exit before they can be killed.
      }
    }
  }
}

for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      killOnWindows(port);
    } else {
      killOnUnix(port);
    }
  } catch {
    // No process is listening or the platform command is unavailable.
  }
}

console.log('[dev-ports] checked ports 3000 and 3001');
