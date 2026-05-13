/**
 * `useHistoryManager`
 *
 * Maintains an undo/redo stack for the image stitcher's Fabric.js
 * canvas using JSON snapshots (see Requirements 10.1–10.6 and the
 * design's {@link HistoryState} model).
 *
 * Snapshots are produced with `JSON.stringify(canvas.toJSON())` and
 * restored via `canvas.loadFromJSON(...)`. While a snapshot is being
 * loaded back into the canvas, {@link isRestoringRef} is held `true`
 * so that callers wiring Fabric events can skip the {@link record}
 * call that would otherwise fire for those synthetic mutations.
 *
 * Behavioral contract:
 * - 10.2 `record()` serializes the current canvas state, pushes the
 *   prior present onto `past`, promotes the new snapshot to `present`,
 *   and clears `future`.
 * - 10.3 `undo()` moves the current present onto `future`, promotes
 *   the top of `past` to `present`, and loads that snapshot.
 * - 10.4 `redo()` is the symmetric inverse of `undo()`.
 * - 10.5 / 10.6 `canUndo` / `canRedo` expose stack emptiness so the
 *   toolbar can disable its buttons.
 * - On mount with a fresh canvas, the hook records one baseline
 *   snapshot so the first user action has something to undo to.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Canvas } from 'fabric';

import type { HistoryState } from './types';

const INITIAL_HISTORY: HistoryState = {
  past: [],
  present: '',
  future: [],
};

/**
 * Imperative API returned by {@link useHistoryManager}. The
 * `isRestoringRef` flag is exposed so Fabric event handlers in the
 * workspace can skip recording during programmatic `loadFromJSON`
 * replays triggered by undo/redo.
 */
export interface HistoryManagerAPI {
  undo: () => void;
  redo: () => void;
  record: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isRestoringRef: MutableRefObject<boolean>;
}

/**
 * Track undo/redo state for the given Fabric canvas.
 *
 * The hook takes a nullable canvas so it can be called unconditionally
 * from the workspace while the Fabric instance is still being
 * initialized by {@link useCanvasManager}.
 */
export default function useHistoryManager(
  canvas: Canvas | null,
): HistoryManagerAPI {
  const [history, setHistory] = useState<HistoryState>(INITIAL_HISTORY);

  // While true, record() becomes a no-op and Fabric event handlers in
  // the workspace should also skip snapshotting. This prevents the
  // load triggered by undo/redo from re-entering the history stack.
  const isRestoringRef = useRef<boolean>(false);

  // Used to ensure the one-time baseline snapshot only runs once per
  // canvas instance, even in React Strict Mode where effects may be
  // invoked twice on mount.
  const baselineCanvasRef = useRef<Canvas | null>(null);

  /**
   * Capture the current canvas state as a snapshot and advance the
   * history stack. No-ops when the canvas isn't ready or a restore is
   * currently in progress.
   */
  const record = useCallback(() => {
    if (!canvas) return;
    if (isRestoringRef.current) return;

    const snapshot = JSON.stringify(canvas.toJSON());
    setHistory((prev) => {
      // Skip no-op snapshots so repeated record() calls without
      // intervening changes don't bloat the past stack.
      if (snapshot === prev.present) return prev;

      const nextPast = prev.present ? [...prev.past, prev.present] : prev.past;
      return {
        past: nextPast,
        present: snapshot,
        future: [],
      };
    });
  }, [canvas]);

  // Record a baseline snapshot once the canvas becomes available, so
  // the first user-triggered record() has a previous state to fall
  // back to via undo.
  useEffect(() => {
    if (!canvas) {
      baselineCanvasRef.current = null;
      return;
    }
    if (baselineCanvasRef.current === canvas) return;
    baselineCanvasRef.current = canvas;

    const snapshot = JSON.stringify(canvas.toJSON());
    setHistory({
      past: [],
      present: snapshot,
      future: [],
    });
  }, [canvas]);

  /**
   * Load a serialized snapshot back into the canvas, holding the
   * restore flag around the async Fabric load so callers can suppress
   * event-driven recording while the mutation is in flight.
   */
  const loadState = useCallback(
    (state: string) => {
      if (!canvas) return;
      isRestoringRef.current = true;
      canvas
        .loadFromJSON(state)
        .then(() => {
          canvas.requestRenderAll();
        })
        .catch(() => {
          // Swallow load errors; the ref is cleared in the finally
          // block below so the manager doesn't get stuck in restore
          // mode on a corrupt snapshot.
        })
        .finally(() => {
          isRestoringRef.current = false;
        });
    },
    [canvas],
  );

  const undo = useCallback(() => {
    if (!canvas) return;
    if (history.past.length === 0) return;

    const newPresent = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    const newFuture = history.present
      ? [history.present, ...history.future]
      : history.future;

    loadState(newPresent);
    setHistory({
      past: newPast,
      present: newPresent,
      future: newFuture,
    });
  }, [canvas, history, loadState]);

  const redo = useCallback(() => {
    if (!canvas) return;
    if (history.future.length === 0) return;

    const [newPresent, ...newFuture] = history.future;
    const newPast = history.present
      ? [...history.past, history.present]
      : history.past;

    loadState(newPresent);
    setHistory({
      past: newPast,
      present: newPresent,
      future: newFuture,
    });
  }, [canvas, history, loadState]);

  return {
    undo,
    redo,
    record,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    isRestoringRef,
  };
}
