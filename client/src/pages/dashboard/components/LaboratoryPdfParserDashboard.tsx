import { useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  accent: string
  file: File | null
}

type VariantParsePayload = {
  key: LightVariantKey
  label: string
  fileName: string
  result: IntegratingSphereParseResult
}

type TelemetryNodeType =
  | "INTEGRATING_SPHERE"
  | "DARKROOM"
  | "FLICKER"
  | "EMISSION"
  | "HARMONIC"

type WorkspaceNode = {
  id: number
  type: TelemetryNodeType | null
  isConfirmed: boolean
}

const VARIANT_ORDER: Array<Omit<VariantSelection, "file">> = [
  { key: "white", label: "白光", accent: "cyan" },
  { key: "warm", label: "暖光", accent: "amber" },
  { key: "neutral", label: "中性光", accent: "emerald" },
]

const TOOL_OPTIONS: Array<{
  type: TelemetryNodeType
  label: string
}> = [
  { type: "INTEGRATING_SPHERE", label: "积分球解析" },
  { type: "DARKROOM", label: "暗房解析" },
  { type: "FLICKER", label: "频闪解析" },
  { type: "EMISSION", label: "传导 / 辐射解析" },
  { type: "HARMONIC", label: "谐波解析" },
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

function openPdfPreviewWindow(options: {
  source: HTMLElement
  fileBaseName: string
  onConfirmExport: () => void | Promise<void>
}) {
  void options.source
  void options.fileBaseName
  void Promise.resolve(options.onConfirmExport())
}

const UNSUPPORTED_COLOR_FUNCTION_RE = /\b(?:oklch|oklab|color)\(/i
const PURE_COLOR_PROPERTIES = new Set([
  "background-color",
  "border-bottom-color",
  "border-left-color",
  "border-right-color",
  "border-top-color",
  "caret-color",
  "color",
  "column-rule-color",
  "fill",
  "flood-color",
  "lighting-color",
  "outline-color",
  "stop-color",
  "stroke",
  "text-decoration-color",
  "text-emphasis-color",
])

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function srgbEncode(value: number) {
  const clamped = clamp(value, 0, 1)
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function parseCssNumber(token: string) {
  const trimmed = token.trim()
  if (!trimmed) return null
  if (trimmed.endsWith("%")) {
    const value = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(value) ? value / 100 : null
  }
  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : null
}

function parseHue(token: string) {
  const trimmed = token.trim().toLowerCase()
  if (!trimmed) return null

  if (trimmed.endsWith("deg")) {
    const value = Number.parseFloat(trimmed.slice(0, -3))
    return Number.isFinite(value) ? value : null
  }
  if (trimmed.endsWith("grad")) {
    const value = Number.parseFloat(trimmed.slice(0, -4))
    return Number.isFinite(value) ? value * 0.9 : null
  }
  if (trimmed.endsWith("rad")) {
    const value = Number.parseFloat(trimmed.slice(0, -3))
    return Number.isFinite(value) ? (value * 180) / Math.PI : null
  }
  if (trimmed.endsWith("turn")) {
    const value = Number.parseFloat(trimmed.slice(0, -4))
    return Number.isFinite(value) ? value * 360 : null
  }

  const value = Number.parseFloat(trimmed)
  return Number.isFinite(value) ? value : null
}

function formatRgba(red: number, green: number, blue: number, alpha: number) {
  const r = Math.round(clamp(red, 0, 1) * 255)
  const g = Math.round(clamp(green, 0, 1) * 255)
  const b = Math.round(clamp(blue, 0, 1) * 255)
  const a = Math.round(clamp(alpha, 0, 1) * 1000) / 1000
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function convertOklchToRgba(oklchValue: string) {
  const inner = oklchValue.slice(oklchValue.indexOf("(") + 1, -1).trim()
  const [valuePart, alphaPart] = inner.split("/")
  const tokens = valuePart.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 3) return null

  const lightness = parseCssNumber(tokens[0])
  const chroma = parseCssNumber(tokens[1])
  const hue = parseHue(tokens[2])
  const alpha = alphaPart ? parseCssNumber(alphaPart) : 1
  if (lightness === null || chroma === null || hue === null || alpha === null) return null

  const hueRadians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)

  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b

  const l = lRoot ** 3
  const m = mRoot ** 3
  const s = sRoot ** 3

  const red = srgbEncode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = srgbEncode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = srgbEncode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)

  return formatRgba(red, green, blue, alpha)
}

function replaceUnsupportedColorFunctions(value: string) {
  let result = ""
  let cursor = 0
  const lowerValue = value.toLowerCase()

  while (cursor < value.length) {
    const start = lowerValue.indexOf("oklch(", cursor)
    if (start === -1) {
      result += value.slice(cursor)
      break
    }

    result += value.slice(cursor, start)
    let depth = 0
    let end = start

    while (end < value.length) {
      const char = value[end]
      if (char === "(") depth += 1
      if (char === ")") {
        depth -= 1
        if (depth === 0) {
          end += 1
          break
        }
      }
      end += 1
    }

    const fnText = value.slice(start, end)
    const converted = convertOklchToRgba(fnText)
    result += converted ?? "rgba(0, 0, 0, 0)"
    cursor = end
  }

  return result
}

function normalizeCssValue(
  property: string,
  value: string,
  sandbox: HTMLElement,
  colorContext: CanvasRenderingContext2D | null,
) {
  const trimmed = replaceUnsupportedColorFunctions(value.trim())
  if (!trimmed) return ""

  if (!UNSUPPORTED_COLOR_FUNCTION_RE.test(trimmed)) {
    return trimmed
  }

  if (PURE_COLOR_PROPERTIES.has(property) && colorContext) {
    try {
      colorContext.fillStyle = "#000000"
      colorContext.fillStyle = trimmed
      const normalizedColor = colorContext.fillStyle
      if (normalizedColor && !UNSUPPORTED_COLOR_FUNCTION_RE.test(normalizedColor)) {
        return normalizedColor
      }
    } catch {
      // Fall through to browser serialization.
    }
  }

  try {
    sandbox.style.removeProperty(property)
    sandbox.style.setProperty(property, trimmed)
    const normalized = getComputedStyle(sandbox).getPropertyValue(property).trim()
    sandbox.style.removeProperty(property)
    if (normalized && !UNSUPPORTED_COLOR_FUNCTION_RE.test(normalized)) {
      return normalized
    }
  } catch {
    return PURE_COLOR_PROPERTIES.has(property) ? "rgba(0, 0, 0, 0)" : ""
  }

  return PURE_COLOR_PROPERTIES.has(property) ? "rgba(0, 0, 0, 0)" : ""
}

function syncFormValues(source: HTMLElement, clone: HTMLElement) {
  const sourceInputs = Array.from(
    source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"),
  )
  const cloneInputs = Array.from(
    clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"),
  )

  sourceInputs.forEach((sourceInput, index) => {
    const cloneInput = cloneInputs[index]
    if (!cloneInput) return

    if (sourceInput instanceof HTMLInputElement && cloneInput instanceof HTMLInputElement) {
      cloneInput.value = sourceInput.value
      cloneInput.checked = sourceInput.checked
      cloneInput.setAttribute("value", sourceInput.value)
      if (sourceInput.checked) cloneInput.setAttribute("checked", "checked")
      else cloneInput.removeAttribute("checked")
      return
    }

    if (sourceInput instanceof HTMLTextAreaElement && cloneInput instanceof HTMLTextAreaElement) {
      cloneInput.value = sourceInput.value
      cloneInput.textContent = sourceInput.value
      return
    }

    if (sourceInput instanceof HTMLSelectElement && cloneInput instanceof HTMLSelectElement) {
      cloneInput.value = sourceInput.value
      Array.from(cloneInput.options).forEach((option) => {
        option.selected = option.value === sourceInput.value
      })
    }
  })
}

function inlineResolvedStyles(source: HTMLElement, clone: HTMLElement) {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll("*"))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll("*"))]
  const sandbox = document.createElement("div")
  sandbox.setAttribute("aria-hidden", "true")
  sandbox.style.position = "fixed"
  sandbox.style.left = "-100000px"
  sandbox.style.top = "0"
  sandbox.style.visibility = "hidden"
  sandbox.style.pointerEvents = "none"
  sandbox.style.all = "initial"
  document.body.appendChild(sandbox)

  const colorCanvas = document.createElement("canvas")
  const colorContext = colorCanvas.getContext("2d")

  try {
    const length = Math.min(sourceNodes.length, cloneNodes.length)
    for (let index = 0; index < length; index += 1) {
      const sourceNode = sourceNodes[index]
      const cloneNode = cloneNodes[index]
      if (!(cloneNode instanceof HTMLElement || cloneNode instanceof SVGElement)) continue

      const computed = getComputedStyle(sourceNode)
      for (let propIndex = 0; propIndex < computed.length; propIndex += 1) {
        const property = computed[propIndex]
        if (!property || property.startsWith("--")) continue

        const value = computed.getPropertyValue(property)
        if (!value) continue

        const normalized = normalizeCssValue(property, value, sandbox, colorContext)
        if (!normalized) continue

        cloneNode.style.setProperty(property, normalized)
      }

      cloneNode.style.setProperty("animation", "none")
      cloneNode.style.setProperty("transition", "none")
      cloneNode.removeAttribute("class")
    }
  } finally {
    sandbox.remove()
  }
}

