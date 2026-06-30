import { useMemo, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/api"
import { ConicalAttenuation } from "./darkroom/conical-attenuation"
import {
  buildDarkroomTelemetry,
  type DarkroomParseResult,
} from "./darkroom/photometric"
import { EnergyAccumulation } from "./darkroom/energy-accumulation"
import { SpatialIntensity } from "./darkroom/spatial-intensity"

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dt className="text-[9px] tracking-[0.2em] text-slate-600 uppercase">{label}</dt>
      <dd className="mt-1 text-xs text-cyan-400">{value}</dd>
    </div>
  )
}

type ParseResponse = {
  ok: boolean
  sourceType: "upload"
  fileName?: string
  result: DarkroomParseResult
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [result, setResult] = useState<ParseResponse | null>(null)

  const telemetry = useMemo(
    () => buildDarkroomTelemetry(result?.result || null),
    [result],
  )

  const handleUploadParse = async () => {
    if (!selectedFile) {
      toast.error("请先选择暗房 PDF 文件")
      return
    }

    setIsParsing(true)
    try {
      const payload = await parseByUpload(selectedFile)
      setResult(payload)
      toast.success("暗房 PDF 解析完成")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "暗房 PDF 解析失败")
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <section className="mt-0">
      <main className="min-h-0 bg-[#030508] text-slate-200 px-4 py-8 md:px-10 md:py-12 rounded-2xl border border-white/5">
        <div className="mx-auto max-w-6xl">
          <section className="mb-6 rounded-lg border border-white/5 bg-white/[0.01] p-5">
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
                className="min-w-[220px] bg-white text-black hover:bg-white/90"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isParsing ? "PARSING..." : "UPLOAD DARKROOM PDF"}
              </Button>
            </div>
          </section>

          <header className="mb-8 flex flex-col gap-3 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] tracking-[0.3em] font-mono text-cyan-400/80 uppercase mb-2">
                {"// AXIOM SIGMA / 暗房光度遥测 DARKROOM TELEMETRY"}
              </p>
              <h1 className="text-lg md:text-xl font-mono font-semibold tracking-tight text-slate-100 text-balance">
                {telemetry.name}
              </h1>
              <p className="mt-1 text-[10px] font-mono text-slate-500 tracking-wide">
                {telemetry.machine} / {result?.fileName || telemetry.filename}
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
            <span className="text-[9px] font-mono text-slate-600 tracking-[0.2em] uppercase">
              测试日期 TEST DATE {telemetry.testDate}
            </span>
            <span className="text-[9px] font-mono text-slate-600 tracking-[0.2em] uppercase">
              IES 投光灯报告 FLOOD REPORT
            </span>
          </footer>
        </div>
      </main>
    </section>
  )
}
