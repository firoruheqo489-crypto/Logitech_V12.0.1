import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Adjudication } from "./flicker/adjudication"
import { MassIngestion } from "./flicker/mass-ingestion"
import { Oscilloscope } from "./flicker/oscilloscope"
import { toSamples, type FlickerParseResult } from "./flicker/batch-data"
import { VarianceMatrix } from "./flicker/variance-matrix"
import { apiFetch } from "@/lib/api"

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

export function FlickerTelemetryWorkspace() {
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

  const handleLoad = async () => {
    setIsLoading(true)
    try {
      const parsed = await Promise.all(selectedFiles.map((file) => parseUpload(file)))
      setPayload(parsed)
      toast.success(`频闪文件已载入 ${parsed.length} 份报告`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "频闪 PDF 解析失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setSelectedFiles([])
    setPayload([])
  }

  return (
    <section className="mt-0">
      <main className="min-h-0 bg-black px-6 py-10 text-slate-200 selection:bg-cyan-500/30 rounded-2xl border border-white/[0.06]">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-3 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-mono text-base tracking-[0.3em] text-cyan-400">
                AXIOM&nbsp;SIGMA <span className="text-slate-400">公理西格玛</span>
              </h1>
              <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-slate-500">
                ULTIMATE MULTI-TRACE FLICKER MATRIX // 多路频闪源矩阵 // V3
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-500">
              <span
                className={`size-1.5 rounded-full ${
                  samples.length > 0
                    ? "bg-[#FF003C] shadow-[0_0_8px_rgba(255,0,60,0.7)]"
                    : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                }`}
              />
              {samples.length > 0 ? "STATUS: ANOMALY DETECTED // 检测到异常" : "STATUS: AWAITING PAYLOAD // 等待载荷"}
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
