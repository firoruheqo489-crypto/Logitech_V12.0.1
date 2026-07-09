import { Database, Thermometer } from "lucide-react"
import { appendixTemperature, appendixPhotometric, appendixDimension } from "@/lib/report-data"

function DataTable({
  title,
  columns,
  rows,
  caption,
}: {
  title: string
  columns: string[]
  rows: string[][]
  caption?: string
}) {
  return (
    <div className="glass overflow-hidden rounded-xl">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-mono text-sm font-semibold text-foreground">{title}</h3>
        {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {columns.map((c) => (
                <th key={c} className="px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-slate-500/10">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={
                      ci === 0
                        ? "px-4 py-2 font-medium text-foreground"
                        : "px-4 py-2 font-mono text-primary/80"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AppendixData() {
  return (
    <section aria-labelledby="appendix-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-primary" aria-hidden />
        <h2 id="appendix-heading" className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Raw Telemetry · 附录实测数据
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DataTable
          title={appendixTemperature.title}
          caption={`环境温度 ${appendixTemperature.ambient} · 测试电压 ${appendixTemperature.voltage}`}
          columns={appendixTemperature.columns}
          rows={appendixTemperature.rows}
        />
        <DataTable
          title={appendixDimension.title}
          columns={appendixDimension.columns}
          rows={appendixDimension.rows}
        />
      </div>
      <DataTable
        title={appendixPhotometric.title}
        caption="各样品型号光色电实测（多数值以「/」分隔多次测量）"
        columns={appendixPhotometric.columns}
        rows={appendixPhotometric.rows}
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Thermometer className="size-3.5" aria-hidden />
        以上为已产生实测数据的项目（温升 S14、光色电 P1、尺寸重量 R11/R12），其余明细项均为未测 (N)。
      </p>
    </section>
  )
}
