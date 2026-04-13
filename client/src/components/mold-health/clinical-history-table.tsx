"use client"

import { Fragment, useState, type ReactNode } from "react"
import {
  Stethoscope,
  Wrench,
  ClipboardCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  ArrowUpDown,
  Trash2,
  Loader2,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import { toast } from "sonner"
import type { MoldHealthEvent } from "@/lib/mold-health-types"
import {
  DELETE_RECORD_BUTTON_CLASS,
  EVENT_TYPE_CONFIG,
  DIAGNOSIS_CONFIG,
} from "@/lib/mold-health-types"
import { deleteMaintenanceLog } from "@/lib/mold-health-api"
import { cn } from "@/lib/utils"

const TYPE_ICONS = {
  SICKNESS: Stethoscope,
  SURGERY: Wrench,
  CHECKUP: ClipboardCheck,
}

function SectionLabel({ zh, en }: { zh: string; en: string }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="text-sm font-medium tracking-[0.08em] text-slate-200">
        {zh}
      </span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
        {en}
      </span>
    </span>
  )
}

function RecoveryBar({ rating }: { rating: number }) {
  const percent = rating * 100
  const getColor = (value: number) => {
    if (value >= 0.9) return "bg-success"
    if (value >= 0.7) return "bg-warning"
    return "bg-danger"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                getColor(rating)
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="font-mono text-[12px] text-muted-foreground">
            {percent.toFixed(0)}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="space-y-0.5">
        <p className="text-[12px] text-slate-100">
          可用性恢复值 <span className="text-slate-400">/ Recovery Rating</span>{" "}
          <span className="font-mono">{percent.toFixed(1)}%</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          Recovery Rating: {rating.toFixed(2)}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

type SortField = "timestamp" | "downtimeHours" | "recoveryRating"
type SortDir = "asc" | "desc"

function HeaderCell({
  children,
  sortable,
  active,
  direction,
  onClick,
  align = "left",
  widthClassName,
}: {
  children?: ReactNode
  sortable?: boolean
  active?: boolean
  direction?: SortDir
  onClick?: () => void
  align?: "left" | "center" | "right"
  widthClassName?: string
}) {
  const content = (
    <span
      className={cn(
        "flex items-center gap-1.5",
        align === "left" && "justify-start",
        align === "center" && "justify-center",
        align === "right" && "justify-end"
      )}
    >
      {children}
      {sortable ? (
        active ? (
          direction === "asc" ? (
            <ChevronUp className="size-3 text-slate-100" />
          ) : (
            <ChevronDown className="size-3 text-slate-100" />
          )
        ) : (
          <ArrowUpDown className="size-3 text-slate-400/50" />
        )
      ) : null}
    </span>
  )

  return (
    <TableHead
      className={cn(
        "h-[70px] px-4 py-4 align-middle text-slate-100",
        align === "center" && "text-center",
        align === "right" && "text-right",
        widthClassName
      )}
      onClick={sortable ? onClick : undefined}
    >
      {sortable ? (
        <button
          className={cn(
            "w-full cursor-pointer",
            align === "center" ? "text-center" : "text-left"
          )}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </TableHead>
  )
}

export function ClinicalHistoryTable({
  events,
  filter,
  moldId,
  onChanged,
}: {
  events: MoldHealthEvent[]
  filter: string
  moldId: string
  onChanged?: () => Promise<void> | void
}) {
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MoldHealthEvent | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const filtered = events.filter((event) => {
    if (filter === "ALL") return true
    return event.type === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    const mult = sortDir === "asc" ? 1 : -1
    if (sortField === "timestamp") {
      return mult * (a.timestamp.getTime() - b.timestamp.getTime())
    }
    return mult * ((a[sortField] as number) - (b[sortField] as number))
  })

  const SortLabel = ({ field }: { field: SortField }) => (
    <SectionLabel
      zh={
        field === "timestamp"
          ? "发生时间"
          : field === "downtimeHours"
            ? "停机时间"
            : "恢复率"
      }
      en={
        field === "timestamp"
          ? "TIME"
          : field === "downtimeHours"
            ? "DOWNTIME"
            : "RECOVERY"
      }
    />
  )

  const confirmDelete = async () => {
    if (!pendingDelete || deletingId) return
    const record = pendingDelete
    setPendingDelete(null)
    setDeletingId(record.id)
    try {
      await deleteMaintenanceLog(moldId, record.id)
      toast.success("维护记录已删除")
      await onChanged?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setDeletingId(null)
      if (expandedRow === record.id) {
        setExpandedRow(null)
      }
    }
  }

  return (
    <>
      <div className="overflow-hidden bg-transparent">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[88px]" />
            <col className="w-[176px]" />
            <col className="w-[24%]" />
            <col className="w-[26%]" />
            <col className="w-[120px]" />
            <col className="w-[140px]" />
            <col className="w-[72px]" />
          </colgroup>
          <TableHeader>
            <TableRow className="border-b border-slate-800/60 hover:bg-transparent">
              <HeaderCell widthClassName="pr-10 pl-2">
                <SectionLabel zh="问题类型" en="TYPE" />
              </HeaderCell>
              <HeaderCell
                sortable
                active={sortField === "timestamp"}
                direction={sortDir}
                onClick={() => toggleSort("timestamp")}
                widthClassName="px-8"
              >
                <SortLabel field="timestamp" />
              </HeaderCell>
              <HeaderCell widthClassName="pl-8 pr-6">
                <SectionLabel zh="症状" en="SYMPTOM" />
              </HeaderCell>
              <HeaderCell widthClassName="px-3">
                <SectionLabel zh="处理措施" en="PROCEDURE" />
              </HeaderCell>
              <HeaderCell
                sortable
                active={sortField === "downtimeHours"}
                direction={sortDir}
                onClick={() => toggleSort("downtimeHours")}
                align="center"
              >
                <SortLabel field="downtimeHours" />
              </HeaderCell>
              <HeaderCell
                sortable
                active={sortField === "recoveryRating"}
                direction={sortDir}
                onClick={() => toggleSort("recoveryRating")}
                align="center"
              >
                <SortLabel field="recoveryRating" />
              </HeaderCell>
              <HeaderCell />
            </TableRow>
          </TableHeader>

          <TableBody>
            {sorted.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.type]
              const diagConfig = DIAGNOSIS_CONFIG[event.diagnosis]
              const TypeIcon = TYPE_ICONS[event.type]
              const isExpanded = expandedRow === event.id
              const isDeleting = deletingId === event.id

              return (
                <Fragment key={event.id}>
                  <TableRow
                    className={cn(
                      "cursor-pointer border-slate-800/50 transition-colors hover:bg-secondary/20",
                      isExpanded && "bg-secondary/25"
                    )}
                    onClick={() => setExpandedRow(isExpanded ? null : event.id)}
                  >
                    <TableCell className="px-4 py-3 pr-10 pl-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md p-1.5",
                              config.bgColor
                            )}
                          >
                            <TypeIcon className={cn("size-4", config.color)} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-[11px]">
                            {config.labelZh}{" "}
                            <span className="text-slate-400">/ {config.label}</span>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="px-8 py-3">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[12px] font-medium text-slate-100">
                          {event.timestamp.toLocaleDateString("zh-CN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {event.timestamp.toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-[12px] text-slate-100">
                          {event.symptom}
                        </span>
                        <Badge
                          variant="outline"
                          className="w-fit border-slate-700/80 px-2 py-0.5 text-[10px] font-mono text-slate-400"
                        >
                          {diagConfig.labelZh}{" "}
                          <span className="text-slate-500">/ {diagConfig.labelEn}</span>
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 whitespace-normal">
                      <span className="block whitespace-normal break-words text-[12px] leading-5 text-slate-300">
                        {event.procedure}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
                      <div className="flex -translate-x-2 items-center justify-center gap-1.5">
                        <Clock className="size-3 text-slate-500/70" />
                        <span
                          className={cn(
                            "font-mono text-[12px]",
                            event.downtimeHours >= 24
                              ? "font-semibold text-danger"
                              : event.downtimeHours >= 8
                                ? "text-warning"
                                : "text-slate-400"
                          )}
                        >
                          {event.downtimeHours}h
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <RecoveryBar rating={event.recoveryRating} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className={DELETE_RECORD_BUTTON_CLASS}
                          title="删除记录"
                          aria-label="删除记录"
                          onClick={(mouseEvent) => {
                            mouseEvent.stopPropagation()
                            setPendingDelete(event)
                          }}
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="size-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="size-3.5 text-slate-500/50" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow className="border-slate-800/30 bg-secondary/15 hover:bg-secondary/15">
                      <TableCell colSpan={7} className="px-4 py-4">
                        <div className="grid gap-3 text-[11px] text-slate-400 md:grid-cols-3">
                          <div className="flex items-center gap-2">
                            <User className="size-3.5 text-slate-500" />
                            <span>
                              操作员 <span className="text-slate-500">/ OPERATOR:</span>{" "}
                              <span className="font-mono text-slate-100">{event.operator}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>
                              事件编号 <span className="text-slate-500">/ EVENT ID:</span>{" "}
                              <span className="font-mono text-slate-100">{event.id}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>
                              严重度 <span className="text-slate-500">/ SEVERITY:</span>{" "}
                              <span className="font-mono text-slate-100">
                                {diagConfig.severity.toFixed(1)}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 text-[10px] leading-5 text-slate-500/75">
                          Bayesian update retains the current reliability curve while applying the
                          observed recovery factor to the Weibull eta estimate.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <CyberConfirmDialog
        open={pendingDelete !== null}
        title="删除维护记录 / Delete Record"
        message={
          pendingDelete
            ? `确认删除这条记录吗？\n${pendingDelete.timestamp.toLocaleString("zh-CN")} / ${pendingDelete.symptom}`
            : ""
        }
        onCancel={() => {
          if (deletingId) return
          setPendingDelete(null)
        }}
        onConfirm={() => {
          void confirmDelete()
        }}
        confirmText="确认删除"
        cancelText="取消"
      />
    </>
  )
}
