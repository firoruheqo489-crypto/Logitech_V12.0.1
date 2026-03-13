import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface CyberConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function CyberConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认删除',
  cancelText = '取消',
}: CyberConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10002] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-cyan-400/25 overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.25)]"
        style={{
          background: 'linear-gradient(145deg, rgba(21,27,35,0.98) 0%, rgba(12,19,28,0.98) 60%, rgba(24,15,40,0.98) 100%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.08] bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(168,85,247,0.12))]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-300" />
            <div className="text-sm font-bold text-white/95 tracking-wide">{title}</div>
          </div>
          <div className="text-xs text-cyan-200/70 mt-1">删除保护</div>
        </div>
        <div className="px-5 py-4 text-sm text-white/75 leading-relaxed">{message}</div>
        <div className="px-5 pb-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-white/[0.12] text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg border border-red-400/25 bg-[linear-gradient(135deg,rgba(239,68,68,0.22),rgba(220,38,38,0.15))] text-xs font-bold text-red-200 hover:bg-[linear-gradient(135deg,rgba(239,68,68,0.32),rgba(220,38,38,0.25))] transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
