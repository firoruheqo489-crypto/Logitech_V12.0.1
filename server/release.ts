import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';

type UnknownRecord = Record<string, unknown>;

export type ReleaseManifest = {
  name: string;
  version: string;
  commit: string | null;
  commitShort: string | null;
  builtAt: string | null;
  dirty: boolean | null;
  buildSource: string | null;
  sourceWorkspaceDirty: boolean | null;
};

export type ReleaseInfo = ReleaseManifest & {
  manifestFound: boolean;
  nodeEnv: string;
  runtimeStartedAt: string;
};

const DEFAULT_RELEASE_NAME = 'mold-gantt-v3';
const DEFAULT_RELEASE_VERSION = '0.0.0';
const RUNTIME_STARTED_AT = new Date().toISOString();

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized || null;
}

function readOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function resolveRuntimeBaseDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function resolveReleaseManifestPath(baseDir = resolveRuntimeBaseDir()): string {
  const directCandidate = path.resolve(baseDir, 'release.json');
  if (existsSync(directCandidate)) {
    return directCandidate;
  }

  return path.resolve(baseDir, '..', 'dist', 'release.json');
}

function resolvePackageJsonPath(baseDir = resolveRuntimeBaseDir()): string {
  const directCandidate = path.resolve(baseDir, '..', 'package.json');
  if (existsSync(directCandidate)) {
    return directCandidate;
  }

  return path.resolve(process.cwd(), 'package.json');
}

export function normalizeReleaseManifest(value: unknown): ReleaseManifest | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const commit = readOptionalString(record.commit);
  const commitShort = readOptionalString(record.commitShort) ?? (commit ? commit.slice(0, 7) : null);

  return {
    name: readOptionalString(record.name) ?? DEFAULT_RELEASE_NAME,
    version: readOptionalString(record.version) ?? DEFAULT_RELEASE_VERSION,
    commit,
    commitShort,
    builtAt: readOptionalString(record.builtAt),
    dirty: readOptionalBoolean(record.dirty),
    buildSource: readOptionalString(record.buildSource),
    sourceWorkspaceDirty: readOptionalBoolean(record.sourceWorkspaceDirty),
  };
}

export function readReleaseManifestFromFile(filePath: string): ReleaseManifest | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return normalizeReleaseManifest(raw);
  } catch {
    return null;
  }
}

function readPackageVersionFromFile(filePath: string): string {
  if (!existsSync(filePath)) {
    return DEFAULT_RELEASE_VERSION;
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    const record = asRecord(raw);
    return readOptionalString(record?.version) ?? DEFAULT_RELEASE_VERSION;
  } catch {
    return DEFAULT_RELEASE_VERSION;
  }
}

export function buildReleaseInfo(input: {
  manifest?: ReleaseManifest | null;
  manifestFound?: boolean;
  nodeEnv?: string;
  packageVersion?: string;
  runtimeStartedAt?: string;
} = {}): ReleaseInfo {
  const manifest = input.manifest ?? null;
  const commit = manifest?.commit ?? null;

  return {
    name: manifest?.name ?? DEFAULT_RELEASE_NAME,
    version: manifest?.version ?? input.packageVersion ?? DEFAULT_RELEASE_VERSION,
    commit,
    commitShort: manifest?.commitShort ?? (commit ? commit.slice(0, 7) : null),
    builtAt: manifest?.builtAt ?? null,
    dirty: manifest?.dirty ?? null,
    buildSource: manifest?.buildSource ?? null,
    sourceWorkspaceDirty: manifest?.sourceWorkspaceDirty ?? null,
    manifestFound: input.manifestFound ?? manifest !== null,
    nodeEnv: input.nodeEnv ?? process.env.NODE_ENV ?? 'development',
    runtimeStartedAt: input.runtimeStartedAt ?? RUNTIME_STARTED_AT,
  };
}

export function loadReleaseInfo(): ReleaseInfo {
  const baseDir = resolveRuntimeBaseDir();
  const manifestPath = resolveReleaseManifestPath(baseDir);
  const manifest = readReleaseManifestFromFile(manifestPath);
  const packageVersion = readPackageVersionFromFile(resolvePackageJsonPath(baseDir));

  return buildReleaseInfo({
    manifest,
    manifestFound: manifest !== null,
    packageVersion,
  });
}

export function getReleaseInfoHandler(_req: Request, res: Response): void {
  res.status(200).json(loadReleaseInfo());
}
