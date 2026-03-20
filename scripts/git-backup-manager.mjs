import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SNAPSHOT_REF_PREFIX = 'refs/safety-snapshots';

function slugify(value) {
  const normalized = (value || 'snapshot')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.slice(0, 48) || 'snapshot';
}

function timestampId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function run(command, args, options = {}) {
  const {
    cwd,
    env,
    input,
    allowFailure = false,
    encoding = 'utf8',
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      const stdout = encoding === 'buffer' ? stdoutBuffer : stdoutBuffer.toString(encoding);
      const stderr = encoding === 'buffer' ? stderrBuffer : stderrBuffer.toString(encoding);

      if (code !== 0 && !allowFailure) {
        const message = (typeof stderr === 'string' ? stderr.trim() : stderr.toString('utf8').trim()) || `${command} exited with code ${code}`;
        reject(new Error(message));
        return;
      }

      resolve({ code: code || 0, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function runGit(args, options = {}) {
  return run('git', args, options);
}

async function getRepoRoot() {
  const { stdout } = await runGit(['rev-parse', '--show-toplevel']);
  return stdout.trim();
}

async function getCurrentBranch(repoRoot) {
  const result = await runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    cwd: repoRoot,
    allowFailure: true,
  });

  return result.code === 0 ? result.stdout.trim() : '(detached)';
}

async function getHeadCommit(repoRoot) {
  const result = await runGit(['rev-parse', '--verify', 'HEAD'], {
    cwd: repoRoot,
    allowFailure: true,
  });

  return result.code === 0 ? result.stdout.trim() : '';
}

async function listSnapshotRefs(repoRoot) {
  const format = '%(refname)%09%(objectname)%09%(creatordate:iso8601)%09%(subject)';
  const { stdout } = await runGit(
    ['for-each-ref', '--sort=-creatordate', `--format=${format}`, SNAPSHOT_REF_PREFIX],
    { cwd: repoRoot },
  );

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [refName, commit, createdAt, subject] = line.split('\t');
      return {
        refName,
        shortName: refName.replace(`${SNAPSHOT_REF_PREFIX}/`, ''),
        commit,
        createdAt,
        subject,
      };
    });
}

async function resolveSnapshotRef(repoRoot, rawSpec) {
  if (!rawSpec) {
    throw new Error('missing snapshot id');
  }

  const snapshots = await listSnapshotRefs(repoRoot);
  const exactRef = snapshots.find((item) => item.refName === rawSpec);
  if (exactRef) return exactRef;

  const exactName = snapshots.find((item) => item.shortName === rawSpec);
  if (exactName) return exactName;

  const partialMatches = snapshots.filter(
    (item) => item.shortName.includes(rawSpec) || item.commit.startsWith(rawSpec),
  );

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  if (partialMatches.length > 1) {
    throw new Error(`snapshot id is ambiguous: ${rawSpec}`);
  }

  throw new Error(`snapshot not found: ${rawSpec}`);
}

async function buildTemporaryIndex(repoRoot, sourceRef = '') {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-backup-'));
  const tempIndexPath = path.join(tempDir, 'index');
  const gitEnv = { GIT_INDEX_FILE: tempIndexPath };

  if (sourceRef) {
    await runGit(['read-tree', sourceRef], { cwd: repoRoot, env: gitEnv });
  }

  return { tempDir, tempIndexPath, gitEnv };
}

async function cleanupTemporaryIndex(tempDir) {
  await fs.rm(tempDir, { recursive: true, force: true });
}

async function createSnapshot(repoRoot, label = '') {
  const createdAt = new Date().toISOString();
  const branch = await getCurrentBranch(repoRoot);
  const headCommit = await getHeadCommit(repoRoot);
  const snapshotName = `${timestampId()}-${slugify(label || 'snapshot')}`;
  const refName = `${SNAPSHOT_REF_PREFIX}/${snapshotName}`;
  const { tempDir, gitEnv } = await buildTemporaryIndex(repoRoot, headCommit);

  try {
    await runGit(['add', '-A', '--', '.'], { cwd: repoRoot, env: gitEnv });
    const { stdout: treeOutput } = await runGit(['write-tree'], { cwd: repoRoot, env: gitEnv });
    const treeId = treeOutput.trim();
    const subject = label ? `backup:${label}` : 'backup:auto';
    const lines = [
      subject,
      '',
      `createdAt=${createdAt}`,
      `branch=${branch}`,
      `head=${headCommit || '(empty)'}`,
      `repo=${repoRoot}`,
    ];
    const commitArgs = ['commit-tree', treeId];

    if (headCommit) {
      commitArgs.push('-p', headCommit);
    }

    const identityEnv = {
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Local Backup',
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'local-backup@localhost',
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Local Backup',
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'local-backup@localhost',
      GIT_AUTHOR_DATE: createdAt,
      GIT_COMMITTER_DATE: createdAt,
    };

    const { stdout: commitOutput } = await runGit(commitArgs, {
      cwd: repoRoot,
      env: identityEnv,
      input: `${lines.join('\n')}\n`,
    });

    const commitId = commitOutput.trim();
    await runGit(['update-ref', refName, commitId], { cwd: repoRoot });

    return {
      refName,
      shortName: snapshotName,
      commitId,
      createdAt,
      branch,
      headCommit,
    };
  } finally {
    await cleanupTemporaryIndex(tempDir);
  }
}

