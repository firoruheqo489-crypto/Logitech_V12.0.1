import { Cpu, Calendar, User, Package, Hash, FlaskConical, Radio } from "lucide-react"
import { meta } from "@/lib/report-data"

const anchors = [
  { icon: Hash, label: "OA 流程编号", value: meta.oaNumber, mono: true, highlight: true },
  { icon: Package, label: "产品型号", value: meta.productModel, mono: true },
  { icon: Calendar, label: "检测日期", value: meta.testDate, mono: true },
  { icon: FlaskConical, label: "样品数量", value: meta.sampleCount, mono: true },
  { icon: User, label: "申请人 / 部门", value: meta.applicant, mono: false },
]

export function MetaHeader() {
  return (
    <header className="glass overflow-hidden rounded-2xl">
      {/* 服务器刀片面板顶栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
            <Cpu className="size-5 text-primary" aria-hidden />
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-pass shadow-[0_0_8px_var(--pass)]"
              style={{ animation: "status-pulse 1.8s ease-in-out infinite" }}
              aria-hidden
            />
          </div>
          <div>
            <h1 className="text-balance font-mono text-lg font-semibold leading-tight tracking-tight text-foreground md:text-xl">
              {meta.title}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{meta.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5">
          <Radio className="size-3.5 text-primary" aria-hidden />
          <span className="font-mono text-xs text-primary/90">
            ENV {meta.environment.temp} / {meta.environment.humidity}
          </span>
        </div>
      </div>

      {/* 确权字段栅格 */}
      <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 lg:grid-cols-5">
        {anchors.map(({ icon: Icon, label, value, mono, highlight }) => (
          <div key={label} className="min-w-0 bg-card/40 px-5 py-4">
            <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Icon className="size-3.5" aria-hidden />
              {label}
            </dt>
            <dd
              className={`mt-1.5 truncate text-sm font-medium ${mono ? "font-mono" : ""} ${
                highlight ? "text-primary" : "text-foreground/90"
              }`}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* 签署脚注 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border px-6 py-3 font-mono text-[11px] text-muted-foreground">
        <span>
          测试 / 日期：<span className="text-foreground/90">{meta.tester} · {meta.testerDate}</span>
        </span>
        <span>
          审核 / 日期：<span className="text-foreground/90">{meta.reviewer} · {meta.reviewerDate}</span>
        </span>
      </div>
    </header>
  )
}
