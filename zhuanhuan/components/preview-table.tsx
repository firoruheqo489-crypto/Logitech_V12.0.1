"use client"

import { useMemo, useState } from "react"
import { ImageIcon, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ParseResult, ParsedImage } from "@/lib/docx-parser"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  data: ParseResult
}

const COLUMN_WIDTH_CLASSES: Record<number, string> = {
  0: "w-14", // No.
  1: "min-w-[240px]", // Issue Description
  2: "w-[140px]", // Pictures
  3: "min-w-[200px]", // Root Cause
  4: "min-w-[200px]", // Solution
  5: "w-[100px]", // Owner
  6: "w-[110px]", // Due-Date
  7: "w-[90px]", // Status
  8: "min-w-[180px]", // Reference Link
}

export function PreviewTable({ data }: Props) {
  const [preview, setPreview] = useState<ParsedImage | null>(null)

  const stats = useMemo(() => {
    let images = 0
    let openCount = 0
    for (const row of data.rows) {
      for (const cell of row) images += cell.images.length
      const status = row[7]?.text?.toLowerCase() || ""
      if (status.includes("open")) openCount++
    }
    return { rows: data.rows.length, images, openCount }
  }, [data])

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3 text-xs font-mono text-muted-foreground">
        <span>
          行数: <span className="text-foreground font-semibold">{stats.rows}</span>
        </span>
        <span>
          图片: <span className="text-foreground font-semibold">{stats.images}</span>
        </span>
        <span>
          待处理 (Open): <span className="text-destructive font-semibold">{stats.openCount}</span>
        </span>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-foreground text-background">
              <tr>
                {data.headers.map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wider whitespace-nowrap border-r border-background/20 last:border-r-0",
                      COLUMN_WIDTH_CLASSES[i],
                    )}
                  >
                    {h || `Col ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={data.headers.length}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    没有数据行
                  </td>
                </tr>
              ) : (
                data.rows.map((row, rIdx) => {
                  const status = row[7]?.text?.toLowerCase() || ""
                  const isOpen = status.includes("open")
                  return (
                    <tr
                      key={rIdx}
                      className={cn(
                        "border-t border-border align-top",
                        rIdx % 2 === 1 ? "bg-muted/30" : "bg-card",
                        "hover:bg-muted/60 transition-colors",
                      )}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={cn(
                            "px-3 py-2 align-top border-r border-border last:border-r-0",
                            COLUMN_WIDTH_CLASSES[cIdx],
                          )}
                        >
                          {cIdx === 2 ? (
                            <PictureCell
                              images={cell.images}
                              onPreview={(img) => setPreview(img)}
                            />
                          ) : cIdx === 7 ? (
                            <StatusCell text={cell.text} isOpen={isOpen} />
                          ) : cIdx === 8 ? (
                            <LinkCell text={cell.text} />
                          ) : cIdx === 0 ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {cell.text || rIdx + 1}
                            </span>
                          ) : (
                            <MultilineText text={cell.text} />
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>图片预览</DialogTitle>
          </DialogHeader>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${preview.mimeType};base64,${preview.base64}`}
              alt="预览图片"
              className="w-full h-auto rounded border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function MultilineText({ text }: { text: string }) {
  if (!text) {
    return <span className="text-muted-foreground/50">—</span>
  }
  const lines = text.split("\n")
  return (
    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, i) => (
        <p key={i} className={i > 0 ? "mt-1" : ""}>
          {line || "\u00A0"}
        </p>
      ))}
    </div>
  )
}

function PictureCell({
  images,
  onPreview,
}: {
  images: ParsedImage[]
  onPreview: (img: ParsedImage) => void
}) {
  if (images.length === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground/50">
        <ImageIcon className="size-3.5" aria-hidden="true" />
        <span className="text-xs">无</span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {images.map((img, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPreview(img)}
          className="group relative size-16 overflow-hidden rounded-sm border border-border bg-muted hover:border-foreground transition-colors"
          aria-label={`查看图片 ${i + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${img.mimeType};base64,${img.base64}`}
            alt={`图片 ${i + 1}`}
            className="size-full object-cover"
          />
        </button>
      ))}
    </div>
  )
}

function StatusCell({ text, isOpen }: { text: string; isOpen: boolean }) {
  if (!text) return <span className="text-muted-foreground/50">—</span>
  if (isOpen) {
    return (
      <Badge
        variant="destructive"
        className="font-mono text-[10px] uppercase tracking-wider font-bold"
      >
        {text}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
      {text}
    </Badge>
  )
}

function LinkCell({ text }: { text: string }) {
  if (!text) return <span className="text-muted-foreground/50">—</span>
  const isUrl = /^https?:\/\//i.test(text.trim())
  if (!isUrl) {
    return <MultilineText text={text} />
  }
  return (
    <a
      href={text.trim()}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-foreground underline decoration-dotted hover:decoration-solid break-all"
    >
      <span className="truncate max-w-[200px]">{text.trim()}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
    </a>
  )
}
