'use client';

import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CTQMetrics, SPCSubgroup } from './types';

const SPC_CONSTANTS = {
  n: 5,
  A2: 0.577,
  D3: 0,
  D4: 2.114,
} as const;

const measurementKeys = ['x1', 'x2', 'x3', 'x4', 'x5'] as const;

interface CTQProps {
  title: string;
  metrics: CTQMetrics;
  subgroups: SPCSubgroup[];
}

interface StatDescriptor {
  label: string;
  value: string | ReactNode;
  highlight?: 'rose' | 'emerald' | 'amber' | 'cyan';
}

interface XBarChartPoint extends SPCSubgroup {
  mean: number;
}

interface RangeChartPoint extends SPCSubgroup {
  range: number;
}

interface TooltipPayload<T> {
  payload: T;
}

type ChartTooltipProps<T> = {
  active?: boolean;
  payload?: Array<TooltipPayload<T>>;
};

function subgroupValues(row: SPCSubgroup): number[] {
  return measurementKeys.map((key) => row[key]);
}

function deriveChartStats(metrics: CTQMetrics) {
  const UCL_xbar = Number((metrics.grandMean + SPC_CONSTANTS.A2 * metrics.avgRange).toFixed(4));
  const LCL_xbar = Number((metrics.grandMean - SPC_CONSTANTS.A2 * metrics.avgRange).toFixed(4));
  const UCL_R = Number((SPC_CONSTANTS.D4 * metrics.avgRange).toFixed(4));
  const LCL_R = Number((SPC_CONSTANTS.D3 * metrics.avgRange).toFixed(4));
  const oneThirdWidth = (UCL_xbar - metrics.grandMean) / 3;

  return {
    UCL_xbar,
    LCL_xbar,
    UCL_R,
    LCL_R,
    zoneC_upper: metrics.grandMean + oneThirdWidth,
    zoneB_upper: metrics.grandMean + 2 * oneThirdWidth,
    zoneC_lower: metrics.grandMean - oneThirdWidth,
    zoneB_lower: metrics.grandMean - 2 * oneThirdWidth,
  };
}

function getStatus(metrics: CTQMetrics, subgroups: SPCSubgroup[]) {
  const hasOOC = subgroups.some((row) => row.isOOC);
  const failing = metrics.cpk < 1.33 || !!metrics.nelsonRuleViolation || hasOOC;

  return {
    failing,
    status: failing ? 'failing' : 'stable',
    statusLabel: failing ? 'ALERT' : 'IN CONTROL',
  } as const;
}

