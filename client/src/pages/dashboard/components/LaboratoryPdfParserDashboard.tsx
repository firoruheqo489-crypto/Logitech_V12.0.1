import { useMemo, useRef, useState } from "react"
import { CheckCircle2, Circle, Download, FileText, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { DarkroomTelemetryWorkspace } from "./DarkroomTelemetryWorkspace"
import EmcRadiationWorkspace from "./EmcRadiationWorkspace"
import { FlickerTelemetryWorkspace } from "./FlickerTelemetryWorkspace"
import HarmonicTelemetryWorkspace from "./HarmonicTelemetryWorkspace"
import { CieDiagram } from "./jifenqiu/cie-diagram"
import { buildReportViewModel, type IntegratingSphereParseResult, type Judgment } from "./jifenqiu/report-data"
import { SpectrumChart } from "./jifenqiu/spectrum-chart"
import { SummaryBanner } from "./jifenqiu/summary-banner"
import { TelemetryVector } from "./jifenqiu/telemetry-vector"
import { glassPanel } from "./jifenqiu/ui"

type ParseResponse = {
  ok: boolean
  sourceType: "upload"
  fileName?: string
  result: IntegratingSphereParseResult
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
  result: IntegratingSphereParseResult
}

const VARIANT_ORDER: Array<Omit<VariantSelection, "file">> = [
  { key: "white", label: "白光", hint: "White", accent: "cyan" },
  { key: "warm", label: "暖光", hint: "Warm", accent: "amber" },
  { key: "neutral", label: "中性光", hint: "Neutral", accent: "emerald" },
]

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

  const response = await apiFetch("/api/dashboard/laboratory-pdf/parse-upload", {
    method: "POST",
    body: formData,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.details || payload?.error || "PDF 解析失败")
  }

  return payload as ParseResponse
}

function ModuleSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8 rounded-[28px] border border-white/[0.06] bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] md:p-5">
      <div className="mb-4 border-b border-white/[0.05] pb-3">
        <h2 className="text-base font-bold tracking-wide text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function LaboratoryPdfParserDashboard() {
  const [selectedFiles, setSelectedFiles] = useState<VariantSelection[]>(
    VARIANT_ORDER.map((variant) => ({ ...variant, file: null })),
  )
  const [activeVariantKey, setActiveVariantKey] = useState<LightVariantKey>("white")
  const [isParsing, setIsParsing] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [results, setResults] = useState<VariantParsePayload[]>([])
  const exportRootRef = useRef<HTMLDivElement | null>(null)

  const activeVariantMeta = selectedFiles.find((variant) => variant.key === activeVariantKey) ?? selectedFiles[0]
  const activeResult = results.find((entry) => entry.key === activeVariantKey) ?? null

  const viewModel = useMemo(
    () => buildReportViewModel(activeResult?.fileName || activeVariantMeta?.file?.name || "--", activeResult?.result || null),
    [activeResult, activeVariantMeta],
  )

  const combinedJudgment = useMemo<Judgment>(() => {
    if (results.length !== VARIANT_ORDER.length) return "FAIL"
    return results.every((entry) => buildReportViewModel(entry.fileName, entry.result).reportMeta.judgment === "PASS")
      ? "PASS"
      : "FAIL"
  }, [results])

  const summaryReportMeta = useMemo(() => {
    const base = viewModel.reportMeta
    return {
      ...base,
      fileName:
        results.length > 0
          ? `${activeVariantMeta.label} / ${activeResult?.fileName || activeVariantMeta.file?.name || "--"}`
          : base.fileName,
      judgment: combinedJudgment,
    }
  }, [activeResult?.fileName, activeVariantMeta.file, activeVariantMeta.label, combinedJudgment, results.length, viewModel.reportMeta])

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
      toast.error("请一次选择白光、暖光、中性光三份 PDF 报告")
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
      toast.success(`PDF 解析完成：已接入 ${payloads.length} 份积分球报告`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 解析失败")
    } finally {
      setIsParsing(false)
    }
  }

  const handleExportPdf = async () => {
    const target = exportRootRef.current
    if (!target) {
      toast.error("当前没有可导出的页面内容")
      return
    }

    setIsExportingPdf(true)
    try {
      await Promise.all(
        Array.from(target.querySelectorAll("img")).map(
          (image) =>
            new Promise<void>((resolve) => {
              const img = image as HTMLImageElement
              if (img.complete) {
                resolve()
                return
              }
              const finalize = () => resolve()
              img.addEventListener("load", finalize, { once: true })
              img.addEventListener("error", finalize, { once: true })
            }),
        ),
      )

      const [{ default: html2canvas }, jspdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ])
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#020406",
        logging: false,
        width: target.scrollWidth,
        height: target.scrollHeight,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
        imageTimeout: 0,
      })

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false,
      })

      const imageData = canvas.toDataURL("image/png", 1)
      const pdfWidth = 210
      const pdfHeight = 297
      const imageHeight = (canvas.height * pdfWidth) / canvas.width

      let heightLeft = imageHeight
      let position = 0

      pdf.addImage(imageData, "PNG", 0, position, pdfWidth, imageHeight, "laboratory-workspace", "FAST")
      heightLeft -= pdfHeight

      while (heightLeft > 0) {
        position = heightLeft - imageHeight
        pdf.addPage()
        pdf.addImage(imageData, "PNG", 0, position, pdfWidth, imageHeight, undefined, "FAST")
        heightLeft -= pdfHeight
      }

      const baseName = (results.length > 1 ? "integrating-sphere-3-light-workspace" : activeResult?.fileName || "laboratory-workspace")
        .replace(/\.pdf$/i, "")
        .replace(/[\\/:*?"<>|]+/g, "-")
      pdf.save(`${baseName}-workspace.pdf`)
      toast.success("PDF 导出完成")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 导出失败")
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#020406] bg-[radial-gradient(circle_at_50%_20%,_rgba(0,243,255,0.06),_transparent_50%)] px-6 py-8 text-zinc-50 md:px-10 lg:px-14">
      <div ref={exportRootRef} className="mx-auto w-full max-w-7xl">
        <ModuleSection title="积分球解析">
          <section className={`${glassPanel} mb-4 p-3`}>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-stretch">
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

              <div className="grid grid-cols-3 gap-2 xl:self-center">
                <Button
                  onClick={handleUploadParse}
                  disabled={isParsing || !canParseBundle}
                  className="h-10 justify-center bg-white text-black hover:bg-white/90"
                >
                  {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isParsing ? "解析中" : "解析"}
                </Button>
                <Button
                  onClick={handleExportPdf}
                  disabled={isExportingPdf || parsedCount === 0}
                  variant="outline"
                  className="h-10 justify-center border-white/[0.08] bg-transparent text-slate-100 hover:bg-white/[0.04]"
                >
                  {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  导出
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

          <SummaryBanner reportMeta={summaryReportMeta} />

          <div className="mb-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <SpectrumChart spectrumStats={viewModel.spectrumStats} />
            <CieDiagram chromaticity={viewModel.chromaticity} />
          </div>

          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            <TelemetryVector title="电参数输入" fields={viewModel.electricalInput} />
            <TelemetryVector title="光参数输出" fields={viewModel.luminousOutput} />
            <TelemetryVector title="颜色质量" fields={viewModel.colorQuality} />
          </div>

          <footer className="mt-8 flex items-center justify-between border-t border-white/[0.04] pt-4">
            <span className="font-mono text-[10px] tracking-widest text-slate-600">
              INTEGRATING SPHERE DIAGNOSTIC WORKSPACE v1
            </span>
            <span className="font-mono text-[10px] tracking-widest text-slate-600">
              CIE 1931 / IES TM-30 / CIE 13.3 Ra
            </span>
          </footer>
        </ModuleSection>

        <ModuleSection title="暗房解析">
          <DarkroomTelemetryWorkspace />
        </ModuleSection>

        <ModuleSection title="FLICKER REPORT PARSER">
          <FlickerTelemetryWorkspace />
        </ModuleSection>

        <ModuleSection title="EMC RADIATION / CONDUCTION PARSER">
          <EmcRadiationWorkspace />
        </ModuleSection>

        <ModuleSection title="HARMONIC REPORT PARSER">
          <HarmonicTelemetryWorkspace />
        </ModuleSection>
      </div>
    </main>
  )
}
