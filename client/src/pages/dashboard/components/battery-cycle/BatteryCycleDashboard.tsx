import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  buildBatteryCycleModuleSummary,
  type LaboratoryModuleSummary,
} from "../laboratory/laboratory-contract";
import {
  loadBatteryDataset,
  parseBatteryDatasetFromArrayBuffer,
  type BatteryDataset,
  type BatteryParseSummary,
  type CycleStat,
} from "./battery-data";
import { buildBatteryAuditReportHtml, makeBatteryReportFileName } from "./battery-report";
import {
  BATTERY_RULES,
  evaluateBatteryRules,
  type BatteryAdjudication,
  type BatteryRuleLevel,
  type BatteryRuleResult,
} from "./battery-rules";
import { HealthTrendStrip } from "./health-trend-strip";
import { KpiRow } from "./kpi-row";
import { MacroChart } from "./macro-chart";
import { MicroChart } from "./micro-chart";
import { StatsGrid } from "./stats-grid";

import "./battery-dashboard.css";

type BatteryCycleDashboardProps = {
  nodeId?: number;
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void;
  initialSummary?: LaboratoryModuleSummary;
};

const glassCard = "rounded-lg border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl";

function formatRange(min: number, max: number, unit: string) {
  return `${min.toLocaleString()} - ${max.toLocaleString()} ${unit}`;
}

function CompactMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
      <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-[#E8B84B]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function SheetChip({ sheet }: { sheet: BatteryParseSummary["sheets"][number] }) {
  const isEmpty = sheet.status === "empty";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-200">{sheet.name}</span>
        <span className={`font-mono text-[10px] ${isEmpty ? "text-slate-600" : "text-[#E8B84B]"}`}>
          {isEmpty ? "空表" : `${sheet.rowCount} 行`}
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-slate-600">
        {sheet.columnCount > 0 ? `${sheet.columnCount} 列 · ${sheet.ref}` : sheet.ref}
      </p>
    </div>
  );
}

