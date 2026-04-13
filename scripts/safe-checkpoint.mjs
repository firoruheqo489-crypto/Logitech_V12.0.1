/**
 * safe-checkpoint.mjs
 *
 * One-command local safety checkpoint for AI-heavy development.
 *
 * Why this script exists:
 * 1) Always create a recoverable Git snapshot first (refs/safety-snapshots/*),
 *    even when the workspace is dirty.
 * 2) Optionally auto-commit current changes (--auto-commit) to make follow-up
 *    preview/release flows easier.
 * 3) Push everything to an offline local backup remote ("backup") so network
 *    instability does not become a single point of failure.
 */

import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_BACKUP_PATH = "D:\\git-backup\\V3.git";

function nowLabel() {
  const date = new Date();
  const pad = value => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function parseArgs(argv) {
  const options = {
    label: "",
    autoCommit: false,
    pushBackup: true,
    backupPath: DEFAULT_BACKUP_PATH,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    if (token === "--label" && argv[index + 1]) {
      options.label = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--auto-commit") {
      options.autoCommit = true;
      continue;
    }
    if (token === "--no-push-backup") {
      options.pushBackup = false;
      continue;
    }
    if (token === "--backup-path" && argv[index + 1]) {
      options.backupPath = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function printUsage() {
  console.log("Usage:");
  console.log("  pnpm run safe:checkpoint -- --label \"task-name\"");
  console.log("  pnpm run safe:checkpoint -- --label \"task-name\" --auto-commit");
  console.log("  pnpm run safe:checkpoint -- --label \"task-name\" --backup-path \"D:\\\\git-backup\\\\V3.git\"");
  console.log("  pnpm run safe:checkpoint -- --no-push-backup");
  console.log("");
  console.log("Options:");
  console.log("  --label <text>        Snapshot label. Default: checkpoint-YYYYMMDD-HHMMSS");
  console.log("  --auto-commit         Auto `git add -A && git commit -m \"checkpoint: <label>\"`");
  console.log("  --no-push-backup      Skip pushing to local backup remote");
  console.log(`  --backup-path <path>  Local bare repo path (default: ${DEFAULT_BACKUP_PATH})`);
  console.log("  --help, -h            Show this help");
  console.log("");
  console.log("Recovery (after accidental deletion or overwrite):");
  console.log("  pnpm run git-backup:list");
  console.log("  pnpm run git-backup:restore <snapshot-id>");
}

function run(command, args, options = {}) {
  const { cwd, allowFailure = false, capture = true } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
      env: process.env,
    });

    const stdout = [];
    const stderr = [];

    if (capture) {
      child.stdout.on("data", chunk => stdout.push(chunk));
      child.stderr.on("data", chunk => stderr.push(chunk));
    }

    child.on("error", reject);
    child.on("close", code => {
      const out = Buffer.concat(stdout).toString("utf8");
      const err = Buffer.concat(stderr).toString("utf8");
      if (code !== 0 && !allowFailure) {
        reject(new Error(err.trim() || `${command} ${args.join(" ")} failed with code ${code}`));
        return;
      }
      resolve({ code: code ?? 0, stdout: out, stderr: err });
    });
  });
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureBackupRemote(repoRoot, backupPath) {
  const remoteResult = await run("git", ["remote", "get-url", "backup"], {
    cwd: repoRoot,
    allowFailure: true,
  });

  if (remoteResult.code === 0) {
    return remoteResult.stdout.trim();
  }

  const absoluteBackupPath = path.resolve(backupPath);
  if (!(await exists(absoluteBackupPath))) {
    await fs.mkdir(path.dirname(absoluteBackupPath), { recursive: true });
    await run("git", ["init", "--bare", absoluteBackupPath], { cwd: repoRoot, capture: false });
  }

  await run("git", ["remote", "add", "backup", absoluteBackupPath], { cwd: repoRoot });
  return absoluteBackupPath;
}

async function pushBackup(repoRoot) {
  await run("git", ["push", "backup", "--all"], { cwd: repoRoot, capture: false });
  await run("git", ["push", "backup", "--tags"], { cwd: repoRoot, capture: false });
  await run(
    "git",
    ["push", "backup", "refs/safety-snapshots/*:refs/safety-snapshots/*"],
    { cwd: repoRoot, allowFailure: true, capture: false },
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const repoResult = await run("git", ["rev-parse", "--show-toplevel"]);
  const repoRoot = repoResult.stdout.trim();
  const label = options.label || `checkpoint-${nowLabel()}`;

  console.log(`[safe-checkpoint] repo: ${repoRoot}`);
  console.log(`[safe-checkpoint] label: ${label}`);

  const snapshotCreateResult = await run("node", ["scripts/git-backup-manager.mjs", "create", label], {
    cwd: repoRoot,
    capture: true,
  });
  const snapshotOutput = snapshotCreateResult.stdout.trim();
  if (snapshotOutput) {
    console.log(snapshotOutput);
  }
  const snapshotIdMatch = snapshotOutput.match(/Created snapshot:\s*(\S+)/);
  const snapshotId = snapshotIdMatch ? snapshotIdMatch[1] : "";

  const statusResult = await run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: repoRoot },
  );
  const dirtyLines = statusResult.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (dirtyLines.length > 0) {
    console.log(`[safe-checkpoint] dirty files: ${dirtyLines.length}`);
    if (options.autoCommit) {
      await run("git", ["add", "-A"], { cwd: repoRoot, capture: false });
      const commitResult = await run("git", ["commit", "-m", `checkpoint: ${label}`], {
        cwd: repoRoot,
        allowFailure: true,
        capture: true,
      });
      if (commitResult.code === 0) {
        console.log("[safe-checkpoint] auto-commit: success.");
      } else {
        const stderr = commitResult.stderr.trim();
        const stdout = commitResult.stdout.trim();
        const detail = stderr || stdout || "no changes or commit blocked";
        console.log(`[safe-checkpoint] auto-commit skipped: ${detail}`);
      }
    } else {
      console.log("[safe-checkpoint] workspace is dirty (snapshot is already created).");
      console.log("[safe-checkpoint] optional next step: git add -A && git commit -m \"checkpoint: ...\"");
    }
  } else {
    console.log("[safe-checkpoint] workspace is clean.");
  }

  if (options.pushBackup) {
    const remoteUrl = await ensureBackupRemote(repoRoot, options.backupPath);
    console.log(`[safe-checkpoint] backup remote: ${remoteUrl}`);
    await pushBackup(repoRoot);
    console.log("[safe-checkpoint] pushed branches/tags/safety-snapshots to backup.");
  } else {
    console.log("[safe-checkpoint] skip backup push by --no-push-backup");
  }

  console.log("[safe-checkpoint] recover list: pnpm run git-backup:list");
  if (snapshotId) {
    console.log(`[safe-checkpoint] recover now: pnpm run git-backup:restore ${snapshotId}`);
  } else {
    console.log("[safe-checkpoint] recover now: pnpm run git-backup:restore <snapshot-id>");
  }
  console.log("[safe-checkpoint] complete.");
}

main().catch(error => {
  console.error(`[safe-checkpoint] failed: ${error.message}`);
  process.exit(1);
});
