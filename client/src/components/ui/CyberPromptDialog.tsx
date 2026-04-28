import { useEffect, useMemo, useRef, useState } from "react"
import { Calendar, Pencil } from "lucide-react"

export type CyberPromptField =
  | {
      kind: "text"
      name: string
      label: string
      defaultValue?: string
      placeholder?: string
      required?: boolean
      maxLength?: number
    }
  | {
      kind: "number"
      name: string
      label: string
      defaultValue?: string
      placeholder?: string
      required?: boolean
      min?: number
      max?: number
      step?: number
    }
  | {
      kind: "date"
      name: string
      label: string
      defaultValue?: string
      required?: boolean
    }
  | {
      kind: "select"
      name: string
      label: string
      defaultValue?: string
      options: { value: string; label: string }[]
      required?: boolean
    }

interface CyberPromptDialogProps {
  open: boolean
  title: string
  /** 副标题（默认显示在标题下方，如"录入" / "编辑"等） */
  subtitle?: string
  /** 简短描述/提示，在字段上方展示 */
  description?: string
  fields: CyberPromptField[]
  onConfirm: (values: Record<string, string>) => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  /** 确认按钮主色：cyan 用于普通录入，purple 用于配置型操作 */
  tone?: "cyan" | "purple"
}

/**
 * 项目统一录入弹窗（与 CyberConfirmDialog 同视觉语言）。
 * 用于替代浏览器原生 window.prompt() 的丑陋默认对话框。
 */
export default function CyberPromptDialog({
  open,
  title,
  subtitle = "信息录入",
  description,
  fields,
  onConfirm,
  onCancel,
  confirmText = "确定",
  cancelText = "取消",
  tone = "cyan",
}: CyberPromptDialogProps) {
  const initial = useMemo(() => {
    const o: Record<string, string> = {}
    for (const f of fields) o[f.name] = f.defaultValue ?? ""
    return o
  }, [fields])

  const [values, setValues] = useState<Record<string, string>>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dateInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // open 状态切换或 fields 变化时重置
  useEffect(() => {
    if (open) {
      setValues(initial)
      setErrors({})
    }
  }, [open, initial])

  const validate = (): { ok: boolean; values: Record<string, string> } => {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const raw = (values[f.name] ?? "").trim()
      if (f.required && !raw) {
        errs[f.name] = "必填"
        continue
      }
      if (!raw) continue
      if (f.kind === "number") {
        const n = Number(raw)
        if (!Number.isFinite(n)) {
          errs[f.name] = "必须是数字"
        } else {
          if (typeof f.min === "number" && n < f.min) errs[f.name] = `不得小于 ${f.min}`
          if (typeof f.max === "number" && n > f.max) errs[f.name] = `不得大于 ${f.max}`
        }
      } else if (f.kind === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) errs[f.name] = "日期格式错误 (YYYY-MM-DD)"
      }
    }
    setErrors(errs)
    return { ok: Object.keys(errs).length === 0, values }
  }

  const handleConfirm = () => {
    const r = validate()
    if (!r.ok) return
    onConfirm(r.values)
  }

  const openNativeDatePicker = (fieldName: string) => {
    const input = dateInputRefs.current[fieldName]
    if (!input) return

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void }
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker()
      return
    }

    input.focus()
    input.click()
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleConfirm()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, values])

  if (!open) return null

  const confirmBtnCls =
    tone === "purple"
      ? "rounded-lg border border-purple-400/25 bg-[linear-gradient(135deg,rgba(168,85,247,0.22),rgba(126,34,206,0.15))] px-4 py-2 text-xs font-bold text-purple-100 transition-colors hover:bg-[linear-gradient(135deg,rgba(168,85,247,0.32),rgba(126,34,206,0.25))]"
      : "rounded-lg border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(8,145,178,0.18))] px-4 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.32),rgba(8,145,178,0.28))]"

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-cyan-400/25 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(21,27,35,0.98) 0%, rgba(12,19,28,0.98) 60%, rgba(24,15,40,0.98) 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-white/[0.08] bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(168,85,247,0.12))] px-5 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-cyan-300" />
            <div className="text-sm font-bold tracking-wide text-white/95">{title}</div>
          </div>
          <div className="mt-1 text-xs text-cyan-200/70">{subtitle}</div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {description && (
            <div className="mb-3 whitespace-pre-line text-xs leading-relaxed text-white/60">
              {description}
            </div>
          )}
          <div className="space-y-3">
            {fields.map((f) => {
              const err = errors[f.name]
              const baseInputCls =
                "w-full rounded-md border bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none transition-colors focus:bg-black/40 " +
                (err
                  ? "border-red-400/60 focus:border-red-300"
                  : "border-white/[0.12] focus:border-cyan-400/60")
              return (
                <div key={f.name}>
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-white/60">
                    {f.label}
                    {f.required && <span className="ml-1 text-red-400/80">*</span>}
                  </label>
                  {f.kind === "select" ? (
                    <select
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                      className={baseInputCls}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value} className="bg-slate-900 text-white">
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === "date" ? (
                    <div className="relative">
                      <input
                        ref={(node) => {
                          dateInputRefs.current[f.name] = node
                        }}
                        type="date"
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                        autoFocus={fields[0]?.name === f.name}
                        className={`${baseInputCls} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => openNativeDatePicker(f.name)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/35 transition-colors hover:text-cyan-300"
                        aria-label={`选择${f.label}`}
                        title={`选择${f.label}`}
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type={f.kind === "number" ? "number" : "text"}
                      value={values[f.name] ?? ""}
                      placeholder={"placeholder" in f ? f.placeholder : undefined}
                      maxLength={f.kind === "text" ? f.maxLength : undefined}
                      min={f.kind === "number" ? f.min : undefined}
                      max={f.kind === "number" ? f.max : undefined}
                      step={f.kind === "number" ? f.step ?? 1 : undefined}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                      autoFocus={fields[0]?.name === f.name}
                      className={baseInputCls}
                    />
                  )}
                  {err && <div className="mt-1 text-[10px] text-red-300/90">{err}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/[0.12] px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            {cancelText}
          </button>
          <button onClick={handleConfirm} className={confirmBtnCls}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
