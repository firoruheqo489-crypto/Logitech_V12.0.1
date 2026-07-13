import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import BatteryCycleDashboard from "./battery-cycle/BatteryCycleDashboard"
import { LaboratoryPrintSurface } from "./laboratory/LaboratoryPrintSurface"
import {
  LABORATORY_MODULES,
  buildIntegratingSphereModuleSummary,
  buildLaboratoryExportGate,
  buildLaboratoryOverallAdjudication,
  buildMountedModuleSummary,
  getLaboratoryModuleDefinition,
  type LaboratoryExportGate,
  type LaboratoryModuleSummary,
  type LaboratoryOverallVerdict,
  type LaboratoryReportMeta,
  type TelemetryNodeType,
} from "./laboratory/laboratory-contract"
import ReliabilityCalculatorDashboard from "./ReliabilityCalculatorDashboard"
import TimeSeriesDashboard from "./TimeSeriesDashboard"
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

const REPORT_META_FIELDS: Array<{ key: keyof LaboratoryReportMeta; label: string; placeholder: string }> = [
  { key: "reportNo", label: "报告编号", placeholder: "LAB-20260712-001" },
  { key: "projectName", label: "项目名称", placeholder: "输入项目名称" },
  { key: "sampleName", label: "样品名称", placeholder: "输入样品名称" },
  { key: "sampleNo", label: "样品编号", placeholder: "输入样品编号" },
  { key: "customer", label: "客户/项目方", placeholder: "输入客户或项目方" },
  { key: "stage", label: "测试阶段", placeholder: "EVT / DVT / PVT" },
  { key: "testDate", label: "测试日期", placeholder: "YYYY-MM-DD" },
  { key: "operator", label: "测试人员", placeholder: "输入测试人员" },
  { key: "reviewer", label: "审核人员", placeholder: "输入审核人员" },
]

const LABORATORY_REPORT_META_STORAGE_KEY = "dashboard:laboratory-report-meta:v1"

function getTodayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function createInitialReportMeta(): LaboratoryReportMeta {
  const today = getTodayDateValue()
  return {
    reportNo: `LAB-${today.replace(/-/g, "")}-001`,
    projectName: "",
    sampleName: "",
    sampleNo: "",
    customer: "",
    stage: "",
    testDate: today,
    operator: "",
    reviewer: "",
  }
}

function readInitialReportMeta(): LaboratoryReportMeta {
  const fallback = createInitialReportMeta()
  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(LABORATORY_REPORT_META_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Record<keyof LaboratoryReportMeta, unknown>>

    return REPORT_META_FIELDS.reduce<LaboratoryReportMeta>(
      (meta, field) => ({
        ...meta,
        [field.key]: typeof parsed[field.key] === "string" ? parsed[field.key] : meta[field.key],
      }),
      fallback,
    )
  } catch {
    return fallback
  }
}

function overallVerdictTone(verdict: LaboratoryOverallVerdict) {
  if (verdict === "FAIL") return "border-rose-300/25 bg-rose-400/[0.06] text-rose-200"
  if (verdict === "WATCH") return "border-amber-300/25 bg-amber-400/[0.06] text-amber-200"
  if (verdict === "PASS") return "border-cyan-300/25 bg-cyan-400/[0.06] text-cyan-200"
  return "border-white/[0.08] bg-white/[0.03] text-slate-300"
}

function exportGateTone(gate: LaboratoryExportGate) {
  if (gate.level === "block") return "border-rose-300/25 bg-rose-400/[0.06] text-rose-200"
  if (gate.level === "watch") return "border-amber-300/25 bg-amber-400/[0.06] text-amber-200"
  return "border-cyan-300/25 bg-cyan-400/[0.06] text-cyan-200"
}

