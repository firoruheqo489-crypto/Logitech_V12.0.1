"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardPlus, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createMaintenanceLog, type MoldRepairAction } from "@/lib/mold-health-api"
import type { EventType } from "@/lib/mold-health-types"

const DESIGN_LIFE_SHOTS = 1_000_000
const AGE_PENALTY_FACTOR = 0.2

const TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: "SICKNESS", label: "纠正性 / Corrective" },
  { value: "SURGERY", label: "大修 / Major Repair" },
]

const ACTION_OPTIONS: Array<{ value: MoldRepairAction; label: string }> = [
  {
    value: "WEAR_PART_CLEAN_POLISH",
    label: "更换易损件 / Wear Part",
  },
  {
    value: "INSERT_REPLACEMENT_LOCAL_REFIT",
    label: "镶件更换 / Insert",
  },
  {
    value: "WELDING_MAJOR_MACHINING",
    label: "焊修 / Welding",
  },
]

const ACTION_OPTIONS_BY_TYPE: Record<EventType, MoldRepairAction[]> = {
  SICKNESS: ["WEAR_PART_CLEAN_POLISH"],
  SURGERY: ["INSERT_REPLACEMENT_LOCAL_REFIT", "WELDING_MAJOR_MACHINING"],
  CHECKUP: ["WEAR_PART_CLEAN_POLISH"],
}

const ACTION_SHORT_LABEL: Record<MoldRepairAction, string> = {
  WEAR_PART_CLEAN_POLISH: "更换易损件 / Wear Part",
  INSERT_REPLACEMENT_LOCAL_REFIT: "镶件更换 / Insert",
  WELDING_MAJOR_MACHINING: "焊修 / Welding",
}

const BASE_RECOVERY_BY_ACTION: Record<MoldRepairAction, number> = {
  WEAR_PART_CLEAN_POLISH: 0.98,
  INSERT_REPLACEMENT_LOCAL_REFIT: 0.85,
  WELDING_MAJOR_MACHINING: 0.7,
}

type FormState = {
  type: EventType
  repairAction: MoldRepairAction
  occurredAt: string
  currentShots: string
  symptom: string
  procedure: string
  downtimeHours: string
  operator: string
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function buildInitialForm(currentShots: number): FormState {
  return {
    type: "SICKNESS",
    repairAction: "WEAR_PART_CLEAN_POLISH",
    occurredAt: formatDateTimeLocal(new Date()),
    currentShots: String(Math.max(0, Math.trunc(currentShots))),
    symptom: "",
    procedure: "",
    downtimeHours: "0",
    operator: "",
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0
}

function resolveStage(shots: number): { labelZh: string; labelEn: string } {
  const ratio = shots / DESIGN_LIFE_SHOTS
  if (ratio < 0.2) return { labelZh: "早期磨合", labelEn: "Infant" }
  if (ratio < 0.75) return { labelZh: "稳定使用", labelEn: "Useful Life" }
  return { labelZh: "磨损加速", labelEn: "Wear-out" }
}

interface AddMaintenanceRecordSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moldId: string
  moldNo?: string
  currentShots: number
  onCreated?: () => Promise<void> | void
}

function FieldLabel({ zh, en }: { zh: string; en: string }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="text-[12px] font-semibold tracking-[0.02em] text-slate-100">
        {zh}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.24em] text-slate-500">
        {en}
      </span>
    </span>
  )
}

