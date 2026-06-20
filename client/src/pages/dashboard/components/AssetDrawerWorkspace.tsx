'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Database, PanelsTopLeft, type LucideIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export interface AssetPanelItem {
  moldId: string;
  moldNo: string;
}

interface AssetDrawerWorkspaceProps {
  panels: AssetPanelItem[];
  badgeLabel: string;
  drawerTitle: string;
  drawerDescription: string;
  emptyMessage: string;
  icon?: LucideIcon;
  hideBadgeLabel?: boolean;
  renderActiveContent?: (panel: AssetPanelItem) => React.ReactNode;
  renderActiveSummary?: (panel: AssetPanelItem) => React.ReactNode;
  renderPanel: (panel: AssetPanelItem) => React.ReactNode;
}

export function buildAssetPanelKey(panel: AssetPanelItem): string {
  return `${panel.moldId}::${panel.moldNo}`;
}

export default function AssetDrawerWorkspace({
  panels,
  badgeLabel,
  drawerTitle,
  drawerDescription,
  emptyMessage,
  icon: Icon = Database,
  hideBadgeLabel = false,
  renderActiveContent,
  renderActiveSummary,
  renderPanel,
}: AssetDrawerWorkspaceProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPanelKey, setSelectedPanelKey] = useState('');

  const normalizedPanels = useMemo(
    () => panels.filter((panel) => panel.moldId.trim()),
    [panels],
  );

  useEffect(() => {
    if (normalizedPanels.length === 0) {
      setSelectedPanelKey('');
      return;
    }

    const hasCurrent = normalizedPanels.some(
      (panel) => buildAssetPanelKey(panel) === selectedPanelKey,
    );
    if (!hasCurrent) {
      setSelectedPanelKey(buildAssetPanelKey(normalizedPanels[0]));
    }
  }, [normalizedPanels, selectedPanelKey]);

  const activePanel =
    normalizedPanels.find((panel) => buildAssetPanelKey(panel) === selectedPanelKey) ||
    normalizedPanels[0] ||
    null;

  if (!activePanel) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-[#0a0f1c] px-6 py-16 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-[#0a0f1c] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
            <Icon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            {!hideBadgeLabel && badgeLabel ? (
              <div className="text-[11px] font-mono tracking-[0.24em] text-slate-500">
                {badgeLabel}
              </div>
            ) : null}
            <div className={`${!hideBadgeLabel && badgeLabel ? 'mt-1' : ''} text-slate-100`}>
              {renderActiveContent ? (
                renderActiveContent(activePanel)
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-lg font-bold tracking-wide">{activePanel.moldId}</span>
                  <span className="text-xs font-mono text-slate-500">{activePanel.moldNo}</span>
                  {renderActiveSummary ? renderActiveSummary(activePanel) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300"
        >
          <PanelsTopLeft className="h-4 w-4" />
          选择模号
          <span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            {normalizedPanels.length}
          </span>
        </button>
      </div>

      {renderPanel(activePanel)}

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent
          side="right"
          className="border-l border-slate-800 bg-[#050816] p-0 text-slate-100 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-800 px-6 py-5">
            <SheetTitle className="flex items-center gap-2 text-sm font-bold tracking-[0.2em] text-cyan-400">
              <Icon className="h-4 w-4" />
              {drawerTitle}
            </SheetTitle>
            <SheetDescription className="text-xs tracking-wide text-slate-500">
              {drawerDescription}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4 py-4">
            {normalizedPanels.map((panel) => {
              const panelKey = buildAssetPanelKey(panel);
              const isActive = panelKey === buildAssetPanelKey(activePanel);

              return (
                <button
                  key={panelKey}
                  type="button"
                  onClick={() => {
                    setSelectedPanelKey(panelKey);
                    setIsDrawerOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition-all ${
                    isActive
                      ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-base font-bold tracking-wide ${
                        isActive ? 'text-cyan-300' : 'text-slate-100'
                      }`}
                    >
                      {panel.moldId}
                    </div>
                    <div className="mt-1 text-[11px] font-mono tracking-[0.22em] text-slate-500">
                      {panel.moldNo}
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}
                  />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
