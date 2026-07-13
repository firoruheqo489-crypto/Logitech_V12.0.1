import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertOctagon,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  buildEmcModuleSummary,
  type LaboratoryModuleSummary,
} from "./laboratory/laboratory-contract";
import {
  buildEmcPeakRecords,
  DEFAULT_EMC_LIMITS,
  EMC_CHANNELS,
  EMC_RISK_META,
  overallEmcVerdict,
  parseEmcBinaryFile,
  resolveEmcLimit,
  type EmcBand,
  type EmcChannelData,
  type EmcChannelId,
  type EmcDetector,
  type EmcLimitProfilePoint,
  type EmcLimits,
  type EmcPeakRecord,
  type EmcRiskLevel,
  type ParsedEmcPdfResult,
} from "../lib/emc-radiation";

type MergedRow = { freq: number; L?: number | null; N?: number | null; F?: number | null };
type SpectrumRow = MergedRow & { limit?: number | null };

type EmcParseResponse = {
  ok: boolean;
  sourceType: "upload";
  fileName?: string;
  result: ParsedEmcPdfResult;
};

const vacuumGlassPanel =
  "bg-[#070c14]/30 backdrop-blur-3xl border border-white/[0.04] border-t border-cyan-400/20 shadow-2xl rounded-xl p-6";

const CHANNEL_HEX: Record<EmcChannelId, string> = {
  L: "#4f8df7",
  N: "#34c98a",
  F: "#b06bf0",
};

const ROW_STYLE: Record<EmcRiskLevel, string> = {
  high: "bg-rose-500/10 hover:bg-rose-500/15",
  mid: "bg-amber-500/10 hover:bg-amber-500/15",
  safe: "hover:bg-white/[0.03]",
};

const BADGE_STYLE: Record<EmcRiskLevel, string> = {
  high: "bg-rose-500 text-white",
  mid: "bg-amber-400 text-slate-950",
  safe: "bg-emerald-500/15 text-emerald-300",
};

async function parseEmcPdfUpload(file: File): Promise<EmcParseResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/api/dashboard/emc-pdf/parse-upload", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.details || payload?.error || "EMC PDF 解析失败");
  }

  return payload as EmcParseResponse;
}

function toChannelData(result: ParsedEmcPdfResult, fileName: string): EmcChannelData {
  const channel = result.channel ?? "L";
  return {
    channel,
    fileName,
    band: result.band,
    source: "pdf",
    pdfFileName: fileName,
    limitProfile: result.points.flatMap<EmcLimitProfilePoint>((point) => {
      const profilePoints: EmcLimitProfilePoint[] = [];
      if (typeof point.qp_limit === "number") {
        profilePoints.push({ freq: point.freq, detector: "QP", limit: point.qp_limit });
      }
      if (typeof point.av_limit === "number") {
        profilePoints.push({ freq: point.freq, detector: "AV", limit: point.av_limit });
      }
      return profilePoints;
    }),
    points: result.points.map((point) => ({
      freq: point.freq,
      qp: point.qp,
      av: point.av,
      qpLimit: point.qp_limit,
      avLimit: point.av_limit,
    })),
  };
}

function formatFreqLabel(freq: number): string {
  if (freq >= 1) return `${freq.toFixed(3)} MHz`;
  return `${(freq * 1000).toFixed(1)} kHz`;
}

function xTick(freq: number): string {
  if (freq >= 1) return `${freq >= 10 ? freq.toFixed(0) : freq.toFixed(1)}M`;
  return `${(freq * 1000).toFixed(0)}k`;
}

function formatLimitDescriptor(detector: EmcDetector, band: EmcBand, fallback: EmcLimits): string {
  if (band === "conducted") {
    return detector === "QP" ? "66→56→60 dB" : "56→46→50 dB";
  }
  const limit = detector === "QP" ? fallback.qp : fallback.av;
  return `${limit.toFixed(1)} dB`;
}

