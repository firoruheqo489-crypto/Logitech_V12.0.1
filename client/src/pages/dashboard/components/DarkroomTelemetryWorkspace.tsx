import { useMemo, useState } from "react"
import { BarChart3, CheckCircle2, Circle, FileText, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import {
  buildDarkroomModuleSummary,
  type LaboratoryModuleSummary,
} from "./laboratory/laboratory-contract"
import { ConicalAttenuation } from "./darkroom/conical-attenuation"
import {
  buildDarkroomTelemetry,
  formatDarkroomNumber,
  type DarkroomParseResult,
} from "./darkroom/photometric"
import { EnergyAccumulation } from "./darkroom/energy-accumulation"
import { SpatialIntensity } from "./darkroom/spatial-intensity"

type ParseResponse = {
  ok: boolean
  sourceType: "upload"
  fileName?: string
  result: DarkroomParseResult
}

type LightVariantKey = string

type VariantSelection = {
  key: LightVariantKey
  label: string
  accent: string
  file: File | null
}

type VariantParsePayload = {
  key: LightVariantKey
  label: string
  fileName: string
  result: DarkroomParseResult
}

const INITIAL_REPORT_SLOTS: Array<Omit<VariantSelection, "file">> = [
  { key: "report-1", label: "报告 1", accent: "cyan" },
  { key: "report-2", label: "报告 2", accent: "amber" },
  { key: "report-3", label: "报告 3", accent: "emerald" },
]

const REPORT_ACCENTS = ["cyan", "amber", "emerald", "cyan", "amber", "emerald"]

function buildReportSelection(file: File | null, index: number): VariantSelection {
  return {
    key: `report-${index + 1}`,
    label: `报告 ${index + 1}`,
    accent: REPORT_ACCENTS[index % REPORT_ACCENTS.length],
    file,
  }
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1 text-right">
      <dt className="whitespace-nowrap text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-nowrap font-mono text-lg leading-none text-cyan-200">{value}</dd>
    </div>
  )
}

type BatchMetricMode = "relative" | "absolute"

type BatchMetric = {
  label: string
  unit: string
  digits: number
  mode: BatchMetricMode
  values: Array<{ label: string; value: number | null }>
}

type BatchConsistencyRow = {
  metric: BatchMetric
  spread: NonNullable<ReturnType<typeof metricSpread>>
  band: string
}

function finiteValues(metric: BatchMetric) {
  return metric.values.filter((entry): entry is { label: string; value: number } =>
    typeof entry.value === "number" && Number.isFinite(entry.value),
  )
}

function metricSpread(metric: BatchMetric) {
  const values = finiteValues(metric)
  if (values.length < 2) return null

  const raw = values.map((entry) => entry.value)
  const min = Math.min(...raw)
  const max = Math.max(...raw)
  const avg = raw.reduce((sum, value) => sum + value, 0) / raw.length
  const delta = max - min
  const spread = metric.mode === "relative" && Math.abs(avg) > 0 ? (delta / Math.abs(avg)) * 100 : delta
  const worstHigh = values.find((entry) => entry.value === max)?.label ?? "--"
  const worstLow = values.find((entry) => entry.value === min)?.label ?? "--"

  return { min, max, avg, delta, spread, worstHigh, worstLow, count: values.length }
}

function metricBand(metric: BatchMetric, spread: number) {
  if (metric.mode === "relative") {
    if (spread <= 2) return "PASS"
    if (spread <= 5) return "WATCH"
    return "DRIFT"
  }

  if (metric.label === "IRF") {
    if (spread <= 3) return "PASS"
    if (spread <= 8) return "WATCH"
    return "DRIFT"
  }

  if (spread <= 2) return "PASS"
  if (spread <= 5) return "WATCH"
  return "DRIFT"
}

function bandClass(band: string) {
  if (band === "PASS") return "text-cyan-300"
  if (band === "WATCH") return "text-amber-300"
  return "text-rose-300"
}

