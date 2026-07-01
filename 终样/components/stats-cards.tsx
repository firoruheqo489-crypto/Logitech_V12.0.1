import { Progress } from "@/components/ui/progress"
import { ClipboardList, CheckCircle2, FlaskConical, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardsProps {
  total: number
  required: number
  resulted: number
  failed: number
}

function pct(part: number, whole: number) {
  if (whole === 0) return 0
  return Math.round((part / whole) * 100)
}

export function StatsCards({ total, required, resulted, failed }: StatsCardsProps) {
  const cards = [
    {
      label: "项目总数",
      value: total,
      hint: "当前类目全部测试项",
      icon: ClipboardList,
      accent: "text-zinc-100",
      iconColor: "text-cyan-300",
      ring: "border-cyan-500/30 bg-cyan-500/10",
      bar: "bg-cyan-500",
      progress: null as number | null,
      progressClass: "[&>div]:bg-cyan-400",
    },
    {
      label: "已确认需求",
      value: required,
      hint: `占比 ${pct(required, total)}%`,
      icon: CheckCircle2,
      accent: "text-emerald-400",
      iconColor: "text-emerald-400",
      ring: "border-emerald-400/30 bg-emerald-400/10",
      bar: "bg-emerald-400",
      progress: pct(required, total),
      progressClass: "[&>div]:bg-emerald-400",
    },
    {
      label: "已录入结果",
      value: resulted,
      hint: `占比 ${pct(resulted, total)}%`,
      icon: FlaskConical,
      accent: "text-cyan-300",
      iconColor: "text-cyan-300",
      ring: "border-cyan-500/30 bg-cyan-500/10",
      bar: "bg-cyan-500",
      progress: pct(resulted, total),
      progressClass: "[&>div]:bg-cyan-400",
    },
    {
      label: "不合格项",
      value: failed,
      hint: failed > 0 ? "存在不合格点" : "暂无不合格",
      icon: XCircle,
      accent: failed > 0 ? "text-rose-400" : "text-zinc-500",
      iconColor: failed > 0 ? "text-rose-400" : "text-zinc-500",
      ring: failed > 0 ? "border-rose-500/40 bg-rose-500/10" : "border-white/10 bg-white/5",
      bar: failed > 0 ? "bg-rose-500" : "bg-zinc-700",
      progress: null,
      progressClass: "",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/40 backdrop-blur-md transition-colors hover:bg-zinc-800/50",
            )}
          >
            {/* 左侧彩色指示线 (Accent bar) */}
            <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-0.5", c.bar)} />
            <div className="flex flex-col gap-3 p-5 pl-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  {c.label}
                </span>
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border",
                    c.ring,
                  )}
                >
                  <Icon className={cn("size-5", c.iconColor)} aria-hidden="true" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-3xl font-bold tabular-nums", c.accent)}>{c.value}</span>
                <span className="text-xs text-zinc-500">{c.hint}</span>
              </div>
              {c.progress !== null && (
                <Progress
                  value={c.progress}
                  className={cn("h-1.5 bg-white/10", c.progressClass)}
                  aria-label={`${c.label}进度`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
