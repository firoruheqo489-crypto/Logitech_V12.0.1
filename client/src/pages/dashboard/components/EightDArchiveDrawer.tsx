import { useMemo, useState } from "react";
import {
  Archive,
  CalendarClock,
  Cloud,
  FolderPlus,
  Loader2,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { EightDReport, EightDStage } from "@/lib/report-8d-remote-state-api";
import { cn } from "@/lib/utils";

type EightDArchiveDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  reports: EightDReport[];
  archiveMonth: string;
  archiveLimit?: number;
  isLoading: boolean;
  isSaving: boolean;
  loadingReportId: string | null;
  hasUnsavedChanges: boolean;
  onRefresh: () => Promise<unknown> | unknown;
  onArchiveMonthChange: (archiveMonth: string) => void;
  onCreateCase: () => Promise<unknown>;
  onLoadCase: (report: EightDReport) => Promise<unknown>;
};

const STAGE_LABELS: Record<EightDStage, string> = {
  D0: "D0 建案",
  D1: "D1 团队",
  D2: "D2 描述",
  D3: "D3 遏制",
  D4: "D4 根本原因",
  D5: "D5 纠正措施",
  D6: "D6 验证",
  D7: "D7 防再发",
  D8: "D8 结案",
};

const STAGE_BADGE_CLASS: Record<EightDStage, string> = {
  D0: "border-sky-400/35 bg-sky-400/14 text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.16)]",
  D1: "border-cyan-400/35 bg-cyan-400/14 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.16)]",
  D2: "border-indigo-400/35 bg-indigo-400/14 text-indigo-200 shadow-[0_0_18px_rgba(129,140,248,0.16)]",
  D3: "border-orange-400/40 bg-orange-400/14 text-orange-200 shadow-[0_0_18px_rgba(251,146,60,0.16)]",
  D4: "border-amber-300/55 bg-amber-300/18 text-amber-100 shadow-[0_0_22px_rgba(252,211,77,0.22)]",
  D5: "border-fuchsia-400/35 bg-fuchsia-400/14 text-fuchsia-200 shadow-[0_0_18px_rgba(217,70,239,0.16)]",
  D6: "border-violet-400/35 bg-violet-400/14 text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.16)]",
  D7: "border-teal-400/40 bg-teal-400/14 text-teal-200 shadow-[0_0_18px_rgba(45,212,191,0.16)]",
  D8: "border-emerald-300/55 bg-emerald-300/18 text-emerald-100 shadow-[0_0_22px_rgba(110,231,183,0.22)]",
};

function formatArchiveTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClassName(status: EightDReport["status"]): string {
  if (status === "Closed") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "Pending") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
}

