"use client"

import { useRef, useState } from "react"
import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { IKTestData } from "@/lib/ik-test-data"

type ParseStatus = "idle" | "ready" | "parsing" | "success" | "error"

export function PDFUploadPanel({
  onParsed,
}: {
  onParsed: (data: IKTestData, file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ParseStatus>("idle")
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)

  function chooseFile(nextFile?: File) {
    setError("")
    if (!nextFile) return
    if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setStatus("error")
      setError("仅支持 PDF 文件")
      return
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      setStatus("error")
      setError("PDF 文件不能超过 15 MB")
      return
    }
    setFile(nextFile)
    setStatus("ready")
  }

  function reset() {
    setFile(null)
    setStatus("idle")
    setError("")
    if (inputRef.current) inputRef.current.value = ""
  }

  async function parsePDF() {
    if (!file) return
    setStatus("parsing")
    setError("")

    try {
      const body = new FormData()
      body.append("file", file)
      const response = await fetch("/api/parse-pdf", { method: "POST", body })
      const payload = (await response.json()) as { data?: IKTestData; error?: string }
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "PDF 解析失败")
      }
      onParsed(payload.data, file)
      setStatus("success")
    } catch (parseError) {
      setStatus("error")
      setError(parseError instanceof Error ? parseError.message : "PDF 解析失败")
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UploadCloud className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">PDF 智能解析入口</h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                上传 IK 试验记录，AI 将识别设备、判定状态、能量值、签核和附录信息，并即时更新下方看板。
              </p>
            </div>
          </div>

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                chooseFile(event.dataTransfer.files[0])
              }}
              className={
                dragging
                  ? "flex min-h-24 min-w-72 items-center justify-center rounded-lg border border-primary bg-primary/10 px-6 text-sm font-medium text-primary"
                  : "flex min-h-24 min-w-72 items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
              }
            >
              点击选择或拖放 PDF
            </button>
          ) : (
            <div className="flex min-w-72 flex-col gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                {status !== "parsing" ? (
                  <button type="button" onClick={reset} aria-label="移除文件" className="text-muted-foreground hover:text-foreground">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <Button onClick={parsePDF} disabled={status === "parsing"}>
                {status === "parsing" ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : status === "success" ? (
                  <RefreshCw data-icon="inline-start" />
                ) : (
                  <UploadCloud data-icon="inline-start" />
                )}
                {status === "parsing" ? "AI 正在解析…" : status === "success" ? "重新解析" : "开始解析"}
              </Button>
            </div>
          )}
        </div>

        {status === "success" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            解析完成，看板已更新为当前 PDF 数据
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
      </CardContent>
    </Card>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
