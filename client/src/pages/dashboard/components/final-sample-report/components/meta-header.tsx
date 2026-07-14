import { useRef, useState } from "react"
import {
  Calendar,
  Cpu,
  FileSpreadsheet,
  FlaskConical,
  Hash,
  LoaderCircle,
  Package,
  Radio,
  RefreshCcw,
  Trash2,
  Upload,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useReportData } from "../report-data-context"

export function MetaHeader() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const {
    data: { meta },
    isLoading,
    sourceName,
    sourceKind,
    importWorkbook,
    resetToEmbeddedWorkbook,
    clearReportData,
  } = useReportData()

  const anchors = [
    { icon: Hash, label: "OA 流程编号", value: meta.oaNumber, mono: true, highlight: true },
    { icon: Package, label: "产品型号", value: meta.productModel, mono: true },
    { icon: Calendar, label: "检测日期", value: meta.testDate, mono: true },
    { icon: FlaskConical, label: "样品数量", value: meta.sampleCount, mono: true },
    { icon: User, label: "申请人 / 部门", value: meta.applicant, mono: false },
  ]

  const handleImport = async (file: File) => {
    await importWorkbook(file)
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await handleImport(file)
    event.target.value = ""
  }

  const sourceStatusLabel =
    sourceKind === "uploaded" ? "已接入真实 Excel" : sourceKind === "empty" ? "等待载入 Excel" : "内置样例，待替换"

  return (
    <header className="space-y-4">
      <section className="glass rounded-2xl p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            void handleFileChange(event)
          }}
        />

        <div
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragActive(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragActive(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            const nextTarget = event.relatedTarget
            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
            setIsDragActive(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragActive(false)
            const file = event.dataTransfer.files?.[0]
            if (!file) return
            void handleImport(file)
          }}
          className={cn(
            "mt-2 rounded-2xl border border-dashed p-2.5 transition-all duration-300",
            isDragActive
              ? "border-primary/70 bg-primary/10 shadow-[0_0_30px_-12px_var(--primary)]"
              : "border-border bg-card/20",
          )}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-primary/25 bg-primary/[0.055] px-4 py-3 text-left transition hover:border-primary/45 hover:bg-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              </div>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-foreground">
                  选择终样报告 Excel 并解析
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  支持 .xlsx / .xls，也可以把文件拖到这里
                </span>
              </span>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-primary/25 bg-background/30 px-3 py-1.5 font-mono text-[11px] text-primary md:inline-flex">
              <Upload className="size-3" />
              上传解析
            </span>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void resetToEmbeddedWorkbook()
              }}
              disabled={isLoading || sourceKind === "embedded"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition hover:border-primary/25 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw className="size-3" />
              恢复内置样例
            </button>
            <button
              type="button"
              onClick={clearReportData}
              disabled={isLoading || sourceKind === "empty"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-fail/25 bg-fail/10 px-2.5 py-1 font-mono text-[11px] text-fail transition hover:bg-fail/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-3" />
              清空数据
            </button>
          </div>
        </div>
      </section>

      <div className="glass overflow-hidden rounded-2xl">
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
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-balance font-mono text-lg font-semibold leading-tight tracking-tight text-foreground md:text-xl">
                  {meta.title}
                </h1>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]",
                    sourceKind === "uploaded"
                      ? "border-pass/30 bg-pass/10 text-pass"
                      : sourceKind === "empty"
                        ? "border-untested/30 bg-untested/10 text-untested-foreground"
                        : "border-primary/25 bg-primary/10 text-primary",
                  )}
                >
                  {sourceStatusLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.subtitle}</p>
              <p className="mt-1 font-mono text-[11px] text-primary/80">
                数据源：{sourceName} · {sourceKind === "uploaded" ? "当前数据来自用户上传文件" : "请上传真实终样报告 Excel 后再进入归档"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5">
            <Radio className="size-3.5 text-primary" aria-hidden />
            <span className="font-mono text-xs text-primary/90">
              ENV {meta.environment.temp} / {meta.environment.humidity}
            </span>
          </div>
        </div>

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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border px-6 py-3 font-mono text-[11px] text-muted-foreground">
          <span>
            测试 / 日期：<span className="text-foreground/90">{meta.tester} · {meta.testerDate}</span>
          </span>
          <span>
            审核 / 日期：<span className="text-foreground/90">{meta.reviewer} · {meta.reviewerDate}</span>
          </span>
        </div>
      </div>
    </header>
  )
}
