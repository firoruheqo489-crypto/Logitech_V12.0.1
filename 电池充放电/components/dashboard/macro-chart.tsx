'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type TooltipContentProps,
} from 'recharts'
import type { CycleStat } from '@/lib/battery-data'

function MacroTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  const stat = payload[0]?.payload as CycleStat | undefined
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 p-3 font-mono text-[11px] shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <p className="text-slate-500">{'CYCLE '}{label}</p>
      <p className="mt-1 text-[#E8B84B]">{'放电容量 '}{stat?.dischargeCap.toFixed(3)}{' Ah'}</p>
      <p className={stat && stat.retention < 80 ? 'text-[#FF3C5C]' : 'text-slate-300'}>
        {'保持率 '}{stat?.retention.toFixed(1)}{'%'}
      </p>
      <p className="text-slate-400">{'内阻 '}{stat?.ir.toFixed(2)}{' mΩ'}</p>
    </div>
  )
}

export function MacroChart({ data, initialCap }: { data: CycleStat[]; initialCap: number }) {
  const eolThreshold = initialCap * 0.8

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }} className="bg-transparent">
          <defs>
            <linearGradient id="fadeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E8B84B" />
              <stop offset="100%" stopColor="#FF3C5C" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="cycle"
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            label={{
              value: 'CYCLE',
              position: 'insideBottomRight',
              fill: '#475569',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <YAxis
            domain={[0, Math.ceil(initialCap * 1.2 * 10) / 10]}
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            label={{
              value: 'Ah',
              position: 'insideTopLeft',
              fill: '#64748b',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Tooltip content={MacroTooltip} cursor={{ stroke: 'rgba(255,60,92,0.25)', strokeWidth: 1 }} />
          <ReferenceLine
            y={eolThreshold}
            stroke="#FF3C5C"
            strokeDasharray="6 4"
            label={{
              value: 'EOL 80%',
              position: 'insideBottomLeft',
              fill: '#FF3C5C',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Line
            type="monotone"
            dataKey="dischargeCap"
            name="放电容量"
            stroke="url(#fadeGradient)"
            strokeWidth={3}
            dot={{ r: 3, fill: '#000000', stroke: '#E8B84B', strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: '#FF3C5C', stroke: '#000000' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
