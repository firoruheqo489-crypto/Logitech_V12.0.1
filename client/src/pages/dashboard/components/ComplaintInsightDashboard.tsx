import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  RefreshCcw,
  UploadCloud,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ComplaintCategoryBreakdown,
  type ComplaintInsightsPayload,
  parseComplaintInsightExcel,
} from "./complaintInsightParser";

const CHART_BG = "#18181B";
const CHART_TEXT = "#F8FAFC";
const CHART_MUTED = "#94A3B8";
const CHART_GRID = "#334155";
const ALERT_RED = "#EF4444";
const TECH_BLUE = "#3B82F6";
const SLATE_BAR = "#475569";
const AMBER_LINE = "#F59E0B";
const TOOLTIP_PANEL_STYLE = {
  background: "#111827",
  border: `1px solid rgba(148, 163, 184, 0.35)`,
  color: CHART_TEXT,
  borderRadius: "14px",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.42)",
  padding: "12px 14px",
};
const TOOLTIP_LABEL_STYLE = {
  color: CHART_TEXT,
  fontWeight: 700,
  marginBottom: 6,
};
const TOOLTIP_ITEM_STYLE = {
  color: "#E2E8F0",
  fontSize: "12px",
  paddingTop: 2,
  paddingBottom: 2,
};

type SourceKey = "complaint" | "inspection" | "outsourcing";

type SourcePayloadMap = Record<SourceKey, ComplaintInsightsPayload | null>;
type SourceErrorMap = Record<SourceKey, string>;
type SourceParsingMap = Record<SourceKey, boolean>;
type SourceStateResponse = {
  state: Record<
    SourceKey,
    | {
        sourceFile: string;
        assetUrl: string;
        payload: ComplaintInsightsPayload;
        updatedAt: string;
      }
    | null
  >;
};

type SourceConfig = {
  key: SourceKey;
  label: string;
  shortLabel: string;
  hint: string;
  barColor: string;
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    key: "complaint",
    label: "内部生产客诉",
    shortLabel: "内部生产客诉",
    hint: "上传内部生产客诉台账",
    barColor: "#EF4444",
  },
  {
    key: "inspection",
    label: "客户验货客诉",
    shortLabel: "客户验货客诉",
    hint: "上传客户验货客诉台账",
    barColor: "#F97316",
  },
  {
    key: "outsourcing",
    label: "委外加工客诉",
    shortLabel: "委外加工客诉",
    hint: "上传委外加工客诉台账",
    barColor: "#3B82F6",
  },
];

function getCauseColor(name: string) {
  if (name.includes("制程装配")) return "#EF4444";
  if (name.includes("研发设计")) return "#F97316";
  if (name.includes("来料异常")) return "#3B82F6";
  if (name.includes("其它") || name.includes("其他")) return "#64748B";
  return "#64748B";
}

function withRankedBarColor<T extends { count: number }>(rows: T[]) {
  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0);
  return rows.map((row) => ({
    ...row,
    barColor: row.count === maxCount ? ALERT_RED : TECH_BLUE,
  }));
}

