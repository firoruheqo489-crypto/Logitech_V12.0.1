import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { IssueRecord } from '@/lib/issueService';

type PersistIssueRecord = (record: IssueRecord) => Promise<boolean>;

interface UseDebouncedDirtyIssueAutosaveOptions {
  persistRecord: PersistIssueRecord;
  onPartialFailure?: () => void;
  delayMs?: number;
}

export function useDebouncedDirtyIssueAutosave({
  persistRecord,
  onPartialFailure,
  delayMs = 1500,
}: UseDebouncedDirtyIssueAutosaveOptions) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(true);
  const dirtyRecordsRef = useRef(new Map<string, IssueRecord>());
  const [dirtyVersion, bumpDirtyVersion] = useReducer((value: number) => value + 1, 0);

  const markDirty = useCallback((record: IssueRecord) => {
    dirtyRecordsRef.current.set(record.id, record);
    bumpDirtyVersion();
  }, []);

  const clearDirty = useCallback((recordId: string) => {
    if (!dirtyRecordsRef.current.delete(recordId)) {
      return;
    }

    bumpDirtyVersion();
  }, []);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    if (dirtyRecordsRef.current.size === 0) {
      return;
    }

    let cancelled = false;

    saveTimer.current = setTimeout(() => {
      void (async () => {
        const pendingEntries = Array.from(dirtyRecordsRef.current.entries());
        const results = await Promise.all(
          pendingEntries.map(async ([recordId, record]) => ({
            recordId,
            record,
            saved: await persistRecord(record),
          })),
        );

        if (cancelled) {
          return;
        }

        let clearedDirty = false;
        let sawFailure = false;

        for (const result of results) {
          if (!result.saved) {
            sawFailure = true;
            continue;
          }

          if (dirtyRecordsRef.current.get(result.recordId) !== result.record) {
            continue;
          }

          dirtyRecordsRef.current.delete(result.recordId);
          clearedDirty = true;
        }

        if (clearedDirty) {
          bumpDirtyVersion();
        }

        if (sawFailure) {
          onPartialFailure?.();
        }
      })();
    }, delayMs);

    return () => {
      cancelled = true;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [delayMs, dirtyVersion, onPartialFailure, persistRecord]);

  return {
    markDirty,
    clearDirty,
  };
}
