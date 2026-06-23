"use client"

import { useMemo, useState } from "react"
import { HolographicCanvas } from "@/components/holographic-canvas"
import { TelemetryInspector } from "@/components/telemetry-inspector"
import {
  CATEGORY_META,
  makeCause,
  seedMatrix,
  type Cause,
  type MatrixData,
  type Validation,
} from "@/lib/ishikawa-data"

export function AxiomSigma() {
  // ── single source of truth: the live 6M matrix ──────────────────
  const [matrix, setMatrix] = useState<MatrixData>(seedMatrix)
  const [activeDimension, setActiveDimension] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // resolve the selected cause + its parent category id from the matrix
  const selected = useMemo(() => {
    if (!selectedId) return null
    for (const cat of CATEGORY_META) {
      const cause = matrix[cat.id]?.find((c) => c.id === selectedId)
      if (cause) return { cause, category: cat }
    }
    return null
  }, [selectedId, matrix])

  // selecting a node opens its interrogation matrix AND locks the light path
  const handleSelectCause = (cause: Cause, catId: string) => {
    setSelectedId((prev) => {
      const next = prev === cause.id ? null : cause.id
      setActiveDimension(next ? catId : null)
      return next
    })
  }

  // clicking a 6M matrix card focuses the optical lockdown + opens the editor
  const handleToggleDimension = (catId: string) => {
    setActiveDimension((prev) => (prev === catId ? null : catId))
    setSelectedId(null)
  }

  // background / escape resets everything to full visibility
  const handleReset = () => {
    setSelectedId(null)
    setActiveDimension(null)
  }

  // ── CRUD: all mutations keep activeDimension intact ─────────────
  const addNode = (catId: string, label: string) => {
    const text = label.trim()
    if (!text) return
    setMatrix((prev) => ({
      ...prev,
      [catId]: [...(prev[catId] ?? []), makeCause(text)],
    }))
  }

  const updateNode = (catId: string, id: string, patch: Partial<Cause>) => {
    setMatrix((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }))
  }

  const setStatus = (catId: string, id: string, validation: Validation) =>
    updateNode(catId, id, { validation })

  const deleteNode = (catId: string, id: string) => {
    setMatrix((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).filter((c) => c.id !== id),
    }))
    // if the purged node was selected, drop back to the dimension editor
    setSelectedId((prev) => (prev === id ? null : prev))
  }

  return (
    <main className="relative flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* top status rail */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4 sm:px-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/50">
          ISHIKAWA NETWORK
          <span className="ml-2 text-cyan-200/25">/ 鱼骨根因网络</span>
        </div>
        <div className="hidden items-center gap-4 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/30 sm:flex">
          <span>NODE 8829-A</span>
          <span className="inline-flex items-center gap-1.5 text-cyan-300/50">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-cyan-400" />
            ANALYZING
          </span>
        </div>
      </div>

      {/* 70% canvas */}
      <section className="relative min-w-0 flex-1">
        <HolographicCanvas
          matrix={matrix}
          selectedId={selectedId}
          activeDimension={activeDimension}
          onSelectCause={handleSelectCause}
          onResetView={handleReset}
        />
      </section>

      {/* 30% inspector */}
      <section className="hidden h-full w-[clamp(320px,32%,440px)] shrink-0 lg:block">
        <TelemetryInspector
          matrix={matrix}
          selected={selected}
          activeDimension={activeDimension}
          onToggleDimension={handleToggleDimension}
          onSelectCause={handleSelectCause}
          onAddNode={addNode}
          onUpdateNode={updateNode}
          onSetStatus={setStatus}
          onDeleteNode={deleteNode}
          onClearSelection={handleReset}
          onExitDimension={handleReset}
        />
      </section>
    </main>
  )
}
