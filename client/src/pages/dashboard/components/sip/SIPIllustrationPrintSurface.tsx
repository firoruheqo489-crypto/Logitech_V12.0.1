"use client";

import { useEffect, useRef } from "react";

import {
  SIP_ILLUSTRATION_PRINT_CALIBRATION,
  SIP_ILLUSTRATION_SCENE_CONFIG,
  type SIPPrintTemplate,
} from "./types";

interface SIPIllustrationPrintSurfaceProps {
  imageUrl: string;
  template: SIPPrintTemplate;
}

export function SIPIllustrationPrintSurface({
  imageUrl,
  template,
}: SIPIllustrationPrintSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneConfig = SIP_ILLUSTRATION_SCENE_CONFIG[template];
  const calibration = SIP_ILLUSTRATION_PRINT_CALIBRATION[template];
  const renderWidth = sceneConfig.width;
  const renderHeight = sceneConfig.height;

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const context = canvasElement.getContext("2d");
    if (!context) return;

    let cancelled = false;
    context.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (!imageUrl) {
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;

      const translateX = calibration.offsetXmm * sceneConfig.pixelsPerMm;
      const translateY = calibration.offsetYmm * sceneConfig.pixelsPerMm;
      const drawWidth = canvasElement.width * calibration.scaleX;
      const drawHeight = canvasElement.height * calibration.scaleY;

      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
      context.drawImage(image, translateX, translateY, drawWidth, drawHeight);
    };
    image.onerror = () => {
      if (cancelled) return;
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [
    calibration.offsetXmm,
    calibration.offsetYmm,
    calibration.scaleX,
    calibration.scaleY,
    imageUrl,
    renderHeight,
    renderWidth,
    sceneConfig.pixelsPerMm,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={renderWidth}
      height={renderHeight}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
