import { Database, Thermometer } from "lucide-react"
import { useReportData } from "../report-data-context"

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
              {columns.map((column) => (
                <th key={column} className="px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-slate-500/10">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={
                      cellIndex === 0
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
  const {
    data: { appendixTemperature, appendixPhotometric, appendixDimension },
  } = useReportData()

  return (
    <section aria-labelledby="appendix-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="size-4 text-primary" aria-hidden />
        <h2 id="appendix-heading" className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Raw Telemetry · 附件实测数据
        </h2>
      </div>

      <div className="glass rounded-xl px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        当前看板只接入 3 个结构化附件。
        源表虽然出现附录 1 / 2 / 4 以及后续说明页，但本模块只展示与看板指标直接联动的温度、光色电、尺寸重量三部分。
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DataTable
          title={appendixTemperature.title}
          caption={`${appendixTemperature.caption} · 环境温度 ${appendixTemperature.ambient} · 测试电压 ${appendixTemperature.voltage}`}
          columns={appendixTemperature.columns}
          rows={appendixTemperature.rows}
        />
        <DataTable
          title={appendixDimension.title}
          caption={appendixDimension.caption}
          columns={appendixDimension.columns}
          rows={appendixDimension.rows}
        />
      </div>
      <DataTable
        title={appendixPhotometric.title}
        caption={appendixPhotometric.caption}
        columns={appendixPhotometric.columns}
        rows={appendixPhotometric.rows}
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Thermometer className="size-3.5" aria-hidden />
        以上字段直接映射自真实终样报告，仅保留当前看板需要的 3 个结构化附件数据列。
      </p>
    </section>
  )
}
