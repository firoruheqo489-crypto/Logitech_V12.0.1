import { useRef, useState } from "react"
import { FileSpreadsheet, LoaderCircle, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { useReportData } from "../report-data-context"

export function MetaHeader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const { isLoading, sourceName, sourceKind, importWorkbook, clearReportData } = useReportData()

  const importFile = (file?: File) => { if (file) void importWorkbook(file) }

  return (
    <div className={cn("glass rounded-xl border border-dashed p-5 transition", dragging && "border-primary bg-primary/10")} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); importFile(e.dataTransfer.files[0]) }}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = "" }} />
      <button type="button" disabled={isLoading} onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-4 text-left disabled:opacity-60">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">{isLoading ? <LoaderCircle className="size-5 animate-spin" /> : <FileSpreadsheet className="size-5" />}</span>
        <span className="min-w-0"><span className="block font-semibold text-foreground">选择终样测试报告 Excel 并解析</span><span className="mt-1 block truncate text-xs text-muted-foreground">支持 .xlsx / .xls，也可以直接拖入报告文件</span></span>
        <span className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 px-3 py-2 text-xs text-primary"><Upload className="size-3.5" />上传解析</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); clearReportData() }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); clearReportData() } }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-fail/30 px-3 py-2 text-xs text-fail transition hover:bg-fail/10"
          ><Trash2 className="size-3.5" />清除数据</span>
        </span>
      </button>
      <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">当前数据：{sourceName} · {sourceKind === "uploaded" ? "用户上传文件" : "内置示例"}</p>
    </div>
  )
}
