import { describe, expect, it } from 'vitest';

import {
  SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER,
  SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE,
  assessProgressSnapshotRisk,
  selectLatestRestorableBackup,
} from './progress-notes.js';

describe('progress note snapshot guardrails', () => {
  it('keeps small snapshot edits unblocked', () => {
    expect(assessProgressSnapshotRisk({
      beforeCount: 6,
      afterCount: 5,
      deletedCount: 1,
    })).toEqual({
      beforeCount: 6,
      afterCount: 5,
      deletedCount: 1,
      reason: 'none',
      requiresConfirmation: false,
    });
  });

  it('requires confirmation before clearing an existing mold snapshot', () => {
    expect(assessProgressSnapshotRisk({
      beforeCount: 2,
      afterCount: 0,
      deletedCount: 2,
    })).toEqual({
      beforeCount: 2,
      afterCount: 0,
      deletedCount: 2,
      reason: 'clear-all',
      requiresConfirmation: true,
    });
  });

  it('requires confirmation before deleting the majority of stored entries', () => {
    expect(assessProgressSnapshotRisk({
      beforeCount: 20,
      afterCount: 1,
      deletedCount: 19,
    })).toEqual({
      beforeCount: 20,
      afterCount: 1,
      deletedCount: 19,
      reason: 'majority-delete',
      requiresConfirmation: true,
    });
  });

  it('keeps the destructive confirmation contract stable for manual recovery tools', () => {
    expect(SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER).toBe('x-snapshot-confirmation');
    expect(SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE).toBe('allow-destructive');
  });

  it('restores the latest safe backup instead of a suspicious one-entry snapshot', () => {
    const selected = selectLatestRestorableBackup([
      {
        id: 203,
        created_at: '2026-03-19T09:30:00.000Z',
        snapshot: [
          { id: 'note-1', date: '2026-03-19', content: 'only surviving row' },
        ],
      },
      {
        id: 202,
        created_at: '2026-03-19T09:00:00.000Z',
        snapshot: [
          { id: 'note-1', date: '2026-03-19', content: 'row 1' },
          { id: 'note-2', date: '2026-03-18', content: 'row 2' },
          { id: 'note-3', date: '2026-03-17', content: 'row 3' },
          { id: 'note-4', date: '2026-03-16', content: 'row 4' },
          { id: 'note-5', date: '2026-03-15', content: 'row 5' },
        ],
      },
      {
        id: 201,
        created_at: '2026-03-19T08:00:00.000Z',
        snapshot: [
          { id: 'note-1', date: '2026-03-19', content: 'row 1' },
          { id: 'note-2', date: '2026-03-18', content: 'row 2' },
          { id: 'note-3', date: '2026-03-17', content: 'row 3' },
          { id: 'note-4', date: '2026-03-16', content: 'row 4' },
          { id: 'note-5', date: '2026-03-15', content: 'row 5' },
        ],
      },
    ]);

    expect(selected).not.toBeNull();
    expect(selected?.id).toBe(202);
    expect(selected?.backupAt).toBe('2026-03-19T09:00:00.000Z');
    expect(selected?.snapshot).toHaveLength(5);
    expect(selected?.snapshot[0]?.id).toBe('note-1');
  });

  it('skips empty and malformed snapshots when looking for a restorable backup', () => {
    const selected = selectLatestRestorableBackup([
      { id: 303, created_at: '2026-03-19T10:00:00.000Z', snapshot: 'not-json' },
      { id: 302, created_at: '2026-03-19T09:30:00.000Z', snapshot: [] },
      {
        id: 301,
        created_at: '2026-03-19T09:00:00.000Z',
        snapshot: [
          { id: 'note-a', date: '2026-03-19', content: 'safe row' },
        ],
      },
    ]);

    expect(selected?.id).toBe(301);
    expect(selected?.backupAt).toBe('2026-03-19T09:00:00.000Z');
  });
});
