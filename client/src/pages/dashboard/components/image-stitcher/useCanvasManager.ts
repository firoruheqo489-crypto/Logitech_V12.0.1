/**
 * `useCanvasManager`
 *
 * Owns the lifecycle of the Fabric.js canvas used by the image
 * stitcher workspace: creation, disposal, responsive sizing,
 * mouse-wheel zoom, and spacebar-hold panning.
 *
 * The hook is intentionally UI-agnostic — it exposes an imperative
 * {@link CanvasManagerAPI} that the workspace component composes with
 * the toolbar and history manager. Tool-mode selection, object
 * creation, and snapshot recording live in higher-level layers.
 *
 * Behavioral contract (see Requirements 2.1–2.5):
 * - 2.1 Initializes a responsive Fabric canvas on mount, disposes on
 *   unmount, and resizes it to match the container via
 *   `ResizeObserver`.
 * - 2.2 Mouse wheel zooms the canvas centered on the cursor position,
 *   clamped between {@link MIN_ZOOM} and {@link MAX_ZOOM}.
 * - 2.3 Holding Space enables pan mode: mouse drag translates the
 *   viewport transform.
 * - 2.4 While Space is held, the canvas shows a `grab` (or `grabbing`
 *   while dragging) cursor.
 * - 2.5 Releasing Space restores interactive selection and the
 *   default cursor so the workspace's active tool can resume.
 */

import { Canvas, Point } from 'fabric';
import type { TPointerEventInfo } from 'fabric';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { CanvasManagerAPI } from './types';

/** Minimum allowed zoom (matches Figma-style clamp). */
const MIN_ZOOM = 0.1;
/** Maximum allowed zoom (matches Figma-style clamp). */
const MAX_ZOOM = 5;
/** Zoom sensitivity factor applied per wheel delta unit. */
const ZOOM_WHEEL_FACTOR = 0.999;

export interface UseCanvasManagerOptions {
  /** Wrapping element whose dimensions drive the responsive canvas size. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The `<canvas>` element that Fabric.js will attach to. */
  canvasElRef: React.RefObject<HTMLCanvasElement | null>;
  /** When false, canvas will not be initialized. Defaults to true. */
  enabled?: boolean;
}

/** Clamp a zoom value into the supported range. */
function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  if (zoom < MIN_ZOOM) return MIN_ZOOM;
  if (zoom > MAX_ZOOM) return MAX_ZOOM;
  return zoom;
}

/**
 * Initialize and manage a Fabric.js canvas bound to the provided DOM
 * refs, returning an imperative API for the workspace to drive
 * zoom/viewport operations.
 */
