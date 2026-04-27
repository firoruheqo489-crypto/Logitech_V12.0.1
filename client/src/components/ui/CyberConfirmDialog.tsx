import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

interface CyberConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  allowEnterConfirm?: boolean
}

export default function CyberConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "确认删除",
  cancelText = "取消",
  allowEnterConfirm = true,
}: CyberConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
      if (e.key === "Enter") {
        if (!allowEnterConfirm) return
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [allowEnterConfirm, open, onCancel, onConfirm])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-cyan-400/25 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(21,27,35,0.98) 0%, rgba(12,19,28,0.98) 60%, rgba(24,15,40,0.98) 100%)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/[0.08] bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(168,85,247,0.12))] px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-300" />
            <div className="text-sm font-bold tracking-wide text-white/95">{title}</div>
          </div>
          <div className="mt-1 text-xs text-cyan-200/70">删除保护</div>
        </div>
        <div className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-white/75">
          {message}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/[0.12] px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg border border-red-400/25 bg-[linear-gradient(135deg,rgba(239,68,68,0.22),rgba(220,38,38,0.15))] px-4 py-2 text-xs font-bold text-red-200 transition-colors hover:bg-[linear-gradient(135deg,rgba(239,68,68,0.32),rgba(220,38,38,0.25))]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
