"use client";

import { useMemo, useState } from "react";
import { HolographicCanvas } from "./holographic-canvas";
import { TelemetryInspector } from "./telemetry-inspector";
import {
  CATEGORY_META,
  TARGET,
  makeCause,
  seedMatrix,
  type Cause,
  type MatrixData,
  type TargetData,
  type Validation,
} from "./ishikawa-data";

export function AxiomSigma() {
  const [matrix, setMatrix] = useState<MatrixData>(seedMatrix);
  const [target, setTarget] = useState<TargetData>(TARGET);
  const [activeDimension, setActiveDimension] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    for (const cat of CATEGORY_META) {
      const cause = matrix[cat.id]?.find((c) => c.id === selectedId);
      if (cause) return { cause, category: cat };
    }
    return null;
  }, [selectedId, matrix]);

  const handleSelectCause = (cause: Cause, catId: string) => {
    setSelectedId((prev) => {
      const next = prev === cause.id ? null : cause.id;
      setActiveDimension(next ? catId : null);
      return next;
    });
  };

  const handleToggleDimension = (catId: string) => {
    setActiveDimension((prev) => (prev === catId ? null : catId));
    setSelectedId(null);
  };

  const handleReset = () => {
    setSelectedId(null);
    setActiveDimension(null);
  };

  const addNode = (catId: string, label: string) => {
    const text = label.trim();
    if (!text) return;
    setMatrix((prev) => ({ ...prev, [catId]: [...(prev[catId] ?? []), makeCause(text)] }));
  };

  const updateNode = (catId: string, id: string, patch: Partial<Cause>) => {
    setMatrix((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const setStatus = (catId: string, id: string, validation: Validation) => updateNode(catId, id, { validation });

  const deleteNode = (catId: string, id: string) => {
    setMatrix((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).filter((c) => c.id !== id),
    }));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  const updateTarget = (patch: Partial<TargetData>) => {
    setTarget((prev) => ({ ...prev, ...patch }));
  };

  return (
    <main className="relative flex w-full min-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-[28px] border border-white/6 bg-background text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.45)]">
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

      <section className="relative h-[min(76vh,980px)] min-h-[720px] w-full border-b border-white/5">
        <HolographicCanvas
          matrix={matrix}
          target={target}
          selectedId={selectedId}
          activeDimension={activeDimension}
          onSelectCause={handleSelectCause}
          onResetView={handleReset}
        />
      </section>

      <section className="relative w-full">
        <TelemetryInspector
          matrix={matrix}
          target={target}
          selected={selected}
          activeDimension={activeDimension}
          onToggleDimension={handleToggleDimension}
          onSelectCause={handleSelectCause}
          onAddNode={addNode}
          onUpdateNode={updateNode}
          onSetStatus={setStatus}
          onDeleteNode={deleteNode}
          onUpdateTarget={updateTarget}
          onClearSelection={handleReset}
          onExitDimension={handleReset}
        />
      </section>
    </main>
  );
}
