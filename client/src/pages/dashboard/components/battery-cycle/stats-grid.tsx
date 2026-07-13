import type { CycleStat } from "./battery-data";
import type { CycleHighlight } from "./battery-rules";

export function StatsGrid({
  data,
  highlights = {},
  activeCycle,
  onCycleSelect,
}: {
  data: CycleStat[];
  highlights?: Record<number, CycleHighlight>;
  activeCycle?: number;
  onCycleSelect?: (cycle: number) => void;
}) {
  return (
    <div role="table" aria-label="循环统计矩阵" className="h-full w-full overflow-y-auto pr-2 scrollbar-soft">
      <div
        role="row"
        className="sticky top-0 z-10 mb-2 grid grid-cols-5 border-b border-white/10 bg-black/80 pb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500 backdrop-blur-xl"
      >
        <span role="columnheader">循环</span>
        <span role="columnheader" className="text-right">放电容量 (Ah)</span>
        <span role="columnheader" className="text-right">效率 (%)</span>
        <span role="columnheader" className="text-right">中值电压 (V)</span>
        <span role="columnheader" className="text-right">直流内阻 (mΩ)</span>
      </div>
      {data.map((row) => {
        const degraded = row.retention < 95;
        const highlight = highlights[row.cycle];
        const isActive = row.cycle === activeCycle;
        const highlightClass =
          isActive
            ? "border-cyan-300/40 bg-cyan-300/10 shadow-[inset_2px_0_0_rgba(103,232,249,0.85)]"
            : highlight?.level === "Fail"
            ? "border-[#FF3C5C]/30 bg-[#FF3C5C]/10"
            : highlight?.level === "Watch"
              ? "border-amber-300/25 bg-amber-300/10"
              : "border-white/[0.02]";
        const title = highlight?.reasons.length ? `触发规则：${highlight.reasons.join("、")}` : undefined;
        return (
          <div
            key={row.cycle}
            role="row"
            onClick={() => onCycleSelect?.(row.cycle)}
            className={`grid grid-cols-5 border-b py-1 font-mono text-[11px] text-gray-300 transition-colors hover:bg-white/[0.03] ${onCycleSelect ? "cursor-pointer" : ""} ${highlightClass}`}
            title={title}
          >
            <span role="cell" className="text-slate-500">
              {String(row.cycle).padStart(3, "0")}
              {highlight ? (
                <span className={highlight.level === "Fail" ? "ml-1 text-[#FF3C5C]" : "ml-1 text-amber-200"}>
                  {highlight.level === "Fail" ? "!" : "•"}
                </span>
              ) : null}
            </span>
            <span role="cell" className={`text-right ${degraded ? "text-[#FF3C5C]" : ""}`}>
              {row.dischargeCap.toFixed(4)}
              {degraded && <span className="ml-1 text-[9px] text-[#FF3C5C]/60">▼</span>}
            </span>
            <span role="cell" className="text-right">{row.efficiency.toFixed(2)}</span>
            <span role="cell" className="text-right">{row.medianV.toFixed(3)}</span>
            <span role="cell" className="text-right">{row.ir.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}
