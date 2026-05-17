"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { BomSidebar } from "@/components/fmea/bom-sidebar"
import { FmeaAuditDrawer } from "@/components/fmea/fmea-audit-drawer"
import {
  FmeaContextHeader,
  type FmeaHeaderFields,
} from "@/components/fmea/fmea-context-header"
import { FmeaDataGrid } from "@/components/fmea/fmea-data-grid"
import { exportFmeaPdf, printFmeaDocument } from "@/components/fmea/export-fmea-pdf"
import { StatusBar } from "@/components/fmea/status-bar"
import { TopBar } from "@/components/fmea/top-bar"
import {
  bomProcessMapping,
  createBlankRow,
  defaultBomNodeId,
  finalizeFmeaRow,
  findBomNodeById,
  getFmeaRiskBand,
  initialFmeaData,
  isCriticalFmeaRisk,
  lightingBomTree,
  type FmeaRow,
} from "@/lib/fmea-data"

type RiskFilter = "all" | "critical" | "warning" | "safe"

const initialHeaderFields: FmeaHeaderFields = {
  projectName: "",
  partNumber: "",
  owner: "",
  reviewDate: "",
}

export default function FmeaAnalysisWorkspace() {
  const [activeNodeId, setActiveNodeId] = useState(defaultBomNodeId)
  const [tableData, setTableData] = useState<FmeaRow[]>(initialFmeaData)
  const [headerFields, setHeaderFields] = useState<FmeaHeaderFields>(initialHeaderFields)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all")
  const [searchVisible, setSearchVisible] = useState(false)
  const [visibleRows, setVisibleRows] = useState<FmeaRow[]>([])

  const scopedData = useMemo(() => {
    if (activeNodeId === defaultBomNodeId) {
      return tableData
    }

    const coreSystemNodeIds = new Set([
      "driver-electrical",
      "thermal-management",
      "optical-system",
      "mechanical-enclosure",
    ])

    if (coreSystemNodeIds.has(activeNodeId)) {
      return tableData.filter((row) => row.systemId === activeNodeId)
    }

    const processes = bomProcessMapping[activeNodeId] ?? []
    return tableData.filter((row) => processes.includes(row.process))
  }, [activeNodeId, tableData])

  const filteredData = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return scopedData.filter((row) => {
      const riskMatch =
        riskFilter === "all"
          ? true
          : riskFilter === "critical"
            ? isCriticalFmeaRisk(row.sev, row.rpn)
            : riskFilter === "warning"
              ? getFmeaRiskBand(row.sev, row.rpn) === "warning"
              : getFmeaRiskBand(row.sev, row.rpn) === "safe"

      if (!riskMatch) {
        return false
      }

      if (!keyword) {
        return true
      }

      const corpus = [
        row.process,
        row.mode,
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

  const selectedNode = useMemo(
    () => findBomNodeById(lightingBomTree, activeNodeId) ?? lightingBomTree[0],
    [activeNodeId]
  )

  const stats = useMemo(() => {
    const total = filteredData.length
    const high = filteredData.filter((row) => isCriticalFmeaRisk(row.sev, row.rpn)).length
    const medium = filteredData.filter(
      (row) => getFmeaRiskBand(row.sev, row.rpn) === "warning"
    ).length
    const low = filteredData.filter(
      (row) => getFmeaRiskBand(row.sev, row.rpn) === "safe"
    ).length
    return { total, high, medium, low }
  }, [filteredData])

  const handleAddRow = useCallback(() => {
    const processes = bomProcessMapping[activeNodeId] ?? []
    const defaultProcess =
      activeNodeId === defaultBomNodeId ? "" : (processes[0] ?? "")
    const nextRow = createBlankRow(defaultProcess)

    setTableData((prev) => [nextRow, ...prev])
    setSelectedRowId(nextRow.id)
  }, [activeNodeId])

  const handleUpdateRow = useCallback(
    (
      id: string,
      field: keyof FmeaRow,
      value: string | number | string[]
    ) => {
      setTableData((prev) =>
        prev.map((row) =>
          row.id === id
            ? finalizeFmeaRow({ ...row, [field]: value } as FmeaRow)
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
      toast.error("当前没有可导出的 FMEA 数据")
      return
    }

    try {
      await exportFmeaPdf({
        rows: exportRows,
        contextLabel: selectedNode?.label ?? "FMEA Analysis",
        contextOwner: selectedNode?.owner ?? "-",
        activeNodeId,
        headerFields,
      })
      toast.success("PDF 已导出")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 导出失败")
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
      toast.error("当前没有可打印的 FMEA 数据")
      return
    }

    try {
      printFmeaDocument({
        rows: printRows,
        contextLabel: selectedNode?.label ?? "FMEA Analysis",
        contextOwner: selectedNode?.owner ?? "-",
        activeNodeId,
        headerFields,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "打印预览打开失败")
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
        (row) => row.status === "pending" && isCriticalFmeaRisk(row.sev, row.rpn)
      ).length,
    [tableData]
  )

  const handleHeaderFieldChange = useCallback(
    (field: keyof FmeaHeaderFields, value: string) => {
      setHeaderFields((current) => ({ ...current, [field]: value }))
    },
    []
  )

  return (
    <div className="flex h-[calc(100vh-210px)] min-h-[780px] max-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
      <TopBar
        stats={stats}
        contextLabel={selectedNode?.label ?? "Lighting FMEA"}
        contextOwner={selectedNode?.owner ?? "系统负责人"}
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
      />
      <FmeaContextHeader fields={headerFields} onChange={handleHeaderFieldChange} />
      <div className="flex flex-1 overflow-hidden">
        <BomSidebar
          activeNodeId={activeNodeId}
          onSelectNode={setActiveNodeId}
          totalParts={tableData.length}
          highRiskCount={
            tableData.filter((row) => isCriticalFmeaRisk(row.sev, row.rpn)).length
          }
        />
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <FmeaDataGrid
            data={filteredData}
            selectedRowId={selectedRowId}
            onSelectRow={setSelectedRowId}
            onVisibleRowsChange={setVisibleRows}
            onUpdateRow={handleUpdateRow}
          />
          <FmeaAuditDrawer
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
