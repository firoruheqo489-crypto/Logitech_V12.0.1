import { AlertTriangle, Unplug, ShieldOff, Snowflake } from "lucide-react"

const risks = [
  {
    icon: Unplug,
    level: "逻辑断点",
    title: "带病闯关 · P8 产品功能",
    body: "测试结果填写「未提供适配器」，核心功能在无基础供电条件下未验证，报告仍进入终样流转 —— 前端物料齐套率管理失控。",
    tags: ["P8", "物料齐套"],
  },
  {
    icon: Snowflake,
    level: "极高风险",
    title: "可靠性真空 · R1–R7 全部 N",
    body: "高低温、盐雾、震动等全部环境及寿命测试未执行。终样阶段跳过验证，等于将物理失效与客诉成本直接后移至量产或市场端。",
    tags: ["R1–R7", "寿命验证"],
  },
  {
    icon: ShieldOff,
    level: "安全敞口",
    title: "安规防线虚设 · S6 / S9 / S12",
    body: "接触电流、接地保护、绝缘电阻等人身安全关键防御节点未见闭环数据。一旦市场发生电击事故，充满 N 的报告无法提供免责背书。",
    tags: ["S6", "S9", "S12"],
  },
]

export function RiskPanel() {
  return (
    <section aria-labelledby="risk-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-fail" aria-hidden />
        <h2 id="risk-heading" className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Risk Containment · 核心风险敞口
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {risks.map(({ icon: Icon, level, title, body, tags }) => (
          <div
            key={title}
            className="glass overflow-hidden rounded-xl border-fail/35 shadow-[0_0_32px_-12px_var(--fail)] transition-all duration-300 hover:shadow-[0_0_40px_-10px_var(--fail)]"
          >
            <div className="flex items-center gap-2 border-b border-fail/25 bg-fail/[0.06] px-4 py-2.5">
              <span
                className="size-2 rounded-full bg-fail shadow-[0_0_10px_var(--fail)]"
                style={{ animation: "status-pulse 1.6s ease-in-out infinite" }}
                aria-hidden
              />
              <Icon className="size-4 text-fail" aria-hidden />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fail">
                {level}
              </span>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-fail/25 bg-fail/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-fail"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
