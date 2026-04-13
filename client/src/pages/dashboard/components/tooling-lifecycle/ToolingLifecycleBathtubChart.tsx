"use client";

import { useCallback, useId, useMemo, useState, type ChangeEvent } from "react";
import { EVENT_TYPE_CONFIG, type EventType } from "@/lib/mold-health-types";
import type {
  MaintenanceEvent,
  MaintenanceEventLabelKey,
} from "./toolingLifecycleModel";
import {
  SVG_HEIGHT,
  SVG_WIDTH,
  formatHazardValue,
  generateCurvePath,
  generateFillPath,
  getMaxHazard,
  getRenderedBathtubHazard,
  getXAxisLabels,
  getZoneMeta,
  hazardRate,
  type ToolingLifecycleZoneId,
} from "./toolingLifecycleMath";

interface ToolingLifecycleBathtubChartProps {
  currentShots: number;
  realTimeShots: number;
  activeShotLine: "simulated" | "realtime";
  onActiveShotLineChange: (line: "simulated" | "realtime") => void;
  onShotsChange: (shots: number) => void;
  maxLifespan: number;
  isCalibrated: boolean;
  events: MaintenanceEvent[];
}

const ZONE_SUMMARY_LABELS: Record<ToolingLifecycleZoneId, string> = {
  early_failure: "早期失效期",
  useful_life: "偶然失效期",
  wear_out: "耗损失效期",
};

const MAINTENANCE_EVENT_LABELS: Record<MaintenanceEventLabelKey, string> = {
  routine_pm: "常规保养 (PM)",
  slider_jam: "滑块卡滞 (CM)",
  ejector_pin_break: "顶针断裂 (CM)",
};

const MAJOR_REPAIR_RADIUS = 6;
const CORRECTIVE_REPAIR_RADIUS = MAJOR_REPAIR_RADIUS * Math.SQRT1_2;

const EVENT_MARKER_STYLE: Record<
  EventType,
  {
    radius: number;
    lineStroke: string;
    markerFill: string;
    markerStroke: string;
    haloFill: string;
    badgeClassName: string;
    detailClassName: string;
  }
> = {
  SICKNESS: {
    radius: CORRECTIVE_REPAIR_RADIUS,
    lineStroke: "#eab308",
    markerFill: "rgba(250, 204, 21, 0.9)",
    markerStroke: "#fde047",
    haloFill: "rgba(250, 204, 21, 0.22)",
    badgeClassName: "border-amber-700/50 bg-amber-950/85 text-amber-300",
    detailClassName: "border-amber-700/40 bg-amber-950/90 text-amber-200",
  },
  SURGERY: {
    radius: MAJOR_REPAIR_RADIUS,
    lineStroke: "#dc2626",
    markerFill: "rgba(220, 38, 38, 0.72)",
    markerStroke: "#f87171",
    haloFill: "rgba(220, 38, 38, 0.18)",
    badgeClassName: "border-red-700/50 bg-red-950/85 text-red-300",
    detailClassName: "border-red-700/40 bg-red-950/90 text-red-200",
  },
  CHECKUP: {
    radius: 4.5,
    lineStroke: "#10b981",
    markerFill: "rgba(16, 185, 129, 0.68)",
    markerStroke: "#34d399",
    haloFill: "rgba(16, 185, 129, 0.14)",
    badgeClassName: "border-emerald-700/50 bg-emerald-950/85 text-emerald-300",
    detailClassName: "border-emerald-700/40 bg-emerald-950/90 text-emerald-200",
  },
};

