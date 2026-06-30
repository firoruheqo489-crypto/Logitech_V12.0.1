"use client"

import { FileStack, Loader2, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function MassIngestion({
  selectedFiles,
  parsedFiles,
  onFilesChange,
  onLoad,
  onClear,
  isLoading,
}: {
  selectedFiles: File[]
  parsedFiles: Array<{ id: string; fileName: string; sampleName: string; voltage: number | null }>
  onFilesChange: (files: File[]) => void
  onLoad: () => void
  onClear: () => void
  isLoading: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <FileStack className="size-5 text-cyan-400" strokeWidth={1.4} aria-hidden="true" />
          <div>
            <p className="font-mono text-sm tracking-widest text-cyan-400">
              {"[ MANUAL INGESTION BAY // 手动解析入库 ]"}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-slate-500">
              {"SELECT 3-6 FLICKER PDF REPORTS MANUALLY // 手动选择 3-6 份频闪 PDF 报告"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(event) => onFilesChange(Array.from(event.target.files || []))}
            className="border-white/[0.06] bg-black/40 text-white file:text-white"
          />
          <Button
            type="button"
            onClick={onLoad}
            disabled={isLoading || selectedFiles.length === 0}
            className="min-w-[190px] bg-white text-black hover:bg-white/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isLoading ? "PARSING..." : "UPLOAD FLICKER PDF"}
          </Button>
          <Button
            type="button"
            onClick={onClear}
            disabled={isLoading || (selectedFiles.length === 0 && parsedFiles.length === 0)}
            variant="outline"
            className="min-w-[160px] border-white/[0.08] bg-transparent text-slate-200 hover:bg-white/[0.04]"
          >
            <Trash2 className="h-4 w-4" />
            CLEAR FILES
          </Button>
        </div>

        <div className="rounded-lg border border-white/[0.05] bg-black/30 px-4 py-2.5">
          {selectedFiles.length > 0 ? (
            <div className="space-y-1.5">
              <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                Selected Files / 已选文件
              </div>
              <div className="grid gap-x-4 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
                {selectedFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    className="truncate font-mono text-[11px] tracking-wide text-slate-300"
                    title={file.name}
                  >
                    {file.name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="font-mono text-[11px] tracking-wide text-slate-500">
              尚未选择频闪 PDF 文件
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
