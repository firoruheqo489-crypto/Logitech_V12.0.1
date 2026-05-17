"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpDown } from "lucide-react"

import {
  getFmeaRiskBand,
  isCriticalFmeaRisk,
  type FmeaRow,
  type FmeaStatus,
} from "@/lib/fmea-data"

type EditableField =
  | "process"
  | "mode"
  | "effect"
  | "sev"
  | "cause"
  | "pc"
  | "occ"
  | "dc"
  | "det"
  | "action"
  | "ownerGate"
  | "status"

type StickyTier = "first" | "second"

type ColumnDef = {
  key: keyof FmeaRow
  label: string
  align?: "left" | "center"
  width: string
  editable?: boolean
  type?: "number" | "status"
  sticky?: StickyTier
}

interface FmeaDataGridProps {
  data: FmeaRow[]
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onVisibleRowsChange?: (rows: FmeaRow[]) => void
  onUpdateRow: (
    id: string,
    field: EditableField,
    value: FmeaRow[EditableField]
  ) => void
}

const columns: ColumnDef[] = [
  {
    key: "process",
    label: "系统/部件",
    align: "left",
    width: "w-[180px] min-w-[180px]",
    editable: true,
    sticky: "first",
  },
  {
    key: "mode",
    label: "失效模式",
    align: "left",
    width: "w-[160px] min-w-[160px]",
    editable: true,
    sticky: "second",
  },
  {
    key: "effect",
    label: "失效后果",
    align: "left",
    width: "w-[220px] min-w-[220px]",
    editable: true,
  },
  {
    key: "sev",
    label: "S",
    align: "center",
    width: "w-12 min-w-[3rem]",
    editable: true,
    type: "number",
  },
  {
    key: "cause",
    label: "失效原因",
    align: "left",
    width: "w-[220px] min-w-[220px]",
    editable: true,
  },
  {
    key: "pc",
    label: "预防控制",
    align: "left",
    width: "w-[220px] min-w-[220px]",
    editable: true,
  },
  {
    key: "occ",
    label: "O",
    align: "center",
    width: "w-12 min-w-[3rem]",
    editable: true,
    type: "number",
  },
  {
    key: "dc",
    label: "探测控制",
    align: "left",
    width: "w-[220px] min-w-[220px]",
    editable: true,
  },
  {
    key: "det",
    label: "D",
    align: "center",
    width: "w-12 min-w-[3rem]",
    editable: true,
    type: "number",
  },
  {
    key: "rpn",
    label: "RPN",
    align: "center",
    width: "w-20 min-w-[5rem]",
  },
  {
    key: "action",
    label: "建议措施",
    align: "left",
    width: "w-[220px] min-w-[220px]",
    editable: true,
  },
  {
    key: "ownerGate",
    label: "责任人",
    align: "left",
    width: "w-[160px] min-w-[160px]",
    editable: true,
  },
  {
    key: "status",
    label: "状态",
    align: "center",
    width: "w-[120px] min-w-[120px]",
    editable: true,
    type: "status",
  },
]

const sequenceColumnWidth = "w-14 min-w-[3.5rem]"
const stickyHeaderSurface = "bg-[#09090b]"
const stickyBodyOddSurface = "bg-[#09090b]"
const stickyBodyEvenSurface = "bg-[#111114]"
const stickyBodyHoverSurface = "group-hover:bg-[#161b22]"
const stickyDivider =
  "border-r border-zinc-800 shadow-[4px_0_12px_rgba(0,0,0,0.5)]"

function getStatusLabel(status: FmeaStatus) {
  if (status === "closed") return "已闭环"
  if (status === "testing") return "验证中"
  return "待处理"
}

function getNextStatus(status: FmeaStatus): FmeaStatus {
  if (status === "pending") return "testing"
  if (status === "testing") return "closed"
  return "pending"
}

