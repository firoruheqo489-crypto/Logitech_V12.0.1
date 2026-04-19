"use client"

import {
  ComposedChart,
  Bar,
  Cell,
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
  _sampleCount: number = 200
): { data: SPCDataPoint[]; nominal: number } {
  // IDEAL curve: centered exactly at nominal, stddev = tolerance/6 for 6-sigma coverage
  const nominal = (usl + lsl) / 2
  const idealStddev = (usl - lsl) / 6
  const range = usl - lsl

  // Determine X-axis range to show both distributions well
  // Include enough margin to show both curves fully
  const xPadding = range * 0.6
  const xMin = Math.min(lsl - xPadding, mean - 4 * stddev)
  const xMax = Math.max(usl + xPadding, mean + 4 * stddev)
  
  // Generate unified data points (30 bins)
  const binCount = 30
  const binWidth = (xMax - xMin) / binCount

  // Pure deterministic PRNG
  const baseSeed = Math.round((mean * 1000 + stddev * 10000) * 73856093) | 0
  function mulberry32(seed: number, n: number): number {
    let s = seed
    for (let j = 0; j <= n; j++) {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      s = (t ^ (t >>> 14)) >>> 0
    }
    return s / 4294967296
  }

  // Scale factor: normalize so histogram peak ~ 50
  const actualPeakPDF = normalPDF(mean, mean, stddev)
  const scaleFactor = 50 / actualPeakPDF

  const data: SPCDataPoint[] = []
  for (let i = 0; i < binCount; i++) {
    const x = xMin + (i + 0.5) * binWidth
    
    // Histogram frequency based on actual distribution
    const baseFreq = normalPDF(x, mean, stddev) * scaleFactor
    const jitter = Math.round((mulberry32(baseSeed, i) - 0.5) * 3)
    const frequency = Math.max(0, Math.round(baseFreq) + jitter)
    
    // Curve values - scaled to same units as frequency
    const actualCurve = normalPDF(x, mean, stddev) * scaleFactor
    const idealCurve = normalPDF(x, nominal, idealStddev) * scaleFactor
    
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
}

interface TooltipPayloadItem {
  value: number
  dataKey: string
  color: string
  name?: string
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
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase font-mono">
          SPC DISTRIBUTION ANALYSIS
        </h3>
      </div>

      {/* Single unified chart */}
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 20, bottom: 30, left: 50 }}
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
              label={{
                position: "top",
                fill: "#94a3b8",
                fontSize: 9,
                fontFamily: "monospace",
                formatter: (value: number) => (value > 0 ? value : ""),
              }}
            >
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
