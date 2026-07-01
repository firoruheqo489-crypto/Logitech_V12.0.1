"use client"

import { useRef, useState } from "react"
import { Upload, FileCheck2, X, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { CHANNELS, type ChannelData, type ChannelId, parseFile, guessChannel } from "@/lib/emc"
import { CHANNEL_HEX } from "./spectrum-chart"

interface Props {
  channels: ChannelData[]
  onLoad: (data: ChannelData) => void
  onClear: (id: ChannelId) => void
  onLoadSample: () => void
}

export function UploadZone({ channels, onLoad, onClear, onLoadSample }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CHANNELS.map((ch) => (
        <ChannelDrop
          key={ch.id}
          id={ch.id}
          label={ch.label}
          desc={ch.desc}
          loaded={channels.find((c) => c.channel === ch.id)}
          onLoad={onLoad}
          onClear={onClear}
        />
      ))}
      <button
        type="button"
        onClick={onLoadSample}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
      >
        <Database className="h-5 w-5" />
        载入示例数据
        <span className="text-[10px] text-muted-foreground/70">L / N / F 三通道演示</span>
      </button>
    </div>
  )
}

function ChannelDrop({
  id,
  label,
  desc,
  loaded,
  onLoad,
  onClear,
}: {
  id: ChannelId
  label: string
  desc: string
  loaded?: ChannelData
  onLoad: (d: ChannelData) => void
  onClear: (id: ChannelId) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const color = CHANNEL_HEX[id]

  async function handleFiles(files: FileList | null) {
    setError(null)
    const file = files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const points = parseFile(file.name, text)
      if (points.length === 0) throw new Error("未解析到有效数据点")
      const targetChannel = guessChannel(file.name, id)
      onLoad({ channel: targetChannel === id ? id : id, fileName: file.name, points })
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败")
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-card/60 px-3 py-3 transition-colors",
        over ? "border-primary bg-primary/5" : "border-border",
        loaded && "border-l-2",
      )}
      style={loaded ? { borderLeftColor: color } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{desc}</span>
      </div>

      {loaded ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-secondary px-2 py-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
            <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-risk-safe" />
            <span className="truncate" title={loaded.fileName}>
              {loaded.fileName}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">{loaded.points.length} pts</span>
            <button
              type="button"
              onClick={() => onClear(id)}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`清除 ${label} 数据`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          拖拽或点击上传 JSON / CSV
        </button>
      )}

      {error && <p className="font-mono text-[10px] text-risk-high">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