function getStickyOffsetClass(sticky?: StickyTier) {
  if (sticky === "first") return "left-[3.5rem]"
  if (sticky === "second") return "left-[236px]"
  return ""
}

function getSequenceHeaderClass() {
  return [
    "sticky left-0 top-0 z-40",
    sequenceColumnWidth,
    "border-b border-zinc-800",
    "px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500",
    stickyHeaderSurface,
  ].join(" ")
}

function getHeaderCellClass(column: ColumnDef) {
  const alignClass =
    column.align === "center" ? "px-2 text-center" : "pl-4 pr-3 text-left"

  if (column.sticky === "first") {
    return [
      "sticky top-0 z-40",
      alignClass,
      column.width,
      "py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500",
      "border-b border-zinc-800",
      stickyHeaderSurface,
      getStickyOffsetClass(column.sticky),
    ].join(" ")
  }

  if (column.sticky === "second") {
    return [
      "sticky top-0 z-40",
      alignClass,
      column.width,
      "py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500",
      "border-b border-zinc-800",
      stickyHeaderSurface,
      getStickyOffsetClass(column.sticky),
      stickyDivider,
    ].join(" ")
  }

  return [
    "sticky top-0 z-30",
    alignClass,
    column.width,
    "py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500",
    "border-b border-zinc-800 bg-zinc-900",
  ].join(" ")
}

function getBodyCellClass(
  column: ColumnDef,
  rowIndex: number,
  row: FmeaRow,
  isSelected: boolean
) {
  const alignClass =
    column.align === "center" ? "px-2 text-center" : "pl-4 pr-3 text-left"
  const baseClass = [
    "align-middle whitespace-nowrap py-1 text-[11px]",
    alignClass,
    column.width,
    "border-b border-white/[0.04]",
  ]

  if (column.sticky === "first") {
    return [
      ...baseClass,
      "sticky z-10",
      getStickyOffsetClass(column.sticky),
      isCriticalFmeaRisk(row.sev, row.rpn)
        ? "border-l-2 border-l-red-500"
        : "border-l-2 border-l-transparent",
      isSelected
        ? "bg-blue-950/30"
        : rowIndex % 2 === 0
          ? stickyBodyEvenSurface
          : stickyBodyOddSurface,
      stickyBodyHoverSurface,
    ].join(" ")
  }

  if (column.sticky === "second") {
    return [
      ...baseClass,
      "sticky z-10",
      getStickyOffsetClass(column.sticky),
      isSelected
        ? "bg-blue-950/30"
        : rowIndex % 2 === 0
          ? stickyBodyEvenSurface
          : stickyBodyOddSurface,
      stickyBodyHoverSurface,
      stickyDivider,
    ].join(" ")
  }

  return [
    ...baseClass,
    isSelected
      ? "bg-blue-950/20"
      : rowIndex % 2 === 0
        ? "bg-zinc-900/40"
        : "bg-transparent",
    "group-hover:bg-zinc-800/70",
  ].join(" ")
}

function getSequenceBodyCellClass(
  rowIndex: number,
  row: FmeaRow,
  isSelected: boolean
) {
  return [
    "sticky left-0 z-10",
    sequenceColumnWidth,
    "align-middle border-b border-white/[0.04] px-2 py-1 text-center",
    isCriticalFmeaRisk(row.sev, row.rpn)
      ? "border-l-2 border-l-red-500"
      : "border-l-2 border-l-transparent",
    isSelected
      ? "bg-blue-950/30"
      : rowIndex % 2 === 0
        ? stickyBodyEvenSurface
        : stickyBodyOddSurface,
    stickyBodyHoverSurface,
  ].join(" ")
}

