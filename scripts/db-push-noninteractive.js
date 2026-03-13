/**
 * Run drizzle-kit push and auto-accept all "create column" prompts (send Enter).
 * Usage: node scripts/db-push-noninteractive.js
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cwd = path.resolve(__dirname, '..');
const child = spawn('pnpm', ['db:push'], {
  cwd,
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true,
});

// Feed newlines to accept first option (create column) for each prompt
const interval = setInterval(() => {
  try {
    child.stdin.write('\n');
  } catch (_) {}
}, 800);

child.on('exit', (code) => {
  clearInterval(interval);
  try {
    child.stdin.end();
  } catch (_) {}
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  clearInterval(interval);
  console.error(err);
  process.exit(1);
});