async function exportDomNodeAsPdf(target: HTMLDivElement, fileBaseName: string): Promise<void> {
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

  const width = Math.max(Math.ceil(target.scrollWidth), Math.ceil(target.getBoundingClientRect().width), 1)
  const cloneHost = document.createElement("div")
  cloneHost.setAttribute("aria-hidden", "true")
  cloneHost.style.position = "fixed"
  cloneHost.style.left = "-100000px"
  cloneHost.style.top = "0"
  cloneHost.style.width = `${width}px`
  cloneHost.style.pointerEvents = "none"
  cloneHost.style.zIndex = "-1"
  cloneHost.style.overflow = "visible"
  cloneHost.style.background = "transparent"

  const clone = target.cloneNode(true) as HTMLDivElement
  syncFormValues(target, clone)
  inlineResolvedStyles(target, clone)
  clone.style.width = `${width}px`
  clone.style.maxWidth = "none"
  clone.style.margin = "0"
  clone.style.height = "auto"
  clone.style.minHeight = "0"
  clone.style.overflow = "visible"
  cloneHost.appendChild(clone)
  document.body.appendChild(cloneHost)

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#020406",
      logging: false,
      width,
      height: Math.max(Math.ceil(clone.scrollHeight), Math.ceil(clone.getBoundingClientRect().height), 1),
      windowWidth: width,
      windowHeight: Math.max(Math.ceil(clone.scrollHeight), Math.ceil(clone.getBoundingClientRect().height), 1),
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

    pdf.addImage(imageData, "PNG", 0, position, pdfWidth, imageHeight, fileBaseName, "FAST")
    heightLeft -= pdfHeight

    while (heightLeft > 0) {
      position = heightLeft - imageHeight
      pdf.addPage()
      pdf.addImage(imageData, "PNG", 0, position, pdfWidth, imageHeight, undefined, "FAST")
      heightLeft -= pdfHeight
    }

    pdf.save(`${fileBaseName}.pdf`)
  } finally {
    cloneHost.remove()
  }
}

function ModuleSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-white/[0.06] bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] md:p-5">
      <div className="mb-4 border-b border-white/[0.05] pb-3">
        <h2 className="text-base font-bold tracking-wide text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function IntegratingSphereTool() {
  const [selectedFiles, setSelectedFiles] = useState<VariantSelection[]>(
    VARIANT_ORDER.map((variant) => ({ ...variant, file: null })),
  )
  const [activeVariantKey, setActiveVariantKey] = useState<LightVariantKey>("white")
  const [isParsing, setIsParsing] = useState(false)
  const [results, setResults] = useState<VariantParsePayload[]>([])

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
  const canParseBundle = selectedCount > 0

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
    if (filesToParse.length === 0) {
      toast.error("请至少选择一份积分球 PDF 报告")
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

  return (
    <div className="mx-auto w-full max-w-7xl">
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

            <div className="grid grid-cols-3 gap-2 xl:self-center">
              <Button
                onClick={handleUploadParse}
                disabled={isParsing || !canParseBundle}
                className="h-10 justify-center bg-white text-black hover:bg-white/90"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isParsing ? "解析中..." : "解析"}
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
    </div>
  )
}

function renderTelemetryModule(type: TelemetryNodeType, nodeId: number) {
  switch (type) {
    case "INTEGRATING_SPHERE":
      return <IntegratingSphereTool key={`integrating-sphere-${nodeId}`} />
    case "DARKROOM":
      return <DarkroomTelemetryWorkspace key={`darkroom-${nodeId}`} />
    case "FLICKER":
      return <FlickerTelemetryWorkspace key={`flicker-${nodeId}`} />
    case "EMISSION":
      return <EmcRadiationWorkspace key={`emission-${nodeId}`} />
    case "HARMONIC":
      return <HarmonicTelemetryWorkspace key={`harmonic-${nodeId}`} />
    default:
      return null
  }
}

