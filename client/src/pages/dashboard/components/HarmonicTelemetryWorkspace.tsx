import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Loader2, Radio, Upload, Zap } from "lucide-react";
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
  resolveHarmonicVerdict,
  type HarmonicParseResult,
} from "@/pages/dashboard/lib/harmonic-report";
import {
  HarmonicAlphaMetricCard,
  HarmonicInsightCard,
  HarmonicMarginAuditCard,
  HarmonicSecondaryStatsCard,
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

export default function HarmonicTelemetryWorkspace() {
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
  const verdict = useMemo(() => (result ? resolveHarmonicVerdict(result) : null), [result]);

  const handleUploadParse = async () => {
    if (!selectedFile) {
      toast.error("请先选择谐波 PDF 文件");
      return;
    }

    setIsParsing(true);
    try {
      const payload = await parseHarmonicPdf(selectedFile);
      setResult(payload.result);
      toast.success("谐波 PDF 解析完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "谐波 PDF 解析失败");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#000000] px-4 py-6 text-slate-200 md:px-8 md:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
            <Zap className="h-5 w-5 text-[#00F3FF]" style={{ filter: "drop-shadow(0 0 6px rgba(0,243,255,0.7))" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">谐波功率分析台</h1>
            <p className="text-xs text-slate-500">
              {result?.product_name || "谐波测试工作台"} · {result?.standard || "等待 PDF 解析"}
            </p>
          </div>
        </div>
        <div className="flex items-stretch gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F3FF] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00F3FF]" />
            </span>
            <span className="text-xs font-medium text-slate-300">
              频率 {result?.process_metrics.frequency_avg_hz?.toFixed(2) ?? "--"} Hz
            </span>
          </div>
          <div
            className={`min-w-[168px] rounded-2xl border px-4 py-3 ${
              verdict === "FAIL"
                ? "border-rose-500/40 bg-rose-500/10"
                : verdict === "PASS"
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-white/[0.06] bg-white/[0.03]"
            }`}
          >
            <div className="text-[10px] tracking-[0.18em] text-slate-500">判定结果</div>
            <div
              className={`mt-2 text-3xl font-black ${
                verdict === "FAIL"
                  ? "text-rose-300"
                  : verdict === "PASS"
                    ? "text-emerald-300"
                    : "text-slate-400"
              }`}
            >
              {verdict === "FAIL" ? "FAIL" : verdict === "PASS" ? "PASS" : "--"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {verdict === "FAIL" ? "存在超限谐波" : verdict === "PASS" ? "谐波满足标准" : "等待解析"}
            </div>
          </div>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="border-white/[0.06] bg-black/40 text-white file:text-white"
          />
          <Button onClick={handleUploadParse} disabled={isParsing} className="min-w-[220px] bg-white text-black hover:bg-white/90">
            {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isParsing ? "解析中..." : "上传谐波 PDF"}
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <HarmonicAlphaMetricCard metrics={alphaMetrics} />
          <HarmonicInsightCard rows={reportInsights} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <HarmonicGlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#00F3FF]" />
                <h2 className="text-sm font-semibold text-slate-200">电压、电流波形</h2>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-0.5 w-4 rounded bg-[#475569]" /> 电压
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-0.5 w-4 rounded bg-[#00F3FF]" style={{ boxShadow: "0 0 8px rgba(0,243,255,0.9)" }} />
                  电流
                </span>
              </div>
            </div>
            <HarmonicOscilloscope data={waveform} />
          </HarmonicGlassCard>

          <HarmonicGlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#00F3FF]" />
                <h2 className="text-sm font-semibold text-slate-200">波形失效点</h2>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">Q1-Q6 相位角检查</div>
                <div className="space-y-2">
                  {result?.phase_checks.length ? (
                    result.phase_checks.map((check) => (
                      <div key={check.checkpoint} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-slate-200">{check.checkpoint}</span>
                          <span className={check.status === "Fail" ? "font-mono text-sm text-[#FF003C]" : "font-mono text-sm text-[#00F3FF]"}>
                            {check.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          测试值 {check.measured_deg.toFixed(2)}° / 限值 {check.limit_expression}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm text-slate-500">
                      等待解析
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">结构硬伤检查</div>
                <div className="space-y-2">
                  {structuralAudit.length ? (
                    structuralAudit.map((check) => (
                      <div key={check.label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-200">{check.label}</span>
                          <span className={check.status === "Fail" ? "font-mono text-sm text-[#FF003C]" : "font-mono text-sm text-[#00F3FF]"}>
                            {check.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          实测 {check.value} / 限值 {check.limit}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm text-slate-500">
                      等待解析
                    </div>
                  )}
                </div>
              </div>
            </div>
          </HarmonicGlassCard>
        </div>

        <HarmonicGlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#00F3FF]" />
              <h2 className="text-sm font-semibold text-slate-200">谐波证据阵列</h2>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[#FF003C]" />
              报告限值
            </span>
          </div>
          <HarmonicFftSpectrum data={spectrum} />
        </HarmonicGlassCard>

        <HarmonicSecondaryStatsCard stats={secondaryStats} />
        <HarmonicMarginAuditCard rows={margins} />
      </div>
    </main>
  );
}
