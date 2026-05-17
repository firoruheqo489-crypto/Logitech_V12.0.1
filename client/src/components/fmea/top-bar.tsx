"use client"

import { useMemo, useState, type ElementType, type ReactNode } from "react"
import {
  Bell,
  Download,
  Filter,
  Plus,
  Printer,
  Search,
  Settings,
  Shield,
  X,
} from "lucide-react"

type RiskFilter = "all" | "critical" | "warning" | "safe"

interface TopBarProps {
  stats: {
    total: number
    high: number
    medium: number
    low: number
  }
  contextLabel: string
  contextOwner: string
  isSearchOpen: boolean
  searchTerm: string
  riskFilter: RiskFilter
  pendingCount: number
  criticalOpenCount: number
  isDrawerOpen: boolean
  onAddRow: () => void
  onToggleSearch: () => void
  onSearchTermChange: (value: string) => void
  onCycleRiskFilter: () => void
  onExport: () => void
  onPrint: () => void
  onResetControls: () => void
  onCloseDrawer: () => void
}

const riskFilterLabels: Record<RiskFilter, string> = {
  all: "全部风险",
  critical: "仅高风险",
  warning: "仅中风险",
  safe: "仅低风险",
}

export function TopBar({
  stats,
  contextLabel,
  contextOwner,
  isSearchOpen,
  searchTerm,
  riskFilter,
  pendingCount,
  criticalOpenCount,
  isDrawerOpen,
  onAddRow,
  onToggleSearch,
  onSearchTermChange,
  onCycleRiskFilter,
  onExport,
  onPrint,
  onResetControls,
  onCloseDrawer,
}: TopBarProps) {
  const [activePanel, setActivePanel] = useState<"notifications" | "settings" | null>(null)

  const searchOpen = isSearchOpen
  const filterActive = riskFilter !== "all"
  const notificationItems = useMemo(
    () => [
      { label: "待处理项", value: pendingCount, tone: "text-amber-400" },
      { label: "高风险待闭环", value: criticalOpenCount, tone: "text-rose-400" },
      { label: "当前风险视图", value: riskFilterLabels[riskFilter], tone: "text-cyan-300" },
    ],
    [criticalOpenCount, pendingCount, riskFilter]
  )

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#090b11] px-4 shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
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
            责任域: {contextOwner}
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-6 md:flex">
        <Stat label="失效模式" value={String(stats.total)} />
        <Stat label="高风险" value={String(stats.high)} color="text-rose-400" />
        <Stat label="中风险" value={String(stats.medium)} color="text-amber-400" />
        <Stat label="低风险" value={String(stats.low)} color="text-emerald-400" />
      </div>

      <div className="relative z-10 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d1119] px-3 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.3)]">
        {searchOpen ? (
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-[#101826] px-2 py-1.5 shadow-inner shadow-black/20">
            <Search className="h-3.5 w-3.5 text-cyan-300" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="搜索失效模式 / 原因 / 责任人"
              className="w-52 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => {
                onSearchTermChange("")
                onToggleSearch()
              }}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              aria-label="关闭搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/35 bg-cyan-600/22 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-600/32"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <IconButton
          icon={Search}
          label="搜索"
          active={searchOpen}
          onClick={() => {
            if (searchOpen) {
              onSearchTermChange("")
            }
            onToggleSearch()
          }}
        />
        <IconButton
          icon={Filter}
          label={`筛选: ${riskFilterLabels[riskFilter]}`}
          active={filterActive}
          onClick={onCycleRiskFilter}
        />
        <IconButton icon={Printer} label="打印预览" onClick={onPrint} />
        <IconButton icon={Download} label="导出当前视图" onClick={onExport} />
        <div className="mx-1 h-5 w-px bg-white/10" />
        <IconButton
          icon={Bell}
          label="通知面板"
          badge={criticalOpenCount > 0}
          active={activePanel === "notifications"}
          onClick={() =>
            setActivePanel((current) =>
              current === "notifications" ? null : "notifications"
            )
          }
        />
        <IconButton
          icon={Settings}
          label="设置面板"
          active={activePanel === "settings"}
          onClick={() =>
            setActivePanel((current) => (current === "settings" ? null : "settings"))
          }
        />
      </div>

      {activePanel === "notifications" ? (
        <PanelCard title="审计通知" align="right-16">
          <div className="space-y-3">
            {notificationItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2"
              >
                <span className="text-xs text-zinc-400">{item.label}</span>
                <span className={`text-xs font-semibold ${item.tone}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      ) : null}

      {activePanel === "settings" ? (
        <PanelCard title="视图设置" align="right-0">
          <div className="space-y-2">
            <ActionRow
              label="重置搜索与风险筛选"
              subtext="恢复到全量视图"
              onClick={() => {
                onResetControls()
                setActivePanel(null)
              }}
            />
            <ActionRow
              label="关闭审计抽屉"
              subtext={isDrawerOpen ? "当前抽屉已打开" : "当前没有抽屉打开"}
              disabled={!isDrawerOpen}
              onClick={() => {
                onCloseDrawer()
                setActivePanel(null)
              }}
            />
          </div>
        </PanelCard>
      ) : null}
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
  active = false,
  onClick,
}: {
  icon: ElementType
  label: string
  badge?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-md border border-transparent p-2 transition-colors ${
        active
          ? "border-cyan-500/20 bg-cyan-500/12 text-cyan-300"
          : "text-zinc-500 hover:border-white/10 hover:bg-[#141925] hover:text-cyan-400"
      }`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {badge ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.55)]" />
      ) : null}
    </button>
  )
}

function PanelCard({
  title,
  align,
  children,
}: {
  title: string
  align: string
  children: ReactNode
}) {
  return (
    <div
      className={`absolute top-[calc(100%+8px)] ${align} z-50 w-72 rounded-2xl border border-white/10 bg-[#0d1119] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]`}
    >
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </p>
      {children}
    </div>
  )
}

function ActionRow({
  label,
  subtext,
  disabled = false,
  onClick,
}: {
  label: string
  subtext: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-zinc-600"
          : "border-white/8 bg-white/[0.02] text-zinc-200 hover:border-cyan-500/20 hover:bg-cyan-500/5"
      }`}
    >
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{subtext}</p>
    </button>
  )
}
