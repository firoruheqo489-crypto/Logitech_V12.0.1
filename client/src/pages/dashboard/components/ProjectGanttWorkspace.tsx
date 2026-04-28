"use client";

/**
 * ProjectGanttWorkspace
 *
 * Dashboard 接入：项目甘特图模块。
 * 直接挂载 gantetu 工业级动态甘特图（GanttSkeleton），并注入 Phase 13 / Phase 8 示例数据。
 * 数据形态来自 gantetu2/app/page.tsx，原样保留以便回归对照。
 */

import { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import CyberPromptDialog from '@/components/ui/CyberPromptDialog';
import { GanttSkeleton } from '@/components/gantetu/gantt-skeleton';
import type { ComponentGroup, Milestone } from '@/lib/gantt/types';

const INITIAL_COMPONENTS: ComponentGroup[] = [
  {
    id: 'comp_upper_shell',
    name: '上盖模具',
    isExpanded: true,
    tasks: [
      {
        id: 'upper_cnc',
        parentId: null,
        name: 'CNC 开粗',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        baseStartDate: '2026-04-01',
        baseEndDate: '2026-04-05',
        status: 'in-progress',
        dependencies: [],
        isExpanded: true,
        children: [],
        progress: 60,
      },
      {
        id: 'upper_polish',
        parentId: null,
        name: '抛光工序',
        startDate: '2026-04-06',
        endDate: '2026-04-10',
        baseStartDate: '2026-04-06',
        baseEndDate: '2026-04-10',
        status: 'pending',
        dependencies: ['upper_cnc'],
        isExpanded: true,
        children: [],
      },
    ],
  },
  {
    id: 'comp_lower_shell',
    name: '底壳模具',
    isExpanded: true,
    tasks: [
      {
        id: 'lower_cnc',
        parentId: null,
        name: 'CNC 开粗',
        startDate: '2026-04-02',
        endDate: '2026-04-08',
        baseStartDate: '2026-04-02',
        baseEndDate: '2026-04-08',
        status: 'in-progress',
        dependencies: [],
        isExpanded: true,
        children: [],
        progress: 30,
      },
      {
        id: 'lower_edm',
        parentId: null,
        name: 'EDM 放电',
        startDate: '2026-04-09',
        endDate: '2026-04-12',
        baseStartDate: '2026-04-09',
        baseEndDate: '2026-04-12',
        status: 'pending',
        dependencies: ['lower_cnc'],
        isExpanded: true,
        children: [],
      },
      {
        id: 'lower_inspect',
        parentId: null,
        name: '尺寸检测',
        startDate: '2026-04-13',
        endDate: '2026-04-14',
        baseStartDate: '2026-04-13',
        baseEndDate: '2026-04-14',
        status: 'pending',
        dependencies: ['lower_edm'],
        isExpanded: true,
        children: [],
      },
    ],
  },
  {
    id: 'comp_side_button',
    name: '侧键模具',
    isExpanded: true,
    tasks: [
      {
        id: 'side_design',
        parentId: null,
        name: '结构设计',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        baseStartDate: '2026-04-01',
        baseEndDate: '2026-04-03',
        status: 'completed',
        dependencies: [],
        isExpanded: true,
        children: [],
        progress: 100,
      },
      {
        id: 'side_cnc',
        parentId: null,
        name: 'CNC 加工',
        startDate: '2026-04-04',
        endDate: '2026-04-07',
        baseStartDate: '2026-04-04',
        baseEndDate: '2026-04-07',
        status: 'in-progress',
        dependencies: ['side_design'],
        isExpanded: true,
        children: [],
        progress: 80,
      },
    ],
  },
];

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: 'milestone_t0',
    name: 'T0 试模',
    date: '2026-04-10',
    type: 'commercial',
  },
  {
    id: 'milestone_sop',
    name: 'SOP 量产',
    date: '2026-04-18',
    type: 'technical',
  },
];

interface GanttBoardTab {
  id: string;
  title: string;
  serial: number;
}

interface ProjectGanttWorkspaceSnapshot {
  boards: GanttBoardTab[];
  activeBoardId: string;
}

