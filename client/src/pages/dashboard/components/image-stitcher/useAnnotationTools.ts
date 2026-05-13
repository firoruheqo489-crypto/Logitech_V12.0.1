/**
 * `useAnnotationTools`
 *
 * Manages all annotation tool behaviors on the Fabric canvas based on
 * the active tool mode. This hook is purely side-effect based — it
 * attaches and detaches canvas/window event listeners as the tool mode
 * changes, and does not render anything.
 *
 * Supported modes:
 * - `select` — default Fabric selection, move, resize, delete (Req 6.1–6.5)
 * - `text`   — click to create editable IText (Req 7.1–7.5)
 * - `rect`   — click-drag to draw hollow rectangle (Req 8.1–8.3)
 * - `arrow`  — click-drag to draw arrow with arrowhead (Req 8.4–8.5)
 * - `brush`  — free drawing mode with configurable width/color (Req 9.1–9.5)
 */

import { useEffect, useRef } from 'react';
import { IText, Rect, Line, Triangle, Group } from 'fabric';
import type { Canvas, TPointerEvent, TPointerEventInfo } from 'fabric';

import type { ToolState } from './types';

/** Fabric v6 pointer event info for mouse:down/move/up handlers. */
type PointerEventOpt = TPointerEventInfo<TPointerEvent>;

export interface UseAnnotationToolsOptions {
  canvas: Canvas | null;
  toolState: ToolState;
  onStateChange?: () => void;
}

/**
 * Attach annotation tool behaviors to the Fabric canvas. The hook
 * reacts to changes in canvas instance, tool mode, and relevant tool
 * properties (brush width/color, font size/color).
 */