function formatMetricDelta(metric: BatchMetric, spread: number) {
  if (metric.mode === "relative") return `${spread.toFixed(2)}%`
  return `${spread.toFixed(metric.digits)} ${metric.unit}`
}

function buildBatchConsistencyRows(results: VariantParsePayload[]): BatchConsistencyRow[] {
  const snapshots = results.map((entry) => ({
    ...entry,
    telemetry: buildDarkroomTelemetry(entry.result),
  }))

  const metrics: BatchMetric[] = [
    {
      label: "光通量",
      unit: "lm",
      digits: 1,
      mode: "relative",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.ratedFlux })),
    },
    {
      label: "功率",
      unit: "W",
      digits: 2,
      mode: "relative",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.testedPower })),
    },
    {
      label: "光效",
      unit: "lm/W",
      digits: 2,
      mode: "relative",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.efficacy })),
    },
    {
      label: "最大光强",
      unit: "cd",
      digits: 1,
      mode: "relative",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.maxCandela })),
    },
    {
      label: "ErP φuse",
      unit: "lm",
      digits: 1,
      mode: "relative",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.erpPhiuse.lumens })),
    },
    {
      label: "IRF",
      unit: "pp",
      digits: 2,
      mode: "absolute",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.irfPercent })),
    },
    {
      label: "光束角 H",
      unit: "°",
      digits: 1,
      mode: "absolute",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.beamAngle.h })),
    },
    {
      label: "光束角 V",
      unit: "°",
      digits: 1,
      mode: "absolute",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.beamAngle.v })),
    },
    {
      label: "场角 H",
      unit: "°",
      digits: 1,
      mode: "absolute",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.fieldAngle.h })),
    },
    {
      label: "场角 V",
      unit: "°",
      digits: 1,
      mode: "absolute",
      values: snapshots.map((entry) => ({ label: entry.label, value: entry.telemetry.fieldAngle.v })),
    },
  ]

  return metrics
    .map((metric) => {
      const spread = metricSpread(metric)
      return spread ? { metric, spread, band: metricBand(metric, spread.spread) } : null
    })
    .filter((row): row is BatchConsistencyRow => row !== null)
}

