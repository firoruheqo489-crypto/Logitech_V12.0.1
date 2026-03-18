import { Search } from 'lucide-react';

interface SearchBarProps {
  projectName: string;
  moldId: string;
  onProjectNameChange: (value: string) => void;
  onMoldIdChange: (value: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export default function SearchBar({
  projectName,
  moldId,
  onProjectNameChange,
  onMoldIdChange,
}: SearchBarProps) {
  return (
    <div className="mt-2 mb-8 flex flex-col gap-6 px-1 md:flex-row">
      <div className="group relative flex-1">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[var(--accent)]" />
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="搜索项目名称..."
          className="w-full rounded-xl border border-slate-800/60 bg-slate-900/40 py-3.5 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-600 shadow-inner transition-all hover:bg-slate-900/60 focus:border-[var(--accent)] focus:bg-slate-900/80 focus:outline-none"
        />
      </div>

      <div className="group relative flex-1">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[var(--accent)]" />
        <input
          type="text"
          value={moldId}
          onChange={(e) => onMoldIdChange(e.target.value)}
          placeholder="搜索模具编号..."
          className="w-full rounded-xl border border-slate-800/60 bg-slate-900/40 py-3.5 pl-11 pr-4 text-sm text-slate-200 placeholder-slate-600 shadow-inner transition-all hover:bg-slate-900/60 focus:border-[var(--accent)] focus:bg-slate-900/80 focus:outline-none"
        />
      </div>
    </div>
  );
}
