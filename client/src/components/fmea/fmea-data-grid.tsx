"use client"

import { useCallback, useMemo, useState } from "react"
import { ArrowUpDown, Trash2 } from "lucide-react"

import { type FmeaRow, type FmeaStatus } from "@/lib/fmea-data"

type EditableField =
  | "process"
  | "mode"
  | "effect"
  | "crossRisk"
  | "sev"
  | "cause"
  | "pc"
  | "occ"
  | "dc"
  | "det"
  | "action"
  | "ownerGate"
  | "status"

type ColumnDef = {
  key: keyof FmeaRow | "actions"
  label: string
  align?: "left" | "center"
  width: string
  editable?: boolean
  type?: "number" | "status"
  sticky?: boolean
}

interface FmeaDataGridProps {
  data: FmeaRow[]
  onUpdateRow: (
    id: string,
    field: EditableField,
    value: FmeaRow[EditableField]
  ) => void
  onDeleteRow: (id: string) => void
}

const columns: ColumnDef[] = [
  { key: "process", label: "系统/部件", align: "left", width: "w-[180px] min-w-[180px]", editable: true, sticky: true },
  { key: "mode", label: "失效模式", align: "left", width: "w-[160px] min-w-[160px]", editable: true },
  { key: "effect", label: "失效后果", align: "left", width: "w-[220px] min-w-[220px]", editable: true },
  { key: "crossRisk", label: "耦合影响", align: "left", width: "w-[220px] min-w-[220px]", editable: true },
  { key: "sev", label: "S", align: "center", width: "w-12 min-w-[3rem]", editable: true, type: "number" },
  { key: "cause", label: "失效原因", align: "left", width: "w-[220px] min-w-[220px]", editable: true },
  { key: "pc", label: "预防控制", align: "left", width: "w-[220px] min-w-[220px]", editable: true },
  { key: "occ", label: "O", align: "center", width: "w-12 min-w-[3rem]", editable: true, type: "number" },
  { key: "dc", label: "探测控制", align: "left", width: "w-[220px] min-w-[220px]", editable: true },
  { key: "det", label: "D", align: "center", width: "w-12 min-w-[3rem]", editable: true, type: "number" },
  { key: "rpn", label: "RPN", align: "center", width: "w-16 min-w-[4rem]" },
  { key: "action", label: "建议措施", align: "left", width: "w-[220px] min-w-[220px]", editable: true },
  { key: "ownerGate", label: "责任节点", align: "left", width: "w-[140px] min-w-[140px]", editable: true },
  { key: "status", label: "状态", align: "center", width: "w-[90px] min-w-[90px]", editable: true, type: "status" },
  { key: "actions", label: "", align: "center", width: "w-10 min-w-[2.5rem]" },
]

function getStatusLabel(status: FmeaStatus) {
  if (status === "closed") return "已关闭"
  if (status === "testing") return "验证中"
  return "待处理"
}

function getStatusClass(status: FmeaStatus) {
  if (status === "closed") {
    return "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
  }
  if (status === "testing") {
    return "bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]"
  }
  return "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
}

function getNextStatus(status: FmeaStatus): FmeaStatus {
  if (status === "pending") return "testing"
  if (status === "testing") return "closed"
  return "pending"
}

function getRpnBadge(rpn: number) {
  if (rpn >= 100) {
    return (
      <span className="inline-flex items-center justify-center rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.12)]">
        {rpn}
      </span>
    )
  }

  if (rpn >= 50) {
    return (
      <span className="inline-flex items-center justify-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.08)]">
        {rpn}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.08)]">
      {rpn}
    </span>
  )
}