export function ToolingLifecycleBathtubChart({
  currentShots,
  realTimeShots,
  activeShotLine,
  onActiveShotLineChange,
  onShotsChange,
  maxLifespan,
  isCalibrated,
  events,
}: ToolingLifecycleBathtubChartProps) {
  const curvePath = useMemo(
    () => generateCurvePath(maxLifespan, events),
    [events, maxLifespan]
  );
  const fillPath = useMemo(
    () => generateFillPath(maxLifespan, events),
    [events, maxLifespan]
  );
  const maxHazard = useMemo(
    () => getMaxHazard(maxLifespan, events),
    [events, maxLifespan]
  );
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const defsId = useId().replace(/:/g, "");

  const scrubberX = (currentShots / maxLifespan) * 100;
  const currentHazard = hazardRate(currentShots, maxLifespan, events);
  const currentRenderedHazard = getRenderedBathtubHazard(currentShots, maxLifespan);
  const scrubberSvgX = (currentShots / maxLifespan) * SVG_WIDTH;
  const scrubberSvgY =
    SVG_HEIGHT -
    (currentRenderedHazard / maxHazard) * (SVG_HEIGHT * 0.85) -
    SVG_HEIGHT * 0.05;
  const clampedRealTimeShots = Math.max(0, Math.min(realTimeShots, maxLifespan));
  const realTimeX = (clampedRealTimeShots / maxLifespan) * 100;
  const realTimeHazard = hazardRate(clampedRealTimeShots, maxLifespan, events);
  const realTimeRenderedHazard = getRenderedBathtubHazard(clampedRealTimeShots, maxLifespan);
  const realTimeSvgX = (clampedRealTimeShots / maxLifespan) * SVG_WIDTH;
  const realTimeSvgY =
    SVG_HEIGHT -
    (realTimeRenderedHazard / maxHazard) * (SVG_HEIGHT * 0.85) -
    SVG_HEIGHT * 0.05;
  const zoneInfo = getZoneMeta(currentShots, maxLifespan);

  const handleSliderChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onShotsChange(Number.parseInt(event.target.value, 10));
    },
    [onShotsChange]
  );

  const gridLines = useMemo(() => {
    const step = maxLifespan / 10;
    return Array.from({ length: 11 }, (_, index) => Math.round(index * step));
  }, [maxLifespan]);

  const visibleEvents = useMemo(
    () => events.filter(eventItem => eventItem.shots <= maxLifespan),
    [events, maxLifespan]
  );

  const xLabels = useMemo(() => getXAxisLabels(isCalibrated), [isCalibrated]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-2 w-2 rounded-full ${
              isCalibrated ? "bg-rose-500" : "bg-cyan-500"
            } animate-pulse`}
          />
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Hazard Rate h(t) / Lifecycle Phase Map
          </span>
          {isCalibrated && (
            <span className="text-[9px] font-bold tracking-wider text-rose-500">
              [DEGRADED X-AXIS]
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-[11px] font-semibold tabular-nums ${zoneInfo.color}`}
          >
            ZONE {zoneInfo.zone}
          </span>
          <span className="text-[10px] text-slate-600">|</span>
          <span className="text-[11px] text-slate-400">
            {ZONE_SUMMARY_LABELS[zoneInfo.zoneId]}
          </span>
          <div className="ml-2 flex items-center">
            <button
              type="button"
              onClick={() => onActiveShotLineChange("realtime")}
              className={`rounded-l border px-3 py-1 text-[11px] font-medium leading-tight transition-colors ${
                activeShotLine === "realtime"
                  ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 bg-slate-900/80 text-slate-500 hover:text-slate-300"
              }`}
            >
              实时模数
            </button>
            <button
              type="button"
              onClick={() => onActiveShotLineChange("simulated")}
              className={`-ml-px rounded-r border px-3 py-1 text-[11px] font-medium leading-tight transition-colors ${
                activeShotLine === "simulated"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-slate-700 bg-slate-900/80 text-slate-500 hover:text-slate-300"
              }`}
            >
              模拟模数
            </button>
          </div>
        </div>
      </div>

      <div
        className={`relative h-64 w-full select-none overflow-hidden rounded border transition-colors duration-700 ${
          isCalibrated ? "border-rose-900/60" : "border-slate-800/80"
        }`}
      >
        <div className="absolute inset-0 flex">
          <div
            className="relative border-r border-cyan-900/50"
            style={{ width: "15%", backgroundColor: "rgba(8, 51, 68, 0.2)" }}
          >
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
              <p className="text-center text-[9px] leading-tight text-cyan-600">
                早期失效期 (Infant)
              </p>
              <p className="text-center text-[8px] leading-tight text-cyan-800">
                模具厂责任
              </p>
            </div>
          </div>

          <div className="relative" style={{ width: "70%" }}>
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
              <p className="text-center text-[9px] leading-tight text-slate-600">
                偶然失效期 (Useful Life)
              </p>
              <p className="text-center text-[8px] leading-tight text-slate-700">
                稳定量产
              </p>
            </div>
          </div>

          <div
            className={`relative border-l transition-colors duration-700 ${
              isCalibrated ? "border-rose-700/70" : "border-rose-900/50"
            }`}
            style={{
              width: "15%",
              backgroundColor: isCalibrated
                ? "rgba(127, 29, 29, 0.35)"
                : "rgba(76, 5, 25, 0.2)",
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(127, 29, 29, 0.1) 4px, rgba(127, 29, 29, 0.1) 5px)",
            }}
          >
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
              <p className="text-center text-[9px] leading-tight text-rose-600">
                耗损失效期 (Wear-Out)
              </p>
              <p className="text-center text-[8px] leading-tight text-rose-800">
                {isCalibrated ? "降级极限" : "物理极限"}
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0">
          {gridLines.map(value => {
            const pct = (value / maxLifespan) * 100;
            return (
              <div
                key={value}
                className="absolute bottom-0 top-0 border-l border-slate-800/40"
                style={{ left: `${pct}%` }}
              >
                {value > 0 && value < maxLifespan && (
                  <span className="absolute top-1 -translate-x-1/2 text-[8px] tabular-nums text-slate-700">
                    {(value / 1000).toFixed(0)}K
                  </span>
                )}
              </div>
            );
          })}
          {[0.25, 0.5, 0.75].map(frac => (
            <div
              key={frac}
              className="absolute left-0 right-0 border-t border-slate-800/30"
              style={{ top: `${frac * 100}%` }}
            />
          ))}
        </div>

        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <filter
              id={`glow-${defsId}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient
              id={`curveFill-${defsId}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={isCalibrated ? "#f43f5e" : "#06b6d4"}
                stopOpacity="0.15"
              />
              <stop
                offset="100%"
                stopColor={isCalibrated ? "#f43f5e" : "#06b6d4"}
                stopOpacity="0.01"
              />
            </linearGradient>
            <linearGradient
              id={`curveStroke-${defsId}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor={isCalibrated ? "#fb7185" : "#22d3ee"}
              />
              <stop
                offset="15%"
                stopColor={isCalibrated ? "#f43f5e" : "#06b6d4"}
              />
              <stop
                offset="85%"
                stopColor={isCalibrated ? "#f43f5e" : "#06b6d4"}
              />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>

          <path d={fillPath} fill={`url(#curveFill-${defsId})`} />

          <path
            d={curvePath}
            fill="none"
            stroke={`url(#curveStroke-${defsId})`}
            strokeWidth="2.5"
            filter={`url(#glow-${defsId})`}
            vectorEffect="non-scaling-stroke"
          />

          {visibleEvents.map(eventItem => {
            const eventX = (eventItem.shots / maxLifespan) * SVG_WIDTH;
            const eventHazard = getRenderedBathtubHazard(eventItem.shots, maxLifespan);
            const eventY =
              SVG_HEIGHT -
              (eventHazard / maxHazard) * (SVG_HEIGHT * 0.85) -
              SVG_HEIGHT * 0.05;
            const markerStyle = EVENT_MARKER_STYLE[eventItem.sourceType];
            const haloRadius = markerStyle.radius * 1.8;

            return (
              <g key={eventItem.id}>
                <line
                  x1={eventX}
                  y1={eventY + markerStyle.radius + 2}
                  x2={eventX}
                  y2={SVG_HEIGHT}
                  stroke={markerStyle.lineStroke}
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity="0.3"
                  vectorEffect="non-scaling-stroke"
                />
                <g
                  transform={`translate(${eventX}, ${eventY})`}
                  onMouseEnter={() => setHoveredEvent(eventItem.id)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={haloRadius}
                    fill={markerStyle.haloFill}
                    stroke="none"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={markerStyle.radius}
                    fill={markerStyle.markerFill}
                    stroke={markerStyle.markerStroke}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              </g>
            );
          })}

          {activeShotLine === "realtime" ? (
            <>
              <line
                x1={realTimeSvgX}
                y1={0}
                x2={realTimeSvgX}
                y2={SVG_HEIGHT}
                stroke="#22d3ee"
                strokeWidth="1"
                strokeDasharray="5 4"
                opacity="0.75"
                vectorEffect="non-scaling-stroke"
              />

              <circle
                cx={realTimeSvgX}
                cy={realTimeSvgY}
                r="4.5"
                fill="#22d3ee"
                stroke="#082f49"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={realTimeSvgX}
                cy={realTimeSvgY}
                r="9"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="1"
                opacity="0.22"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <>
              <line
                x1={scrubberSvgX}
                y1={0}
                x2={scrubberSvgX}
                y2={SVG_HEIGHT}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
                vectorEffect="non-scaling-stroke"
              />

              <circle
                cx={scrubberSvgX}
                cy={scrubberSvgY}
                r="5"
                fill="#f59e0b"
                stroke="#030712"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={scrubberSvgX}
                cy={scrubberSvgY}
                r="10"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1"
                opacity="0.3"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {visibleEvents.map(eventItem => {
          const pctX = (eventItem.shots / maxLifespan) * 100;
          const isHovered = hoveredEvent === eventItem.id;
          const markerStyle = EVENT_MARKER_STYLE[eventItem.sourceType];
          const eventTypeLabel = EVENT_TYPE_CONFIG[eventItem.sourceType].labelZh;

          return (
            <div
              key={eventItem.id}
              className={`absolute z-20 pointer-events-none transition-opacity duration-200 ${
                isHovered ? "opacity-100" : "opacity-70"
              }`}
              style={{
                left: `${pctX}%`,
                bottom: "6px",
                transform: "translateX(-50%)",
              }}
            >
              <div
                className={`rounded border px-1.5 py-0.5 text-[8px] font-mono tabular-nums whitespace-nowrap ${markerStyle.badgeClassName}`}
              >
                {(eventItem.shots / 1000).toFixed(
                  eventItem.shots % 1000 === 0 ? 0 : 1
                )}
                K: {eventTypeLabel}
              </div>
              {isHovered && (
                <div
                  className={`mt-0.5 rounded border px-1.5 py-0.5 text-[8px] font-mono whitespace-nowrap ${markerStyle.detailClassName}`}
                >
                  {MAINTENANCE_EVENT_LABELS[eventItem.labelKey]}
                </div>
              )}
            </div>
          );
        })}

        {activeShotLine === "simulated" ? (
          <div
            className="pointer-events-none absolute top-2 z-30"
            style={{
              left: `${scrubberX}%`,
              transform: `translateX(${scrubberX > 80 ? "-100%" : scrubberX < 10 ? "0%" : "-50%"})`,
            }}
          >
            <div className="rounded border border-amber-500/30 bg-slate-900/95 px-2 py-1 backdrop-blur-sm">
              <p className="text-[10px] font-semibold tabular-nums text-amber-400">
                模拟模数 {currentShots.toLocaleString()}
              </p>
              <p className="text-[9px] tabular-nums text-slate-500">
                Simulated | h(t) = {formatHazardValue(currentHazard)}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="pointer-events-none absolute top-2 z-30"
            style={{
              left: `${realTimeX}%`,
              transform: `translateX(${realTimeX > 80 ? "-100%" : realTimeX < 10 ? "0%" : "-50%"})`,
            }}
          >
            <div className="rounded border border-cyan-500/30 bg-slate-900/95 px-2 py-1 backdrop-blur-sm">
              <p className="text-[10px] font-semibold tabular-nums text-cyan-300">
                实时模数 {clampedRealTimeShots.toLocaleString()}
              </p>
              <p className="text-[9px] tabular-nums text-slate-500">
                Real-Time | h(t) = {formatHazardValue(realTimeHazard)}
              </p>
            </div>
          </div>
        )}

        <input
          type="range"
          min={0}
          max={maxLifespan}
          step={1000}
          value={currentShots}
          onChange={handleSliderChange}
          disabled={activeShotLine === "realtime"}
          className={`absolute inset-0 z-20 h-full w-full opacity-0 ${
            activeShotLine === "realtime" ? "cursor-default" : "cursor-ew-resize"
          }`}
          aria-label="Mold shot count scrubber"
        />
      </div>

      <div className="flex justify-between px-1">
        {xLabels.map(label => (
          <span
            key={label}
            className={`text-[9px] tabular-nums ${isCalibrated ? "text-rose-700" : "text-slate-600"}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
