"use client"

import { useState, useMemo, useCallback } from "react"
import { TopBar } from "@/components/fmea/top-bar"
import { BomSidebar } from "@/components/fmea/bom-sidebar"
import { FmeaDataGrid } from "@/components/fmea/fmea-data-grid"
import { StatusBar } from "@/components/fmea/status-bar"
import {
  type FmeaRow,
  initialFmeaData,
  bomProcessMapping,
  createBlankRow,
  calculateRpn,
  calculateAp,
} from "@/lib/fmea-data"

export default function FmeaAnalysisWorkspace() {
  /* ── Lifted State: BOM selection ── */
  const [activeNodeId, setActiveNodeId] = useState("asm-001")
  
  /* ── Lifted State: FMEA table data ── */
  const [tableData, setTableData] = useState<FmeaRow[]>(initialFmeaData)
  
  /* ── Filter data based on BOM selection ── */
  const filteredData = useMemo(() => {
    const processes = bomProcessMapping[activeNodeId]
    if (!processes || processes.length === 0) {
      return tableData // Root node shows all
    }
    return tableData.filter((row) => processes.includes(row.process))
  }, [activeNodeId, tableData])
  
  /* ── Calculate stats from current filtered view ── */
  const stats = useMemo(() => {
    const total = filteredData.length
    const high = filteredData.filter((r) => r.rpn >= 100).length
    const medium = filteredData.filter((r) => r.rpn >= 50 && r.rpn < 100).length
    const low = filteredData.filter((r) => r.rpn < 50).length
    return { total, high, medium, low }
  }, [filteredData])
  
  /* ── Add new row handler ── */
  const handleAddRow = useCallback(() => {
    const processes = bomProcessMapping[activeNodeId]
    const defaultProcess = processes && processes.length === 1 ? processes[0] : ""
    const newRow = createBlankRow(defaultProcess)
    setTableData((prev) => [newRow, ...prev])
  }, [activeNodeId])
  
  /* ── Update row handler (for inline editing) ── */
  const handleUpdateRow = useCallback((id: string, field: keyof FmeaRow, value: string | number) => {
    setTableData((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        
        const updated = { ...row, [field]: value }
        
        // Recalculate RPN if S/O/D changed
        if (field === "sev" || field === "occ" || field === "det") {
          updated.rpn = calculateRpn(updated.sev, updated.occ, updated.det)
          updated.ap = calculateAp(updated.rpn)
        }
        
        // Recalculate RPN2 if S2/O2/D2 changed
        if (field === "sev2" || field === "occ2" || field === "det2") {
          updated.rpn2 = calculateRpn(updated.sev2, updated.occ2, updated.det2)
        }
        
        return updated
      })
    )
  }, [])
  
  /* ── Delete row handler ── */
  const handleDeleteRow = useCallback((id: string) => {
    setTableData((prev) => prev.filter((row) => row.id !== id))
  }, [])

  return (
    <div className="flex h-[calc(100vh-300px)] min-h-[620px] max-h-[820px] flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.36)]">
      <TopBar stats={stats} onAddRow={handleAddRow} />
      <div className="flex flex-1 overflow-hidden">
        <BomSidebar
          activeNodeId={activeNodeId}
          onSelectNode={setActiveNodeId}
          totalParts={tableData.length}
          highRiskCount={tableData.filter((r) => r.rpn >= 100).length}
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
        pendingCount={filteredData.filter((r) => r.status === "pending").length}
      />
    </div>
  )
}
