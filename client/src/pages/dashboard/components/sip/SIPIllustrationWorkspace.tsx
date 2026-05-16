"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Canvas, FabricImage, type FabricObject } from "fabric";
import { nanoid } from "nanoid";
import { ImagePlus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import {
  SIP_ILLUSTRATION_SCENE_CONFIG,
  SIP_PRINT_TEMPLATE_LAYOUT,
  type SIPIllustration,
  type SIPIllustrationScene,
  type SIPPrintTemplate,
} from "./types";
import { SIPIllustrationCalibrationOverlay } from "./SIPIllustrationCalibrationOverlay";

interface SIPIllustrationWorkspaceProps {
  data: SIPIllustration;
  template: SIPPrintTemplate;
  onSceneUpdate: (scene: SIPIllustrationScene) => void;
  onActivate?: () => void;
}

export interface SIPIllustrationWorkspaceHandle {
  flushSceneSnapshot: () => SIPIllustrationScene | null;
}

interface LayerData {
  layerId: string;
  label: string;
  locked?: boolean;
}

interface LayerSummary {
  id: string;
  label: string;
  locked: boolean;
  isActive: boolean;
}

interface SelectedObjectDraft {
  layerId: string;
  label: string;
  locked: boolean;
  x: string;
  y: string;
  width: string;
  height: string;
  angle: string;
}

type EditorObject = FabricObject & {
  data?: LayerData;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  left?: number;
  top?: number;
  angle?: number;
  clone: (propertiesToInclude?: string[]) => Promise<EditorObject>;
  getScaledWidth?: () => number;
  getScaledHeight?: () => number;
};

const CANVAS_EDITOR_BACKGROUND = "rgba(255,255,255,0)";
const CANVAS_EXPORT_BACKGROUND = "#ffffff";
const ACTIVE_ACCENT = "#22d3ee";

function createEmptyScene(template: SIPPrintTemplate): SIPIllustrationScene {
  const config = SIP_ILLUSTRATION_SCENE_CONFIG[template];
  return {
    sceneJson: "",
    previewImageUrl: "",
    width: config.width,
    height: config.height,
  };
}

function getScene(data: SIPIllustration, template: SIPPrintTemplate): SIPIllustrationScene {
  return data.scenes[template] ?? createEmptyScene(template);
}

function roundMetric(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

function toMetricString(value: number) {
  return String(roundMetric(value));
}

function getLayerData(object: EditorObject, fallbackIndex: number): LayerData {
  const existing = object.data;
  return {
    layerId: existing?.layerId || nanoid(8),
    label: existing?.label || `\u56fe\u5c42 ${fallbackIndex + 1}`,
    locked: existing?.locked ?? false,
  };
}

function applyObjectVisualState(object: EditorObject) {
  object.set({
    borderColor: ACTIVE_ACCENT,
    cornerColor: ACTIVE_ACCENT,
    cornerStrokeColor: "#082f49",
    cornerStyle: "circle",
    transparentCorners: false,
    borderDashArray: [4, 4],
    padding: 6,
    centeredScaling: false,
  });
}

function applyObjectLockState(object: EditorObject, locked: boolean) {
  const data = {
    ...(object.data ?? getLayerData(object, 0)),
    locked,
  };

  object.set({
    data,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    hasControls: !locked,
    selectable: true,
    evented: true,
    hoverCursor: locked ? "default" : "move",
    moveCursor: locked ? "default" : "move",
  });
}

function ensureObjectRuntimeState(object: EditorObject, index: number) {
  const data = getLayerData(object, index);
  object.set({
    data,
    originX: "center",
    originY: "center",
  });
  applyObjectVisualState(object);
  applyObjectLockState(object, !!data.locked);
  object.setCoords();
}

function getObjectScaledWidth(object: EditorObject) {
  if (typeof object.getScaledWidth === "function") {
    return object.getScaledWidth();
  }
  return (object.width ?? 0) * (object.scaleX ?? 1);
}

function getObjectScaledHeight(object: EditorObject) {
  if (typeof object.getScaledHeight === "function") {
    return object.getScaledHeight();
  }
  return (object.height ?? 0) * (object.scaleY ?? 1);
}

function buildSelectedDraft(object: EditorObject): SelectedObjectDraft {
  const data = getLayerData(object, 0);
  return {
    layerId: data.layerId,
    label: data.label,
    locked: !!data.locked,
    x: toMetricString(object.left ?? 0),
    y: toMetricString(object.top ?? 0),
    width: toMetricString(getObjectScaledWidth(object)),
    height: toMetricString(getObjectScaledHeight(object)),
    angle: toMetricString(object.angle ?? 0),
  };
}

function getSingleActiveObject(canvas: Canvas | null) {
  if (!canvas) return null;
  const activeObject = canvas.getActiveObject() as EditorObject | null;
  if (!activeObject || activeObject.type === "activeSelection") {
    return null;
  }
  return activeObject;
}

function getImageElementMetrics(object: EditorObject | null) {
  const element =
    object && typeof (object as { getElement?: () => HTMLImageElement | null }).getElement === "function"
      ? (object as { getElement?: () => HTMLImageElement | null }).getElement?.()
      : null;

  return {
    elementWidth: Math.max(element?.naturalWidth || element?.width || 0, 0),
    elementHeight: Math.max(element?.naturalHeight || element?.height || 0, 0),
  };
}

function publishCanvasDebug(canvas: Canvas | null, template: SIPPrintTemplate, reason: string) {
  if (!canvas || typeof window === "undefined") return;

  const objects = canvas.getObjects() as EditorObject[];
  const firstObject = objects[0] ?? null;
  const lowerCanvas = canvas.lowerCanvasEl;
  const upperCanvas = canvas.upperCanvasEl;
  const firstObjectMetrics = firstObject ? getImageElementMetrics(firstObject) : null;

  (window as typeof window & { __sipCanvasDebug?: Record<string, unknown> }).__sipCanvasDebug = {
    ...((window as typeof window & { __sipCanvasDebug?: Record<string, unknown> }).__sipCanvasDebug ?? {}),
    [template]: {
      reason,
      objectCount: objects.length,
      sceneWidth: SIP_ILLUSTRATION_SCENE_CONFIG[template].width,
      sceneHeight: SIP_ILLUSTRATION_SCENE_CONFIG[template].height,
      canvasWidth: canvas.getWidth(),
      canvasHeight: canvas.getHeight(),
      lowerCanvasWidth: lowerCanvas?.width ?? 0,
      lowerCanvasHeight: lowerCanvas?.height ?? 0,
      lowerCanvasClientWidth: lowerCanvas?.clientWidth ?? 0,
      lowerCanvasClientHeight: lowerCanvas?.clientHeight ?? 0,
      upperCanvasWidth: upperCanvas?.width ?? 0,
      upperCanvasHeight: upperCanvas?.height ?? 0,
      upperCanvasClientWidth: upperCanvas?.clientWidth ?? 0,
      upperCanvasClientHeight: upperCanvas?.clientHeight ?? 0,
      firstObject: firstObject
        ? {
            type: firstObject.type,
            left: firstObject.left ?? 0,
            top: firstObject.top ?? 0,
            width: firstObject.width ?? 0,
            height: firstObject.height ?? 0,
            scaleX: firstObject.scaleX ?? 0,
            scaleY: firstObject.scaleY ?? 0,
            angle: firstObject.angle ?? 0,
            opacity: (firstObject as FabricObject & { opacity?: number }).opacity ?? 1,
            visible: (firstObject as FabricObject & { visible?: boolean }).visible ?? true,
            ...firstObjectMetrics,
          }
        : null,
    },
  };
}

function getCanvasFitInset(width: number, height: number) {
  return Math.max(36, Math.round(Math.min(width, height) * 0.05));
}

function buildCanvasPreviewDataUrl(sourceCanvas: HTMLCanvasElement) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = sourceCanvas.width * 2;
  exportCanvas.height = sourceCanvas.height * 2;
  const context = exportCanvas.getContext("2d");
  if (!context) {
    return sourceCanvas.toDataURL("image/png");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
  return exportCanvas.toDataURL("image/png");
}

function rescaleSceneObjects(
  canvas: Canvas,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    return;
  }

  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return;
  }

  const ratioX = targetWidth / sourceWidth;
  const ratioY = targetHeight / sourceHeight;

  canvas.getObjects().forEach((item) => {
    const object = item as EditorObject;
    object.set({
      left: (object.left ?? 0) * ratioX,
      top: (object.top ?? 0) * ratioY,
      scaleX: (object.scaleX ?? 1) * ratioX,
      scaleY: (object.scaleY ?? 1) * ratioY,
      originX: "center",
      originY: "center",
    });
    object.setCoords();
  });
}

