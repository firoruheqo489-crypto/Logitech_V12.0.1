import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Adjudication } from "./flicker/adjudication"
import { MassIngestion } from "./flicker/mass-ingestion"
import { Oscilloscope } from "./flicker/oscilloscope"
import {
  anomalyIndex,
  delta,
  hasFailingEvidence,
  hasWatchEvidence,
  toSamples,
  type FlickerParseResult,
  type Sample,
} from "./flicker/batch-data"
import { VarianceMatrix } from "./flicker/variance-matrix"
import { apiFetch } from "@/lib/api"
import {
  buildFlickerModuleSummary,
  type LaboratoryModuleSummary,
} from "./laboratory/laboratory-contract"

type ParseResponse = {
  ok: boolean
  sourceType: "upload"
  fileName?: string
  result: FlickerParseResult
}

async function parseUpload(file: File): Promise<ParseResponse> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await apiFetch("/api/dashboard/flicker-pdf/parse-upload", {
    method: "POST",
    body: formData,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.details || payload?.error || "频闪 PDF 解析失败")
  }

  return payload as ParseResponse
}

export function FlickerTelemetryWorkspace({
  nodeId,
  onSummaryChange,
}: {
  nodeId?: number
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [payload, setPayload] = useState<ParseResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const samples = useMemo(() => toSamples(payload.map((entry) => entry.result)), [payload])
  const parsedFiles = useMemo(
    () =>
      samples.map((sample) => ({
        id: sample.id,
        fileName: sample.fileName,
        sampleName: sample.sampleName,
        voltage: sample.voltage,
      })),
    [samples],
  )

  const publishSummary = (nextSamples: Sample[]) => {
    if (!nodeId || !onSummaryChange || nextSamples.length === 0) {
      onSummaryChange?.(null)
      return
    }

    const worstIndex = anomalyIndex(nextSamples)
    const worstSample = worstIndex >= 0 ? nextSamples[worstIndex] : null
    const pstSample = nextSamples.find((sample) => sample.pst != null)
    const svmSample = nextSamples.find((sample) => sample.svm != null)
    const flickerSample = nextSamples.find((sample) => sample.reportType === "flicker")
    const hasMixedReportTypes = new Set(nextSamples.map((sample) => sample.reportType)).size > 1
    onSummaryChange(
      buildFlickerModuleSummary(nodeId, {
        sourceFiles: nextSamples.map((sample) => sample.fileName),
        sampleCount: nextSamples.length,
        worstSample: worstSample?.id ?? "--",
        worstFlickerPercent: worstSample?.f ?? null,
        worstFlickerIndex: worstSample?.idx ?? null,
        worstFrequencyHz: worstSample?.freq ?? null,
        flickerPercentDelta: delta(nextSamples.map((sample) => sample.f)),
        flickerIndexDelta: delta(nextSamples.map((sample) => sample.idx)),
        frequencyDelta: hasMixedReportTypes ? null : delta(nextSamples.map((sample) => sample.freq)),
        pst: pstSample?.pst ?? null,
        pstResult: pstSample?.result ?? null,
        pstStandard: pstSample?.standard ?? null,
        svm: svmSample?.svm ?? null,
        svmVisibility: svmSample?.visibility ?? null,
        svmErp: svmSample?.erp ?? null,
        svmStandard: svmSample?.standard ?? null,
        flickerStandard: flickerSample?.standard ?? null,
      }),
    )
  }

  const handleLoad = async () => {
    setIsLoading(true)
    try {
      const parsed = await Promise.all(selectedFiles.map((file) => parseUpload(file)))
      setPayload(parsed)
      publishSummary(toSamples(parsed.map((entry) => entry.result)))
      toast.success(`已载入 ${parsed.length} 份频闪报告`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "频闪 PDF 解析失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setSelectedFiles([])
    setPayload([])
    onSummaryChange?.(null)
  }

  const hasParsedFailure = samples.some(hasFailingEvidence)
  const hasParsedWatch = !hasParsedFailure && samples.some(hasWatchEvidence)

  return (
    <section className="mt-0">
      <main className="min-h-0 bg-black px-6 py-10 text-slate-200 selection:bg-cyan-500/30 rounded-2xl border border-white/[0.06]">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-3 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-base font-semibold tracking-[0.18em] text-cyan-400">频闪报告比对台</h1>
              <p className="mt-1 text-[12px] text-slate-500">频闪 PDF 解析、结论核验与合规归档</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] tracking-wide text-slate-500">
              <span
                className={`size-1.5 rounded-full ${
                  samples.length > 0
                    ? hasParsedFailure
                      ? "bg-[#FF003C] shadow-[0_0_8px_rgba(255,0,60,0.7)]"
                      : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                    : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                }`}
              />
              {samples.length > 0
                ? hasParsedFailure
                  ? "状态：检测到异常"
                  : hasParsedWatch
                    ? "状态：低风险观察"
                    : "状态：PDF结论可接受"
                : "状态：等待载入"}
            </div>
          </header>

          {samples.length === 0 ? (
            <MassIngestion
              selectedFiles={selectedFiles}
              parsedFiles={parsedFiles}
              onFilesChange={setSelectedFiles}
              onLoad={handleLoad}
              onClear={handleClear}
              isLoading={isLoading}
            />
          ) : (
            <div className="space-y-6">
              <MassIngestion
                selectedFiles={selectedFiles}
                parsedFiles={parsedFiles}
                onFilesChange={setSelectedFiles}
                onLoad={handleLoad}
                onClear={handleClear}
                isLoading={isLoading}
              />
              <div className="grid w-full grid-cols-12 gap-6">
                <div className="col-span-12 flex flex-col lg:col-span-8">
                  <Oscilloscope samples={samples} />
                </div>
                <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
                  <VarianceMatrix samples={samples} />
                  <Adjudication samples={samples} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </section>
  )
}
