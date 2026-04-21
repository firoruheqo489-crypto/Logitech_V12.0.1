"use client"

import {
  ComposedChart,
  Bar,
  Cell,
  LabelList,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

// ── Normal PDF ────────────────────────────────────────────────────
function normalPDF(x: number, mean: number, stddev: number): number {
  const coefficient = 1 / (stddev * Math.sqrt(2 * Math.PI))
  const exponent = -0.5 * Math.pow((x - mean) / stddev, 2)
  return coefficient * Math.exp(exponent)
}

// ── Unified data point with bars + curves ─────────────────────────
export interface SPCDataPoint {
  x: number
  xLabel: string
  frequency: number       // histogram bar
  actualCurve: number     // actual distribution curve
  idealCurve: number      // ideal/standard distribution curve
}

export function generateSPCData(
  mean: number,
  stddev: number,
  usl: number,
  lsl: number,
  rawValues?: number[],
  sampleCount: number = 48
): { data: SPCDataPoint[]; nominal: number } {
  // IDEAL curve: centered exactly at nominal, stddev = tolerance/6 for 6-sigma coverage
  const nominal = (usl + lsl) / 2
  const idealStddev = Math.max((usl - lsl) / 6, 0.0001)
  const safeStddev = Math.max(stddev, 0.0001)
  const range = usl - lsl

  // Determine X-axis range to show both distributions well
  // Include enough margin to show both curves fully
  const xPadding = range * 0.6
  const xMin = Math.min(lsl - xPadding, mean - 4 * safeStddev)
  const xMax = Math.max(usl + xPadding, mean + 4 * safeStddev)
  
  // Generate unified data points (30 bins)
  const binCount = 30
  const binWidth = (xMax - xMin) / binCount

  const cleanValues = (rawValues ?? []).filter(
    (value): value is number => Number.isFinite(value)
  )
  const effectiveSampleCount = cleanValues.length > 0 ? cleanValues.length : Math.max(sampleCount, 1)
  const frequencies = Array.from({ length: binCount }, () => 0)

  if (cleanValues.length > 0) {
    cleanValues.forEach((value) => {
      const normalizedIndex = Math.floor((value - xMin) / binWidth)
      const index = Math.min(binCount - 1, Math.max(0, normalizedIndex))
      frequencies[index] += 1
    })
  }

  const data: SPCDataPoint[] = []
  for (let i = 0; i < binCount; i++) {
    const x = xMin + (i + 0.5) * binWidth
    const frequency =
      cleanValues.length > 0
        ? frequencies[i]
        : Math.max(
            0,
            Math.round(normalPDF(x, mean, safeStddev) * effectiveSampleCount * binWidth)
          )

    // Curve values are projected frequencies under the same sample size.
    const actualCurve =
      normalPDF(x, mean, safeStddev) * effectiveSampleCount * binWidth
    const idealCurve =
      normalPDF(x, nominal, idealStddev) * effectiveSampleCount * binWidth
    
    data.push({
      x: parseFloat(x.toFixed(4)),
      xLabel: x.toFixed(2),
      frequency,
      actualCurve,
      idealCurve,
    })
  }

  return { data, nominal }
}

// ── Chart component ───────────────────────────────────────────────
interface SPCDistributionChartProps {
  data: SPCDataPoint[]
  usl: number
  lsl: number
  mean: number
  nominal: number
  faiLabel?: string
}

interface TooltipPayloadItem {
  value: number
  dataKey: string
  color: string
  name?: string
}

interface FrequencyLabelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number | string
}

function FrequencyLabel({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  value,
}: FrequencyLabelProps) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  const centerX = x + width / 2
  const useInsideTop = height >= 18
  const labelY = useInsideTop ? y + 11 : y - 6

  return (
    <text
      x={centerX}
      y={labelY}
      textAnchor="middle"
      dominantBaseline={useInsideTop ? "middle" : "auto"}
      fill="#f8fafc"
      fontSize={12}
      fontWeight={800}
      fontFamily="monospace"
      stroke="#020617"
      strokeWidth={3}
      paintOrder="stroke fill"
      style={{ pointerEvents: "none" }}
    >
      {numericValue}
    </text>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
        <p className="mb-1 text-xs font-mono text-muted-foreground">
          X: {typeof label === "number" ? label.toFixed(3) : label}
        </p>
        {payload.map((entry, index) => {
          const labelMap: Record<string, string> = {
            frequency: "FREQ",
            actualCurve: "ACTUAL",
            idealCurve: "IDEAL",
          }
          return (
            <p key={index} className="text-xs font-mono" style={{ color: entry.color }}>
              {labelMap[entry.dataKey] || entry.dataKey}:{" "}
              {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
            </p>
          )
        })}
      </div>
    )
  }
  return null
}

