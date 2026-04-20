"use client"

import type React from "react"
import { useCallback, useRef, useState } from "react"
import { FileUp, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type UploadZoneProps = {
  onFile: (file: File) => void
  disabled?: boolean
  currentFile?: File | null
  onClear?: () => void
}

export function UploadZone({ onFile, disabled, currentFile, onClear }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const file = files[0]
      if (!file.name.toLowerCase().endsWith(".docx")) {
        alert("仅支持 .docx 文件")
        return
      }
      onFile(file)
    },
    [onFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (disabled) return
      handleFiles(e.dataTransfer.files)
    },
    [disabled, handleFiles],
  )

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      setIsDragging(true)
    },
    [disabled],
  )

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  if (currentFile) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <FileText className="size-5 text-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{currentFile.name}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {(currentFile.size / 1024).toFixed(1)} KB · DOCX
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            更换文件
          </Button>
          {onClear && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              disabled={disabled}
              aria-label="清除文件"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-6 py-16 transition-colors",
        "cursor-pointer select-none text-center",
        isDragging
          ? "border-foreground bg-muted"
          : "border-border bg-card hover:border-foreground/50 hover:bg-muted/50",
        disabled && "pointer-events-none opacity-60",
      )}
      aria-label="上传 DOCX 文件"
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full border border-border bg-background transition-colors",
          isDragging && "border-foreground",
        )}
      >
        <FileUp className="size-6 text-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">
          {isDragging ? "释放以上传" : "拖拽 DOCX 文件到此处"}
        </p>
        <p className="text-sm text-muted-foreground">
          或 <span className="font-medium text-foreground underline">点击选择文件</span>
        </p>
        <p className="pt-2 text-xs text-muted-foreground font-mono">
          仅支持 .docx · 9 列 QE 报告表 · 文本 + 图片
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
