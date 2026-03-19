"use client";

import { useCallback, useId, useMemo, useState, type ChangeEvent } from "react";
import type {
  MaintenanceEvent,
  MaintenanceEventLabelKey,
} from "./toolingLifecycleModel";
import {
  SVG_HEIGHT,
  SVG_WIDTH,
  generateCurvePath,
  generateFillPath,
  getMaxHazard,
  getXAxisLabels,
  getZoneMeta,
  hazardRate,
  type ToolingLifecycleZoneId,
} from "./toolingLifecycleMath";

interface ToolingLifecycleBathtubChartProps {
  currentShots: number;
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

export function ToolingLifecycleBathtubChart({
  currentShots,
  onShotsChange,
  maxLifespan,
  isCalibrated,
  events,
}: ToolingLifecycleBathtubChartProps) {
  const curvePath = useMemo(
    () => generateCurvePath(maxLifespan),
    [maxLifespan]
  );
  const fillPath = useMemo(() => generateFillPath(maxLifespan), [maxLifespan]);
  const maxHazard = useMemo(() => getMaxHazard(maxLifespan), [maxLifespan]);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const defsId = useId().replace(/:/g, "");

  const scrubberX = (currentShots / maxLifespan) * 100;
  const currentHazard = hazardRate(currentShots, maxLifespan);
  const scrubberSvgX = (currentShots / maxLifespan) * SVG_WIDTH;
  const scrubberSvgY =
    SVG_HEIGHT -
    (currentHazard / maxHazard) * (SVG_HEIGHT * 0.85) -
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
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold tabular-nums ${zoneInfo.color}`}
          >
            ZONE {zoneInfo.zone}
          </span>
          <span className="text-[10px] text-slate-600">|</span>
          <span className="text-[11px] text-slate-400">
            {ZONE_SUMMARY_LABELS[zoneInfo.zoneId]}
          </span>
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
            const eventHazard = hazardRate(eventItem.shots, maxLifespan);
            const eventY =
              SVG_HEIGHT -
              (eventHazard / maxHazard) * (SVG_HEIGHT * 0.85) -
              SVG_HEIGHT * 0.05;
            const size = 6;
            const isPmEvent = eventItem.type === "PM";

            return (
              <g key={eventItem.id}>
                <line
                  x1={eventX}
                  y1={eventY + size + 2}
                  x2={eventX}
                  y2={SVG_HEIGHT}
                  stroke={isPmEvent ? "#f59e0b" : "#f43f5e"}
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity="0.3"
                  vectorEffect="non-scaling-stroke"
                />
                <g
                  transform={`translate(${eventX}, ${eventY})`}
                  className={isPmEvent ? "" : "animate-pulse"}
                  onMouseEnter={() => setHoveredEvent(eventItem.id)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  style={{ cursor: "pointer" }}
                >
                  {!isPmEvent && (
                    <circle
                      cx={0}
                      cy={0}
                      r={12}
                      fill="rgba(244, 63, 94, 0.2)"
                      stroke="none"
                    />
                  )}
                  <polygon
                    points={`0,${-size} ${size},0 0,${size} ${-size},0`}
                    fill={
                      isPmEvent
                        ? "rgba(245, 158, 11, 0.5)"
                        : "rgba(244, 63, 94, 0.7)"
                    }
                    stroke={isPmEvent ? "#f59e0b" : "#fb7185"}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              </g>
            );
          })}

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
        </svg>

        {visibleEvents.map(eventItem => {
          const pctX = (eventItem.shots / maxLifespan) * 100;
          const isPmEvent = eventItem.type === "PM";
          const isHovered = hoveredEvent === eventItem.id;

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
                className={`rounded border px-1.5 py-0.5 text-[8px] font-mono tabular-nums whitespace-nowrap ${
                  isPmEvent
                    ? "border-amber-700/50 bg-amber-950/80 text-amber-400"
                    : "border-rose-700/50 bg-rose-950/80 text-rose-400"
                }`}
              >
                {(eventItem.shots / 1000).toFixed(
                  eventItem.shots % 1000 === 0 ? 0 : 1
                )}
                K: {eventItem.type}
              </div>
              {isHovered && (
                <div
                  className={`mt-0.5 rounded border px-1.5 py-0.5 text-[8px] font-mono whitespace-nowrap ${
                    isPmEvent
                      ? "border-amber-700/40 bg-amber-950/90 text-amber-300"
                      : "border-rose-700/40 bg-rose-950/90 text-rose-300"
                  }`}
                >
                  {MAINTENANCE_EVENT_LABELS[eventItem.labelKey]}
                </div>
              )}
            </div>
          );
        })}

        <div
          className="pointer-events-none absolute top-2 z-30"
          style={{
            left: `${scrubberX}%`,
            transform: `translateX(${scrubberX > 80 ? "-100%" : scrubberX < 10 ? "0%" : "-50%"})`,
          }}
        >
          <div className="rounded border border-amber-500/30 bg-slate-900/95 px-2 py-1 backdrop-blur-sm">
            <p className="text-[10px] font-semibold tabular-nums text-amber-400">
              {currentShots.toLocaleString()} shots
            </p>
            <p className="text-[9px] tabular-nums text-slate-500">
              h(t) = {currentHazard.toFixed(4)}
            </p>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={maxLifespan}
          step={1000}
          value={currentShots}
          onChange={handleSliderChange}
          className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
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
