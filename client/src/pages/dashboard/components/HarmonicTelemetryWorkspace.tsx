import { useMemo, useState } from "react";
import { Activity, FileText, Loader2, Radio, Upload, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  buildAlphaMetrics,
  buildHarmonicSpectrum,
  buildHarmonicWaveform,
  buildMarginAudit,
  buildReportInsights,
  buildSecondaryStats,
  buildStructuralAudit,
  evaluateHarmonicEvidence,
  resolveHarmonicVerdict,
  type HarmonicParseResult,
} from "@/pages/dashboard/lib/harmonic-report";
import {
  buildHarmonicModuleSummary,
  type LaboratoryModuleSummary,
} from "./laboratory/laboratory-contract";
import {
  HarmonicAlphaMetricCard,
  HarmonicEvidenceCard,
  HarmonicInsightCard,
  HarmonicMarginAuditCard,
  HarmonicObservationCard,
  HarmonicOperatingAuditCard,
} from "./harmonic/data-panel";
import { HarmonicFftSpectrum } from "./harmonic/fft-spectrum";
import { HarmonicGlassCard } from "./harmonic/glass-card";
import { HarmonicOscilloscope } from "./harmonic/oscilloscope";

type ParseResponse = {
  ok: boolean;
  sourceType: "upload";
  fileName?: string;
  result: HarmonicParseResult;
};

async function parseHarmonicPdf(file: File): Promise<ParseResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/api/dashboard/harmonic-pdf/parse-upload", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.details || payload?.error || "谐波 PDF 解析失败");
  }

  return payload as ParseResponse;
}

function verdictClass(verdict: "PASS" | "FAIL" | "WATCH" | null): string {
  if (verdict === "FAIL") return "border-[#FF3C5C]/35 bg-[#FF3C5C]/10 text-[#FF8FA3]";
  if (verdict === "WATCH") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  if (verdict === "PASS") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  return "border-white/[0.06] bg-white/[0.025] text-slate-400";
}