function areModuleSummariesEqual(
  previous: LaboratoryModuleSummary | null | undefined,
  next: LaboratoryModuleSummary | null,
) {
  if (!previous && !next) return true
  if (!previous || !next) return false
  return JSON.stringify(previous) === JSON.stringify(next)
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

function IntegratingSphereTool({
  nodeId,
  onSummaryChange,
}: {
  nodeId: number
  onSummaryChange: (summary: LaboratoryModuleSummary | null) => void
}) {
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

  const publishSummary = (nextResults: VariantParsePayload[], nextActiveKey: LightVariantKey) => {
    if (nextResults.length === 0) {
      onSummaryChange(null)
      return
    }

    const activeEntry = nextResults.find((entry) => entry.key === nextActiveKey) ?? nextResults[0]
    const activeViewModel = buildReportViewModel(activeEntry.fileName, activeEntry.result)
    const verdict: "PASS" | "FAIL" = nextResults.every(
      (entry) => buildReportViewModel(entry.fileName, entry.result).reportMeta.judgment === "PASS",
    )
      ? "PASS"
      : "FAIL"

    onSummaryChange(
      buildIntegratingSphereModuleSummary(nodeId, {
        verdict,
        sourceFiles: nextResults.map((entry) => `${entry.label}:${entry.fileName}`),
        activeVariantLabel: activeEntry.label,
        parsedCount: nextResults.length,
        expectedCount: VARIANT_ORDER.length,
        activeMetrics: {
          productModel: activeViewModel.reportMeta.productModel,
          testDate: activeViewModel.reportMeta.testDate,
          flux: activeViewModel.luminousOutput[0],
          efficacy: activeViewModel.luminousOutput[1],
          cct: activeViewModel.colorQuality[0],
          raR9: activeViewModel.colorQuality[1],
          power: activeViewModel.electricalInput[2],
        },
      }),
    )
  }

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
    onSummaryChange(null)
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
      const nextActiveKey = payloads[0]?.key ?? "white"
      setActiveVariantKey(nextActiveKey)
      publishSummary(payloads, nextActiveKey)
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

function renderTelemetryModule(
  type: TelemetryNodeType,
  nodeId: number,
  onSummaryChange: (summary: LaboratoryModuleSummary | null) => void,
) {
  switch (type) {
    case "INTEGRATING_SPHERE":
      return (
        <IntegratingSphereTool
          key={`integrating-sphere-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
    case "DARKROOM":
      return (
        <DarkroomTelemetryWorkspace
          key={`darkroom-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
    case "FLICKER":
      return (
        <FlickerTelemetryWorkspace
          key={`flicker-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
    case "EMISSION":
      return (
        <EmcRadiationWorkspace
          key={`emission-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
    case "HARMONIC":
      return (
        <HarmonicTelemetryWorkspace
          key={`harmonic-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
    case "RELIABILITY_LIFE":
      return (
        <ReliabilityCalculatorDashboard
          key={`reliability-life-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
    case "TIME_SERIES":
      return (
        <TimeSeriesDashboard
          key={`time-series-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          titleZh="温升测试"
          titleEn="TEMPERATURE RISE TEST"
        />
      )
    case "BATTERY_CYCLE":
      return (
        <BatteryCycleDashboard
          key={`battery-cycle-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
        />
      )
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
            {LABORATORY_MODULES.map((option) => (
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
  onNodeSummaryChange,
}: {
  node: WorkspaceNode & { type: TelemetryNodeType }
  onRequestUnmount: () => void
  onNodeSummaryChange: (nodeId: number, summary: LaboratoryModuleSummary | null) => void
}) {
  const handleSummaryChange = useCallback(
    (summary: LaboratoryModuleSummary | null) => onNodeSummaryChange(node.id, summary),
    [node.id, onNodeSummaryChange],
  )

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
      {renderTelemetryModule(node.type, node.id, handleSummaryChange)}
    </div>
  )
}

export default function LaboratoryPdfParserDashboard() {
  const [nodes, setNodes] = useState<WorkspaceNode[]>([{ id: 1, type: null, isConfirmed: false }])
  const [draftSelections, setDraftSelections] = useState<Record<number, TelemetryNodeType | "">>({ 1: "" })
  const [pendingUnmountNodeId, setPendingUnmountNodeId] = useState<number | null>(null)
  const [isExportingWorkspace, setIsExportingWorkspace] = useState(false)
  const [nodeSummaries, setNodeSummaries] = useState<Record<number, LaboratoryModuleSummary>>({})
  const [reportMeta, setReportMeta] = useState<LaboratoryReportMeta>(() => readInitialReportMeta())
  const nextNodeIdRef = useRef(2)
  const printExportRef = useRef<HTMLDivElement | null>(null)

  const hasEmptyNode = nodes.some((node) => !node.isConfirmed || !node.type)
  const confirmedNodeCount = nodes.filter((node) => node.isConfirmed && node.type).length
  const moduleSummaries = useMemo<LaboratoryModuleSummary[]>(
    () =>
      nodes
        .filter((node): node is WorkspaceNode & { type: TelemetryNodeType } => Boolean(node.isConfirmed && node.type))
        .map((node) => nodeSummaries[node.id] ?? buildMountedModuleSummary(node.id, node.type)),
    [nodeSummaries, nodes],
  )
  const printableModuleCount = moduleSummaries.filter((summary) => {
    const definition = getLaboratoryModuleDefinition(summary.type)
    return definition?.supportsPrint
  }).length
  const overallAdjudication = useMemo(
    () => buildLaboratoryOverallAdjudication(moduleSummaries),
    [moduleSummaries],
  )
  const exportGate = useMemo(
    () => buildLaboratoryExportGate(moduleSummaries, reportMeta),
    [moduleSummaries, reportMeta],
  )
  const pendingUnmountNode =
    pendingUnmountNodeId == null ? null : nodes.find((node) => node.id === pendingUnmountNodeId) ?? null
  const pendingUnmountOption =
    pendingUnmountNode?.type == null ? null : getLaboratoryModuleDefinition(pendingUnmountNode.type)

  useEffect(() => {
    try {
      window.localStorage.setItem(LABORATORY_REPORT_META_STORAGE_KEY, JSON.stringify(reportMeta))
    } catch {
      // Local persistence is a convenience only; export should continue if storage is unavailable.
    }
  }, [reportMeta])

  const handleReportMetaChange = (key: keyof LaboratoryReportMeta, value: string) => {
    setReportMeta((current) => ({ ...current, [key]: value }))
  }

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
    setNodeSummaries((current) => {
      const next = { ...current }
      delete next[nodeId]
      return next
    })

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

  const handleNodeSummaryChange = useCallback((nodeId: number, summary: LaboratoryModuleSummary | null) => {
    setNodeSummaries((current) => {
      if (areModuleSummariesEqual(current[nodeId], summary)) {
        return current
      }

      const next = { ...current }
      if (summary) next[nodeId] = summary
      else delete next[nodeId]
      return next
    })
  }, [])

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
    const target = printExportRef.current
    if (!target || confirmedNodeCount === 0) {
      toast.error("当前没有可导出的测试模块")
      return
    }
    if (!exportGate.canExport) {
      toast.error(exportGate.reasons[0] ?? "导出门禁未通过")
      return
    }

    setIsExportingWorkspace(true)
    try {
      if (exportGate.level === "watch") {
        toast.warning(exportGate.reasons[0] ?? "当前报告包含观察或失败项，将按风险报告导出")
      }
      const safeReportNo = reportMeta.reportNo.trim().replace(/[\\/:*?"<>|]/g, "-") || "laboratory-workspace"
      await exportDomNodeAsPdf(target, safeReportNo)
      toast.success("实验室综合 PDF 导出完成")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "工作区 PDF 导出失败")
    } finally {
      setIsExportingWorkspace(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#020406] bg-[radial-gradient(circle_at_50%_20%,_rgba(0,243,255,0.06),_transparent_50%)] px-6 py-8 text-zinc-50 md:px-10 lg:px-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-cyan-300">// LABORATORY COMMAND CENTER</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-100">实验室工作区</h1>
              <p className="mt-1 text-xs text-slate-500">
                已挂载 {confirmedNodeCount} 个模块 / 可打印 {printableModuleCount} 个模块
              </p>
            </div>

            <div className="grid min-w-[420px] gap-3 md:grid-cols-[150px_150px_1fr]">
              <div className={`rounded-2xl border px-4 py-3 ${overallVerdictTone(overallAdjudication.verdict)}`}>
                <p className="font-mono text-[9px] tracking-[0.18em] opacity-70">综合判定</p>
                <p className="mt-1 font-mono text-sm font-bold">{overallAdjudication.verdict}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${exportGateTone(exportGate)}`}>
                <p className="font-mono text-[9px] tracking-[0.18em] opacity-70">导出门禁</p>
                <p className="mt-1 font-mono text-sm font-bold">{exportGate.label}</p>
              </div>
              <Button
                type="button"
                onClick={handleExportWorkspacePdf}
                disabled={isExportingWorkspace || !exportGate.canExport}
                variant="outline"
                className="h-full min-h-16 border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isExportingWorkspace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出综合 PDF
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-white/[0.05] bg-black/25 p-4 md:grid-cols-3 xl:grid-cols-9">
            {REPORT_META_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="font-mono text-[9px] tracking-[0.16em] text-slate-500">{field.label}</span>
                <input
                  value={reportMeta[field.key]}
                  onChange={(event) => handleReportMetaChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="mt-2 h-9 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-cyan-300/[0.04]"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/[0.05] bg-black/20 p-4">
              <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">// 综合结论</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{overallAdjudication.summary}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-black/20 p-4">
              <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">// 门禁原因</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {exportGate.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-slate-300"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
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
                  onNodeSummaryChange={handleNodeSummaryChange}
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

      <div className="fixed left-[-100000px] top-0" aria-hidden="true">
        <div ref={printExportRef}>
          <LaboratoryPrintSurface
            summaries={moduleSummaries}
            meta={reportMeta}
            overall={overallAdjudication}
          />
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