export default function AddMaintenanceRecordSheet({
  open,
  onOpenChange,
  moldId,
  moldNo,
  currentShots,
  onCreated,
}: AddMaintenanceRecordSheetProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(currentShots))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleResetShots = useCallback(() => {
    update("currentShots", "0")
    setIsResetConfirmOpen(false)
    toast.success("模数已重置为 0")
  }, [])
  const defaultForm = useMemo(() => buildInitialForm(currentShots), [currentShots])
  const formState = useMemo(
    () => ({ ...defaultForm, ...form }),
    [defaultForm, form]
  )
  const availableActionOptions = useMemo(
    () => ACTION_OPTIONS.filter((option) => ACTION_OPTIONS_BY_TYPE[formState.type].includes(option.value)),
    [formState.type]
  )

  useEffect(() => {
    if (open) setForm(buildInitialForm(currentShots))
  }, [open, currentShots])

  useEffect(() => {
    if (ACTION_OPTIONS_BY_TYPE[formState.type].includes(formState.repairAction)) return
    update("repairAction", ACTION_OPTIONS_BY_TYPE[formState.type][0])
  }, [formState.repairAction, formState.type])

  const shots = Math.max(
    0,
    Math.trunc(toNumber(formState.currentShots, Math.max(0, Math.trunc(currentShots))))
  )
  const downtimeHours = Math.max(0, toNumber(formState.downtimeHours, 0))
  const stage = useMemo(() => resolveStage(shots), [shots])

  const baseRecovery = useMemo(
    () => BASE_RECOVERY_BY_ACTION[formState.repairAction],
    [formState.repairAction]
  )
  const agePenalty = useMemo(
    () => clamp(1 - Math.min(1, shots / DESIGN_LIFE_SHOTS) * AGE_PENALTY_FACTOR, 0, 1),
    [shots]
  )
  const recoveryRating = useMemo(
    () => clamp(baseRecovery * agePenalty, 0, 1),
    [baseRecovery, agePenalty]
  )
  const missingRequiredFields = useMemo(() => {
    const missing: string[] = []

    if (isBlank(formState.occurredAt)) missing.push("发生时间")
    if (isBlank(formState.currentShots)) missing.push("当前模次")
    if (isBlank(formState.downtimeHours)) missing.push("停机时长")
    if (isBlank(formState.symptom)) missing.push("症状")
    if (isBlank(formState.procedure)) missing.push("处理措施说明")
    if (isBlank(formState.operator)) missing.push("操作员")

    return missing
  }, [
    formState.occurredAt,
    formState.currentShots,
    formState.downtimeHours,
    formState.operator,
    formState.procedure,
    formState.symptom,
  ])
  const isFormComplete = missingRequiredFields.length === 0

  const submit = async () => {
    if (isSubmitting) return
    if (!isFormComplete) {
      toast.error(`请填写全部必填项：${missingRequiredFields.join("、")}`)
      return
    }

    setIsSubmitting(true)
    try {
      await createMaintenanceLog(moldId, {
        moldNo: moldNo ?? null,
        type: formState.type,
        repairAction: formState.repairAction,
        occurredAt: new Date(formState.occurredAt).toISOString(),
        currentShots: shots,
        symptom: formState.symptom.trim(),
        diagnosis: formState.symptom.trim(),
        procedure: formState.procedure.trim(),
        downtimeHours,
        recoveryRating,
        operator: formState.operator.trim(),
        cost: 0,
        imageUrl: null,
        estimatedCompletion: null,
      })
      onOpenChange(false)
      await onCreated?.()
      toast.success(`维护记录已保存，恢复系数 ${recoveryRating.toFixed(2)}`)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "维护记录提交失败，请检查服务连接"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (isResetConfirmOpen) return
      if (event.key !== "Enter" || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.tagName === "TEXTAREA") return
      event.preventDefault()
      void submit()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isResetConfirmOpen, open, submit])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="border-l border-cyan-500/20 bg-[linear-gradient(180deg,rgba(5,8,18,0.98),rgba(2,6,23,0.98))] p-0 text-slate-100 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_36px_rgba(8,145,178,0.14)] sm:max-w-xl"
      >
        <form
          className="flex h-full flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <SheetHeader className="border-b border-slate-800 px-6 py-5">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-cyan-300">
              <ClipboardPlus className="h-4 w-4" />
              新增维护记录 / Add Maintenance Record
            </SheetTitle>
            <SheetDescription className="text-xs leading-5 text-slate-500">
              写入维护日志后会立即刷新当前模具可靠性遥测。
            </SheetDescription>
            <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-slate-500">
              <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-300">
                Mold ID: {moldId}
              </span>
              <span className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-slate-300">
                Mold No.: {moldNo || "NO. -"}
              </span>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel zh="类型" en="TYPE" />
                  <Select
                    value={formState.type}
                    onValueChange={(value) => update("type", value as EventType)}
                  >
                    <SelectTrigger className="h-11 border-slate-700 bg-slate-950/70 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                      {TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel zh="当前模次" en="CURRENT SHOTS" />
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={formState.currentShots}
                    required
                    onChange={(event) => {
                      const next = toNumber(event.target.value, shots)
                      update("currentShots", String(Math.max(0, Math.trunc(next))))
                    }}
                    className="h-11 border-slate-700 bg-slate-950/70 text-slate-100"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded border border-cyan-500/15 bg-cyan-500/5 px-2 py-1 text-[11px] text-cyan-200/90">
                      基准模次 / Stage: {stage.labelZh} / {stage.labelEn}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsResetConfirmOpen(true)}
                      className="flex shrink-0 items-center gap-1 rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
                    >
                      <RotateCcw className="h-3 w-3" />
                      重置模数
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel zh="处理措施" en="PHYSICAL ACTION" />
                  <Select
                    value={formState.repairAction}
                    onValueChange={(value) => update("repairAction", value as MoldRepairAction)}
                  >
                    <SelectTrigger className="h-11 border-slate-700 bg-slate-950/70 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                      {availableActionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel zh="发生时间" en="OCCURRED AT" />
                  <Input
                    type="datetime-local"
                    value={formState.occurredAt}
                    required
                    onChange={(event) => update("occurredAt", event.target.value)}
                    className="h-11 border-slate-700 bg-slate-950/70 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel zh="停机时长" en="DOWNTIME HOURS" />
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={formState.downtimeHours}
                    required
                    onChange={(event) => update("downtimeHours", event.target.value)}
                    className="h-11 border-slate-700 bg-slate-950/70 text-slate-100"
                  />
                </div>
                <div />
              </div>

              <div className="space-y-2">
                <FieldLabel zh="症状" en="SYMPTOM" />
                <Input
                  value={form.symptom}
                  required
                  onChange={(event) => update("symptom", event.target.value)}
                  className="h-11 border-slate-700 bg-slate-950/70 text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel zh="处理措施说明" en="PROCEDURE" />
                <Textarea
                  rows={4}
                  value={formState.procedure}
                  required
                  onChange={(event) => update("procedure", event.target.value)}
                  className="min-h-28 rounded-xl border-slate-700 bg-slate-950/70 text-slate-100"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel zh="操作员" en="OPERATOR" />
                  <Input
                    value={formState.operator}
                    required
                    onChange={(event) => update("operator", event.target.value)}
                    className="h-11 border-slate-700 bg-slate-950/70 text-slate-100"
                  />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel zh="恢复率" en="RECOVERY RATING" />
                    <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-mono text-cyan-300">
                      {recoveryRating.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-[11px] text-slate-500 sm:grid-cols-3">
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="uppercase tracking-[0.14em] text-slate-500">BASE</p>
                      <p className="mt-1 font-mono text-slate-200">{baseRecovery.toFixed(2)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="uppercase tracking-[0.14em] text-slate-500">AGE PENALTY</p>
                      <p className="mt-1 font-mono text-slate-200">{agePenalty.toFixed(2)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="uppercase tracking-[0.14em] text-slate-500">FORMULA</p>
                      <p className="mt-1 font-mono text-slate-200">Base × (1 - Age × 0.20)</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, recoveryRating * 100))}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>{ACTION_SHORT_LABEL[formState.repairAction]}</span>
                    <span>{recoveryRating.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="border-t border-slate-800 px-6 py-5">
            <Button
              type="button"
              variant="outline"
              className="border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-slate-900"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消 / Cancel
            </Button>
            <Button
              type="submit"
              className="border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(14,116,144,0.74))] text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_24px_rgba(8,145,178,0.18)] hover:bg-[linear-gradient(135deg,rgba(14,116,144,0.94),rgba(6,182,212,0.76))]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中... / Submitting...
                </>
              ) : (
                "保存并刷新 / Save & Refresh"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
      <CyberConfirmDialog
        open={isResetConfirmOpen}
        title="确认重置模数"
        message="当前模次将被重置为 0。此操作用于重新建立实时模数基线，请仅在确认需要清零时执行。"
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetShots}
        confirmText="确认重置"
        cancelText="取消"
        allowEnterConfirm={false}
      />
    </Sheet>
  )
}
