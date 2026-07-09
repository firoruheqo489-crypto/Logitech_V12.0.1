import { useMemo, useState } from "react"
import { CheckCircle2, Circle, FileText, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { ConicalAttenuation } from "./darkroom/conical-attenuation"
import {
  buildDarkroomTelemetry,
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

type LightVariantKey = "white" | "warm" | "neutral"

type VariantSelection = {
  key: LightVariantKey
  label: string
  hint: string
  accent: string
  file: File | null
}

type VariantParsePayload = {
  key: LightVariantKey
  label: string
  fileName: string
  result: DarkroomParseResult
}

const VARIANT_ORDER: Array<Omit<VariantSelection, "file">> = [
  { key: "white", label: "白光", hint: "White", accent: "cyan" },
  { key: "warm", label: "暖光", hint: "Warm", accent: "amber" },
  { key: "neutral", label: "中性光", hint: "Neutral", accent: "emerald" },
]

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dt className="text-[9px] tracking-[0.2em] text-slate-600 uppercase">{label}</dt>
      <dd className="mt-1 text-xs text-cyan-400">{value}</dd>
    </div>
  )
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

export function DarkroomTelemetryWorkspace() {
  const [selectedFiles, setSelectedFiles] = useState<VariantSelection[]>(
    VARIANT_ORDER.map((variant) => ({ ...variant, file: null })),
  )
  const [activeVariantKey, setActiveVariantKey] = useState<LightVariantKey>("white")
  const [isParsing, setIsParsing] = useState(false)
  const [results, setResults] = useState<VariantParsePayload[]>([])

  const activeVariantMeta = selectedFiles.find((variant) => variant.key === activeVariantKey) ?? selectedFiles[0]
  const activeResult = results.find((entry) => entry.key === activeVariantKey) ?? null

  const telemetry = useMemo(
    () => buildDarkroomTelemetry(activeResult?.result || null),
    [activeResult],
  )

  const selectedCount = selectedFiles.filter((variant) => variant.file).length
  const parsedCount = results.length
  const canParseBundle = selectedCount === VARIANT_ORDER.length

  const handleVariantFileChange = (variantKey: LightVariantKey, file: File | null) => {
    setResults((current) => current.filter((entry) => entry.key !== variantKey))
    setSelectedFiles((current) =>
      current.map((entry) => (entry.key === variantKey ? { ...entry, file } : entry)),
    )
    setActiveVariantKey(variantKey)
  }

  const handleClearAll = () => {
    setResults([])
    setSelectedFiles(VARIANT_ORDER.map((variant) => ({ ...variant, file: null })))
    setActiveVariantKey("white")
  }

  const handleUploadParse = async () => {
    const filesToParse = selectedFiles.filter((variant) => variant.file)
    if (filesToParse.length !== VARIANT_ORDER.length) {
      toast.error("请一次选择白光、暖光、中性光三份暗房 PDF 报告")
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
      setActiveVariantKey(payloads[0]?.key ?? "white")
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
      <main className="min-h-0 rounded-2xl border border-white/5 bg-[#030508] px-4 py-8 text-slate-200 md:px-10 md:py-12">
        <div className="mx-auto max-w-6xl">
          <section className="mb-4 rounded-lg border border-white/5 bg-white/[0.01] p-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_200px] xl:items-stretch">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                {selectedFiles.map((variant) => {
                  const variantResult = results.find((entry) => entry.key === variant.key)
                  const isActive = activeVariantKey === variant.key
                  const stateLabel = variantResult ? "已解析" : variant.file ? "待解析" : "未选择"

                  return (
                    <div
                      key={variant.key}
                      className={`relative min-h-[58px] rounded-lg border transition ${variantTone(variant.accent, isActive)}`}
                      onClick={() => setActiveVariantKey(variant.key)}
                    >
                      <label className="flex h-full cursor-pointer items-center gap-3 px-3 py-2 pr-10">
                        {variantResult ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : variant.file ? (
                          <FileText className="h-4 w-4 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold tracking-[0.18em]">{variant.label}</span>
                            <span className="rounded-full border border-white/[0.08] bg-black/25 px-2 py-0.5 text-[10px] text-slate-300">
                              {stateLabel}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-400">
                            {variant.file?.name || `选择${variant.label}PDF`}
                          </span>
                        </span>
                        <input
                          key={variant.file?.name ?? `${variant.key}-empty`}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(event) => handleVariantFileChange(variant.key, event.target.files?.[0] ?? null)}
                        />
                      </label>
                      {variant.file ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleVariantFileChange(variant.key, null)
                          }}
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

          <header className="mb-8 flex flex-col gap-3 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-cyan-400/80 uppercase">
                暗房光度遥测
              </p>
              <h1 className="text-balance font-mono text-lg font-semibold tracking-tight text-slate-100 md:text-xl">
                {telemetry.name}
              </h1>
              <p className="mt-1 font-mono text-[10px] tracking-wide text-slate-500">
                {telemetry.machine} / {activeResult ? `${activeResult.label} / ${activeFileName}` : activeFileName}
              </p>
            </div>

            <dl className="flex gap-6 font-mono">
              <HeaderStat label="光通量 FLUX" value={`${telemetry.ratedFlux.toFixed(1)} lm`} />
              <HeaderStat label="功率 POWER" value={`${telemetry.testedPower.toFixed(2)} W`} />
              <HeaderStat label="光效 EFFICACY" value={`${telemetry.efficacy.toFixed(1)} lm/W`} />
            </dl>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
            <SpatialIntensity telemetry={telemetry} />
            <EnergyAccumulation telemetry={telemetry} />
            <ConicalAttenuation telemetry={telemetry} />
          </div>

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