function getRpnBadge(row: Pick<FmeaRow, "sev" | "rpn">) {
  const riskBand = getFmeaRiskBand(row.sev, row.rpn)

  if (riskBand === "critical") {
    return (
      <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-md border border-red-900/50 bg-red-950/40 px-2 py-0.5 font-mono text-[11px] font-bold text-red-400">
        {row.rpn}
      </span>
    )
  }

  if (riskBand === "warning") {
    return (
      <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-500">
        {row.rpn}
      </span>
    )
  }

  return (
    <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-0.5 font-mono text-[11px] text-emerald-500">
      {row.rpn}
    </span>
  )
}

function getStatusBadgeClass(status: FmeaStatus, row: Pick<FmeaRow, "sev" | "rpn">) {
  const isCriticalOpen =
    status === "pending" && isCriticalFmeaRisk(row.sev, row.rpn)

  if (isCriticalOpen) {
    return "bg-red-950/40 text-red-400 ring-1 ring-red-900/60 shadow-[0_0_0_1px_rgba(127,29,29,0.18)]"
  }

  if (status === "closed") {
    return "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
  }

  if (status === "testing") {
    return "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
  }

  return "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
}

export function FmeaDataGrid({
  data,
  selectedRowId,
  onSelectRow,
  onVisibleRowsChange,
  onUpdateRow,
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

  useEffect(() => {
    onVisibleRowsChange?.(sortedData)
  }, [onVisibleRowsChange, sortedData])

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
      if (column.key === "status") {
        return (
          <button
            type="button"
            onClick={() =>
              handleCellChange(row.id, "status", getNextStatus(row.status))
            }
            className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${getStatusBadgeClass(
              row.status,
              row
            )}`}
            aria-label={getStatusLabel(row.status)}
            title={
              row.status === "pending" && isCriticalFmeaRisk(row.sev, row.rpn)
                ? "高风险项待处理，需要优先闭环并补齐验证记录。"
                : getStatusLabel(row.status)
            }
          >
            {getStatusLabel(row.status)}
          </button>
        )
      }

      if (column.key === "rpn") {
        return getRpnBadge(row)
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
            className="w-full rounded bg-transparent text-center font-mono text-[11px] text-zinc-300 outline-none transition-colors focus:bg-cyan-500/10 focus:text-cyan-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
            className="w-full rounded bg-transparent px-0.5 text-[11px] text-zinc-300 outline-none transition-colors focus:bg-cyan-500/10 focus:text-cyan-300"
            placeholder={column.label}
          />
        )
      }

      return (
        <span className="block truncate text-[11px] text-zinc-300">
          {String(value)}
        </span>
      )
    },
    [handleCellChange]
  )

  const getRowClassName = (row: FmeaRow) => {
    const isSelected = row.id === selectedRowId
    const isCritical = isCriticalFmeaRisk(row.sev, row.rpn)

    return [
      "group cursor-pointer transition-colors",
      isSelected ? "bg-blue-950/20" : "",
      isCritical ? "shadow-[inset_2px_0_0_0_rgba(248,113,113,0.9)]" : "",
    ]
      .filter(Boolean)
      .join(" ")
  }

  return (
    <div className="fmea-grid-scroll relative isolate h-full min-h-0 w-full min-w-0 overflow-auto">
      <table className="w-max min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-30">
          <tr>
            <th className={getSequenceHeaderClass()}>#</th>
            {columns.map((column) => (
              <th key={column.key} className={getHeaderCellClass(column)}>
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
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="border-b border-white/[0.04] py-12 text-center text-sm text-zinc-600"
              >
                当前范围内暂无 FMEA 数据。
              </td>
            </tr>
          ) : null}

          {sortedData.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={getRowClassName(row)}
              onClick={() => onSelectRow(row.id)}
            >
              <td
                className={getSequenceBodyCellClass(
                  rowIndex,
                  row,
                  row.id === selectedRowId
                )}
              >
                <span className="font-mono text-[11px] text-zinc-400">
                  {rowIndex + 1}
                </span>
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={getBodyCellClass(
                    column,
                    rowIndex,
                    row,
                    row.id === selectedRowId
                  )}
                >
                  {renderCell(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
