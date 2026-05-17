"use client"

import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type FmeaHeaderFieldKey = "projectName" | "partNumber" | "owner" | "reviewDate"

export type FmeaHeaderFields = Record<FmeaHeaderFieldKey, string>

const headerItems: Array<{
  key: FmeaHeaderFieldKey
  label: string
  placeholder: string
  type?: "text" | "date"
}> = [
  { key: "projectName", label: "项目名称", placeholder: "输入 FMEA 项目名称" },
  { key: "partNumber", label: "料号 / 型号", placeholder: "输入 Part No. 或 Model" },
  { key: "owner", label: "责任部门", placeholder: "输入系统工程 / DQE / 项目负责人" },
  { key: "reviewDate", label: "评审日期", placeholder: "", type: "date" },
]

interface FmeaContextHeaderProps {
  fields: FmeaHeaderFields
  onChange: (field: FmeaHeaderFieldKey, value: string) => void
}

function parseStoredDate(value: string) {
  if (!value) return undefined

  const [year, month, day] = value.split("-").map((part) => Number(part))

  if (!year || !month || !day) {
    return undefined
  }

  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatStoredDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value: string) {
  const date = parseStoredDate(value)

  if (!date) {
    return "选择日期"
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}/${month}/${day}`
}

export function FmeaContextHeader({ fields, onChange }: FmeaContextHeaderProps) {
  return (
    <section className="shrink-0 border-b border-white/8 bg-[linear-gradient(180deg,rgba(10,13,19,0.98)_0%,rgba(10,13,19,0.9)_100%)] px-4 py-1.5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_2px_rgba(0,0,0,0.28),0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[0.22em] text-cyan-400/70">
              Header
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-zinc-100">
              FMEA 表头信息
            </p>
          </div>
          <div className="hidden rounded-full border border-cyan-500/15 bg-cyan-500/8 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-cyan-300/80 lg:block">
            DQE Style
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 xl:grid-cols-4">
          {headerItems.map((item) => {
            if (item.key === "reviewDate") {
              return (
                <label key={item.key} className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-zinc-300">
                    {item.label}
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8.5 w-full items-center justify-between rounded-xl border border-white/8 bg-black/35 px-3 text-[12px] text-zinc-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)] outline-none transition-all hover:border-cyan-400/25 hover:bg-black/45 focus:border-cyan-400/45 focus:bg-black/45 focus:shadow-[0_0_0_3px_rgba(0,229,255,0.12),0_0_20px_rgba(0,229,255,0.08),inset_0_2px_4px_rgba(0,0,0,0.28)]"
                      >
                        <span className={fields.reviewDate ? "text-zinc-100" : "text-zinc-500"}>
                          {formatDisplayDate(fields.reviewDate)}
                        </span>
                        <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-auto rounded-2xl border-white/10 bg-[#0f131b] p-0 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                    >
                      <Calendar
                        mode="single"
                        selected={parseStoredDate(fields.reviewDate)}
                        onSelect={(date) => {
                          if (!date) return
                          onChange("reviewDate", formatStoredDate(date))
                        }}
                        className="rounded-2xl bg-transparent p-3"
                        classNames={{
                          month_caption: "text-sm font-medium text-zinc-100",
                          weekday: "text-[11px] text-zinc-500",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </label>
              )
            }

            return (
              <label key={item.key} className="space-y-1.5">
                <span className="block text-[11px] font-medium text-zinc-300">{item.label}</span>
                <input
                  type={item.type ?? "text"}
                  value={fields[item.key]}
                  onChange={(event) => onChange(item.key, event.target.value)}
                  placeholder={item.placeholder}
                  className="h-8.5 w-full rounded-xl border border-white/8 bg-black/35 px-3 text-[12px] text-zinc-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)] outline-none transition-all placeholder:text-zinc-500 focus:border-cyan-400/45 focus:bg-black/45 focus:shadow-[0_0_0_3px_rgba(0,229,255,0.12),0_0_20px_rgba(0,229,255,0.08),inset_0_2px_4px_rgba(0,0,0,0.28)]"
                />
              </label>
            )
          })}
        </div>
      </div>
    </section>
  )
}