export default function useCanvasManager(
  options: UseCanvasManagerOptions,
): CanvasManagerAPI {
  const { containerRef, canvasElRef, enabled = true } = options;

  const [canvas, setCanvas] = useState<Canvas | null>(null);

  // Space-key pan state is kept in refs so the keyboard + mouse
  // handlers can coordinate without triggering re-renders.
  const isSpaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  // Remembers canvas.selection so it can be restored on space release.
  const previousSelectionRef = useRef<boolean>(true);

  // Canvas lifecycle: create on mount, dispose on unmount.
  // Use a ref to track whether the canvas has been disposed so the
  // ResizeObserver callback doesn't call setDimensions on a dead instance.
  const isDisposedRef = useRef(false);

  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const container = containerRef.current;
    if (!canvasEl || !container || !enabled) return;

    isDisposedRef.current = false;

    // Wait for the container to have non-zero dimensions before
    // initializing Fabric. This avoids the "this.lower is undefined"
    // crash that occurs when Fabric tries to size a 0×0 canvas.
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const fabricCanvas = new Canvas(canvasEl, {
      width: w,
      height: h,
      backgroundColor: '#0f172a',
      preserveObjectStacking: true,
      selection: true,
    });

    setCanvas(fabricCanvas);

    return () => {
      isDisposedRef.current = true;
      setCanvas(null);
      void fabricCanvas.dispose();
    };
    // We intentionally depend only on the refs' identity and enabled flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Responsive sizing: keep the Fabric canvas matched to the
  // container's current box via ResizeObserver.
  useEffect(() => {
    if (!canvas) return;
    const container = containerRef.current;
    if (!container) return;

    const applySize = () => {
      // Guard against calling setDimensions on a disposed canvas
      if (isDisposedRef.current) return;
      const width = Math.max(1, Math.floor(container.clientWidth));
      const height = Math.max(1, Math.floor(container.clientHeight));
      if (width <= 1 || height <= 1) return; // Skip if container hasn't laid out yet
      try {
        canvas.setDimensions({ width, height });
        canvas.requestRenderAll();
      } catch {
        // Canvas may have been disposed between the check and the call
      }
    };

    // Delay initial sizing slightly to ensure the container has laid out
    const timer = setTimeout(applySize, 50);

    const observer = new ResizeObserver(() => {
      applySize();
    });
    observer.observe(container);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [canvas, containerRef]);

  // Mouse-wheel zoom centered on the cursor.
  useEffect(() => {
    if (!canvas) return;

    const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
      const event = opt.e;
      const delta = event.deltaY;
      const currentZoom = canvas.getZoom();
      const nextZoom = clampZoom(currentZoom * Math.pow(ZOOM_WHEEL_FACTOR, delta));

      canvas.zoomToPoint(new Point(event.offsetX, event.offsetY), nextZoom);

      event.preventDefault();
      event.stopPropagation();
    };

    canvas.on('mouse:wheel', handleWheel);
    return () => {
      canvas.off('mouse:wheel', handleWheel);
    };
  }, [canvas]);

  // Spacebar-driven pan mode: key state + mouse translation of the
  // viewport transform. Handlers share refs so they can be attached
  // and detached cleanly on unmount.
  useEffect(() => {
    if (!canvas) return;

    const enterPanMode = () => {
      if (isSpaceDownRef.current) return;
      isSpaceDownRef.current = true;
      previousSelectionRef.current = canvas.selection ?? true;
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.setCursor('grab');
      // Deselect any active object so drags don't move it instead of
      // panning the viewport.
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };

    const exitPanMode = () => {
      if (!isSpaceDownRef.current) return;
      isSpaceDownRef.current = false;
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      canvas.selection = previousSelectionRef.current;
      canvas.defaultCursor = 'default';
      canvas.setCursor('default');
      canvas.requestRenderAll();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      // Ignore repeats and text-input contexts so typing inside a
      // Fabric IText or an HTML input doesn't hijack space.
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      enterPanMode();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      exitPanMode();
    };

    // If the window loses focus while space is held, release pan mode
    // so the canvas doesn't get stuck in a non-interactive state.
    const handleBlur = () => exitPanMode();

    const handleMouseDown = (opt: TPointerEventInfo<MouseEvent>) => {
      if (!isSpaceDownRef.current) return;
      isPanningRef.current = true;
      lastPanPointRef.current = { x: opt.e.clientX, y: opt.e.clientY };
      canvas.setCursor('grabbing');
    };

    const handleMouseMove = (opt: TPointerEventInfo<MouseEvent>) => {
      if (!isSpaceDownRef.current || !isPanningRef.current) return;
      const last = lastPanPointRef.current;
      if (!last) return;

      const dx = opt.e.clientX - last.x;
      const dy = opt.e.clientY - last.y;
      lastPanPointRef.current = { x: opt.e.clientX, y: opt.e.clientY };

      const vpt = canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.setViewportTransform(vpt);
      canvas.setCursor('grabbing');
    };

    const handleMouseUp = () => {
      if (!isSpaceDownRef.current) {
        isPanningRef.current = false;
        lastPanPointRef.current = null;
        return;
      }
      isPanningRef.current = false;
      lastPanPointRef.current = null;
      canvas.setCursor('grab');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);

      // Safety: ensure we don't leave the canvas in pan mode if the
      // effect tears down mid-hold.
      if (isSpaceDownRef.current) {
        canvas.selection = previousSelectionRef.current;
        canvas.defaultCursor = 'default';
        isSpaceDownRef.current = false;
        isPanningRef.current = false;
        lastPanPointRef.current = null;
      }
    };
  }, [canvas]);

  // Imperative API: programmatic zoom to a point, clamped to range.
  const zoomToPoint = useCallback(
    (point: { x: number; y: number }, zoom: number) => {
      if (!canvas) return;
      canvas.zoomToPoint(new Point(point.x, point.y), clampZoom(zoom));
    },
    [canvas],
  );

  // Reset viewport transform to the identity and zoom to 1.
  const resetView = useCallback(() => {
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);
    canvas.requestRenderAll();
  }, [canvas]);

  // Zoom to fit all objects within the visible canvas area with padding.
  const zoomToFit = useCallback(
    (padding = 20) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      if (objects.length === 0) return;

      // Get bounding rect of all objects
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of objects) {
        const bound = obj.getBoundingRect();
        minX = Math.min(minX, bound.left);
        minY = Math.min(minY, bound.top);
        maxX = Math.max(maxX, bound.left + bound.width);
        maxY = Math.max(maxY, bound.top + bound.height);
      }

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      if (contentWidth <= 0 || contentHeight <= 0) return;

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const scaleX = (canvasWidth - padding * 2) / contentWidth;
      const scaleY = (canvasHeight - padding * 2) / contentHeight;
      const zoom = clampZoom(Math.min(scaleX, scaleY));

      // Center the content
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.setZoom(zoom);

      const vpCenter = new Point(canvasWidth / 2, canvasHeight / 2);
      const contentCenter = new Point(centerX * zoom, centerY * zoom);
      const offset = vpCenter.subtract(contentCenter);

      canvas.setViewportTransform([zoom, 0, 0, zoom, offset.x, offset.y]);
      canvas.requestRenderAll();
    },
    [canvas],
  );

  // Set the logical canvas dimensions. Note: this differs from the
  // ResizeObserver-driven viewport sizing — callers pass the stitched
  // image's logical size so exports render at full resolution.
  const setCanvasDimensions = useCallback(
    (width: number, height: number) => {
      if (!canvas || isDisposedRef.current) return;
      try {
        canvas.setDimensions({ width, height });
        canvas.requestRenderAll();
      } catch {
        // Canvas may have been disposed
      }
    },
    [canvas],
  );

  return {
    canvas,
    zoomToPoint,
    resetView,
    zoomToFit,
    setCanvasDimensions,
  };
}
