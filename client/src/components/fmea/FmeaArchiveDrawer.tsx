"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  Cloud,
  CloudUpload,
  Clock3,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import type { FmeaDocument } from "@/lib/fmea-archive-api"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

interface FmeaArchiveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduleLabel: string
  projectId: string
  documents: FmeaDocument[]
  isLoading: boolean
  isSaving: boolean
  loadingDocumentId: string | null
  deletingDocumentId: string | null
  onRefresh: () => Promise<void> | void
  onSaveVersion: (version: string) => Promise<unknown>
  onLoadVersion: (document: FmeaDocument) => Promise<unknown>
  onDeleteVersion: (document: FmeaDocument) => Promise<unknown>
}

function formatArchiveDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value || "-"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function FmeaArchiveDrawer({
  open,
  onOpenChange,
  moduleLabel,
  projectId,
  documents,
  isLoading,
  isSaving,
  loadingDocumentId,
  deletingDocumentId,
  onRefresh,
  onSaveVersion,
  onLoadVersion,
  onDeleteVersion,
}: FmeaArchiveDrawerProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [versionDraft, setVersionDraft] = useState("")
  const [loadTarget, setLoadTarget] = useState<FmeaDocument | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FmeaDocument | null>(null)

  const sortedDocuments = useMemo(() => [...documents], [documents])

  const handleSaveVersion = async () => {
    const version = versionDraft.trim()
    if (!version) {
      toast.error("请先输入版本号或变更说明")
      return
    }

    try {
      await onSaveVersion(version)
      await onRefresh()
      toast.success("已另存到云端档案")
      setVersionDraft("")
      setIsSaveDialogOpen(false)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "云端版本保存失败")
    }
  }

  const handleConfirmLoad = async () => {
    if (!loadTarget) {
      return
    }

    try {
      await onLoadVersion(loadTarget)
      toast.success(`已切换到版本 ${loadTarget.version}`)
      setLoadTarget(null)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "历史版本加载失败")
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return
    }

    try {
      await onDeleteVersion(deleteTarget)
      toast.success("历史档案已删除")
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "历史档案删除失败")
    }
  }

  return (
    <>
      <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-full w-full max-w-[560px] border-l border-cyan-500/20 bg-[#07111b] text-zinc-100 sm:max-w-[560px]">
          <DrawerHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_rgba(7,17,27,0.96)_55%)] px-6 pb-5 pt-6 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-200">
                  <Cloud className="h-3.5 w-3.5" />
                  云端档案
                </div>
                <DrawerTitle className="text-xl font-semibold tracking-wide text-zinc-50">
                  {moduleLabel} 历史版本
                </DrawerTitle>
                <DrawerDescription className="text-sm leading-6 text-zinc-400">
                  当前项目代号：<span className="font-mono text-zinc-200">{projectId}</span>
                </DrawerDescription>
              </div>
              <Button
                type="button"
                onClick={() => setIsSaveDialogOpen(true)}
                disabled={isSaving}
                className="h-11 rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-4 text-cyan-100 hover:bg-cyan-500/25"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                + 新增版本 / 另存到云端
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
              按时间倒序展示当前项目的所有历史档案
            </div>
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

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  正在读取云端历史档案...
                </div>
              </div>
            ) : sortedDocuments.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-6 text-center">
                <Cloud className="h-10 w-10 text-cyan-400/70" />
                <p className="mt-4 text-base font-medium text-zinc-200">还没有历史档案</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  点击上方“新增版本 / 另存到云端”，把当前工作区快照沉淀为可回溯版本。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedDocuments.map((document) => {
                  const isLoadingCurrent = loadingDocumentId === document.id
                  const isDeletingCurrent = deletingDocumentId === document.id

                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => setLoadTarget(document)}
                      disabled={isLoadingCurrent}
                      className="group w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,19,31,0.96),rgba(7,12,22,0.96))] p-4 text-left shadow-[0_14px_36px_rgba(0,0,0,0.24)] transition-all hover:border-cyan-400/30 hover:bg-[linear-gradient(180deg,rgba(18,25,38,1),rgba(9,15,27,1))]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold tracking-wide text-zinc-100">
                              {document.version}
                            </span>
                            {document.isCurrent ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                当前工作版本
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5 text-zinc-500" />
                              {formatArchiveDate(document.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Cloud className="h-3.5 w-3.5 text-cyan-300" />
                              OSS 已归档
                            </span>
                          </div>
                          <div className="mt-3 truncate font-mono text-[11px] text-zinc-500">
                            {document.ossUrl}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isLoadingCurrent ? (
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-200">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              加载中
                            </div>
                          ) : null}
                          {!document.isCurrent ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={isDeletingCurrent}
                              onClick={(event) => {
                                event.stopPropagation()
                                setDeleteTarget(document)
                              }}
                              className="opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/12 hover:text-rose-300"
                              aria-label={`删除 ${document.version}`}
                            >
                              {isDeletingCurrent ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="border border-cyan-500/20 bg-[#08121d] text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>新增版本 / 另存到云端</DialogTitle>
            <DialogDescription className="text-zinc-400">
              输入版本号或本次变更说明，例如 `V1.1-T0试模更新`。保存后会把当前工作区完整序列化到 OSS。
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveVersion()
            }}
          >
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-zinc-300">
                版本号 / 变更说明
              </label>
              <input
                autoFocus
                value={versionDraft}
                onChange={(event) => setVersionDraft(event.target.value)}
                placeholder="例如：V1.0 / V1.1-T0试模更新"
                maxLength={160}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0c1624] px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-cyan-400/40"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSaveDialogOpen(false)}
                className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/5"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                保存到云端
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(loadTarget)} onOpenChange={(nextOpen) => !nextOpen && setLoadTarget(null)}>
        <AlertDialogContent className="border border-amber-500/20 bg-[#08121d] text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <AlertDialogHeader>
            <AlertDialogTitle>确认切换历史版本？</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              将从 OSS 拉取 <span className="font-medium text-zinc-100">{loadTarget?.version}</span> 并覆盖当前 {moduleLabel} 工作区状态。
              当前未保存的本地修改可能丢失，请确认后继续。
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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
      >
        <AlertDialogContent className="border border-rose-500/20 bg-[#08121d] text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该历史档案？</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              版本 <span className="font-medium text-zinc-100">{deleteTarget?.version}</span> 将从云端档案中永久移除，此操作不可逆。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-rose-500 text-white hover:bg-rose-400"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
