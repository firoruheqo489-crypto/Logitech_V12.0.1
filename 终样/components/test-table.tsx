"use client"

import type { RequirementStatus, TestItem } from "@/lib/test-data"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TestTableProps {
  rows: TestItem[]
  onUpdate: (id: number, patch: Partial<TestItem>) => void
}

function isFail(result: string) {
  return result.includes("不合格")
}

function ResultBadge({ result }: { result: string }) {
  const base =
    "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wider"
  if (!result.trim()) {
    return <span className={cn(base, "border-white/10 bg-white/5 text-zinc-500")}>未录入</span>
  }
  if (isFail(result)) {
    return <span className={cn(base, "border-rose-500/50 bg-rose-500/10 text-rose-400")}>不合格</span>
  }
  return (
    <span className={cn(base, "border-emerald-400/30 bg-emerald-400/10 text-emerald-400")}>合格</span>
  )
}

const inputClass =
  "h-8 border-white/10 bg-black/50 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-1 focus-visible:ring-cyan-500/50"

export function TestTable({ rows, onUpdate }: TestTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/40 text-sm text-zinc-500 backdrop-blur-md">
        请选择一个类目以查看测试项目
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/40 backdrop-blur-md">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 bg-zinc-900/60 hover:bg-zinc-900/60">
            <TableHead className="w-16 text-center text-xs font-medium uppercase tracking-wider text-zinc-400">
              序号
            </TableHead>
            <TableHead className="min-w-52 text-xs font-medium uppercase tracking-wider text-zinc-400">
              测试项目
            </TableHead>
            <TableHead className="w-40 text-center text-xs font-medium uppercase tracking-wider text-zinc-400">
              是否需求
            </TableHead>
            <TableHead className="min-w-72 text-xs font-medium uppercase tracking-wider text-zinc-400">
              测试结果
            </TableHead>
            <TableHead className="min-w-48 text-xs font-medium uppercase tracking-wider text-zinc-400">
              备注
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-white/5">
          {rows.map((row) => {
            const required = row.status === "√"
            const fail = isFail(row.result)
            return (
              <TableRow
                key={row.id}
                className={cn(
                  "border-0 transition-colors hover:bg-zinc-800/50",
                  fail && "bg-rose-500/5",
                )}
              >
                <TableCell className="text-center font-medium tabular-nums text-zinc-500">
                  {row.id}
                </TableCell>
                <TableCell className="font-medium text-zinc-100">{row.item}</TableCell>

                {/* 是否需求：开关 + 状态选择 */}
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={required}
                      onCheckedChange={(checked) =>
                        onUpdate(row.id, { status: (checked ? "√" : "×") as RequirementStatus })
                      }
                      aria-label={`${row.item} 是否需求`}
                      className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-zinc-700"
                    />
                    <Select
                      value={row.status || "×"}
                      onValueChange={(v) => onUpdate(row.id, { status: v as RequirementStatus })}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-16 border-white/10 bg-black/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50",
                          required ? "text-emerald-400" : "text-zinc-500",
                        )}
                        aria-label="需求状态"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-zinc-900/95 text-zinc-100 backdrop-blur-md">
                        <SelectItem value="√" className="text-emerald-400 focus:bg-emerald-400/10">
                          √
                        </SelectItem>
                        <SelectItem value="×" className="text-zinc-400 focus:bg-white/10">
                          ×
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>

                {/* 测试结果及不合格点 */}
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <ResultBadge result={row.result} />
                    <Input
                      value={row.result}
                      placeholder="录入测试结果或不合格点…"
                      onChange={(e) => onUpdate(row.id, { result: e.target.value })}
                      className={cn(inputClass, fail && "border-rose-500/50 text-rose-300")}
                    />
                  </div>
                </TableCell>

                {/* 备注 */}
                <TableCell>
                  <Input
                    value={row.comment}
                    placeholder="备注…"
                    onChange={(e) => onUpdate(row.id, { comment: e.target.value })}
                    className={inputClass}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
