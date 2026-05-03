"use client"

import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Box,
  Layers,
  Cpu,
  CircuitBoard,
  Cog,
} from "lucide-react"

interface TreeNode {
  id: string
  label: string
  icon: React.ElementType
  children?: TreeNode[]
}

const bomTree: TreeNode[] = [
  {
    id: "asm-001",
    label: "总装配体",
    icon: Box,
    children: [
      {
        id: "sub-001",
        label: "上壳体组件",
        icon: Layers,
        children: [
          { id: "prt-001", label: "上盖注塑", icon: Cog },
          { id: "prt-002", label: "卡扣结构", icon: Cog },
          { id: "prt-003", label: "密封圈", icon: Cog },
        ],
      },
      {
        id: "sub-002",
        label: "PCB主板组件",
        icon: CircuitBoard,
        children: [
          { id: "prt-004", label: "SMT贴片", icon: Cpu },
          { id: "prt-005", label: "波峰焊", icon: Cpu },
          { id: "prt-006", label: "功能测试", icon: Cpu },
        ],
      },
      {
        id: "sub-003",
        label: "下壳体组件",
        icon: Layers,
        children: [
          { id: "prt-007", label: "下盖注塑", icon: Cog },
          { id: "prt-008", label: "螺柱结构", icon: Cog },
        ],
      },
    ],
  },
]

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
  node: TreeNode
  depth?: number
  activeId: string
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0
  const Icon = node.icon
  const isActive = node.id === activeId

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded)
          onSelect(node.id)
        }}
        className={`w-full flex items-center gap-2 py-1.5 pr-3 text-left transition-colors group ${
          isActive
            ? "text-cyan-400 bg-cyan-500/10"
            : "text-zinc-400 hover:text-cyan-400 hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3 h-3 shrink-0 text-zinc-600 group-hover:text-cyan-500" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0 text-zinc-600 group-hover:text-cyan-500" />
          )
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
        <span className="text-xs truncate">{node.label}</span>
      </button>
      {hasChildren && expanded && (
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
      )}
    </div>
  )
}

export function BomSidebar({
  activeNodeId,
  onSelectNode,
  totalParts,
  highRiskCount,
}: BomSidebarProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-white/5 bg-zinc-950/50 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            BOM 结构树
          </span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">产品物料清单导航</p>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {bomTree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            activeId={activeNodeId}
            onSelect={onSelectNode}
          />
        ))}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">失效模式</p>
            <p className="text-sm font-mono text-zinc-300">{totalParts}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">高风险项</p>
            <p className="text-sm font-mono text-rose-400">{highRiskCount}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