function StatBlock({ label, value, highlight }: StatDescriptor) {
  const colorMap = {
    rose: 'text-rose-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
  };
  const valueColor = highlight ? colorMap[highlight] : 'text-slate-200';

  return (
    <div className="flex flex-col items-center justify-center py-2 px-1">
      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
        {label}
      </span>
      <span className={`text-sm font-mono tabular-nums mt-1 ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}

function StatisticalLedger({ metrics, failing }: { metrics: CTQMetrics; failing: boolean }) {
  const cpkColor = metrics.cpk >= 1.33 ? 'emerald' : metrics.cpk >= 1.0 ? 'amber' : 'rose';
  const ppkColor = metrics.ppk >= 1.33 ? 'emerald' : metrics.ppk >= 1.0 ? 'amber' : 'rose';
  const statItems: StatDescriptor[] = [
    { label: 'Target', value: metrics.target.toFixed(3) },
    { label: 'USL / LSL', value: `${metrics.usl.toFixed(3)} / ${metrics.lsl.toFixed(3)}` },
    { label: 'Grand Mean', value: metrics.grandMean.toFixed(4), highlight: 'cyan' },
    { label: 'Avg Range', value: metrics.avgRange.toFixed(4) },
    { label: 'Est. Sigma', value: metrics.estSigma.toFixed(4) },
    { label: 'Cp / Cpk', value: `${metrics.cp.toFixed(2)} / ${metrics.cpk.toFixed(2)}`, highlight: cpkColor },
    { label: 'Pp / Ppk', value: `${metrics.pp.toFixed(2)} / ${metrics.ppk.toFixed(2)}`, highlight: ppkColor },
    {
      label: 'Nelson Rules',
      value: metrics.nelsonRuleViolation ? (
        <span className="text-rose-500 animate-pulse text-xs">{metrics.nelsonRuleViolation}</span>
      ) : (
        <span className="text-emerald-500 text-xs">All Clear</span>
      ),
      highlight: failing ? 'rose' : 'emerald',
    },
  ];

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 bg-[#0a0f1c] p-3 rounded-lg border border-slate-800/80">
      {statItems.map((item) => (
        <StatBlock key={item.label} {...item} />
      ))}
    </div>
  );
}

function XBarTooltip({ active, payload }: ChartTooltipProps<XBarChartPoint>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{d.shift}</p>
      <p className="text-cyan-400">
        X̄ = {d.mean.toFixed(4)}
      </p>
      {d.isOOC && (
        <p className="text-rose-400 mt-1 animate-pulse">OOC - Beyond UCL</p>
      )}
    </div>
  );
}

function XBarChartPanel({ subgroups, metrics }: CTQProps) {
  const chartStats = deriveChartStats(metrics);
  const chartData: XBarChartPoint[] = subgroups.map((row) => ({
    ...row,
    mean: row.xBar,
    isOOC: row.isOOC ?? (row.xBar > chartStats.UCL_xbar || row.xBar < chartStats.LCL_xbar),
  }));
  const yMin = Math.min(metrics.lsl, ...chartData.map((row) => row.mean)) - 0.01;
  const yMax = Math.max(metrics.usl, ...chartData.map((row) => row.mean)) + 0.01;

  return (
    <div className="h-52 bg-slate-950 border border-slate-800 rounded relative">
      <div className="absolute top-2 left-3 z-10">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          X̄ Chart
        </span>
        <span className="text-[10px] font-mono text-slate-600 ml-2">
          (均值图)
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 24, right: 16, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="#1e293b"
            vertical={false}
          />

          <ReferenceArea
            y1={chartStats.zoneB_upper}
            y2={chartStats.UCL_xbar}
            fill="#ef4444"
            fillOpacity={0.04}
          />
          <ReferenceArea
            y1={chartStats.zoneC_upper}
            y2={chartStats.zoneB_upper}
            fill="#f59e0b"
            fillOpacity={0.03}
          />
          <ReferenceArea
            y1={metrics.grandMean}
            y2={chartStats.zoneC_upper}
            fill="#06b6d4"
            fillOpacity={0.02}
          />
          <ReferenceArea
            y1={chartStats.zoneC_lower}
            y2={metrics.grandMean}
            fill="#06b6d4"
            fillOpacity={0.02}
          />
          <ReferenceArea
            y1={chartStats.zoneB_lower}
            y2={chartStats.zoneC_lower}
            fill="#f59e0b"
            fillOpacity={0.03}
          />
          <ReferenceArea
            y1={chartStats.LCL_xbar}
            y2={chartStats.zoneB_lower}
            fill="#ef4444"
            fillOpacity={0.04}
          />

          <XAxis
            dataKey="id"
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'monospace' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'monospace' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(value: number) => value.toFixed(2)}
            width={44}
          />
          <Tooltip content={<XBarTooltip />} />

          <ReferenceLine
            y={metrics.usl}
            stroke="#991b1b"
            strokeWidth={1.5}
            label={{
              value: 'USL',
              position: 'right',
              fill: '#991b1b',
              fontSize: 9,
              fontFamily: 'monospace',
            }}
          />
          <ReferenceLine
            y={metrics.lsl}
            stroke="#991b1b"
            strokeWidth={1.5}
            label={{
              value: 'LSL',
              position: 'right',
              fill: '#991b1b',
              fontSize: 9,
              fontFamily: 'monospace',
            }}
          />

          <ReferenceLine
            y={chartStats.UCL_xbar}
            stroke="#d97706"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `UCL ${chartStats.UCL_xbar.toFixed(3)}`,
              position: 'right',
              fill: '#d97706',
              fontSize: 8,
              fontFamily: 'monospace',
            }}
          />
          <ReferenceLine
            y={chartStats.LCL_xbar}
            stroke="#d97706"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `LCL ${chartStats.LCL_xbar.toFixed(3)}`,
              position: 'right',
              fill: '#d97706',
              fontSize: 8,
              fontFamily: 'monospace',
            }}
          />

          <ReferenceLine
            y={metrics.grandMean}
            stroke="#0e7490"
            strokeWidth={1.5}
            label={{
              value: `X̄ ${metrics.grandMean.toFixed(3)}`,
              position: 'right',
              fill: '#0e7490',
              fontSize: 8,
              fontFamily: 'monospace',
            }}
          />

          <Line
            type="linear"
            dataKey="mean"
            stroke="#22d3ee"
            strokeWidth={1.5}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: XBarChartPoint };
              if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return <g />;
              if (payload.isOOC) {
                return (
                  <g key={`ooc-${payload.id}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="#ef4444"
                      stroke="#fca5a5"
                      strokeWidth={2}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={1}
                      opacity={0.5}
                    >
                      <animate
                        attributeName="r"
                        from="8"
                        to="14"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.6"
                        to="0"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <text
                      x={cx}
                      y={cy - 14}
                      textAnchor="middle"
                      fill="#fca5a5"
                      fontSize={8}
                      fontFamily="monospace"
                    >
                      {`OOC: ${payload.shift}`}
                    </text>
                  </g>
                );
              }
              return (
                <circle
                  key={`dot-${payload.id}`}
                  cx={cx}
                  cy={cy}
                  r={2.5}
                  fill="#22d3ee"
                  stroke="#164e63"
                  strokeWidth={1}
                />
              );
            }}
            activeDot={{ r: 4, fill: '#22d3ee', stroke: '#fff', strokeWidth: 1 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function RangeTooltip({ active, payload }: ChartTooltipProps<RangeChartPoint>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{d.shift}</p>
      <p className="text-amber-400">
        R = {d.range.toFixed(4)}
      </p>
    </div>
  );
}

function RangeChartPanel({ metrics, subgroups }: { metrics: CTQMetrics; subgroups: SPCSubgroup[] }) {
  const chartStats = deriveChartStats(metrics);
  const chartData: RangeChartPoint[] = subgroups.map((row) => ({
    ...row,
    range: row.r,
  }));
  const yMax = Math.max(chartStats.UCL_R, ...chartData.map((row) => row.range)) + 0.01;

  return (
    <div className="h-40 bg-slate-950 border border-slate-800 rounded relative">
      <div className="absolute top-2 left-3 z-10">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          R Chart
        </span>
        <span className="text-[10px] font-mono text-slate-600 ml-2">
          (极差图)
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 24, right: 16, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="#1e293b"
            vertical={false}
          />
          <XAxis
            dataKey="id"
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'monospace' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 9, fill: '#475569', fontFamily: 'monospace' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(value: number) => value.toFixed(2)}
            width={44}
          />
          <Tooltip content={<RangeTooltip />} />

          <ReferenceLine
            y={chartStats.UCL_R}
            stroke="#d97706"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `UCL ${chartStats.UCL_R.toFixed(3)}`,
              position: 'right',
              fill: '#d97706',
              fontSize: 8,
              fontFamily: 'monospace',
            }}
          />

          {chartStats.LCL_R > 0 && (
            <ReferenceLine
              y={chartStats.LCL_R}
              stroke="#d97706"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{
                value: `LCL ${chartStats.LCL_R.toFixed(3)}`,
                position: 'right',
                fill: '#d97706',
                fontSize: 8,
                fontFamily: 'monospace',
              }}
            />
          )}

          <ReferenceLine
            y={metrics.avgRange}
            stroke="#0e7490"
            strokeWidth={1.5}
            label={{
              value: `R̄ ${metrics.avgRange.toFixed(3)}`,
              position: 'right',
              fill: '#0e7490',
              fontSize: 8,
              fontFamily: 'monospace',
            }}
          />

          <Line
            type="linear"
            dataKey="range"
            stroke="#fbbf24"
            strokeWidth={1.5}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: RangeChartPoint };
              if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return <g />;
              const isOOC = payload.range > chartStats.UCL_R || (chartStats.LCL_R > 0 && payload.range < chartStats.LCL_R);
              if (isOOC) {
                return (
                  <circle
                    key={`r-ooc-${payload.id}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#ef4444"
                    stroke="#fca5a5"
                    strokeWidth={2}
                  />
                );
              }
              return (
                <circle
                  key={`r-dot-${payload.id}`}
                  cx={cx}
                  cy={cy}
                  r={2.5}
                  fill="#fbbf24"
                  stroke="#78350f"
                  strokeWidth={1}
                />
              );
            }}
            activeDot={{
              r: 4,
              fill: '#fbbf24',
              stroke: '#fff',
              strokeWidth: 1,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistogramTooltip({
  active,
  payload,
}: ChartTooltipProps<{ binLabel: string; count: number }>) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono shadow-xl">
      <p className="text-slate-400">{d.binLabel}</p>
      <p className="text-cyan-400">
        Count: {d.count}
      </p>
    </div>
  );
}

function HistogramPanel({ metrics, subgroups }: { metrics: CTQMetrics; subgroups: SPCSubgroup[] }) {
  const allValues = subgroups.flatMap((row) => subgroupValues(row));
  const binCount = 12;
  const min = Math.min(...allValues) - 0.005;
  const max = Math.max(...allValues) + 0.005;
  const binWidth = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const binStart = min + index * binWidth;
    const binEnd = binStart + binWidth;
    const count = allValues.filter((value) => value >= binStart && value < binEnd).length;
    const binCenter = (binStart + binEnd) / 2;

    return {
      binLabel: `${binStart.toFixed(3)}-${binEnd.toFixed(3)}`,
      binCenter: Number(binCenter.toFixed(3)),
      count,
      inSpec: binCenter >= metrics.lsl && binCenter <= metrics.usl,
    };
  });

  return (
    <div className="h-full bg-slate-950 border border-slate-800 rounded relative flex flex-col">
      <div className="pt-2 px-3">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Distribution
        </span>
        <span className="text-[10px] font-mono text-slate-600 ml-1">
          (分布图)
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bins}
            margin={{ top: 8, right: 8, bottom: 4, left: -12 }}
            barCategoryGap="8%"
          >
            <XAxis
              dataKey="binCenter"
              tick={{ fontSize: 7, fill: '#475569', fontFamily: 'monospace' }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              tickFormatter={(value: number) => value.toFixed(2)}
              interval={1}
            />
            <YAxis
              tick={{ fontSize: 8, fill: '#475569', fontFamily: 'monospace' }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
              width={24}
            />
            <Tooltip content={<HistogramTooltip />} />

            <ReferenceLine
              x={metrics.usl}
              stroke="#991b1b"
              strokeWidth={1.5}
              label={{
                value: 'USL',
                position: 'top',
                fill: '#991b1b',
                fontSize: 8,
                fontFamily: 'monospace',
              }}
            />
            <ReferenceLine
              x={metrics.lsl}
              stroke="#991b1b"
              strokeWidth={1.5}
              label={{
                value: 'LSL',
                position: 'top',
                fill: '#991b1b',
                fontSize: 8,
                fontFamily: 'monospace',
              }}
            />
            <ReferenceLine
              x={metrics.target}
              stroke="#0e7490"
              strokeDasharray="4 2"
              strokeWidth={1}
            />

            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {bins.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.inSpec ? '#164e63' : '#7f1d1d'}
                  stroke={entry.inSpec ? '#22d3ee' : '#ef4444'}
                  strokeWidth={0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RawSubgroupDataTable({ metrics, subgroups }: { metrics: CTQMetrics; subgroups: SPCSubgroup[] }) {
  const chartStats = deriveChartStats(metrics);

  return (
    <div className="bg-[#0a0f1c] border border-slate-800/80 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800/80">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Raw Subgroup Data
        </span>
        <span className="text-[10px] font-mono text-slate-600 ml-2">
          (原始数据)
        </span>
      </div>
      <div className="overflow-x-auto max-h-52">
        <table className="w-full text-[10px] font-mono tabular-nums">
          <thead>
            <tr className="border-b border-slate-800/60">
              <th className="text-left text-slate-500 px-2 py-1.5 sticky top-0 bg-[#0a0f1c]">
                #
              </th>
              <th className="text-left text-slate-500 px-2 py-1.5 sticky top-0 bg-[#0a0f1c]">
                Shift
              </th>
              {measurementKeys.map((key) => (
                <th
                  key={key}
                  className="text-right text-slate-500 px-2 py-1.5 sticky top-0 bg-[#0a0f1c]"
                >
                  {key}
                </th>
              ))}
              <th className="text-right text-slate-500 px-2 py-1.5 sticky top-0 bg-[#0a0f1c]">
                x̄
              </th>
              <th className="text-right text-slate-500 px-2 py-1.5 sticky top-0 bg-[#0a0f1c]">
                R
              </th>
            </tr>
          </thead>
          <tbody>
            {subgroups.map((row) => {
              const isOOC = row.isOOC ?? (row.xBar > chartStats.UCL_xbar || row.xBar < chartStats.LCL_xbar);
              return (
                <tr
                  key={row.id}
                  className={`border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors ${isOOC ? 'bg-rose-950/20' : ''}`}
                >
                  <td className="text-slate-500 px-2 py-1">
                    {row.id}
                  </td>
                  <td className="text-slate-400 px-2 py-1">{row.shift}</td>
                  {subgroupValues(row).map((value, index) => (
                    <td key={`${row.id}-${measurementKeys[index]}`} className="text-right text-slate-300 px-2 py-1">
                      {value.toFixed(3)}
                    </td>
                  ))}
                  <td
                    className={`text-right px-2 py-1 font-semibold ${isOOC ? 'text-rose-400' : 'text-cyan-400'}`}
                  >
                    {row.xBar.toFixed(4)}
                  </td>
                  <td className="text-right text-amber-400 px-2 py-1">
                    {row.r.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CTQControlChart({ title, metrics, subgroups }: CTQProps) {
  const { failing, status, statusLabel } = getStatus(metrics, subgroups);

  return (
    <div className="bg-[#030712] border border-slate-800 rounded-xl p-5 w-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-200 font-mono tracking-wide">
            {title}
          </h2>
          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
              status === 'failing'
                ? 'text-rose-400 bg-rose-950/30 border-rose-500/30'
                : 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30'
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
            Subgroup Size (n) = {SPC_CONSTANTS.n}
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
            Freq: 1/Shift
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
            Unit: mm
          </span>
        </div>
      </div>

      <StatisticalLedger metrics={metrics} failing={failing} />

      <div className="flex flex-col lg:flex-row gap-4 w-full">
        <div className="flex flex-col gap-4 w-full lg:w-3/4">
          <XBarChartPanel title={title} metrics={metrics} subgroups={subgroups} />
          <RangeChartPanel metrics={metrics} subgroups={subgroups} />
        </div>
        <div className="w-full lg:w-1/4 min-h-[384px]">
          <HistogramPanel metrics={metrics} subgroups={subgroups} />
        </div>
      </div>

      <RawSubgroupDataTable metrics={metrics} subgroups={subgroups} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-slate-800/60 pt-3 gap-2">
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-mono text-slate-600 uppercase">
            SPC Engine v3.1
          </span>
          <span className="text-[9px] font-mono text-slate-600">
            Constants: A₂={SPC_CONSTANTS.A2} D₃={SPC_CONSTANTS.D3} D₄={SPC_CONSTANTS.D4}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-slate-600">
            Reviewed: Q.E. — 2026-03-16
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${status === 'failing' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <span className={`text-[9px] font-mono ${status === 'failing' ? 'text-rose-600' : 'text-emerald-600'}`}>
              LIVE
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