async function listSnapshots(repoRoot) {
  const snapshots = await listSnapshotRefs(repoRoot);

  if (snapshots.length === 0) {
    console.log('No git safety snapshots yet.');
    return;
  }

  for (const snapshot of snapshots) {
    console.log(`${snapshot.shortName}  ${snapshot.commit.slice(0, 10)}  ${snapshot.createdAt}  ${snapshot.subject}`);
  }
}

async function readNullSeparatedGitLines(repoRoot, args) {
  const { stdout } = await runGit(args, {
    cwd: repoRoot,
    encoding: 'buffer',
  });

  return stdout
    .toString('utf8')
    .split('\0')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function removeExtraFiles(repoRoot, snapshotRefName) {
  const snapshotFiles = new Set(
    await readNullSeparatedGitLines(repoRoot, ['ls-tree', '-r', '--name-only', '-z', snapshotRefName]),
  );

  const currentFiles = await readNullSeparatedGitLines(repoRoot, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ]);

  const extraFiles = currentFiles.filter((file) => !snapshotFiles.has(file));

  for (const relativePath of extraFiles) {
    const absolutePath = path.join(repoRoot, ...relativePath.split('/'));
    await fs.rm(absolutePath, { recursive: true, force: true });
  }

  return extraFiles;
}

async function restoreSnapshot(repoRoot, rawSpec) {
  const target = await resolveSnapshotRef(repoRoot, rawSpec);
  const backup = await createSnapshot(repoRoot, `pre-restore-${target.shortName}`);
  const removedFiles = await removeExtraFiles(repoRoot, target.refName);
  const { tempDir, gitEnv } = await buildTemporaryIndex(repoRoot, target.refName);

  try {
    await runGit(['checkout-index', '--all', '--force'], {
      cwd: repoRoot,
      env: gitEnv,
    });
  } finally {
    await cleanupTemporaryIndex(tempDir);
  }

  return {
    target,
    backup,
    removedFiles,
  };
}

async function pruneSnapshots(repoRoot, keepCountRaw) {
  const keepCount = Number.parseInt(keepCountRaw || '30', 10);
  if (!Number.isFinite(keepCount) || keepCount < 1) {
    throw new Error('keep count must be a positive integer');
  }

  const snapshots = await listSnapshotRefs(repoRoot);
  const staleSnapshots = snapshots.slice(keepCount);

  for (const snapshot of staleSnapshots) {
    await runGit(['update-ref', '-d', snapshot.refName], { cwd: repoRoot });
  }

  return {
    deletedCount: staleSnapshots.length,
    keptCount: Math.min(snapshots.length, keepCount),
  };
}

function printUsage() {
  console.log('Usage:');
  console.log('  pnpm git-backup:create [label]');
  console.log('  pnpm git-backup:list');
  console.log('  pnpm git-backup:restore <snapshot-id>');
  console.log('  pnpm git-backup:prune [keepCount]');
}

async function main() {
  const repoRoot = await getRepoRoot();
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'create': {
      const label = args.join(' ').trim();
      const snapshot = await createSnapshot(repoRoot, label);
      console.log(`Created snapshot: ${snapshot.shortName}`);
      console.log(`Git ref: ${snapshot.refName}`);
      console.log(`Commit: ${snapshot.commitId}`);
      console.log(`Restore: pnpm git-backup:restore ${snapshot.shortName}`);
      return;
    }
    case 'list':
      await listSnapshots(repoRoot);
      return;
    case 'restore': {
      const result = await restoreSnapshot(repoRoot, args[0]);
      console.log(`Restored snapshot: ${result.target.shortName}`);
      console.log(`Safety backup before restore: ${result.backup.shortName}`);
      console.log(`Removed extra files: ${result.removedFiles.length}`);
      return;
    }
    case 'prune': {
      const result = await pruneSnapshots(repoRoot, args[0]);
      console.log(`Deleted snapshots: ${result.deletedCount}`);
      console.log(`Snapshots kept: ${result.keptCount}`);
      return;
    }
    default:
      printUsage();
  }
}

main().catch((error) => {
  console.error(`git backup manager failed: ${error.message}`);
  process.exitCode = 1;
});
