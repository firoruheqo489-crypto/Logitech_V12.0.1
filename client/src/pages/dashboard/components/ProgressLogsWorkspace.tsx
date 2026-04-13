'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, ListCollapse, X } from 'lucide-react';
import type { DashboardProgressEntry } from '../lib/dashboardApi';
import { formatProductSequenceLabel, normalizeMoldLookupKey } from '../lib/productModuleUtils';
import type { ProjectData } from '../types/project';

type ProgressLogsWorkspaceProps = {
  moldId: string;
  moldNo: string;
  projects: ProjectData[];
  progressEntriesByMold: Record<string, DashboardProgressEntry[]>;
};

type ProgressLogRow = {
  key: string;
  updateDate: string;
  uploadedAt: string;
  detail: string;
  detailImageUrl: string | null;
  estimated: string;
  assignee: string;
};

function formatDateTimeLabel(timestamp?: string): string {
  if (!timestamp) return '-';
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return '-';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeDateOnlyLabel(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveProgressUpdateLabel(uploadedAt?: string, mappedDate?: string): string {
  const mappedDateOnly = normalizeDateOnlyLabel(mappedDate);
  const uploadedDateOnly = normalizeDateOnlyLabel(uploadedAt);

  if (uploadedAt && uploadedDateOnly && (!mappedDateOnly || uploadedDateOnly === mappedDateOnly)) {
    return formatDateTimeLabel(uploadedAt);
  }

  return mappedDate?.trim() || '-';
}

export default function ProgressLogsWorkspace({
  moldId,
  moldNo,
  projects,
  progressEntriesByMold,
}: ProgressLogsWorkspaceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  const detailRows = useMemo(() => {
    const normalizedPanelMold = normalizeMoldLookupKey(moldId);
    const panelSequence = formatProductSequenceLabel(moldNo);
    const moldMatchedProjects = projects.filter((project) => {
      const projectMold = normalizeMoldLookupKey(project.identity?.moldNumber?.trim() || '');
      return projectMold === normalizedPanelMold;
    });

    const exactSequenceProjects = moldMatchedProjects.filter((project) => {
      return formatProductSequenceLabel(project.no) === panelSequence;
    });

    const scopedProjects = exactSequenceProjects.length > 0 ? exactSequenceProjects : moldMatchedProjects;
    const primaryProject = scopedProjects[0] || moldMatchedProjects[0] || projects[0] || null;
    const progressMoldId = primaryProject?.identity?.moldNumber?.trim() || moldId;
    const noteEntries = progressEntriesByMold[progressMoldId] || [];

    if (noteEntries.length > 0) {
      return noteEntries.map((entry, idx) => ({
        key: entry.id || `${progressMoldId}-${idx}`,
        updateDate: entry.date || '-',
        uploadedAt: entry.updatedAt || entry.createdAt || '',
        detail: entry.content?.trim() || '',
        detailImageUrl: entry.imageUrl?.trim() || null,
        estimated: entry.estimatedNodeCompletion || primaryProject?.milestones?.estimatedCompletion || '-',
        assignee: entry.assignee || '-',
      }));
    }

    return [
      {
        key: `${progressMoldId}-fallback`,
        updateDate: primaryProject?.details?.detailDate || '-',
        uploadedAt: '',
        detail: primaryProject?.details?.detailProgress?.trim() || '',
        detailImageUrl: null,
        estimated: primaryProject?.milestones?.estimatedCompletion || '-',
        assignee: '-',
      },
    ];
  }, [moldId, moldNo, progressEntriesByMold, projects]);

  const visibleRows = isExpanded ? detailRows : detailRows.slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border border-slate-800/70 bg-[#0a0f1c]">
        <div className="hidden border-b border-slate-800/60 px-5 py-3 md:grid md:grid-cols-[196px_136px_minmax(0,1fr)_156px_120px] md:gap-6">
          <div className="text-center text-[11px] font-medium tracking-widest text-slate-500">
            更新时间
          </div>
          <div className="text-center text-[11px] font-medium tracking-widest text-slate-500">图片</div>
          <div className="text-center text-[11px] font-medium tracking-widest text-slate-500">
            推进详情
          </div>
          <div className="text-center text-[11px] font-medium tracking-widest text-slate-500">
            预计完成
          </div>
          <div className="text-center text-[11px] font-medium tracking-widest text-slate-500">
            负责人
          </div>
        </div>

        <div className="divide-y divide-slate-800/50">
          {visibleRows.map((row) => {
            const updateDate = resolveProgressUpdateLabel(row.uploadedAt, row.updateDate);

            return (
              <div
                key={row.key}
                className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[196px_136px_minmax(0,1fr)_156px_120px] md:items-center md:gap-6 md:px-5"
              >
                <div className="pr-2 text-sm font-mono tabular-nums text-slate-400">{updateDate}</div>
                <div className="flex items-center md:justify-center">
                  {row.detailImageUrl ? (
                    <button
                      type="button"
                      className="h-12 w-20 cursor-zoom-in overflow-hidden rounded-lg ring-1 ring-slate-700/50 shadow-md"
                      title="查看推进图片"
                      onClick={() => setPreviewImageUrl(row.detailImageUrl || '')}
                    >
                      <img
                        src={row.detailImageUrl}
                        alt="推进缩略图"
                        className="h-full w-full object-cover opacity-90 transition-opacity hover:opacity-100"
                      />
                    </button>
                  ) : (
                    <div
                      className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-800/60 ring-1 ring-slate-700/50 shadow-md"
                      title="暂无图片"
                    >
                      <ImageIcon className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 px-2 text-left text-sm leading-7 text-slate-300 [overflow-wrap:anywhere]">
                  {row.detail || '-'}
                </div>
                <div className="text-center text-sm font-mono tabular-nums tracking-tight text-slate-400">
                  {row.estimated || '-'}
                </div>
                <div className="text-center text-sm font-medium text-slate-200">
                  {row.assignee && row.assignee !== '-' ? row.assignee : '-'}
                </div>
              </div>
            );
          })}
        </div>

        {detailRows.length > 6 ? (
          <div className="flex justify-end border-t border-slate-800/60 px-6 py-3">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-slate-200"
            >
              <ListCollapse className="h-3.5 w-3.5" />
              {isExpanded ? '收起' : `展开更多（${detailRows.length - 6}条）`}
            </button>
          </div>
        ) : null}
      </div>

      {previewImageUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4"
              onClick={() => setPreviewImageUrl('')}
            >
              <button
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewImageUrl('');
                }}
              >
                <X className="h-4 w-4 text-white/80" />
              </button>
              <img
                src={previewImageUrl}
                alt="推进图片预览"
                className="max-h-[88vh] max-w-[92vw] rounded-lg border border-white/10 object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
