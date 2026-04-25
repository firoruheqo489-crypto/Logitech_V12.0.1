import { useEffect } from "react"

interface RejectionToastProps {
  message: string
  onClose: () => void
  duration?: number
}

/**
 * Phase 9 — 冷酷拒绝 Toast。
 *
 * 当用户点击被"拦截引擎"保护的删除按钮时，显示此 Toast。
 * 自动在 duration 毫秒后消失。
 */
export function RejectionToast({ message, onClose, duration = 4000 }: RejectionToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-slate-900 border-2 border-red-800 rounded-lg shadow-2xl px-5 py-3 flex items-center gap-3 max-w-lg">
        {/* 拒绝图标 */}
        <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        {/* 消息 */}
        <div className="flex-1">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-0.5">
            拒绝执行
          </p>
          <p className="text-sm text-slate-300">{message}</p>
        </div>

        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200 flex-shrink-0"
          aria-label="关闭"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
