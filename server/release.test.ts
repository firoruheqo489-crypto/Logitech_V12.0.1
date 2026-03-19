import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildReleaseInfo,
  normalizeReleaseManifest,
  readReleaseManifestFromFile,
} from './release.js';

describe('release metadata', () => {
  it('normalizes a manifest and derives the short commit hash', () => {
    const manifest = normalizeReleaseManifest({
      name: 'mold-gantt-v3',
      version: '1.0.0',
      commit: '1234567890abcdef1234567890abcdef12345678',
      builtAt: '2026-03-19T14:00:00.000Z',
      dirty: false,
    });

    expect(manifest).toEqual({
      name: 'mold-gantt-v3',
      version: '1.0.0',
      commit: '1234567890abcdef1234567890abcdef12345678',
      commitShort: '1234567',
      builtAt: '2026-03-19T14:00:00.000Z',
      dirty: false,
    });
  });

  it('reads a valid manifest file from disk', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'release-manifest-'));
    const manifestPath = path.join(tempDir, 'release.json');

    writeFileSync(manifestPath, JSON.stringify({
      name: 'mold-gantt-v3',
      version: '1.0.0',
      commit: 'abcdef1234567890abcdef1234567890abcdef12',
      commitShort: 'abcdef1',
      builtAt: '2026-03-19T14:00:00.000Z',
      dirty: false,
    }), 'utf8');

    expect(readReleaseManifestFromFile(manifestPath)).toEqual({
      name: 'mold-gantt-v3',
      version: '1.0.0',
      commit: 'abcdef1234567890abcdef1234567890abcdef12',
      commitShort: 'abcdef1',
      builtAt: '2026-03-19T14:00:00.000Z',
      dirty: false,
    });
  });

  it('falls back to package metadata when the manifest is missing', () => {
    const info = buildReleaseInfo({
      manifest: null,
      manifestFound: false,
      packageVersion: '1.0.0',
      runtimeStartedAt: '2026-03-19T14:00:00.000Z',
      nodeEnv: 'production',
    });

    expect(info).toEqual({
      name: 'mold-gantt-v3',
      version: '1.0.0',
      commit: null,
      commitShort: null,
      builtAt: null,
      dirty: null,
      manifestFound: false,
      nodeEnv: 'production',
      runtimeStartedAt: '2026-03-19T14:00:00.000Z',
    });
  });
});
