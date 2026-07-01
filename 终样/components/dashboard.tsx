"use client"

import { useMemo, useState } from "react"
import { testData, type TestItem } from "@/lib/test-data"
import { exportCSV, exportJSON } from "@/lib/export-utils"
import { StatsCards } from "@/components/stats-cards"
import { TestTable } from "@/components/test-table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileJson, Lightbulb } from "lucide-react"

export function Dashboard() {
  const [data, setData] = useState<TestItem[]>(testData)

  // 动态提取所有唯一类目
  const categories = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.category)))
  }, [data])

  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? "")

  // 当前类目的行
  const rows = useMemo(
    () => data.filter((d) => d.category === activeCategory),
    [data, activeCategory],
  )

  // 进度统计
  const stats = useMemo(() => {
    const total = rows.length
    const required = rows.filter((r) => r.status === "√").length
    const resulted = rows.filter((r) => r.result.trim() !== "").length
    const failed = rows.filter((r) => r.result.includes("不合格")).length
    return { total, required, resulted, failed }
  }, [rows])

  function handleUpdate(id: number, patch: Partial<TestItem>) {
    setData((prev) =>
      prev.map((row) =>
        row.category === activeCategory && row.id === id ? { ...row, ...patch } : row,
      ),
    )
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      {/* 背景纹理：极淡的网格光晕，增强工业仪表感 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60rem 40rem at 80% -10%, rgba(34,211,238,0.08), transparent), radial-gradient(50rem 40rem at 0% 0%, rgba(16,185,129,0.05), transparent)",
        }}
      />

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_20px_-4px_rgba(34,211,238,0.5)]">
              <Lightbulb className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-balance text-xl font-semibold tracking-tight text-zinc-100">
                照明 / 电器产品测试项目管理面板
              </h1>
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Multi-Category Test Project Console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportJSON(data)}
              className="border-white/10 bg-white/5 text-zinc-200 backdrop-blur-md hover:bg-white/10 hover:text-cyan-300"
            >
              <FileJson className="size-4" aria-hidden="true" />
              导出 JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(data)}
              className="border-white/10 bg-white/5 text-zinc-200 backdrop-blur-md hover:bg-white/10 hover:text-cyan-300"
            >
              <Download className="size-4" aria-hidden="true" />
              导出 CSV
            </Button>
          </div>
        </header>

        {/* 类目过滤器 */}
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label
              htmlFor="category-select"
              className="whitespace-nowrap text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              产品类目
            </label>
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger
                id="category-select"
                className="w-56 border-white/10 bg-black/50 text-zinc-100 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
              >
                <SelectValue placeholder="选择类目" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-900/95 text-zinc-100 backdrop-blur-md">
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="focus:bg-cyan-500/15 focus:text-cyan-200">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-zinc-500">
            共 <span className="font-medium text-cyan-300 tabular-nums">{categories.length}</span> 个类目 ·
            当前类目 <span className="font-medium text-cyan-300 tabular-nums">{stats.total}</span> 个测试项
          </p>
        </div>

        <StatsCards
          total={stats.total}
          required={stats.required}
          resulted={stats.resulted}
          failed={stats.failed}
        />

        <TestTable rows={rows} onUpdate={handleUpdate} />
      </main>
    </div>
  )
}
