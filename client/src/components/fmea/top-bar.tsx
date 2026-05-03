"use client"

import {
  Shield,
  Search,
  Bell,
  Settings,
  Filter,
  Download,
  Plus,
} from "lucide-react"

interface TopBarProps {
  stats: {
    total: number
    high: number
    medium: number
    low: number
  }
  onAddRow: () => void
}

export function TopBar({ stats, onAddRow }: TopBarProps) {
  return (
    <header className="h-12 shrink-0 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold text-zinc-200 tracking-wide">
            FMEA
          </span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
            v4.2
          </span>
        </div>
        <div className="w-px h-5 bg-white/10" />
        <span className="text-xs text-zinc-500">
          智能电子产品外壳总成
        </span>
      </div>

      {/* Center: Quick Stats (dynamic) */}
      <div className="hidden md:flex items-center gap-6">
        <Stat label="失效模式" value={String(stats.total)} />
        <Stat label="高风险" value={String(stats.high)} color="text-rose-400" />
        <Stat label="中风险" value={String(stats.medium)} color="text-amber-400" />
        <Stat label="低风险" value={String(stats.low)} color="text-emerald-400" />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Add Row Button */}
        <button
          onClick={onAddRow}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          添加
        </button>
        <div className="w-px h-5 bg-white/10 mx-1" />
        <IconButton icon={Search} label="搜索" />
        <IconButton icon={Filter} label="筛选" />
        <IconButton icon={Download} label="导出" />
        <div className="w-px h-5 bg-white/10 mx-1" />
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
      <span className="text-[10px] uppercase tracking-widest text-zinc-600">
        {label}
      </span>
      <span className={`text-sm font-mono font-semibold ${color}`}>
        {value}
      </span>
    </div>
  )
}

function IconButton({
  icon: Icon,
  label,
  badge,
}: {
  icon: React.ElementType
  label: string
  badge?: boolean
}) {
  return (
    <button
      className="relative p-2 rounded-md text-zinc-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
      {badge && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
      )}
    </button>
  )
}
