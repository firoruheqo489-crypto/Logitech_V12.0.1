import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EditableDefectRow = {
  id: string;
  defectName: string;
  englishName: string;
  countText: string;
};

const DEFAULT_DEFECT_ROWS: EditableDefectRow[] = [
  {
    id: "short-shot",
    defectName: "缺胶",
    englishName: "Short Shot",
    countText: "120",
  },
  { id: "flash", defectName: "披锋", englishName: "Flash", countText: "85" },
  {
    id: "scratch",
    defectName: "刮花",
    englishName: "Scratch",
    countText: "60",
  },
  { id: "warp", defectName: "变形", englishName: "Warp", countText: "40" },
  {
    id: "sink-mark",
    defectName: "缩水",
    englishName: "Sink Mark",
    countText: "25",
  },
  {
    id: "color-diff",
    defectName: "色差",
    englishName: "Color Diff",
    countText: "15",
  },
  { id: "others", defectName: "其他", englishName: "Others", countText: "5" },
];

const LEFT_AXIS_TICK_COUNT = 5;
const RIGHT_AXIS_TICKS = [0, 20, 40, 60, 80, 100];

function cloneDefaultRows() {
  return DEFAULT_DEFECT_ROWS.map(row => ({ ...row }));
}

function parseCount(value: string) {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function createDefectRow(): EditableDefectRow {
  return {
    id: `defect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    defectName: "",
    englishName: "",
    countText: "0",
  };
}

export default function ParetoQualityDashboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [defectRows, setDefectRows] = useState<EditableDefectRow[]>(() =>
    cloneDefaultRows()
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const chartData = useMemo(() => {
    const rows = defectRows
      .map((item, sourceIndex) => {
        const count = parseCount(item.countText);
        return {
          ...item,
          sourceIndex,
          count,
          displayName: item.defectName.trim() || "未命名缺陷",
        };
      })
      .sort((a, b) => b.count - a.count || a.sourceIndex - b.sourceIndex);
    const total = rows.reduce((sum, item) => sum + item.count, 0);
    let running = 0;
    return {
      total,
      rows: rows.map(item => {
        running += item.count;
        return {
          ...item,
          percentage: total > 0 ? (item.count / total) * 100 : 0,
          cumulative: total > 0 ? (running / total) * 100 : 0,
        };
      }),
    };
  }, [defectRows]);

  const pendingDeleteRow = useMemo(
    () => chartData.rows.find(row => row.id === pendingDeleteId),
    [chartData.rows, pendingDeleteId]
  );

  const updateDefectName = (id: string, defectName: string) => {
    setDefectRows(rows =>
      rows.map(row => (row.id === id ? { ...row, defectName } : row))
    );
  };

  const updateDefectCount = (id: string, countText: string) => {
    if (countText !== "" && !/^\d+$/.test(countText)) return;
    setDefectRows(rows =>
      rows.map(row => (row.id === id ? { ...row, countText } : row))
    );
  };

  const addDefectRow = () => {
    setDefectRows(rows => [...rows, createDefectRow()]);
  };

  const removeDefectRow = (id: string) => {
    setDefectRows(rows =>
      rows.length <= 1 ? rows : rows.filter(row => row.id !== id)
    );
  };

  const requestDeleteRow = (id: string) => {
    if (defectRows.length <= 1) return;
    setPendingDeleteId(id);
  };

  const confirmDeleteRow = () => {
    if (pendingDeleteId) {
      removeDefectRow(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  const resetDefectRows = () => {
    setDefectRows(cloneDefaultRows());
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateDimensions = () => {
      const { width, height } = node.getBoundingClientRect();
      setDimensions({
        width: Math.max(320, Math.round(width)),
        height: Math.max(320, Math.round(height)),
      });
    };

    updateDimensions();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const axisMax = Math.max(LEFT_AXIS_TICK_COUNT, chartData.total);
  const leftTicks = Array.from(
    { length: LEFT_AXIS_TICK_COUNT + 1 },
    (_, index) => Math.round((axisMax / LEFT_AXIS_TICK_COUNT) * index)
  );

  const { width, height } = dimensions;
  const margin = { top: 30, right: 76, bottom: 60, left: 64 };
  const chartWidth = Math.max(1, width - margin.left - margin.right);
  const chartHeight = Math.max(1, height - margin.top - margin.bottom);
  const barCount = Math.max(1, chartData.rows.length);
  const bandWidth = chartWidth / barCount;
  const barWidth = Math.max(24, bandWidth * 0.68);

  const xScale = (index: number) =>
    margin.left + index * bandWidth + (bandWidth - barWidth) / 2;
  const yScaleLeft = (value: number) =>
    margin.top + chartHeight * (1 - value / axisMax);
  const yScaleRight = (value: number) =>
    margin.top + chartHeight * (1 - value / 100);

  return (
    <section className="space-y-5">
      <div className="border-b border-slate-800/70 pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">
                质量控制柏拉图
              </h2>
              <p className="text-sm text-slate-500">
                Quality Control Pareto Dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full rounded border border-slate-800 bg-slate-900 p-4 md:p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-100">
            缺陷帕累托分析 Defect Pareto Analysis
          </h3>
        </div>

        <div ref={containerRef} className="h-[400px] w-full">
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="缺陷柏拉图"
          >
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + chartHeight}
              stroke="#334155"
            />
            {leftTicks.map(tick => (
              <g key={`left-${tick}`}>
                <line
                  x1={margin.left - 5}
                  y1={yScaleLeft(tick)}
                  x2={margin.left}
                  y2={yScaleLeft(tick)}
                  stroke="#334155"
                />
                <text
                  x={margin.left - 10}
                  y={yScaleLeft(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize={12}
                >
                  {tick}
                </text>
              </g>
            ))}
            <text
              x={16}
              y={margin.top + chartHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#94a3b8"
              fontSize={12}
              transform={`rotate(-90, 16, ${margin.top + chartHeight / 2})`}
            >
              缺陷数量 Count
            </text>

            <line
              x1={margin.left + chartWidth}
              y1={margin.top}
              x2={margin.left + chartWidth}
              y2={margin.top + chartHeight}
              stroke="#334155"
            />
            {RIGHT_AXIS_TICKS.map(tick => (
              <g key={`right-${tick}`}>
                <line
                  x1={margin.left + chartWidth}
                  y1={yScaleRight(tick)}
                  x2={margin.left + chartWidth + 5}
                  y2={yScaleRight(tick)}
                  stroke="#334155"
                />
                <text
                  x={margin.left + chartWidth + 10}
                  y={yScaleRight(tick)}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize={12}
                >
                  {tick}%
                </text>
              </g>
            ))}
            <text
              x={width - 16}
              y={margin.top + chartHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#94a3b8"
              fontSize={12}
              transform={`rotate(90, ${width - 16}, ${margin.top + chartHeight / 2})`}
            >
              累计百分比 Cumulative %
            </text>

            <line
              x1={margin.left}
              y1={margin.top + chartHeight}
              x2={margin.left + chartWidth}
              y2={margin.top + chartHeight}
              stroke="#334155"
            />

            {chartData.rows.map((item, index) => {
              const barX = xScale(index);
              const barHeight = (item.count / axisMax) * chartHeight;
              const barY = margin.top + chartHeight - barHeight;
              const barRightX = barX + barWidth;
              const cumulativeY = yScaleRight(item.cumulative);

              return (
                <g key={item.id}>
                  <line
                    x1={barRightX}
                    y1={barY}
                    x2={barRightX}
                    y2={cumulativeY}
                    stroke="#f87171"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.6}
                  />
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    fill="#0891b2"
                    rx={2}
                  />
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 8}
                    textAnchor="middle"
                    fill="#22d3ee"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {item.count}
                  </text>
                  <text
                    x={barX + barWidth / 2}
                    y={margin.top + chartHeight + 22}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={11}
                  >
                    {item.displayName}
                  </text>
                </g>
              );
            })}

            <path
              d={chartData.rows
                .map((item, index) => {
                  const barRightX = xScale(index) + barWidth;
                  const cumulativeY = yScaleRight(item.cumulative);
                  return `${index === 0 ? "M" : "L"} ${barRightX} ${cumulativeY}`;
                })
                .join(" ")}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
            />

            {chartData.rows.map((item, index) => {
              const barRightX = xScale(index) + barWidth;
              const cumulativeY = yScaleRight(item.cumulative);

              return (
                <g key={`circle-${item.id}`}>
                  <circle
                    cx={barRightX}
                    cy={cumulativeY}
                    r={5}
                    fill="#020617"
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                  <text
                    x={barRightX + 8}
                    y={cumulativeY - 8}
                    textAnchor="start"
                    fill="#fca5a5"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {item.cumulative.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="w-full rounded border border-slate-800 bg-slate-900 p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              缺陷数据明细 Defect Data Details
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              总缺陷数 Total Defects: {chartData.total}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDefectRow}
              className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              新增缺陷
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetDefectRows}
              className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              恢复示例
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 bg-slate-800/50 hover:bg-slate-800/50">
                <TableHead className="font-semibold text-slate-300">
                  排名 Rank
                </TableHead>
                <TableHead className="font-semibold text-slate-300">
                  缺陷类型 Defect Type
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-300">
                  数量 Count
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-300">
                  占比 Percentage
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-300">
                  累计 % Cumulative
                </TableHead>
                <TableHead className="w-12 text-right font-semibold text-slate-300" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.rows.map((item, index) => (
                <TableRow
                  key={item.id}
                  className="border-slate-800 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-slate-400">
                    {String(index + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <input
                      aria-label={`缺陷类型 ${index + 1}`}
                      value={item.defectName}
                      onChange={event =>
                        updateDefectName(item.id, event.target.value)
                      }
                      placeholder="输入缺陷类型"
                      className="h-9 w-full rounded border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10"
                    />
                    {item.englishName && (
                      <p className="mt-1 text-xs text-slate-500">
                        {item.englishName}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <input
                      aria-label={`缺陷数量 ${index + 1}`}
                      inputMode="numeric"
                      value={item.countText}
                      onChange={event =>
                        updateDefectCount(item.id, event.target.value)
                      }
                      className="ml-auto block h-9 w-28 rounded border border-slate-700 bg-slate-950/70 px-3 text-right font-mono text-sm text-cyan-300 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-300">
                    {item.percentage.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-300">
                    {item.cumulative.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => requestDeleteRow(item.id)}
                      disabled={defectRows.length <= 1}
                      aria-label={`删除 ${item.displayName}`}
                      className="text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-cyan-600" />
            <span className="text-slate-400">缺陷数量 Defect Count</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-0.5 w-6 bg-red-500"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #ef4444 0, #ef4444 4px, transparent 4px, transparent 8px)",
              }}
            />
            <span className="text-slate-400">累计百分比 Cumulative %</span>
          </div>
        </div>
      </div>

      <CyberConfirmDialog
        open={pendingDeleteId !== null}
        title="删除缺陷确认"
        message={`确定要删除 ${pendingDeleteRow?.displayName || "当前缺陷"} 吗？\n删除后该行数据会从柏拉图中移除，此操作不可撤销。`}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteRow}
        confirmText="确认删除"
      />
    </section>
  );
}
