import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import {
  deleteLaboratoryArchive,
  formatLaboratoryArchiveDateTime,
  getLaboratoryArchiveDocument,
  listLaboratoryArchives,
  type LaboratoryArchiveRecord,
  type LaboratoryArchiveSnapshot,
} from "@/lib/laboratory-archive-api"

type LaboratoryArchivePanelProps = {
  projectId: string
  onRestoreArchive?: (snapshot: LaboratoryArchiveSnapshot) => void
}

function archiveVerdictTone(verdict: string) {
  if (verdict === "FAIL") return "border-rose-300/25 bg-rose-400/[0.08] text-rose-200"
  if (verdict === "WATCH") return "border-amber-300/25 bg-amber-400/[0.08] text-amber-200"
  if (verdict === "PASS") return "border-cyan-300/25 bg-cyan-400/[0.08] text-cyan-200"
  return "border-white/[0.08] bg-white/[0.04] text-slate-300"
}

function formatArchiveDisplayDate(value: string) {
  return formatLaboratoryArchiveDateTime(value) || "--"
}

export function LaboratoryArchivePanel({
  projectId,
  onRestoreArchive,
}: LaboratoryArchivePanelProps) {
  const [archives, setArchives] = useState<LaboratoryArchiveRecord[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<LaboratoryArchiveSnapshot | null>(null)
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<LaboratoryArchiveRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingDocumentId, setLoadingDocumentId] = useState("")

  const selectedRecordId = selectedSnapshot?.document.id ?? ""
  const archiveCountLabel = useMemo(() => `${archives.length} 条`, [archives.length])

  const reloadArchives = useCallback(async () => {
    setIsLoading(true)
    try {
      const documents = await listLaboratoryArchives(projectId)
      setArchives(documents)
    } catch (error) {
      toast.error("实验室归档读取失败", {
        description: error instanceof Error ? error.message : "请确认 OSS 配置和网络状态。",
      })
      setArchives([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setSelectedSnapshot(null)
    void reloadArchives()
  }, [reloadArchives])

  useEffect(() => {
    const handleArchiveUpdated = (event: Event) => {
      const updatedProjectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId
      if (!updatedProjectId || updatedProjectId === projectId) {
        void reloadArchives()
      }
    }
    window.addEventListener("laboratory-archive-updated", handleArchiveUpdated)
    return () => window.removeEventListener("laboratory-archive-updated", handleArchiveUpdated)
  }, [projectId, reloadArchives])

  const handleViewArchive = async (record: LaboratoryArchiveRecord) => {
    setLoadingDocumentId(record.id)
    try {
      const snapshot = await getLaboratoryArchiveDocument({
        projectId,
        documentId: record.id,
      })
      if (onRestoreArchive) {
        onRestoreArchive(snapshot)
      } else {
        setSelectedSnapshot(snapshot)
      }
    } catch (error) {
      toast.error("归档详情读取失败", {
        description: error instanceof Error ? error.message : "请稍后重试。",
      })
    } finally {
      setLoadingDocumentId("")
    }
  }

  const handleDeleteArchive = async () => {
    const record = pendingDeleteRecord
    if (!record) return

    try {
      await deleteLaboratoryArchive({
        projectId,
        documentId: record.id,
      })
      setArchives((current) => current.filter((item) => item.id !== record.id))
      if (selectedRecordId === record.id) {
        setSelectedSnapshot(null)
      }
      toast.success("实验室归档已删除", {
        description: `${record.reportNo} 已从归档台账移除。`,
      })
    } catch (error) {
      toast.error("实验室归档删除失败", {
        description: error instanceof Error ? error.message : "请稍后重试。",
      })
    } finally {
      setPendingDeleteRecord(null)
    }
  }

  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-cyan-300">// LABORATORY ARCHIVE LEDGER</p>
          <h2 className="mt-2 text-xl font-bold text-slate-100">实验室归档区</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            保存当前综合报告快照，归档内容包含报告表头、规格书映射、综合判定、门禁原因与模块摘要。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3">
            <p className="font-mono text-[9px] tracking-[0.18em] text-slate-500">归档数量</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{isLoading ? "读取中" : archiveCountLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.05] bg-black/20">
        <div className="grid min-h-14 grid-cols-[90px_96px_minmax(210px,1.25fr)_minmax(130px,0.8fr)_minmax(120px,0.75fr)_100px_88px] items-center gap-5 border-b border-white/[0.06] px-5 text-xs text-slate-500">
          <span className="text-center">台账序号</span>
          <span className="text-center">实物图</span>
          <span className="text-center">样品编号</span>
          <span className="text-center">样品类型</span>
          <span className="text-center">完成日期</span>
          <span className="text-center">判定</span>
          <span className="text-center">操作</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取实验室归档...
          </div>
        ) : archives.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            暂无实验室归档，请前往独立实验室工作区新建报告并归档。
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {archives.map((record) => (
              <div
                key={record.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleViewArchive(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") void handleViewArchive(record)
                }}
                className={`grid min-h-[104px] cursor-pointer grid-cols-[90px_96px_minmax(210px,1.25fr)_minmax(130px,0.8fr)_minmax(120px,0.75fr)_100px_88px] items-center gap-5 px-5 text-sm transition ${
                  selectedRecordId === record.id ? "bg-cyan-300/[0.06]" : "hover:bg-white/[0.025]"
                }`}
              >
                <span className="text-center font-mono text-base font-semibold text-slate-300">
                  {record.specSequence ?? "--"}
                </span>
                <div className="mx-auto flex h-14 w-16 items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/[0.12] bg-white/[0.025] text-center text-[10px] leading-tight text-slate-600" title="规格书实物图">
                  {record.imageUrl ? (
                    <img src={record.imageUrl} alt="规格书实物图" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span>暂无<br />实物图</span>
                  )}
                </div>
                <span className="truncate text-center font-semibold text-slate-100" title={record.sampleNo}>
                  {record.sampleNo || "--"}
                </span>
                <span className="truncate text-center text-slate-300" title={record.sampleType || ""}>
                  {record.sampleType || "--"}
                </span>
                <span className="text-center font-mono text-slate-300">{record.completionDate || "--"}</span>
                <span className="text-center">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${archiveVerdictTone(record.verdict)}`}>
                    {record.verdict}
                  </span>
                </span>
                <div className="flex items-center justify-center gap-2">
                  {loadingDocumentId === record.id ? <Loader2 className="h-4 w-4 animate-spin text-cyan-200" /> : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setPendingDeleteRecord(record)
                    }}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-slate-400 transition hover:border-rose-300/35 hover:text-rose-200"
                    aria-label="删除归档"
                    title="删除归档"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSnapshot ? (
        <div className="mt-5 rounded-2xl border border-white/[0.05] bg-black/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">// ARCHIVE SNAPSHOT</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-100">{selectedSnapshot.document.reportNo}</h3>
              <p className="mt-1 text-xs text-slate-500">
                归档时间：{formatArchiveDisplayDate(selectedSnapshot.document.createdAt)}
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${archiveVerdictTone(selectedSnapshot.document.verdict)}`}>
              {selectedSnapshot.document.verdict}
            </span>
            {onRestoreArchive && selectedSnapshot.state.workspaceDraft ? (
              <button
                type="button"
                onClick={() => onRestoreArchive(selectedSnapshot)}
                className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
              >
                恢复到工作区
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-lg bg-white/[0.025] px-4 py-3">
              <p className="text-xs text-slate-600">项目 / 样品</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedSnapshot.state.reportMeta.projectName || "--"} / {selectedSnapshot.state.reportMeta.sampleName || "--"}
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.025] px-4 py-3">
              <p className="text-xs text-slate-600">测试类型</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{selectedSnapshot.state.specHeader?.testType || "--"}</p>
            </div>
            <div className="rounded-lg bg-white/[0.025] px-4 py-3">
              <p className="text-xs text-slate-600">送样日期</p>
              <p className="mt-2 font-mono text-sm font-semibold text-cyan-100">{selectedSnapshot.state.specHeader?.sampleDeliveryDate || "--"}</p>
            </div>
            <div className="rounded-lg bg-white/[0.025] px-4 py-3">
              <p className="text-xs text-slate-600">完成日期</p>
              <p className="mt-2 font-mono text-sm font-semibold text-cyan-100">{selectedSnapshot.state.specHeader?.completionDate || "--"}</p>
            </div>
            <div className="rounded-lg bg-white/[0.025] px-4 py-3">
              <p className="text-xs text-slate-600">模块数量</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {selectedSnapshot.document.moduleCount} 个 / 可打印 {selectedSnapshot.document.printableModuleCount} 个
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {selectedSnapshot.state.moduleSummaries.map((summary) => (
              <div key={`${summary.nodeId}-${summary.type}`} className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{summary.label}</p>
                    <p className="mt-1 text-xs text-slate-600">{summary.printTitle}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${archiveVerdictTone(summary.verdict)}`}>
                    {summary.verdict}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {summary.keyMetrics.slice(0, 5).map((metric) => (
                    <span key={`${metric.label}-${metric.value}`} className="rounded-full border border-white/[0.06] bg-black/20 px-2.5 py-1 text-xs text-slate-300">
                      {metric.label}: {metric.value}
                    </span>
                  ))}
                </div>
                {summary.warnings.length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-amber-200/80">{summary.warnings[0]}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
            <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">// 归档门禁</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(selectedSnapshot.state.exportGate?.reasons ?? ["归档快照未记录门禁原因。"]).map((reason) => (
                <span key={reason} className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-1 text-xs text-slate-300">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <CyberConfirmDialog
        open={!!pendingDeleteRecord}
        title="删除归档确认"
        message={`确定要删除归档 ${pendingDeleteRecord?.reportNo || ""} 吗？删除后该快照不可恢复。`}
        onCancel={() => setPendingDeleteRecord(null)}
        onConfirm={handleDeleteArchive}
        confirmText="确认删除"
        cancelText="取消"
      />
    </section>
  )
}
