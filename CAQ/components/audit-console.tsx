"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  ClipboardCheck,
  ImageIcon,
  FileText,
  UploadCloud,
  Trash2,
  BrainCircuit,
  ShieldCheck,
  Eye,
  EyeOff,
  Crosshair,
  Wrench,
  Save,
  RotateCcw,
  Archive,
  Layers,
  CloudUpload,
  Loader2,
  History,
  FilterX,
  Inbox,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/* 数据模型 & 枚举                                                      */
/* ------------------------------------------------------------------ */

export type RootCause =
  | "wrong-model"
  | "boundary-confusion"
  | "calculation-error"
  | "concept-blindspot"
  | ""

export interface AuditRecord {
  id: string
  imageUrl: string | null // 云端图片链接（测试阶段为 createObjectURL 伪在线链接）
  textParam: string // 题干补充参数
  category: string // 战区分类
  myLogic: string // 我的推演
  correctAnswer: string // 标准协议
  rootCause: RootCause // 错误根因
  action: string // 纠偏指令
  timestamp: number // 创建时间
}

interface CategoryOption {
  value: string
  label: string
  tier: "核心" | "常规" | "边缘"
}

const CATEGORIES: CategoryOption[] = [
  { value: "math-engine", label: "三大分布与数学引擎", tier: "核心" },
  { value: "fmea-fta", label: "FMEA 与 FTA 风险推演", tier: "核心" },
  { value: "system-modeling", label: "系统可靠度建模", tier: "核心" },
  { value: "test-accel", label: "试验体系与加速模型", tier: "核心" },
  { value: "rcm", label: "维修性、可用性与 RCM", tier: "常规" },
  { value: "fracas", label: "可靠性管理与 FRACAS", tier: "常规" },
  { value: "six-quality", label: "六性泛读与防呆设计", tier: "边缘" },
]

const ROOT_CAUSES: { value: Exclude<RootCause, "">; label: string; code: string }[] = [
  { value: "wrong-model", label: "模型错配", code: "WRONG MODEL" },
  { value: "boundary-confusion", label: "边界混淆", code: "BOUNDARY CONFUSION" },
  { value: "calculation-error", label: "计算失误", code: "CALCULATION ERROR" },
  { value: "concept-blindspot", label: "概念盲区", code: "CONCEPT BLINDSPOT" },
]

const TIER_STYLES: Record<CategoryOption["tier"], string> = {
  核心: "bg-primary/15 text-primary border-primary/30",
  常规: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  边缘: "bg-muted text-muted-foreground border-border",
}

function categoryMeta(value: string): CategoryOption | undefined {
  return CATEGORIES.find((c) => c.value === value)
}

