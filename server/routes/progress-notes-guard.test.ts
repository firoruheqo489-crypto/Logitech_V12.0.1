import { describe, expect, it } from 'vitest';

import {
  SNAPSHOT_DESTRUCTIVE_CONFIRMATION_HEADER,
  SNAPSHOT_DESTRUCTIVE_CONFIRMATION_VALUE,
  assessProgressSnapshotRisk,
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
});
