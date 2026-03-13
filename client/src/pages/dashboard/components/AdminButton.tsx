import { Settings } from 'lucide-react';

interface AdminButtonProps {
  onClick: () => void;
}

/**
 * Floating admin button in bottom-right corner
 * Subtle design with opacity 50%, hover 100%
 */
export function AdminButton({ onClick }: AdminButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 opacity-50 hover:opacity-100 flex items-center justify-center group"
      aria-label="打开数据管理"
      title="数据管理"
    >
      <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
    </button>
  );
}
