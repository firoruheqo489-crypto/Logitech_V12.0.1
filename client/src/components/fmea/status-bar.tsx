"use client"

import { AlertCircle, Clock, Database } from "lucide-react"

interface StatusBarProps {
  totalRows: number
  filteredRows: number
  pendingCount: number
}

export function StatusBar({ totalRows, filteredRows, pendingCount }: StatusBarProps) {
  const now = new Date()
  const timeString = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/5 bg-zinc-950/85 px-4 text-[10px] text-zinc-600">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.55)]" />
          <span>系统就绪</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          <span>
            显示 {filteredRows} / {totalRows} 条记录
          </span>
        </div>
        {pendingCount > 0 ? (
          <div className="flex items-center gap-1.5 text-amber-500">
            <AlertCircle className="h-3 w-3" />
            <span>{pendingCount} 项待处理</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        <span>最后同步 {timeString}</span>
      </div>
    </footer>
  )
}
