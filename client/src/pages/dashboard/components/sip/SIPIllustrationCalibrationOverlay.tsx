import type { CSSProperties } from "react";

interface SIPIllustrationCalibrationOverlayProps {
  widthMm: number;
  heightMm: number;
  mode?: "editor" | "print";
}

interface AxisTick {
  mm: number;
  label: string;
  isMajor: boolean;
  showLabel: boolean;
}

const MINOR_TICK_STEP_MM = 5;
const MAJOR_TICK_STEP_MM = 10;
const LABEL_STEP_MM = 20;

function formatTickLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildAxisTicks(lengthMm: number): AxisTick[] {
  const safeLength = Math.max(0, Number(lengthMm.toFixed(1)));
  const ticks: AxisTick[] = [];

  for (let mm = 0; mm <= safeLength; mm += MINOR_TICK_STEP_MM) {
    ticks.push({
      mm,
      label: formatTickLabel(mm),
      isMajor: mm % MAJOR_TICK_STEP_MM === 0,
      showLabel: mm % LABEL_STEP_MM === 0,
    });
  }

  const lastTick = ticks[ticks.length - 1];
  if (!lastTick || lastTick.mm !== safeLength) {
    ticks.push({
      mm: safeLength,
      label: formatTickLabel(safeLength),
      isMajor: true,
      showLabel: true,
    });
  }

  return ticks;
}

export function SIPIllustrationCalibrationOverlay({
  widthMm,
  heightMm,
  mode = "editor",
}: SIPIllustrationCalibrationOverlayProps) {
  const horizontalTicks = buildAxisTicks(widthMm);
  const verticalTicks = buildAxisTicks(heightMm);
  const rulerThickness = mode === "print" ? "5mm" : "24px";
  const fontSize = mode === "print" ? "2.2mm" : "10px";
  const topLabelOffset = mode === "print" ? "0.65mm" : "3px";
  const leftLabelOffset = mode === "print" ? "0.7mm" : "3px";
  const baseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    pointerEvents: "none",
    userSelect: "none",
  };

  const rulerSurfaceStyle: CSSProperties = {
    backgroundColor: mode === "print" ? "rgba(255,255,255,0.92)" : "rgba(248,250,252,0.92)",
    backdropFilter: mode === "print" ? undefined : "blur(2px)",
    color: "#0f172a",
    fontFamily: "Consolas, 'Microsoft YaHei', monospace",
    fontSize,
    lineHeight: 1,
  };

  const borderColor = mode === "print" ? "rgba(15,23,42,0.2)" : "rgba(100,116,139,0.35)";
  const minorColor = mode === "print" ? "rgba(15,23,42,0.32)" : "rgba(15,23,42,0.3)";
  const majorColor = mode === "print" ? "rgba(15,23,42,0.55)" : "rgba(8,145,178,0.85)";
  const labelColor = mode === "print" ? "rgba(15,23,42,0.78)" : "rgba(15,23,42,0.92)";

  return (
    <div style={baseStyle} aria-hidden="true">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: rulerThickness,
          height: rulerThickness,
          borderRight: `1px solid ${borderColor}`,
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          letterSpacing: "0.02em",
          ...rulerSurfaceStyle,
        }}
      >
        mm
      </div>

      <div
        style={{
          position: "absolute",
          top: 0,
          left: rulerThickness,
          right: 0,
          height: rulerThickness,
          borderBottom: `1px solid ${borderColor}`,
          overflow: "hidden",
          ...rulerSurfaceStyle,
        }}
      >
        {horizontalTicks.map((tick, index) => {
          const left = `${(tick.mm / widthMm) * 100}%`;
          const isStart = index === 0;
          const isEnd = index === horizontalTicks.length - 1;
          return (
            <div
              key={`x-${tick.mm}`}
              style={{
                position: "absolute",
                left,
                top: 0,
                bottom: 0,
                transform: "translateX(-0.5px)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: "1px",
                  height: tick.isMajor ? "70%" : "42%",
                  backgroundColor: tick.isMajor ? majorColor : minorColor,
                }}
              />
              {tick.showLabel ? (
                <span
                  style={{
                    position: "absolute",
                    top: isStart || isEnd ? `calc(${topLabelOffset} + 1px)` : topLabelOffset,
                    left: isStart ? "2px" : isEnd ? "-2px" : "50%",
                    transform: isStart ? "none" : isEnd ? "translateX(-100%)" : "translateX(-50%)",
                    color: labelColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tick.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: rulerThickness,
          left: 0,
          bottom: 0,
          width: rulerThickness,
          borderRight: `1px solid ${borderColor}`,
          overflow: "hidden",
          ...rulerSurfaceStyle,
        }}
      >
        {verticalTicks.map((tick, index) => {
          const top = `${(tick.mm / heightMm) * 100}%`;
          const isStart = index === 0;
          const isEnd = index === verticalTicks.length - 1;
          return (
            <div
              key={`y-${tick.mm}`}
              style={{
                position: "absolute",
                top,
                left: 0,
                right: 0,
                transform: "translateY(-0.5px)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  height: "1px",
                  width: tick.isMajor ? "70%" : "42%",
                  backgroundColor: tick.isMajor ? majorColor : minorColor,
                }}
              />
              {tick.showLabel ? (
                <span
                  style={{
                    position: "absolute",
                    top: isStart ? "2px" : isEnd ? "-2px" : "50%",
                    left: leftLabelOffset,
                    transform: isStart ? "none" : isEnd ? "translateY(-100%)" : "translateY(-50%)",
                    color: labelColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tick.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