export function FmeaDataGrid({
  data,
  onUpdateRow,
  onDeleteRow,
}: FmeaDataGridProps) {
  const [sortKey, setSortKey] = useState<keyof FmeaRow>("rpn")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = useCallback((key: keyof FmeaRow) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"))
        return prevKey
      }

      setSortDir("desc")
      return key
    })
  }, [])

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal
      }

      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [data, sortDir, sortKey])

  const handleCellChange = useCallback(
    (rowId: string, field: EditableField, value: string | number) => {
      if (field === "sev" || field === "occ" || field === "det") {
        const numVal = Math.max(1, Math.min(10, Number(value) || 1))
        onUpdateRow(rowId, field, numVal)
        return
      }

      if (field === "status") {
        onUpdateRow(rowId, field, value as FmeaStatus)
        return
      }

      onUpdateRow(rowId, field, String(value))
    },
    [onUpdateRow]
  )

  const renderCell = useCallback(
    (row: FmeaRow, column: ColumnDef) => {
      if (column.key === "actions") {
        return (
          <button
            type="button"
            onClick={() => onDeleteRow(row.id)}
            className="rounded p-1 text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
            aria-label="删除行"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )
      }

      if (column.key === "status") {
        return (
          <button
            type="button"
            onClick={() =>
              handleCellChange(row.id, "status", getNextStatus(row.status))
            }
            className="flex w-full items-center justify-center gap-2 text-[11px] text-zinc-400"
            aria-label={getStatusLabel(row.status)}
          >
            <span className={`h-2 w-2 rounded-full ${getStatusClass(row.status)}`} />
            <span>{getStatusLabel(row.status)}</span>
          </button>
        )
      }

      if (column.key === "rpn") {
        return getRpnBadge(row.rpn)
      }

      const value = row[column.key as keyof FmeaRow]

      if (column.editable && column.type === "number") {
        return (
          <input
            type="number"
            min={1}
            max={10}
            value={value as number}
            onChange={(event) =>
              handleCellChange(
                row.id,
                column.key as EditableField,
                event.target.value
              )
            }
            className="w-full rounded bg-transparent text-center font-mono text-xs text-zinc-300 outline-none transition-colors focus:bg-cyan-500/10 focus:text-cyan-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        )
      }

      if (column.editable) {
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(event) =>
              handleCellChange(
                row.id,
                column.key as EditableField,
                event.target.value
              )
            }
            className="w-full rounded bg-transparent px-0.5 text-xs text-zinc-300 outline-none transition-colors focus:bg-cyan-500/10 focus:text-cyan-300"
            placeholder={column.label}
          />
        )
      }

      return <span className="block truncate text-xs text-zinc-300">{String(value)}</span>
    },
    [handleCellChange, onDeleteRow]
  )

  return (
    <div className="relative flex-1 overflow-auto">
      <table className="w-max min-w-full border-collapse">
        <thead>
          <tr className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 ${
                  column.align === "center" ? "px-2 text-center" : "pl-4 pr-3 text-left"
                } ${column.width} ${
                  column.sticky
                    ? "sticky left-0 z-40 border-r border-zinc-800 bg-zinc-950"
                    : ""
                }`}
              >
                {column.key === "actions" ? null : (
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key as keyof FmeaRow)}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-cyan-400 ${
                      column.align === "center" ? "justify-center" : ""
                    }`}
                  >
                    {column.label}
                    {sortKey === column.key ? (
                      <ArrowUpDown className="h-2.5 w-2.5 text-cyan-500" />
                    ) : null}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-12 text-center text-sm text-zinc-600"
              >
                当前范围内暂无 FMEA 数据。
              </td>
            </tr>
          ) : null}

          {sortedData.map((row, rowIndex) => {
            const even = rowIndex % 2 === 0
            const rowClass = even ? "bg-zinc-900/40" : "bg-transparent"

            return (
              <tr
                key={row.id}
                className="group border-b border-white/[0.04] transition-colors hover:bg-zinc-800/70"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`align-middle whitespace-nowrap py-1.5 ${
                      column.align === "center" ? "px-2 text-center" : "pl-4 pr-3 text-left"
                    } ${column.width} ${
                      column.sticky
                        ? `${rowClass} sticky left-0 z-20 border-r border-zinc-800 group-hover:bg-zinc-800`
                        : `${rowClass} group-hover:bg-zinc-800`
                    }`}
                  >
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
