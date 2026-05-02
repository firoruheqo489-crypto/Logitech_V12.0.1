"use client"

import { useRef, useEffect, useState } from "react"

// Total defects = 350, left axis max = 350, right axis max = 100%
const TOTAL_DEFECTS = 350

const data = [
  { defectName: "缺胶", count: 120, cumulative: 34.3 },
  { defectName: "披锋", count: 85, cumulative: 58.6 },
  { defectName: "刮花", count: 60, cumulative: 75.7 },
  { defectName: "变形", count: 40, cumulative: 87.1 },
  { defectName: "缩水", count: 25, cumulative: 94.3 },
  { defectName: "色差", count: 15, cumulative: 98.6 },
  { defectName: "其他", count: 5, cumulative: 100.0 },
]

export function ParetoChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const { width, height } = dimensions
  const margin = { top: 30, right: 70, bottom: 60, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  // Bar width calculation - bars fill the entire width with no gaps at edges
  const barCount = data.length
  const barWidth = chartWidth / barCount * 0.7
  const barGap = chartWidth / barCount * 0.3

  // Scale functions
  const xScale = (index: number) => margin.left + (index * chartWidth) / barCount
  const yScaleLeft = (value: number) => margin.top + chartHeight * (1 - value / TOTAL_DEFECTS)
  const yScaleRight = (value: number) => margin.top + chartHeight * (1 - value / 100)

  // Left Y-axis ticks
  const leftTicks = [0, 70, 140, 210, 280, 350]
  // Right Y-axis ticks
  const rightTicks = [0, 20, 40, 60, 80, 100]

  return (
    <div className="w-full rounded-sm border border-gray-800 bg-gray-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-100">
          注塑缺陷帕累托分析 Injection Molding Defect Pareto Analysis
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          缺陷数量分布与累计百分比 | Defect Count Distribution & Cumulative Percentage
        </p>
      </div>

      <div ref={containerRef} className="h-[400px] w-full">
        <svg width={width} height={height}>
          {/* Left Y-Axis */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + chartHeight}
            stroke="#374151"
            strokeWidth={1}
          />
          {leftTicks.map((tick) => (
            <g key={`left-${tick}`}>
              <line
                x1={margin.left - 5}
                y1={yScaleLeft(tick)}
                x2={margin.left}
                y2={yScaleLeft(tick)}
                stroke="#374151"
                strokeWidth={1}
              />
              <text
                x={margin.left - 10}
                y={yScaleLeft(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#9ca3af"
                fontSize={12}
              >
                {tick}
              </text>
            </g>
          ))}
          {/* Left Y-Axis Label */}
          <text
            x={15}
            y={margin.top + chartHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9ca3af"
            fontSize={12}
            transform={`rotate(-90, 15, ${margin.top + chartHeight / 2})`}
          >
            缺陷数量 Count
          </text>

          {/* Right Y-Axis */}
          <line
            x1={margin.left + chartWidth}
            y1={margin.top}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight}
            stroke="#374151"
            strokeWidth={1}
          />
          {rightTicks.map((tick) => (
            <g key={`right-${tick}`}>
              <line
                x1={margin.left + chartWidth}
                y1={yScaleRight(tick)}
                x2={margin.left + chartWidth + 5}
                y2={yScaleRight(tick)}
                stroke="#374151"
                strokeWidth={1}
              />
              <text
                x={margin.left + chartWidth + 10}
                y={yScaleRight(tick)}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#9ca3af"
                fontSize={12}
              >
                {tick}%
              </text>
            </g>
          ))}
          {/* Right Y-Axis Label */}
          <text
            x={width - 15}
            y={margin.top + chartHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9ca3af"
            fontSize={12}
            transform={`rotate(90, ${width - 15}, ${margin.top + chartHeight / 2})`}
          >
            累计百分比 Cumulative %
          </text>

          {/* X-Axis */}
          <line
            x1={margin.left}
            y1={margin.top + chartHeight}
            x2={margin.left + chartWidth}
            y2={margin.top + chartHeight}
            stroke="#374151"
            strokeWidth={1}
          />

          {/* Bars with vertical dashed lines */}
          {data.map((item, index) => {
            const barX = xScale(index)
            const barHeight = (item.count / TOTAL_DEFECTS) * chartHeight
            const barY = margin.top + chartHeight - barHeight
            const barRightX = barX + barWidth
            const cumulativeY = yScaleRight(item.cumulative)

            return (
              <g key={item.defectName}>
                {/* Vertical dashed line from bar top to cumulative point */}
                <line
                  x1={barRightX}
                  y1={barY}
                  x2={barRightX}
                  y2={cumulativeY}
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
                {/* Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill="#0891b2"
                  rx={2}
                  ry={2}
                />
                {/* Count label on top of bar */}
                <text
                  x={barX + barWidth / 2}
                  y={barY - 8}
                  textAnchor="middle"
                  fill="#22d3ee"
                  fontSize={12}
                  fontWeight={600}
                >
                  {item.count}
                </text>
                {/* X-Axis label - horizontal */}
                <text
                  x={barX + barWidth / 2}
                  y={margin.top + chartHeight + 20}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize={11}
                >
                  {item.defectName}
                </text>
              </g>
            )
          })}

          {/* Cumulative line - connects at bar right edges */}
          <path
            d={data
              .map((item, index) => {
                const barRightX = xScale(index) + barWidth
                const cumulativeY = yScaleRight(item.cumulative)
                return `${index === 0 ? "M" : "L"} ${barRightX} ${cumulativeY}`
              })
              .join(" ")}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5 5"
          />

          {/* Circles at intersection points with percentage labels */}
          {data.map((item, index) => {
            const barRightX = xScale(index) + barWidth
            const cumulativeY = yScaleRight(item.cumulative)

            return (
              <g key={`circle-${item.defectName}`}>
                {/* Circle at intersection */}
                <circle
                  cx={barRightX}
                  cy={cumulativeY}
                  r={5}
                  fill="#030712"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
                {/* Percentage label at top-right of circle */}
                <text
                  x={barRightX + 8}
                  y={cumulativeY - 8}
                  textAnchor="start"
                  fill="#fca5a5"
                  fontSize={12}
                  fontWeight={600}
                >
                  {item.cumulative}%
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