function rootCauseMeta(value: RootCause) {
  return ROOT_CAUSES.find((r) => r.value === value)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY = {
  textParam: "",
  category: "",
  myLogic: "",
  correctAnswer: "",
  rootCause: "" as RootCause,
  action: "",
}

/* ------------------------------------------------------------------ */
/* 主控制台（单文件结构，仅维护 React 内存状态）                          */
/* ------------------------------------------------------------------ */

export function AuditConsole() {
  // 云端归档记录（内存态，模拟云端安全区）
  const [records, setRecords] = useState<AuditRecord[]>([])

  // 左侧图片
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)

  // 表单字段
  const [textParam, setTextParam] = useState("")
  const [category, setCategory] = useState("")
  const [myLogic, setMyLogic] = useState("")
  const [correctAnswer, setCorrectAnswer] = useState("")
  const [rootCause, setRootCause] = useState<RootCause>("")
  const [action, setAction] = useState("")

  // 交互态
  const [showAnswer, setShowAnswer] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    return () => {
      if (imageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  /* ---------------- 图片处理 ---------------- */
  const processFile = useCallback((file: File | undefined | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("仅接受图片格式", { description: "请上传考题截图 / 故障树 / 公式图纸" })
      return
    }
    const url = URL.createObjectURL(file) // 模拟云端 OSS 伪在线链接
    setImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return url
    })
    setImageName(file.name)
  }, [])

  const clearImage = useCallback(() => {
    setImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return null
    })
    setImageName(null)
  }, [])

  /* ---------------- 工作台重置 ---------------- */
  const resetWorkspace = useCallback(() => {
    clearImage()
    setTextParam(EMPTY.textParam)
    setCategory(EMPTY.category)
    setMyLogic(EMPTY.myLogic)
    setCorrectAnswer(EMPTY.correctAnswer)
    setRootCause(EMPTY.rootCause)
    setAction(EMPTY.action)
    setShowAnswer(false)
    setEditingId(null)
  }, [clearImage])

  /* ---------------- 异步保存（模拟云端 API） ---------------- */
  const saveRecord = useCallback(async () => {
    // 异步校验阻断
    if (!category) {
      toast.warning("知识战区未锁定", { description: "请先选择本题归属的战区分类" })
      return
    }
    if (!rootCause) {
      toast.warning("错误根因未锁定", { description: "请归类本次失误的核心症结" })
      return
    }

    setIsSyncing(true)
    // 模拟网络延迟 1 秒
    await new Promise((r) => setTimeout(r, 1000))

    const record: AuditRecord = {
      id: editingId ?? (crypto.randomUUID?.() ?? String(Date.now())),
      imageUrl,
      textParam,
      category,
      myLogic,
      correctAnswer,
      rootCause,
      action,
      timestamp: Date.now(),
    }

    setRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id)
      if (exists) return prev.map((r) => (r.id === record.id ? record : r))
      return [record, ...prev]
    })

    setIsSyncing(false)
    resetWorkspace()
    toast.success("数据已同步至云端安全区", {
      description: editingId ? "二次复盘切片已覆盖更新" : "新审计切片已归档至阿里云 OSS",
    })
  }, [category, rootCause, editingId, imageUrl, textParam, myLogic, correctAnswer, action, resetWorkspace])

  /* ---------------- 历史切片：加载 / 销毁 ---------------- */
  const loadRecord = useCallback(
    (rec: AuditRecord) => {
      clearImage()
      setImageUrl(rec.imageUrl)
      setImageName(rec.imageUrl ? "云端归档图像" : null)
      setTextParam(rec.textParam)
      setCategory(rec.category)
      setMyLogic(rec.myLogic)
      setCorrectAnswer(rec.correctAnswer)
      setRootCause(rec.rootCause)
      setAction(rec.action)
      setShowAnswer(false)
      setEditingId(rec.id)
      setHistoryOpen(false)
      toast.info("切片已载入工作台", { description: "进入二次复盘模式，保存将覆盖原记录" })
    },
    [clearImage],
  )

  const deleteRecord = useCallback(
    (id: string) => {
      setRecords((prev) => prev.filter((r) => r.id !== id))
      if (editingId === id) setEditingId(null)
      toast.success("切片已物理销毁", { description: "该记录已从云端安全区移除" })
    },
    [editingId],
  )

  const handleCategoryChange = useCallback((value: string | null) => {
    setCategory(value ?? "")
  }, [])

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* 顶部状态栏 */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ClipboardCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-mono text-sm font-semibold tracking-tight text-foreground">
              CAQ 可靠性工程师 · 错题审计台
            </h1>
            <p className="hidden font-mono text-xs text-muted-foreground sm:block">
              CLOUD-NATIVE · 阿里云 OSS 云端安全区 · ERROR AUDIT CONSOLE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 font-mono text-xs text-muted-foreground md:flex">
            <span className="inline-block size-2 rounded-full bg-primary" aria-hidden="true" />
            已归档切片
            <span className="rounded bg-secondary px-2 py-0.5 font-semibold text-foreground tabular-nums">
              {records.length}
            </span>
          </div>

          {/* 历史切片抽屉 */}
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 bg-transparent" />
              }
            >
              <History className="size-4" />
              <span className="hidden sm:inline">已归档切片</span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary tabular-nums">
                {records.length}
              </span>
            </SheetTrigger>
            <HistoryDrawer records={records} onLoad={loadRecord} onDelete={deleteRecord} />
          </Sheet>
        </div>
      </header>

      {/* 二次复盘提示条 */}
      {editingId && (
        <div className="flex shrink-0 items-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs text-primary sm:px-6">
          <RotateCcw className="size-3.5" />
          二次复盘模式 · 保存将覆盖原归档切片
        </div>
      )}

      {/* 左右分栏主体 */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 左侧 40% 客观事实区 */}
        <section className="flex min-h-0 w-full flex-col border-b border-border lg:w-2/5 lg:border-b-0 lg:border-r">
          <PanelHeader index="01" title="客观事实区" subtitle="QUESTION BOX" icon={<ImageIcon className="size-4" />} />
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {imageUrl ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 truncate font-mono text-xs text-muted-foreground">
                    <CloudUpload className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{imageName ?? "云端图像"}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearImage}
                    className="h-7 shrink-0 gap-1.5 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    清除图片
                  </Button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl || "/placeholder.svg"}
                    alt="考题截图预览"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  processFile(e.dataTransfer.files?.[0])
                }}
                className={`flex min-h-64 flex-1 flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/30 hover:border-primary/60 hover:bg-secondary/50"
                }`}
              >
                <UploadCloud className={`size-10 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">拖拽考题截图至此处</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    或点击选取本地文件 · 上传后自动同步至云端 OSS
                  </p>
                </div>
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                processFile(e.target.files?.[0])
                e.target.value = ""
              }}
            />

            {/* 题干补充 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <FileText className="size-3.5" />
                题干补充 · 关键参数
              </label>
              <Textarea
                value={textParam}
                onChange={(e) => setTextParam(e.target.value)}
                placeholder="粘贴题目关键文字参数，例如：λ=0.001 /h，t=1000 h，要求计算系统可靠度 R(t)..."
                className="min-h-24 resize-none bg-secondary/40 font-mono text-sm leading-relaxed"
              />
            </div>
          </div>
        </section>

        {/* 右侧 60% 逻辑审计区 */}
        <section className="flex min-h-0 w-full flex-col lg:w-3/5">
          <PanelHeader index="02" title="逻辑审计区" subtitle="AUDIT BOX" icon={<BrainCircuit className="size-4" />} />
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
            {/* 知识战区锁定 */}
            <FieldBlock
              icon={<Layers className="size-3.5" />}
              label="知识战区锁定 · CATEGORY"
              hint="必填项：锁定本题归属的知识战区，便于聚类复盘"
            >
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="h-10 w-full bg-secondary/40 font-mono text-sm">
                  <SelectValue placeholder="— 选择知识战区 —" />
                </SelectTrigger>
                <SelectContent>
                  {(["核心", "常规", "边缘"] as const).map((tier) => (
                    <SelectGroup key={tier}>
                      <SelectLabel className="font-mono uppercase tracking-wide">[{tier}]</SelectLabel>
                      {CATEGORIES.filter((c) => c.tier === tier).map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>

            {/* 我的推演 */}
            <FieldBlock
              icon={<BrainCircuit className="size-3.5" />}
              label="我的推演 · MY LOGIC"
              hint="完整记录解题思路、所用公式与推导步骤"
            >
              <Textarea
                value={myLogic}
                onChange={(e) => setMyLogic(e.target.value)}
                placeholder="还原当时的思考路径：选用了哪个可靠性模型？如何代入参数？在哪一步产生了分歧..."
                className="min-h-36 resize-none bg-secondary/40 font-mono text-sm leading-relaxed"
              />
            </FieldBlock>

            {/* 标准协议 */}
            <FieldBlock
              icon={<ShieldCheck className="size-3.5" />}
              label="标准协议 · CORRECT ANSWER"
              hint="默认隐藏底牌，完成独立推演后再揭示"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnswer((s) => !s)}
                  className="h-7 gap-1.5 px-2 text-xs"
                >
                  {showAnswer ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {showAnswer ? "隐藏底牌" : "展示底牌"}
                </Button>
              }
            >
              <div className="relative">
                <Textarea
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="录入标准解题协议与正确结论..."
                  className={`min-h-28 resize-none bg-secondary/40 font-mono text-sm leading-relaxed transition-all ${
                    showAnswer ? "" : "blur-sm select-none"
                  }`}
                  tabIndex={showAnswer ? 0 : -1}
                />
                {!showAnswer && (
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
                    className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-background/30 font-mono text-xs text-muted-foreground"
                  >
                    <EyeOff className="size-4" />
                    底牌已封存 · 点击揭示
                  </button>
                )}
              </div>
            </FieldBlock>

            {/* 错误根因锁定 */}
            <FieldBlock
              icon={<Crosshair className="size-3.5" />}
              label="错误根因锁定 · ROOT CAUSE"
              hint="必填项：归类本次失误的核心症结"
            >
              <RadioGroup
                value={rootCause}
                onValueChange={(v) => setRootCause(v as RootCause)}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {ROOT_CAUSES.map((rc) => {
                  const active = rootCause === rc.value
                  return (
                    <label
                      key={rc.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/60"
                      }`}
                    >
                      <RadioGroupItem value={rc.value} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{rc.label}</p>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{rc.code}</p>
                      </div>
                    </label>
                  )
                })}
              </RadioGroup>
            </FieldBlock>

            {/* 纠偏指令 */}
            <FieldBlock
              icon={<Wrench className="size-3.5" />}
              label="纠偏指令 · CORRECTIVE ACTION"
              hint="输出下次遭遇同类题型的规避策略"
            >
              <Textarea
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="制定可执行的规避动作，例如：见到「串并联系统」先画框图标注冗余结构，再判定模型，禁止凭直觉套公式..."
                className="min-h-28 resize-none bg-secondary/40 font-mono text-sm leading-relaxed"
              />
            </FieldBlock>
          </div>

          {/* 底部操作栏 */}
          <div className="flex shrink-0 items-center gap-3 border-t border-border bg-card/60 px-5 py-3">
            <Button onClick={saveRecord} disabled={isSyncing} className="flex-1 gap-2 font-medium">
              {isSyncing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  正在同步云端...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  {editingId ? "覆盖归档切片" : "保存当前切片"}
                </>
              )}
            </Button>
            <Button
              onClick={resetWorkspace}
              variant="outline"
              disabled={isSyncing}
              className="flex-1 gap-2 bg-transparent font-medium"
            >
              <RotateCcw className="size-4" />
              清空操作台
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* 历史切片抽屉                                                          */
/* ------------------------------------------------------------------ */