export default function EightDArchiveDrawer({
  open,
  onOpenChange,
  projectName,
  reports,
  archiveMonth,
  archiveLimit,
  isLoading,
  isSaving,
  loadingReportId,
  hasUnsavedChanges,
  onRefresh,
  onArchiveMonthChange,
  onCreateCase,
  onLoadCase,
}: EightDArchiveDrawerProps) {
  const [loadTarget, setLoadTarget] = useState<EightDReport | null>(null);

  const sortedReports = useMemo(() => [...reports], [reports]);
  const monthOptions = useMemo(() => {
    const current = new Date(`${archiveMonth}-01T00:00:00`);
    const seed = Number.isNaN(current.getTime()) ? new Date() : current;
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(seed.getFullYear(), seed.getMonth() - index, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return month;
    });
  }, [archiveMonth]);

  const handleCreateCase = async () => {
    try {
      await onCreateCase();
      toast.success("新的 8D 案件已建档");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新建 8D 案件失败");
    }
  };

  const handleConfirmLoad = async () => {
    if (!loadTarget) {
      return;
    }

    try {
      await onLoadCase(loadTarget);
      toast.success(`已载入 ${loadTarget.reportId}`);
      setLoadTarget(null);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "8D 案件加载失败");
    }
  };

  const handleCardClick = (report: EightDReport) => {
    if (hasUnsavedChanges) {
      setLoadTarget(report);
      return;
    }

    void (async () => {
      try {
        await onLoadCase(report);
        toast.success(`已载入 ${report.reportId}`);
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "8D 案件加载失败");
      }
    })();
  };

  return (
    <>
      <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-full w-full max-w-[620px] border-l border-cyan-500/20 bg-[#07111b] text-zinc-100 sm:max-w-[620px]">
          <DrawerHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.16),_rgba(7,17,27,0.96)_55%)] px-6 pb-5 pt-6 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                  <Archive className="h-3.5 w-3.5" />
                  Case Library
                </div>
                <DrawerTitle className="text-xl font-semibold tracking-wide text-zinc-50">
                  8D 案件库
                </DrawerTitle>
                <DrawerDescription className="text-sm leading-6 text-zinc-400">
                  当前项目：<span className="font-mono text-zinc-200">{projectName}</span>
                </DrawerDescription>
              </div>

              <Button
                type="button"
                onClick={handleCreateCase}
                disabled={isSaving}
                className="h-11 rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-4 text-cyan-100 hover:bg-cyan-500/25"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                新建案件
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Cloud className="h-3.5 w-3.5 text-cyan-300" />
              {archiveMonth} 月案件，按最后更新时间倒序展示
              {archiveLimit ? <span className="text-zinc-600">上限 {archiveLimit} 份/月</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={archiveMonth}
                onChange={(event) => onArchiveMonthChange(event.target.value)}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-200 outline-none hover:bg-white/[0.07]"
                aria-label="选择 8D 案件月份"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month} className="bg-slate-950 text-zinc-100">
                    {month}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void onRefresh()}
                className="h-8 rounded-lg px-2 text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                刷新
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  正在读取 8D 案件索引...
                </div>
              </div>
            ) : sortedReports.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-6 text-center">
                <Archive className="h-10 w-10 text-cyan-400/70" />
                <p className="mt-4 text-base font-medium text-zinc-200">还没有 8D 案件</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  当前月份暂无案件。点击“新建案件”，系统会生成新编号并把空模板占位写入 OSS。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedReports.map((report) => {
                  const isLoadingCurrent = loadingReportId === report.reportId;

                  return (
                    <button
                      key={report.reportId}
                      type="button"
                      onClick={() => handleCardClick(report)}
                      disabled={isLoadingCurrent}
                      className="group w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,31,0.96),rgba(7,12,22,0.96))] p-4 text-left shadow-[0_14px_36px_rgba(0,0,0,0.24)] transition-all hover:border-cyan-400/30 hover:bg-[linear-gradient(180deg,rgba(18,25,38,1),rgba(9,15,27,1))]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("rounded-full px-3 py-1 text-[12px] font-bold", STAGE_BADGE_CLASS[report.currentStage])}>
                              {STAGE_LABELS[report.currentStage]}
                            </Badge>
                            <Badge className={cn("rounded-full px-2.5 py-1 text-[11px]", statusClassName(report.status))}>
                              {report.status}
                            </Badge>
                            <span className="font-mono text-sm font-semibold tracking-wide text-zinc-100">
                              {report.reportId}
                            </span>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-zinc-200">
                            {report.issueSubject || "未填写异常主题"}
                          </p>

                          <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                              <span className="text-zinc-500">当前责任人</span>
                              <span className="truncate font-semibold text-amber-100">{report.owner || "未指定"}</span>
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                              <span className="truncate">{formatArchiveTime(report.lastUpdatedAt)}</span>
                            </span>
                          </div>

                          <div className="mt-2 text-[11px] text-zinc-500">
                            归档月份：<span className="font-mono text-zinc-400">{report.archiveMonth || archiveMonth}</span>
                          </div>

                          <div className="mt-3 truncate font-mono text-[11px] text-zinc-500">
                            {report.ossUrl}
                          </div>
                        </div>

                        {isLoadingCurrent ? (
                          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-200">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            加载中
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={Boolean(loadTarget)} onOpenChange={(nextOpen) => !nextOpen && setLoadTarget(null)}>
        <AlertDialogContent className="border border-amber-500/20 bg-[#08121d] text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <AlertDialogHeader>
            <AlertDialogTitle>确认载入 8D 案件？</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {hasUnsavedChanges
                ? "当前 8D 有未同步至云端的修改，强行加载将丢失数据，是否继续？"
                : "将从 OSS 拉取该 8D JSON 并覆盖当前工作区。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmLoad()}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              确认加载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
