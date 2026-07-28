import {
  CircleDot,
  Zap,
  ClipboardCheck,
  ImageIcon,
  ShieldCheck,
  User,
  CalendarDays,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StatusPill } from "@/components/status-pill"
import { IK_ENERGY_MAP, type IKTestData } from "@/lib/ik-test-data"

export function IKDashboard({
  data,
  pdfUrl,
}: {
  data: IKTestData
  pdfUrl?: string | null
}) {
  const { equipment, target, energy, result, appendix } = data
  const isPass = result.finalResult === "PASS"

  return (
    <section aria-label="IK 试验解析结果" className="bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-8 md:px-8 md:pb-10">
        {/* 顶部标题栏 */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              IK 冲击试验质量看板
            </div>
            <h1 className="text-balance text-2xl font-semibold leading-tight md:text-3xl">
              {target.sampleName}
            </h1>
            <p className="text-sm text-muted-foreground">
              型号 {target.model} · 试验部位 {target.testPart} · 等级{" "}
              {target.selectedIKLevel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={isPass ? "default" : "destructive"}
              className={
                isPass
                  ? "h-9 bg-success px-4 text-sm text-success-foreground"
                  : "h-9 px-4 text-sm"
              }
            >
              最终判定 · {result.finalResult}
            </Badge>
          </div>
        </header>

        <Separator />

        {/* 关键指标概览 */}
        <section
          aria-label="关键指标"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <MetricCard
            icon={<CircleDot className="size-5" aria-hidden="true" />}
            label="冲击设备"
            value={equipment.name}
            sub={`落高 ${equipment.dropHeight}`}
          />
          <MetricCard
            icon={<Zap className="size-5" aria-hidden="true" />}
            label="冲击能量"
            value={`${energy.impactEnergyJ.toFixed(1)} J`}
            sub={`${energy.ikLevel} 对应能量`}
            highlight
          />
          <MetricCard
            icon={<ClipboardCheck className="size-5" aria-hidden="true" />}
            label="防护等级"
            value={target.selectedIKLevel}
            sub={`试验部位 ${target.testPart}`}
          />
          <MetricCard
            icon={<ShieldCheck className="size-5" aria-hidden="true" />}
            label="试验结论"
            value={result.finalResult}
            sub={isPass ? "满足要求" : "不满足要求"}
            success={isPass}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左列：设备 + 能量映射 */}
          <div className="flex flex-col gap-6">
            {/* 钢球设备（图1） */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <CircleDot className="size-4 text-primary" aria-hidden="true" />
                  冲击设备（钢球）
                </CardTitle>
                <CardDescription>图1 · 试验装置选择</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4">
                <InfoRow label="设备名称" value={equipment.name} />
                <InfoRow label="规格" value={equipment.specification} />
                <InfoRow label="落球高度" value={equipment.dropHeight} />
                <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                  <span className="text-sm text-muted-foreground">选用状态</span>
                  <span className="text-sm font-medium text-success">已选用</span>
                </div>
              </CardContent>
            </Card>

            {/* 能量映射（图3） */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-4 text-primary" aria-hidden="true" />
                  IK 等级 ↔ 能量映射
                </CardTitle>
                <CardDescription>图3 · 高亮为当前选中等级</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-4">
                {IK_ENERGY_MAP.map((item) => {
                  const active = item.level === energy.ikLevel
                  return (
                    <div
                      key={item.level}
                      className={
                        active
                          ? "flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-4 py-3"
                          : "flex items-center justify-between rounded-lg border border-border px-4 py-3"
                      }
                    >
                      <span
                        className={
                          active
                            ? "text-sm font-semibold text-primary"
                            : "text-sm text-muted-foreground"
                        }
                      >
                        {item.level}
                      </span>
                      <span
                        className={
                          active
                            ? "font-mono text-sm font-semibold text-primary"
                            : "font-mono text-sm text-muted-foreground"
                        }
                      >
                        {item.joules.toFixed(1)} J
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* 中列：判定状态（图2） */}
          <Card className="lg:col-span-1">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
                判定状态
              </CardTitle>
              <CardDescription>
                图2 · 未勾选项保留为原始状态
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              <StatusPill label="是否损坏" value={target.status.isDamaged} />
              <StatusPill
                label="是否影响防水"
                value={target.status.affectsWaterproof}
              />
              <StatusPill
                label="是否影响绝缘"
                value={target.status.affectsInsulation}
              />
              <StatusPill
                label="是否影响功能"
                value={target.status.affectsFunction}
              />
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                虚线框为原始表单中未勾选的判定项，看板如实呈现漏勾选状态，不做默认值填充。
              </p>
            </CardContent>
          </Card>

          {/* 右列：签核 + 附录 */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <User className="size-4 text-primary" aria-hidden="true" />
                  签核信息
                </CardTitle>
                <CardDescription>试验与审核记录</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4">
                <SignRow
                  role="试验人"
                  name={result.tester}
                  date={result.testDate}
                />
                <SignRow
                  role="审核人"
                  name={result.reviewer}
                  date={result.reviewDate}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="size-4 text-primary" aria-hidden="true" />
                  附录图片
                </CardTitle>
                <CardDescription>{appendix.caption}</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <div className="flex items-start gap-3">
                    <ImageIcon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">
                        {appendix.hasImage ? "已识别到附录图片" : "未识别到附录图片"}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {appendix.caption}
                      </p>
                    </div>
                  </div>
                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-accent"
                    >
                      查看原始 PDF
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  highlight,
  success,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  highlight?: boolean
  success?: boolean
}) {
  return (
    <Card
      className={
        highlight
          ? "border-primary/40 bg-primary/5"
          : success
            ? "border-success/40 bg-success/5"
            : undefined
      }
    >
      <CardContent className="flex flex-col gap-2 py-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className={
              highlight
                ? "text-primary"
                : success
                  ? "text-success"
                  : "text-muted-foreground"
            }
          >
            {icon}
          </span>
          <span className="text-sm">{label}</span>
        </div>
        <div
          className={
            highlight
              ? "text-2xl font-semibold text-primary"
              : success
                ? "text-2xl font-semibold text-success"
                : "text-2xl font-semibold"
          }
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function SignRow({
  role,
  name,
  date,
}: {
  role: string
  name: string
  date: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{role}</span>
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="size-4" aria-hidden="true" />
        <span className="font-mono">{date}</span>
      </div>
    </div>
  )
}