export function SPCDistributionChart({
  data,
  usl,
  lsl,
  mean,
  nominal,
  faiLabel,
}: SPCDistributionChartProps) {
  // Guard against undefined / empty data
  if (!data?.length) return null

  // Compute Y-axis max
  const maxFreq = Math.max(...data.map((d) => d.frequency))
  const maxCurve = Math.max(
    ...data.map((d) => Math.max(d.actualCurve, d.idealCurve))
  )
  const yMax = Math.ceil(Math.max(maxFreq, maxCurve) * 1.15)

  // X domain from data
  const xMin = Math.min(...data.map((d) => d.x))
  const xMax = Math.max(...data.map((d) => d.x))
  
  // Generate exactly 10 tick values
  const xTicks: number[] = []
  const xStep = (xMax - xMin) / 9  // 10 ticks = 9 intervals
  for (let i = 0; i < 10; i++) {
    xTicks.push(parseFloat((xMin + i * xStep).toFixed(4)))
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase font-mono">
            SPC DISTRIBUTION ANALYSIS
          </h3>
          {faiLabel ? (
            <span className="inline-flex items-center rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider text-red-200">
              {faiLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Single unified chart */}
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 22, right: 20, bottom: 30, left: 50 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={[xMin, xMax]}
              ticks={xTicks}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "#334155" }}
              axisLine={{ stroke: "#334155" }}
              tickFormatter={(v: number) => v.toFixed(2)}
              label={{
                value: "DIMENSION (mm)",
                position: "bottom",
                offset: 10,
                style: { fill: "#64748b", fontSize: 10, fontFamily: "monospace" },
              }}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "#334155" }}
              axisLine={{ stroke: "#334155" }}
              label={{
                value: "FREQUENCY",
                angle: -90,
                position: "insideLeft",
                offset: 0,
                style: { fill: "#64748b", fontSize: 10, fontFamily: "monospace" },
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Reference Lines */}
            <ReferenceLine
              x={nominal}
              stroke="#22c55e"
              strokeDasharray="8 4"
              strokeWidth={1.5}
              label={{
                value: "NOM",
                position: "top",
                fill: "#22c55e",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
            <ReferenceLine
              x={usl}
              stroke="#ef4444"
              strokeDasharray="8 4"
              strokeWidth={1.5}
              label={{
                value: "USL",
                position: "top",
                fill: "#ef4444",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
            <ReferenceLine
              x={lsl}
              stroke="#3b82f6"
              strokeDasharray="8 4"
              strokeWidth={1.5}
              label={{
                value: "LSL",
                position: "top",
                fill: "#3b82f6",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
            {/* Mean reference line */}
            <ReferenceLine
              x={mean}
              stroke="#f97316"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{
                value: "X̄",
                position: "top",
                fill: "#f97316",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />

            {/* Histogram bars with dynamic coloring based on X position */}
            <Bar
              dataKey="frequency"
              radius={[2, 2, 0, 0]}
              barSize={16}
            >
              <LabelList dataKey="frequency" content={<FrequencyLabel />} />
              {data.map((entry, index) => {
                // Semantic coloring: red if > USL, blue if < LSL, green otherwise
                let fillColor = "#10b981"  // green (OK)
                let strokeColor = "#10b981"
                if (entry.x > usl) {
                  fillColor = "#f43f5e"    // rose/red (>USL)
                  strokeColor = "#f43f5e"
                } else if (entry.x < lsl) {
                  fillColor = "#3b82f6"    // blue (<LSL)
                  strokeColor = "#3b82f6"
                }
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={fillColor} 
                    fillOpacity={0.4}
                    stroke={strokeColor}
                    strokeWidth={1.5}
                  />
                )
              })}
            </Bar>

            {/* Ideal / Standard curve: GREEN solid */}
            <Line
              type="monotone"
              dataKey="idealCurve"
              stroke="#22c55e"
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />

            {/* Actual / Measured curve: ORANGE dashed */}
            <Line
              type="monotone"
              dataKey="actualCurve"
              stroke="#f97316"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-4 rounded-sm bg-[#10b981]/40 border border-[#10b981]" />
          <span className="text-xs text-muted-foreground font-mono">OK</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-4 rounded-sm bg-[#f43f5e]/40 border border-[#f43f5e]" />
          <span className="text-xs text-muted-foreground font-mono">{'>'}USL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-4 rounded-sm bg-[#3b82f6]/40 border border-[#3b82f6]" />
          <span className="text-xs text-muted-foreground font-mono">{'<'}LSL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 rounded bg-[#22c55e]" />
          <span className="text-xs text-muted-foreground font-mono">IDEAL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 rounded border-t-2 border-dashed border-[#f97316]" />
          <span className="text-xs text-muted-foreground font-mono">ACTUAL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-px border-l-2 border-dashed border-[#ef4444]" />
          <span className="text-xs text-muted-foreground font-mono">USL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-px border-l-2 border-dashed border-[#3b82f6]" />
          <span className="text-xs text-muted-foreground font-mono">LSL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-px border-l-2 border-dashed border-[#22c55e]" />
          <span className="text-xs text-muted-foreground font-mono">NOM</span>
        </div>
      </div>
    </div>
  )
}
