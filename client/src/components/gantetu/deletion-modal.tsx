import { useState, useEffect, useCallback } from "react"

interface DeletionModalProps {
  /** 要删除的项目类型 */
  itemType: "task" | "milestone" | "component"
  /** 要删除的项目名称 */
  itemName: string
  /** 确认删除回调 */
  onConfirm: () => void
  /** 取消回调 */
  onCancel: () => void
}

/**
 * Phase 9 — 行政防呆模态框。
 *
 * 废弃简单的"确认/取消"弹窗，强制用户输入完整的项目名称才能解锁删除按钮。
 * 这种设计大幅降低了肌肉记忆误触率。
 */
export function DeletionModal({ itemType, itemName, onConfirm, onCancel }: DeletionModalProps) {
  const [inputValue, setInputValue] = useState("")
  const isMatch = inputValue.trim() === itemName

  const handleConfirm = useCallback(() => {
    if (!isMatch) return
    onConfirm()
  }, [isMatch, onConfirm])

  // ESC 键取消
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onCancel])

  const typeLabel = itemType === "task" ? "工序" : itemType === "component" ? "部件" : "里程碑"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deletion-modal-title"
    >
      <div
        className="bg-[#111827] border-2 border-red-600 rounded-lg shadow-[0_0_40px_rgba(220,38,38,0.3)] max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 警示标题 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-900/60 border border-red-600/50 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)]">
            <svg
              className="w-7 h-7 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 id="deletion-modal-title" className="text-lg font-bold text-red-400">
              物理销毁警告
            </h2>
            <p className="text-xs text-slate-500">此操作不可逆转 · 行政记录将永久留存</p>
          </div>
        </div>

        {/* 说明文本 */}
        <div className="mb-5 text-sm text-slate-300 bg-red-950/20 border border-red-900/30 rounded p-3">
          <p className="mb-2">
            您正在执行对{typeLabel}
            <span className="font-bold text-red-300 mx-1">&quot;{itemName}&quot;</span>
            的永久销毁。
          </p>
          <p className="text-slate-400 text-xs">
            请在下方输入框中准确输入该{typeLabel}的名称以解锁删除权限。
          </p>
        </div>

        {/* 输入框 */}
        <div className="mb-5">
          <label className="block text-[10px] text-slate-500 mb-2">
            输入 <span className="text-red-400 font-medium">&quot;{itemName}&quot;</span> 以确认
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={itemName}
            autoFocus
            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-red-500 text-slate-100 px-3 py-2.5 rounded focus:outline-none focus:shadow-[0_0_10px_rgba(220,38,38,0.3)] text-sm transition-all"
          />
          {inputValue.length > 0 && !isMatch && (
            <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
              <span>名称不匹配</span>
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch}
            className={`flex-1 py-2.5 rounded font-medium text-sm transition-all ${
              isMatch
                ? "bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_20px_rgba(220,38,38,0.6)]"
                : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
            }`}
          >
            永久销毁
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-slate-800/50 rounded text-sm transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
