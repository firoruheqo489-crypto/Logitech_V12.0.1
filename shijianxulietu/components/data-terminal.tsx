'use client'

import { useMemo, useState } from 'react'
import { Terminal, Zap, Database, Code2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BiLabel } from '@/components/bi-label'
import { generateRawRecords, type RawRecord } from '@/lib/series-data'

const SAMPLE_PAYLOAD = `{
  "source": "NODE-07",
  "timestamp": "2026-06-09T14:32:08Z",
  "raw_val": 5821,
  "tags": ["telemetry", "live"]
}`

const statusStyle: Record<RawRecord['status'], { text: string; dot: string; label: string }> = {
  NOMINAL: { text: 'text-positive', dot: 'bg-positive', label: '正常' },
  SYNCED: { text: 'text-cyan', dot: 'bg-cyan', label: '已同步' },
  WARNING: { text: 'text-alert', dot: 'bg-alert', label: '警告' },
  CRITICAL: { text: 'text-negative', dot: 'bg-negative', label: '严重' },
}

export function DataTerminal() {
  const initial = useMemo(() => generateRawRecords(44), [])
  const [rows, setRows] = useState<RawRecord[]>(initial)
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD)
  const [injecting, setInjecting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const inject = () => {
    setInjecting(true)
    setFeedback(null)
    try {
      const parsed = JSON.parse(payload)
      const rawVal = Number(parsed.raw_val ?? parsed.rawVal ?? Math.round(4000 + Math.random() * 3000))
      const newRow: RawRecord = {
        id: `0x${Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        source: String(parsed.source ?? 'MANUAL'),
        rawVal,
        delta: Number(((Math.random() - 0.4) * 8).toFixed(2)),
        status: 'SYNCED',
      }
      setTimeout(() => {
        setRows((prev) => [newRow, ...prev])
        setInjecting(false)
        setFeedback({ ok: true, msg: `录入成功 // PAYLOAD INJECTED · ${newRow.id}` })
      }, 600)
    } catch {
      setInjecting(false)
      setFeedback({ ok: false, msg: '解析失败 // INVALID JSON PAYLOAD' })
    }
  }

  return (
    <section className="glass glow-border relative overflow-hidden rounded-xl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-cyan" strokeWidth={1.5} />
          <h3 className="font-cn text-sm font-bold text-foreground">
            原始数据工作区
            <span className="ml-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              RAW&middot;DATA&middot;TERMINAL
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-pulse-dot absolute inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
            </span>
            {rows.length} 条记录 RECORDS
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-[30%_70%]">
        {/* LEFT: Data injection */}
        <div className="bg-background/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-purple" strokeWidth={1.5} />
            <BiLabel zh="数据注入" en="DATA INJECTION" size="sm" zhClassName="text-purple text-glow-purple" />
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute left-0 top-0 flex h-full w-7 flex-col items-center gap-[3px] border-r border-border/60 bg-black/30 py-2.5 font-mono text-[9px] text-muted-foreground/50">
              {payload.split('\n').map((_, i) => (
                <span key={i}>{String(i + 1).padStart(2, '0')}</span>
              ))}
            </div>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
              aria-label="数据载荷输入 Payload input"
              className="h-44 w-full resize-none rounded-lg border border-cyan/20 bg-black/50 py-2.5 pl-9 pr-3 font-mono text-xs leading-relaxed text-cyan shadow-[inset_0_0_24px_rgba(0,243,255,0.06)] outline-none transition-all placeholder:text-muted-foreground focus:border-cyan/50 focus:shadow-[inset_0_0_24px_rgba(0,243,255,0.12),0_0_18px_rgba(0,243,255,0.18)]"
              placeholder="// 在此粘贴 JSON / CSV 载荷..."
            />
          </div>

          <div className="mt-2 flex items-center gap-2 font-mono text-[9px] tracking-widest text-muted-foreground">
            <Database className="h-3 w-3" strokeWidth={1.5} />
            <span>格式 FORMAT: JSON / CSV</span>
            <span className="ml-auto text-cyan/60">{payload.length} 字节 B</span>
          </div>

          <button
            onClick={inject}
            disabled={injecting}
            className="group relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-cyan/50 bg-cyan/10 py-2.5 font-mono text-xs font-medium tracking-widest text-cyan transition-all hover:bg-cyan/20 hover:shadow-[0_0_24px_rgba(0,243,255,0.4)] disabled:opacity-60"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            {injecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Zap className="h-4 w-4" strokeWidth={1.5} />
            )}
            <span className="font-cn font-bold">录入数据</span>
            <span className="opacity-70">INJECT PAYLOAD</span>
          </button>

          {feedback && (
            <div
              className={cn(
                'mt-2 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px]',
                feedback.ok
                  ? 'border-positive/30 bg-positive/5 text-positive'
                  : 'border-negative/30 bg-negative/5 text-negative',
              )}
            >
              {feedback.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {feedback.msg}
            </div>
          )}
        </div>

        {/* RIGHT: Raw data grid */}
        <div className="bg-background/20">
          <div className="grid-scroll max-h-[360px] overflow-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#0a0e15] backdrop-blur">
                  <Th zh="录入时间" en="TIMESTAMP" />
                  <Th zh="数据源" en="SOURCE" />
                  <Th zh="原始值" en="RAW_VAL" align="right" />
                  <Th zh="偏差率" en="DELTA" align="right" />
                  <Th zh="状态" en="STATUS" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const s = statusStyle[r.status]
                  return (
                    <tr
                      key={r.id + i}
                      className={cn(
                        'border-b border-border/40 transition-colors hover:bg-cyan/[0.06]',
                        i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.012]',
                        i === 0 && injecting === false && feedback?.ok && 'animate-pulse-row',
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">
                        <span className="text-cyan/40">{r.id}</span>
                        <span className="ml-2 text-secondary-foreground">{r.timestamp}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-border bg-black/40 px-1.5 py-0.5 text-[10px] tracking-wider text-cyan/80">
                          {r.source}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {r.rawVal.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums',
                          r.delta >= 0 ? 'text-positive' : 'text-negative',
                        )}
                      >
                        {r.delta >= 0 ? '+' : ''}
                        {r.delta.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('flex items-center gap-1.5', s.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                          <span className="font-cn text-[11px]">{s.label}</span>
                          <span className="text-[9px] opacity-60">{r.status}</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function Th({ zh, en, align = 'left' }: { zh: string; en: string; align?: 'left' | 'right' }) {
  return (
    <th
      className={cn(
        'border-b border-cyan/20 px-3 py-2.5 font-normal',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <span className={cn('flex flex-col leading-none', align === 'right' && 'items-end')}>
        <span className="font-cn text-[11px] font-bold text-secondary-foreground">{zh}</span>
        <span className="font-mono text-[8px] tracking-[0.16em] text-muted-foreground">{en}</span>
      </span>
    </th>
  )
}
