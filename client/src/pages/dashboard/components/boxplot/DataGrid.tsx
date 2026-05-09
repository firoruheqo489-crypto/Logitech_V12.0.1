import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";

interface DataGridProps {
  initialData: Record<string, number[]>;
  onApply: (data: Record<string, number[]>) => void;
}

export function DataGrid({ initialData, onApply }: DataGridProps) {
  // Convert initial data to grid format
  const [columns, setColumns] = useState<string[]>(() => Object.keys(initialData));
  const [grid, setGrid] = useState<(number | null)[][]>(() => {
    const cols = Object.keys(initialData);
    const maxRows = Math.max(...cols.map(c => initialData[c].length), 0);
    const rows: (number | null)[][] = [];
    for (let r = 0; r < maxRows; r++) {
      rows.push(cols.map(c => initialData[c]?.[r] ?? null));
    }
    return rows;
  });

  // Sync grid when initialData changes externally (e.g., clear)
  useEffect(() => {
    const cols = Object.keys(initialData);
    if (cols.length === 0) {
      setColumns(["分组-01"]);
      setGrid([Array(1).fill(null)]);
      return;
    }
    const maxRows = Math.max(...cols.map(c => initialData[c].length), 0);
    const rows: (number | null)[][] = [];
    for (let r = 0; r < maxRows; r++) {
      rows.push(cols.map(c => initialData[c]?.[r] ?? null));
    }
    setColumns(cols);
    setGrid(rows);
  }, [initialData]);

  const handleCellChange = useCallback((rowIdx: number, colIdx: number, value: string) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      const parsed = parseFloat(value);
      next[rowIdx][colIdx] = isNaN(parsed) ? null : parsed;
      return next;
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setGrid(prev => [...prev, columns.map(() => null)]);
  }, [columns]);

  const handleAddColumn = useCallback(() => {
    const newName = `分组-${String(columns.length + 1).padStart(2, '0')}`;
    setColumns(prev => [...prev, newName]);
    setGrid(prev => prev.map(row => [...row, null]));
  }, [columns.length]);

  const handleColumnRename = useCallback((colIdx: number, name: string) => {
    setColumns(prev => {
      const next = [...prev];
      next[colIdx] = name;
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const result: Record<string, number[]> = {};
    columns.forEach((col, colIdx) => {
      const values: number[] = [];
      grid.forEach(row => {
        const v = row[colIdx];
        if (v !== null && !isNaN(v)) values.push(v);
      });
      if (values.length > 0) {
        result[col] = values;
      }
    });
    onApply(result);
  }, [columns, grid, onApply]);

  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-2">
      {/* Grid container */}
      <div ref={scrollRef} className="max-h-[280px] overflow-auto rounded border border-zinc-800 bg-[#050505]">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-[#0a0a0a]">
            <tr>
              <th className="w-12 border-b border-r border-zinc-800 px-2 py-1.5 text-left text-[10px] text-zinc-500">n</th>
              {columns.map((col, colIdx) => (
                <th key={colIdx} className="min-w-[90px] border-b border-r border-zinc-800 px-1 py-1">
                  <input
                    type="text"
                    value={col}
                    onChange={(e) => handleColumnRename(colIdx, e.target.value)}
                    className="w-full bg-transparent text-center text-[10px] font-medium text-zinc-300 outline-none focus:text-zinc-100"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-zinc-900/30">
                <td className="border-b border-r border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-600">{rowIdx + 1}</td>
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="border-b border-r border-zinc-800 p-0">
                    <input
                      type="number"
                      step="0.001"
                      value={cell ?? ''}
                      onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                      className="w-full bg-transparent px-1.5 py-0.5 text-center text-xs text-zinc-300 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:bg-zinc-800/40 focus:text-zinc-100"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleAddRow} className="h-6 border-zinc-700 bg-transparent px-2 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
          <Plus className="mr-1 h-3 w-3" />添加样本
        </Button>
        <Button size="sm" variant="outline" onClick={handleAddColumn} className="h-6 border-zinc-700 bg-transparent px-2 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
          <Plus className="mr-1 h-3 w-3" />添加分组
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleApply} className="h-6 bg-blue-600 px-3 text-[10px] text-white hover:bg-blue-500">
          <Check className="mr-1 h-3 w-3" />应用工作表
        </Button>
      </div>
    </div>
  );
}
