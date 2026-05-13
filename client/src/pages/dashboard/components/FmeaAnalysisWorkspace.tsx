"use client"

import { useCallback, useMemo, useState } from "react"

import { BomSidebar } from "@/components/fmea/bom-sidebar"
import { FmeaDataGrid } from "@/components/fmea/fmea-data-grid"
import { StatusBar } from "@/components/fmea/status-bar"
import { TopBar } from "@/components/fmea/top-bar"
import {
  bomProcessMapping,
  createBlankRow,
  defaultBomNodeId,
  finalizeFmeaRow,
  findBomNodeById,
  initialFmeaData,
  lightingBomTree,
  type FmeaRow,
} from "@/lib/fmea-data"

export default function FmeaAnalysisWorkspace() {
  const [activeNodeId, setActiveNodeId] = useState(defaultBomNodeId)
  const [tableData, setTableData] = useState<FmeaRow[]>(initialFmeaData)

  const filteredData = useMemo(() => {
    const processes = bomProcessMapping[activeNodeId] ?? []
    if (processes.length === 0) {
      return tableData
    }

    return tableData.filter((row) => processes.includes(row.process))
  }, [activeNodeId, tableData])

  const selectedNode = useMemo(
    () => findBomNodeById(lightingBomTree, activeNodeId) ?? lightingBomTree[0],
    [activeNodeId]
  )

  const stats = useMemo(() => {
    const total = filteredData.length
    const high = filteredData.filter((row) => row.rpn >= 100).length
    const medium = filteredData.filter((row) => row.rpn >= 50 && row.rpn < 100).length
    const low = filteredData.filter((row) => row.rpn < 50).length
    return { total, high, medium, low }
  }, [filteredData])

  const handleAddRow = useCallback(() => {
    const processes = bomProcessMapping[activeNodeId] ?? []
    const defaultProcess =
      activeNodeId === defaultBomNodeId ? "" : (processes[0] ?? "")

    setTableData((prev) => [createBlankRow(defaultProcess), ...prev])
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
  }, [])

  return (
    <div className="flex h-[calc(100vh-300px)] min-h-[640px] max-h-[840px] flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
      <TopBar
        stats={stats}
        contextLabel={selectedNode?.label ?? "照明行业 FMEA"}
        contextOwner={selectedNode?.owner ?? "系统工程"}
        onAddRow={handleAddRow}
      />
      <div className="flex flex-1 overflow-hidden">
        <BomSidebar
          activeNodeId={activeNodeId}
          onSelectNode={setActiveNodeId}
          totalParts={tableData.length}
          highRiskCount={tableData.filter((row) => row.rpn >= 100).length}
        />
        <FmeaDataGrid
          data={filteredData}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
        />
      </div>
      <StatusBar
        totalRows={tableData.length}
        filteredRows={filteredData.length}
        pendingCount={filteredData.filter((row) => row.status === "pending").length}
      />
    </div>
  )
}
