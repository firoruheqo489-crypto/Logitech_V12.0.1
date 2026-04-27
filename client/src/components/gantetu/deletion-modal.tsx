import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"

interface DeletionModalProps {
  itemType: "task" | "milestone" | "component"
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeletionModal({ itemType, itemName, onConfirm, onCancel }: DeletionModalProps) {
  const [inputValue, setInputValue] = useState("")
  const isMatch = inputValue.trim() === itemName

  const typeLabel = useMemo(() => {
    if (itemType === "task") return "工序"
    if (itemType === "component") return "部件"
    return "里程碑"
  }, [itemType])

  const handleConfirm = useCallback(() => {
    if (!isMatch) return
    onConfirm()
  }, [isMatch, onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
      if (e.key === "Enter" && isMatch) {
        e.preventDefault()
        onConfirm()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isMatch, onCancel, onConfirm])

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
          <p className="mt-2 text-white/60">{`请输入完整${typeLabel}名称以确认删除。`}</p>

          <div className="mt-4">
            <label htmlFor="deletion-modal-input" className="mb-2 block text-[11px] font-medium tracking-wide text-white/60">
              {`输入“${itemName}”以继续`}
            </label>
            <input
              id="deletion-modal-input"
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={itemName}
              autoFocus
              className={`w-full rounded-md border bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none transition-colors focus:bg-black/40 ${
                inputValue.length > 0 && !isMatch
                  ? "border-red-400/60 focus:border-red-300"
                  : "border-white/[0.12] focus:border-cyan-400/60"
              }`}
            />
            {inputValue.length > 0 && !isMatch ? (
              <div className="mt-2 text-[10px] text-red-300/90">名称不匹配，暂时无法删除。</div>
            ) : null}
          </div>
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
            onClick={handleConfirm}
            disabled={!isMatch}
            className={`rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${
              isMatch
                ? "border-red-400/25 bg-[linear-gradient(135deg,rgba(239,68,68,0.22),rgba(220,38,38,0.15))] text-red-200 hover:bg-[linear-gradient(135deg,rgba(239,68,68,0.32),rgba(220,38,38,0.25))]"
                : "cursor-not-allowed border-white/[0.08] bg-white/[0.04] text-white/25"
            }`}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
