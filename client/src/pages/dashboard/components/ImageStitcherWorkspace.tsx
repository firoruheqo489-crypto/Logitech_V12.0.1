/**
 * ImageStitcherWorkspace
 *
 * Two-phase approach:
 * Phase 1 (upload): Canvas disabled. Drop zone + image list visible.
 * Phase 2 (edit): After stitch, canvas enabled and rendered.
 */

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { FabricImage } from 'fabric';

import type { ImageEntry, ToolState, StitchDirection } from './image-stitcher/types';
import useCanvasManager from './image-stitcher/useCanvasManager';
import useHistoryManager from './image-stitcher/useHistoryManager';
import useAnnotationTools from './image-stitcher/useAnnotationTools';
import { computeVerticalStitch, computeHorizontalStitch } from './image-stitcher/stitchingEngine';
import ImageDropZone from './image-stitcher/ImageDropZone';
import ImageStitcherToolbar from './image-stitcher/ImageStitcherToolbar';
import { Trash2 } from 'lucide-react';

const DEFAULT_TOOL_STATE: ToolState = {
  mode: 'select',
  brushWidth: 3,
  brushColor: '#ff0000',
  fontSize: 20,
  fontColor: '#ff0000',
};

const A4_LANDSCAPE_ASPECT = 297 / 210;
const UPLOADED_IMAGES_TITLE = '\u5DF2\u4E0A\u4F20\u56FE\u7247';
const IMAGE_COUNT_UNIT = '\u5F20';
const IDLE_IMAGE_HINT =
  '\u62D6\u52A8\u7F29\u7565\u56FE\u53EF\u8C03\u6574\u62FC\u63A5\u987A\u5E8F\uff0c\u70B9\u51FB\u4E0A\u65B9\u5DE5\u5177\u680F\u7684\u201C\u5782\u76F4\u62FC\u63A5\u201D\u6216\u201C\u6C34\u5E73\u62FC\u63A5\u201D\u5F00\u59CB';
const EDIT_IMAGE_HINT =
  '\u62D6\u52A8\u7F29\u7565\u56FE\u53EF\u91CD\u6392\u987A\u5E8F\uff0c\u5982\u9700\u91CD\u65B0\u751F\u6210\u62FC\u63A5\u5E03\u5C40\uff0C\u8BF7\u518D\u70B9\u51FB\u4E0A\u65B9\u7684\u62FC\u63A5\u6309\u94AE';
const DELETE_IMAGE_LABEL = '\u5220\u9664\u56FE\u7247';