const WORKSPACE_STORAGE_KEY = 'dashboard_project_gantt_workspace_v1';
const BOARD_STORAGE_PREFIX = 'dashboard_project_gantt_board_v1:';

function createBoardTitle(serial: number): string {
  return `项目${serial}甘特图`;
}

function createBoardId(serial: number): string {
  return `project-gantt-${serial}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createBoard(serial: number): GanttBoardTab {
  return {
    id: createBoardId(serial),
    title: createBoardTitle(serial),
    serial,
  };
}

function sanitizeBoards(value: unknown): GanttBoardTab[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<GanttBoardTab>;
      const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : createBoardId(index + 1);
      const serial = typeof record.serial === 'number' && Number.isFinite(record.serial) && record.serial > 0
        ? Math.floor(record.serial)
        : index + 1;
      const title = typeof record.title === 'string' && record.title.trim()
        ? record.title.trim()
        : createBoardTitle(serial);
      return { id, title, serial };
    })
    .filter((item): item is GanttBoardTab => item !== null);
}

function readWorkspaceSnapshot(): ProjectGanttWorkspaceSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectGanttWorkspaceSnapshot>;
    const boards = sanitizeBoards(parsed?.boards);
    if (boards.length === 0) return null;
    const activeBoardId =
      typeof parsed?.activeBoardId === 'string' && boards.some((board) => board.id === parsed.activeBoardId)
        ? parsed.activeBoardId
        : boards[0].id;
    return { boards, activeBoardId };
  } catch {
    return null;
  }
}

function writeWorkspaceSnapshot(snapshot: ProjectGanttWorkspaceSnapshot) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore localStorage quota and browser restrictions.
  }
}

function removeBoardStorage(boardId: string) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(`${BOARD_STORAGE_PREFIX}${boardId}`);
  } catch {
    // Ignore browser localStorage restrictions.
  }
}

export default function ProjectGanttWorkspace() {
  const initialWorkspace = useMemo<ProjectGanttWorkspaceSnapshot>(() => {
    const snapshot = readWorkspaceSnapshot();
    if (snapshot && snapshot.boards.length > 0) return snapshot;
    const firstBoard = createBoard(1);
    return {
      boards: [firstBoard],
      activeBoardId: firstBoard.id,
    };
  }, []);

  const [boards, setBoards] = useState<GanttBoardTab[]>(() => initialWorkspace.boards);
  const [activeBoardId, setActiveBoardId] = useState<string>(() => initialWorkspace.activeBoardId);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null,
    [activeBoardId, boards],
  );
  const renameTarget = useMemo(
    () => boards.find((board) => board.id === renameTargetId) ?? null,
    [boards, renameTargetId],
  );
  const deleteTarget = useMemo(
    () => boards.find((board) => board.id === deleteTargetId) ?? null,
    [boards, deleteTargetId],
  );

  useEffect(() => {
    if (boards.length === 0) return;
    if (!boards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId(boards[0].id);
    }
  }, [activeBoardId, boards]);

  useEffect(() => {
    if (boards.length === 0) return;
    writeWorkspaceSnapshot({
      boards,
      activeBoardId: activeBoard?.id ?? boards[0].id,
    });
  }, [activeBoard, activeBoardId, boards]);

  const handleAddBoard = () => {
    const nextSerial = boards.reduce((maxSerial, board) => Math.max(maxSerial, board.serial), 0) + 1;
    const nextBoard = createBoard(nextSerial);
    setBoards((prev) => [...prev, nextBoard]);
    setActiveBoardId(nextBoard.id);
  };

  const handleRenameBoard = (title: string) => {
    if (!renameTargetId) return;
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setBoards((prev) =>
      prev.map((board) =>
        board.id === renameTargetId
          ? {
              ...board,
              title: nextTitle,
            }
          : board,
      ),
    );
    setRenameTargetId(null);
  };

  const handleDeleteBoard = () => {
    if (!deleteTargetId) return;
    if (boards.length <= 1) {
      setDeleteTargetId(null);
      return;
    }

    const currentBoards = boards;
    const deleteIndex = currentBoards.findIndex((board) => board.id === deleteTargetId);
    if (deleteIndex < 0) {
      setDeleteTargetId(null);
      return;
    }

    const nextBoards = currentBoards.filter((board) => board.id !== deleteTargetId);
    const fallbackBoard =
      nextBoards[Math.min(deleteIndex, nextBoards.length - 1)] ?? nextBoards[0] ?? null;

    removeBoardStorage(deleteTargetId);
    setBoards(nextBoards);
    if (activeBoardId === deleteTargetId && fallbackBoard) {
      setActiveBoardId(fallbackBoard.id);
    }
    setDeleteTargetId(null);
  };

  const headerSlot = (
    <div className="border-b border-slate-800/50 bg-[#09111d] px-3 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {boards.map((board) => {
            const isActive = board.id === activeBoard?.id;
            return (
              <button
                key={board.id}
                type="button"
                onClick={() => setActiveBoardId(board.id)}
                onDoubleClick={() => setRenameTargetId(board.id)}
                className={
                  isActive
                    ? 'max-w-[240px] truncate rounded border border-cyan-500 bg-cyan-900/40 px-4 py-1.5 text-xs font-mono text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.18)]'
                    : 'max-w-[240px] truncate rounded border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-mono text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200'
                }
                title={board.title}
              >
                {board.title}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleAddBoard}
            className="inline-flex items-center justify-center rounded border border-dashed border-cyan-700/70 bg-slate-900 px-3 py-1.5 text-cyan-300 transition-colors hover:border-cyan-500 hover:bg-cyan-950/20"
            title="新增甘特图"
            aria-label="新增甘特图"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-slate-500">
            {activeBoard ? `当前：${activeBoard.title}` : '当前：未选择甘特图'}
          </span>
          <button
            type="button"
            onClick={() => activeBoard && setDeleteTargetId(activeBoard.id)}
            disabled={!activeBoard || boards.length <= 1}
            className="inline-flex items-center gap-1 rounded border border-red-500/25 bg-red-950/20 px-3 py-1.5 text-xs text-red-200 transition-colors hover:border-red-400/45 hover:bg-red-950/35 disabled:cursor-not-allowed disabled:opacity-35"
            title={boards.length <= 1 ? '至少保留 1 张甘特图' : '删除当前甘特图'}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除当前
          </button>
          <button
            type="button"
            onClick={() => activeBoard && setRenameTargetId(activeBoard.id)}
            disabled={!activeBoard}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Edit3 className="h-3.5 w-3.5" />
            重命名
          </button>
        </div>
      </div>
    </div>
  );

  if (!activeBoard) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0B0F19] px-6 py-12 text-center text-sm text-slate-500">
        当前没有可用的项目甘特图。
      </div>
    );
  }

  return (
    <div className="bg-[#0B0F19] text-slate-100">
      <GanttSkeleton
        key={activeBoard.id}
        storageKey={`${BOARD_STORAGE_PREFIX}${activeBoard.id}`}
        headerSlot={headerSlot}
        initialComponents={INITIAL_COMPONENTS}
        initialMilestones={INITIAL_MILESTONES}
      />

      {renameTarget && (
        <CyberPromptDialog
          open
          title="重命名甘特图"
          subtitle="标签名称修改"
          description="修改当前独立甘特图的标签名称。"
          fields={[
            {
              kind: 'text',
              name: 'title',
              label: '甘特图名称',
              defaultValue: renameTarget.title,
              placeholder: '项目1甘特图',
              required: true,
              maxLength: 32,
            },
          ]}
          confirmText="保存名称"
          cancelText="取消"
          onCancel={() => setRenameTargetId(null)}
          onConfirm={(values) => handleRenameBoard(values.title ?? '')}
        />
      )}

      {deleteTarget && (
        <CyberConfirmDialog
          open
          title="删除甘特图确认"
          message={`确定要删除 ${deleteTarget.title} 吗？\n该标签下的本地甘特图数据也会一并移除，此操作不可撤销。`}
          confirmText="确认删除"
          cancelText="取消"
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={handleDeleteBoard}
        />
      )}
    </div>
  );
}