function ParseOverview({ summary }: { summary: BatteryParseSummary }) {
  const topEvents = summary.logs.eventTypes.slice(0, 3);
  const flowLabel = summary.flow.steps.map((step) => step.step).filter(Boolean).join(" / ");

  return (
    <section className={glassCard} aria-label="Excel五页解析概览">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.05] pb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">XLSX 五页解析器</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-100">EL2600 电池循环1# 解析概览</h2>
          <p className="mt-1 text-sm text-slate-500">{summary.sourceFile}</p>
        </div>
        <div className="rounded-lg border border-[#E8B84B]/20 bg-[#E8B84B]/10 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-[#E8B84B]">
          已接入 {summary.sheets.length} 个工作表
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {summary.sheets.map((sheet) => (
          <SheetChip key={sheet.name} sheet={sheet} />
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <CompactMetric
          label="测试数据"
          value={`${summary.testData.sampleCount.toLocaleString()} 个采样点`}
          note={`${summary.testData.cycleCount} cycles · ${summary.testData.startTime} 至 ${summary.testData.endTime}`}
        />
        <CompactMetric
          label="电压 / 电流"
          value={formatRange(summary.testData.voltageMin, summary.testData.voltageMax, "V")}
          note={`电流 ${formatRange(summary.testData.currentMin, summary.testData.currentMax, "A")}`}
        />
        <CompactMetric
          label="循环统计"
          value={`${summary.cycleStats.firstCycle} - ${summary.cycleStats.lastCycle}`}
          note={`平均效率 ${summary.cycleStats.avgEfficiency}% · 最大 DCIR ${summary.cycleStats.maxIr} mΩ`}
        />
        <CompactMetric
          label="运行日志"
          value={`${summary.logs.rowCount} 条事件`}
          note={`${summary.logs.firstEventTime} 至 ${summary.logs.lastEventTime}`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">流程工步</p>
          <p className="mt-2 text-sm text-slate-300">{flowLabel || "-"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.flow.steps.map((step, index) => (
              <span
                key={`${step.step}-${index}`}
                className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-slate-400"
              >
                {index + 1}. {step.step}
                {step.currentOrPower != null ? ` · ${step.currentOrPower}A/W` : ""}
                {step.voltageLimit != null ? ` · ${step.voltageLimit}V` : ""}
                {step.timeLimit ? ` · ${step.timeLimit}` : ""}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">事件分布</p>
          <div className="mt-3 space-y-2">
            {topEvents.map((event) => (
              <div key={event.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-400">{event.label}</span>
                <span className="font-mono text-[#E8B84B]">{event.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatProtocolNumber(value: number | null, digits = 1) {
  return value == null ? "-" : value.toFixed(digits);
}

function formatRestMinutes(value: string | null) {
  if (!value) return "-";
  const match = value.match(/(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/);
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const totalMinutes = Math.round(hours * 60 + minutes + seconds / 60);
  return `${totalMinutes} 分钟`;
}

function ProtocolMetaBar({ summary }: { summary: BatteryParseSummary }) {
  const charge = summary.flow.steps.find((step) => step.step.includes("充电"));
  const discharge = summary.flow.steps.find((step) => step.step.includes("放电"));
  const rest = summary.flow.steps.find((step) => step.step.includes("静置"));

  return (
    <section className="rounded-lg border border-white/5 bg-black/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
        <span className="tracking-[0.18em] text-cyan-300">// 测试协议边界</span>
        <span>
          充电：CC-CV {formatProtocolNumber(charge?.currentOrPower ?? null)}A 至{" "}
          {formatProtocolNumber(charge?.constantVoltage ?? charge?.voltageLimit ?? null)}V（截止：{" "}
          {formatProtocolNumber(charge?.currentLimit ?? null, 2)}A)
        </span>
        <span className="text-slate-700">|</span>
        <span>
          放电：CC {formatProtocolNumber(discharge?.currentOrPower ?? null)}A 至{" "}
          {formatProtocolNumber(discharge?.voltageLimit ?? null)}V
        </span>
        <span className="text-slate-700">|</span>
        <span>静置：{formatRestMinutes(rest?.timeLimit ?? null)}</span>
      </div>
    </section>
  );
}

function TemplateQualityBadge({ summary }: { summary: BatteryParseSummary }) {
  const quality = summary.validation.quality;
  const fingerprint = summary.validation.templateFingerprint;
  const tone =
    fingerprint.compatibility === "模板不兼容"
      ? "border-[#FF3C5C]/25 bg-[#FF3C5C]/10 text-[#FF9AAA]"
      : fingerprint.compatibility === "模板偏移"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : quality.grade === "A"
      ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
      : quality.grade === "B"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : "border-[#FF3C5C]/25 bg-[#FF3C5C]/10 text-[#FF9AAA]";

  return (
    <div
      className={`rounded-md border px-3 py-2 font-mono text-[10px] ${tone}`}
      title={[fingerprint.version, fingerprint.compatibility, ...fingerprint.reasons, ...quality.issues].join("\n")}
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{fingerprint.compatibility}</span>
        <span className="text-sm font-semibold">{quality.grade}</span>
        <span>{quality.score}</span>
      </div>
      <div className="mt-0.5 text-slate-500">
        必需列 {fingerprint.matchedRequiredColumnCount}/{fingerprint.requiredColumnCount}
      </div>
    </div>
  );
}

function RuleDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/25 p-3">
      <p className="font-mono text-[10px] tracking-[0.18em] text-slate-600">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{value || "-"}</p>
    </div>
  );
}

function CycleEvidenceCard({ cycle }: { cycle: CycleStat }) {
  return (
    <div className="rounded-md border border-cyan-300/10 bg-cyan-300/[0.035] p-3 font-mono text-[10px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="tracking-[0.16em] text-cyan-300">循环 {cycle.cycle} 证据链</span>
        <span className={cycle.retention < 95 ? "text-[#FF3C5C]" : "text-slate-500"}>SOH {cycle.retention.toFixed(1)}%</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400">
        <span>放电容量 {cycle.dischargeCap.toFixed(4)} Ah</span>
        <span>效率 {cycle.efficiency.toFixed(2)}%</span>
        <span>DCIR {cycle.ir.toFixed(2)} mΩ</span>
        <span>中值电压 {cycle.medianV.toFixed(3)} V</span>
      </div>
    </div>
  );
}

function RuleDetailSheet({
  rule,
  dataset,
  open,
  onOpenChange,
  onCycleSelect,
}: {
  rule: BatteryRuleResult | null;
  dataset: BatteryDataset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCycleSelect: (cycle: number) => void;
}) {
  const ruleTone: Record<BatteryRuleLevel, string> = {
    Pass: "text-cyan-200",
    Watch: "text-amber-200",
    Fail: "text-[#FF3C5C]",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[460px] max-w-[92vw] border-l border-cyan-300/15 bg-[#020617]/95 text-slate-200 backdrop-blur-xl sm:max-w-[460px]"
      >
        <SheetHeader className="border-b border-white/[0.06] p-5">
          <SheetTitle className="font-mono text-sm tracking-[0.18em] text-cyan-300">
            // 规则详情抽屉
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            展示该项判定的来源、阻断级别、阈值依据和触发循环。
          </SheetDescription>
        </SheetHeader>

        {rule ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6 scrollbar-soft">
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.18em] text-slate-600">{rule.id}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-100">{rule.name}</h3>
                </div>
                <span className={`rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-xs ${ruleTone[rule.level]}`}>
                  {rule.level}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px]">
                <span className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.05] px-2 py-1 text-cyan-200">
                  来源：{rule.sourceType}
                </span>
                <span className="rounded-md border border-amber-300/15 bg-amber-300/[0.05] px-2 py-1 text-amber-200">
                  级别：{rule.blockLevel}
                </span>
              </div>
            </div>

            <RuleDetailItem label="当前指标" value={rule.metric} />
            <RuleDetailItem label="数据来源" value={rule.source} />
            <RuleDetailItem label="判定依据" value={rule.basis} />
            <div className="rounded-md border border-white/[0.06] bg-black/25 p-3">
              <p className="font-mono text-[10px] tracking-[0.18em] text-slate-600">触发循环</p>
              {rule.triggerCycles.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rule.triggerCycles.map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => {
                        onCycleSelect(cycle);
                        onOpenChange(false);
                      }}
                      className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 font-mono text-[10px] text-cyan-200 transition-colors hover:bg-cyan-300/15"
                    >
                      循环 {cycle}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm leading-relaxed text-slate-300">未触发具体循环</p>
              )}
              {rule.triggerCycles.length ? (
                <div className="mt-3 space-y-2">
                  {rule.triggerCycles
                    .map((cycle) => dataset.cycleStats.find((row) => row.cycle === cycle))
                    .filter((cycle): cycle is CycleStat => Boolean(cycle))
                    .map((cycle) => (
                      <CycleEvidenceCard key={cycle.cycle} cycle={cycle} />
                    ))}
                </div>
              ) : null}
            </div>
            <RuleDetailItem label="处置建议" value={rule.level === "Pass" ? "无需额外处置，保留该项作为追溯记录。" : rule.failAction} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SystemAdjudicationEngine({
  dataset,
  adjudication,
  onCycleSelect,
}: {
  dataset: BatteryDataset;
  adjudication: BatteryAdjudication;
  onCycleSelect: (cycle: number) => void;
}) {
  const [selectedRule, setSelectedRule] = useState<BatteryRuleResult | null>(null);
  const ruleTone: Record<BatteryRuleLevel, string> = {
    Pass: "text-cyan-200",
    Watch: "text-amber-200",
    Fail: "text-[#FF3C5C]",
  };
  const nonPassRules = adjudication.rules.filter((rule) => rule.level !== "Pass");
  const visibleNonPassRules = nonPassRules.slice(0, 3);
  const lastCycle = dataset.cycleStats[dataset.cycleStats.length - 1] ?? null;
  const sourceConclusion = adjudication.statusText.replace(/^\[\s*|\s*\]$/g, "");
  const labMetrics = [
    { label: "循环覆盖", value: `${dataset.meta.cycleCount}/${dataset.meta.targetCycles}` },
    { label: "最终 SOH", value: `${dataset.meta.retention.toFixed(2)}%` },
    { label: "最大 DCIR", value: `${dataset.meta.maxIr.toFixed(2)} mΩ` },
    { label: "中值电压", value: lastCycle ? `${lastCycle.medianV.toFixed(3)} V` : "--" },
    { label: "平均效率", value: `${dataset.parseSummary.cycleStats.avgEfficiency.toFixed(2)}%` },
    {
      label: "模板质量",
      value: `${dataset.parseSummary.validation.quality.grade} / ${dataset.parseSummary.validation.quality.score}`,
    },
  ];

  return (
    <>
      <section className={`${glassCard} col-span-4 flex h-full min-h-0 flex-col overflow-hidden p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-[10px] tracking-[0.18em] text-slate-400">
              {"// 实验室报告映射"}
            </h2>
            <p className="mt-1 text-[10px] text-slate-600">仅映射报告数据与判定结论</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
            <span className="text-cyan-200">P {adjudication.counts.Pass}</span>
            <span className="text-amber-200">W {adjudication.counts.Watch}</span>
            <span className="text-[#FF3C5C]">F {adjudication.counts.Fail}</span>
          </div>
        </div>

        <div className="mt-3 shrink-0 rounded-lg border border-white/[0.06] bg-black/25 p-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-slate-500">实验室判定结论</p>
          <p className={`mt-2 text-sm font-semibold leading-relaxed ${ruleTone[adjudication.overallLevel]}`}>
            {sourceConclusion}
          </p>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2 scrollbar-soft">
          <div className="grid grid-cols-2 gap-2">
            {labMetrics.map((metric) => (
              <div key={metric.label} className="rounded-md border border-white/[0.05] bg-white/[0.025] px-3 py-2">
                <p className="font-mono text-[9px] tracking-[0.14em] text-slate-600">{metric.label}</p>
                <p className="mt-1 font-mono text-[12px] text-slate-200">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.16em] text-slate-500">关注项</p>
              {nonPassRules.length > visibleNonPassRules.length ? (
                <span className="font-mono text-[9px] text-slate-600">+{nonPassRules.length - visibleNonPassRules.length}</span>
              ) : null}
            </div>
            <div className="mt-2 space-y-1.5">
              {visibleNonPassRules.length ? (
                visibleNonPassRules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setSelectedRule(rule)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_52px] items-center gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5 text-left transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"
                    title="查看该项来源和原始指标"
                  >
                    <span className="truncate text-[11px] text-slate-300">{rule.name}</span>
                    <span className={`font-mono text-[10px] ${ruleTone[rule.level]}`}>{rule.level}</span>
                    <span className="col-span-2 truncate font-mono text-[9px] text-slate-600">{rule.metric}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500">无 Watch / Fail 关注项。</p>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-2.5">
            <p className="font-mono text-[9px] tracking-[0.16em] text-amber-200">系统补充（非实验室结论）</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {nonPassRules.length
                ? `仅列出 ${nonPassRules.length} 项阈值映射关注项，供追溯原始数据使用，不替代实验室判定。`
                : "未追加系统关注项；以实验室判定结论为准。"}
            </p>
          </div>
        </div>
      </section>
      <RuleDetailSheet
        rule={selectedRule}
        dataset={dataset}
        open={selectedRule != null}
        onOpenChange={(open) => {
          if (!open) setSelectedRule(null);
        }}
        onCycleSelect={onCycleSelect}
      />
    </>
  );
}

function BatteryDashboardContent({
  dataset,
  isParsingUpload,
  onUploadClick,
}: {
  dataset: BatteryDataset;
  isParsingUpload: boolean;
  onUploadClick: () => void;
}) {
  const cycles = useMemo(
    () => [...new Set(dataset.timeSeries.map((p) => p.cycle))].sort((a, b) => a - b),
    [dataset.timeSeries],
  );
  const [selectedCycle, setSelectedCycle] = useState(cycles[0] ?? 1);

  useEffect(() => {
    if (cycles.length > 0 && !cycles.includes(selectedCycle)) {
      setSelectedCycle(cycles[0]);
    }
  }, [cycles, selectedCycle]);

  const handleCycleSelect = (cycle: number) => {
    if (cycles.includes(cycle)) setSelectedCycle(cycle);
  };

  const cycleData = useMemo(
    () => dataset.timeSeries.filter((p) => p.cycle === selectedCycle),
    [dataset.timeSeries, selectedCycle],
  );
  const adjudication = useMemo(() => evaluateBatteryRules(dataset), [dataset]);
  const handleExportReport = () => {
    const html = buildBatteryAuditReportHtml(dataset, adjudication);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeBatteryReportFileName(dataset);
    link.click();
    URL.revokeObjectURL(url);
    toast.success("审计报告已生成");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] pb-4">
        <h1 className="font-mono text-sm font-medium tracking-[0.2em] text-cyan-300 lg:text-base">
          [ {dataset.meta.deviceLabel} // 解析引擎运行中 ]
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <TemplateQualityBadge summary={dataset.parseSummary} />
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-slate-500">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
              aria-hidden="true"
            />
            XLSX 已接入 · {dataset.meta.sampleCount.toLocaleString()} 个采样点 · {dataset.meta.cycleCount} 次循环
          </div>
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isParsingUpload}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-cyan-300 transition-colors hover:border-cyan-300/50 hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
          >
            {isParsingUpload ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {isParsingUpload ? "解析中" : "上传 Excel 解析"}
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-2 rounded-md border border-[#E8B84B]/25 bg-[#E8B84B]/10 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-[#E8B84B] transition-colors hover:border-[#E8B84B]/50 hover:bg-[#E8B84B]/15"
          >
            <FileDown className="h-3.5 w-3.5" />
            导出审计报告
          </button>
        </div>
      </header>

      <ProtocolMetaBar summary={dataset.parseSummary} />

      <KpiRow meta={dataset.meta} />

      <div className="mb-6 grid h-[400px] grid-cols-12 gap-6">
        <section className={`${glassCard} col-span-8 h-full overflow-hidden p-4`} aria-label="单循环电压电流曲线">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-mono text-xs tracking-[0.2em] text-slate-400">
              {"// 微观遥测：电压 / 电流曲线（单循环）"}
            </h2>
            <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="选择循环">
              {cycles.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={c === selectedCycle}
                  onClick={() => setSelectedCycle(c)}
                  className={`rounded-md px-2 py-1 font-mono text-[10px] transition-colors ${
                    c === selectedCycle
                      ? "bg-[#E8B84B]/12 text-[#E8B84B] shadow-[0_0_12px_rgba(232,184,75,0.25)]"
                      : "text-slate-600 hover:text-slate-400"
                  }`}
                >
                  {String(c).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          <MicroChart data={cycleData} />
          <div className="mt-3 flex gap-6 font-mono text-[10px] text-slate-500">
            <span className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 bg-cyan-300" aria-hidden="true" />
              电压 (V)
            </span>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-0.5 w-5"
                style={{
                  backgroundImage: "linear-gradient(90deg, #475569 60%, transparent 60%)",
                  backgroundSize: "6px 100%",
                }}
                aria-hidden="true"
              />
              电流 (A)
            </span>
          </div>
        </section>

        <section className={`${glassCard} col-span-4 h-full overflow-hidden p-4`} aria-label="容量衰减趋势">
          <h2 className="mb-4 font-mono text-xs tracking-[0.2em] text-slate-400">
            {"// 宏观衰减：容量保持率（SOH）"}
          </h2>
          <MacroChart
            data={dataset.cycleStats}
            initialCap={dataset.meta.initialCap}
            highlights={adjudication.cycleHighlights}
            activeCycle={selectedCycle}
          />
        </section>
      </div>

      <div className="grid min-h-[360px] grid-cols-12 gap-6">
        <SystemAdjudicationEngine dataset={dataset} adjudication={adjudication} onCycleSelect={handleCycleSelect} />
        <section className={`${glassCard} col-span-8 flex h-full min-h-0 flex-col overflow-hidden p-4`} aria-label="循环统计矩阵">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <h2 className="font-mono text-[10px] tracking-[0.18em] text-slate-400">
              {"// 压缩循环矩阵"}
            </h2>
            <span className="font-mono text-[10px] text-slate-600">DCIR + 中值电压趋势联动</span>
          </div>
          <HealthTrendStrip data={dataset.cycleStats} />
          <div className="mt-3 min-h-0 flex-1">
            <StatsGrid
              data={dataset.cycleStats}
              highlights={adjudication.cycleHighlights}
              activeCycle={selectedCycle}
              onCycleSelect={handleCycleSelect}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function BatteryCycleDashboard({
  nodeId,
  onSummaryChange,
  initialSummary,
}: BatteryCycleDashboardProps = {}) {
  const archivedDataset = (initialSummary?.moduleData as { dataset?: BatteryDataset } | undefined)?.dataset ?? null;
  const [dataset, setDataset] = useState<BatteryDataset | null>(() => archivedDataset);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!nodeId || !onSummaryChange) return;
    if (!dataset) {
      onSummaryChange(null);
      return;
    }

    const adjudication = evaluateBatteryRules(dataset);
    const lastCycle = dataset.cycleStats[dataset.cycleStats.length - 1] ?? null;
    const failedRuleNames = adjudication.rules.filter((rule) => rule.level === "Fail").map((rule) => rule.name);
    const watchRuleNames = adjudication.rules.filter((rule) => rule.level === "Watch").map((rule) => rule.name);

    onSummaryChange({
      ...buildBatteryCycleModuleSummary(nodeId, {
        sourceFile: dataset.parseSummary.sourceFile,
        deviceLabel: dataset.meta.deviceLabel,
        overallLevel: adjudication.overallLevel,
        statusText: adjudication.statusText,
        cycleCount: dataset.meta.cycleCount,
        targetCycles: dataset.meta.targetCycles,
        sampleCount: dataset.meta.sampleCount,
        initialCap: dataset.meta.initialCap,
        retention: dataset.meta.retention,
        maxIr: dataset.meta.maxIr,
        finalMedianVoltage: lastCycle?.medianV ?? 0,
        avgEfficiency: dataset.parseSummary.cycleStats.avgEfficiency,
        templateGrade: dataset.parseSummary.validation.quality.grade,
        templateScore: dataset.parseSummary.validation.quality.score,
        failedRuleNames,
        watchRuleNames,
      }),
      moduleData: { dataset },
    });
  }, [dataset, nodeId, onSummaryChange]);

  useEffect(() => {
    let cancelled = false;

    if (archivedDataset) return;

    loadBatteryDataset()
      .then((nextDataset) => {
        if (!cancelled) setDataset(nextDataset);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "电池充放电数据加载失败";
        if (!cancelled) {
          setLoadError(message);
          toast.error(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialSummary]);

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("请上传 Excel 文件（.xlsx / .xls）");
      return;
    }

    setIsParsingUpload(true);
    try {
      const nextDataset = parseBatteryDatasetFromArrayBuffer(await file.arrayBuffer(), file.name);
      setDataset(nextDataset);
      setLoadError(null);
      toast.success(`已解析：${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel 解析失败";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsParsingUpload(false);
    }
  };

  return (
    <main className="battery-cycle-dashboard app-bg min-h-screen px-4 py-6 text-foreground lg:px-8 lg:py-8">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleUploadChange}
      />

      {!dataset && !loadError ? (
        <div className="mx-auto flex min-h-[480px] w-full max-w-[1600px] items-center justify-center">
          <div className="glass-panel flex items-center gap-3 px-6 py-4 font-mono text-xs tracking-[0.18em] text-cyan-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载 XLSX 数据集
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="mx-auto flex min-h-[480px] w-full max-w-[1600px] items-center justify-center">
          <div className="glass-panel max-w-xl p-6">
            <p className="font-mono text-xs tracking-[0.18em] text-[#FF3C5C]">电池数据集加载失败</p>
            <p className="mt-3 text-sm text-slate-300">{loadError}</p>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isParsingUpload}
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-cyan-300 transition-colors hover:border-cyan-300/50 hover:bg-cyan-300/15 disabled:cursor-wait disabled:opacity-60"
            >
              {isParsingUpload ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {isParsingUpload ? "解析中" : "上传 Excel 解析"}
            </button>
          </div>
        </div>
      ) : null}

      {dataset ? (
        <BatteryDashboardContent
          key={`${dataset.parseSummary.sourceFile}-${dataset.meta.sampleCount}-${dataset.meta.cycleCount}`}
          dataset={dataset}
          isParsingUpload={isParsingUpload}
          onUploadClick={handleUploadClick}
        />
      ) : null}
    </main>
  );
}