function BatchConsistencyPanel({ results }: { results: VariantParsePayload[] }) {
  const rows = useMemo(() => buildBatchConsistencyRows(results), [results])

  if (results.length < 2 || rows.length === 0) return null

  const worstRow =
    rows.find((row) => row.band === "DRIFT") ??
    rows.find((row) => row.band === "WATCH") ??
    rows[0]

  return (
    <section className="mt-4 rounded-xl border border-white/[0.05] bg-[#070c14]/40 p-5 shadow-2xl backdrop-blur-3xl">
      <div className="mb-4 flex flex-col gap-2 border-b border-white/5 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-200">
            <BarChart3 className="h-4 w-4" />
            复测一致性 BATCH CONSISTENCY
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            已对齐 {results.length} 份暗房报告，按 PDF 原文指标计算批次离散度。
          </p>
        </div>
        <div className="font-mono text-xs text-slate-400">
          最大偏差：
          <span className={`ml-2 font-semibold ${bandClass(worstRow.band)}`}>
            {worstRow.metric.label} / {formatMetricDelta(worstRow.metric, worstRow.spread.spread)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-600">
              <th className="py-2 pr-3">指标</th>
              <th className="px-3 py-2 text-right">均值</th>
              <th className="px-3 py-2 text-right">最小</th>
              <th className="px-3 py-2 text-right">最大</th>
              <th className="px-3 py-2 text-right">离散</th>
              <th className="px-3 py-2 text-right">样本</th>
              <th className="py-2 pl-3 text-right">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ metric, spread, band }) => (
              <tr key={metric.label} className="border-b border-white/[0.04] text-sm">
                <td className="py-3 pr-3 font-medium text-slate-200">{metric.label}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-300">
                  {formatDarkroomNumber(spread.avg, metric.digits, metric.unit)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-500">
                  {formatDarkroomNumber(spread.min, metric.digits, metric.unit)}
                  <span className="ml-1 text-[10px] text-slate-600">{spread.worstLow}</span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-500">
                  {formatDarkroomNumber(spread.max, metric.digits, metric.unit)}
                  <span className="ml-1 text-[10px] text-slate-600">{spread.worstHigh}</span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-cyan-300">
                  {formatMetricDelta(metric, spread.spread)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-500">{spread.count}</td>
                <td className={`py-3 pl-3 text-right font-mono font-semibold ${bandClass(band)}`}>
                  {band}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function buildBatchConsistencySummary(results: VariantParsePayload[]) {
  if (results.length < 2) return undefined

  const rows = buildBatchConsistencyRows(results)
  if (!rows.length) {
    return {
      sampleCount: results.length,
      worstMetric: "--",
      worstSpread: "--",
      watchCount: 0,
      driftCount: 0,
    }
  }

  const worstRow =
    rows.find((row) => row.band === "DRIFT") ??
    rows.find((row) => row.band === "WATCH") ??
    rows[0]

  return {
    sampleCount: results.length,
    worstMetric: worstRow.metric.label,
    worstSpread: formatMetricDelta(worstRow.metric, worstRow.spread.spread),
    watchCount: rows.filter((row) => row.band === "WATCH").length,
    driftCount: rows.filter((row) => row.band === "DRIFT").length,
  }
}

function variantTone(accent: string, active = false) {
  if (accent === "amber") {
    return active
      ? "border-amber-300/60 bg-amber-400/[0.08] text-amber-100"
      : "border-amber-300/20 bg-amber-400/[0.025] text-amber-200/80 hover:border-amber-300/40"
  }

  if (accent === "emerald") {
    return active
      ? "border-emerald-300/60 bg-emerald-400/[0.08] text-emerald-100"
      : "border-emerald-300/20 bg-emerald-400/[0.025] text-emerald-200/80 hover:border-emerald-300/40"
  }

  return active
    ? "border-cyan-300/60 bg-cyan-400/[0.08] text-cyan-100"
    : "border-cyan-300/20 bg-cyan-400/[0.025] text-cyan-200/80 hover:border-cyan-300/40"
}

async function parseByUpload(file: File): Promise<ParseResponse> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await apiFetch("/api/dashboard/darkroom-pdf/parse-upload", {
    method: "POST",
    body: formData,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.details || payload?.error || "暗房 PDF 解析失败")
  }

  return payload as ParseResponse
}

export function DarkroomTelemetryWorkspace({
  nodeId,
  onSummaryChange,
  initialSummary,
}: {
  nodeId?: number
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void
  initialSummary?: LaboratoryModuleSummary
}) {
  const persistedData = initialSummary?.moduleData as
    | { results?: VariantParsePayload[]; activeVariantKey?: LightVariantKey }
    | undefined
  const initialResults = Array.isArray(persistedData?.results) ? persistedData.results : []
  const [selectedFiles, setSelectedFiles] = useState<VariantSelection[]>(
    INITIAL_REPORT_SLOTS.map((variant) => ({ ...variant, file: null })),
  )
  const [activeVariantKey, setActiveVariantKey] = useState<LightVariantKey>(persistedData?.activeVariantKey ?? initialResults[0]?.key ?? "report-1")
  const [isParsing, setIsParsing] = useState(false)
  const [results, setResults] = useState<VariantParsePayload[]>(initialResults)

  const activeVariantMeta = selectedFiles.find((variant) => variant.key === activeVariantKey) ?? selectedFiles[0]
  const activeResult = results.find((entry) => entry.key === activeVariantKey) ?? null

  const telemetry = useMemo(
    () => buildDarkroomTelemetry(activeResult?.result || null),
    [activeResult],
  )

  const selectedCount = selectedFiles.filter((variant) => variant.file).length
  const parsedCount = results.length
  const canParseBundle = selectedCount > 0

  const publishSummary = (nextResults: VariantParsePayload[], nextActiveKey: LightVariantKey) => {
    if (!nodeId || !onSummaryChange || nextResults.length === 0) {
      onSummaryChange?.(null)
      return
    }

    const activeEntry = nextResults.find((entry) => entry.key === nextActiveKey) ?? nextResults[0]
    const activeTelemetry = buildDarkroomTelemetry(activeEntry.result)
    onSummaryChange({
      ...buildDarkroomModuleSummary(nodeId, {
        sourceFiles: nextResults.map((entry) => `${entry.label}:${entry.fileName}`),
        activeVariantLabel: activeEntry.label,
        parsedCount: nextResults.length,
        expectedCount: nextResults.length,
        activeMetrics: {
          name: activeTelemetry.name,
          testDate: activeTelemetry.testDate,
          ratedFlux: activeTelemetry.ratedFlux,
          testedPower: activeTelemetry.testedPower,
          efficacy: activeTelemetry.efficacy,
          maxCandela: activeTelemetry.maxCandela,
          beamAngleV: activeTelemetry.beamAngle.v,
          beamAngleH: activeTelemetry.beamAngle.h,
          fieldAngleV: activeTelemetry.fieldAngle.v,
          fieldAngleH: activeTelemetry.fieldAngle.h,
          workingPlaneEMax: activeTelemetry.workingPlaneEMax,
        },
        batchConsistency: buildBatchConsistencySummary(nextResults),
      }),
      moduleData: { results: nextResults, activeVariantKey: nextActiveKey },
    })
  }

  const handleVariantFileChange = (variantKey: LightVariantKey, file: File | null) => {
    setResults((current) => current.filter((entry) => entry.key !== variantKey))
    setSelectedFiles((current) =>
      current.map((entry) => (entry.key === variantKey ? { ...entry, file } : entry)),
    )
    setActiveVariantKey(variantKey)
  }

  const handleBatchFileChange = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? [])
    if (nextFiles.length === 0) return

    const nextSelections = nextFiles.map((file, index) => buildReportSelection(file, index))
    setResults([])
    setSelectedFiles(nextSelections)
    setActiveVariantKey(nextSelections[0]?.key ?? "report-1")
    onSummaryChange?.(null)
  }

  const handleClearAll = () => {
    setResults([])
    setSelectedFiles(INITIAL_REPORT_SLOTS.map((variant) => ({ ...variant, file: null })))
    setActiveVariantKey("report-1")
    onSummaryChange?.(null)
  }

  const handleUploadParse = async () => {
    const filesToParse = selectedFiles.filter((variant) => variant.file)
    if (filesToParse.length === 0) {
      toast.error("请至少选择一份暗房 PDF 报告")
      return
    }

    setIsParsing(true)
    try {
      const payloads: VariantParsePayload[] = []

      for (const variant of selectedFiles) {
        if (!variant.file) continue
        const payload = await parseByUpload(variant.file)
        payloads.push({
          key: variant.key,
          label: variant.label,
          fileName: payload.fileName || variant.file.name,
          result: payload.result,
        })
      }

      setResults(payloads)
      const nextActiveKey = payloads[0]?.key ?? "report-1"
      setActiveVariantKey(nextActiveKey)
      publishSummary(payloads, nextActiveKey)
      toast.success(`暗房 PDF 解析完成：已接入 ${payloads.length} 份报告`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "暗房 PDF 解析失败")
    } finally {
      setIsParsing(false)
    }
  }

  const activeFileName = activeResult?.fileName || activeVariantMeta?.file?.name || telemetry.filename

  return (
    <section className="mt-0">
      <main className="min-h-0 px-2 py-7 text-slate-200 md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl">
          <section className="mb-4 rounded-lg border border-white/5 bg-white/[0.01] p-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-stretch">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                {selectedFiles.map((variant) => {
                  const variantResult = results.find((entry) => entry.key === variant.key)
                  const isActive = activeVariantKey === variant.key
                  const stateLabel = variantResult ? "已解析" : variant.file ? "待解析" : "未选择"

                  return (
                    <div
                      key={variant.key}
                      className={`relative min-h-[58px] rounded-lg border transition ${variantTone(variant.accent, isActive)}`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveVariantKey(variant.key)}
                        className="flex h-full w-full items-center gap-3 px-3 py-2 pr-24 text-left"
                      >
                        {variantResult ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : variant.file ? (
                          <FileText className="h-4 w-4 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 whitespace-nowrap font-mono text-xs font-bold tracking-[0.04em]">{variant.label}</span>
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/[0.08] bg-black/25 px-2 py-0.5 text-[10px] text-slate-300">
                              {stateLabel}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-400">
                            {variant.file?.name || `选择${variant.label} PDF`}
                          </span>
                        </span>
                      </button>
                      <label
                        className="absolute right-10 top-1/2 -translate-y-1/2 cursor-pointer rounded-full border border-white/[0.08] bg-black/45 px-2 py-1 text-[10px] text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {variant.file ? "更换" : "选择"}
                        <input
                          key={`${variant.key}-${variant.file?.name ?? "empty"}-picker`}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(event) => handleVariantFileChange(variant.key, event.target.files?.[0] ?? null)}
                        />
                      </label>
                      {variant.file ? (
                        <button
                          type="button"
                          onClick={() => handleVariantFileChange(variant.key, null)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/[0.08] bg-black/55 p-1.5 text-slate-400 transition hover:border-rose-300/40 hover:text-rose-200"
                          aria-label={`清除${variant.label}报告`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 xl:self-center">
                <label className="col-span-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-slate-100">
                  <Upload className="h-4 w-4" />
                  批量选择 PDF
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(event) => handleBatchFileChange(event.target.files)}
                  />
                </label>
                <Button
                  onClick={handleUploadParse}
                  disabled={isParsing || !canParseBundle}
                  className="h-10 justify-center bg-white text-black hover:bg-white/90"
                >
                  {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isParsing ? "解析中" : "解析"}
                </Button>
                <Button
                  onClick={handleClearAll}
                  disabled={isParsing || (selectedCount === 0 && parsedCount === 0)}
                  variant="outline"
                  className="h-10 justify-center border-white/[0.06] bg-black/20 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                  清空
                </Button>
              </div>
            </div>
          </section>

          <header className="mb-8 flex flex-col gap-4 border-b border-white/[0.035] pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-medium text-cyan-300/85">
                暗房光度遥测
              </p>
              <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
                {telemetry.name}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {telemetry.machine} / {activeResult ? `${activeResult.label} / ${activeFileName}` : activeFileName}
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-8">
              <HeaderStat label="光通量 FLUX" value={formatDarkroomNumber(telemetry.ratedFlux, 1, "lm")} />
              <HeaderStat label="功率 POWER" value={formatDarkroomNumber(telemetry.testedPower, 2, "W")} />
              <HeaderStat label="光效 EFFICACY" value={formatDarkroomNumber(telemetry.efficacy, 1, "lm/W")} />
            </dl>
          </header>

          <div className="grid grid-cols-1 rounded-lg border border-white/[0.04] bg-white/[0.012] xl:grid-cols-[minmax(330px,1.04fr)_minmax(310px,0.96fr)_minmax(380px,1.12fr)] xl:divide-x xl:divide-white/[0.035] xl:items-stretch">
            <SpatialIntensity telemetry={telemetry} />
            <EnergyAccumulation telemetry={telemetry} />
            <ConicalAttenuation telemetry={telemetry} />
          </div>

          <BatchConsistencyPanel results={results} />

          {telemetry.evidenceWarnings.length ? (
            <section className="mt-4 rounded-xl border border-amber-300/10 bg-amber-400/[0.03] p-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                证据链提示 EVIDENCE NOTES
              </h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {telemetry.evidenceWarnings.map((warning) => (
                  <p key={warning} className="rounded-md border border-white/[0.04] bg-black/25 px-3 py-2 text-xs text-slate-300">
                    {warning}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
            <span className="font-mono text-[9px] tracking-[0.2em] text-slate-600 uppercase">
              测试日期 TEST DATE {telemetry.testDate}
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] text-slate-600 uppercase">
              IES 投光灯报告 FLOOD REPORT
            </span>
          </footer>
        </div>
      </main>
    </section>
  )
}
