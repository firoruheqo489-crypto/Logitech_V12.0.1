import { execSync } from 'node:child_process';

const ports = [3000, 3001];

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

function killOnWindows(port) {
  const output = run(`netstat -ano -p tcp | findstr :${port}`);
  const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => /LISTENING/i.test(line));

  const pids = new Set();
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }

  for (const pid of pids) {
    if (pid !== String(process.pid)) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`✅ 已释放端口 ${port} (PID ${pid})`);
      } catch {
        // ignore and continue
      }
    }
  }
}

function killOnUnix(port) {
  const output = run(`lsof -ti tcp:${port}`);
  const pids = output
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);

  for (const pid of pids) {
    if (pid !== String(process.pid)) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`✅ 已释放端口 ${port} (PID ${pid})`);
      } catch {
        // ignore and continue
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
    // no process is listening or command not available; ignore
  }
}

console.log('🚀 开发端口检查完成: 3000, 3001');