function HarmonicPhasePanel({ result }: { result: HarmonicParseResult | null }) {
  const phaseRows = result?.phase_checks ?? [];

  return (
    <HarmonicGlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.18em] text-slate-500">Q1-Q6 相位角检查</h2>
        <span className="text-[10px] text-slate-600">PDF明细</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
        <div className="grid grid-cols-[58px_1fr_68px] bg-white/[0.03] px-3 py-2 text-[11px] text-slate-500">
          <span>点位</span>
          <span>测试值 / 限值</span>
          <span className="text-right">结论</span>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {phaseRows.length ? (
            phaseRows.map((check) => (
              <div key={check.checkpoint} className="grid grid-cols-[58px_1fr_68px] items-center gap-2 px-3 py-3 text-xs">
                <span className="font-mono text-sm font-semibold text-slate-100">{check.checkpoint}</span>
                <span className="break-words font-mono text-slate-500">
                  {check.measured_deg.toFixed(2)} deg / {check.limit_expression}
                </span>
                <span className={check.status.toUpperCase() === "FAIL" ? "text-right font-mono text-[#FF3C5C]" : "text-right font-mono text-cyan-200"}>
                  {check.status.toUpperCase()}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-5 text-center text-xs text-slate-500">等待解析</div>
          )}
        </div>
      </div>
    </HarmonicGlassCard>
  );
}

export default function HarmonicTelemetryWorkspace({
  nodeId,
  onSummaryChange,
}: {
  nodeId?: number;
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<HarmonicParseResult | null>(null);

  const waveform = useMemo(() => (result ? buildHarmonicWaveform(result) : []), [result]);
  const spectrum = useMemo(() => (result ? buildHarmonicSpectrum(result) : []), [result]);
  const margins = useMemo(() => (result ? buildMarginAudit(result) : []), [result]);
  const alphaMetrics = useMemo(() => (result ? buildAlphaMetrics(result) : []), [result]);
  const secondaryStats = useMemo(() => (result ? buildSecondaryStats(result) : []), [result]);
  const reportInsights = useMemo(() => (result ? buildReportInsights(result) : []), [result]);
  const structuralAudit = useMemo(() => (result ? buildStructuralAudit(result) : []), [result]);
  const audit = useMemo(() => (result ? evaluateHarmonicEvidence(result) : null), [result]);
  const verdict = useMemo(() => (result ? resolveHarmonicVerdict(result) : null), [result]);

  const publishSummary = (fileName: string, nextResult: HarmonicParseResult) => {
    if (!nodeId || !onSummaryChange) return;
    const nextMargins = buildMarginAudit(nextResult);
    const nextAudit = evaluateHarmonicEvidence(nextResult);

    onSummaryChange(
      buildHarmonicModuleSummary(nodeId, {
        sourceFile: fileName,
        verdict: nextAudit.verdict,
        productName: nextResult.product_name || "--",
        standard: nextResult.standard || "--",
        testDate: nextResult.test_date || "--",
        ithdPercent: nextResult.ithd_percent,
        thcMa: nextResult.thc_ma,
        powerFactor: nextResult.process_metrics.power_factor_avg,
        powerW: nextResult.process_metrics.power_avg_w,
        frequencyHz: nextResult.process_metrics.frequency_avg_hz,
        worstMargin: nextMargins[0]?.margin ?? null,
        failHarmonics: nextAudit.failHarmonics,
        phaseFailCount: nextAudit.phaseFailCount,
        structuralFailCount: nextAudit.structuralFailCount,
        observationCount: nextAudit.observations.filter((item) => item.status === "WATCH").length,
      }),
    );
  };

  const handleUploadParse = async () => {
    if (!selectedFile) {
      toast.error("请先选择谐波 PDF 文件");
      return;
    }

    setIsParsing(true);
    try {
      const payload = await parseHarmonicPdf(selectedFile);
      setResult(payload.result);
      publishSummary(payload.fileName || selectedFile.name, payload.result);
      toast.success("谐波 PDF 解析完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "谐波 PDF 解析失败");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020406] px-4 py-5 text-slate-200 md:px-7">
      <header className="mb-4 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center xl:pr-32">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06]">
            <Zap className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-100">谐波功率分析台</h1>
            <p className="truncate text-xs text-slate-500">
              {result?.product_name || "等待上传实验室PDF"} · {result?.standard || "以实验室报告结论为准"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_auto]">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
            <p className="text-[10px] text-slate-500">频率</p>
            <p className="font-mono text-sm text-slate-100">{result?.process_metrics.frequency_avg_hz?.toFixed(2) ?? "--"} Hz</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
            <p className="text-[10px] text-slate-500">文件</p>
            <p className="max-w-[180px] truncate text-sm text-slate-100">{selectedFile?.name || "--"}</p>
          </div>
          <div className={`rounded-lg border px-4 py-2 ${verdictClass(verdict)}`}>
            <p className="text-[10px] opacity-70">判定结果</p>
            <p className="font-mono text-xl font-black">{verdict ?? "--"}</p>
          </div>
        </div>
      </header>

      <section className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setResult(null);
              onSummaryChange?.(null);
            }}
            className="h-10 border-white/[0.08] bg-black/35 text-white file:text-white"
          />
          <Button onClick={handleUploadParse} disabled={isParsing} className="h-10 min-w-[180px] bg-white text-black hover:bg-white/90">
            {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isParsing ? "解析中..." : "上传谐波 PDF"}
          </Button>
        </div>
      </section>

      <div className="space-y-4">
        {result ? <HarmonicAlphaMetricCard metrics={alphaMetrics} /> : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          {audit ? <HarmonicEvidenceCard audit={audit} /> : null}
          {audit ? <HarmonicObservationCard rows={audit.observations} /> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.85fr]">
          <HarmonicGlassCard>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-200" />
                <h2 className="text-sm font-semibold text-slate-200">谐波限值证据序列</h2>
              </div>
              <span className="text-[11px] text-slate-500">柱：实测值 · 虚线：报告限值</span>
            </div>
            <HarmonicFftSpectrum data={spectrum} />
          </HarmonicGlassCard>

          <HarmonicMarginAuditCard rows={margins} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <HarmonicGlassCard>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-200" />
                <h2 className="text-sm font-semibold text-slate-200">PDF参数重建波形</h2>
              </div>
              <span className="rounded border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-[10px] text-amber-200">
                非原始采样
              </span>
            </div>
            <HarmonicOscilloscope data={waveform} />
          </HarmonicGlassCard>

          <HarmonicPhasePanel result={result} />
        </div>

        {result ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.82fr_1.18fr]">
            <HarmonicOperatingAuditCard stats={secondaryStats} structuralRows={structuralAudit} />
            <HarmonicInsightCard rows={reportInsights} />
          </div>
        ) : (
          <HarmonicGlassCard>
            <div className="flex items-center gap-3 py-8 text-slate-500">
              <FileText className="h-5 w-5" />
              <span className="text-sm">上传谐波 PDF 后，将按实验室报告结论、限值表、Q检查和结构检查生成证据链。</span>
            </div>
          </HarmonicGlassCard>
        )}
      </div>
    </main>
  );
}
