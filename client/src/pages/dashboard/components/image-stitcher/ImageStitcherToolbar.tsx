import {
  MousePointer2,
  Type,
  Square,
  MoveUpRight,
  Pen,
  Undo2,
  Redo2,
} from 'lucide-react';

import type { ToolMode, StitchDirection } from './types';

interface ImageStitcherToolbarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  onStitch: (direction: StitchDirection) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  brushWidth: number;
  onBrushWidthChange: (width: number) => void;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontColor: string;
  onFontColorChange: (color: string) => void;
}

const TOOLS: Array<{ mode: ToolMode; icon: typeof MousePointer2; label: string }> = [
  { mode: 'select', icon: MousePointer2, label: '选择' },
  { mode: 'text', icon: Type, label: '文字' },
  { mode: 'rect', icon: Square, label: '矩形' },
  { mode: 'arrow', icon: MoveUpRight, label: '箭头' },
  { mode: 'brush', icon: Pen, label: '画笔' },
];

export default function ImageStitcherToolbar({
  activeTool,
  onToolChange,
  onStitch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  brushWidth,
  onBrushWidthChange,
  brushColor,
  onBrushColorChange,
  fontSize,
  onFontSizeChange,
  fontColor,
  onFontColorChange,
}: ImageStitcherToolbarProps) {
  return (
    <div className="flex items-center gap-3 bg-slate-900/80 border-b border-slate-700/50 px-3 py-2">
      {/* Left section — Tool buttons */}
      <div className="flex items-center gap-1">
        {TOOLS.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            type="button"
            title={label}
            onClick={() => onToolChange(mode)}
            className={`px-2 py-1.5 rounded text-sm transition-colors ${
              activeTool === mode
                ? 'bg-cyan-600/30 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      {/* Center section — Property controls (contextual) */}
      <div className="flex items-center gap-3 border-l border-slate-700/50 pl-3">
        {activeTool === 'brush' && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>粗细</span>
              <input
                type="range"
                min={1}
                max={20}
                value={brushWidth}
                onChange={(e) => onBrushWidthChange(Number(e.target.value))}
                className="w-20 accent-cyan-500"
              />
              <span className="w-5 text-center text-slate-300">{brushWidth}</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>颜色</span>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => onBrushColorChange(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-slate-600 bg-transparent"
              />
            </label>
          </>
        )}
        {activeTool === 'text' && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>字号</span>
              <input
                type="number"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="w-14 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-center text-slate-200"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>颜色</span>
              <input
                type="color"
                value={fontColor}
                onChange={(e) => onFontColorChange(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-slate-600 bg-transparent"
              />
            </label>
          </>
        )}
      </div>

      {/* Right section — Action buttons */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStitch('vertical')}
          className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100"
        >
          垂直拼接
        </button>
        <button
          type="button"
          onClick={() => onStitch('horizontal')}
          className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100"
        >
          水平拼接
        </button>

        <div className="mx-1 h-5 w-px bg-slate-700/50" />

        <button
          type="button"
          title="撤销"
          onClick={onUndo}
          disabled={!canUndo}
          className={`px-2 py-1.5 rounded text-sm transition-colors ${
            canUndo
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'opacity-40 cursor-not-allowed text-slate-500'
          }`}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          title="重做"
          onClick={onRedo}
          disabled={!canRedo}
          className={`px-2 py-1.5 rounded text-sm transition-colors ${
            canRedo
              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'opacity-40 cursor-not-allowed text-slate-500'
          }`}
        >
          <Redo2 size={16} />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-700/50" />

        <button
          type="button"
          onClick={onExport}
          className="rounded border border-cyan-600/50 bg-cyan-600/20 px-2.5 py-1 text-xs text-cyan-300 transition-colors hover:bg-cyan-600/30 hover:text-cyan-200"
        >
          导出 PNG
        </button>
      </div>
    </div>
  );
}