function EmptyNodePortal({
  value,
  onValueChange,
  onConfirm,
}: {
  value: TelemetryNodeType | ""
  onValueChange: (value: TelemetryNodeType) => void
  onConfirm: () => void
}) {
  return (
    <div className="flex min-h-[168px] flex-col items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-xl">
      <div className="mb-4 text-center">
        <h3 className="text-xl font-bold text-slate-100">添加测试模块</h3>
      </div>

      <div className="grid w-full max-w-xl gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as TelemetryNodeType)}>
          <SelectTrigger className="h-12 w-full rounded-xl border-cyan-400/30 bg-black/40 text-slate-100 shadow-[0_0_0_1px_rgba(0,243,255,0.06)] hover:border-cyan-400/50 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20">
            <SelectValue placeholder="选择一个测试模块" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-cyan-400/20 bg-[#050911] text-slate-100 shadow-2xl">
            {TOOL_OPTIONS.map((option) => (
              <SelectItem
                key={option.type}
                value={option.type}
                className="rounded-lg py-2.5 text-slate-100 data-[highlighted]:bg-cyan-400/10 data-[highlighted]:text-cyan-100"
              >
                <span className="text-sm">{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          onClick={onConfirm}
          className="h-12 rounded-xl border border-cyan-400/20 bg-cyan-400/80 font-mono tracking-[0.12em] text-white shadow-[0_0_24px_rgba(0,243,255,0.16)] transition-all hover:bg-cyan-300/90"
        >
          挂载模块
        </Button>
      </div>
    </div>
  )
}

function ActiveNodeShell({
  node,
  onRequestUnmount,
}: {
  node: WorkspaceNode & { type: TelemetryNodeType }
  onRequestUnmount: () => void
}) {
  return (
    <div className="relative">
      <div className="absolute right-5 top-5 z-20 flex items-center rounded-full border border-white/[0.08] bg-black/55 px-3 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={onRequestUnmount}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono tracking-[0.08em] text-white transition-colors hover:border-rose-300/30 hover:bg-rose-400/10"
        >
          <X className="h-3.5 w-3.5" />
          删除模块
        </button>
      </div>
      {renderTelemetryModule(node.type, node.id)}
    </div>
  )
}

export default function LaboratoryPdfParserDashboard() {
  const [nodes, setNodes] = useState<WorkspaceNode[]>([{ id: 1, type: null, isConfirmed: false }])
  const [draftSelections, setDraftSelections] = useState<Record<number, TelemetryNodeType | "">>({ 1: "" })
  const [pendingUnmountNodeId, setPendingUnmountNodeId] = useState<number | null>(null)
  const [isExportingWorkspace, setIsExportingWorkspace] = useState(false)
  const nextNodeIdRef = useRef(2)
  const workspaceExportRef = useRef<HTMLDivElement | null>(null)

  const hasEmptyNode = nodes.some((node) => !node.isConfirmed || !node.type)
  const confirmedNodeCount = nodes.filter((node) => node.isConfirmed && node.type).length
  const pendingUnmountNode =
    pendingUnmountNodeId == null ? null : nodes.find((node) => node.id === pendingUnmountNodeId) ?? null
  const pendingUnmountOption =
    pendingUnmountNode?.type == null ? null : TOOL_OPTIONS.find((item) => item.type === pendingUnmountNode.type) ?? null

  const handleDraftChange = (nodeId: number, type: TelemetryNodeType) => {
    setDraftSelections((current) => ({ ...current, [nodeId]: type }))
  }

  const handleMountNode = (nodeId: number) => {
    const selectedType = draftSelections[nodeId]
    if (!selectedType) {
      toast.error("请先选择一个解析模块")
      return
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, type: selectedType, isConfirmed: true }
          : node,
      ),
    )
  }

  const handleUnmountNode = (nodeId: number) => {
    setNodes((current) => {
      const hasOtherEmptyNode = current.some(
        (node) => node.id !== nodeId && (!node.isConfirmed || !node.type),
      )

      if (hasOtherEmptyNode) {
        return current.filter((node) => node.id !== nodeId)
      }

      return current.map((node) =>
        node.id === nodeId
          ? { ...node, type: null, isConfirmed: false }
          : node,
      )
    })

    setDraftSelections((current) => {
      const next = { ...current }
      next[nodeId] = ""
      return next
    })
  }

  const handleConfirmUnmount = () => {
    if (pendingUnmountNodeId == null) return
    handleUnmountNode(pendingUnmountNodeId)
    setPendingUnmountNodeId(null)
  }

  const handleAddNode = () => {
    if (hasEmptyNode) {
      toast.error("当前已有一个空载节点，请先完成挂载")
      return
    }

    const id = nextNodeIdRef.current
    nextNodeIdRef.current += 1
    setNodes((current) => [...current, { id, type: null, isConfirmed: false }])
    setDraftSelections((current) => ({ ...current, [id]: "" }))
  }

  const handleExportWorkspacePdf = async () => {
    const target = workspaceExportRef.current
    if (!target || confirmedNodeCount === 0) {
      toast.error("当前没有可导出的测试模块")
      return
    }
    try {
      openPdfPreviewWindow({
        source: target,
        fileBaseName: "laboratory-workspace",
        onConfirmExport: async () => {
          setIsExportingWorkspace(true)
          try {
            await exportDomNodeAsPdf(target, "laboratory-workspace")
            toast.success("工作区 PDF 导出完成")
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "工作区 PDF 导出失败")
          } finally {
            setIsExportingWorkspace(false)
          }
        },
      })
      toast.success("PDF 预览已打开")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 预览打开失败")
    }
  }

  return (
    <main className="min-h-screen bg-[#020406] bg-[radial-gradient(circle_at_50%_20%,_rgba(0,243,255,0.06),_transparent_50%)] px-6 py-8 text-zinc-50 md:px-10 lg:px-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="rounded-[28px] border border-white/[0.06] bg-black/25 px-6 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-slate-100">实验室工作区</h1>
            <Button
              type="button"
              onClick={handleExportWorkspacePdf}
              disabled={isExportingWorkspace || confirmedNodeCount === 0}
              variant="outline"
              className="h-10 border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.06]"
            >
              {isExportingWorkspace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              导出 PDF
            </Button>
          </div>
        </div>

        <div ref={workspaceExportRef} className="flex flex-col gap-8">
          {nodes.map((node) => (
            <section key={node.id} className="w-full">
              {!node.isConfirmed || !node.type ? (
                <EmptyNodePortal
                  value={draftSelections[node.id] ?? ""}
                  onValueChange={(value) => handleDraftChange(node.id, value)}
                  onConfirm={() => handleMountNode(node.id)}
                />
              ) : (
                <ActiveNodeShell
                  node={{ ...node, type: node.type }}
                  onRequestUnmount={() => setPendingUnmountNodeId(node.id)}
                />
              )}
            </section>
          ))}

          <div
            onClick={handleAddNode}
            className="flex w-full cursor-pointer justify-center rounded-xl border-2 border-dashed border-white/10 py-6 transition-all hover:border-cyan-500/50 hover:bg-cyan-400/[0.03]"
          >
            <span className="inline-flex items-center gap-3 font-mono tracking-[0.08em] text-white">
              <Plus className="h-4 w-4" />
              添加测试模块
            </span>
          </div>
        </div>
      </div>

      <CyberConfirmDialog
        open={pendingUnmountNodeId !== null}
        title="删除模块确认"
        message={
          pendingUnmountOption
            ? `确定要删除当前 ${pendingUnmountOption.label} 节点吗？\n删除后该节点会从当前工作区移除。`
            : "确定要删除当前节点吗？\n删除后该节点会从当前工作区移除。"
        }
        onCancel={() => setPendingUnmountNodeId(null)}
        onConfirm={handleConfirmUnmount}
        confirmText="确认删除"
        cancelText="取消"
      />
    </main>
  )
}