function formatDate(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatDateTime(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${formatDate(dateText)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function formatMonthTick(value: number | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthRange(months: string[]) {
  if (months.length === 0) return [] as string[];

  const sorted = [...months].sort((left, right) => left.localeCompare(right));
  const [startYear, startMonth] = sorted[0].split("-").map(Number);
  const [endYear, endMonth] = sorted[sorted.length - 1].split("-").map(Number);
  const cursor = new Date(startYear, (startMonth || 1) - 1, 1);
  const limit = new Date(endYear, (endMonth || 1) - 1, 1);
  const range: string[] = [];

  while (cursor <= limit) {
    range.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return range;
}

function truncateText(text: string, limit = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1)}...`;
}

function getRootSolvedTone(value: string) {
  if (value === "是") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (value === "否") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

function wrapCellText(text: string, lineLength: number) {
  const normalized = (text || "-").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n").flatMap((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return ["-"];

    const chunks: string[] = [];
    for (let index = 0; index < trimmed.length; index += lineLength) {
      chunks.push(trimmed.slice(index, index + lineLength));
    }
    return chunks;
  });

  return parts.join("<br>");
}

function createEmptyPayloadMap(): SourcePayloadMap {
  return {
    complaint: null,
    inspection: null,
    outsourcing: null,
  };
}

function createEmptyErrorMap(): SourceErrorMap {
  return {
    complaint: "",
    inspection: "",
    outsourcing: "",
  };
}

function createEmptyParsingMap(): SourceParsingMap {
  return {
    complaint: false,
    inspection: false,
    outsourcing: false,
  };
}

function TimelineTooltipContent(props: { active?: boolean; payload?: Array<{ payload?: { label?: string; issueDescription?: string } }> }) {
  const record = props.payload?.[0]?.payload;
  if (!props.active || !record) return null;

  return (
    <div style={TOOLTIP_PANEL_STYLE}>
      <div style={TOOLTIP_LABEL_STYLE}>{record.label ?? "发生时间"}</div>
      <div style={{ color: "#E2E8F0", fontSize: "12px", lineHeight: 1.6, maxWidth: 380 }}>
        {truncateText(record.issueDescription ?? "-", 120)}
      </div>
    </div>
  );
}

export default function ComplaintInsightDashboard() {
  const inputRefs = useRef<Record<SourceKey, HTMLInputElement | null>>({
    complaint: null,
    inspection: null,
    outsourcing: null,
  });
  const trackingTableRef = useRef<HTMLDivElement>(null);
  const [payloads, setPayloads] = useState<SourcePayloadMap>(() => createEmptyPayloadMap());
  const [errors, setErrors] = useState<SourceErrorMap>(() => createEmptyErrorMap());
  const [parsingStates, setParsingStates] = useState<SourceParsingMap>(() => createEmptyParsingMap());
  const [activeSourceKey, setActiveSourceKey] = useState<SourceKey>("complaint");
  const [confirmAction, setConfirmAction] = useState<{ type: "reupload" | "clear"; sourceKey: SourceKey } | null>(null);

  const activePayload = payloads[activeSourceKey];
  const activeError = errors[activeSourceKey];

  const monthlyChartData = useMemo(() => {
    if (!activePayload) return [];

    const monthKeys = buildMonthRange(activePayload.rows.map((row) => row.occurredAt.slice(0, 7)));
    const countByMonth = new Map(activePayload.monthlySeries.map((item) => [item.month, item.count]));
    const completedSeries = monthKeys.map((month) => ({
      month,
      count: countByMonth.get(month) ?? 0,
    }));

    return withRankedBarColor(completedSeries);
  }, [activePayload]);

  const paretoData = useMemo(() => {
    if (!activePayload) return [];
    let running = 0;
    const total = activePayload.categoryBreakdown.reduce((sum, item) => sum + item.count, 0) || 1;
    return withRankedBarColor(activePayload.categoryBreakdown).map((item) => {
      running += item.count;
      return {
        ...item,
        cumulativePercentage: Number(((running / total) * 100).toFixed(2)),
      };
    });
  }, [activePayload]);

  const timelineDotData = useMemo(() => {
    if (!activePayload) return [];

    const laneByMonth = new Map<string, number>();
    return [...activePayload.rows]
      .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
      .map((row) => {
        const monthKey = row.occurredAt.slice(0, 7);
        const lane = (laneByMonth.get(monthKey) ?? 0) + 1;
        laneByMonth.set(monthKey, lane);

        return {
          id: row.id,
          occurredAt: new Date(row.occurredAt).getTime(),
          lane,
          label: formatDate(row.occurredAt),
          issueDescription: row.issueDescription || "未填写问题描述",
        };
      });
  }, [activePayload]);

  const timelineMonthTicks = useMemo(() => {
    if (!activePayload) return [];
    return buildMonthRange(activePayload.rows.map((row) => row.occurredAt.slice(0, 7))).map((month) => {
      const [year, monthNumber] = month.split("-").map(Number);
      return new Date(year, (monthNumber || 1) - 1, 1).getTime();
    });
  }, [activePayload]);

  const timelineGuideLines = useMemo(() => {
    if (timelineMonthTicks.length === 0) return [];

    const guides: number[] = [];
    timelineMonthTicks.forEach((tick, index) => {
      const current = new Date(tick);
      const nextMonthStart =
        index < timelineMonthTicks.length - 1
          ? timelineMonthTicks[index + 1]!
          : new Date(current.getFullYear(), current.getMonth() + 1, 1).getTime();

      guides.push(tick, nextMonthStart);
    });

    return Array.from(new Set(guides)).sort((left, right) => left - right);
  }, [timelineMonthTicks]);

  const timelineMonthBands = useMemo(() => {
    if (timelineMonthTicks.length === 0) return [];

    return timelineMonthTicks.map((tick, index) => {
      const current = new Date(tick);
      const nextMonthStart =
        index < timelineMonthTicks.length - 1
          ? timelineMonthTicks[index + 1]!
          : new Date(current.getFullYear(), current.getMonth() + 1, 1).getTime();

      return {
        x1: tick,
        x2: nextMonthStart,
        fill: index % 2 === 0 ? "rgba(59, 130, 246, 0.055)" : "rgba(148, 163, 184, 0.03)",
      };
    });
  }, [timelineMonthTicks]);

  const timelineMonthCenters = useMemo(
    () =>
      timelineMonthBands.map((band) => ({
        value: band.x1 + (band.x2 - band.x1) / 2,
        label: formatMonthTick(band.x1),
      })),
    [timelineMonthBands]
  );

  const timelineDomain = useMemo(() => {
    if (timelineMonthTicks.length === 0) return ["dataMin", "dataMax"];

    const first = timelineMonthTicks[0]!;
    const last = timelineMonthTicks[timelineMonthTicks.length - 1]!;
    const firstDate = new Date(first);
    const lastDate = new Date(last);
    const paddedStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1).getTime();
    const paddedEnd = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1).getTime();
    return [paddedStart, paddedEnd];
  }, [timelineMonthTicks]);

  const comparisonData = useMemo(
    () =>
      SOURCE_CONFIGS.map((source) => ({
        name: source.shortLabel,
        key: source.key,
        count: payloads[source.key]?.rowCount ?? 0,
        color: source.barColor,
      })),
    [payloads]
  );

  const hasAnyPayload = useMemo(
    () => SOURCE_CONFIGS.some((source) => Boolean(payloads[source.key])),
    [payloads]
  );

  const activeSourceConfig = SOURCE_CONFIGS.find((source) => source.key === activeSourceKey) ?? SOURCE_CONFIGS[0];

  const uploadWorkbookToOss = async (sourceKey: SourceKey, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "complaint-insight");
    formData.append("entityId", sourceKey);
    formData.append("slot", "workbook");

    const response = await fetch("/api/uploads/assets", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error || `OSS 上传失败：HTTP ${response.status}`);
    }

    return (await response.json()) as { url: string };
  };

  const persistSourceState = async (
    sourceKey: SourceKey,
    payload: ComplaintInsightsPayload,
    assetUrl: string
  ) => {
    const response = await fetch(`/api/dashboard/complaint-insight-state/${sourceKey}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceKey,
        sourceFile: payload.sourceFile,
        assetUrl,
        payload,
      }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error || `状态保存失败：HTTP ${response.status}`);
    }
  };

  const deleteUploadedAsset = async (assetUrl: string) => {
    await fetch("/api/uploads/assets", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: assetUrl }),
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (payloads[activeSourceKey]) return;
    const fallback = SOURCE_CONFIGS.find((source) => payloads[source.key])?.key;
    if (fallback) {
      setActiveSourceKey(fallback);
    }
  }, [activeSourceKey, payloads]);

  useEffect(() => {
    let cancelled = false;

    const loadPersistedState = async () => {
      try {
        const response = await fetch("/api/dashboard/complaint-insight-state");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = (await response.json()) as SourceStateResponse;
        if (cancelled) return;

        setPayloads({
          complaint: result.state?.complaint?.payload ?? null,
          inspection: result.state?.inspection?.payload ?? null,
          outsourcing: result.state?.outsourcing?.payload ?? null,
        });
        setErrors(createEmptyErrorMap());
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "状态恢复失败";
        setErrors({
          complaint: message,
          inspection: message,
          outsourcing: message,
        });
      }
    };

    void loadPersistedState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | null = null;

    const renderTrackingTable = async () => {
      if (!trackingTableRef.current || !activePayload?.rows.length) return;

      const Plotly = (await import("plotly.js-dist-min")).default as any;
      if (cancelled) return;

      const rows = activePayload.rows;
      const rowFills = rows.map((_, index) => (index % 2 === 0 ? "#18181B" : "#27272A"));
      const lineColor = "#3F3F46";

      const values = [
        rows.map((row) => wrapCellText(formatDate(row.occurredAt), 12)),
        rows.map((row) => wrapCellText(row.issueDescription || "-", 24)),
        rows.map((row) => wrapCellText(row.causeAnalysis || "-", 26)),
        rows.map((row) => wrapCellText(row.temporaryAction || "-", 22)),
        rows.map((row) => wrapCellText(row.longTermAction || "-", 28)),
        rows.map((row) => wrapCellText(row.rootSolved || "-", 8)),
      ];

      await Plotly.newPlot(
        trackingTableRef.current,
        [
          {
            type: "table",
            columnwidth: [110, 250, 260, 200, 320, 110],
            header: {
              values: ["发生时间", "问题描述", "原因分析", "临时措施", "长期措施", "是否根本解决"],
              align: "left",
              fill: { color: "#1E293B" },
              line: { color: lineColor, width: 1 },
              font: { color: "#F8FAFC", size: 15, family: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" },
              height: 44,
            },
            cells: {
              values,
              align: "left",
              fill: {
                color: [
                  rowFills,
                  rowFills,
                  rowFills,
                  rowFills,
                  rowFills,
                  rowFills,
                ],
              },
              line: { color: lineColor, width: 1 },
              font: { color: "#D4D4D8", size: 13, family: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" },
              height: 78,
            },
          },
        ],
        {
          margin: { l: 0, r: 0, t: 0, b: 0 },
          paper_bgcolor: CHART_BG,
          plot_bgcolor: CHART_BG,
          font: { color: CHART_TEXT },
          height: Math.max(420, rows.length * 78 + 70),
        },
        {
          displayModeBar: false,
          responsive: true,
        }
      );

      resizeHandler = () => {
        if (trackingTableRef.current) {
          Plotly.Plots.resize(trackingTableRef.current);
        }
      };
      window.addEventListener("resize", resizeHandler);
    };

    void renderTrackingTable();

    return () => {
      cancelled = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (trackingTableRef.current) {
        void import("plotly.js-dist-min").then((module) => {
          const Plotly = module.default as any;
          if (trackingTableRef.current) {
            Plotly.purge(trackingTableRef.current);
          }
        });
      }
    };
  }, [activePayload]);

  const handleFiles = async (sourceKey: SourceKey, incoming?: FileList | File[]) => {
    const files = incoming ? Array.from(incoming) : [];
    if (files.length === 0) return;
    const file = files[0];
    if (!file) return;

    setParsingStates((current) => ({ ...current, [sourceKey]: true }));
    setErrors((current) => ({ ...current, [sourceKey]: "" }));
    let uploadedAssetUrl = "";
    try {
      const uploaded = await uploadWorkbookToOss(sourceKey, file);
      uploadedAssetUrl = uploaded.url;
      const parsed = await parseComplaintInsightExcel(file);
      await persistSourceState(sourceKey, parsed, uploaded.url);
      setPayloads((current) => ({ ...current, [sourceKey]: parsed }));
      setActiveSourceKey(sourceKey);
    } catch (loadError) {
      if (uploadedAssetUrl) {
        await deleteUploadedAsset(uploadedAssetUrl);
      }
      setPayloads((current) => ({ ...current, [sourceKey]: null }));
      setErrors((current) => ({
        ...current,
        [sourceKey]: loadError instanceof Error ? loadError.message : "Excel 解析失败",
      }));
    } finally {
      setParsingStates((current) => ({ ...current, [sourceKey]: false }));
    }
  };

  const clearPayload = (sourceKey: SourceKey) => {
    void (async () => {
      try {
        const response = await fetch(`/api/dashboard/complaint-insight-state/${sourceKey}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorPayload?.error || `删除失败：HTTP ${response.status}`);
        }

        setPayloads((current) => ({ ...current, [sourceKey]: null }));
        setErrors((current) => ({ ...current, [sourceKey]: "" }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          [sourceKey]: error instanceof Error ? error.message : "删除失败",
        }));
      }
    })();
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === "reupload") {
      inputRefs.current[confirmAction.sourceKey]?.click();
    }
    if (confirmAction.type === "clear") {
      clearPayload(confirmAction.sourceKey);
    }
    setConfirmAction(null);
  };

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800/70 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-800 text-cyan-200 ring-1 ring-cyan-400/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">宜胜客诉台账看板</h2>
            <p className="text-sm text-slate-500">
              分别上传客诉、客验、委外客诉三类台账，独立查看，并在同一视角下比较整体分布。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {SOURCE_CONFIGS.map((source) => {
          const sourcePayload = payloads[source.key];
          const sourceError = errors[source.key];
          const isParsing = parsingStates[source.key];
          const isActive = activeSourceKey === source.key;

          return (
            <div
              key={source.key}
              className={`rounded-xl border p-4 transition-all ${
                isActive
                  ? "border-cyan-400/35 bg-slate-900 ring-1 ring-cyan-400/20"
                  : "border-slate-800 bg-slate-900/90"
              }`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setActiveSourceKey(source.key)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{source.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{source.hint}</div>
                  </div>
                  <div
                    className="mt-1 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: sourcePayload ? source.barColor : "#475569" }}
                  />
                </div>
              </button>

              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/45 px-3 py-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                  <span className="truncate">
                    {sourcePayload?.sourceFile ?? `未上传${source.shortLabel}台账`}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>记录数</span>
                  <span className="font-semibold text-slate-300">{sourcePayload?.rowCount ?? 0}</span>
                </div>
              </div>

              {sourceError ? (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {sourceError}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800"
                  onClick={() =>
                    sourcePayload
                      ? setConfirmAction({ type: "reupload", sourceKey: source.key })
                      : inputRefs.current[source.key]?.click()
                  }
                  disabled={isParsing}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {sourcePayload ? "重新上传" : "上传"}
                </Button>
                {sourcePayload ? (
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800"
                    onClick={() => setConfirmAction({ type: "clear", sourceKey: source.key })}
                    disabled={isParsing}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    清空
                  </Button>
                ) : null}
              </div>

              {isParsing ? (
                <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-400">
                  Parsing workbook...
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-200">整体客诉分布</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} strokeOpacity={0.32} horizontal />
              <XAxis
                type="number"
                tick={{ fill: CHART_MUTED, fontSize: 11 }}
                axisLine={{ stroke: CHART_GRID }}
                tickLine={{ stroke: CHART_GRID }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: CHART_TEXT, fontSize: 12, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                formatter={(value: number) => [`${value} 条`, "记录数"]}
                contentStyle={TOOLTIP_PANEL_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
              />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {comparisonData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  offset={8}
                  fill={CHART_TEXT}
                  fontSize={12}
                  fontWeight={700}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!hasAnyPayload ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
          <div className="text-sm font-medium text-slate-200">先上传任一数据源开始分析</div>
          <p className="mt-2 text-sm text-slate-500">
            上面 3 个来源各自独立上传，上传后会自动进入对应视图，并同步参与整体分布比较。
          </p>
        </div>
      ) : null}

      <CyberConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.type === "reupload" ? "确认重新上传" : "确认清空当前数据"}
        message={
          confirmAction?.type === "reupload"
            ? "重新上传会用新的 Excel 解析结果覆盖当前看板内容。\n请确认已经准备好新的源表后再继续。"
            : "确定要清空当前已解析的客诉看板数据吗？\n清空后当前视图会回到未上传状态，此操作不可撤销。"
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
        confirmText={confirmAction?.type === "reupload" ? "确认重新上传" : "确认清空"}
      />


      {activeError ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{activeSourceConfig.label} 加载失败：{activeError}</span>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="text-sm font-bold text-white">{activeSourceConfig.label}</div>
          <div className="h-4 w-px bg-slate-600" />
          <div className="text-sm font-semibold text-slate-200">月份频次</div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/25 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Monthly Frequency</div>
            <div className="h-80">
              {activePayload ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlyChartData}
                    margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} strokeOpacity={0.42} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: CHART_TEXT, fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={{ stroke: CHART_GRID }}
                    />
                    <YAxis
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={{ stroke: CHART_GRID }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: number, name) => [`${value} 次`, name]}
                      contentStyle={TOOLTIP_PANEL_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                    />
                    <Bar
                      dataKey="count"
                      name="异常次数"
                      fill={TECH_BLUE}
                      stroke="rgba(248, 250, 252, 0.08)"
                      radius={[8, 8, 0, 0]}
                    >
                      {monthlyChartData.map((entry) => (
                        <Cell key={entry.month} fill={entry.barColor} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        offset={10}
                        fill={CHART_TEXT}
                        fontSize={12}
                        fontWeight={700}
                      />
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="趋势"
                      stroke={AMBER_LINE}
                      strokeWidth={3}
                      dot={{ r: 4.5, fill: AMBER_LINE, stroke: CHART_TEXT, strokeWidth: 1.2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/70 bg-slate-950/25 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Event Timeline</div>
            <div className="h-80">
              {activePayload ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 24, left: 32, bottom: 8 }}>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke={CHART_GRID}
                      strokeOpacity={0.14}
                      vertical={false}
                    />
                    <XAxis
                      type="number"
                      dataKey="occurredAt"
                      domain={timelineDomain}
                      ticks={timelineMonthTicks}
                      interval={0}
                      tickFormatter={(value: number) => formatMonthTick(value)}
                      tick={false}
                      tickMargin={10}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={false}
                      padding={{ left: 10, right: 10 }}
                    />
                    <XAxis
                      xAxisId="top"
                      type="number"
                      dataKey="occurredAt"
                      orientation="top"
                      domain={timelineDomain}
                      ticks={timelineMonthCenters.map((item) => item.value)}
                      tickFormatter={(value: number) =>
                        timelineMonthCenters.find((item) => item.value === value)?.label ?? ""
                      }
                      tick={{ fill: CHART_TEXT, fontSize: 12, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                      height={26}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis type="number" dataKey="lane" hide domain={[0, "dataMax + 1"]} />
                    {timelineMonthBands.map((band, index) => (
                      <ReferenceArea
                        key={`band-${index}`}
                        x1={band.x1}
                        x2={band.x2}
                        y1={0}
                        y2={999}
                        ifOverflow="extendDomain"
                        fill={band.fill}
                        fillOpacity={1}
                        strokeOpacity={0}
                      />
                    ))}
                    {timelineGuideLines.map((value, index) => (
                      <ReferenceLine
                        key={`${value}-${index}`}
                        x={value}
                        stroke={CHART_GRID}
                        strokeDasharray="4 5"
                        strokeOpacity={0.62}
                        strokeWidth={1.2}
                      />
                    ))}
                    <Tooltip
                      cursor={{ stroke: CHART_GRID, strokeWidth: 1 }}
                      content={<TimelineTooltipContent />}
                    />
                    <Scatter data={timelineDotData} fill={TECH_BLUE}>
                      {timelineDotData.map((entry, index) => (
                        <Cell
                          key={`${entry.id}-${index}`}
                          fill={index === timelineDotData.length - 1 ? ALERT_RED : TECH_BLUE}
                          stroke={CHART_TEXT}
                          strokeOpacity={0.24}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="text-sm font-bold text-white">{activeSourceConfig.label}</div>
          <div className="h-4 w-px bg-slate-600" />
          <div className="text-sm font-semibold text-slate-200">原因分布</div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Donut</div>
            <div className="h-80">
              {activePayload ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activePayload.categoryBreakdown}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={82}
                      outerRadius={110}
                      paddingAngle={3}
                      stroke={CHART_TEXT}
                      strokeWidth={1.4}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {activePayload.categoryBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={getCauseColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _name, item) => {
                        const percentage =
                          (item?.payload as ComplaintCategoryBreakdown | undefined)?.percentage ?? 0;
                        return [`${value} 次 / ${percentage}%`, "原因类别"];
                      }}
                      contentStyle={TOOLTIP_PANEL_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/70 bg-slate-950/30 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Pareto</div>
            <div className="h-80">
              {activePayload ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData} margin={{ top: 12, right: 18, left: 0, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={CHART_GRID} strokeOpacity={0.42} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: CHART_TEXT, fontSize: 12, fontWeight: 700 }}
                      angle={0}
                      textAnchor="middle"
                      height={40}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={{ stroke: CHART_GRID }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      allowDecimals={false}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={{ stroke: CHART_GRID }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: CHART_MUTED, fontSize: 11 }}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      axisLine={{ stroke: CHART_GRID }}
                      tickLine={{ stroke: CHART_GRID }}
                    />
                    <Tooltip
                      formatter={(value: number, name) =>
                        name === "累计占比" ? [`${value}%`, name] : [`${value} 次`, name]
                      }
                      contentStyle={TOOLTIP_PANEL_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      name="次数"
                      fill={SLATE_BAR}
                      stroke="rgba(248, 250, 252, 0.08)"
                      radius={[8, 8, 0, 0]}
                    >
                      {paretoData.map((entry) => (
                        <Cell key={entry.name} fill={entry.barColor} />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="top"
                        offset={8}
                        fill={CHART_TEXT}
                        fontSize={12}
                        fontWeight={700}
                      />
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativePercentage"
                      name="累计占比"
                      stroke={AMBER_LINE}
                      strokeWidth={3}
                      dot={{ r: 4, fill: AMBER_LINE, stroke: CHART_TEXT, strokeWidth: 1 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Monthly Frequency Data</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-right">次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyChartData.map((item) => (
                  <TableRow key={item.month}>
                    <TableCell>{item.month}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border border-slate-800/70 bg-slate-950/20 p-4">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Pareto Data</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>原因类别</TableHead>
                  <TableHead className="text-right">次数</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                  <TableHead className="text-right">累计占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paretoData.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
                    <TableCell className="text-right">{item.cumulativePercentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-200">事件详细记录</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="border-r border-slate-700/70 pr-4">发生时间</TableHead>
              <TableHead className="border-r border-slate-700/70 px-4">问题描述</TableHead>
              <TableHead className="border-r border-slate-700/70 px-4">原因分析</TableHead>
              <TableHead className="border-r border-slate-700/70 px-4">临时措施</TableHead>
              <TableHead className="border-r border-slate-700/70 px-4">长期措施</TableHead>
              <TableHead className="pl-4">是否根本解决</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activePayload?.rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={`border-b border-[#E8DFC9]/12 ${
                  index % 2 === 0 ? "bg-white/[0.035]" : "bg-white/[0.015]"
                }`}
              >
                <TableCell className="whitespace-nowrap border-r border-slate-800/80 pr-4">
                  {formatDate(row.occurredAt)}
                </TableCell>
                <TableCell className="max-w-[260px] whitespace-normal border-r border-slate-800/80 px-4 text-slate-200">
                  {row.issueDescription || "-"}
                </TableCell>
                <TableCell className="max-w-[300px] whitespace-normal border-r border-slate-800/80 px-4 text-slate-300">
                  {row.causeAnalysis || "-"}
                </TableCell>
                <TableCell className="max-w-[220px] whitespace-normal border-r border-slate-800/80 px-4 text-slate-300">
                  {row.temporaryAction || "-"}
                </TableCell>
                <TableCell className="max-w-[320px] whitespace-normal border-r border-slate-800/80 px-4 text-slate-300">
                  {row.longTermAction || "-"}
                </TableCell>
                <TableCell className="whitespace-nowrap pl-4 text-slate-200">
                  {row.rootSolved || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {activePayload ? (
        <div className="text-xs text-slate-500">
          当前视图：{activeSourceConfig.label} | 解析时间：{formatDateTime(activePayload.lastUpdated)} | 当前文件：{activePayload.sourceFile}
        </div>
      ) : null}

      {SOURCE_CONFIGS.map((source) => (
        <input
          key={source.key}
          ref={(node) => {
            inputRefs.current[source.key] = node;
          }}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            void handleFiles(source.key, event.target.files ?? undefined);
            event.target.value = "";
          }}
        />
      ))}
    </section>
  );
}
