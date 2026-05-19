"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { FmeaArchiveDrawer } from "@/components/fmea/FmeaArchiveDrawer"
import { StatusBar } from "@/components/fmea/status-bar"
import { TopBar } from "@/components/fmea/top-bar"
import { deriveFmeaProjectId, useFmeaOss } from "@/hooks/use-fmea-oss"
import { PfmeaAuditDrawer } from "@/components/pfmea/pfmea-audit-drawer"
import {
  PfmeaContextHeader,
  type PfmeaHeaderFields,
} from "@/components/pfmea/pfmea-context-header"
import { PfmeaDataGrid } from "@/components/pfmea/pfmea-data-grid"
import {
  exportPfmeaPdf,
  printPfmeaDocument,
} from "@/components/pfmea/export-pfmea-pdf"
import { ProcessSidebar } from "@/components/pfmea/process-sidebar"
import {
  DEFAULT_FMEA_WORKSPACE_KEYS,
  fetchFmeaRemoteWorkspaceState,
  saveFmeaRemoteWorkspaceState,
  type PfmeaRemoteWorkspaceState,
} from "@/lib/fmea-remote-state-api"
import {
  createBlankPfmeaRow,
  defaultProcessNodeId,
  finalizePfmeaRow,
  findPfmeaNodeById,
  getPfmeaRiskBand,
  initialPfmeaData,
  isCriticalPfmeaRisk,
  pfmeaTree,
  processNodeMapping,
  type PfmeaRow,
} from "@/lib/pfmea-data"

type RiskFilter = "all" | "critical" | "warning" | "safe"
type SyncTone = "neutral" | "saving" | "saved" | "error"

const PFMEA_WORKSPACE_KEY = DEFAULT_FMEA_WORKSPACE_KEYS.pfmea

const initialHeaderFields: PfmeaHeaderFields = {
  projectName: "",
  partNumber: "",
  owner: "",
  reviewDate: "",
}

function normalizeHeaderFields(value: Partial<PfmeaHeaderFields> | null | undefined): PfmeaHeaderFields {
  return {
    projectName: String(value?.projectName ?? ""),
    partNumber: String(value?.partNumber ?? ""),
    owner: String(value?.owner ?? ""),
    reviewDate: String(value?.reviewDate ?? ""),
  }
}

function normalizeRemotePfmeaRows(rows: PfmeaRemoteWorkspaceState["tableData"] | null | undefined): PfmeaRow[] {
  if (!Array.isArray(rows)) {
    return initialPfmeaData
  }

  return rows.map((row, index) =>
    finalizePfmeaRow({
      id: row.id || `pfmea-row-${index + 1}`,
      areaId: row.areaId || defaultProcessNodeId,
      opCode: row.opCode || "",
      process: row.process || "",
      requirement: row.requirement || "",
      effect: row.effect || "",
      sev: row.sev,
      vector: row.vector || "method",
      cause: row.cause || "",
      occ: row.occ,
      pc: row.pc || "",
      dc: row.dc || "",
      pokaYoke: row.pokaYoke || "visual",
      det: row.det,
      rpn: row.rpn,
      action: row.action || "",
      ownerGate: row.ownerGate || "",
      status: row.status || "pending",
    })
  )
}

