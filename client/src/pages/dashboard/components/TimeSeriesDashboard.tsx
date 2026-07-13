import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Gauge,
  GripVertical,
  Layers,
  Maximize2,
  Pencil,
  Plus,
  Radio,
  Search,
  SlidersHorizontal,
  Terminal,
  Trash2,
  Upload,
  Waves,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import CyberPromptDialog from "@/components/ui/CyberPromptDialog";
import { cn } from "@/lib/utils";
import {
  buildTimeSeriesModuleSummary,
  type LaboratoryModuleSummary,
} from "./laboratory/laboratory-contract";

import "./time-series-dashboard.css";
import {
  createTimeSeriesArchive,
  deleteTimeSeriesArchive,
  fetchTimeSeriesArchive,
  fetchTimeSeriesArchives,
  fetchTimeSeriesState,
  renameTimeSeriesArchive,
  saveTimeSeriesState,
  type TimeSeriesArchiveRecord,
} from "../lib/time-series-state-api";
import {
  RANGES,
  createDefaultDataset,
  getRangeLabel,
  parseTimeSeriesExcelFile,
  type RangeKey,
  type TimeSeriesColumn,
  type TimeSeriesDataset,
  type TimeSeriesRow,
} from "./timeSeriesData";

type ControlState = {
  visibleColumnIds: string[];
  showAverageBand: boolean;
  showOutliers: boolean;
  outlierThreshold: number;
  dataPointColumnIds: string[];
};

type DerivedRow = TimeSeriesRow & {
  index: number;
  average: number;
  spread: number;
  [key: string]: unknown;
};

type SummaryPoint = {
  timeLabel: string;
  average: number;
};

type HudTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: DerivedRow }>;
  visibleColumns: TimeSeriesColumn[];
};

type BiLabelProps = {
  zh: string;
  en: string;
  className?: string;
  align?: "left" | "center" | "right";
  size?: "xs" | "sm" | "md";
  zhClassName?: string;
  enClassName?: string;
};

const BI_LABEL_SIZE_MAP = {
  xs: { zh: "text-[11px]", en: "text-[8px]" },
  sm: { zh: "text-xs", en: "text-[9px]" },
  md: { zh: "text-sm", en: "text-[10px]" },
};

const INITIAL_CONTROLS: ControlState = {
  visibleColumnIds: createDefaultDataset().columns.slice(0, 3).map((column) => column.id),
  showAverageBand: true,
  showOutliers: true,
  outlierThreshold: 68,
  dataPointColumnIds: [],
};

const ACCENT_MAP = {
  cyan: { text: "text-cyan", glow: "text-glow-cyan", border: "border-cyan/30", bg: "bg-cyan/5" },
  purple: { text: "text-purple", glow: "text-glow-purple", border: "border-purple/30", bg: "bg-purple/5" },
  alert: { text: "text-alert", glow: "", border: "border-alert/30", bg: "bg-alert/5" },
};

function BiLabel({
  zh,
  en,
  className,
  align = "left",
  size = "sm",
  zhClassName,
  enClassName,
}: BiLabelProps) {
  const sizeClasses = BI_LABEL_SIZE_MAP[size];

  return (
    <span
      className={cn(
        "flex flex-col",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
        className,
      )}
    >
      <span className={cn("bi-zh", sizeClasses.zh, zhClassName)}>{zh}</span>
      <span className={cn("bi-en", sizeClasses.en, "text-muted-foreground", enClassName)}>{en}</span>
    </span>
  );
}

