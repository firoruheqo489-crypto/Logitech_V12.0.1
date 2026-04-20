"use client"

import { useCallback, useState } from "react"
import { Download, Loader2, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadZone } from "@/components/upload-zone"
import { ProcessingStatus } from "@/components/processing-status"
import { PreviewTable } from "@/components/preview-table"
import { parseDocx, type ParseProgress, type ParseResult } from "@/lib/docx-parser"
import { exportToExcel } from "@/lib/excel-exporter"

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setIsParsing(true)
    setProgress({ stage: "unzipping", message: "Starting…", progress: 0 })

    try {
      const parsed = await parseDocx(f, (p) => setProgress(p))
      setResult(parsed)
      setProgress({ stage: "done", message: "完成", progress: 100 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "解析失败"
      setError(msg)
      setProgress(null)
    } finally {
      setIsParsing(false)
    }
  }, [])

  const handleClear = useCallback(() => {
    setFile(null)
    setResult(null)
    setProgress(null)
    setError(null)
  }, [])

  const handleExport = useCallback(async () => {
    if (!result || !file) return
    setIsExporting(true)
    try {
      const baseName = file.name.replace(/\.docx$/i, "")
      await exportToExcel(result, `${baseName}.xlsx`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "导出失败"
      setError(msg)
    } finally {
      setIsExporting(false)
    }
  }, [result, file])

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground leading-none">
                DOCX → XLSX 转换器
              </h1>
              <p className="mt-1 text-xs font-mono text-muted-foreground">
                QE Report Parser · 文本 + 图片单元格嵌入
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="inline-flex size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>纯客户端 · 无上传</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Upload Section */}
        <section aria-labelledby="upload-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="upload-heading" className="text-sm font-semibold text-foreground">
              1. 上传 DOCX
            </h2>
            {file && (
              <p className="text-xs font-mono text-muted-foreground">
                9 列 QE 报告 · 自动识别图片单元格
              </p>
            )}
          </div>
          <UploadZone
            onFile={handleFile}
            disabled={isParsing}
            currentFile={file}
            onClear={handleClear}
          />
        </section>

        {/* Status Section */}
        {(progress || error) && (
          <section aria-labelledby="status-heading" className="space-y-3">
            <h2 id="status-heading" className="sr-only">
              处理状态
            </h2>
            <ProcessingStatus progress={progress} error={error} />
          </section>
        )}

        {/* Preview + Action Section */}
        {result && (
          <section aria-labelledby="preview-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="preview-heading" className="text-sm font-semibold text-foreground">
                  2. 预览解析结果
                </h2>
                <p className="mt-1 text-xs font-mono text-muted-foreground">
                  检查文本与图片是否正确提取,确认后导出 Excel
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleExport}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    导出中…
                  </>
                ) : (
                  <>
                    <Download className="size-4" aria-hidden="true" />
                    导出到 Excel
                  </>
                )}
              </Button>
            </div>
            <PreviewTable data={result} />
          </section>
        )}

        {/* Empty state hint */}
        {!result && !isParsing && !error && !file && (
          <section className="rounded-md border border-dashed border-border bg-muted/30 p-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">工作原理</h3>
            <ol className="space-y-1.5 text-sm text-muted-foreground font-mono">
              <li>
                <span className="text-foreground">01</span> — 使用 JSZip 解压 DOCX 归档
              </li>
              <li>
                <span className="text-foreground">02</span> — 解析 word/document.xml 获取 9 列表格
              </li>
              <li>
                <span className="text-foreground">03</span> — 通过 document.xml.rels 映射图片 (r:embed → word/media/)
              </li>
              <li>
                <span className="text-foreground">04</span> — 使用 ExcelJS 嵌入图片到对应单元格并自适应行高
              </li>
            </ol>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
          <span>JSZip · ExcelJS · file-saver</span>
          <span>所有处理均在浏览器本地进行,文件不会上传</span>
        </div>
      </footer>
    </main>
  )
}
