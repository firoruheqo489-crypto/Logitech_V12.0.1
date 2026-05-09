"use client";

import { useMemo, useState } from "react";

interface BoxplotData {
  label: string;
  labelEn: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  outliers: number[];
}

type LabelDisplayMode = "median" | "mean" | "none";

interface BoxplotChartProps {
  data: BoxplotData[];
  usl: number;
  lsl: number;
  showMeanLine: boolean;
  showConfidenceIntervals: boolean;
  highlightOutliers: boolean;
  labelDisplay?: LabelDisplayMode;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: BoxplotData | null;
}

export function BoxplotChart({
  data,
  usl,
  lsl,
  showMeanLine,
  showConfidenceIntervals,
  highlightOutliers,
  labelDisplay = "mean",
}: BoxplotChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

  // Maximized dimensions - reduced bottom padding (labels now above diamond)
  const padding = { top: 28, right: 85, bottom: 70, left: 70 };

  const { yMin, yMax, yScale, yTicks } = useMemo(() => {
    const allValues = data.flatMap((d) => [
      d.min,
      d.max,
      ...d.outliers,
      usl,
      lsl,
    ]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal;
    const yMin = minVal - range * 0.08;
    const yMax = maxVal + range * 0.08;

    const tickCount = 10;
    const tickStep = (yMax - yMin) / tickCount;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
      Number((yMin + i * tickStep).toFixed(2))
    );

    return { yMin, yMax, yScale: (value: number, chartHeight: number) =>
      chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight, yTicks };
  }, [data, usl, lsl]);

  const handleBoxHover = (
    event: React.MouseEvent<SVGRectElement>,
    boxData: BoxplotData
  ) => {
    const svgRect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (svgRect) {
      setTooltip({
        visible: true,
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top,
        data: boxData,
      });
    }
  };

  const handleBoxLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null });
  };

  return (
    <div className="relative flex h-full w-full flex-1">
      <svg
        viewBox="0 0 1000 450"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full font-mono"
        style={{ background: "transparent", minHeight: "450px" }}
      >
        {(() => {
          const svgWidth = 1000;
          const svgHeight = 450;
          const chartWidth = svgWidth - padding.left - padding.right;
          const chartHeight = svgHeight - padding.top - padding.bottom;
          const boxWidth = Math.min(55, chartWidth / data.length - 25);
          const getXPosition = (index: number) =>
            (index + 0.5) * (chartWidth / data.length);
          const yScaleLocal = (value: number) => yScale(value, chartHeight);

          return (
            <>
              <defs>
                {/* VISUAL HIERARCHY: Solid industrial slate fill - PRIMARY ANCHOR */}
                <linearGradient id="slateBoxGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#334155" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.55" />
                </linearGradient>
                {/* Text background filter for legibility - NO glow filters */}
                <filter id="textBg" x="-0.15" y="-0.15" width="1.3" height="1.3">
                  <feFlood floodColor="#0f1115" floodOpacity="0.9" result="bg" />
                  <feMerge>
                    <feMergeNode in="bg" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* ClipPath to prevent elements from exceeding chart boundaries */}
                <clipPath id="chartClip">
                  <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} />
                </clipPath>
              </defs>

              {/* Y-axis grid lines - subtle but present */}
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    y1={padding.top + yScaleLocal(tick)}
                    x2={padding.left + chartWidth}
                    y2={padding.top + yScaleLocal(tick)}
                    stroke="#3f3f46"
                    strokeWidth="0.5"
                    strokeOpacity="0.4"
                    strokeDasharray="2 4"
                  />
                  {/* Y-axis tick mark */}
                  <line
                    x1={padding.left - 4}
                    y1={padding.top + yScaleLocal(tick)}
                    x2={padding.left}
                    y2={padding.top + yScaleLocal(tick)}
                    stroke="#71717a"
                    strokeWidth="1"
                  />
                  {/* Y-axis label - EMPHASIZED */}
                  <text
                    x={padding.left - 8}
                    y={padding.top + yScaleLocal(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-zinc-300 text-[10px] font-mono font-medium"
                  >
                    {tick.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* USL Line - ENTERPRISE: thin, dark red, subtle */}
              <line
                x1={padding.left}
                y1={padding.top + yScaleLocal(usl)}
                x2={padding.left + chartWidth}
                y2={padding.top + yScaleLocal(usl)}
                stroke="#991b1b"
                strokeWidth="1"
                strokeDasharray="8 4"
                strokeOpacity="0.6"
              />
              <text
                x={padding.left + chartWidth + 6}
                y={padding.top + yScaleLocal(usl)}
                dominantBaseline="middle"
                className="fill-red-700/80 text-[9px] font-mono"
              >
                USL: {usl.toFixed(2)}
              </text>

              {/* LSL Line - cyan color for lower limit */}
              <line
                x1={padding.left}
                y1={padding.top + yScaleLocal(lsl)}
                x2={padding.left + chartWidth}
                y2={padding.top + yScaleLocal(lsl)}
                stroke="#0891b2"
                strokeWidth="1"
                strokeDasharray="8 4"
                strokeOpacity="0.7"
              />
              <text
                x={padding.left + chartWidth + 6}
                y={padding.top + yScaleLocal(lsl)}
                dominantBaseline="middle"
                className="fill-cyan-600/90 text-[9px] font-mono"
              >
                LSL: {lsl.toFixed(2)}
              </text>

              {/* Confidence Interval bands - muted */}
              {showConfidenceIntervals &&
                data.map((d, i) => {
                  const x = padding.left + getXPosition(i);
                  const ci = (d.q3 - d.q1) * 0.5;
                  return (
                    <rect
                      key={`ci-${i}`}
                      x={x - boxWidth / 2 - 6}
                      y={padding.top + yScaleLocal(d.mean + ci)}
                      width={boxWidth + 12}
                      height={yScaleLocal(d.mean - ci) - yScaleLocal(d.mean + ci)}
                      fill="#64748b"
                      fillOpacity="0.06"
                      rx="2"
                    />
                  );
                })}

              {/* Mean connecting line - GREEN, EXACTLY aligned with whisker centerlines */}
              {showMeanLine && data.length > 1 && (
                <path
                  d={data
                    .map((d, i) => {
                      // CRITICAL: Use EXACT same X calculation as whiskers and diamonds
                      const cx = padding.left + getXPosition(i);
                      const cy = padding.top + yScaleLocal(d.mean);
                      return `${i === 0 ? "M" : "L"} ${cx} ${cy}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  strokeOpacity="0.7"
                />
              )}

              {/* Boxplots - ENTERPRISE PRECISION AESTHETIC */}
              {data.map((d, i) => {
                const x = padding.left + getXPosition(i);
                // NARROWER whisker caps (reduced by 40%)
                const whiskerCapWidth = boxWidth * 0.3;
                const medianY = padding.top + yScaleLocal(d.median);
                const meanY = padding.top + yScaleLocal(d.mean);
                const boxLeftEdge = x - boxWidth / 2;
                const boxRightEdge = x + boxWidth / 2;

                return (
                  <g key={i}>
                    {/* Upper Whisker - HAIRLINE 1px */}
                    <line
                      x1={x}
                      y1={padding.top + yScaleLocal(d.max)}
                      x2={x}
                      y2={padding.top + yScaleLocal(d.q3)}
                      stroke="#71717a"
                      strokeWidth="1"
                    />
                    {/* Upper Cap - NARROWER */}
                    <line
                      x1={x - whiskerCapWidth / 2}
                      y1={padding.top + yScaleLocal(d.max)}
                      x2={x + whiskerCapWidth / 2}
                      y2={padding.top + yScaleLocal(d.max)}
                      stroke="#71717a"
                      strokeWidth="1"
                    />

                    {/* Lower Whisker - HAIRLINE 1px */}
                    <line
                      x1={x}
                      y1={padding.top + yScaleLocal(d.q1)}
                      x2={x}
                      y2={padding.top + yScaleLocal(d.min)}
                      stroke="#71717a"
                      strokeWidth="1"
                    />
                    {/* Lower Cap - NARROWER */}
                    <line
                      x1={x - whiskerCapWidth / 2}
                      y1={padding.top + yScaleLocal(d.min)}
                      x2={x + whiskerCapWidth / 2}
                      y2={padding.top + yScaleLocal(d.min)}
                      stroke="#71717a"
                      strokeWidth="1"
                    />

                    {/* IQR Box - ENTERPRISE: slate/zinc, 1px stroke */}
                    <rect
                      x={boxLeftEdge}
                      y={padding.top + yScaleLocal(d.q3)}
                      width={boxWidth}
                      height={yScaleLocal(d.q1) - yScaleLocal(d.q3)}
                      fill="url(#slateBoxGradient)"
                      stroke="#64748b"
                      strokeWidth="1"
                      rx="1"
                      className="cursor-pointer transition-all hover:stroke-zinc-400"
                      onMouseEnter={(e) => handleBoxHover(e, d)}
                      onMouseMove={(e) => handleBoxHover(e, d)}
                      onMouseLeave={handleBoxLeave}
                    />

                    {/* Median Line - same color as box border for consistency */}
                    <line
                      x1={boxLeftEdge}
                      y1={medianY}
                      x2={boxRightEdge}
                      y2={medianY}
                      stroke="#71717a"
                      strokeWidth="1.5"
                    />

                    {/* Mean Diamond Marker - EXACTLY at center x (same as whiskers) */}
                    <polygon
                      points={`${x},${meanY - 2.5} ${x + 2.5},${meanY} ${x},${meanY + 2.5} ${x - 2.5},${meanY}`}
                      fill="rgba(255,255,255,0.85)"
                      stroke="none"
                    />
                    {/* Value label above diamond */}
                    {labelDisplay !== "none" && (
                      <text
                        x={x}
                        y={meanY - 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[9px] font-mono"
                        style={{ 
                          fill: '#10b981',
                          textShadow: '0 0 4px #050505, 0 0 4px #050505, 0 0 6px #050505'
                        }}
                      >
                        {labelDisplay === "median" ? "M:" : "μ:"} {(labelDisplay === "median" ? d.median : d.mean).toFixed(2)}
                      </text>
                    )}



                    {/* Outliers - red for above USL, cyan for below LSL, amber for normal */}
                    {highlightOutliers &&
                      d.outliers.map((outlier, oi) => {
                        const aboveUSL = outlier > usl;
                        const belowLSL = outlier < lsl;
                        const outlierY = padding.top + yScaleLocal(outlier);
                        // Clamp outlier Y position to chart boundaries
                        const clampedOutlierY = Math.max(
                          padding.top + 4,
                          Math.min(padding.top + chartHeight - 4, outlierY)
                        );
                        // Only render if within reasonable bounds
                        const isVisible = outlierY >= padding.top - 20 && outlierY <= padding.top + chartHeight + 20;
                        if (!isVisible) return null;
                        
                        // Color logic: red for above USL, cyan for below LSL, amber for in-spec outliers
                        const dotColor = aboveUSL ? "#dc2626" : belowLSL ? "#0891b2" : "#d97706";
                        const textColorClass = aboveUSL ? "fill-red-600/80" : belowLSL ? "fill-cyan-600/80" : "fill-amber-600/80";
                        
                        return (
                          <g key={`outlier-${i}-${oi}`}>
                            <circle
                              cx={x}
                              cy={clampedOutlierY}
                              r="2.5"
                              fill={dotColor}
                            />
                            {/* STANDARDIZED: uniform 8px offset right alignment */}
                            <text
                              x={x + 8}
                              y={clampedOutlierY}
                              dy="3"
                              textAnchor="start"
                              className={`text-[9px] font-mono ${textColorClass}`}
                            >
                              {outlier.toFixed(2)}
                            </text>
                          </g>
                        );
                      })}

                    {/* X-axis labels - same font as Y-axis */}
                    <text
                      x={x}
                      y={padding.top + chartHeight + 16}
                      textAnchor="middle"
                      className="fill-zinc-300 text-[10px] font-mono font-medium"
                    >
                      {d.label}
                    </text>
                    <text
                      x={x}
                      y={padding.top + chartHeight + 28}
                      textAnchor="middle"
                      className="fill-zinc-500 text-[8px] font-mono"
                    >
                      {d.labelEn}
                    </text>
                  </g>
                );
              })}



              {/* Y-axis label */}
              <text
                x={16}
                y={padding.top + chartHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90, 16, ${padding.top + chartHeight / 2})`}
                className="fill-zinc-500 text-[10px]"
              >
                测量值 / Value
              </text>

              {/* Chart border - subtle */}
              <rect
                x={padding.left}
                y={padding.top}
                width={chartWidth}
                height={chartHeight}
                fill="none"
                stroke="#3f3f46"
                strokeWidth="0.5"
              />

              {/* Compact Bottom Legend - ENTERPRISE STYLING */}
              <g transform={`translate(${padding.left + 10}, ${svgHeight - 18})`}>
                <rect x="0" y="-5" width="12" height="8" fill="url(#slateBoxGradient)" stroke="#64748b" strokeWidth="1" rx="1" />
                <text x="16" y="2" className="fill-zinc-500 text-[9px] font-mono">IQR</text>

                <line x1="50" y1="0" x2="62" y2="0" stroke="#71717a" strokeWidth="1.5" />
                <text x="66" y="2" className="fill-zinc-500 text-[9px] font-mono">Median</text>

                <line x1="120" y1="-4" x2="120" y2="4" stroke="#71717a" strokeWidth="1" />
                <line x1="116" y1="-4" x2="124" y2="-4" stroke="#71717a" strokeWidth="1" />
                <text x="128" y="2" className="fill-zinc-500 text-[9px] font-mono">Whisker</text>

                <polygon points="195,-4 199,0 195,4 191,0" fill="rgba(255,255,255,0.8)" />
                <text x="204" y="2" className="fill-zinc-500 text-[9px] font-mono">Mean</text>

                <circle cx="255" cy="0" r="2.5" fill="#d97706" />
                <text x="261" y="2" className="fill-zinc-500 text-[9px] font-mono">Outlier</text>

                <line x1="310" y1="0" x2="328" y2="0" stroke="#991b1b" strokeWidth="1" strokeDasharray="4,3" strokeOpacity="0.6" />
                <text x="332" y="2" className="fill-zinc-500 text-[9px] font-mono">Spec Limit</text>

                {showMeanLine && (
                  <>
                    <line x1="405" y1="0" x2="423" y2="0" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,4" strokeOpacity="0.7" />
                    <text x="427" y="2" className="fill-zinc-500 text-[9px] font-mono">Mean Line</text>
                  </>
                )}
              </g>
            </>
          );
        })()}
      </svg>

      {/* Brutalist Tooltip - ENTERPRISE: cleaner styling */}
      {tooltip.visible && tooltip.data && (
        <div
          className="pointer-events-none absolute z-50 min-w-[180px] border border-zinc-700/80 bg-zinc-900/98 p-2.5 font-mono text-[9px] shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, 780),
            top: Math.max(tooltip.y - 110, 10),
          }}
        >
          <div className="mb-1.5 border-b border-zinc-700/60 pb-1.5 text-[10px] font-medium text-zinc-200">
            {tooltip.data.label} / {tooltip.data.labelEn}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-zinc-500">Q1:</span>
            <span className="text-right text-zinc-300">{tooltip.data.q1.toFixed(4)}</span>
            
            <span className="text-zinc-500">Median:</span>
            <span className="text-right text-blue-400">{tooltip.data.median.toFixed(4)}</span>
            
            <span className="text-zinc-500">Q3:</span>
            <span className="text-right text-zinc-300">{tooltip.data.q3.toFixed(4)}</span>
            
            <span className="text-zinc-500">IQR:</span>
            <span className="text-right text-zinc-300">{(tooltip.data.q3 - tooltip.data.q1).toFixed(4)}</span>
            
            <span className="text-zinc-500">Mean:</span>
            <span className="text-right font-medium text-zinc-100">{tooltip.data.mean.toFixed(4)}</span>
            
            <span className="text-zinc-500">Max:</span>
            <span className="text-right text-zinc-300">{tooltip.data.max.toFixed(4)}</span>
            
            <span className="text-zinc-500">Min:</span>
            <span className="text-right text-zinc-300">{tooltip.data.min.toFixed(4)}</span>
            
            <span className="text-zinc-500">Outliers:</span>
            <span className="text-right font-medium text-amber-500">{tooltip.data.outliers.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
