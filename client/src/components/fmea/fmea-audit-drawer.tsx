"use client"

import { useEffect, useState } from "react"
import { Trash2, X } from "lucide-react"

import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import {
  getFmeaRiskBand,
  isCriticalFmeaRisk,
  type FmeaRow,
  type FmeaStatus,
} from "@/lib/fmea-data"

type EditableField =
  | "sev"
  | "occ"
  | "det"
  | "pc"
  | "dc"
  | "action"
  | "ownerGate"
  | "status"

interface FmeaAuditDrawerProps {
  row: FmeaRow | null
  onClose: () => void
  onDeleteRow: (id: string) => void
  onUpdateRow: (
    id: string,
    field: EditableField,
    value: FmeaRow[EditableField]
  ) => void
}

const statusOptions: Array<{ value: FmeaStatus; label: string }> = [
  { value: "pending", label: "待处理" },
  { value: "testing", label: "验证中" },
  { value: "closed", label: "已闭环" },
]

function getRiskBadgeClass(row: Pick<FmeaRow, "sev" | "rpn">) {
  const riskBand = getFmeaRiskBand(row.sev, row.rpn)

  if (riskBand === "critical") {
    return "bg-red-950/40 text-red-400 ring-1 ring-red-900/60"
  }

  if (riskBand === "warning") {
    return "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
  }

  return "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
}

function getRiskLabel(row: Pick<FmeaRow, "sev" | "rpn">) {
  if (isCriticalFmeaRisk(row.sev, row.rpn)) {
    return "Critical"
  }

  return getFmeaRiskBand(row.sev, row.rpn) === "warning" ? "Warning" : "Safe"
}

function getStatusBadgeClass(status: FmeaStatus, row: Pick<FmeaRow, "sev" | "rpn">) {
  if (status === "pending" && isCriticalFmeaRisk(row.sev, row.rpn)) {
    return "bg-red-950/40 text-red-400 ring-1 ring-red-900/60"
  }

  if (status === "closed") {
    return "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
  }

  if (status === "testing") {
    return "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
  }

  return "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <input
        type="number"
        min={1}
        max={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
        className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-center font-mono text-sm text-zinc-200 outline-none transition-colors focus:border-cyan-500/40 focus:bg-cyan-500/5"
      />
    </label>
  )
}

function TextBlock({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="resize-none rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-200 outline-none transition-colors focus:border-cyan-500/40 focus:bg-cyan-500/5"
      />
    </label>
  )
}

export function FmeaAuditDrawer({
  row,
  onClose,
  onDeleteRow,
  onUpdateRow,
}: FmeaAuditDrawerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setShowDeleteConfirm(false)
  }, [row?.id])

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 transition-opacity duration-200 ${
        row ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          row ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-white/10 bg-[#0b0f16] shadow-[-24px_0_48px_rgba(0,0,0,0.42)] transition-transform duration-200 ${
          row ? "pointer-events-auto translate-x-0" : "translate-x-full"
        }`}
      >
        {row ? (
          <>
            <header className="border-b border-white/10 px-5 py-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Audit Focus
                  </p>
                  <h3 className="truncate text-base font-semibold text-zinc-100">
                    {row.process || "未命名部件"}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {row.mode || "请补充失效模式"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                  aria-label="关闭编辑抽屉"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${getRiskBadgeClass(
                    row
                  )}`}
                >
                  {getRiskLabel(row)} · RPN {row.rpn}
                </span>
                <span className="text-xs text-zinc-500">{row.systemId}</span>
              </div>
            </header>

            <div className="fmea-grid-scroll flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section className="space-y-3 rounded-2xl border border-white/8 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-zinc-100">Risk Assessment</h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${getRiskBadgeClass(
                      row
                    )}`}
                  >
                    RPN {row.rpn}
                  </span>
                </div>
                <div className="flex gap-3">
                  <ScoreField
                    label="S"
                    value={row.sev}
                    onChange={(value) => onUpdateRow(row.id, "sev", value)}
                  />
                  <ScoreField
                    label="O"
                    value={row.occ}
                    onChange={(value) => onUpdateRow(row.id, "occ", value)}
                  />
                  <ScoreField
                    label="D"
                    value={row.det}
                    onChange={(value) => onUpdateRow(row.id, "det", value)}
                  />
                </div>
                <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                    Auto Output
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">
                    {row.rpn}
                  </p>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-white/8 bg-zinc-900/40 p-4">
                <h4 className="text-sm font-semibold text-zinc-100">Current Controls</h4>
                <TextBlock
                  label="预防控制"
                  value={row.pc}
                  onChange={(value) => onUpdateRow(row.id, "pc", value)}
                />
                <TextBlock
                  label="探测控制"
                  value={row.dc}
                  onChange={(value) => onUpdateRow(row.id, "dc", value)}
                />
              </section>

              <section className="space-y-4 rounded-2xl border border-white/8 bg-zinc-900/40 p-4">
                <h4 className="text-sm font-semibold text-zinc-100">Accountability Loop</h4>
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    责任节点
                  </span>
                  <input
                    type="text"
                    value={row.ownerGate}
                    onChange={(event) => onUpdateRow(row.id, "ownerGate", event.target.value)}
                    className="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition-colors focus:border-cyan-500/40 focus:bg-cyan-500/5"
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    状态
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => {
                      const active = row.status === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onUpdateRow(row.id, "status", option.value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${getStatusBadgeClass(
                            option.value,
                            row
                          )} ${
                            active
                              ? "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                              : "opacity-70 hover:opacity-100"
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <TextBlock
                  label="建议措施"
                  value={row.action}
                  onChange={(value) => onUpdateRow(row.id, "action", value)}
                  rows={5}
                />
              </section>
            </div>

            <footer className="border-t border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除当前项
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  确认并返回
                </button>
              </div>
            </footer>

            <CyberConfirmDialog
              open={showDeleteConfirm}
              title="确认删除 FMEA 项"
              message={`删除后将无法恢复。\n\n系统/部件：${row.process || "未填写"}\n失效模式：${row.mode || "未填写"}`}
              confirmText="确认删除"
              cancelText="取消"
              onCancel={() => setShowDeleteConfirm(false)}
              onConfirm={() => {
                setShowDeleteConfirm(false)
                onDeleteRow(row.id)
              }}
            />
          </>
        ) : null}
      </aside>
    </div>
  )
}
