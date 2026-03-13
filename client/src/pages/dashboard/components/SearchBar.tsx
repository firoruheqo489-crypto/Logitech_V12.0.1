import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  onClear,
  hasActiveFilters,
}: SearchBarProps) {
  return (
    <div className="bg-[#11161D] border-b border-white/[0.04] shadow-[0_1px_0_rgba(0,0,0,0.5)]">
      <div className="mx-auto w-full max-w-7xl px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            {/* Project Name Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B949E]" />
              <Input
                type="text"
                placeholder="搜索项目名称..."
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                className="pl-10 h-11 text-base bg-[#151B23] border-white/[0.06] text-[#E6EDF3] placeholder:text-[#6E7681] focus:border-[#00B4FF] focus:shadow-[0_0_0_3px_rgba(0,180,255,0.18)] focus:ring-0"
              />
            </div>

            {/* Mold ID Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B949E]" />
              <Input
                type="text"
                placeholder="搜索模具编号..."
                value={moldId}
                onChange={(e) => onMoldIdChange(e.target.value)}
                className="pl-10 h-11 text-base bg-[#151B23] border-white/[0.06] text-[#E6EDF3] placeholder:text-[#6E7681] focus:border-[#00B4FF] focus:shadow-[0_0_0_3px_rgba(0,180,255,0.18)] focus:ring-0"
              />
            </div>
          </div>

          {/* Clear Button */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={onClear}
              className="h-11 px-4"
            >
              <X className="h-4 w-4 mr-2" />
              清除搜索
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[#8B949E]">
            <span className="font-medium text-[#6E7681]">当前筛选:</span>
            {projectName && (
              <span className="px-2 py-1 bg-[#00B4FF]/10 text-[#00B4FF] rounded border border-[#00B4FF]/20">
                项目名称: {projectName}
              </span>
            )}
            {moldId && (
              <span className="px-2 py-1 bg-[#00B4FF]/10 text-[#00B4FF] rounded border border-[#00B4FF]/20">
                模具编号: {moldId}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
