"use client"

import { useState, useCallback } from "react"
import { ArrowUpDown, Trash2 } from "lucide-react"
import type { FmeaRow } from "@/lib/fmea-data"

/* ── RPN badge (compact LED style) ── */
function getRpnBadge(rpn: number) {
  if (rpn >= 100) {
    return (
      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[10px] font-mono tracking-wider shadow-[0_0_6px_rgba(244,63,94,0.12)]">
        {rpn}
      </span>
    )
  }
  if (rpn >= 50) {
    return (
      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-mono tracking-wider shadow-[0_0_6px_rgba(245,158,11,0.08)]">
        {rpn}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono tracking-wider shadow-[0_0_6px_rgba(16,185,129,0.08)]">
      {rpn}
    </span>
  )
}

/* ── RPN' badge (outline style for reduced risk) ── */
function getRpn2Badge(rpn: number) {
  if (rpn >= 100) {
    return (
      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400/70 text-[10px] font-mono tracking-wider">
        {rpn}
      </span>
    )
  }
  if (rpn >= 50) {
    return (
      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400/70 text-[10px] font-mono tracking-wider">
        {rpn}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400/70 text-[10px] font-mono tracking-wider">
      {rpn}
    </span>
  )
}

/* ── AP badge (compact LED style) ── */
function getApBadge(ap: string) {
  const styles: Record<string, string> = {
    H: "border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.12)]",
    M: "border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.08)]",
    L: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.08)]",
  }
  const labels: Record<string, string> = { H: "高", M: "中", L: "低" }
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded border text-[10px] font-mono tracking-wider ${styles[ap] || styles.L}`}
    >
      {labels[ap] || ap}
    </span>
  )
}

/* ── Column / header definitions ── */
const headerGroups = [
  { label: "失效分析", colSpan: 3, frozen: true },
  { label: "现行控制", colSpan: 6, divider: true },
  { label: "风险评估", colSpan: 2, divider: true },
  { label: "改进措施", colSpan: 3, divider: true },
  { label: "优化结果", colSpan: 5 },
]

const FROZEN_W = [140, 120, 180]
const FROZEN_LEFT = [0, FROZEN_W[0], FROZEN_W[0] + FROZEN_W[1]]

const columns = [
  { key: "process", label: "过程/零件", frozen: true, frozenIdx: 0, align: "left" as const, w: "w-[140px] min-w-[140px] max-w-[140px]", editable: true },
  { key: "mode", label: "失效模式", frozen: true, frozenIdx: 1, align: "left" as const, w: "w-[120px] min-w-[120px] max-w-[120px]", editable: true },
  { key: "effect", label: "失效影响", frozen: true, frozenIdx: 2, lastFrozen: true, align: "left" as const, w: "w-[180px] min-w-[180px] max-w-[280px]", editable: true },
  { key: "sev", label: "S", align: "center" as const, w: "w-12 min-w-[3rem] max-w-[3rem]", editable: true, type: "number" as const },
  { key: "cause", label: "失效原因", align: "left" as const, w: "w-[180px] min-w-[180px] max-w-[280px]", editable: true },
  { key: "pc", label: "预防控制", align: "left" as const, w: "w-[180px] min-w-[180px] max-w-[280px]", editable: true },
  { key: "occ", label: "O", align: "center" as const, w: "w-12 min-w-[3rem] max-w-[3rem]", editable: true, type: "number" as const },
  { key: "dc", label: "探测控制", align: "left" as const, w: "w-[180px] min-w-[180px] max-w-[280px]", editable: true },
  { key: "det", label: "D", align: "center" as const, w: "w-12 min-w-[3rem] max-w-[3rem]", editable: true, type: "number" as const, sectionEnd: true },
  { key: "rpn", label: "RPN", align: "center" as const, w: "w-16 min-w-[4rem] max-w-[4rem]" },
  { key: "ap", label: "AP", align: "center" as const, w: "w-16 min-w-[4rem] max-w-[4rem]", sectionEnd: true },
  { key: "action", label: "建议措施", align: "left" as const, w: "w-[180px] min-w-[180px] max-w-[280px]", editable: true },
  { key: "resp", label: "责任部门", align: "left" as const, w: "w-[100px] min-w-[100px] max-w-[100px]", editable: true },
  { key: "date", label: "目标日期", align: "center" as const, w: "w-[90px] min-w-[90px] max-w-[90px]", editable: true, type: "date" as const, sectionEnd: true },
  { key: "status", label: "状态", align: "center" as const, w: "w-16 min-w-[4rem] max-w-[4rem]", editable: true, type: "status" as const },
  { key: "sev2", label: "S\u2032", align: "center" as const, w: "w-12 min-w-[3rem] max-w-[3rem]", editable: true, type: "number" as const },
  { key: "occ2", label: "O\u2032", align: "center" as const, w: "w-12 min-w-[3rem] max-w-[3rem]", editable: true, type: "number" as const },
  { key: "det2", label: "D\u2032", align: "center" as const, w: "w-12 min-w-[3rem] max-w-[3rem]", editable: true, type: "number" as const },
  { key: "rpn2", label: "RPN\u2032", align: "center" as const, w: "w-16 min-w-[4rem] max-w-[4rem]" },
  { key: "actions", label: "", align: "center" as const, w: "w-10 min-w-[2.5rem] max-w-[2.5rem]" },
]

interface FmeaDataGridProps {
  data: FmeaRow[]
  onUpdateRow: (id: string, field: keyof FmeaRow, value: string | number) => void
  onDeleteRow: (id: string) => void
}

export function FmeaDataGrid({ data, onUpdateRow, onDeleteRow }: FmeaDataGridProps) {
  const [sortKey, setSortKey] = useState<string>("rpn")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey as keyof FmeaRow]
    const bVal = b[sortKey as keyof FmeaRow]
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return 0
  })

  /* ── Inline edit handler ── */
  const handleCellChange = useCallback(
    (rowId: string, field: keyof FmeaRow, value: string | number, type?: string) => {
      if (type === "number") {
        const numVal = Math.max(1, Math.min(10, Number(value) || 1))
        onUpdateRow(rowId, field, numVal)
      } else {
        onUpdateRow(rowId, field, value)
      }
    },
    [onUpdateRow]
  )

  /* ── Render editable or static cell ── */
  const renderCell = (row: FmeaRow, col: typeof columns[number]) => {
    const key = col.key
    const value = row[key as keyof FmeaRow]

    // Action column (delete button)
    if (key === "actions") {
      return (
        <button
          onClick={() => onDeleteRow(row.id)}
          className="p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          aria-label="删除行"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )
    }

    // Status LED indicator (clickable toggle)
    if (key === "status") {
      return (
        <button
          onClick={() => onUpdateRow(row.id, "status", row.status === "closed" ? "pending" : "closed")}
          className="flex items-center justify-center w-full cursor-pointer"
          aria-label={row.status === "closed" ? "已完成" : "待处理"}
        >
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              row.status === "closed"
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                : "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
            }`}
          />
        </button>
      )
    }

    // RPN badges (read-only, auto-calculated)
    if (key === "rpn") return getRpnBadge(row.rpn)
    if (key === "rpn2") return getRpn2Badge(row.rpn2)
    if (key === "ap") return getApBadge(row.ap)

    // Editable number fields (S, O, D)
    if (col.editable && col.type === "number") {
      return (
        <input
          type="number"
          min={1}
          max={10}
          value={value as number}
          onChange={(e) => handleCellChange(row.id, key as keyof FmeaRow, e.target.value, "number")}
          className="w-full bg-transparent outline-none text-center font-mono text-xs text-zinc-300 focus:bg-cyan-500/10 focus:text-cyan-300 rounded transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )
    }

    // Editable date field
    if (col.editable && col.type === "date") {
      return (
        <input
          type="date"
          value={value as string}
          onChange={(e) => handleCellChange(row.id, key as keyof FmeaRow, e.target.value)}
          className="w-full bg-transparent outline-none text-center font-mono text-[11px] text-zinc-500 focus:bg-cyan-500/10 focus:text-cyan-300 rounded transition-colors"
        />
      )
    }

    // Editable text fields
    if (col.editable) {
      const isProcessOrMode = key === "process" || key === "mode"
      return (
        <input
          type="text"
          value={value as string}
          onChange={(e) => handleCellChange(row.id, key as keyof FmeaRow, e.target.value)}
          className={`w-full bg-transparent outline-none truncate text-xs focus:bg-cyan-500/10 focus:text-cyan-300 rounded px-0.5 -mx-0.5 transition-colors ${
            isProcessOrMode ? "text-zinc-200 font-medium" : "text-zinc-300"
          }`}
          placeholder={col.label}
        />
      )
    }

    // Read-only text display (fallback)
    return <span className="text-xs text-zinc-300 truncate block">{value}</span>
  }

  /* ── Styling classes ── */
  const cellBase = "py-1.5 whitespace-nowrap transition-colors duration-75 align-middle"
  const cellLeft = "pl-4 pr-3 text-left"
  const cellCenter = "px-2 text-center"
  const scrollingCellHover = "group-hover:bg-zinc-800"

  const pseudoShadow = "relative after:absolute after:top-0 after:bottom-0 after:-right-[20px] after:w-[20px] after:bg-gradient-to-r after:from-black/90 after:to-transparent after:pointer-events-none"

  const frozenCellBase = (isLast?: boolean) =>
    `sticky z-30 bg-zinc-950 group-hover:bg-zinc-800 ${isLast ? `border-r border-zinc-800 ${pseudoShadow}` : ""}`

  const frozenCellEven = (isLast?: boolean) =>
    `sticky z-30 bg-zinc-900 group-hover:bg-zinc-800 ${isLast ? `border-r border-zinc-800 ${pseudoShadow}` : ""}`

  const headerCellBase = "py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold whitespace-nowrap bg-zinc-950 align-middle"
  const frozenHeader = (isLast?: boolean) =>
    `sticky z-40 bg-zinc-950 ${isLast ? `border-r border-zinc-800 ${pseudoShadow}` : ""}`

  return (
    <div className="flex-1 overflow-auto relative">
      <table className="table-fixed w-max border-collapse">
        <thead>
          {/* ── Top-level category headers ── */}
          <tr className="sticky top-0 z-50">
            {headerGroups.map((group) => (
              <th
                key={group.label}
                colSpan={group.colSpan}
                className={`px-3 py-2 text-xs uppercase tracking-widest text-cyan-600/80 font-bold text-center bg-zinc-950 border-b border-zinc-700 ${
                  group.frozen
                    ? `sticky left-0 z-50 border-r border-zinc-800 ${pseudoShadow}`
                    : ""
                } ${group.divider ? "border-r border-white/5" : ""}`}
                style={group.frozen ? { width: FROZEN_W[0] + FROZEN_W[1] + FROZEN_W[2] } : undefined}
              >
                {group.label}
              </th>
            ))}
            {/* Extra column for delete actions */}
            <th className="px-2 py-2 text-xs bg-zinc-950 border-b border-zinc-700" />
          </tr>
          {/* ── Column headers ── */}
          <tr className="sticky top-[33px] z-30 border-b border-white/10">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${headerCellBase} ${col.w} ${
                  col.align === "center" ? "px-2 text-center" : "pl-4 pr-3 text-left"
                } ${col.frozen ? frozenHeader(col.lastFrozen) : ""} ${col.sectionEnd ? "border-r border-white/5" : ""}`}
                style={col.frozen ? { left: FROZEN_LEFT[col.frozenIdx!] } : undefined}
              >
                {col.label && (
                  <button
                    onClick={() => col.key !== "actions" && toggleSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-cyan-400 transition-colors ${
                      col.align === "center" ? "justify-center w-full" : ""
                    }`}
                    disabled={col.key === "actions"}
                  >
                    {col.label}
                    {sortKey === col.key && <ArrowUpDown className="w-2.5 h-2.5 text-cyan-500" />}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-zinc-600 text-sm">
                暂无数据。点击「添加」按钮创建新记录。
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => {
              const isEven = rowIndex % 2 === 0
              return (
                <tr key={row.id} className="group border-b border-white/[0.04] transition-colors">
                  {columns.map((col) => {
                    let cellClass = `${cellBase} ${col.w} ${col.align === "center" ? cellCenter : cellLeft}`

                    if (col.frozen) {
                      cellClass += ` ${isEven ? frozenCellEven(col.lastFrozen) : frozenCellBase(col.lastFrozen)}`
                    } else {
                      cellClass += ` ${isEven ? "bg-zinc-900/40" : "bg-transparent"} ${scrollingCellHover}`
                    }

                    if (col.sectionEnd) {
                      cellClass += " border-r border-white/5"
                    }

                    return (
                      <td
                        key={col.key}
                        className={cellClass}
                        style={col.frozen ? { left: FROZEN_LEFT[col.frozenIdx!] } : undefined}
                      >
                        {renderCell(row, col)}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
