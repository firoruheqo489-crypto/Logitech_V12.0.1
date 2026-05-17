"use client"

import { useMemo, useState, type ElementType } from "react"
import {
  Aperture,
  Box,
  ChevronDown,
  ChevronRight,
  CircuitBoard,
  Droplets,
  Fan,
  Lock,
  Radio,
  ScanSearch,
  Shield,
  Thermometer,
  Waves,
  Zap,
} from "lucide-react"

import {
  findBomNodeById,
  lightingBomTree,
  type FmeaBomIcon,
  type FmeaBomNode,
} from "@/lib/fmea-data"

const iconMap: Record<FmeaBomIcon, ElementType> = {
  root: Box,
  driver: Zap,
  thermal: Thermometer,
  optical: Aperture,
  mechanical: Shield,
  surge: Waves,
  derating: CircuitBoard,
  flicker: Radio,
  emc: ScanSearch,
  heatsink: Fan,
  tim: Thermometer,
  cfd: ScanSearch,
  junction: Thermometer,
  lens: Aperture,
  reflector: Aperture,
  ies: ScanSearch,
  spectrum: Aperture,
  sealing: Droplets,
  corrosion: Shield,
  vent: Waves,
  drop: Lock,
}

interface BomSidebarProps {
  activeNodeId: string
  onSelectNode: (id: string) => void
  totalParts: number
  highRiskCount: number
}

function TreeItem({
  node,
  depth = 0,
  activeId,
  onSelect,
}: {
  node: FmeaBomNode
  depth?: number
  activeId: string
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = Boolean(node.children?.length)
  const Icon = iconMap[node.icon]
  const isActive = node.id === activeId

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) {
            setExpanded((current) => !current)
          }
          onSelect(node.id)
        }}
        className={`group flex w-full items-start gap-2 py-2 pr-3 text-left transition-colors ${
          isActive
            ? "border-l-2 border-blue-500 bg-blue-900/30 text-blue-400"
            : "border-l-2 border-transparent text-zinc-400 hover:bg-white/5 hover:text-cyan-200"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600 group-hover:text-cyan-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600 group-hover:text-cyan-400" />
          )
        ) : (
          <span className="mt-0.5 h-3 w-3 shrink-0" />
        )}
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">{node.label}</span>
          {depth <= 1 ? (
            <span className="mt-0.5 block truncate text-[10px] text-zinc-600">
              {node.owner}
            </span>
          ) : null}
        </span>
      </button>
      {hasChildren && expanded ? (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function BomSidebar({
  activeNodeId,
  onSelectNode,
  totalParts,
  highRiskCount,
}: BomSidebarProps) {
  const activeNode = useMemo(
    () => findBomNodeById(lightingBomTree, activeNodeId) ?? lightingBomTree[0],
    [activeNodeId]
  )

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-white/5 bg-zinc-950/60">
      <div className="border-b border-white/5 px-4 py-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.55)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            Lighting BOM Tree
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-200">照明四大核心子系统</p>
        <p className="mt-1 text-[11px] leading-5 text-zinc-500">
          以 Driver & Electrical、Thermal、Optical、Mechanical 为主轴，绑定跨部门责任。
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {lightingBomTree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            activeId={activeNodeId}
            onSelect={onSelectNode}
          />
        ))}
      </div>

      <div className="border-t border-white/5 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">失效模式</p>
            <p className="text-sm font-mono text-zinc-300">{totalParts}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">高风险项</p>
            <p className="text-sm font-mono text-rose-400">{highRiskCount}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
