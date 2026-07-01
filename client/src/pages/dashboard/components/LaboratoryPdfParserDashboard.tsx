import { useMemo, useRef, useState } from "react"
import { Download, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api"
import { DarkroomTelemetryWorkspace } from "./DarkroomTelemetryWorkspace"
import EmcRadiationWorkspace from "./EmcRadiationWorkspace"
import { FlickerTelemetryWorkspace } from "./FlickerTelemetryWorkspace"
import HarmonicTelemetryWorkspace from "./HarmonicTelemetryWorkspace"
import { CieDiagram } from "./jifenqiu/cie-diagram"
import { buildReportViewModel, type IntegratingSphereParseResult } from "./jifenqiu/report-data"
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
    <section className="mb-8 rounded-[28px] border border-white/[0.06] bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] md:p-6">
      <div className="mb-5 border-b border-white/[0.05] pb-3">
        <h2 className="font-mono text-sm tracking-[0.24em] text-slate-300 uppercase">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function LaboratoryPdfParserDashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [result, setResult] = useState<ParseResponse | null>(null)
  const exportRootRef = useRef<HTMLDivElement | null>(null)

  const viewModel = useMemo(
    () => buildReportViewModel(result?.fileName || selectedFile?.name || "--", result?.result || null),
    [result, selectedFile],
  )

  const handleUploadParse = async () => {
    if (!selectedFile) {
      toast.error("请先选择 PDF 文件")
      return
    }

    setIsParsing(true)
    try {
      const payload = await parseByUpload(selectedFile)
      setResult(payload)
      toast.success("PDF 解析完成")
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

      const baseName = (result?.fileName || "laboratory-workspace")
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
        <ModuleSection title="INTEGRATING SPHERE REPORT PARSER">
          <section className={`${glassPanel} mb-6 p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="border-white/[0.06] bg-black/40 text-white file:text-white"
              />
              <Button
                onClick={handleUploadParse}
                disabled={isParsing}
                className="min-w-[200px] bg-white text-black hover:bg-white/90"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isParsing ? "PARSING..." : "UPLOAD PDF / PARSE"}
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                variant="outline"
                className="min-w-[220px] border-white/[0.08] bg-transparent text-slate-100 hover:bg-white/[0.04]"
              >
                {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExportingPdf ? "EXPORTING..." : "EXPORT WORKSPACE PDF"}
              </Button>
            </div>
          </section>

          <SummaryBanner reportMeta={viewModel.reportMeta} />

          <div className="mb-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <SpectrumChart spectrumStats={viewModel.spectrumStats} />
            <CieDiagram chromaticity={viewModel.chromaticity} />
          </div>

          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            <TelemetryVector title="// ELECTRICAL INPUT TELEMETRY" fields={viewModel.electricalInput} />
            <TelemetryVector title="// LUMINOUS OUTPUT TELEMETRY" fields={viewModel.luminousOutput} />
            <TelemetryVector title="// COLOR QUALITY TELEMETRY" fields={viewModel.colorQuality} />
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

        <ModuleSection title="DARKROOM PHOTOMETRY PARSER">
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