function HistoryDrawer({
  records,
  onLoad,
  onDelete,
}: {
  records: AuditRecord[]
  onLoad: (rec: AuditRecord) => void
  onDelete: (id: string) => void
}) {
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterRootCause, setFilterRootCause] = useState<string>("all")

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const catOk = filterCategory === "all" || r.category === filterCategory
      const rcOk = filterRootCause === "all" || r.rootCause === filterRootCause
      return catOk && rcOk
    })
  }, [records, filterCategory, filterRootCause])

  const resetFilters = () => {
    setFilterCategory("all")
    setFilterRootCause("all")
  }

  const handleFilterCategoryChange = useCallback((value: string | null) => {
    setFilterCategory(value ?? "all")
  }, [])

  const handleFilterRootCauseChange = useCallback((value: string | null) => {
    setFilterRootCause(value ?? "all")
  }, [])

  return (
    <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
      <SheetHeader className="border-b border-border p-4">
        <SheetTitle className="flex items-center gap-2 font-mono">
          <Archive className="size-4 text-primary" />
          已归档切片 · CLOUD ARCHIVE
        </SheetTitle>
        <SheetDescription>云端安全区共 {records.length} 条审计记录 · 点击载入二次复盘</SheetDescription>
      </SheetHeader>

      {/* 过滤器 */}
      <div className="flex flex-col gap-2 border-b border-border bg-card/40 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Select value={filterCategory} onValueChange={handleFilterCategoryChange}>
            <SelectTrigger className="h-8 w-full bg-secondary/40 text-xs">
              <SelectValue placeholder="战区分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部战区</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRootCause} onValueChange={handleFilterRootCauseChange}>
            <SelectTrigger className="h-8 w-full bg-secondary/40 text-xs">
              <SelectValue placeholder="错误根因" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部根因</SelectItem>
              {ROOT_CAUSES.map((rc) => (
                <SelectItem key={rc.value} value={rc.value}>
                  {rc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterCategory !== "all" || filterRootCause !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 w-fit gap-1.5 self-end px-2 text-xs text-muted-foreground"
          >
            <FilterX className="size-3.5" />
            清除过滤 · 命中 {filtered.length} 条
          </Button>
        )}
      </div>

      {/* 列表 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <Inbox className="size-10 opacity-40" />
            <p className="font-mono text-xs">
              {records.length === 0 ? "云端安全区暂无归档切片" : "当前过滤条件下无命中记录"}
            </p>
          </div>
        ) : (
          filtered.map((rec) => {
            const cat = categoryMeta(rec.category)
            const rc = rootCauseMeta(rec.rootCause)
            return (
              <div
                key={rec.id}
                className="group rounded-md border border-border bg-secondary/30 p-3 transition-colors hover:border-primary/50 hover:bg-secondary/50"
              >
                <button type="button" onClick={() => onLoad(rec)} className="w-full text-left">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatTime(rec.timestamp)}
                    </span>
                    {rec.imageUrl && (
                      <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                        <ImageIcon className="size-3" />
                        OSS
                      </span>
                    )}
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {cat && (
                      <Badge variant="outline" className={`text-[10px] ${TIER_STYLES[cat.tier]}`}>
                        {cat.label}
                      </Badge>
                    )}
                    {rc && (
                      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
                        {rc.label}
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 font-mono text-xs leading-relaxed text-muted-foreground">
                    {rec.myLogic || rec.textParam || "（无推演记录）"}
                  </p>
                </button>

                <div className="mt-2 flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        />
                      }
                    >
                      <Trash2 className="size-3.5" />
                      物理销毁
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认物理销毁该切片？</AlertDialogTitle>
                        <AlertDialogDescription>
                          此操作将从云端安全区永久移除该审计记录，无法恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => onDelete(rec.id)}>
                          确认销毁
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })
        )}
      </div>
    </SheetContent>
  )
}

/* ------------------------------------------------------------------ */
/* 复用小组件                                                           */
/* ------------------------------------------------------------------ */

function PanelHeader({
  index,
  title,
  subtitle,
  icon,
}: {
  index: string
  title: string
  subtitle: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/60 px-5 py-3">
      <span className="font-mono text-xs font-bold text-primary">{index}</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle}</span>
    </div>
  )
}

function FieldBlock({
  icon,
  label,
  hint,
  action,
  children,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wide text-foreground">
            <span className="text-primary">{icon}</span>
            {label}
          </span>
          <p className="mt-0.5 pl-5 text-xs text-muted-foreground">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
