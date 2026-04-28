import { useEffect, useMemo } from "react"
import { AlertTriangle } from "lucide-react"

interface DeletionModalProps {
  itemType: "task" | "milestone" | "component"
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeletionModal({ itemType, itemName, onConfirm, onCancel }: DeletionModalProps) {
  const typeLabel = useMemo(() => {
    if (itemType === "task") return "工序"
    if (itemType === "component") return "部件"
    return "里程碑"
  }, [itemType])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
      if (event.key === "Enter") {
        event.preventDefault()
        onConfirm()
      }
    }

    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onCancel, onConfirm])

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deletion-modal-title"
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
            <div id="deletion-modal-title" className="text-sm font-bold tracking-wide text-white/95">
              删除确认
            </div>
          </div>
          <div className="mt-1 text-xs text-cyan-200/70">删除保护</div>
        </div>

        <div className="px-5 py-4 text-sm leading-relaxed text-white/75">
          <p>{`你正在删除${typeLabel}“${itemName}”。`}</p>
          <p className="mt-2 text-white/60">确认后将立即删除，且无法撤销。</p>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/[0.12] px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-400/25 bg-[linear-gradient(135deg,rgba(239,68,68,0.22),rgba(220,38,38,0.15))] px-4 py-2 text-xs font-bold text-red-200 transition-colors hover:bg-[linear-gradient(135deg,rgba(239,68,68,0.32),rgba(220,38,38,0.25))]"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
