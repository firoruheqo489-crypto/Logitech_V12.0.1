"use client"

import { Loader2, Trash2, Upload } from "lucide-react"

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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(event) => onFilesChange(Array.from(event.target.files || []))}
            className="h-11 border-white/[0.06] bg-black/40 text-white file:text-white"
          />
          <Button
            type="button"
            onClick={onLoad}
            disabled={isLoading || selectedFiles.length === 0}
            className="h-11 min-w-[170px] bg-white text-black hover:bg-white/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isLoading ? "解析中..." : "上传频闪报告"}
          </Button>
          <Button
            type="button"
            onClick={onClear}
            disabled={isLoading || (selectedFiles.length === 0 && parsedFiles.length === 0)}
            variant="outline"
            className="h-11 min-w-[140px] border-white/[0.08] bg-transparent text-slate-200 hover:bg-white/[0.04]"
          >
            <Trash2 className="h-4 w-4" />
            清空文件
          </Button>
        </div>

        <div className="rounded-lg border border-white/[0.05] bg-black/30 px-3 py-2">
          {selectedFiles.length > 0 ? (
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
          ) : (
            <div className="text-[11px] tracking-wide text-slate-500">尚未选择频闪报告文件</div>
          )}
        </div>
      </div>
    </div>
  )
}
