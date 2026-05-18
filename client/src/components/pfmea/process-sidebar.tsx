"use client"

import { useMemo, useState, type ElementType } from "react"
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Factory,
  PackageCheck,
  ScanLine,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react"

import {
  findPfmeaNodeById,
  pfmeaTree,
  type PfmeaNode,
  type PfmeaNodeIcon,
} from "@/lib/pfmea-data"

const iconMap: Record<PfmeaNodeIcon, ElementType> = {
  root: Workflow,
  logistics: Boxes,
  smt: ScanLine,
  assembly: Settings2,
  testing: ShieldCheck,
  packaging: PackageCheck,
  step: ClipboardCheck,
}

interface ProcessSidebarProps {
  activeNodeId: string
  onSelectNode: (id: string) => void
  totalRows: number
  highRiskCount: number
}

function TreeItem({
  node,
  depth = 0,
  activeId,
  onSelect,
}: {
  node: PfmeaNode
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

export function ProcessSidebar({
  activeNodeId,
  onSelectNode,
  totalRows,
  highRiskCount,
}: ProcessSidebarProps) {
  const activeNode = useMemo(
    () => findPfmeaNodeById(pfmeaTree, activeNodeId) ?? pfmeaTree[0],
    [activeNodeId]
  )

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-white/5 bg-zinc-950/60">
      <div className="border-b border-white/5 px-4 py-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.55)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            PFMEA Process Tree
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-200">制造过程风险结构</p>
        <p className="mt-1 text-[11px] leading-5 text-zinc-500">
          以物流、SMT、装配、测试、包装为主轴，绑定工序责任与过程控制闭环。
        </p>
        <div className="mt-3 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03] px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <Factory className="h-3.5 w-3.5 text-cyan-400" />
            <span className="truncate">{activeNode.label}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {pfmeaTree.map((node) => (
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
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">过程条目</p>
            <p className="text-sm font-mono text-zinc-300">{totalRows}</p>
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