function averageOf(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function spreadOf(values: number[]) {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function formatValue(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function formatPointLabel(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function DataPointValueLabel(props: {
  cx?: number | string;
  cy?: number | string;
  value?: unknown;
  stroke?: string;
}) {
  const { cx, cy, value, stroke } = props;
  const resolvedX = typeof cx === "string" ? Number(cx) : cx;
  const resolvedY = typeof cy === "string" ? Number(cy) : cy;
  if (typeof resolvedX !== "number" || Number.isNaN(resolvedX)) return null;
  if (typeof resolvedY !== "number" || Number.isNaN(resolvedY)) return null;

  const label = formatPointLabel(value);
  if (!label) return null;

  return (
    <g pointerEvents="none">
      <circle
        cx={resolvedX}
        cy={resolvedY}
        r={4}
        fill="#050608"
        stroke={stroke || "#b9d8e7"}
        strokeWidth={2}
      />
      <text
        x={resolvedX}
        y={resolvedY - 12}
        fill={stroke || "#b9d8e7"}
        fontSize={10}
        fontWeight={700}
        textAnchor="middle"
        style={{
          paintOrder: "stroke",
          stroke: "rgba(5,6,8,0.92)",
          strokeWidth: 3,
        }}
      >
        {label}
      </text>
    </g>
  );
}

function getAdaptiveTickGap(totalPoints: number) {
  if (totalPoints > 240) return 72;
  if (totalPoints > 160) return 56;
  if (totalPoints > 100) return 44;
  if (totalPoints > 60) return 32;
  return 18;
}

function getFixedAxisTicks(labels: string[], desiredCount: number) {
  if (labels.length <= desiredCount) return labels;
  if (desiredCount <= 1) return [labels[0], labels[labels.length - 1]].filter(Boolean);

  const ticks: string[] = [];
  const lastIndex = labels.length - 1;

  for (let tickIndex = 0; tickIndex < desiredCount; tickIndex += 1) {
    const position = Math.round((tickIndex * lastIndex) / (desiredCount - 1));
    const label = labels[position];
    if (!label) continue;
    if (ticks[ticks.length - 1] === label) continue;
    ticks.push(label);
  }

  if (ticks[0] !== labels[0]) {
    ticks.unshift(labels[0]);
  }

  if (ticks[ticks.length - 1] !== labels[lastIndex]) {
    ticks.push(labels[lastIndex]);
  }

  return ticks;
}

function getFixedYAxisTicks(minValue: number, maxValue: number, desiredSegmentCount: number) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return [];
  const safeSegments = Math.max(1, desiredSegmentCount);
  const span = maxValue - minValue;
  const step = span <= 0 ? 1 : span / safeSegments;
  const ticks = Array.from({ length: safeSegments + 1 }, (_, index) =>
    Number((minValue + step * index).toFixed(3)),
  );

  if (ticks[ticks.length - 1] !== Number(maxValue.toFixed(3))) {
    ticks[ticks.length - 1] = Number(maxValue.toFixed(3));
  }

  return ticks;
}

type ParsedAxisTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseAxisTimeLabel(label: string): ParsedAxisTime | null {
  const match = label.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
}

function padAxisTime(value: number) {
  return String(value).padStart(2, "0");
}

function createTimeAxisFormatter(labels: string[]) {
  const parsed = labels.map((label) => parseAxisTimeLabel(label)).filter((item): item is ParsedAxisTime => item !== null);

  if (parsed.length === 0) {
    return (label: string) => label;
  }

  const sameYear = parsed.every((item) => item.year === parsed[0].year);
  const sameMonth = parsed.every((item) => item.month === parsed[0].month);
  const sameDay = parsed.every((item) => item.day === parsed[0].day);
  const hasTime = parsed.some((item) => item.hour !== 0 || item.minute !== 0 || item.second !== 0);
  const hasSeconds = parsed.some((item) => item.second !== 0);

  return (label: string) => {
    const time = parseAxisTimeLabel(label);
    if (!time) return label;

    if (sameYear && sameMonth && sameDay && hasTime) {
      return `${padAxisTime(time.hour)}:${padAxisTime(time.minute)}`;
    }

    if (sameYear && hasTime) {
      return `${time.month}/${time.day} ${padAxisTime(time.hour)}:${padAxisTime(time.minute)}`;
    }

    if (hasTime || hasSeconds) {
      return `${time.year}/${time.month}/${time.day} ${padAxisTime(time.hour)}:${padAxisTime(time.minute)}`;
    }

    if (sameYear) {
      return `${time.month}/${time.day}`;
    }

    return `${time.year}/${time.month}/${time.day}`;
  };
}

function getVisibleColumns(columns: TimeSeriesColumn[], visibleColumnIds: string[]) {
  const visible = columns.filter((column) => visibleColumnIds.includes(column.id));
  return visible.length > 0 ? visible : columns.slice(0, 1);
}

function deriveRow(row: TimeSeriesRow, visibleColumns: TimeSeriesColumn[], index: number): DerivedRow {
  const values = visibleColumns.map((column) => row.values[column.id] ?? 0);
  const average = averageOf(values);
  const spread = spreadOf(values);

  return {
    ...row,
    index,
    average,
    spread,
    ...Object.fromEntries(visibleColumns.map((column) => [column.id, row.values[column.id] ?? 0])),
  };
}

function computeKpis(rows: TimeSeriesRow[], visibleColumns: TimeSeriesColumn[]) {
  if (rows.length === 0 || visibleColumns.length === 0) return [];

  const currentValues = visibleColumns.map((column) => rows[rows.length - 1].values[column.id] ?? 0);
  const previousValues =
    rows.length > 1
      ? visibleColumns.map((column) => rows[rows.length - 2].values[column.id] ?? 0)
      : currentValues;
  const allValues = rows.flatMap((row) => visibleColumns.map((column) => row.values[column.id] ?? 0));
  const averages = rows.map((row) => averageOf(visibleColumns.map((column) => row.values[column.id] ?? 0)));
  const spreads = rows.map((row) => spreadOf(visibleColumns.map((column) => row.values[column.id] ?? 0)));
  const currentAverage = averageOf(currentValues);
  const previousAverage = averageOf(previousValues);
  const overallAverage = averageOf(allValues);
  const peakValue = Math.max(...allValues);
  const outlierRatio = (spreads.filter((spread) => spread >= 2).length / spreads.length) * 100;

  return [
    {
      id: "current",
      labelZh: "当前均值",
      labelEn: "CURRENT AVG",
      value: formatValue(Number(currentAverage.toFixed(2))),
      delta: ((currentAverage - previousAverage) / Math.max(previousAverage, 1)) * 100,
      icon: <Activity className="h-4 w-4" strokeWidth={1.5} />,
      accent: "cyan" as const,
    },
    {
      id: "peak",
      labelZh: "峰值上限",
      labelEn: "PEAK VALUE",
      value: formatValue(peakValue),
      delta: ((peakValue - overallAverage) / Math.max(overallAverage, 1)) * 100,
      icon: <Crosshair className="h-4 w-4" strokeWidth={1.5} />,
      accent: "cyan" as const,
    },
    {
      id: "variation",
      labelZh: "波动程度",
      labelEn: "VARIATION LEVEL",
      value: averageOf(spreads).toFixed(2),
      unit: "",
      delta: ((spreads[spreads.length - 1] - spreads[0]) / Math.max(spreads[0], 1)) * 100,
      icon: <Gauge className="h-4 w-4" strokeWidth={1.5} />,
      accent: "purple" as const,
    },
    {
      id: "outlier",
      labelZh: "异常占比",
      labelEn: "OUTLIER RATIO",
      value: outlierRatio.toFixed(1),
      unit: "%",
      delta: outlierRatio - 10,
      icon: <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />,
      accent: "alert" as const,
    },
    {
      id: "scale",
      labelZh: "平均规模",
      labelEn: "AVG SCALE",
      value: overallAverage.toFixed(2),
      unit: "",
      delta: ((currentAverage - overallAverage) / Math.max(overallAverage, 1)) * 100,
      icon: <Layers className="h-4 w-4" strokeWidth={1.5} />,
      accent: "cyan" as const,
    },
  ];
}

function HeaderBar({
  range,
  onRangeChange,
  clock,
  titleZh,
  titleEn,
}: {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  clock: string;
  titleZh: string;
  titleEn: string;
}) {
  return (
    <header className="glass glow-border relative z-20 flex flex-col gap-3 rounded-xl px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-cyan/40 bg-cyan/5">
          <Layers className="h-5 w-5 text-cyan text-glow-cyan" strokeWidth={1.5} />
          <div className="absolute inset-0 animate-flicker rounded-md" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm font-semibold tracking-[0.25em] text-cyan text-glow-cyan">AXIOM</h1>
            <span className="rounded-sm border border-purple/40 bg-purple/10 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-purple">
              v4.4.0
            </span>
          </div>
          <p className="text-[11px] font-medium leading-tight text-secondary-foreground">
            <span className="bi-zh">{titleZh}</span>
            <span className="ml-1.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground">
              {titleEn}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-black/40 p-1">
        {RANGES.map((item) => (
          <button
            key={item}
            onClick={() => onRangeChange(item)}
            className={cn(
              "relative rounded-md px-3 py-1.5 font-mono text-xs tracking-widest transition-all",
              range === item
                ? "bg-cyan/15 text-cyan text-glow-cyan shadow-[inset_0_0_0_1px_rgba(0,243,255,0.4)]"
                : "text-muted-foreground hover:text-cyan/70",
            )}
          >
            {item}
            {range === item ? (
              <span className="absolute -bottom-px left-1/2 h-px w-6 -translate-x-1/2 bg-cyan shadow-[0_0_8px_rgba(0,243,255,0.9)]" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-positive/30 bg-positive/5 px-2.5 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-dot absolute inline-flex h-2 w-2 rounded-full bg-positive" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="bi-zh text-[11px] text-positive">动态列模型</span>
            <span className="font-mono text-[8px] tracking-[0.18em] text-positive/70">FLEX COLUMNS</span>
          </span>
          <Radio className="h-3 w-3 text-positive" strokeWidth={1.5} />
        </div>

        <div className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground md:flex">
          <Activity className="h-3.5 w-3.5 text-cyan" strokeWidth={1.5} />
          <span className="tabular-nums text-foreground">{clock}</span>
          <span className="text-[10px] tracking-widest">UTC</span>
        </div>
      </div>
    </header>
  );
}

function MetricsRow({
  rows,
  visibleColumns,
}: {
  rows: TimeSeriesRow[];
  visibleColumns: TimeSeriesColumn[];
}) {
  const kpis = computeKpis(rows, visibleColumns);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const accent = ACCENT_MAP[kpi.accent];
        const rising = kpi.delta >= 0;

        return (
          <div key={kpi.id} className="glass glow-border group relative overflow-hidden rounded-xl p-4">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-scan absolute -inset-y-4 left-0 w-12 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
            </div>

            <div className="flex items-start justify-between">
              <BiLabel zh={kpi.labelZh} en={kpi.labelEn} size="sm" />
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border", accent.border, accent.bg, accent.text)}>
                {kpi.icon}
              </span>
            </div>

            <div className="mt-3 flex items-end gap-1.5">
              <span className={cn("font-mono text-2xl font-semibold tracking-tight tabular-nums", accent.text, accent.glow)}>
                {kpi.value}
              </span>
              {kpi.unit ? <span className="mb-0.5 font-mono text-xs text-muted-foreground">{kpi.unit}</span> : null}
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums",
                  rising ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
                )}
              >
                {rising ? "+" : ""}
                {kpi.delta.toFixed(1)}%
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">较前值 vs prior</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
        <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function HudTooltip({ active, payload, visibleColumns }: HudTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <div className="glass min-w-[230px] rounded-lg border border-cyan/40 p-0 font-mono shadow-[0_0_30px_rgba(0,243,255,0.15)]">
      <div className="flex items-center justify-between border-b border-cyan/20 bg-cyan/5 px-3 py-1.5">
        <span className="text-[10px] tracking-[0.15em] text-cyan">
          <span className="bi-zh">数据探针</span> <span className="opacity-60">ROW PROBE</span>
        </span>
        <span className="text-[10px] text-muted-foreground">{String(row.timeLabel)}</span>
      </div>

      <div className="space-y-2 p-3">
        {visibleColumns.map((column) => (
          <TooltipRow
            key={column.id}
            color={column.color}
            label={column.label}
            value={formatValue(Number(row[column.id] ?? 0))}
          />
        ))}

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-[10px] tracking-widest text-muted-foreground">均值 AVERAGE</span>
          <span className="text-secondary-foreground">{row.average.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-widest text-muted-foreground">波动 SPREAD</span>
          <span className={row.spread >= 2 ? "text-alert" : "text-muted-foreground"}>{row.spread.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function CoreChart({
  rows,
  range,
  visibleColumns,
  showAverageBand,
  showOutliers,
  outlierThreshold,
  dataPointColumnIds,
  brushRange,
  timeHeader,
  desiredTickCount,
  desiredYAxisTickCount,
}: {
  rows: TimeSeriesRow[];
  range: RangeKey;
  visibleColumns: TimeSeriesColumn[];
  showAverageBand: boolean;
  showOutliers: boolean;
  outlierThreshold: number;
  dataPointColumnIds: string[];
  brushRange: [number, number];
  timeHeader: string;
  desiredTickCount: number;
  desiredYAxisTickCount: number;
}) {
  const derivedData = useMemo(() => {
    const [startPct, endPct] = brushRange;
    const start = Math.floor((startPct / 100) * rows.length);
    const end = Math.ceil((endPct / 100) * rows.length);
    return rows.slice(start, Math.max(end, start + 2)).map((row, index) => deriveRow(row, visibleColumns, index));
  }, [brushRange, rows, visibleColumns]);

  const values = derivedData.flatMap((row) => visibleColumns.map((column) => Number(row[column.id] ?? 0)));
  const minValue = values.length > 0 ? Math.min(...values) - 1 : 0;
  const maxValue = values.length > 0 ? Math.max(...values) + 1 : 10;
  const flaggedRows = derivedData.filter((row) => row.spread >= Math.max(1, outlierThreshold / 25));
  const tickGap = getAdaptiveTickGap(derivedData.length);
  const tickFormatter = useMemo(
    () => createTimeAxisFormatter(derivedData.map((row) => String(row.timeLabel))),
    [derivedData],
  );
  const fixedTicks = useMemo(
    () => getFixedAxisTicks(derivedData.map((row) => String(row.timeLabel)), desiredTickCount),
    [derivedData, desiredTickCount],
  );
  const fixedTickSet = useMemo(() => new Set(fixedTicks), [fixedTicks]);
  const fixedYAxisTicks = useMemo(
    () => getFixedYAxisTicks(minValue, maxValue, desiredYAxisTickCount),
    [maxValue, minValue, desiredYAxisTickCount],
  );

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={derivedData} margin={{ top: 18, right: 18, bottom: 30, left: 10 }}>
        <defs>
          <linearGradient id="ts-average-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00f3ff" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#00f3ff" stopOpacity={0} />
          </linearGradient>
          <filter id="ts-cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <CartesianGrid stroke="rgba(120,160,180,0.08)" strokeDasharray="2 6" vertical />

        <XAxis
          dataKey="timeLabel"
          ticks={fixedTicks}
          tickFormatter={tickFormatter}
          stroke="rgba(148,190,210,0.72)"
          tick={{ fill: "#9fb9c9", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600 }}
          tickLine={{ stroke: "rgba(148,190,210,0.58)", strokeWidth: 1.2 }}
          height={48}
          minTickGap={tickGap}
          interval={0}
          tickMargin={10}
          axisLine={{ stroke: "rgba(125,231,255,0.45)", strokeWidth: 1.4 }}
        />

        <YAxis
          stroke="rgba(148,190,210,0.72)"
          tick={{ fill: "#9fb9c9", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600 }}
          tickLine={{ stroke: "rgba(148,190,210,0.58)", strokeWidth: 1.2 }}
          axisLine={{ stroke: "rgba(125,231,255,0.45)", strokeWidth: 1.4 }}
          width={78}
          domain={[minValue, maxValue]}
          ticks={fixedYAxisTicks}
        />

          <Tooltip
            content={<HudTooltip visibleColumns={visibleColumns} />}
            cursor={{ stroke: "#00f3ff", strokeWidth: 1, strokeDasharray: "4 4", strokeOpacity: 0.6 }}
          />

        {showAverageBand ? (
          <Area type="monotone" dataKey="average" stroke="none" fill="url(#ts-average-fill)" isAnimationActive={false} />
        ) : null}

        {visibleColumns.map((column, index) => (
          <Line
            key={column.id}
            type="monotone"
            dataKey={column.id}
            stroke={column.color}
            strokeWidth={index === 0 ? 2.4 : 1.8}
            dot={
              dataPointColumnIds.includes(column.id)
                ? (props) => {
                    const payload = props.payload as { timeLabel?: unknown } | undefined;
                    const timeLabel = String(payload?.timeLabel ?? "");
                    if (!fixedTickSet.has(timeLabel)) return <g />;
                    return (
                      <DataPointValueLabel
                        cx={props.cx}
                        cy={props.cy}
                        value={props.value}
                        stroke={column.color}
                      />
                    );
                  }
                : false
            }
            strokeOpacity={0.92}
            filter={index === 0 ? "url(#ts-cyan-glow)" : undefined}
            activeDot={
              dataPointColumnIds.includes(column.id)
                ? { r: 5, fill: "#050608", stroke: column.color, strokeWidth: 2 }
                : { r: 4, fill: "#050608", stroke: column.color, strokeWidth: 2 }
            }
            isAnimationActive={false}
          />
        ))}

          {showOutliers
            ? flaggedRows.map((row) => (
                <ReferenceLine
                  key={`${row.id}-${row.index}`}
                  x={String(row.timeLabel)}
                  stroke="#ffd60a"
                  strokeWidth={1}
                  strokeOpacity={0.55}
                  strokeDasharray="2 3"
                />
              ))
            : null}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ControlPanel({
  columns,
  controls,
  onChange,
}: {
  columns: TimeSeriesColumn[];
  controls: ControlState;
  onChange: (state: ControlState) => void;
}) {
  const toggleColumn = (columnId: string) => {
    const exists = controls.visibleColumnIds.includes(columnId);
    if (exists && controls.visibleColumnIds.length === 1) return;

    const nextIds = exists
      ? controls.visibleColumnIds.filter((item) => item !== columnId)
      : [...controls.visibleColumnIds, columnId];

    onChange({ ...controls, visibleColumnIds: nextIds });
  };

  const toggleDataPoints = (columnId: string) => {
    const exists = controls.dataPointColumnIds.includes(columnId);
    const nextIds = exists
      ? controls.dataPointColumnIds.filter((item) => item !== columnId)
      : [...controls.dataPointColumnIds, columnId];

    onChange({ ...controls, dataPointColumnIds: nextIds });
  };

  return (
    <aside className="ts-scroll flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-center gap-2 px-1">
        <SlidersHorizontal className="h-4 w-4 text-cyan" strokeWidth={1.5} />
        <h2 className="flex flex-col leading-none">
          <span className="bi-zh text-sm text-cyan text-glow-cyan">控制台</span>
          <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">CONTROL DECK</span>
        </h2>
      </div>

      <div className="glass glow-border overflow-hidden rounded-xl">
        <div className="border-b border-border px-3 py-2.5">
          <BiLabel zh="图表列显隐" en="CHART COLUMNS" size="sm" zhClassName="text-secondary-foreground" />
        </div>
        <div className="space-y-3 px-3 py-3">
          {columns.map((column) => {
            const checked = controls.visibleColumnIds.includes(column.id);
            const pointChecked = controls.dataPointColumnIds.includes(column.id);
            return (
              <div key={column.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: checked ? column.color : "rgba(120,160,180,0.3)",
                      boxShadow: checked ? `0 0 8px ${column.color}` : "none",
                    }}
                  />
                  <span className="text-sm text-secondary-foreground">{column.label}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDataPoints(column.id)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-all",
                      pointChecked ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-border bg-black/30 text-muted-foreground",
                    )}
                  >
                    {pointChecked ? "点位开" : "点位关"}
                  </button>
                  <button
                    onClick={() => toggleColumn(column.id)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-all",
                      checked ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-border bg-black/30 text-muted-foreground",
                    )}
                  >
                    {checked ? "显示中" : "已隐藏"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass glow-border overflow-hidden rounded-xl">
        <div className="border-b border-border px-3 py-2.5">
          <BiLabel zh="视图设置" en="VIEW OPTIONS" size="sm" zhClassName="text-secondary-foreground" />
        </div>
        <div className="space-y-3 px-3 py-3">
          <Toggle
            labelZh="均值带"
            labelEn="AVERAGE BAND"
            color="#00f3ff"
            checked={controls.showAverageBand}
            onChange={(value) => onChange({ ...controls, showAverageBand: value })}
          />
          <Toggle
            labelZh="异常标记"
            labelEn="OUTLIER MARKERS"
            color="#ffd60a"
            checked={controls.showOutliers}
            onChange={(value) => onChange({ ...controls, showOutliers: value })}
          />
          <Slider
            labelZh="异常阈值"
            labelEn="OUTLIER THRESHOLD"
            value={controls.outlierThreshold}
            min={25}
            max={95}
            unit="%"
            onChange={(value) => onChange({ ...controls, outlierThreshold: value })}
          />
        </div>
      </div>
    </aside>
  );
}

function Toggle({
  labelZh,
  labelEn,
  checked,
  onChange,
  color,
}: {
  labelZh: string;
  labelEn: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full transition-shadow"
          style={{
            background: checked ? color : "rgba(120,160,180,0.3)",
            boxShadow: checked ? `0 0 8px ${color}` : "none",
          }}
        />
        <BiLabel zh={labelZh} en={labelEn} size="sm" zhClassName="text-secondary-foreground" />
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={`${labelZh} ${labelEn}`}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-all",
          checked ? "border-cyan/60 bg-cyan/20" : "border-border bg-black/50",
        )}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
          style={{
            left: checked ? "18px" : "2px",
            background: checked ? color : "#5c7480",
            boxShadow: checked ? `0 0 8px ${color}` : "none",
          }}
        />
      </button>
    </div>
  );
}

function Slider({
  labelZh,
  labelEn,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  labelZh: string;
  labelEn: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <BiLabel zh={labelZh} en={labelEn} size="sm" zhClassName="text-secondary-foreground" />
        <span className="font-mono text-[11px] tabular-nums text-cyan">
          {value}
          {unit}
        </span>
      </div>

      <div className="relative flex h-4 items-center">
        <div className="absolute h-1 w-full rounded-full bg-black/60" />
        <div className="absolute h-1 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,243,255,0.7)]" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={`${labelZh} ${labelEn}`}
          className="ts-slider-input absolute h-4 w-full cursor-pointer appearance-none bg-transparent"
          style={{ ["--thumb-color" as string]: "#00f3ff" }}
        />
      </div>
    </div>
  );
}

function Handle({ pct, onDown }: { pct: number; onDown: () => void }) {
  return (
    <div
      className="absolute inset-y-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: `${pct}%` }}
      onPointerDown={onDown}
    >
      <div className="flex h-8 w-3.5 items-center justify-center rounded-sm border border-cyan/70 bg-cyan/15 shadow-[0_0_10px_rgba(0,243,255,0.4)]">
        <GripVertical className="h-3 w-3 text-cyan" />
      </div>
    </div>
  );
}

function BrushTimeline({
  data,
  brushRange,
  onBrushChange,
}: {
  data: SummaryPoint[];
  brushRange: [number, number];
  onBrushChange: (range: [number, number]) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<"left" | "right" | "middle" | null>(null);
  const [startPct, endPct] = brushRange;

  const startLabel = useMemo(() => {
    const index = Math.floor((startPct / 100) * (data.length - 1));
    return data[index]?.timeLabel ?? "";
  }, [data, startPct]);

  const endLabel = useMemo(() => {
    const index = Math.min(data.length - 1, Math.ceil((endPct / 100) * (data.length - 1)));
    return data[index]?.timeLabel ?? "";
  }, [data, endPct]);

  const pointerToPct = useCallback((clientX: number) => {
    const element = trackRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragMode) return;

      const pct = pointerToPct(event.clientX);

      if (dragMode === "left") {
        onBrushChange([Math.min(pct, endPct - 4), endPct]);
        return;
      }

      if (dragMode === "right") {
        onBrushChange([startPct, Math.max(pct, startPct + 4)]);
        return;
      }

      const width = endPct - startPct;
      let nextLeft = pct - width / 2;
      nextLeft = Math.max(0, Math.min(100 - width, nextLeft));
      onBrushChange([nextLeft, nextLeft + width]);
    },
    [dragMode, endPct, onBrushChange, pointerToPct, startPct],
  );

  return (
    <div className="glass glow-border rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex flex-col leading-none">
          <span className="bi-zh text-[11px] text-secondary-foreground">时间窗口导航</span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-muted-foreground">WINDOW NAVIGATOR</span>
        </span>
        <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums text-cyan">
          <span>{startLabel}</span>
          <span className="text-muted-foreground">→</span>
          <span>{endLabel}</span>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-16 w-full touch-none select-none overflow-hidden rounded-lg border border-border bg-black/40"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragMode(null)}
        onPointerLeave={() => setDragMode(null)}
      >
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ts-mini-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f3ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00f3ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="average" stroke="#00f3ff" strokeWidth={1} fill="url(#ts-mini-fill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="absolute inset-y-0 left-0 bg-black/65" style={{ width: `${startPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/65" style={{ width: `${100 - endPct}%` }} />

        <div
          className="absolute inset-y-0 border-x border-cyan/60 bg-cyan/5"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          onPointerDown={() => setDragMode("middle")}
        >
          <div className="absolute inset-0 cursor-grab active:cursor-grabbing" />
        </div>

        <Handle pct={startPct} onDown={() => setDragMode("left")} />
        <Handle pct={endPct} onDown={() => setDragMode("right")} />
      </div>
    </div>
  );
}

function RawFileWorkspace({
  archives,
  dataset,
  onArchiveDelete,
  onArchiveOpen,
  onArchiveRename,
  onDatasetChange,
  onArchiveCreated,
  selectedRowId,
  onSelectRow,
}: {
  archives: TimeSeriesArchiveRecord[];
  dataset: TimeSeriesDataset;
  onArchiveDelete: (archive: TimeSeriesArchiveRecord) => void;
  onArchiveOpen: (archiveId: string) => Promise<void>;
  onArchiveRename: (archive: TimeSeriesArchiveRecord) => void;
  onDatasetChange: (updater: (current: TimeSeriesDataset) => TimeSeriesDataset) => void;
  onArchiveCreated: (archive: TimeSeriesArchiveRecord) => void;
  selectedRowId: string | null;
  onSelectRow: (rowId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const selectedRow = dataset.rows.find((row) => row.id === selectedRowId) ?? dataset.rows[0] ?? null;
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const tableContentRef = useRef<HTMLDivElement | null>(null);
  const tableElementRef = useRef<HTMLTableElement | null>(null);
  const timeColumnWidth = 188;
  const columnWidths = useMemo(
    () =>
      dataset.columns.map((column) => {
        const labelWidth = column.label.length * 18 + 42;
        return Math.max(156, Math.min(220, labelWidth));
      }),
    [dataset.columns],
  );
  const tableWidth = useMemo(
    () => timeColumnWidth + columnWidths.reduce((sum, width) => sum + width, 0),
    [columnWidths],
  );
  const [scrollOffset, setScrollOffset] = useState(0);
  const [maxScrollOffset, setMaxScrollOffset] = useState(0);
  const [measuredContentWidth, setMeasuredContentWidth] = useState(tableWidth);
  const [measuredViewportWidth, setMeasuredViewportWidth] = useState(0);

  useEffect(() => {
    const viewportEl = tableViewportRef.current;
    const contentEl = tableContentRef.current;
    const tableEl = tableElementRef.current;
    if (!viewportEl || !contentEl || !tableEl) return;

    const updateBounds = () => {
      const contentWidth = Math.max(
        tableWidth,
        tableEl.scrollWidth,
        Math.ceil(tableEl.getBoundingClientRect().width),
        contentEl.scrollWidth,
        Math.ceil(contentEl.getBoundingClientRect().width),
      );
      const viewportWidth = viewportEl.clientWidth;
      const nextMax = Math.max(0, contentWidth - viewportWidth);
      setMeasuredContentWidth(contentWidth);
      setMeasuredViewportWidth(viewportWidth);
      setMaxScrollOffset(nextMax);
      setScrollOffset((current) => Math.min(current, nextMax));
    };

    updateBounds();
    const frameId = requestAnimationFrame(updateBounds);

    const observer = new ResizeObserver(updateBounds);
    observer.observe(viewportEl);
    observer.observe(contentEl);
    observer.observe(tableEl);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [tableWidth]);

  const effectiveScrollOffset = useMemo(() => {
    if (maxScrollOffset <= 0) return 0;
    if (scrollOffset >= maxScrollOffset - 1) {
      return Math.max(0, measuredContentWidth - measuredViewportWidth);
    }
    return Math.min(scrollOffset, maxScrollOffset);
  }, [maxScrollOffset, measuredContentWidth, measuredViewportWidth, scrollOffset]);

  const applyScrollOffset = useCallback(
    (rawOffset: number) => {
      const clampedOffset = Math.max(0, Math.min(rawOffset, maxScrollOffset));
      const nextOffset =
        clampedOffset >= maxScrollOffset - 1
          ? Math.max(0, measuredContentWidth - measuredViewportWidth)
          : clampedOffset;

      const contentEl = tableContentRef.current;
      if (contentEl) {
        contentEl.style.transform = `translateX(-${nextOffset}px)`;
      }

      setScrollOffset(nextOffset);
    },
    [maxScrollOffset, measuredContentWidth, measuredViewportWidth],
  );

  useEffect(() => {
    applyScrollOffset(scrollOffset);
  }, [applyScrollOffset, scrollOffset]);

  const previewPayload = selectedRow
    ? JSON.stringify(
        {
          [dataset.timeHeader]: selectedRow.timeLabel,
          ...Object.fromEntries(dataset.columns.map((column) => [column.label, selectedRow.values[column.id] ?? 0])),
        },
        null,
        2,
      )
    : "{}";

  const filteredArchives = useMemo(() => {
    const keyword = archiveSearch.trim().toLowerCase();
    if (!keyword) {
      return archives;
    }

    return archives.filter((archive) => {
      const haystack = `${archive.title} ${archive.sourceName}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [archiveSearch, archives]);

  const groupedArchives = useMemo(() => {
    const groups = new Map<string, TimeSeriesArchiveRecord[]>();
    filteredArchives.forEach((archive) => {
      const groupKey = archive.sourceName || "未命名来源";
      const current = groups.get(groupKey) ?? [];
      current.push(archive);
      groups.set(groupKey, current);
    });
    return Array.from(groups.entries());
  }, [filteredArchives]);

  const handleExcelChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const parsed = await parseTimeSeriesExcelFile(file);
      onDatasetChange(() => parsed);
      onSelectRow(parsed.rows[0]?.id ?? "");
      const archive = await createTimeSeriesArchive({
        scope: "dashboard-time-series-workspace",
        dataset: parsed,
        selectedRowId: parsed.rows[0]?.id ?? null,
      }, parsed.sourceName);
      onArchiveCreated(archive);
      toast.success(`已解析 Excel：${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel 解析失败";
      toast.error(message);
    } finally {
      setIsParsing(false);
      event.target.value = "";
    }
  };

  const updateTimeHeader = (value: string) => {
    onDatasetChange((current) => ({
      ...current,
      timeHeader: value || "时间",
    }));
  };

  const updateColumnLabel = (columnId: string, label: string) => {
    onDatasetChange((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, label: label || "未命名列" } : column,
      ),
    }));
  };

  const addColumn = () => {
    onDatasetChange((current) => {
      const nextIndex = current.columns.length;
      const nextColumn: TimeSeriesColumn = {
        id: `column_${Date.now()}`,
        label: `数据列${String.fromCharCode(65 + nextIndex)}`,
        color: ["#00f3ff", "#bc13fe", "#00ffa3", "#ffd60a", "#ff7a59", "#7dd3fc"][nextIndex % 6],
      };

      return {
        ...current,
        columns: [...current.columns, nextColumn],
        rows: current.rows.map((row) => ({
          ...row,
          values: {
            ...row.values,
            [nextColumn.id]: 0,
          },
        })),
      };
    });
  };

  const removeColumn = (columnId: string) => {
    onDatasetChange((current) => {
      if (current.columns.length <= 1) {
        toast.error("至少保留 1 列数据。");
        return current;
      }

      return {
        ...current,
        columns: current.columns.filter((column) => column.id !== columnId),
        rows: current.rows.map((row) => {
          const nextValues = { ...row.values };
          delete nextValues[columnId];
          return { ...row, values: nextValues };
        }),
      };
    });
  };

  return (
    <section className="glass glow-border relative overflow-hidden rounded-xl">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-cyan" strokeWidth={1.5} />
          <h3 className="text-sm font-bold text-foreground">
            <span className="bi-zh">原始档数据工作区</span>
            <span className="ml-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">RAW FILE WORKSPACE</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="rounded-full border border-cyan/20 bg-cyan/5 px-2 py-1 text-cyan">{dataset.rows.length} 条记录</span>
          <span className="rounded-full border border-border bg-black/30 px-2 py-1">{dataset.columns.length} 列数值</span>
          <span className="rounded-full border border-border bg-black/30 px-2 py-1">{dataset.sourceName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border xl:grid-cols-[360px_1fr]">
        <div className="ts-scroll space-y-4 bg-background/40 p-4 xl:max-h-[560px] xl:overflow-y-auto">
          <div className="space-y-3 rounded-xl border border-cyan/20 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan" strokeWidth={1.5} />
              <BiLabel zh="Excel 解析" en="EXCEL PARSER" size="sm" />
            </div>
            <p className="text-xs text-muted-foreground">
              上传 `.xlsx / .xls`，默认读取首个工作表：第 1 列作为时间列，其余列作为数值列。
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan/50 bg-cyan/10 px-3 py-2.5 text-sm font-medium text-cyan transition-all hover:bg-cyan/20"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {isParsing ? "解析中..." : "选择 Excel 并解析"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelChange}
            />
            <div className="rounded-lg border border-border bg-black/30 px-3 py-2 text-xs text-muted-foreground">
              最近更新：{dataset.updatedAt}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan" strokeWidth={1.5} />
              <BiLabel zh="解析档案库" en="PARSED ARCHIVES" size="sm" />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={archiveSearch}
                onChange={(event) => setArchiveSearch(event.target.value)}
                placeholder="按来源或标题筛选"
                className="w-full rounded-lg border border-border bg-black/20 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-all focus:border-cyan/40"
              />
            </div>
            <div className="space-y-2">
              {groupedArchives.length === 0 ? (
                <div className="rounded-lg border border-border bg-black/20 px-3 py-2 text-xs text-muted-foreground">
                  暂无解析档案
                </div>
              ) : (
                groupedArchives.map(([groupName, items]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="rounded-lg border border-cyan/15 bg-cyan/5 px-3 py-1.5 text-[11px] text-cyan">
                      {groupName}
                    </div>
                    {items.map((archive) => (
                      <div
                        key={archive.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-black/20 px-3 py-2 transition-all hover:border-cyan/40 hover:bg-cyan/5"
                      >
                        <button
                          onClick={() => void onArchiveOpen(archive.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm text-foreground">{archive.title}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {archive.rowCount} 行 / {archive.columnCount} 列 / {archive.createdAt}
                          </span>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-xs text-cyan">打开</span>
                          <button
                            onClick={() => onArchiveRename(archive)}
                            className="rounded-md border border-cyan/20 bg-cyan/5 p-1.5 text-cyan transition-all hover:border-cyan/40 hover:bg-cyan/10"
                            aria-label={`重命名档案 ${archive.title}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onArchiveDelete(archive)}
                            className="rounded-md border border-red-400/20 bg-red-400/5 p-1.5 text-red-300 transition-all hover:border-red-400/40 hover:bg-red-400/10"
                            aria-label={`删除档案 ${archive.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-purple" strokeWidth={1.5} />
                <BiLabel zh="表头配置" en="HEADER CONFIG" size="sm" zhClassName="text-purple text-glow-purple" />
              </div>
              <button
                onClick={addColumn}
                className="flex items-center gap-1 rounded-md border border-cyan/40 bg-cyan/10 px-2 py-1 text-xs text-cyan"
              >
                <Plus className="h-3.5 w-3.5" />
                增加列
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-muted-foreground">时间表头</label>
              <input
                value={dataset.timeHeader}
                onChange={(event) => updateTimeHeader(event.target.value)}
                className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40"
              />
            </div>

            <div className="space-y-2">
              {dataset.columns.map((column, index) => (
                <div key={column.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: column.color, boxShadow: `0 0 8px ${column.color}` }} />
                  <input
                    value={column.label}
                    onChange={(event) => updateColumnLabel(column.id, event.target.value)}
                    className="flex-1 rounded-lg border border-border bg-black/40 px-3 py-2 text-sm text-foreground outline-none focus:border-cyan/40"
                  />
                  <button
                    onClick={() => removeColumn(column.id)}
                    disabled={dataset.columns.length <= 1}
                    className="hidden"
                    aria-label={`删除第 ${index + 1} 列`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5 text-cyan" strokeWidth={1.5} />
              <BiLabel zh="样例预览" en="ROW PREVIEW" size="sm" />
            </div>
            <div className="rounded-xl border border-cyan/20 bg-black/40 p-3">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-6 text-cyan">{previewPayload}</pre>
            </div>
          </div>
        </div>

        <div className="min-w-0 bg-background/20">
          <div ref={tableViewportRef} className="min-w-0 w-full max-h-[560px] overflow-hidden overflow-y-auto">
            <div
              ref={tableContentRef}
              style={{
                minWidth: `${tableWidth}px`,
                width: `${tableWidth}px`,
                transform: `translateX(-${effectiveScrollOffset}px)`,
                willChange: "transform",
              }}
            >
            <table
              ref={tableElementRef}
              className="border-collapse font-mono text-xs whitespace-nowrap"
              style={{ width: `${tableWidth}px`, tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: `${timeColumnWidth}px` }} />
                {dataset.columns.map((column, index) => (
                  <col key={column.id} style={{ width: `${columnWidths[index] ?? 156}px` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#0a0e15] backdrop-blur">
                  <th className="border-b border-cyan/20 px-2 py-2 text-center font-normal">
                    <input
                      value={dataset.timeHeader}
                      onChange={(event) => updateTimeHeader(event.target.value)}
                      className="w-full border-none bg-transparent text-center text-sm text-secondary-foreground outline-none"
                    />
                  </th>
                  {dataset.columns.map((column) => (
                    <th key={column.id} className="border-b border-cyan/20 px-2 py-2 text-center font-normal">
                      <div className="flex items-center">
                        <input
                          value={column.label}
                          onChange={(event) => updateColumnLabel(column.id, event.target.value)}
                          className="w-full border-none bg-transparent text-center text-sm text-secondary-foreground outline-none"
                        />
                        <button
                          onClick={() => removeColumn(column.id)}
                          disabled={dataset.columns.length <= 1}
                          className="hidden"
                          aria-label={`删除 ${column.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.rows.map((row, index) => {
                  const active = row.id === selectedRow?.id;
                  const values = dataset.columns.map((column) => row.values[column.id] ?? 0);
                  const average = averageOf(values);
                  const spread = spreadOf(values);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onSelectRow(row.id)}
                      className={cn(
                        "cursor-pointer border-b border-border/40 transition-colors hover:bg-cyan/[0.06]",
                        index % 2 === 0 ? "bg-transparent" : "bg-white/[0.012]",
                        active && "bg-cyan/[0.08]",
                      )}
                    >
                      <td className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-center text-secondary-foreground">
                        {row.timeLabel}
                      </td>
                      {dataset.columns.map((column) => (
                        <td
                          key={column.id}
                          className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-center tabular-nums text-foreground"
                        >
                          {formatValue(row.values[column.id] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 bg-black/20 px-4 py-3">
        <div className="mb-2 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,243,255,0.8)]" />
          <span>左右拖动滑块查看完整数据列</span>
        </div>
        <div className="rounded-full border border-cyan/20 bg-black/30 px-3 py-3">
          <input
            type="range"
            min={0}
            max={Math.max(maxScrollOffset, 1)}
            step={1}
            value={Math.min(scrollOffset, Math.max(maxScrollOffset, 1))}
            onInput={(event) => applyScrollOffset(Number((event.target as HTMLInputElement).value))}
            onChange={(event) => applyScrollOffset(Number((event.target as HTMLInputElement).value))}
            disabled={maxScrollOffset <= 0}
            aria-label="raw-file-horizontal-scroll"
            className="ts-bottom-slider h-5 w-full cursor-ew-resize appearance-none bg-transparent disabled:cursor-default disabled:opacity-40"
          />
        </div>
      </div>
    </section>
  );
}

function CornerTicks() {
  const baseClass = "pointer-events-none absolute h-3 w-3 border-cyan/40";

  return (
    <>
      <span className={`${baseClass} left-2 top-12 border-l border-t`} />
      <span className={`${baseClass} right-2 top-12 border-r border-t`} />
      <span className={`${baseClass} bottom-2 left-2 border-b border-l`} />
      <span className={`${baseClass} bottom-2 right-2 border-b border-r`} />
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground sm:flex">
      <span className="inline-block h-2 w-4 rounded-sm" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </span>
  );
}

function InlineAxisLegend({ columns }: { columns: TimeSeriesColumn[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-2 pt-1 pb-2">
      <span className="text-[11px] tracking-[0.14em] text-muted-foreground">颜色说明</span>
      <div className="h-3 w-px bg-border/70" />
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {columns.map((column) => (
          <div key={`axis-legend-${column.id}`} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: column.color, boxShadow: `0 0 8px ${column.color}` }}
            />
            <span className="text-xs text-secondary-foreground">{column.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TimeSeriesDashboardProps = {
  titleZh?: string;
  titleEn?: string;
  nodeId?: number;
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void;
};

export default function TimeSeriesDashboard({
  titleZh = "动态时间序列工作台",
  titleEn = "FLEX TIME SERIES WORKSPACE",
  nodeId,
  onSummaryChange,
}: TimeSeriesDashboardProps = {}) {
  const [range, setRange] = useState<RangeKey>("1W");
  const [brushRange, setBrushRange] = useState<[number, number]>([0, 100]);
  const [clock, setClock] = useState("--:--:--");
  const [dataset, setDataset] = useState<TimeSeriesDataset>(() => createDefaultDataset());
  const [archives, setArchives] = useState<TimeSeriesArchiveRecord[]>([]);
  const [isStateHydrated, setIsStateHydrated] = useState(false);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [controls, setControls] = useState<ControlState>(() => {
    const initial = createDefaultDataset();
    return {
      ...INITIAL_CONTROLS,
      visibleColumnIds: initial.columns.slice(0, 3).map((column) => column.id),
    };
  });
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [pendingDeleteArchive, setPendingDeleteArchive] = useState<TimeSeriesArchiveRecord | null>(null);
  const [pendingRenameArchive, setPendingRenameArchive] = useState<TimeSeriesArchiveRecord | null>(null);
  const lastSavedSnapshotRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);

  const updateDataset = useCallback((updater: (current: TimeSeriesDataset) => TimeSeriesDataset) => {
    setDataset((current) => updater(current));
  }, []);

  const handleArchiveCreated = useCallback((archive: TimeSeriesArchiveRecord) => {
    setArchives((current) => [archive, ...current.filter((item) => item.id !== archive.id)]);
  }, []);

  const handleArchiveOpen = useCallback(async (archiveId: string) => {
    try {
      const archiveState = await fetchTimeSeriesArchive(archiveId);
      if (!archiveState?.dataset) {
        toast.error("解析档案读取失败");
        return;
      }

      setDataset(archiveState.dataset);
      setSelectedRowId(archiveState.selectedRowId);
      lastSavedSnapshotRef.current = JSON.stringify({
        dataset: archiveState.dataset,
        selectedRowId: archiveState.selectedRowId,
      });
      toast.success("已打开解析档案");
    } catch (error) {
      console.error("Failed to open time series archive:", error);
      toast.error("解析档案打开失败");
    }
  }, []);

  const handleArchiveDelete = useCallback(async () => {
    if (!pendingDeleteArchive) return;

    try {
      await deleteTimeSeriesArchive(pendingDeleteArchive.id);
      setArchives((current) => current.filter((archive) => archive.id !== pendingDeleteArchive.id));
      toast.success("解析档案已删除");
    } catch (error) {
      console.error("Failed to delete time series archive:", error);
      toast.error("解析档案删除失败");
    } finally {
      setPendingDeleteArchive(null);
    }
  }, [pendingDeleteArchive]);

  const handleArchiveRename = useCallback(async (title: string) => {
    if (!pendingRenameArchive) return;

    try {
      const archive = await renameTimeSeriesArchive(pendingRenameArchive.id, title);
      setArchives((current) =>
        current.map((item) => (item.id === archive.id ? archive : item)),
      );
      toast.success("解析档案已重命名");
    } catch (error) {
      console.error("Failed to rename time series archive:", error);
      toast.error("解析档案重命名失败");
    } finally {
      setPendingRenameArchive(null);
    }
  }, [pendingRenameArchive]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const [remoteState, remoteArchives] = await Promise.all([
          fetchTimeSeriesState(),
          fetchTimeSeriesArchives(),
        ]);
        if (cancelled) return;

        if (remoteState?.dataset) {
          setDataset(remoteState.dataset);
          setSelectedRowId(remoteState.selectedRowId);
          lastSavedSnapshotRef.current = JSON.stringify({
            dataset: remoteState.dataset,
            selectedRowId: remoteState.selectedRowId,
          });
        }
        setArchives(remoteArchives);
      } catch (error) {
        console.error("Failed to hydrate time series state:", error);
        toast.error("时间序列远端数据恢复失败");
      } finally {
        if (!cancelled) {
          setIsStateHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toISOString().slice(11, 19));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isChartExpanded) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsChartExpanded(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isChartExpanded]);

  useEffect(() => {
    setBrushRange([0, 100]);
  }, [range, dataset.rows.length, dataset.columns.length]);

  useEffect(() => {
    if (dataset.rows.length === 0) {
      setSelectedRowId(null);
      return;
    }

    if (!selectedRowId || !dataset.rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(dataset.rows[0].id);
    }
  }, [dataset.rows, selectedRowId]);

  useEffect(() => {
    if (!isStateHydrated) return;

    const snapshot = JSON.stringify({
      dataset,
      selectedRowId,
    });

    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveTimeSeriesState({
        scope: "dashboard-time-series-workspace",
        dataset,
        selectedRowId,
      })
        .then(() => {
          lastSavedSnapshotRef.current = snapshot;
        })
        .catch((error) => {
          console.error("Failed to persist time series state:", error);
          toast.error("时间序列数据保存失败");
        });
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [dataset, isStateHydrated, selectedRowId]);

  useEffect(() => {
    setControls((current) => {
      const validIds = current.visibleColumnIds.filter((columnId) =>
        dataset.columns.some((column) => column.id === columnId),
      );
      const validPointIds = current.dataPointColumnIds.filter((columnId) =>
        dataset.columns.some((column) => column.id === columnId),
      );
      const fallbackIds = dataset.columns.slice(0, Math.min(3, dataset.columns.length)).map((column) => column.id);
      return {
        ...current,
        visibleColumnIds: validIds.length > 0 ? validIds : fallbackIds,
        dataPointColumnIds: validPointIds,
      };
    });
  }, [dataset.columns]);

  const visibleColumns = useMemo(
    () => getVisibleColumns(dataset.columns, controls.visibleColumnIds),
    [controls.visibleColumnIds, dataset.columns],
  );

  const summaryData = useMemo<SummaryPoint[]>(
    () =>
      dataset.rows.map((row) => ({
        timeLabel: row.timeLabel,
        average: averageOf(visibleColumns.map((column) => row.values[column.id] ?? 0)),
      })),
    [dataset.rows, visibleColumns],
  );

  useEffect(() => {
    if (!nodeId || !onSummaryChange) return;

    const visibleValues = dataset.rows.flatMap((row) =>
      visibleColumns.map((column) => row.values[column.id] ?? 0),
    );
    const rowSpreads = dataset.rows.map((row) =>
      spreadOf(visibleColumns.map((column) => row.values[column.id] ?? 0)),
    );

    onSummaryChange(
      buildTimeSeriesModuleSummary(nodeId, {
        sourceName: dataset.sourceName,
        updatedAt: dataset.updatedAt,
        timeHeader: dataset.timeHeader,
        rowCount: dataset.rows.length,
        columnCount: dataset.columns.length,
        visibleColumnLabels: visibleColumns.map((column) => column.label),
        minValue: visibleValues.length ? Math.min(...visibleValues) : Number.NaN,
        maxValue: visibleValues.length ? Math.max(...visibleValues) : Number.NaN,
        averageValue: averageOf(visibleValues),
        maxSpread: rowSpreads.length ? Math.max(...rowSpreads) : Number.NaN,
      }),
    );
  }, [dataset, nodeId, onSummaryChange, visibleColumns]);

  return (
    <div className="time-series-dashboard overflow-hidden rounded-[28px] border border-cyan/15 bg-background shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="grid-bg">
        <div className="scanlines">
          <div className="mx-auto flex min-h-[920px] w-full max-w-[1800px] flex-col gap-3 p-3 lg:p-4">
      <HeaderBar
        range={range}
        onRangeChange={setRange}
        clock={clock}
        titleZh={titleZh}
        titleEn={titleEn}
      />

            <MetricsRow rows={dataset.rows} visibleColumns={visibleColumns} />

            <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-[1fr_300px]">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="glass glow-border relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl">
                  <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <Crosshair className="h-4 w-4 text-cyan" strokeWidth={1.5} />
                      <div className="leading-tight">
                        <h3 className="text-sm font-bold text-foreground">
                          <span className="bi-zh">多列时间曲线</span>
                          <span className="ml-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                            MULTI COLUMN TIMELINE
                          </span>
                        </h3>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          分辨率 {getRangeLabel(range)} · 横轴为 {dataset.timeHeader}，纵轴为数值
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        aria-label="Expand chart"
                        onClick={() => setIsChartExpanded(true)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-cyan/50 hover:text-cyan"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <CornerTicks />

                  <div className="relative flex-1 px-1 py-2">
                    <CoreChart
                      rows={dataset.rows}
                      range={range}
                      visibleColumns={visibleColumns}
                      showAverageBand={controls.showAverageBand}
                      showOutliers={controls.showOutliers}
                      outlierThreshold={controls.outlierThreshold}
                      dataPointColumnIds={controls.dataPointColumnIds}
                      brushRange={brushRange}
                      timeHeader={dataset.timeHeader}
                      desiredTickCount={10}
                      desiredYAxisTickCount={5}
                    />
                  </div>
                </div>

                <InlineAxisLegend columns={visibleColumns} />
                <BrushTimeline data={summaryData} brushRange={brushRange} onBrushChange={setBrushRange} />
              </div>

              <ControlPanel columns={dataset.columns} controls={controls} onChange={setControls} />
            </div>

            <RawFileWorkspace
              archives={archives}
              dataset={dataset}
              onArchiveDelete={setPendingDeleteArchive}
              onArchiveOpen={handleArchiveOpen}
              onArchiveRename={setPendingRenameArchive}
              onDatasetChange={updateDataset}
              onArchiveCreated={handleArchiveCreated}
              selectedRowId={selectedRowId}
              onSelectRow={setSelectedRowId}
            />
          </div>
        </div>
      </div>

      {isChartExpanded ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/88 backdrop-blur-sm">
              <div className="flex h-full w-full items-center justify-center p-4 lg:p-8">
                <div className="glass glow-border flex h-[92vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-cyan/20 bg-background">
                  <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <Crosshair className="h-4 w-4 text-cyan" strokeWidth={1.5} />
                      <div className="leading-tight">
                        <h3 className="text-sm font-bold text-foreground">
                          <span className="bi-zh">多列时间曲线</span>
                          <span className="ml-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                            MULTI COLUMN TIMELINE
                          </span>
                        </h3>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          分辨率 {getRangeLabel(range)} · 横轴为 {dataset.timeHeader}，纵轴为数值
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsChartExpanded(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-black/30 text-muted-foreground transition-colors hover:border-cyan/50 hover:text-cyan"
                        aria-label="Close expanded chart"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 lg:p-6">
                <div className="h-full rounded-xl border border-cyan/10 bg-black/20 p-2 lg:p-4">
                  <CoreChart
                    rows={dataset.rows}
                    range={range}
                    visibleColumns={visibleColumns}
                    showAverageBand={controls.showAverageBand}
                    showOutliers={controls.showOutliers}
                    outlierThreshold={controls.outlierThreshold}
                    dataPointColumnIds={controls.dataPointColumnIds}
                    brushRange={brushRange}
                    timeHeader={dataset.timeHeader}
                    desiredTickCount={18}
                    desiredYAxisTickCount={8}
                  />
                </div>
              </div>

              <div className="border-t border-border px-4 pb-4 pt-3 lg:px-6">
                <InlineAxisLegend columns={visibleColumns} />
                <BrushTimeline data={summaryData} brushRange={brushRange} onBrushChange={setBrushRange} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <CyberConfirmDialog
        open={Boolean(pendingDeleteArchive)}
        title="删除解析档案"
        message={
          pendingDeleteArchive
            ? `确定要删除档案 ${pendingDeleteArchive.title} 吗？\n删除后将无法再次从档案库打开，此操作不可撤销。`
            : ""
        }
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={handleArchiveDelete}
        onCancel={() => setPendingDeleteArchive(null)}
      />

      <CyberPromptDialog
        open={Boolean(pendingRenameArchive)}
        title="重命名解析档案"
        subtitle="档案信息维护"
        description={pendingRenameArchive ? `来源：${pendingRenameArchive.sourceName}` : ""}
        fields={[
          {
            kind: "text",
            name: "title",
            label: "档案名称",
            defaultValue: pendingRenameArchive?.title ?? "",
            required: true,
            maxLength: 255,
          },
        ]}
        confirmText="确认重命名"
        cancelText="取消"
        tone="cyan"
        onConfirm={(values) => {
          void handleArchiveRename(values.title ?? "");
        }}
        onCancel={() => setPendingRenameArchive(null)}
      />
    </div>
  );
}