export default function useAnnotationTools(options: UseAnnotationToolsOptions): void {
  const { canvas, toolState, onStateChange } = options;

  // Refs for drawing state used by rect and arrow tools. Using refs
  // avoids re-running the effect on every intermediate state change
  // during a drag operation.
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<Rect | Line | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const { mode } = toolState;

    // Reset canvas state for all modes
    canvas.isDrawingMode = false;
    canvas.selection = false;

    // ─── Selection Tool ───────────────────────────────────────────
    if (mode === 'select') {
      canvas.selection = true;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          // Don't delete when editing text
          const target = event.target as HTMLElement | null;
          if (
            target &&
            (target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.isContentEditable)
          ) {
            return;
          }

          const activeObjects = canvas.getActiveObjects();
          if (activeObjects.length > 0) {
            activeObjects.forEach((obj) => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            onStateChange?.();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    // ─── Text Tool ────────────────────────────────────────────────
    if (mode === 'text') {
      const handleMouseDown = (opt: PointerEventOpt) => {
        // Don't create new text if clicking on an existing object
        if (opt.target) return;

        const pointer = canvas.getScenePoint(opt.e);
        const text = new IText('文本', {
          left: pointer.x,
          top: pointer.y,
          fontSize: toolState.fontSize,
          fill: toolState.fontColor,
          fontFamily: 'sans-serif',
        });

        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.requestRenderAll();
        onStateChange?.();
      };

      canvas.on('mouse:down', handleMouseDown);

      return () => {
        canvas.off('mouse:down', handleMouseDown);
      };
    }

    // ─── Rectangle Tool ───────────────────────────────────────────
    if (mode === 'rect') {
      const handleMouseDown = (opt: PointerEventOpt) => {
        if (opt.target) return;
        const pointer = canvas.getScenePoint(opt.e);
        isDrawingRef.current = true;
        startPointRef.current = { x: pointer.x, y: pointer.y };

        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: '#ff0000',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });

        canvas.add(rect);
        currentShapeRef.current = rect;
        canvas.requestRenderAll();
      };

      const handleMouseMove = (opt: PointerEventOpt) => {
        if (!isDrawingRef.current || !startPointRef.current || !currentShapeRef.current) return;

        const pointer = canvas.getScenePoint(opt.e);
        const start = startPointRef.current;
        const rect = currentShapeRef.current as Rect;

        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const width = Math.abs(pointer.x - start.x);
        const height = Math.abs(pointer.y - start.y);

        rect.set({ left, top, width, height });
        canvas.requestRenderAll();
      };

      const handleMouseUp = () => {
        if (!isDrawingRef.current || !currentShapeRef.current) return;

        const rect = currentShapeRef.current as Rect;
        rect.set({ selectable: true, evented: true });
        rect.setCoords();

        isDrawingRef.current = false;
        startPointRef.current = null;
        currentShapeRef.current = null;

        canvas.requestRenderAll();
        onStateChange?.();
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
        // Clean up any in-progress drawing
        isDrawingRef.current = false;
        startPointRef.current = null;
        currentShapeRef.current = null;
      };
    }

    // ─── Arrow Tool ───────────────────────────────────────────────
    if (mode === 'arrow') {
      let previewLine: Line | null = null;

      const handleMouseDown = (opt: PointerEventOpt) => {
        if (opt.target) return;
        const pointer = canvas.getScenePoint(opt.e);
        isDrawingRef.current = true;
        startPointRef.current = { x: pointer.x, y: pointer.y };

        // Create a preview line
        previewLine = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: '#ff0000',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });

        canvas.add(previewLine);
        canvas.requestRenderAll();
      };

      const handleMouseMove = (opt: PointerEventOpt) => {
        if (!isDrawingRef.current || !startPointRef.current || !previewLine) return;

        const pointer = canvas.getScenePoint(opt.e);
        previewLine.set({ x2: pointer.x, y2: pointer.y });
        canvas.requestRenderAll();
      };

      const handleMouseUp = (opt: PointerEventOpt) => {
        if (!isDrawingRef.current || !startPointRef.current) return;

        const pointer = canvas.getScenePoint(opt.e);
        const start = startPointRef.current;
        const endX = pointer.x;
        const endY = pointer.y;

        // Remove the preview line
        if (previewLine) {
          canvas.remove(previewLine);
          previewLine = null;
        }

        // Calculate angle for arrowhead
        const angleDeg = Math.atan2(endY - start.y, endX - start.x) * (180 / Math.PI) + 90;

        // Create the arrow line
        const arrowLine = new Line([start.x, start.y, endX, endY], {
          stroke: '#ff0000',
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });

        // Create the arrowhead triangle
        const arrowHead = new Triangle({
          width: 12,
          height: 12,
          fill: '#ff0000',
          left: endX,
          top: endY,
          angle: angleDeg,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });

        // Group the line and arrowhead
        const arrowGroup = new Group([arrowLine, arrowHead], {
          selectable: true,
          evented: true,
        });

        canvas.add(arrowGroup);
        canvas.requestRenderAll();

        isDrawingRef.current = false;
        startPointRef.current = null;

        onStateChange?.();
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
        // Clean up preview line if effect tears down mid-draw
        if (previewLine) {
          canvas.remove(previewLine);
          previewLine = null;
        }
        isDrawingRef.current = false;
        startPointRef.current = null;
      };
    }

    // ─── Brush Tool ───────────────────────────────────────────────
    if (mode === 'brush') {
      canvas.isDrawingMode = true;

      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.width = toolState.brushWidth;
        canvas.freeDrawingBrush.color = toolState.brushColor;
      }

      const handlePathCreated = () => {
        onStateChange?.();
      };

      canvas.on('path:created', handlePathCreated);

      return () => {
        canvas.off('path:created', handlePathCreated);
        canvas.isDrawingMode = false;
      };
    }

    // Fallback: no-op cleanup for unknown modes
    return undefined;
  }, [canvas, toolState.mode, toolState.brushWidth, toolState.brushColor, toolState.fontSize, toolState.fontColor, onStateChange]);
}