function normalizeArchiveCurrentDocumentId(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

function buildRemoteWorkspaceState(
  activeNodeId: string,
  headerFields: PfmeaHeaderFields,
  tableData: PfmeaRow[],
  archiveCurrentDocumentId: string | null = null,
): PfmeaRemoteWorkspaceState {
  return {
    module: "pfmea",
    workspaceKey: PFMEA_WORKSPACE_KEY,
    activeNodeId,
    headerFields,
    tableData,
    archiveCurrentDocumentId,
  }
}

function formatSyncLabel(prefix: string, updatedAt?: string) {
  if (!updatedAt) {
    return prefix
  }

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) {
    return prefix
  }

  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${prefix} ${hh}:${mm}`
}

function SyncStateView({
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}) {
  return (
    <div className="flex h-[calc(100vh-210px)] min-h-[780px] max-h-[calc(100vh-120px)] items-center justify-center rounded-lg border border-white/10 bg-zinc-950 px-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-400/70">Cloud Workspace</div>
        <h2 className="mt-3 text-2xl font-semibold text-zinc-100">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p>
        {actionLabel && onAction ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onAction}
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/12 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              {actionLabel}
            </button>
            {secondaryActionLabel && onSecondaryAction ? (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06]"
              >
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function PfmeaWorkspace() {
  const [activeNodeId, setActiveNodeId] = useState(defaultProcessNodeId)
  const [tableData, setTableData] = useState<PfmeaRow[]>(initialPfmeaData)
  const [headerFields, setHeaderFields] = useState<PfmeaHeaderFields>(initialHeaderFields)
  const [archiveCurrentDocumentId, setArchiveCurrentDocumentId] = useState<string | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all")
  const [searchVisible, setSearchVisible] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [visibleRows, setVisibleRows] = useState<PfmeaRow[]>([])
  const [isHydrating, setIsHydrating] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [syncStatusLabel, setSyncStatusLabel] = useState("云端同步中")
  const [syncStatusTone, setSyncStatusTone] = useState<SyncTone>("saving")

  const isMountedRef = useRef(false)
  const isRemoteSyncInFlightRef = useRef(false)
  const lastSavedPayloadRef = useRef("")
  const hasShownSaveFailureRef = useRef(false)

  const scopedData = useMemo(() => {
    if (activeNodeId === defaultProcessNodeId) {
      return tableData
    }

    const opCodes = processNodeMapping[activeNodeId] ?? []
    return tableData.filter((row) => opCodes.includes(row.opCode))
  }, [activeNodeId, tableData])

  const filteredData = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return scopedData.filter((row) => {
      const riskMatch =
        riskFilter === "all"
          ? true
          : riskFilter === "critical"
            ? isCriticalPfmeaRisk(row.sev, row.rpn)
            : riskFilter === "warning"
              ? getPfmeaRiskBand(row.sev, row.rpn) === "warning"
              : getPfmeaRiskBand(row.sev, row.rpn) === "safe"

      if (!riskMatch) {
        return false
      }

      if (!keyword) {
        return true
      }

      const corpus = [
        row.opCode,
        row.process,
        row.requirement,
        row.effect,
        row.cause,
        row.pc,
        row.dc,
        row.action,
        row.ownerGate,
      ]
        .join(" ")
        .toLowerCase()

      return corpus.includes(keyword)
    })
  }, [riskFilter, scopedData, searchTerm])

  const selectedRow = useMemo(
    () => tableData.find((row) => row.id === selectedRowId) ?? null,
    [selectedRowId, tableData]
  )

  const selectedNode = useMemo(
    () => findPfmeaNodeById(pfmeaTree, activeNodeId) ?? pfmeaTree[0],
    [activeNodeId]
  )

  const stats = useMemo(() => {
    const total = filteredData.length
    const high = filteredData.filter((row) => isCriticalPfmeaRisk(row.sev, row.rpn)).length
    const medium = filteredData.filter(
      (row) => getPfmeaRiskBand(row.sev, row.rpn) === "warning"
    ).length
    const low = filteredData.filter(
      (row) => getPfmeaRiskBand(row.sev, row.rpn) === "safe"
    ).length
    return { total, high, medium, low }
  }, [filteredData])

  const remoteWorkspaceState = useMemo(
    () =>
      buildRemoteWorkspaceState(
        activeNodeId,
        headerFields,
        tableData,
        archiveCurrentDocumentId,
      ),
    [activeNodeId, archiveCurrentDocumentId, headerFields, tableData]
  )

  const remoteWorkspaceStatePayload = useMemo(
    () => JSON.stringify(remoteWorkspaceState),
    [remoteWorkspaceState]
  )

  const applyRemoteWorkspaceState = useCallback((remoteState: PfmeaRemoteWorkspaceState | null) => {
    if (!remoteState) {
      return remoteWorkspaceStatePayload
    }

    const normalizedState = buildRemoteWorkspaceState(
      remoteState.activeNodeId || defaultProcessNodeId,
      normalizeHeaderFields(remoteState.headerFields),
      normalizeRemotePfmeaRows(remoteState.tableData),
      normalizeArchiveCurrentDocumentId(remoteState.archiveCurrentDocumentId),
    )

    setActiveNodeId(normalizedState.activeNodeId)
    setHeaderFields(normalizedState.headerFields)
    setTableData(normalizedState.tableData)
    setArchiveCurrentDocumentId(normalizedState.archiveCurrentDocumentId ?? null)
    setSelectedRowId(null)

    return JSON.stringify(normalizedState)
  }, [remoteWorkspaceStatePayload])

  const projectId = useMemo(
    () =>
      deriveFmeaProjectId({
        module: "pfmea",
        workspaceKey: PFMEA_WORKSPACE_KEY,
        headerFields,
      }),
    [headerFields],
  )

  const {
    documents: archiveDocuments,
    isLoadingDocuments: isArchiveLoading,
    isSavingVersion,
    loadingDocumentId,
    deletingDocumentId,
    refreshDocuments: refreshArchiveDocuments,
    saveAsVersion,
    loadVersion,
    deleteVersion,
  } = useFmeaOss<PfmeaRemoteWorkspaceState>({
    module: "pfmea",
    projectId,
    workspaceKey: PFMEA_WORKSPACE_KEY,
    getWorkspaceState: () =>
      buildRemoteWorkspaceState(
        activeNodeId,
        headerFields,
        tableData,
        archiveCurrentDocumentId,
      ),
    applyWorkspaceState: (nextState) => {
      applyRemoteWorkspaceState(nextState)
    },
    onCurrentDocumentChange: setArchiveCurrentDocumentId,
  })

  const syncRemoteWorkspaceState = useCallback(
    async ({
      finishHydration = false,
      silent = false,
      skipIfLocalChanges = false,
    }: {
      finishHydration?: boolean
      silent?: boolean
      skipIfLocalChanges?: boolean
    } = {}) => {
      if (isRemoteSyncInFlightRef.current) {
        return
      }

      if (skipIfLocalChanges && remoteWorkspaceStatePayload !== lastSavedPayloadRef.current) {
        return
      }

      isRemoteSyncInFlightRef.current = true

      if (!silent) {
        setSyncStatusLabel("云端同步中")
        setSyncStatusTone("saving")
      }

      try {
        const remoteState = await fetchFmeaRemoteWorkspaceState<PfmeaRemoteWorkspaceState>({
          module: "pfmea",
          workspaceKey: PFMEA_WORKSPACE_KEY,
        })

        if (!isMountedRef.current) {
          return
        }

        const normalizedPayload = applyRemoteWorkspaceState(remoteState)
        lastSavedPayloadRef.current = normalizedPayload
        hasShownSaveFailureRef.current = false
        setLoadError(null)
        setSyncStatusLabel(
          remoteState?.updatedAt
            ? formatSyncLabel("云端已同步", remoteState.updatedAt)
            : "云端未发现存档"
        )
        setSyncStatusTone(remoteState?.updatedAt ? "saved" : "neutral")
      } catch (error) {
        if (!isMountedRef.current) {
          return
        }

        const message = error instanceof Error ? error.message : "Failed to load PFMEA state"
        setSyncStatusLabel("云端同步失败")
        setSyncStatusTone("error")

        if (finishHydration) {
          setLoadError(message)
        }

        if (!silent && !finishHydration) {
          toast.error(message)
        }
      } finally {
        isRemoteSyncInFlightRef.current = false
        if (finishHydration && isMountedRef.current) {
          setIsHydrating(false)
        }
      }
    },
    [applyRemoteWorkspaceState, remoteWorkspaceStatePayload]
  )

  const persistRemoteWorkspaceState = useCallback(
    async (nextState: PfmeaRemoteWorkspaceState, nextPayload: string) => {
      setSyncStatusLabel("云端保存中")
      setSyncStatusTone("saving")

      try {
        const result = await saveFmeaRemoteWorkspaceState(nextState)

        if (!isMountedRef.current) {
          return
        }

        lastSavedPayloadRef.current = nextPayload
        hasShownSaveFailureRef.current = false
        setSyncStatusLabel(formatSyncLabel("云端已保存", result.updatedAt))
        setSyncStatusTone("saved")
      } catch (error) {
        console.error("PFMEA remote save failed:", error)

        if (!isMountedRef.current) {
          return
        }

        setSyncStatusLabel("保存失败，点此重试")
        setSyncStatusTone("error")

        if (!hasShownSaveFailureRef.current) {
          toast.error(error instanceof Error ? error.message : "PFMEA 云端保存失败")
          hasShownSaveFailureRef.current = true
        }
      }
    },
    []
  )

  useEffect(() => {
    isMountedRef.current = true
    void syncRemoteWorkspaceState({ finishHydration: true })

    return () => {
      isMountedRef.current = false
    }
  }, [syncRemoteWorkspaceState])

  useEffect(() => {
    if (selectedRowId && !filteredData.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(null)
    }
  }, [filteredData, selectedRowId])

  useEffect(() => {
    if (!searchVisible && searchTerm.length > 0) {
      setSearchVisible(true)
    }
  }, [searchTerm, searchVisible])

  useEffect(() => {
    const handleWindowFocus = () => {
      void syncRemoteWorkspaceState({
        silent: true,
        skipIfLocalChanges: true,
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      void syncRemoteWorkspaceState({
        silent: true,
        skipIfLocalChanges: true,
      })
    }

    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [syncRemoteWorkspaceState])

  useEffect(() => {
    if (isHydrating || loadError) {
      return
    }

    if (remoteWorkspaceStatePayload === lastSavedPayloadRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      void persistRemoteWorkspaceState(remoteWorkspaceState, remoteWorkspaceStatePayload)
    }, 700)

    return () => window.clearTimeout(timer)
  }, [
    isHydrating,
    loadError,
    persistRemoteWorkspaceState,
    remoteWorkspaceState,
    remoteWorkspaceStatePayload,
  ])

  const handleRetrySave = useCallback(() => {
    void persistRemoteWorkspaceState(remoteWorkspaceState, remoteWorkspaceStatePayload)
  }, [persistRemoteWorkspaceState, remoteWorkspaceState, remoteWorkspaceStatePayload])

  const handleContinueWithBlankWorkspace = useCallback(() => {
    lastSavedPayloadRef.current = remoteWorkspaceStatePayload
    setLoadError(null)
    setSyncStatusLabel("当前为空白工作区")
    setSyncStatusTone("neutral")
  }, [remoteWorkspaceStatePayload])

  const handleAddRow = useCallback(() => {
    const opCodes = processNodeMapping[activeNodeId] ?? []
    const defaultOpCode = activeNodeId === defaultProcessNodeId ? "" : opCodes[0] ?? ""
    const nextRow = createBlankPfmeaRow(defaultOpCode)

    setTableData((prev) => [nextRow, ...prev])
    setSelectedRowId(nextRow.id)
  }, [activeNodeId])

  const handleUpdateRow = useCallback(
    (
      id: string,
      field: keyof PfmeaRow,
      value: string | number
    ) => {
      setTableData((prev) =>
        prev.map((row) =>
          row.id === id
            ? finalizePfmeaRow({ ...row, [field]: value } as PfmeaRow)
            : row
        )
      )
    },
    []
  )

  const handleDeleteRow = useCallback((id: string) => {
    setTableData((prev) => prev.filter((row) => row.id !== id))
    setSelectedRowId((current) => (current === id ? null : current))
  }, [])

  const handleCycleRiskFilter = useCallback(() => {
    const sequence: RiskFilter[] = ["all", "critical", "warning", "safe"]
    setRiskFilter((current) => sequence[(sequence.indexOf(current) + 1) % sequence.length])
  }, [])

  const handleExport = useCallback(async () => {
    const exportRows = visibleRows.length > 0 ? visibleRows : filteredData

    if (exportRows.length === 0) {
      toast.error("褰撳墠娌℃湁鍙鍑虹殑 PFMEA 鏁版嵁")
      return
    }

    try {
      await exportPfmeaPdf({
        rows: exportRows,
        contextLabel: selectedNode?.label ?? "PFMEA Analysis",
        contextOwner: selectedNode?.owner ?? "-",
        activeNodeId,
        headerFields,
      })
      toast.success("PDF 宸插鍑?")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 瀵煎嚭澶辫触")
    }
  }, [
    activeNodeId,
    filteredData,
    headerFields,
    selectedNode?.label,
    selectedNode?.owner,
    visibleRows,
  ])

  const handleResetControls = useCallback(() => {
    setSearchTerm("")
    setSearchVisible(false)
    setRiskFilter("all")
  }, [])

  const handlePrint = useCallback(() => {
    const printRows = visibleRows.length > 0 ? visibleRows : filteredData

    if (printRows.length === 0) {
      toast.error("褰撳墠娌℃湁鍙墦鍗扮殑 PFMEA 鏁版嵁")
      return
    }

    try {
      printPfmeaDocument({
        rows: printRows,
        contextLabel: selectedNode?.label ?? "PFMEA Analysis",
        contextOwner: selectedNode?.owner ?? "-",
        activeNodeId,
        headerFields,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "鎵撳嵃棰勮鎵撳紑澶辫触")
    }
  }, [
    activeNodeId,
    filteredData,
    headerFields,
    selectedNode?.label,
    selectedNode?.owner,
    visibleRows,
  ])

  const criticalOpenCount = useMemo(
    () =>
      tableData.filter(
        (row) => row.status === "pending" && isCriticalPfmeaRisk(row.sev, row.rpn)
      ).length,
    [tableData]
  )

  const handleHeaderFieldChange = useCallback(
    (field: keyof PfmeaHeaderFields, value: string) => {
      setHeaderFields((current) => ({ ...current, [field]: value }))
    },
    []
  )

  if (isHydrating) {
    return (
      <SyncStateView
        title="正在同步 PFMEA 云端工作区"
        message="先从 OSS 读取最新 PFMEA 工作区快照，确认远程状态后再开放编辑。"
      />
    )
  }

  if (loadError) {
    return (
      <SyncStateView
        title="PFMEA 云端工作区加载失败"
        message={loadError}
        actionLabel="重新读取"
        onAction={() => {
          setLoadError(null)
          void syncRemoteWorkspaceState()
        }}
        secondaryActionLabel="以空白工作区继续"
        onSecondaryAction={handleContinueWithBlankWorkspace}
      />
    )
  }

  return (
    <div className="flex h-[calc(100vh-210px)] min-h-[780px] max-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
      <TopBar
        stats={stats}
        contextLabel={selectedNode?.label ?? "Manufacturing PFMEA"}
        contextOwner={selectedNode?.owner ?? "PE / ME / QE"}
        isSearchOpen={searchVisible}
        searchTerm={searchTerm}
        riskFilter={riskFilter}
        pendingCount={filteredData.filter((row) => row.status === "pending").length}
        criticalOpenCount={criticalOpenCount}
        isDrawerOpen={Boolean(selectedRow)}
        onAddRow={handleAddRow}
        onToggleSearch={() => setSearchVisible((current) => !current)}
        onSearchTermChange={setSearchTerm}
        onCycleRiskFilter={handleCycleRiskFilter}
        onExport={handleExport}
        onPrint={handlePrint}
        onResetControls={handleResetControls}
        onCloseDrawer={() => setSelectedRowId(null)}
        isArchiveOpen={isArchiveOpen}
        onOpenArchive={() => setIsArchiveOpen(true)}
        moduleLabel="PFMEA"
        moduleVersion="Process v1.0"
        searchPlaceholder="鎼滅储宸ュ簭 / 鍘熷洜 / 璐ｄ换浜?"
        syncStatusLabel={syncStatusLabel}
        syncStatusTone={syncStatusTone}
        onRetrySync={handleRetrySave}
      />
      <FmeaArchiveDrawer
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        moduleLabel="PFMEA"
        projectId={projectId}
        documents={archiveDocuments}
        isLoading={isArchiveLoading}
        isSaving={isSavingVersion}
        loadingDocumentId={loadingDocumentId}
        deletingDocumentId={deletingDocumentId}
        onRefresh={async () => {
          await refreshArchiveDocuments()
        }}
        onSaveVersion={saveAsVersion}
        onLoadVersion={loadVersion}
        onDeleteVersion={deleteVersion}
      />
      <PfmeaContextHeader fields={headerFields} onChange={handleHeaderFieldChange} />
      <div className="flex flex-1 overflow-hidden">
        <ProcessSidebar
          activeNodeId={activeNodeId}
          onSelectNode={setActiveNodeId}
          totalRows={tableData.length}
          highRiskCount={
            tableData.filter((row) => isCriticalPfmeaRisk(row.sev, row.rpn)).length
          }
        />
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <PfmeaDataGrid
            data={filteredData}
            selectedRowId={selectedRowId}
            onSelectRow={setSelectedRowId}
            onVisibleRowsChange={setVisibleRows}
            onUpdateRow={handleUpdateRow}
          />
          <PfmeaAuditDrawer
            row={selectedRow}
            onClose={() => setSelectedRowId(null)}
            onDeleteRow={handleDeleteRow}
            onUpdateRow={handleUpdateRow}
          />
        </div>
      </div>
      <StatusBar
        totalRows={tableData.length}
        filteredRows={filteredData.length}
        pendingCount={filteredData.filter((row) => row.status === "pending").length}
      />
    </div>
  )
}
