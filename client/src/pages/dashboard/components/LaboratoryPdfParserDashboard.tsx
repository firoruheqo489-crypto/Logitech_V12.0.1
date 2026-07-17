import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Circle,
  Archive,
  ArrowLeft,
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
import {
  getEngineeringSpecArchiveDocumentState,
  listEngineeringSpecArchives,
  type EngineeringSpecArchiveState,
  type EngineeringSpecLedgerRecord,
} from "@/lib/engineering-spec-ledger-api"
import { sanitizeEngineeringSpecLedgerRecords } from "@/lib/engineering-spec-ledger-clean"
import { createLaboratoryArchive, type LaboratoryArchiveState } from "@/lib/laboratory-archive-api"
import { DarkroomTelemetryWorkspace } from "./DarkroomTelemetryWorkspace"
import EmcRadiationWorkspace from "./EmcRadiationWorkspace"
import { FlickerTelemetryWorkspace } from "./FlickerTelemetryWorkspace"
import HarmonicTelemetryWorkspace from "./HarmonicTelemetryWorkspace"
import BatteryCycleDashboard from "./battery-cycle/BatteryCycleDashboard"
import "./final-sample-report/styles/final-sample-report.css"
import { FinalSampleReportPage } from "./final-sample-report/source-page"
import { FinalSampleReportDataProvider, useReportData } from "./final-sample-report/report-data-context"
import { getOverallStats } from "./final-sample-report/report-data"
import { LaboratoryArchivePanel } from "./laboratory/LaboratoryArchivePanel"
import { LaboratoryPrintSurface } from "./laboratory/LaboratoryPrintSurface"
import { ProductIllustrationGallery } from "./laboratory/ProductIllustrationGallery"
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
  results?: IntegratingSphereParseResult[]
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

type LaboratoryWorkspaceDraft = {
  nodes: WorkspaceNode[]
  draftSelections: Record<number, TelemetryNodeType | "">
  nodeSummaries: Record<number, LaboratoryModuleSummary>
  reportMeta?: LaboratoryReportMeta
  selectedSpecId?: string
}

const LABORATORY_WORKSPACE_DRAFT_PREFIX = "dashboard:laboratory-workspace-draft:v2"
const LEGACY_LABORATORY_WORKSPACE_DRAFT_PREFIX = "dashboard:laboratory-workspace-draft:v1"

