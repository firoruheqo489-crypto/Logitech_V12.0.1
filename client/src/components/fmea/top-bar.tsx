"use client"

import type { ElementType } from "react"
import {
  Bell,
  Download,
  Filter,
  Plus,
  Search,
  Settings,
  Shield,
} from "lucide-react"

interface TopBarProps {
  stats: {
    total: number
    high: number
    medium: number
    low: number
  }
  contextLabel: string
  contextOwner: string
  onAddRow: () => void
}

export function TopBar({
  stats,
  contextLabel,
  contextOwner,
  onAddRow,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950/85 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-500" />
          <span className="text-sm font-semibold tracking-wide text-zinc-200">FMEA</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            Lighting v5.0
          </span>
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-300">{contextLabel}</p>
          <p className="truncate text-[10px] tracking-[0.16em] text-zinc-600">
            责任域：{contextOwner}
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-6 md:flex">
        <Stat label="失效模式" value={String(stats.total)} />
        <Stat label="高风险" value={String(stats.high)} color="text-rose-400" />
        <Stat label="中风险" value={String(stats.medium)} color="text-amber-400" />
        <Stat label="低风险" value={String(stats.low)} color="text-emerald-400" />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-600/20 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-600/30"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <IconButton icon={Search} label="搜索" />
        <IconButton icon={Filter} label="筛选" />
        <IconButton icon={Download} label="导出" />
        <div className="mx-1 h-5 w-px bg-white/10" />
        <IconButton icon={Bell} label="通知" badge />
        <IconButton icon={Settings} label="设置" />
      </div>
    </header>
  )
}

function Stat({
  label,
  value,
  color = "text-zinc-200",
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function IconButton({
  icon: Icon,
  label,
  badge,
}: {
  icon: ElementType
  label: string
  badge?: boolean
}) {
  return (
    <button
      type="button"
      className="relative rounded-md p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-cyan-400"
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      {badge ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.55)]" />
      ) : null}
    </button>
  )
}
