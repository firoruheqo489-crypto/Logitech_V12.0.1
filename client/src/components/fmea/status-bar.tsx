"use client"

import { Clock, Database, AlertCircle } from "lucide-react"

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
    <footer className="h-7 shrink-0 border-t border-white/5 bg-zinc-950/80 flex items-center justify-between px-4 text-[10px] text-zinc-600">
      {/* Left: Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
          <span>系统就绪</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3" />
          <span>显示 {filteredRows} / {totalRows} 条记录</span>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 text-amber-500">
            <AlertCircle className="w-3 h-3" />
            <span>{pendingCount} 项待处理</span>
          </div>
        )}
      </div>

      {/* Right: Sync time */}
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        <span>最后同步: {timeString}</span>
      </div>
    </footer>
  )
}
