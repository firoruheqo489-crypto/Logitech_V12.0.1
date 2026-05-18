"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

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
import { StatusBar } from "@/components/fmea/status-bar"
import { TopBar } from "@/components/fmea/top-bar"
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

const initialHeaderFields: PfmeaHeaderFields = {
  projectName: "",
  partNumber: "",
  owner: "",
  reviewDate: "",
}

export default function PfmeaWorkspace() {
  const [activeNodeId, setActiveNodeId] = useState(defaultProcessNodeId)
  const [tableData, setTableData] = useState<PfmeaRow[]>(initialPfmeaData)
  const [headerFields, setHeaderFields] = useState<PfmeaHeaderFields>(initialHeaderFields)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all")
  const [searchVisible, setSearchVisible] = useState(false)
  const [visibleRows, setVisibleRows] = useState<PfmeaRow[]>([])

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
      toast.error("当前没有可导出的 PFMEA 数据")
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
      toast.error("当前没有可打印的 PFMEA 数据")
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
        moduleLabel="PFMEA"
        moduleVersion="Process v1.0"
        searchPlaceholder="搜索工序 / 原因 / 责任人"
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