async function loadFabricImage(sourceUrl: string) {
  return await new Promise<EditorObject>((resolve, reject) => {
    const element = new Image();
    element.decoding = "async";
    element.onload = () => {
      const naturalWidth = Math.max(element.naturalWidth || element.width || 0, 1);
      const naturalHeight = Math.max(element.naturalHeight || element.height || 0, 1);
      const fabricImage = new FabricImage(element, {
        width: naturalWidth,
        height: naturalHeight,
      }) as unknown as EditorObject;
      fabricImage.set({
        width: naturalWidth,
        height: naturalHeight,
      });
      resolve(fabricImage);
    };
    element.onerror = () => reject(new Error("\u56fe\u7247\u52a0\u8f7d\u5931\u8d25"));
    element.src = sourceUrl;
  });
}

async function loadFabricImageFromFile(file: File) {
  return await new Promise<EditorObject>((resolve, reject) => {
    const element = new Image();
    const objectUrl = URL.createObjectURL(file);
    element.decoding = "async";
    element.onload = () => {
      const naturalWidth = Math.max(element.naturalWidth || element.width || 0, 1);
      const naturalHeight = Math.max(element.naturalHeight || element.height || 0, 1);
      const fabricImage = new FabricImage(element, {
        width: naturalWidth,
        height: naturalHeight,
      }) as unknown as EditorObject;
      fabricImage.set({
        width: naturalWidth,
        height: naturalHeight,
      });
      resolve(fabricImage);
    };
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("\u56fe\u7247\u52a0\u8f7d\u5931\u8d25"));
    };
    element.src = objectUrl;
  });
}

