import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.resolve(repoRoot, 'package.json');

type PackageJsonScripts = Record<string, string>;

const requiredScriptFragments = [
  {
    name: 'dev:dashboard:local',
    fragments: [
      'node scripts/start-local-dashboard.mjs',
      '-File scripts/report-local-dashboard-state.ps1',
    ],
  },
  {
    name: 'dev:dashboard:status',
    fragments: ['-File scripts/report-local-dashboard-state.ps1'],
  },
  {
    name: 'verify:release-guards',
    fragments: ['node --import ./scripts/register-ts-path-loader.mjs --experimental-strip-types ./scripts/verify-release-guards.ts'],
  },
  {
    name: 'release',
    fragments: ['node scripts/release-entrypoint.mjs all'],
  },
  {
    name: '_release:build',
    fragments: ['node scripts/release-entrypoint.mjs build'],
  },
  {
    name: '_release:deploy',
    fragments: ['node scripts/release-entrypoint.mjs deploy'],
  },
] as const;

const criticalRepoFiles = [
  'scripts/start-local-dashboard.mjs',
  'scripts/report-local-dashboard-state.ps1',
  'scripts/show-release-sop.ps1',
  'scripts/release-entrypoint.mjs',
  'scripts/release-from-clean-worktree.ps1',
  'scripts/release-build.ps1',
  'scripts/deploy-release-artifact.ps1',
  'scripts/export-dashboard-grr-state.mjs',
  'docs/release-sop.md',
] as const;

async function loadPackageScripts(): Promise<PackageJsonScripts> {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, unknown>;
  };

  const scripts = packageJson.scripts ?? {};
  return Object.fromEntries(
    Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await access(path.resolve(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isTrackedByGit(relativePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['ls-files', '--error-unmatch', relativePath],
      { cwd: repoRoot },
      (error) => resolve(!error),
    );
  });
}

describe('critical local entrypoints', () => {
  it('keeps package scripts pointed at the verified dashboard and release wrappers', async () => {
    const scripts = await loadPackageScripts();

    for (const requirement of requiredScriptFragments) {
      const command = scripts[requirement.name];

      expect(command, `missing package script: ${requirement.name}`).toBeTypeOf('string');

      for (const fragment of requirement.fragments) {
        expect(command).toContain(fragment);
      }
    }
  });

  it('keeps every critical wrapper file present in the repository tree', async () => {
    const checks = await Promise.all(
      criticalRepoFiles.map(async (relativePath) => ({
        relativePath,
        exists: await fileExists(relativePath),
      })),
    );

    expect(checks.filter((entry) => !entry.exists)).toEqual([]);
  });

  it('keeps every critical wrapper file tracked by git', async () => {
    const checks = await Promise.all(
      criticalRepoFiles.map(async (relativePath) => ({
        relativePath,
        tracked: await isTrackedByGit(relativePath),
      })),
    );

    expect(checks.filter((entry) => !entry.tracked)).toEqual([]);
  });

  it('exports the live GRR snapshot on the server before replacing the deployed bundle', async () => {
    const [buildSource, deploySource, exporterSource] = await Promise.all([
      readFile(path.resolve(repoRoot, 'scripts/release-build.ps1'), 'utf8'),
      readFile(path.resolve(repoRoot, 'scripts/deploy-release-artifact.ps1'), 'utf8'),
      readFile(path.resolve(repoRoot, 'scripts/export-dashboard-grr-state.mjs'), 'utf8'),
    ]);

    expect(buildSource).toContain('scripts/export-dashboard-grr-state.mjs');
    expect(buildSource).not.toContain('Copy-Item -Force $grrSnapshotPath');
    expect(exporterSource).toContain("token === '--env-file'");
    expect(exporterSource).toContain("token === '--disable-pinned-hosts'");

    const exportIndex = deploySource.indexOf('node scripts/export-dashboard-grr-state.mjs');
    const replaceIndex = deploySource.indexOf('rm -rf \"$REMOTE_DIR/dist.new\"');
    expect(exportIndex).toBeGreaterThan(-1);
    expect(replaceIndex).toBeGreaterThan(exportIndex);
  });
});