function readLaboratoryWorkspaceDraft(projectId: string): LaboratoryWorkspaceDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`${LABORATORY_WORKSPACE_DRAFT_PREFIX}:${projectId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LaboratoryWorkspaceDraft>
    if (!Array.isArray(parsed.nodes) || !parsed.draftSelections || !parsed.nodeSummaries) return null
    return parsed as LaboratoryWorkspaceDraft
  } catch {
    return null
  }
}

function writeLaboratoryWorkspaceDraft(projectId: string, draft: LaboratoryWorkspaceDraft): void {
  try {
    window.localStorage.setItem(`${LABORATORY_WORKSPACE_DRAFT_PREFIX}:${projectId}`, JSON.stringify(draft))
  } catch {
    // Draft persistence is best-effort.
  }
}

function clearLaboratoryWorkspaceDraft(projectId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(`${LABORATORY_WORKSPACE_DRAFT_PREFIX}:${projectId}`)
    window.localStorage.removeItem(`${LEGACY_LABORATORY_WORKSPACE_DRAFT_PREFIX}:${projectId}`)
    window.localStorage.removeItem(LABORATORY_REPORT_META_STORAGE_KEY)
    window.localStorage.removeItem(LABORATORY_SELECTED_SPEC_STORAGE_KEY)
  } catch {
    // Draft cleanup is best-effort.
  }
}

type LaboratoryViewMode = "workspace" | "archive"

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
const LABORATORY_SELECTED_SPEC_STORAGE_KEY = "dashboard:laboratory-selected-spec:v1"
const LABORATORY_PRODUCT_ILLUSTRATION_STORAGE_PREFIX = "dashboard:laboratory-product-illustrations:v1"

type LaboratorySpecHeader = {
  productManager: string
  structuralEngineer: string
  electronicEngineer: string
  testType: string
  sampleDeliveryDate: string
}

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

function compactJoin(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" / ")
}

function formatSpecOptionLabel(record: EngineeringSpecLedgerRecord) {
  return compactJoin([record.sku, record.spu]) || record.description || record.id
}

function findSpecMetaValue(
  entries: Array<{ label: string; value: string }> | undefined,
  labels: string[],
) {
  if (!entries?.length) return ""
  const normalizedLabels = labels.map((label) => label.replace(/\s+/g, "").toLowerCase())
  const match = entries.find((entry) =>
    normalizedLabels.includes(String(entry.label || "").replace(/\s+/g, "").toLowerCase()),
  )
  return match?.value?.trim() || ""
}

function buildLaboratorySpecHeader(
  record: EngineeringSpecLedgerRecord | null,
  state: EngineeringSpecArchiveState | null,
): LaboratorySpecHeader {
  const businessMeta = state?.businessMeta
  return {
    productManager:
      findSpecMetaValue(businessMeta, ["产品经理"]) ||
      record?.productGroup?.trim() ||
      "--",
    structuralEngineer: findSpecMetaValue(businessMeta, ["结构工程师"]) || "--",
    electronicEngineer: findSpecMetaValue(businessMeta, ["电子工程师"]) || "--",
    testType:
      state?.inspectionTestProject?.testType?.trim() ||
      record?.sampleType?.trim() ||
      "--",
    sampleDeliveryDate:
      state?.inspectionTestProject?.sampleDeliveryDate?.trim() ||
      record?.testDate?.trim() ||
      "--",
  }
}

function buildReportMetaFromSpecRecord(
  current: LaboratoryReportMeta,
  record: EngineeringSpecLedgerRecord,
  specHeader?: LaboratorySpecHeader,
): LaboratoryReportMeta {
  const projectName = record.spu?.trim() || record.type?.trim() || record.category?.trim()
  const sampleName = record.description?.trim() || record.sku?.trim()
  const sampleNo = record.sku?.trim() || current.sampleNo
  const customer = compactJoin([record.department, record.productGroup])
  const stage = specHeader?.testType !== "--" ? specHeader?.testType : record.sampleType?.trim() || current.stage
  const testDate =
    specHeader?.sampleDeliveryDate !== "--" ? specHeader?.sampleDeliveryDate : record.testDate?.trim() || current.testDate
  const operator =
    specHeader?.productManager !== "--" ? specHeader?.productManager : record.productGroup?.trim() || current.operator

  return {
    ...current,
    projectName: projectName || current.projectName,
    sampleName: sampleName || current.sampleName,
    sampleNo,
    customer: customer || current.customer,
    stage: stage || current.stage,
    testDate: testDate || current.testDate,
    operator: operator || current.operator,
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

function expandConsolidatedSphereReport(
  variant: VariantSelection,
  payload: ParseResponse,
): VariantParsePayload[] {
  const reports = payload.results ?? []
  if (reports.length < 2) {
    return [{ key: variant.key, label: variant.label, fileName: payload.fileName || variant.file?.name || "--", result: payload.result }]
  }

  const orderedVariants = [...VARIANT_ORDER].sort((left, right) => {
    const order: Record<LightVariantKey, number> = { warm: 0, neutral: 1, white: 2 }
    return order[left.key] - order[right.key]
  })
  return [...reports]
    .sort((left, right) => (left.cct_k ?? Number.MAX_SAFE_INTEGER) - (right.cct_k ?? Number.MAX_SAFE_INTEGER))
    .slice(0, orderedVariants.length)
    .map((result, index) => ({
      key: orderedVariants[index].key,
      label: orderedVariants[index].label,
      fileName: `${payload.fileName || variant.file?.name || "--"} · 第${(result as IntegratingSphereParseResult & { page_index?: number }).page_index ?? index + 1}页`,
      result,
    }))
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
  initialSummary,
}: {
  nodeId: number
  onSummaryChange: (summary: LaboratoryModuleSummary | null) => void
  initialSummary?: LaboratoryModuleSummary
}) {
  const [selectedFiles, setSelectedFiles] = useState<VariantSelection[]>(
    VARIANT_ORDER.map((variant) => ({ ...variant, file: null })),
  )
  const persistedModuleData = initialSummary?.moduleData as
    | { results?: VariantParsePayload[]; activeVariantKey?: LightVariantKey }
    | undefined
  const initialResults = Array.isArray(persistedModuleData?.results) ? persistedModuleData.results : []
  const [activeVariantKey, setActiveVariantKey] = useState<LightVariantKey>(
    persistedModuleData?.activeVariantKey ?? initialResults[0]?.key ?? "white",
  )
  const [isParsing, setIsParsing] = useState(false)
  const [results, setResults] = useState<VariantParsePayload[]>(initialResults)

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

    onSummaryChange({
      ...buildIntegratingSphereModuleSummary(nodeId, {
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
      moduleData: {
        results: nextResults,
        activeVariantKey: nextActiveKey,
      },
    })
  }

  const handleVariantFileChange = (variantKey: LightVariantKey, file: File | null) => {
    if (file) {
      const duplicate = selectedFiles.some(
        (entry) =>
          entry.key !== variantKey &&
          entry.file &&
          entry.file.name === file.name &&
          entry.file.size === file.size &&
          entry.file.lastModified === file.lastModified,
      )
      if (duplicate) {
        toast.error("同一份积分球报告不能重复上传", { description: "请为不同光源选择不同报告，或直接上传三合一 PDF。" })
        return
      }
    }
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
        payloads.push(...expandConsolidatedSphereReport(variant, payload))
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
  context?: {
    productIllustrationStorageKey: string
    productIllustrationEntityId: string
    initialSummary?: LaboratoryModuleSummary
  },
) {
  switch (type) {
    case "INTEGRATING_SPHERE":
      return (
        <IntegratingSphereTool
          key={`integrating-sphere-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "DARKROOM":
      return (
        <DarkroomTelemetryWorkspace
          key={`darkroom-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "FLICKER":
      return (
        <FlickerTelemetryWorkspace
          key={`flicker-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "EMISSION":
      return (
        <EmcRadiationWorkspace
          key={`emission-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "HARMONIC":
      return (
        <HarmonicTelemetryWorkspace
          key={`harmonic-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "FINAL_SAMPLE_REPORT":
      return (
        <FinalSampleReportLaboratoryWorkspace
          key={`final-sample-report-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "PRODUCT_ILLUSTRATION":
      return (
        <ProductIllustrationGallery
          key={`product-illustration-${nodeId}-${context?.productIllustrationStorageKey ?? "unbound"}`}
          storageKey={context?.productIllustrationStorageKey ?? "dashboard:laboratory-product-illustrations:v1:unbound"}
          entityId={context?.productIllustrationEntityId ?? "laboratory__unbound"}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "RELIABILITY_LIFE":
      return (
        <ReliabilityCalculatorDashboard
          key={`reliability-life-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
        />
      )
    case "TIME_SERIES":
      return (
        <TimeSeriesDashboard
          key={`time-series-${nodeId}`}
          nodeId={nodeId}
          onSummaryChange={onSummaryChange}
          initialSummary={context?.initialSummary}
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
          initialSummary={context?.initialSummary}
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

function FinalSampleReportSummaryBridge({
  nodeId,
  onSummaryChange,
}: {
  nodeId: number
  onSummaryChange: (summary: LaboratoryModuleSummary | null) => void
}) {
  const { data, isLoading, error, sourceName, sourceKind, syncedAt } = useReportData()

  useEffect(() => {
    if (isLoading) {
      onSummaryChange({
        nodeId,
        type: "FINAL_SAMPLE_REPORT",
        label: "终样报告",
        printTitle: "终样测试报告",
        category: "综合",
        status: "mounted",
        verdict: "待解析",
        sourceFiles: [],
        keyMetrics: [{ label: "数据源", value: "读取中" }],
        warnings: ["终样报告数据正在读取。"],
      })
      return
    }

    if (error) {
      onSummaryChange({
        nodeId,
        type: "FINAL_SAMPLE_REPORT",
        label: "终样报告",
        printTitle: "终样测试报告",
        category: "综合",
        status: "fail",
        verdict: "FAIL",
        sourceFiles: [sourceName],
        keyMetrics: [{ label: "读取状态", value: "失败" }],
        warnings: [`终样报告读取失败：${error}`],
      })
      return
    }

    const stats = getOverallStats(data.modules)
    const verdict = stats.fail > 0 ? "FAIL" : stats.untested > 0 || stats.riskCount > 0 ? "WATCH" : "PASS"

    onSummaryChange({
      nodeId,
      type: "FINAL_SAMPLE_REPORT",
      label: "终样报告",
      printTitle: "终样测试报告",
      category: "综合",
      status: verdict === "FAIL" ? "fail" : verdict === "WATCH" ? "watch" : "parsed",
      verdict,
      sourceFiles: [sourceName],
      keyMetrics: [
        { label: "产品型号", value: data.meta.productModel || "--" },
        { label: "执行覆盖", value: `${stats.coverage}%` },
        { label: "模块通过", value: `${stats.modulePass}/${stats.moduleTotal}` },
        { label: "失败项", value: String(stats.fail) },
        { label: "未测项", value: String(stats.untested) },
      ],
      warnings: [
        ...(stats.fail > 0 ? [`终样报告存在 ${stats.fail} 个失败项。`] : []),
        ...(stats.untested > 0 ? [`终样报告存在 ${stats.untested} 个未测项。`] : []),
        ...(stats.riskCount > 0 ? [`终样报告存在 ${stats.riskCount} 个风险标记项。`] : []),
      ],
      moduleData: {
        version: 1,
        data,
        sourceName,
        sourceKind,
        syncedAt,
      },
    })
  }, [data, error, isLoading, nodeId, onSummaryChange, sourceKind, sourceName, syncedAt])

  return null
}

function FinalSampleReportLaboratoryWorkspace({
  nodeId,
  onSummaryChange,
  initialSummary,
}: {
  nodeId: number
  onSummaryChange: (summary: LaboratoryModuleSummary | null) => void
  initialSummary?: LaboratoryModuleSummary
}) {
  const initialSource = initialSummary?.moduleData as
    | import("./final-sample-report/report-data-context").PersistedReportSource
    | undefined

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#020406]">
      <div className="final-sample-report-bleed final-sample-report-scope">
        <FinalSampleReportDataProvider initialSource={initialSource}>
          <FinalSampleReportSummaryBridge nodeId={nodeId} onSummaryChange={onSummaryChange} />
          <FinalSampleReportPage />
        </FinalSampleReportDataProvider>
      </div>
    </div>
  )
}

function ActiveNodeShell({
  node,
  onRequestUnmount,
  onNodeSummaryChange,
  productIllustrationStorageKey,
  productIllustrationEntityId,
  initialSummary,
}: {
  node: WorkspaceNode & { type: TelemetryNodeType }
  onRequestUnmount: () => void
  onNodeSummaryChange: (nodeId: number, summary: LaboratoryModuleSummary | null) => void
  productIllustrationStorageKey: string
  productIllustrationEntityId: string
  initialSummary?: LaboratoryModuleSummary
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
      {renderTelemetryModule(node.type, node.id, handleSummaryChange, {
        productIllustrationStorageKey,
        productIllustrationEntityId,
        initialSummary,
      })}
    </div>
  )
}

export default function LaboratoryPdfParserDashboard({
  projectName = "",
  archiveOnly = false,
}: {
  projectName?: string;
  archiveOnly?: boolean;
}) {
  const projectId = projectName.trim() || "default-engineering-spec-workspace"
  const hydratedDraftRef = useRef(false)
  const clearDraftAfterArchiveRef = useRef(false)
  const [archiveOnlyMode, setArchiveOnlyMode] = useState(archiveOnly)
  const [nodes, setNodes] = useState<WorkspaceNode[]>([{ id: 1, type: null, isConfirmed: false }])
  const [draftSelections, setDraftSelections] = useState<Record<number, TelemetryNodeType | "">>({ 1: "" })
  const [activeLaboratoryView, setActiveLaboratoryView] = useState<LaboratoryViewMode>(
    archiveOnly ? "archive" : "workspace",
  )
  const [pendingUnmountNodeId, setPendingUnmountNodeId] = useState<number | null>(null)
  const [isExportingWorkspace, setIsExportingWorkspace] = useState(false)
  const [isArchivingLaboratoryReport, setIsArchivingLaboratoryReport] = useState(false)
  const [isEditingArchivedReport, setIsEditingArchivedReport] = useState(false)
  const [restoredArchiveReportNo, setRestoredArchiveReportNo] = useState("")
  const [nodeSummaries, setNodeSummaries] = useState<Record<number, LaboratoryModuleSummary>>({})
  const [reportMeta, setReportMeta] = useState<LaboratoryReportMeta>(() => createInitialReportMeta())
  const [selectedSpecId, setSelectedSpecId] = useState("")
  const [ledgerRecords, setLedgerRecords] = useState<EngineeringSpecLedgerRecord[]>([])
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)
  const [selectedSpecState, setSelectedSpecState] = useState<EngineeringSpecArchiveState | null>(null)
  const [isLoadingSpecDetail, setIsLoadingSpecDetail] = useState(false)
  const nextNodeIdRef = useRef(2)
  const printExportRef = useRef<HTMLDivElement | null>(null)
  const sanitizedLedgerRecords = useMemo(
    () => sanitizeEngineeringSpecLedgerRecords(ledgerRecords),
    [ledgerRecords],
  )
  const selectedSpecRecord = useMemo(
    () => sanitizedLedgerRecords.find((record) => record.id === selectedSpecId) ?? null,
    [sanitizedLedgerRecords, selectedSpecId],
  )
  const specHeader = useMemo(
    () => buildLaboratorySpecHeader(selectedSpecRecord, selectedSpecState),
    [selectedSpecRecord, selectedSpecState],
  )

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
  const productIllustrationScope = selectedSpecId || selectedSpecRecord?.sku || "unbound"
  const productIllustrationStorageKey = `${LABORATORY_PRODUCT_ILLUSTRATION_STORAGE_PREFIX}:${projectId}:${productIllustrationScope}`
  const productIllustrationEntityId = `${projectId}__${productIllustrationScope}`
  const laboratoryArchiveState = useMemo(
    () => ({
      reportMeta,
      specHeader,
      selectedSpecId: selectedSpecId || undefined,
      selectedSpecLabel: selectedSpecRecord ? formatSpecOptionLabel(selectedSpecRecord) : undefined,
      moduleSummaries,
      overallAdjudication,
      exportGate,
      workspaceDraft: { nodes, draftSelections, nodeSummaries },
      imageUrl: selectedSpecRecord?.imageUrl,
    }),
    [draftSelections, exportGate, moduleSummaries, nodeSummaries, nodes, overallAdjudication, reportMeta, selectedSpecId, selectedSpecRecord, specHeader],
  )
  const canArchiveLaboratoryReport = moduleSummaries.length > 0 && Boolean(reportMeta.reportNo.trim())

  useEffect(() => {
    try {
      window.localStorage.removeItem(`${LEGACY_LABORATORY_WORKSPACE_DRAFT_PREFIX}:${projectId}`)
      window.localStorage.removeItem(LABORATORY_REPORT_META_STORAGE_KEY)
      window.localStorage.removeItem(LABORATORY_SELECTED_SPEC_STORAGE_KEY)
    } catch {
      // Legacy cleanup is best-effort.
    }
    const draft = readLaboratoryWorkspaceDraft(projectId)
    if (draft) {
      setNodes(draft.nodes)
      setDraftSelections(draft.draftSelections)
      setNodeSummaries(draft.nodeSummaries)
      if (draft.reportMeta) setReportMeta(draft.reportMeta)
      if (typeof draft.selectedSpecId === "string") setSelectedSpecId(draft.selectedSpecId)
      nextNodeIdRef.current = Math.max(1, ...draft.nodes.map((node) => node.id + 1))
    }
    hydratedDraftRef.current = true
  }, [projectId])

  useEffect(() => {
    if (!hydratedDraftRef.current) return
    if (clearDraftAfterArchiveRef.current) {
      clearDraftAfterArchiveRef.current = false
      clearLaboratoryWorkspaceDraft(projectId)
      return
    }
    writeLaboratoryWorkspaceDraft(projectId, { nodes, draftSelections, nodeSummaries, reportMeta, selectedSpecId })
  }, [draftSelections, nodeSummaries, nodes, projectId, reportMeta, selectedSpecId])

  useEffect(() => {
    let cancelled = false

    const loadLedger = async () => {
      setIsLoadingLedger(true)
      try {
        const documents = await listEngineeringSpecArchives(projectId)
        if (!cancelled) {
          setLedgerRecords(documents)
        }
      } catch (error) {
        if (!cancelled) {
          setLedgerRecords([])
          toast.error("规格书台账读取失败", {
            description: error instanceof Error ? error.message : "请先确认产品规格书看板已有归档数据",
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLedger(false)
        }
      }
    }

    void loadLedger()

    return () => {
      cancelled = true
    }
  }, [projectId])

  const loadSpecDetail = useCallback(
    async (record: EngineeringSpecLedgerRecord) => {
      setIsLoadingSpecDetail(true)
      try {
        const snapshot = await getEngineeringSpecArchiveDocumentState({
          projectId,
          documentId: record.id,
        })
        const nextHeader = buildLaboratorySpecHeader(record, snapshot.state)
        setSelectedSpecState(snapshot.state)
        setReportMeta((current) => buildReportMetaFromSpecRecord(current, record, nextHeader))
      } catch (error) {
        setSelectedSpecState(null)
        const fallbackHeader = buildLaboratorySpecHeader(record, null)
        setReportMeta((current) => buildReportMetaFromSpecRecord(current, record, fallbackHeader))
        toast.error("规格书详情读取失败", {
          description: error instanceof Error ? error.message : "已使用台账摘要字段回填",
        })
      } finally {
        setIsLoadingSpecDetail(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    if (!selectedSpecRecord) {
      setSelectedSpecState(null)
      return
    }

    void loadSpecDetail(selectedSpecRecord)
  }, [loadSpecDetail, selectedSpecRecord])

  const handleSpecRecordSelect = (recordId: string) => {
    setSelectedSpecId(recordId)
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

  const handleArchiveLaboratoryReport = async () => {
    if (!canArchiveLaboratoryReport) {
      toast.error("当前报告尚不可归档", { description: "请先填写报告编号并完成至少一个测试模块。" })
      return
    }

    setIsArchivingLaboratoryReport(true)
    try {
      const wasEditingArchivedReport = isEditingArchivedReport
      const stateToArchive = isEditingArchivedReport && restoredArchiveReportNo
        ? {
            ...laboratoryArchiveState,
            reportMeta: { ...laboratoryArchiveState.reportMeta, reportNo: restoredArchiveReportNo },
          }
        : laboratoryArchiveState
      await createLaboratoryArchive({ projectId, state: stateToArchive })
      clearDraftAfterArchiveRef.current = true
      clearLaboratoryWorkspaceDraft(projectId)
      try {
        window.localStorage.removeItem(productIllustrationStorageKey)
      } catch {
        // Module draft cleanup is best-effort.
      }
      setNodes([{ id: 1, type: null, isConfirmed: false }])
      setDraftSelections({ 1: "" })
      setNodeSummaries({})
      setReportMeta(createInitialReportMeta())
      setSelectedSpecId("")
      setSelectedSpecState(null)
      setIsEditingArchivedReport(false)
      setRestoredArchiveReportNo("")
      if (wasEditingArchivedReport) {
        setActiveLaboratoryView("archive")
        setArchiveOnlyMode(archiveOnly)
      }
      window.dispatchEvent(new CustomEvent("laboratory-archive-updated", { detail: { projectId } }))
      toast.success(isEditingArchivedReport ? "归档报告已覆盖更新" : "实验室报告已新建归档")
    } catch (error) {
      toast.error("实验室报告归档失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsArchivingLaboratoryReport(false)
    }
  }

  const handleRestoreLaboratoryArchive = (state: LaboratoryArchiveState) => {
    const draft = state.workspaceDraft
    if (draft) {
      setNodes(draft.nodes as WorkspaceNode[])
      setDraftSelections(draft.draftSelections as Record<number, TelemetryNodeType | "">)
      setNodeSummaries(draft.nodeSummaries as Record<number, LaboratoryModuleSummary>)
      nextNodeIdRef.current = Math.max(1, ...draft.nodes.map((node) => node.id + 1))
    }
    setReportMeta(state.reportMeta)
    setRestoredArchiveReportNo(state.reportMeta.reportNo)
    setIsEditingArchivedReport(true)
    setSelectedSpecId(state.selectedSpecId || "")
    setActiveLaboratoryView("workspace")
    setArchiveOnlyMode(false)
    toast.success("归档报告已恢复到工作区")
  }

  const handleReturnToArchiveLedger = () => {
    clearDraftAfterArchiveRef.current = true
    clearLaboratoryWorkspaceDraft(projectId)
    try {
      window.localStorage.removeItem(productIllustrationStorageKey)
    } catch {
      // Restored module cleanup is best-effort.
    }
    setNodes([{ id: 1, type: null, isConfirmed: false }])
    setDraftSelections({ 1: "" })
    setNodeSummaries({})
    setReportMeta(createInitialReportMeta())
    setSelectedSpecId("")
    setSelectedSpecState(null)
    setIsEditingArchivedReport(false)
    setRestoredArchiveReportNo("")
    setActiveLaboratoryView("archive")
    setArchiveOnlyMode(archiveOnly)
  }

  if (archiveOnlyMode) {
    return (
      <LaboratoryArchivePanel
        projectId={projectId}
        onRestoreArchive={handleRestoreLaboratoryArchive}
      />
    )
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

            {!archiveOnlyMode ? <div className="flex flex-wrap items-center justify-end gap-3">
              {isEditingArchivedReport ? (
                <Button
                  type="button"
                  onClick={handleReturnToArchiveLedger}
                  variant="outline"
                  className="min-h-16 min-w-[190px] border-white/[0.1] bg-white/[0.025] px-6 text-slate-200 hover:bg-white/[0.06] hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回实验室报告台账
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => void handleArchiveLaboratoryReport()}
                disabled={isArchivingLaboratoryReport || !canArchiveLaboratoryReport}
                className="min-h-16 min-w-[220px] border border-cyan-300/25 bg-cyan-300/10 px-6 text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isArchivingLaboratoryReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                {isArchivingLaboratoryReport
                  ? "归档中..."
                  : isEditingArchivedReport
                    ? "覆盖更新归档"
                    : "新建归档"}
              </Button>
            </div> : null}
          </div>

          {activeLaboratoryView === "workspace" ? (
            <>
              <div className="mt-5 rounded-2xl border border-white/[0.05] bg-black/18 p-4">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[9px] tracking-[0.16em] text-slate-500">规格书台账</span>
                    <span className="shrink-0 text-[11px] text-slate-600">
                      {isLoadingLedger ? "读取中" : isLoadingSpecDetail ? "映射中" : `${sanitizedLedgerRecords.length} 条`}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1012] shadow-[inset_0_0_24px_rgba(0,0,0,0.24)]">
                      {selectedSpecRecord?.imageUrl ? (
                        <img src={selectedSpecRecord.imageUrl} alt="产品图示" className="h-full w-full object-contain p-3" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-center font-mono text-[11px] leading-5 text-slate-600">
                          产品图示<br />图片映射区
                        </div>
                      )}
                    </div>

                    <div className="grid min-w-0 gap-4 md:grid-cols-2 md:grid-rows-1">
                      <div className="flex min-w-0 min-h-[132px] flex-col justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4">
                        <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">台账序号 · 可选择</p>
                        <Select value={selectedSpecId} onValueChange={handleSpecRecordSelect} disabled={isLoadingLedger || sanitizedLedgerRecords.length === 0}>
                          <SelectTrigger className="h-12 w-full rounded-lg border-cyan-300/20 bg-black/20 text-left font-mono text-lg font-semibold text-slate-100 hover:border-cyan-300/40 focus:ring-cyan-300/20">
                            <SelectValue placeholder={isLoadingLedger ? "正在读取" : "选择序号"}>
                              {selectedSpecRecord ? `#${selectedSpecRecord.sequence}` : undefined}
                            </SelectValue>
                          </SelectTrigger>
                      <SelectContent className="max-h-80 rounded-xl border-cyan-400/20 bg-[#050911] text-slate-100 shadow-2xl">
                        {sanitizedLedgerRecords.map((record) => (
                          <SelectItem
                            key={record.id}
                            value={record.id}
                            className="rounded-lg py-2.5 text-slate-100 data-[highlighted]:bg-cyan-400/10 data-[highlighted]:text-cyan-100"
                          >
                            <span className="block max-w-[520px] truncate font-mono text-sm">#{record.sequence}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                        </Select>
                      </div>

                      <div className="flex min-w-0 min-h-[132px] flex-col justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4">
                        <p className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">产品编号 · 自动映射</p>
                        <div className="flex h-12 items-center rounded-lg border border-white/[0.08] bg-black/20 px-4 font-mono text-lg font-semibold text-slate-100">
                          <span className="truncate" title={selectedSpecRecord?.sku || ""}>{selectedSpecRecord?.sku || "--"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                      <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">产品经理</dt>
                      <dd className="mt-3 truncate text-base font-semibold text-slate-100" title={specHeader.productManager}>{specHeader.productManager}</dd>
                    </div>
                    <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                      <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">结构工程师</dt>
                      <dd className="mt-3 truncate text-base font-semibold text-slate-100" title={specHeader.structuralEngineer}>{specHeader.structuralEngineer}</dd>
                    </div>
                    <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-white/[0.05] bg-white/[0.025] px-4 py-3">
                      <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">电子工程师</dt>
                      <dd className="mt-3 truncate text-base font-semibold text-slate-100" title={specHeader.electronicEngineer}>{specHeader.electronicEngineer}</dd>
                    </div>
                    <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-cyan-300/[0.08] bg-cyan-300/[0.035] px-4 py-3">
                      <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">测试类型</dt>
                      <dd className="mt-3 truncate text-base font-semibold text-cyan-100" title={specHeader.testType}>{specHeader.testType}</dd>
                    </div>
                    <div className="flex min-h-[82px] flex-col justify-between rounded-lg border border-cyan-300/[0.08] bg-cyan-300/[0.035] px-4 py-3">
                      <dt className="font-mono text-[11px] font-medium tracking-[0.08em] text-slate-500">送样日期</dt>
                      <dd className="mt-3 truncate font-mono text-base font-semibold text-cyan-100" title={specHeader.sampleDeliveryDate}>{specHeader.sampleDeliveryDate}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="min-h-[132px] rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-slate-500">// 综合结论</p>
                  <p className="mt-4 text-sm font-medium leading-6 text-slate-200">{overallAdjudication.summary}</p>
                </div>
                <div className="min-h-[132px] rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-slate-500">// 门禁原因</p>
                  <div className="mt-4 flex flex-wrap content-start gap-2">
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
            </>
          ) : null}
        </div>

        {activeLaboratoryView === "archive" ? (
          <LaboratoryArchivePanel
            projectId={projectId}
            onRestoreArchive={handleRestoreLaboratoryArchive}
          />
        ) : (
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
                    productIllustrationStorageKey={productIllustrationStorageKey}
                    productIllustrationEntityId={productIllustrationEntityId}
                    initialSummary={nodeSummaries[node.id]}
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
        )}
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