export default function ImageStitcherWorkspace() {
  const [toolState, setToolState] = useState<ToolState>(DEFAULT_TOOL_STATE);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<StitchDirection | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
  // Track which image is pending deletion (for confirm dialog)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Track logical content size for export
  const logicalSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);

  const { canvas, zoomToFit } = useCanvasManager({
    containerRef,
    canvasElRef,
    enabled: true, // Always enabled — canvas DOM is always mounted
  });

  const { undo, redo, record, canUndo, canRedo } = useHistoryManager(canvas);

  useAnnotationTools({
    canvas,
    toolState,
    onStateChange: record,
  });

  // When entering edit mode with a pending direction, perform the stitch
  useEffect(() => {
    if (!canvas || !pendingDirection || !editMode || images.length === 0) return;

    const layout =
      pendingDirection === 'vertical'
        ? computeVerticalStitch(images)
        : computeHorizontalStitch(images);

    // Store logical size for export
    logicalSizeRef.current = { width: layout.canvasWidth, height: layout.canvasHeight };

    canvas.clear();
    canvas.backgroundColor = '#ffffff';

    for (const placement of layout.placements) {
      const entry = images.find((img) => img.id === placement.imageId);
      if (!entry) continue;
      const fabricImg = new FabricImage(entry.element, {
        left: placement.x,
        top: placement.y,
      });
      fabricImg.set({
        width: entry.width,
        height: entry.height,
        scaleX: placement.scaleX,
        scaleY: placement.scaleY,
      });
      canvas.add(fabricImg);
    }

    canvas.requestRenderAll();

    setTimeout(() => {
      zoomToFit(30);
      record();
    }, 100);

    setPendingDirection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, pendingDirection, editMode]);

  const handleStitch = useCallback(
    (direction: StitchDirection) => {
      if (images.length === 0) return;

      if (editMode && canvas) {
        // Already in edit mode with canvas ready - stitch directly
        const layout =
          direction === 'vertical'
            ? computeVerticalStitch(images)
            : computeHorizontalStitch(images);

        logicalSizeRef.current = { width: layout.canvasWidth, height: layout.canvasHeight };

        canvas.clear();
        canvas.backgroundColor = '#ffffff';

        for (const placement of layout.placements) {
          const entry = images.find((img) => img.id === placement.imageId);
          if (!entry) continue;
          const fabricImg = new FabricImage(entry.element, {
            left: placement.x,
            top: placement.y,
          });
          // Force internal dimensions to natural pixel size, then apply
          // uniform scale to preserve aspect ratio.
          fabricImg.set({
            width: entry.width,
            height: entry.height,
            scaleX: placement.scaleX,
            scaleY: placement.scaleY,
          });
          canvas.add(fabricImg);
        }

        canvas.requestRenderAll();
        setTimeout(() => {
          zoomToFit(30);
          record();
        }, 50);
      } else {
        // Enter edit mode - canvas will initialize and stitch via useEffect
        setPendingDirection(direction);
        setEditMode(true);
      }
    },
    [editMode, canvas, images, zoomToFit, record],
  );

  const handleExport = useCallback(() => {
    if (!canvas) return;

    const { width: logicalW, height: logicalH } = logicalSizeRef.current;
    if (logicalW <= 0 || logicalH <= 0) return;

    // Save current state
    const currentWidth = canvas.getWidth();
    const currentHeight = canvas.getHeight();
    const currentVpt = [...canvas.viewportTransform] as typeof canvas.viewportTransform;

    // Set canvas to logical dimensions and reset viewport for export
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);
    canvas.setDimensions({ width: logicalW, height: logicalH });

    // Use multiplier to ensure minimum export width of 2400px
    const minExportWidth = 2400;
    const multiplier = logicalW < minExportWidth ? minExportWidth / logicalW : 1;

    const dataUrl = canvas.toDataURL({ format: 'png', multiplier });

    // Restore
    canvas.setDimensions({ width: currentWidth, height: currentHeight });
    canvas.setViewportTransform(currentVpt);
    canvas.requestRenderAll();

    // Trigger download
    const link = document.createElement('a');
    link.download = `stitched-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [canvas]);

  const handleImagesLoaded = useCallback((newImages: ImageEntry[]) => {
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const moveImage = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setImages((prev) => {
      const sourceIndex = prev.findIndex((img) => img.id === sourceId);
      const targetIndex = prev.findIndex((img) => img.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const resetDragState = useCallback(() => {
    setDraggedImageId(null);
    setDragOverImageId(null);
  }, []);

  const handleImageDragStart = useCallback((event: DragEvent<HTMLDivElement>, imageId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', imageId);
    setDraggedImageId(imageId);
    setDragOverImageId(imageId);
  }, []);

  const handleImageDragOver = useCallback((event: DragEvent<HTMLDivElement>, imageId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverImageId !== imageId) {
      setDragOverImageId(imageId);
    }
  }, [dragOverImageId]);

  const handleImageDrop = useCallback((event: DragEvent<HTMLDivElement>, imageId: string) => {
    event.preventDefault();
    const sourceId = draggedImageId ?? event.dataTransfer.getData('text/plain');
    if (!sourceId) {
      resetDragState();
      return;
    }

    moveImage(sourceId, imageId);
    resetDragState();
  }, [draggedImageId, moveImage, resetDragState]);

  // When all images are removed, exit edit mode so the drop zone reappears.
  // We do this in an effect (not inside the state updater) to give Fabric
  // time to clean up before React unmounts the canvas DOM node.
  useEffect(() => {
    if (images.length === 0 && editMode) {
      if (canvas) {
        canvas.clear();
      }
      setPendingDirection(null);
      setEditMode(false);
    }
  }, [images.length, editMode, canvas]);

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteId) {
      handleRemoveImage(pendingDeleteId);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, handleRemoveImage]);

  return (
    <div className="flex flex-col gap-4">
      <ImageStitcherToolbar
        activeTool={toolState.mode}
        onToolChange={(mode) => setToolState((prev) => ({ ...prev, mode }))}
        onStitch={handleStitch}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={handleExport}
        brushWidth={toolState.brushWidth}
        onBrushWidthChange={(w) => setToolState((prev) => ({ ...prev, brushWidth: w }))}
        brushColor={toolState.brushColor}
        onBrushColorChange={(c) => setToolState((prev) => ({ ...prev, brushColor: c }))}
        fontSize={toolState.fontSize}
        onFontSizeChange={(s) => setToolState((prev) => ({ ...prev, fontSize: s }))}
        fontColor={toolState.fontColor}
        onFontColorChange={(c) => setToolState((prev) => ({ ...prev, fontColor: c }))}
      />

      {/* Canvas area */}
      <div
        className="relative mx-auto w-full overflow-hidden rounded-lg border border-slate-700/50 bg-slate-950"
        style={{ aspectRatio: editMode ? `${A4_LANDSCAPE_ASPECT}` : undefined, minHeight: editMode ? undefined : '200px' }}
      >
        {/* Canvas is always mounted to avoid Fabric DOM removal crashes */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ visibility: editMode ? 'visible' : 'hidden' }}
        >
          <canvas ref={canvasElRef} />
        </div>
        {/* Drop zone overlays when not in edit mode */}
        {!editMode && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <ImageDropZone onImagesLoaded={handleImagesLoaded} />
          </div>
        )}
      </div>

      {/* Uploaded images list */}
      {images.length > 0 && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-slate-300">
              {UPLOADED_IMAGES_TITLE} ({images.length} {IMAGE_COUNT_UNIT})
            </h3>
            <span className="text-right text-xs text-slate-500">
              {editMode ? EDIT_IMAGE_HINT : IDLE_IMAGE_HINT}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {images.map((img, index) => {
              const isDragging = draggedImageId === img.id;
              const isDropTarget = dragOverImageId === img.id && draggedImageId !== img.id;

              return (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(event) => handleImageDragStart(event, img.id)}
                  onDragOver={(event) => handleImageDragOver(event, img.id)}
                  onDrop={(event) => handleImageDrop(event, img.id)}
                  onDragEnd={resetDragState}
                  className={`group relative h-20 w-28 overflow-hidden rounded-md border bg-slate-800 transition-all ${
                    isDragging
                      ? 'cursor-grabbing border-cyan-400/70 opacity-60 shadow-lg shadow-cyan-900/30'
                      : isDropTarget
                        ? 'cursor-grab border-cyan-500 shadow-lg shadow-cyan-900/20 ring-2 ring-cyan-500/40'
                        : 'cursor-grab border-slate-700/50 hover:border-cyan-500/50'
                  }`}
                  title={IDLE_IMAGE_HINT}
                >
                  <div className="absolute left-1 top-1 z-10 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                    {index + 1}
                  </div>
                  <img
                    src={img.element.src}
                    alt={img.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(img.id)}
                    draggable={false}
                    className="absolute right-1 top-1 hidden rounded-full bg-red-600/80 p-1 text-white transition-colors hover:bg-red-500 group-hover:block"
                    title={DELETE_IMAGE_LABEL}
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-slate-300">
                    {img.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {images.length > 0 && false && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">
              已上传图片 ({images.length} 张)
            </h3>
            {!editMode && (
              <span className="text-xs text-slate-500">
                点击上方工具栏的"垂直拼接"或"水平拼接"开始
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative h-20 w-28 overflow-hidden rounded-md border border-slate-700/50 bg-slate-800"
              >
                <img
                  src={img.element.src}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(img.id)}
                  className="absolute right-1 top-1 hidden rounded-full bg-red-600/80 p-1 text-white transition-colors hover:bg-red-500 group-hover:block"
                  title="删除图片"
                >
                  <Trash2 size={12} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-slate-300">
                  {img.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Confirm delete dialog */}
      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirmDelete();
            if (e.key === 'Escape') setPendingDeleteId(null);
          }}
        >
          <div className="mx-4 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h3 className="mb-2 text-base font-medium text-slate-100">确认删除</h3>
            <p className="mb-5 text-sm text-slate-400">确定要删除这张图片吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded-md border border-slate-600 px-4 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDelete}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-red-500"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
