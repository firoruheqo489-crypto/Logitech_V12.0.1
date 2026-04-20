"use client"

import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ParseProgress } from "@/lib/docx-parser"

const STAGES: { key: ParseProgress["stage"]; label: string }[] = [
  { key: "unzipping", label: "解压归档" },
  { key: "parsing-xml", label: "解析 XML" },
  { key: "extracting-images", label: "提取图片" },
  { key: "rendering", label: "构建预览" },
  { key: "done", label: "完成" },
]

type Props = {
  progress: ParseProgress | null
  error?: string | null
}

export function ProcessingStatus({ progress, error }: Props) {
  if (!progress && !error) return null

  const currentIdx = progress ? STAGES.findIndex((s) => s.key === progress.stage) : -1

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          处理状态
        </p>
        {progress && progress.stage !== "done" && (
          <p className="text-xs font-mono text-muted-foreground">
            {progress.progress}%
          </p>
        )}
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {STAGES.map((stage, idx) => {
          const isDone = currentIdx > idx || progress?.stage === "done"
          const isActive = currentIdx === idx && progress?.stage !== "done"
          const isPending = currentIdx < idx && progress?.stage !== "done"

          return (
            <li
              key={stage.key}
              className={cn(
                "flex items-center gap-2 rounded-sm border px-3 py-2 text-xs",
                isDone && "border-foreground/30 bg-muted text-foreground",
                isActive && "border-foreground bg-foreground text-background",
                isPending && "border-border bg-background text-muted-foreground",
              )}
            >
              <span className="flex size-4 items-center justify-center shrink-0">
                {isDone ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : isActive ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current opacity-40" />
                )}
              </span>
              <span className="font-medium truncate">{stage.label}</span>
            </li>
          )
        })}
      </ol>

      {progress && progress.stage !== "done" && (
        <p className="mt-3 text-xs font-mono text-muted-foreground">
          {progress.message}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
