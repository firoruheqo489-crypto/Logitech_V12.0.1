import type { Canvas } from 'fabric';

/**
 * Active annotation/interaction tool mode on the stitcher canvas.
 */
export type ToolMode = 'select' | 'text' | 'rect' | 'arrow' | 'brush';

/**
 * Direction along which uploaded images should be stitched.
 */
export type StitchDirection = 'vertical' | 'horizontal';

/**
 * A single image loaded into the stitcher queue.
 */
export interface ImageEntry {
  id: string;
  name: string;
  element: HTMLImageElement;
  width: number;
  height: number;
}

/**
 * Undo/redo stack backed by Fabric canvas JSON snapshots.
 *
 * Each entry in {@link past} / {@link future} is a serialized
 * `canvas.toJSON()` string, and {@link present} mirrors the current
 * canvas state.
 */
export interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

/**
 * Imperative API exposed by the canvas manager hook to the workspace
 * and toolbar. Wraps a Fabric canvas with zoom, viewport reset, and
 * dimension helpers.
 */
export interface CanvasManagerAPI {
  canvas: Canvas | null;
  zoomToPoint: (point: { x: number; y: number }, zoom: number) => void;
  resetView: () => void;
  zoomToFit: (padding?: number) => void;
  setCanvasDimensions: (width: number, height: number) => void;
}

/**
 * Geometry computed by the stitching engine for a set of images.
 *
 * The engine is a pure function: it produces canvas dimensions and
 * per-image placement data that the workspace then applies to Fabric
 * image objects.
 */
export interface StitchLayout {
  canvasWidth: number;
  canvasHeight: number;
  placements: Array<{
    imageId: string;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  }>;
}

/**
 * UI-level tool configuration shared across the toolbar and canvas
 * event handlers.
 */
export interface ToolState {
  mode: ToolMode;
  brushWidth: number;
  brushColor: string;
  fontSize: number;
  fontColor: string;
}
