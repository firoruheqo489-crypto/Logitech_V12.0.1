import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT_ROOT = path.join(ROOT, '.rollback');
const ENTRIES_ROOT = path.join(SNAPSHOT_ROOT, 'entries');

const DEFAULT_DIRS = ['client', 'server', 'shared', 'scripts', 'docs'];
const DEFAULT_FILES = [
  '.env.example',
  '.gitignore',
  '.prettierignore',
  '.prettierrc',
  'components.json',
  'deploy.ps1',
  'deploy.sh',
  'drizzle.config.ts',
  'ecosystem.config.cjs',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
];

const IGNORE_DIRS = new Set([
  '.git',
  '.rollback',
  '.next',
  '.nuxt',
  '.idea',
  '.vscode',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'tmp',
  'temp',
]);

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function toAbsolutePath(relativePath) {
  return path.join(ROOT, ...relativePath.split('/'));
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

function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function walkFiles(relativeDir) {
  const startPath = toAbsolutePath(relativeDir);
  if (!(await pathExists(startPath))) {
    return [];
  }

  const entries = [];

  async function walk(currentRelative) {
    const absoluteCurrent = toAbsolutePath(currentRelative);
    const children = await fs.readdir(absoluteCurrent, { withFileTypes: true });

    for (const child of children) {
      const childRelative = normalizeRelativePath(path.join(currentRelative, child.name));

      if (child.isDirectory()) {
        if (IGNORE_DIRS.has(child.name)) {
          continue;
        }
        await walk(childRelative);
        continue;
      }

      if (child.isFile()) {
        entries.push(childRelative);
      }
    }
  }

  await walk(relativeDir);
  return entries;
}

async function collectDefaultSnapshotFiles() {
  const files = new Set();

  for (const dir of DEFAULT_DIRS) {
    const walked = await walkFiles(dir);
    walked.forEach((file) => files.add(file));
  }

  for (const file of DEFAULT_FILES) {
    if (await pathExists(toAbsolutePath(file))) {
      files.add(normalizeRelativePath(file));
    }
  }

  return Array.from(files).sort();
}

async function collectExplicitFiles(inputPaths) {
  const files = [];

  for (const rawPath of inputPaths) {
    const cleaned = normalizeRelativePath(rawPath.trim());
    if (!cleaned) {
      continue;
    }

    const absolutePath = toAbsolutePath(cleaned);
    if (!(await pathExists(absolutePath))) {
      files.push({ path: cleaned, exists: false });
      continue;
    }

    const stat = await fs.stat(absolutePath);
    if (stat.isDirectory()) {
      const nestedFiles = await walkFiles(cleaned);
      nestedFiles.forEach((file) => files.push({ path: file, exists: true }));
      continue;
    }

    files.push({ path: cleaned, exists: true });
  }

  const deduped = new Map();
  for (const item of files) {
    deduped.set(item.path, item);
  }

  return Array.from(deduped.values()).sort((left, right) => left.path.localeCompare(right.path));
}

async function writeMetadata(snapshotDir, metadata) {
  await fs.writeFile(
    path.join(snapshotDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf8',
  );
}

async function createSnapshot(label, inputPaths) {
  await ensureDirectory(ENTRIES_ROOT);

  const snapshotFiles = inputPaths.length > 0
    ? await collectExplicitFiles(inputPaths)
    : (await collectDefaultSnapshotFiles()).map((file) => ({ path: file, exists: true }));

  if (snapshotFiles.length === 0) {
    throw new Error('没有可快照的文件。');
  }

  const idBase = timestampId();
  const slug = label ? slugify(label) : 'snapshot';
  const snapshotId = `${idBase}-${slug || 'snapshot'}`;
  const snapshotDir = path.join(ENTRIES_ROOT, snapshotId);
  const filesDir = path.join(snapshotDir, 'files');

  await ensureDirectory(filesDir);

  for (const file of snapshotFiles) {
    if (!file.exists) {
      continue;
    }

    const sourcePath = toAbsolutePath(file.path);
    const targetPath = path.join(filesDir, ...file.path.split('/'));
    await ensureDirectory(path.dirname(targetPath));
    await fs.copyFile(sourcePath, targetPath);
  }

  const metadata = {
    id: snapshotId,
    label: label || '',
    createdAt: new Date().toISOString(),
    root: ROOT,
    mode: inputPaths.length > 0 ? 'explicit' : 'default',
    files: snapshotFiles,
  };

  await writeMetadata(snapshotDir, metadata);

  console.log(`已创建回滚快照: ${snapshotId}`);
  console.log(`文件数量: ${snapshotFiles.length}`);
}

async function listSnapshots() {
  if (!(await pathExists(ENTRIES_ROOT))) {
    console.log('还没有回滚快照。');
    return;
  }

  const entries = await fs.readdir(ENTRIES_ROOT, { withFileTypes: true });
  const snapshots = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const metadataPath = path.join(ENTRIES_ROOT, entry.name, 'metadata.json');
    if (!(await pathExists(metadataPath))) {
      continue;
    }

    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    snapshots.push(metadata);
  }

  snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (snapshots.length === 0) {
    console.log('还没有回滚快照。');
    return;
  }

  for (const snapshot of snapshots) {
    console.log(`${snapshot.id}  ${snapshot.createdAt}  ${snapshot.files.length} files  ${snapshot.label || '(no label)'}`);
  }
}

async function restoreSnapshot(snapshotId) {
  if (!snapshotId) {
    throw new Error('请提供要恢复的快照 ID。');
  }

  const snapshotDir = path.join(ENTRIES_ROOT, snapshotId);
  const metadataPath = path.join(snapshotDir, 'metadata.json');
  if (!(await pathExists(metadataPath))) {
    throw new Error(`未找到快照: ${snapshotId}`);
  }

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const filesDir = path.join(snapshotDir, 'files');

  for (const file of metadata.files) {
    const targetPath = toAbsolutePath(file.path);

    if (!file.exists) {
      if (await pathExists(targetPath)) {
        await fs.rm(targetPath, { force: true });
      }
      continue;
    }

    const backupPath = path.join(filesDir, ...file.path.split('/'));
    if (!(await pathExists(backupPath))) {
      continue;
    }

    await ensureDirectory(path.dirname(targetPath));
    await fs.copyFile(backupPath, targetPath);
  }

  console.log(`已恢复快照: ${snapshotId}`);
  console.log(`恢复文件数: ${metadata.files.length}`);
}

async function pruneSnapshots(keepCountRaw) {
  const keepCount = Number.parseInt(keepCountRaw || '20', 10);
  if (!Number.isFinite(keepCount) || keepCount < 1) {
    throw new Error('保留数量必须是大于 0 的整数。');
  }

  if (!(await pathExists(ENTRIES_ROOT))) {
    console.log('还没有回滚快照。');
    return;
  }

  const entries = await fs.readdir(ENTRIES_ROOT, { withFileTypes: true });
  const snapshotDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const toDelete = snapshotDirs.slice(keepCount);
  for (const name of toDelete) {
    await fs.rm(path.join(ENTRIES_ROOT, name), { recursive: true, force: true });
  }

  console.log(`已清理 ${toDelete.length} 个旧快照，当前保留 ${Math.min(snapshotDirs.length, keepCount)} 个。`);
}

function printUsage() {
  console.log('用法:');
  console.log('  pnpm rollback:create [label] [fileOrDir...]');
  console.log('  pnpm rollback:list');
  console.log('  pnpm rollback:restore <snapshotId>');
  console.log('  pnpm rollback:prune [keepCount]');
  console.log('');
  console.log('说明:');
  console.log('  1. 不传文件路径时，会为主要项目目录创建默认快照。');
  console.log('  2. 传文件或目录时，只快照指定范围。');
}

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'create': {
      const [firstArg, ...restArgs] = args;
      const hasExplicitPaths = firstArg && (firstArg.includes('/') || firstArg.includes('\\') || firstArg.includes('.'));
      const label = hasExplicitPaths ? '' : (firstArg || '');
      const inputPaths = hasExplicitPaths ? [firstArg, ...restArgs] : restArgs;
      await createSnapshot(label, inputPaths.filter(Boolean));
      return;
    }
    case 'list':
      await listSnapshots();
      return;
    case 'restore':
      await restoreSnapshot(args[0]);
      return;
    case 'prune':
      await pruneSnapshots(args[0]);
      return;
    default:
      printUsage();
  }
}

main().catch((error) => {
  console.error(`回滚工具执行失败: ${error.message}`);
  process.exit(1);
});