function UploadCard({
  id,
  label,
  desc,
  loaded,
  onUpload,
  onClear,
  onSwitchBand,
}: {
  id: EmcChannelId;
  label: string;
  desc: string;
  loaded?: EmcChannelData;
  onUpload: (expectedChannel: EmcChannelId, file: File) => Promise<void>;
  onClear: (id: EmcChannelId) => void;
  onSwitchBand: (band: EmcBand) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const color = CHANNEL_HEX[id];

  async function handleFiles(files: FileList | null) {
    setError(null);
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    setIsLoading(true);
    try {
      for (const file of selectedFiles) {
        await onUpload(id, file);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        void handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-white/[0.03] px-3 py-3 transition-colors",
        dragOver ? "border-cyan-400/50 bg-cyan-400/5" : "border-white/[0.08]",
        loaded && "border-l-2",
      )}
      style={loaded ? { borderLeftColor: color } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
          {label}
        </span>
        <span className="text-[10px] uppercase text-slate-500">{desc}</span>
      </div>

      {loaded ? (
        <div className="space-y-2 rounded-md bg-black/30 px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-200">
              <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="truncate" title={loaded.fileName}>
                {loaded.fileName}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-[10px] text-slate-500">{loaded.points.length} pts</span>
              <button
                type="button"
                onClick={() => onClear(id)}
                className="rounded p-0.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-100"
                aria-label={`清除 ${label} 数据`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loaded.pdfFileName ? (
              <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300">PDF</span>
            ) : null}
            {loaded.emcFileName ? (
              <span className="rounded bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">EMC 曲线</span>
            ) : null}
            <button
              type="button"
              onClick={() => onSwitchBand(loaded.band)}
              className="rounded border border-white/[0.08] px-2 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
            >
              {loaded.band === "conducted" ? "切换到传导" : "切换到辐射"}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
              className="rounded border border-white/[0.08] px-2 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "上传中..." : "继续上传 / 替换"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/[0.08] py-2 text-xs text-slate-500 transition-colors hover:border-cyan-400/50 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {isLoading ? "解析中..." : "拖拽或点击上传 PDF / EMC"}
        </button>
      )}

      {error ? <p className="text-[10px] text-rose-300">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,.emc"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </div>
  );
}

function ControlPanel({
  enabled,
  available,
  detector,
  band,
  onToggle,
  onDetector,
  onBand,
}: {
  enabled: Record<EmcChannelId, boolean>;
  available: Record<EmcChannelId, boolean>;
  detector: EmcDetector;
  band: EmcBand;
  onToggle: (id: EmcChannelId) => void;
  onDetector: (detector: EmcDetector) => void;
  onBand: (band: EmcBand) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">通道叠加</span>
        {EMC_CHANNELS.map((channel) => {
          const active = enabled[channel.id] && available[channel.id];
          const color = CHANNEL_HEX[channel.id];
          return (
            <button
              key={channel.id}
              type="button"
              disabled={!available[channel.id]}
              onClick={() => onToggle(channel.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                active ? "border-transparent text-slate-100" : "border-white/[0.08] text-slate-500 hover:text-slate-100",
              )}
              style={active ? { background: `${color}22`, borderColor: color } : undefined}
            >
              <span
                className="relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors"
                style={{ background: active ? color : "rgba(148,163,184,0.28)" }}
                aria-hidden
              >
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full bg-slate-950 transition-transform",
                    active ? "translate-x-3" : "translate-x-0.5",
                  )}
                />
              </span>
              {channel.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">检波器</span>
          <div className="inline-flex overflow-hidden rounded-md border border-white/[0.08]">
            {(["QP", "AV"] as EmcDetector[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onDetector(value)}
                className={cn(
                  "px-3 py-1.5 text-xs transition-colors",
                  detector === value ? "bg-cyan-400 text-slate-950" : "bg-white/[0.03] text-slate-500 hover:text-slate-100",
                )}
              >
                {value === "QP" ? "QP 准峰值" : "AV 平均值"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">频段</span>
          <div className="inline-flex overflow-hidden rounded-md border border-white/[0.08]">
            {(["conducted", "radiated"] as EmcBand[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onBand(value)}
                className={cn(
                  "px-3 py-1.5 text-xs transition-colors",
                  band === value ? "bg-cyan-400 text-slate-950" : "bg-white/[0.03] text-slate-500 hover:text-slate-100",
                )}
              >
                {value === "conducted" ? "传导 0.15–30M" : "辐射 30–300M"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskTable({
  records,
  selected,
  onSelect,
}: {
  records: EmcPeakRecord[];
  selected: EmcPeakRecord | null;
  onSelect: (record: EmcPeakRecord) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] text-sm text-slate-500">
        无极值记录
      </div>
    );
  }

  return (
    <div className="max-h-[560px] overflow-y-auto rounded-lg border border-white/[0.05] bg-black/20">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-black/40 text-slate-500">
          <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th>通道</th>
            <th>频点</th>
            <th>检波</th>
            <th className="text-right">读数</th>
            <th className="text-right">限值</th>
            <th className="text-right">余量 Δ</th>
            <th>风险判定</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const meta = EMC_RISK_META[record.level];
            const isSelected = selected?.id === record.id;
            return (
              <tr
                key={record.id}
                onClick={() => onSelect(record)}
                className={cn(
                  "cursor-pointer border-t border-white/[0.05] transition-colors",
                  ROW_STYLE[record.level],
                  isSelected && "outline outline-2 -outline-offset-2 outline-cyan-400/70",
                )}
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: CHANNEL_HEX[record.channel] }}
                      aria-hidden
                    />
                    {record.channel}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-100">{formatFreqLabel(record.freq)}</td>
                <td className="px-3 py-2">{record.detector}</td>
                <td className="px-3 py-2 text-right tabular-nums">{record.reading.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{record.limit.toFixed(1)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold tabular-nums",
                    record.margin < 3 ? "text-rose-300" : record.margin < 6 ? "text-amber-300" : "text-emerald-300",
                  )}
                >
                  {record.margin > 0 ? "+" : ""}
                  {record.margin.toFixed(1)}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", BADGE_STYLE[record.level])}>
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpectrumChart({
  channels,
  enabled,
  detector,
  limits,
  selected,
  band,
}: {
  channels: EmcChannelData[];
  enabled: Record<EmcChannelId, boolean>;
  detector: EmcDetector;
  limits: EmcLimits;
  selected: EmcPeakRecord | null;
  band: EmcBand;
}) {
  const data = useMemo<SpectrumRow[]>(() => {
    const map = new Map<number, SpectrumRow>();
    for (const channel of channels) {
      if (channel.band !== band || !enabled[channel.channel]) continue;
      for (const point of channel.points) {
        const value = detector === "QP" ? point.qp : point.av;
        const row = map.get(point.freq) ?? { freq: point.freq };
        row[channel.channel] = value;
        row.limit = resolveEmcLimit(point, detector, channel.band, limits, channel.limitProfile);
        map.set(point.freq, row);
      }
    }
    return [...map.values()].sort((left, right) => left.freq - right.freq);
  }, [band, channels, detector, enabled]);

  const domain = band === "conducted" ? [0.15, 30] : [30, 300];
  const ticks = band === "conducted" ? [0.15, 0.5, 1, 5, 10, 30] : [30, 50, 100, 200, 300];

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] text-sm text-slate-500">
        当前频段暂无可显示数据，请上传对应 PDF。
      </div>
    );
  }

  return (
    <div className="h-full min-h-[360px] w-full bg-transparent">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 28, left: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis
            dataKey="freq"
            type="number"
            scale="log"
            domain={domain}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={xTick}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{
              value: `频率 (MHz) · ${band === "conducted" ? "0.15–30 MHz 传导" : "30–300 MHz 辐射"}`,
              position: "insideBottom",
              offset: -16,
              fill: "rgba(148,163,184,0.8)",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          />
          <YAxis
            domain={[0, 130]}
            ticks={[0, 20, 40, 54, 64, 80, 100, 120]}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{
              value: "电平 (dBµV)",
              angle: -90,
              position: "insideLeft",
              fill: "rgba(148,163,184,0.8)",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(0,0,0,0.8)",
              borderColor: "rgba(0,243,255,0.2)",
              borderRadius: 8,
              backdropFilter: "blur(10px)",
              color: "#fff",
              fontSize: 12,
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "#e2e8f0" }}
            labelFormatter={(label) => `f = ${Number(label).toFixed(3)} MHz`}
            formatter={(value, name) => [`${Number(value).toFixed(1)} dBµV`, `${name} 线`]}
          />
          <Line
            type="monotone"
            dataKey="limit"
            name={`${detector} Limit`}
            stroke="#FF003C"
            strokeDasharray="4 4"
            strokeWidth={1.2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          {selected ? (
            <>
              <ReferenceLine x={selected.freq} stroke="#67e8f9" strokeWidth={1} strokeDasharray="3 3" />
              <ReferenceLine y={selected.reading} stroke="#67e8f9" strokeWidth={1} strokeDasharray="3 3" />
              <ReferenceDot x={selected.freq} y={selected.reading} r={5} fill="#67e8f9" stroke="#020617" strokeWidth={2} />
            </>
          ) : null}

          {(["L", "N", "F"] as EmcChannelId[]).map((channelId) =>
            enabled[channelId] ? (
              <Line
                key={channelId}
                type="monotone"
                dataKey={channelId}
                name={channelId}
                stroke={CHANNEL_HEX[channelId]}
                strokeWidth={1.6}
                style={{ filter: `drop-shadow(0 0 5px ${CHANNEL_HEX[channelId]}88)` }}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null,
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function EmcRadiationWorkspace({
  nodeId,
  onSummaryChange,
}: {
  nodeId?: number;
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void;
}) {
  const [channels, setChannels] = useState<EmcChannelData[]>([]);
  const [limits, setLimits] = useState<EmcLimits>(DEFAULT_EMC_LIMITS);
  const [enabled, setEnabled] = useState<Record<EmcChannelId, boolean>>({ L: true, N: true, F: true });
  const [detector, setDetector] = useState<EmcDetector>("QP");
  const [band, setBand] = useState<EmcBand>("conducted");
  const [selected, setSelected] = useState<EmcPeakRecord | null>(null);

  const bandChannels = useMemo(
    () => channels.filter((channel) => channel.band === band),
    [band, channels],
  );

  const available = useMemo<Record<EmcChannelId, boolean>>(
    () => ({
      L: bandChannels.some((channel) => channel.channel === "L"),
      N: bandChannels.some((channel) => channel.channel === "N"),
      F: bandChannels.some((channel) => channel.channel === "F"),
    }),
    [bandChannels],
  );

  const records = useMemo(() => buildEmcPeakRecords(bandChannels, limits), [bandChannels, limits]);

  const tableRecords = useMemo(
    () => records.filter((record) => enabled[record.channel] && record.detector === detector),
    [detector, enabled, records],
  );

  const allRecords = useMemo(() => buildEmcPeakRecords(channels, limits), [channels, limits]);

  const counts = useMemo(() => {
    const summary = { high: 0, mid: 0, safe: 0 };
    for (const record of tableRecords) summary[record.level] += 1;
    return summary;
  }, [tableRecords]);

  const activeRecords = useMemo(
    () => records.filter((record) => enabled[record.channel]),
    [enabled, records],
  );

  const verdict = records.length > 0 ? overallEmcVerdict(records.filter((record) => enabled[record.channel])) : null;

  const worstRecord = useMemo(() => activeRecords[0] ?? null, [activeRecords]);

  const conductedDiagnostics = useMemo(() => {
    const conductedRecords = allRecords.filter((record) => record.band === "conducted");
    const worst = conductedRecords[0] ?? null;
    return {
      worst,
      counts: {
        high: conductedRecords.filter((record) => record.level === "high").length,
        mid: conductedRecords.filter((record) => record.level === "mid").length,
        safe: conductedRecords.filter((record) => record.level === "safe").length,
      },
    };
  }, [allRecords]);

  const radiatedDiagnostics = useMemo(() => {
    const radiatedRecords = allRecords.filter((record) => record.band === "radiated");
    const worst = radiatedRecords[0] ?? null;
    return {
      worst,
      counts: {
        high: radiatedRecords.filter((record) => record.level === "high").length,
        mid: radiatedRecords.filter((record) => record.level === "mid").length,
        safe: radiatedRecords.filter((record) => record.level === "safe").length,
      },
    };
  }, [allRecords]);

  useEffect(() => {
    if (!nodeId || !onSummaryChange) return;
    if (channels.length === 0) {
      onSummaryChange(null);
      return;
    }

    const nextVerdict = allRecords.length > 0 ? overallEmcVerdict(allRecords) : "PASS";
    onSummaryChange(
      buildEmcModuleSummary(nodeId, {
        sourceFiles: channels.map((channel) => channel.fileName),
        verdict: nextVerdict,
        channelCount: channels.length,
        pointCount: channels.reduce((sum, channel) => sum + channel.points.length, 0),
        worstRecord: allRecords[0]
          ? {
              channel: allRecords[0].channel,
              band: allRecords[0].band,
              detector: allRecords[0].detector,
              freq: allRecords[0].freq,
              reading: allRecords[0].reading,
              limit: allRecords[0].limit,
              margin: allRecords[0].margin,
            }
          : null,
        counts: {
          high: allRecords.filter((record) => record.level === "high").length,
          mid: allRecords.filter((record) => record.level === "mid").length,
          safe: allRecords.filter((record) => record.level === "safe").length,
          overLimit: allRecords.filter((record) => record.margin < 0).length,
        },
      }),
    );
  }, [allRecords, channels, nodeId]);

  async function handleUpload(expectedChannel: EmcChannelId, file: File) {
    if (file.name.toLowerCase().endsWith(".emc")) {
      const parsed = parseEmcBinaryFile(file.name, await file.arrayBuffer());
      const resolvedChannel = parsed.channel ?? expectedChannel;

      setChannels((previous) => {
        const existing = previous.find((channel) => channel.channel === resolvedChannel);
        const nextChannel: EmcChannelData = {
          channel: resolvedChannel,
          band: parsed.band,
          fileName: parsed.fileName,
          source: "emc",
          emcFileName: parsed.fileName,
          pdfFileName: existing?.pdfFileName,
          limitProfile: existing?.limitProfile,
          points: parsed.points,
        };
        return [...previous.filter((channel) => channel.channel !== resolvedChannel), nextChannel];
      });

      setEnabled((previous) => ({ ...previous, [resolvedChannel]: true }));
      setSelected(null);
      toast.success(`${resolvedChannel} 通道 EMC 曲线已载入`);
      return;
    }

    const payload = await parseEmcPdfUpload(file);
    const parsed = payload.result;
    const resolvedChannel = parsed.channel ?? expectedChannel;
    const pdfChannel = toChannelData({ ...parsed, channel: resolvedChannel }, payload.fileName || file.name);

    setChannels((previous) => {
      const existing = previous.find((channel) => channel.channel === resolvedChannel);
      if (existing?.source === "emc") {
        return [
          ...previous.filter((channel) => channel.channel !== resolvedChannel),
          {
            ...existing,
            pdfFileName: pdfChannel.pdfFileName,
            limitProfile: pdfChannel.limitProfile,
          },
        ];
      }
      return [...previous.filter((channel) => channel.channel !== resolvedChannel), pdfChannel];
    });
    setEnabled((previous) => ({ ...previous, [resolvedChannel]: true }));
    setSelected(null);

    if (pdfChannel.points.length === 0) {
      toast.warning(`${resolvedChannel} 通道 PDF 已载入，但当前未提取到可绘制频点`);
      return;
    }

    toast.success(`${resolvedChannel} 通道 PDF 解析完成`);
  }

  function handleClear(channelId: EmcChannelId) {
    setChannels((previous) => previous.filter((channel) => channel.channel !== channelId));
    setSelected((current) => (current?.channel === channelId ? null : current));
  }

  return (
    <main className="mx-auto flex min-h-0 max-w-[1600px] flex-col gap-4 rounded-2xl border border-white/[0.06] bg-black/30 p-4 lg:p-6">
      <header className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-cyan-300" />
        <h1 className="text-lg font-semibold text-slate-100">EMC 传导辐射解析看板</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EMC_CHANNELS.map((channel) => (
          <UploadCard
            key={channel.id}
            id={channel.id}
            label={channel.label}
            desc={channel.desc}
            loaded={channels.find((entry) => entry.channel === channel.id)}
            onUpload={handleUpload}
            onClear={handleClear}
            onSwitchBand={(nextBand) => {
              setBand(nextBand);
              setSelected(null);
            }}
          />
        ))}
        <div
          className={cn(
            "flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border px-6 py-4",
            verdict === "FAIL"
              ? "border-rose-500/50 bg-rose-500/10"
              : verdict === "PASS"
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-white/[0.08] bg-white/[0.03]",
          )}
        >
          <span className="text-[10px] uppercase tracking-widest text-slate-500">判定结果</span>
          <span
            className={cn(
              "flex items-center gap-2 text-3xl font-bold tracking-wider",
              verdict === "FAIL" ? "text-rose-300" : verdict === "PASS" ? "text-emerald-300" : "text-slate-500",
            )}
          >
            {verdict === "FAIL" ? <AlertOctagon className="h-7 w-7" /> : verdict === "PASS" ? <ShieldCheck className="h-7 w-7" /> : null}
            {verdict ?? "—"}
          </span>
          {verdict ? (
            <span className="text-[10px] text-slate-500">
              {records.filter((record) => enabled[record.channel] && record.margin < 0).length > 0
                ? `${records.filter((record) => enabled[record.channel] && record.margin < 0).length} 个超标频点`
                : "无超标频点"}
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6 w-full">
        <div className="col-span-12 flex flex-col">
          <section className={cn(vacuumGlassPanel, "flex min-h-[560px] flex-col")}>
            <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">全局频谱比对图</h2>
            <span className="text-[10px] text-slate-500">X 对数轴 · Y 线性 0–130 dBµV · {detector} 曲线</span>
            </div>
          <ControlPanel
            enabled={enabled}
            available={available}
            detector={detector}
            band={band}
            onToggle={(channelId) => setEnabled((previous) => ({ ...previous, [channelId]: !previous[channelId] }))}
            onDetector={setDetector}
            onBand={(nextBand) => {
              setBand(nextBand);
              setSelected(null);
            }}
          />
            <div className="mt-4 min-h-[420px] flex-1 bg-transparent">
            <SpectrumChart
              channels={channels}
              enabled={enabled}
              detector={detector}
              limits={limits}
              selected={selected}
              band={band}
            />
            </div>
          </section>
        </div>

        <div className="col-span-12 flex flex-col gap-4">
          <section className={cn(vacuumGlassPanel, "flex flex-col")}>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest border-b border-white/5 pb-2 mb-4">
              // PEAK EMISSION DIAGNOSTICS
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {[
                {
                  title: "传导诊断区",
                  band: "conducted" as EmcBand,
                  bandLabel: "传导 0.15–30M",
                  detectorLabel: "QP / AV",
                  data: conductedDiagnostics,
                },
                {
                  title: "辐射诊断区",
                  band: "radiated" as EmcBand,
                  bandLabel: "辐射 30–300M",
                  detectorLabel: "QP / AV",
                  data: radiatedDiagnostics,
                },
              ].map((section) => {
                const localWorst = section.data.worst;
                const localCounts = section.data.counts;
                return (
                  <div key={section.title} className="rounded-xl border border-white/[0.05] bg-black/20 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-100">{section.title}</h3>
                      <span className="text-[10px] text-slate-500">{section.bandLabel}</span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex min-h-[92px] flex-col justify-between rounded-md bg-black/40 p-4 ring-1 ring-white/5">
                        <span className="text-[10px] tracking-wide text-slate-400 font-sans">当前频段</span>
                        <span className="text-[18px] leading-7 font-mono font-semibold text-gray-200">
                          {section.bandLabel}
                        </span>
                      </div>
                      <div className="flex min-h-[92px] flex-col justify-between rounded-md bg-black/40 p-4 ring-1 ring-white/5">
                        <span className="text-[10px] tracking-wide text-slate-400 font-sans">峰值频点</span>
                        <span className="text-[18px] leading-7 font-mono font-semibold text-gray-200">
                          {localWorst ? formatFreqLabel(localWorst.freq) : "未提取"}
                        </span>
                      </div>
                      <div className="flex min-h-[84px] items-center justify-between p-3 bg-black/40 ring-1 ring-white/5 rounded-md">
                        <span className="text-[10px] text-slate-400 font-sans">QP 限值</span>
                        <span className="text-sm font-mono font-semibold text-gray-200">{formatLimitDescriptor("QP", section.band, limits)}</span>
                      </div>
                      <div className="flex min-h-[84px] items-center justify-between p-3 bg-black/40 ring-1 ring-white/5 rounded-md">
                        <span className="text-[10px] text-slate-400 font-sans">AV 限值</span>
                        <span className="text-sm font-mono font-semibold text-gray-200">{formatLimitDescriptor("AV", section.band, limits)}</span>
                      </div>
                      <div className="flex min-h-[84px] items-center justify-between p-3 bg-black/40 ring-1 ring-white/5 rounded-md">
                        <span className="text-[10px] text-slate-400 font-sans">最小余量</span>
                        <span className="text-sm font-mono font-semibold text-gray-200">
                          {localWorst ? `${localWorst.margin > 0 ? "+" : ""}${localWorst.margin.toFixed(1)} dB` : "未提取"}
                        </span>
                      </div>
                      <div className="flex min-h-[84px] items-center justify-between p-3 bg-black/40 ring-1 ring-white/5 rounded-md">
                        <span className="text-[10px] text-slate-400 font-sans">当前检波器</span>
                        <span className="text-sm font-mono font-semibold text-gray-200">{section.detectorLabel}</span>
                      </div>
                    </div>

                    {localWorst && localWorst.margin < 0 ? (
                      <div className="mt-4 p-4 bg-[#FF003C]/10 border border-[#FF003C]/30 rounded flex justify-between items-center">
                        <span className="text-[11px] font-mono text-[#FF003C] tracking-widest">STATUS: OVER LIMIT</span>
                        <span className="text-lg font-mono font-bold text-[#FF003C]">{Math.abs(localWorst.margin).toFixed(1)} dB</span>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-emerald-400/10 border border-emerald-400/20 rounded flex justify-between items-center">
                        <span className="text-[11px] font-mono text-emerald-300 tracking-widest">STATUS: WITHIN LIMIT</span>
                        <span className="text-lg font-mono font-bold text-emerald-300">
                          {localWorst ? `${localWorst.margin.toFixed(1)} dB` : "--"}
                        </span>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-3 text-center">
                        <div className="text-2xl font-mono font-bold text-rose-300">{localCounts.high}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{EMC_RISK_META.high.label}</div>
                      </div>
                      <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-3 text-center">
                        <div className="text-2xl font-mono font-bold text-amber-300">{localCounts.mid}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{EMC_RISK_META.mid.label}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-3 text-center">
                        <div className="text-2xl font-mono font-bold text-emerald-300">{localCounts.safe}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{EMC_RISK_META.safe.label}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">DQE 风险审查 · 极值定标</h2>
              <span className="text-[10px] text-slate-500">余量升序</span>
            </div>

            <div className="mt-3">
              <RiskTable records={tableRecords} selected={selected} onSelect={setSelected} />
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
              分级规则：Margin &lt; 3 dB 视为量产高危，3–6 dB 视为需审查，≥ 6 dB 视为安全。点击表格行可在频谱图定位十字准星。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