export const SIPIllustrationWorkspace = forwardRef<
  SIPIllustrationWorkspaceHandle,
  SIPIllustrationWorkspaceProps
>(function SIPIllustrationWorkspace({ data, template, onSceneUpdate, onActivate }, ref) {
  const sceneConfig = SIP_ILLUSTRATION_SCENE_CONFIG[template];
  const templateLayout = SIP_PRINT_TEMPLATE_LAYOUT[template];
  const currentScene = getScene(data, template);
  const printableSceneWidth = Math.round(sceneConfig.slotWidthMm * sceneConfig.pixelsPerMm);
  const printableSceneHeight = Math.round(sceneConfig.slotHeightMm * sceneConfig.pixelsPerMm);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const isHydratingRef = useRef(false);
  const latestTemplateRef = useRef(template);

  const [layers, setLayers] = useState<LayerSummary[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<SelectedObjectDraft | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    latestTemplateRef.current = template;
  }, [template]);

  const refreshSidebarState = (canvas: Canvas | null) => {
    if (!canvas) {
      setLayers([]);
      setSelectedDraft(null);
      return;
    }

    const activeObject = getSingleActiveObject(canvas);
    const activeLayerId = activeObject?.data?.layerId ?? "";

    const nextLayers = canvas
      .getObjects()
      .map((item, index) => {
        const object = item as EditorObject;
        const layerData = getLayerData(object, index);
        return {
          id: layerData.layerId,
          label: layerData.label,
          locked: !!layerData.locked,
          isActive: layerData.layerId === activeLayerId,
        };
      })
      .reverse();

    setLayers(nextLayers);
    setSelectedDraft(activeObject ? buildSelectedDraft(activeObject) : null);
    publishCanvasDebug(canvas, latestTemplateRef.current, "refreshSidebarState");
  };

  const clearPendingSync = () => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  const syncCanvasToState = (
    canvas: Canvas | null,
    targetTemplate = latestTemplateRef.current,
  ): SIPIllustrationScene | null => {
    if (!canvas || isHydratingRef.current) return null;

    const objectCount = canvas.getObjects().length;
    const nextScene =
      objectCount === 0
        ? createEmptyScene(targetTemplate)
        : (() => {
            const activeObject = canvas.getActiveObject();
            const previousBackground = canvas.backgroundColor;
            if (activeObject) {
              canvas.discardActiveObject();
            }
            canvas.backgroundColor = CANVAS_EXPORT_BACKGROUND;
            canvas.renderAll();

            const sceneJson = JSON.stringify(canvas.toObject(["data"]));
            const previewImageUrl = buildCanvasPreviewDataUrl(canvas.lowerCanvasEl);

            canvas.backgroundColor = previousBackground;

            if (activeObject) {
              canvas.setActiveObject(activeObject);
              canvas.renderAll();
            } else {
              canvas.renderAll();
            }

            return {
              sceneJson,
              previewImageUrl,
              width: SIP_ILLUSTRATION_SCENE_CONFIG[targetTemplate].width,
              height: SIP_ILLUSTRATION_SCENE_CONFIG[targetTemplate].height,
            };
          })();

    onSceneUpdate(nextScene);
    refreshSidebarState(canvas);
    return nextScene;
  };

  const scheduleSync = (canvas: Canvas | null) => {
    if (!canvas || isHydratingRef.current) return;
    clearPendingSync();
    syncTimerRef.current = window.setTimeout(() => {
      syncCanvasToState(canvas);
    }, 160);
  };

  const flushSceneSnapshot = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || isHydratingRef.current) return null;
    clearPendingSync();
    return syncCanvasToState(canvas, latestTemplateRef.current);
  };

  useImperativeHandle(
    ref,
    () => ({
      flushSceneSnapshot,
    }),
    [ref],
  );

  const focusShell = () => {
    onActivate?.();
    shellRef.current?.focus();
  };

  const loadLegacyPreviewIntoCanvas = async (canvas: Canvas, previewImageUrl: string, targetTemplate: SIPPrintTemplate) => {
    const config = SIP_ILLUSTRATION_SCENE_CONFIG[targetTemplate];
    const printableWidth = Math.round(config.slotWidthMm * config.pixelsPerMm);
    const printableHeight = Math.round(config.slotHeightMm * config.pixelsPerMm);
    const image = await loadFabricImage(previewImageUrl);
    const fitInset = getCanvasFitInset(printableWidth, printableHeight);
    const maxWidth = printableWidth - fitInset * 2;
    const maxHeight = printableHeight - fitInset * 2;
    const baseWidth = Math.max(image.width ?? 0, 1);
    const baseHeight = Math.max(image.height ?? 0, 1);
    const scale = Math.min(maxWidth / baseWidth, maxHeight / baseHeight, 1);

    image.set({
      left: printableWidth / 2,
      top: printableHeight / 2,
      scaleX: scale,
      scaleY: scale,
      originX: "center",
      originY: "center",
      data: {
        layerId: nanoid(8),
        label: "\u65e7\u7248\u56fe\u793a",
        locked: false,
      },
    });

    ensureObjectRuntimeState(image, 0);
    canvas.add(image);
    canvas.setActiveObject(image);
    canvas.renderAll();
    publishCanvasDebug(canvas, targetTemplate, "loadLegacyPreviewIntoCanvas");
  };

  const hydrateScene = async (canvas: Canvas, scene: SIPIllustrationScene, targetTemplate: SIPPrintTemplate) => {
    const config = SIP_ILLUSTRATION_SCENE_CONFIG[targetTemplate];
    isHydratingRef.current = true;
    clearPendingSync();

    canvas.clear();
    canvas.backgroundColor = CANVAS_EDITOR_BACKGROUND;
    canvas.setDimensions({
      width: config.width,
      height: config.height,
    });

    let restoredFromPreviewFallback = false;

    try {
      if (scene.sceneJson) {
        try {
          await canvas.loadFromJSON(scene.sceneJson);
          const loadedObjectCount = canvas.getObjects().length;

          if (loadedObjectCount > 0) {
            rescaleSceneObjects(canvas, scene.width, scene.height, config.width, config.height);
          } else if (scene.previewImageUrl) {
            restoredFromPreviewFallback = true;
            await loadLegacyPreviewIntoCanvas(canvas, scene.previewImageUrl, targetTemplate);
          }
        } catch (error) {
          console.warn("SIP illustration JSON restore failed, falling back to preview image.", error);
          if (scene.previewImageUrl) {
            restoredFromPreviewFallback = true;
            await loadLegacyPreviewIntoCanvas(canvas, scene.previewImageUrl, targetTemplate);
          }
        }
      } else if (scene.previewImageUrl) {
        restoredFromPreviewFallback = true;
        await loadLegacyPreviewIntoCanvas(canvas, scene.previewImageUrl, targetTemplate);
      }

      canvas.getObjects().forEach((object, index) => {
        ensureObjectRuntimeState(object as EditorObject, index);
      });

      canvas.renderAll();
      refreshSidebarState(canvas);
      setIsCanvasReady(true);
      publishCanvasDebug(
        canvas,
        targetTemplate,
        restoredFromPreviewFallback ? "hydrateScene:fallback-preview" : "hydrateScene",
      );

      if (
        restoredFromPreviewFallback ||
        (scene.sceneJson &&
          (scene.width !== config.width ||
            scene.height !== config.height ||
            !scene.previewImageUrl))
      ) {
        syncCanvasToState(canvas, targetTemplate);
      }
    } finally {
      isHydratingRef.current = false;
    }
  };

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    setIsCanvasReady(false);
    canvasHost.replaceChildren();

    const canvasElement = document.createElement("canvas");
    canvasElement.className = "block h-full w-full bg-transparent";
    canvasHost.appendChild(canvasElement);

    const canvas = new Canvas(canvasElement, {
      width: sceneConfig.width,
      height: sceneConfig.height,
      backgroundColor: CANVAS_EDITOR_BACKGROUND,
      preserveObjectStacking: true,
      selection: true,
    });

    fabricCanvasRef.current = canvas;

    const wrapper = canvas.wrapperEl;
    if (wrapper) {
      wrapper.style.display = "block";
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.borderRadius = "14px";
      wrapper.style.overflow = "hidden";
      wrapper.style.touchAction = "none";
    }
    canvas.lowerCanvasEl.style.width = "100%";
    canvas.lowerCanvasEl.style.height = "100%";
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.width = "100%";
      canvas.upperCanvasEl.style.height = "100%";
    }
    canvas.calcOffset();

    const refreshFromCanvas = () => refreshSidebarState(canvas);
    const syncFromCanvas = () => scheduleSync(canvas);

    canvas.on("selection:created", refreshFromCanvas);
    canvas.on("selection:updated", refreshFromCanvas);
    canvas.on("selection:cleared", refreshFromCanvas);
    canvas.on("object:added", syncFromCanvas);
    canvas.on("object:removed", syncFromCanvas);
    canvas.on("object:modified", syncFromCanvas);
    canvas.on("mouse:down", focusShell);

    void hydrateScene(canvas, currentScene, template);

    return () => {
      canvas.off("selection:created", refreshFromCanvas);
      canvas.off("selection:updated", refreshFromCanvas);
      canvas.off("selection:cleared", refreshFromCanvas);
      canvas.off("object:added", syncFromCanvas);
      canvas.off("object:removed", syncFromCanvas);
      canvas.off("object:modified", syncFromCanvas);
      clearPendingSync();
      syncCanvasToState(canvas, template);
      fabricCanvasRef.current = null;
      void canvas.dispose();
    };
  }, [template]);

  const addImages = async (files: File[]) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || files.length === 0) return;

    try {
      onActivate?.();
      focusShell();
      let offset = 0;

      for (const file of files) {
        const image = await loadFabricImageFromFile(file);
        const maxWidth = printableSceneWidth * 0.72;
        const maxHeight = printableSceneHeight * 0.72;
        const baseWidth = Math.max(image.width ?? 0, 1);
        const baseHeight = Math.max(image.height ?? 0, 1);
        const scale = Math.min(maxWidth / baseWidth, maxHeight / baseHeight, 1);

        image.set({
          left: printableSceneWidth / 2 + offset,
          top: printableSceneHeight / 2 + offset,
          scaleX: scale,
          scaleY: scale,
          originX: "center",
          originY: "center",
          data: {
            layerId: nanoid(8),
            label: file.name.replace(/\.[^.]+$/, "") || `\u56fe\u5c42 ${canvas.getObjects().length + 1}`,
            locked: false,
          },
        });

        ensureObjectRuntimeState(image, canvas.getObjects().length);
        canvas.add(image);
        canvas.setActiveObject(image);
        offset += 28;
      }

      canvas.renderAll();
      refreshSidebarState(canvas);
      scheduleSync(canvas);
      publishCanvasDebug(canvas, latestTemplateRef.current, "addImages");
      toast.success(`\u5df2\u6dfb\u52a0 ${files.length} \u5f20\u56fe\u7247`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "\u56fe\u7247\u6dfb\u52a0\u5931\u8d25");
    }
  };

  const triggerFileSelect = () => {
    onActivate?.();
    fileInputRef.current?.click();
  };

  const clearCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.discardActiveObject();
    canvas.clear();
    canvas.backgroundColor = CANVAS_EDITOR_BACKGROUND;
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const selectLayer = (layerId: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const target = canvas.getObjects().find((item) => {
      const object = item as EditorObject;
      return object.data?.layerId === layerId;
    }) as EditorObject | undefined;

    if (!target) return;

    canvas.setActiveObject(target);
    target.setCoords();
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    focusShell();
  };

  const duplicateSelectedObject = async () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    const clone = await activeObject.clone(["data"]);
    const currentData = getLayerData(activeObject, 0);
    clone.set({
      left: (activeObject.left ?? 0) + 24,
      top: (activeObject.top ?? 0) + 24,
      originX: "center",
      originY: "center",
      data: {
        layerId: nanoid(8),
        label: `${currentData.label}\u526f\u672c`,
        locked: false,
      },
    });

    ensureObjectRuntimeState(clone, canvas.getObjects().length);
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const removeSelectedObjects = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects() as EditorObject[];
    if (!activeObjects.length) return;

    activeObjects.forEach((object) => canvas.remove(object));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const toggleLockSelectedObject = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    const nextLocked = !(activeObject.data?.locked ?? false);
    applyObjectLockState(activeObject, nextLocked);
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const moveSelectedObjectToFront = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    canvas.bringObjectToFront(activeObject);
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const moveSelectedObjectToBack = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    canvas.sendObjectToBack(activeObject);
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const centerSelectedObject = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    activeObject.set({
      left: printableSceneWidth / 2,
      top: printableSceneHeight / 2,
      originX: "center",
      originY: "center",
    });
    activeObject.setCoords();
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const fitSelectedObjectToCanvas = () => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    const baseWidth = activeObject.width ?? getObjectScaledWidth(activeObject);
    const baseHeight = activeObject.height ?? getObjectScaledHeight(activeObject);
    const fitInset = getCanvasFitInset(printableSceneWidth, printableSceneHeight);
    const maxWidth = printableSceneWidth - fitInset * 2;
    const maxHeight = printableSceneHeight - fitInset * 2;
    const scale = Math.min(maxWidth / Math.max(baseWidth, 1), maxHeight / Math.max(baseHeight, 1));

    activeObject.set({
      left: printableSceneWidth / 2,
      top: printableSceneHeight / 2,
      scaleX: scale,
      scaleY: scale,
      originX: "center",
      originY: "center",
    });
    activeObject.setCoords();
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const applySelectedDraft = (field?: keyof SelectedObjectDraft, rawValue?: string) => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject || !selectedDraft) return;

    const nextDraft = field && typeof rawValue === "string" ? { ...selectedDraft, [field]: rawValue } : selectedDraft;
    const nextX = Number.parseFloat(nextDraft.x);
    const nextY = Number.parseFloat(nextDraft.y);
    const nextWidth = Number.parseFloat(nextDraft.width);
    const nextHeight = Number.parseFloat(nextDraft.height);
    const nextAngle = Number.parseFloat(nextDraft.angle);

    if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
      activeObject.set({
        left: nextX,
        top: nextY,
        originX: "center",
        originY: "center",
      });
    }

    const baseWidth = Math.max(activeObject.width ?? 1, 1);
    const baseHeight = Math.max(activeObject.height ?? 1, 1);
    if (Number.isFinite(nextWidth) && nextWidth > 0) {
      activeObject.set({
        scaleX: nextWidth / baseWidth,
      });
    }
    if (Number.isFinite(nextHeight) && nextHeight > 0) {
      activeObject.set({
        scaleY: nextHeight / baseHeight,
      });
    }
    if (Number.isFinite(nextAngle)) {
      activeObject.set({
        angle: nextAngle,
      });
    }

    activeObject.setCoords();
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const nudgeSelectedObject = (deltaX: number, deltaY: number) => {
    const canvas = fabricCanvasRef.current;
    const activeObject = getSingleActiveObject(canvas);
    if (!canvas || !activeObject) return;

    activeObject.set({
      left: (activeObject.left ?? 0) + deltaX,
      top: (activeObject.top ?? 0) + deltaY,
    });
    activeObject.setCoords();
    canvas.requestRenderAll();
    refreshSidebarState(canvas);
    scheduleSync(canvas);
  };

  const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const canvas = fabricCanvasRef.current;
    const hasSelection = !!canvas?.getActiveObject();
    if (!hasSelection) return;

    const step = event.shiftKey ? 10 : 1;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelectedObjects();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      void duplicateSelectedObject();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudgeSelectedObject(-step, 0);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nudgeSelectedObject(step, 0);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudgeSelectedObject(0, -step);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nudgeSelectedObject(0, step);
    }
  };

  const hasSelection = !!selectedDraft;
  const layerCount = layers.length;
  const illustrationShellWidthMm = sceneConfig.slotWidthMm + templateLayout.illustrationPaddingMm * 2;
  const illustrationShellHeightMm = sceneConfig.slotHeightMm + templateLayout.illustrationPaddingMm * 2;
  const canvasShellInsetX = (templateLayout.illustrationPaddingMm / illustrationShellWidthMm) * 100;
  const canvasShellInsetY = (templateLayout.illustrationPaddingMm / illustrationShellHeightMm) * 100;

  return (
    <section className="sip-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (event) => {
            const input = event.currentTarget;
            const files = Array.from(input.files ?? []);
            input.value = "";
            if (files.length > 0) {
              await addImages(files);
            }
          }}
        />

        <Button
          type="button"
          onClick={triggerFileSelect}
          className="sip-toolbar-btn bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {"\u6dfb\u52a0\u56fe\u7247"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!hasSelection}
          onClick={removeSelectedObjects}
          className="sip-toolbar-btn border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {"\u5220\u9664\u56fe\u7247"}
        </Button>
      </div>

      <div className="p-4">
        <div
          ref={shellRef}
          tabIndex={0}
          onFocus={onActivate}
          onMouseDown={onActivate}
          onKeyDown={handleCanvasKeyDown}
          onDragOver={(event) => {
            event.preventDefault();
            onActivate?.();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={async (event) => {
            event.preventDefault();
            onActivate?.();
            setIsDragActive(false);
            const files = Array.from(event.dataTransfer.files ?? []).filter((file) =>
              file.type.startsWith("image/"),
            );
            if (files.length > 0) {
              await addImages(files);
            }
          }}
          className={cn(
            "relative overflow-hidden rounded-[18px] border border-white/10 bg-[#0b0f14] p-3 outline-none transition-colors",
            isDragActive ? "border-primary shadow-[0_0_0_1px_rgba(34,211,238,0.5)]" : "border-dashed border-white/10",
          )}
          style={{ aspectRatio: `${illustrationShellWidthMm} / ${illustrationShellHeightMm}` }}
        >
          <div className="relative h-full overflow-hidden rounded-[12px] border border-black/15 bg-[#f3f4f6]">
            <div
              className="absolute"
              style={{
                left: `${canvasShellInsetX}%`,
                right: `${canvasShellInsetX}%`,
                top: `${canvasShellInsetY}%`,
                bottom: `${canvasShellInsetY}%`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, rgba(226,232,240,0.22) 25%, transparent 25%), linear-gradient(-45deg, rgba(226,232,240,0.22) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(226,232,240,0.22) 75%), linear-gradient(-45deg, transparent 75%, rgba(226,232,240,0.22) 75%)",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                  backgroundSize: "16px 16px",
                }}
              />

              {!isCanvasReady ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-slate-500">
                  {"\u6b63\u5728\u52a0\u8f7d\u56fe\u793a\u753b\u5e03..."}
                </div>
              ) : null}

              {layerCount === 0 ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/10 text-primary">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {"\u70b9\u51fb\u4e0a\u65b9\u201c\u6dfb\u52a0\u56fe\u7247\u201d\u5f00\u59cb"}
                  </p>
                </div>
              ) : null}

              <div ref={canvasHostRef} className="h-full w-full" />
              <SIPIllustrationCalibrationOverlay
                widthMm={sceneConfig.slotWidthMm}
                heightMm={sceneConfig.slotHeightMm}
                mode="editor"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
