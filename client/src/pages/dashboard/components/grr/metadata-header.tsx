'use client'

import { GlassPanel } from './glass-panel'

export interface StudyMeta {
  partName: string
  characteristic: string
  gageId: string
  date: string
}

interface Props {
  meta: StudyMeta
  onChange: (patch: Partial<StudyMeta>) => void
}

function MetaField({
  label,
  zh,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  label: string
  zh: string
  value: string
  placeholder?: string
  type?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-baseline gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-400">
        {label}
        <span className="font-medium normal-case tracking-normal text-zinc-500">{zh}</span>
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-sky-400/50 focus:bg-sky-400/[0.06]"
      />
    </label>
  )
}

export function MetadataHeader({ meta, onChange }: Props) {
  return (
    <GlassPanel className="print-keep px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-100">Study Traceability</span>
        <span className="text-[10px] font-medium text-zinc-400">研究追溯信息</span>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <MetaField
          label="Part Name"
          zh="零件名称"
          value={meta.partName}
          placeholder="Top Shell Component"
          onChange={(v) => onChange({ partName: v })}
        />
        <MetaField
          label="Characteristic"
          zh="测量特性"
          value={meta.characteristic}
          placeholder="Dimension Width (mm)"
          onChange={(v) => onChange({ characteristic: v })}
        />
        <MetaField
          label="Gage ID"
          zh="量具编号"
          value={meta.gageId}
          placeholder="CAL-9942"
          onChange={(v) => onChange({ gageId: v })}
        />
        <MetaField
          label="Date"
          zh="日期"
          type="date"
          value={meta.date}
          onChange={(v) => onChange({ date: v })}
        />
      </div>
    </GlassPanel>
  )
}
