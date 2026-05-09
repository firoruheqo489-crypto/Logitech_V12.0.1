"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Download,
  GitBranch,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Branch = "top" | "bottom"
type TemplateId = "manufacturing" | "software" | "blank"

interface Cause {
  id: string
  text: string
}

interface Category {
  id: string
  title: string
  titleEn: string
  branch: Branch
  causes: Cause[]
}

interface DiagramState {
  templateId: TemplateId
  problem: string
  impact: string
  rootCause: string
  categories: Category[]
}

interface TemplateCategory {
  title: string
  titleEn: string
  branch: Branch
  causes: string[]
}

interface TemplateDefinition {
  id: TemplateId
  name: string
  description: string
  problem: string
  impact: string
  rootCause: string
  categories: TemplateCategory[]
}

const STORAGE_KEY = "yugu-fishbone-diagram-v1"
const MAX_VISIBLE_CAUSES = 5

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: "manufacturing",
    name: "5M1E",
    description: "面向制造与质量异常的标准鱼骨图模板。",
    problem: "注塑件良率下降，连续三批次出现毛边与尺寸漂移。",
    impact: "返工率上升，交付节拍被拉长，客户投诉风险增加。",
    rootCause: "初步怀疑是工艺窗口收窄，与设备状态和换班执行差异叠加有关。",
    categories: [
      {
        title: "人员",
        titleEn: "Man",
        branch: "top",
        causes: ["换班交接不完整", "新员工参数理解偏差", "巡检频次不稳定"],
      },
      {
        title: "设备",
        titleEn: "Machine",
        branch: "top",
        causes: ["锁模压力波动", "模温机响应滞后", "顶针磨损未及时更换"],
      },
      {
        title: "材料",
        titleEn: "Material",
        branch: "top",
        causes: ["原料含水率偏高", "回料比例超标", "批次黏度差异较大"],
      },
      {
        title: "方法",
        titleEn: "Method",
        branch: "bottom",
        causes: ["保压切换点未复核", "首件确认流程跳步", "异常闭环时间过长"],
      },
      {
        title: "测量",
        titleEn: "Measurement",
        branch: "bottom",
        causes: ["量具校准临期", "抽检样本过少", "判定标准解释不一致"],
      },
      {
        title: "环境",
        titleEn: "Environment",
        branch: "bottom",
        causes: ["夜班温湿度波动", "料房干燥等待过久", "现场照明不足影响目检"],
      },
    ],
  },
  {
    id: "software",
    name: "研发复盘",
    description: "适合线上事故、缺陷复盘与交付问题分析。",
    problem: "发布后用户无法提交关键表单，转换率明显下滑。",
    impact: "核心流程中断，客服工单增加，紧急回滚占用研发资源。",
    rootCause: "更像是需求、实现、验证和发布协同失效，而不只是单点代码错误。",
    categories: [
      {
        title: "需求",
        titleEn: "Requirement",
        branch: "top",
        causes: ["异常路径未写入验收标准", "字段兼容规则未明确", "灰度范围定义模糊"],
      },
      {
        title: "设计",
        titleEn: "Design",
        branch: "top",
        causes: ["状态流转遗漏回退场景", "接口契约未锁定", "容错策略只覆盖理想路径"],
      },
      {
        title: "代码",
        titleEn: "Code",
        branch: "top",
        causes: ["表单校验与后端规则不一致", "特性开关默认值错误", "边界数据未加保护"],
      },
      {
        title: "测试",
        titleEn: "Testing",
        branch: "bottom",
        causes: ["回归用例缺少首单场景", "联调环境样本过于单一", "自动化断言未覆盖失败态"],
      },
      {
        title: "发布",
        titleEn: "Release",
        branch: "bottom",
        causes: ["变更说明未同步客服", "监控告警阈值过宽", "回滚预案未提前演练"],
      },
      {
        title: "协作",
        titleEn: "Collaboration",
        branch: "bottom",
        causes: ["值班响应链路不清晰", "问题升级路径滞后", "复盘结论未回流模板"],
      },
    ],
  },
  {
    id: "blank",
    name: "空白模板",
    description: "从零开始搭建分类和原因，更适合开放式头脑风暴。",
    problem: "把这里改成你要分析的问题。",
    impact: "补充现象、影响范围或客户感知，方便统一讨论边界。",
    rootCause: "记录目前最值得验证的假设，后续可以持续修订。",
    categories: [
      {
        title: "分类 1",
        titleEn: "Category 1",
        branch: "top",
        causes: ["待补充原因"],
      },
      {
        title: "分类 2",
        titleEn: "Category 2",
        branch: "top",
        causes: ["待补充原因"],
      },
      {
        title: "分类 3",
        titleEn: "Category 3",
        branch: "bottom",
        causes: ["待补充原因"],
      },
      {
        title: "分类 4",
        titleEn: "Category 4",
        branch: "bottom",
        causes: ["待补充原因"],
      },
    ],
  },
]

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function createCause(text = ""): Cause {
  return {
    id: makeId("cause"),
    text,
  }
}

function materializeTemplate(templateId: TemplateId): DiagramState {
  const template =
    TEMPLATE_DEFINITIONS.find((item) => item.id === templateId) ??
    TEMPLATE_DEFINITIONS[0]

  return {
    templateId: template.id,
    problem: template.problem,
    impact: template.impact,
    rootCause: template.rootCause,
    categories: template.categories.map((category) => ({
      id: makeId("category"),
      title: category.title,
      titleEn: category.titleEn,
      branch: category.branch,
      causes: category.causes.map((cause) => createCause(cause)),
    })),
  }
}

function normalizeState(input: unknown): DiagramState | null {
  if (!input || typeof input !== "object") {
    return null
  }

  const candidate = input as Partial<DiagramState>
  if (!Array.isArray(candidate.categories) || typeof candidate.problem !== "string") {
    return null
  }

  const templateId = TEMPLATE_DEFINITIONS.some(
    (item) => item.id === candidate.templateId,
  )
    ? (candidate.templateId as TemplateId)
    : "manufacturing"

  const categories = candidate.categories
    .map((category, index) => {
      if (!category || typeof category !== "object") {
        return null
      }

      const value = category as Partial<Category>
      const title =
        typeof value.title === "string" && value.title.trim().length > 0
          ? value.title
          : `分类 ${index + 1}`

      return {
        id: typeof value.id === "string" ? value.id : makeId("category"),
        title,
        titleEn: typeof value.titleEn === "string" ? value.titleEn : "",
        branch: value.branch === "bottom" ? "bottom" : "top",
        causes: Array.isArray(value.causes)
          ? value.causes
              .map((cause) => {
                if (!cause || typeof cause !== "object") {
                  return null
                }

                const causeValue = cause as Partial<Cause>
                return {
                  id: typeof causeValue.id === "string" ? causeValue.id : makeId("cause"),
                  text: typeof causeValue.text === "string" ? causeValue.text : "",
                }
              })
              .filter((cause): cause is Cause => cause !== null)
          : [],
      }
    })
    .filter((category): category is Category => category !== null)

  if (categories.length === 0) {
    return null
  }

  return {
    templateId,
    problem: candidate.problem,
    impact: typeof candidate.impact === "string" ? candidate.impact : "",
    rootCause: typeof candidate.rootCause === "string" ? candidate.rootCause : "",
    categories,
  }
}

function getAnchorPositions(count: number, start: number, end: number) {
  if (count <= 0) {
    return []
  }

  if (count === 1) {
    return [(start + end) / 2]
  }

  const step = (end - start) / (count - 1)
  return Array.from({ length: count }, (_, index) => start + step * index)
}

function getNextBranch(categories: Category[]): Branch {
  const topCount = categories.filter((category) => category.branch === "top").length
  const bottomCount = categories.length - topCount
  return topCount <= bottomCount ? "top" : "bottom"
}

function getBranchLabel(branch: Branch) {
  return branch === "top" ? "上支路" : "下支路"
}

function getSelectedCategory(categories: Category[], selectedCategoryId: string) {
  return (
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null
  )
}

export default function FishboneDiagram() {
  const [diagram, setDiagram] = useState<DiagramState>(() =>
    materializeTemplate("manufacturing"),
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let normalized: DiagramState | null = null

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      normalized = saved ? normalizeState(JSON.parse(saved)) : null
    } catch {
      normalized = null
    }

    const nextState = normalized ?? materializeTemplate("manufacturing")

    setDiagram(nextState)
    setSelectedCategoryId(nextState.categories[0]?.id ?? "")
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) {
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram))
  }, [diagram, isReady])

  useEffect(() => {
    if (!diagram.categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(diagram.categories[0]?.id ?? "")
    }
  }, [diagram.categories, selectedCategoryId])

  const selectedCategory = getSelectedCategory(diagram.categories, selectedCategoryId)

  const totalCauses = useMemo(
    () =>
      diagram.categories.reduce((count, category) => count + category.causes.length, 0),
    [diagram.categories],
  )

  const topCategories = useMemo(
    () => diagram.categories.filter((category) => category.branch === "top"),
    [diagram.categories],
  )
  const bottomCategories = useMemo(
    () => diagram.categories.filter((category) => category.branch === "bottom"),
    [diagram.categories],
  )

  const template = useMemo(
    () =>
      TEMPLATE_DEFINITIONS.find((item) => item.id === diagram.templateId) ??
      TEMPLATE_DEFINITIONS[0],
    [diagram.templateId],
  )

  const updateDiagram = (updater: (current: DiagramState) => DiagramState) => {
    setDiagram((current) => updater(current))
  }

  const applyTemplate = (templateId: TemplateId) => {
    const nextState = materializeTemplate(templateId)
    setDiagram(nextState)
    setSelectedCategoryId(nextState.categories[0]?.id ?? "")
  }

  const updateCategory = (
    categoryId: string,
    updater: (category: Category) => Category,
  ) => {
    updateDiagram((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? updater(category) : category,
      ),
    }))
  }

  const addCategory = () => {
    updateDiagram((current) => {
      const index = current.categories.length + 1
      const nextCategory: Category = {
        id: makeId("category"),
        title: `分类 ${index}`,
        titleEn: `Category ${index}`,
        branch: getNextBranch(current.categories),
        causes: [createCause("待补充原因")],
      }

      const categories = [...current.categories, nextCategory]
      setSelectedCategoryId(nextCategory.id)

      return {
        ...current,
        categories,
      }
    })
  }

  const removeCategory = (categoryId: string) => {
    updateDiagram((current) => {
      if (current.categories.length <= 2) {
        return current
      }

      return {
        ...current,
        categories: current.categories.filter((category) => category.id !== categoryId),
      }
    })
  }

  const addCause = (categoryId: string) => {
    updateCategory(categoryId, (category) => ({
      ...category,
      causes: [...category.causes, createCause("待补充原因")],
    }))
  }

  const deleteCause = (categoryId: string, causeId: string) => {
    updateCategory(categoryId, (category) => ({
      ...category,
      causes:
        category.causes.length > 1
          ? category.causes.filter((cause) => cause.id !== causeId)
          : category.causes,
    }))
  }

  const downloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      ...diagram,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `fishbone-diagram-${Date.now()}.json`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const svgWidth = 1360
  const svgHeight = 760
  const spineY = svgHeight / 2
  const tailX = 170
  const headX = 1100
  const headWidth = 128
  const headHeight = 78
  const branchLength = 210
  const ribLength = 124
  const branchAngle = 34
  const cos = Math.cos((branchAngle * Math.PI) / 180)
  const sin = Math.sin((branchAngle * Math.PI) / 180)
  const topAnchors = getAnchorPositions(topCategories.length, 360, 980)
  const bottomAnchors = getAnchorPositions(bottomCategories.length, 360, 980)

  const renderBranchLayer = (categories: Category[], anchors: number[], branch: Branch) =>
    categories.map((category, index) => {
      const anchorX = anchors[index]
      const endX = anchorX - branchLength * cos
      const endY =
        branch === "top"
          ? spineY - branchLength * sin
          : spineY + branchLength * sin
      const isSelected = category.id === selectedCategory?.id
      const stroke = isSelected ? "#f59e0b" : branch === "top" ? "#10b981" : "#fb7185"
      const ribStroke = isSelected ? "#fbbf24" : branch === "top" ? "#86efac" : "#fda4af"
      const visibleCauses = category.causes.slice(0, MAX_VISIBLE_CAUSES)

      return (
        <g key={category.id}>
          <g onClick={() => setSelectedCategoryId(category.id)} className="cursor-pointer">
            <line
              x1={anchorX}
              y1={spineY}
              x2={endX}
              y2={endY}
              stroke={stroke}
              strokeWidth={isSelected ? 4 : 3}
              strokeLinecap="round"
            />
            <circle
              cx={anchorX}
              cy={spineY}
              r={isSelected ? 7 : 6}
              fill="#11161a"
              stroke={stroke}
              strokeWidth="2"
            />
            {visibleCauses.map((cause, causeIndex) => {
              const ratio =
                visibleCauses.length === 1
                  ? 0.48
                  : 0.18 + (causeIndex * 0.62) / (visibleCauses.length - 1)
              const ribJointX = anchorX - ratio * branchLength * cos
              const ribJointY =
                branch === "top"
                  ? spineY - ratio * branchLength * sin
                  : spineY + ratio * branchLength * sin
              const ribEndX = ribJointX - ribLength

              return (
                <g key={cause.id}>
                  <line
                    x1={ribJointX}
                    y1={ribJointY}
                    x2={ribEndX}
                    y2={ribJointY}
                    stroke={ribStroke}
                    strokeWidth={isSelected ? 2.2 : 1.6}
                    strokeLinecap="round"
                    opacity={isSelected ? 1 : 0.72}
                  />
                  <circle cx={ribJointX} cy={ribJointY} r="2.5" fill={ribStroke} />
                </g>
              )
            })}
          </g>
        </g>
      )
    })

  return (
    <div className="min-h-screen bg-[#eef2ef] text-[#182026]">
      <header className="border-b border-black/10 bg-white/80 print:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-[#182026] text-[#f7f4eb]">
                  <GitBranch className="size-5" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight">鱼骨图分析模块</h1>
                  <p className="max-w-3xl text-sm text-[#4a5560]">
                    用一张图把问题、影响和候选原因放到同一个工作面里，适合制造异常分析、项目复盘和跨团队排查。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  本地自动保存
                </Badge>
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700"
                >
                  当前模板: {template.name}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-100 text-slate-700"
                >
                  {diagram.categories.length} 个分类 / {totalCauses} 条原因
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-slate-300 bg-white"
                onClick={() => applyTemplate(diagram.templateId)}
              >
                <RotateCcw className="size-4" />
                重置当前模板
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 bg-white"
                onClick={downloadJson}
              >
                <Download className="size-4" />
                导出 JSON
              </Button>
              <Button
                className="bg-[#182026] text-[#f7f4eb] hover:bg-[#0f1519]"
                onClick={() => window.print()}
              >
                <Printer className="size-4" />
                打印图表
              </Button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-[#24303a]">问题定义</label>
                <Textarea
                  value={diagram.problem}
                  onChange={(event) =>
                    updateDiagram((current) => ({
                      ...current,
                      problem: event.target.value,
                    }))
                  }
                  rows={3}
                  className="min-h-[90px] border-slate-300 bg-white"
                  placeholder="问题要尽量具体，最好写清现象、对象和时间。"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#24303a]">影响说明</label>
                <Textarea
                  value={diagram.impact}
                  onChange={(event) =>
                    updateDiagram((current) => ({
                      ...current,
                      impact: event.target.value,
                    }))
                  }
                  rows={4}
                  className="min-h-[120px] border-slate-300 bg-white"
                  placeholder="写清影响范围、客户感知、成本或节拍。"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#24303a]">当前假设</label>
                <Textarea
                  value={diagram.rootCause}
                  onChange={(event) =>
                    updateDiagram((current) => ({
                      ...current,
                      rootCause: event.target.value,
                    }))
                  }
                  rows={4}
                  className="min-h-[120px] border-slate-300 bg-white"
                  placeholder="把目前最值得验证的猜想放在这里，方便团队对齐。"
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-600" />
                  <h2 className="text-sm font-medium text-[#24303a]">快速模板</h2>
                </div>
                <div className="grid gap-2">
                  {TEMPLATE_DEFINITIONS.map((item) => {
                    const active = item.id === diagram.templateId
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => applyTemplate(item.id)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left transition-colors",
                          active
                            ? "border-amber-300 bg-amber-50"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-[#1e2931]">{item.name}</div>
                            <div className="mt-1 text-sm text-[#55616c]">{item.description}</div>
                          </div>
                          {active ? (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                              当前
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-[#52606b]">
                图上最多展示每个分类前 {MAX_VISIBLE_CAUSES} 条原因，更多内容仍会保留在下面的编辑区里。
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-black/10 bg-[#14191b] text-[#f5f1e8]">
        <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8">
          <div className="mb-4 hidden rounded-lg border border-black/10 bg-white p-4 text-[#182026] print:block">
            <div className="text-lg font-semibold">鱼骨图分析</div>
            <div className="mt-2 text-sm">
              <strong>问题:</strong> {diagram.problem}
            </div>
            <div className="mt-1 text-sm">
              <strong>影响:</strong> {diagram.impact}
            </div>
            <div className="mt-1 text-sm">
              <strong>当前假设:</strong> {diagram.rootCause}
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-[#cad2d8]">
                <Target className="size-4 text-amber-400" />
                选中分类: {selectedCategory?.title ?? "未选择"}
              </div>
              <div className="text-xs text-[#98a5ae]">
                通过下方编辑区维护文本，图上会同步更新；点击骨架分支也可以切换分类。
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15">
                上支路 {topCategories.length}
              </Badge>
              <Badge className="bg-rose-500/15 text-rose-200 hover:bg-rose-500/15">
                下支路 {bottomCategories.length}
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="relative min-w-[1180px] overflow-hidden rounded-xl border border-white/10 bg-[#0f1315]">
              <div className="relative aspect-[16/9]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient id="spine-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>

                  <path
                    d={`M ${tailX} ${spineY}
                      L ${tailX - 44} ${spineY - 56}
                      Q ${tailX - 20} ${spineY - 28}, ${tailX + 8} ${spineY - 10}
                      L ${tailX + 8} ${spineY + 10}
                      Q ${tailX - 20} ${spineY + 28}, ${tailX - 44} ${spineY + 56}
                      Z`}
                    fill="rgba(248, 250, 252, 0.03)"
                    stroke="#d1d5db"
                    strokeWidth="2"
                  />

                  <line
                    x1={tailX}
                    y1={spineY}
                    x2={headX}
                    y2={spineY}
                    stroke="url(#spine-gradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />

                  {renderBranchLayer(topCategories, topAnchors, "top")}
                  {renderBranchLayer(bottomCategories, bottomAnchors, "bottom")}

                  <g>
                    <path
                      d={`M ${headX} ${spineY}
                        C ${headX + 14} ${spineY - headHeight}, ${headX + headWidth * 0.55} ${
                          spineY - headHeight
                        }, ${headX + headWidth} ${spineY}
                        C ${headX + headWidth * 0.55} ${spineY + headHeight}, ${headX + 14} ${
                          spineY + headHeight
                        }, ${headX} ${spineY}
                        Z`}
                      fill="rgba(248, 250, 252, 0.05)"
                      stroke="#f8fafc"
                      strokeWidth="2"
                    />
                    <circle
                      cx={headX + headWidth * 0.48}
                      cy={spineY - headHeight * 0.26}
                      r="9"
                      fill="#11161a"
                      stroke="#f8fafc"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={headX + headWidth * 0.48}
                      cy={spineY - headHeight * 0.26}
                      r="4.5"
                      fill="#f8fafc"
                    />
                  </g>

                  <text
                    x="34"
                    y={svgHeight - 18}
                    fill="#6b7280"
                    style={{ fontSize: "12px" }}
                  >
                    Fishbone / Ishikawa Diagram
                  </text>
                </svg>

                <div className="absolute inset-0">
                  <div
                    className="absolute max-w-[290px] rounded-xl border border-amber-300/60 bg-amber-50/95 px-4 py-3 text-[#182026] shadow-lg shadow-black/20"
                    style={{
                      left: `${((headX + headWidth + 96) / svgWidth) * 100}%`,
                      top: `${((spineY - 120) / svgHeight) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Problem
                    </div>
                    <div className="mt-2 text-sm font-medium leading-5">{diagram.problem}</div>
                    <div className="mt-2 text-xs leading-5 text-[#55616c]">{diagram.impact}</div>
                  </div>

                  {topCategories.map((category, index) => {
                    const anchorX = topAnchors[index]
                    const endX = anchorX - branchLength * cos
                    const endY = spineY - branchLength * sin
                    const isSelected = category.id === selectedCategory?.id
                    const visibleCauses = category.causes.slice(0, MAX_VISIBLE_CAUSES)

                    return (
                      <div key={category.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryId(category.id)}
                          className={cn(
                            "absolute w-[152px] -translate-x-1/2 -translate-y-full rounded-lg border px-3 py-2 text-center text-sm shadow-md transition-transform hover:-translate-y-[102%]",
                            isSelected
                              ? "border-amber-300 bg-amber-50 text-[#182026]"
                              : "border-emerald-400/30 bg-[#182024] text-emerald-100",
                          )}
                          style={{
                            left: `${(endX / svgWidth) * 100}%`,
                            top: `${((endY - 14) / svgHeight) * 100}%`,
                          }}
                        >
                          <div className="font-medium leading-4">{category.title}</div>
                          <div
                            className={cn(
                              "mt-1 text-[11px] uppercase tracking-[0.16em]",
                              isSelected ? "text-amber-700" : "text-emerald-300/70",
                            )}
                          >
                            {category.titleEn}
                          </div>
                        </button>

                        {visibleCauses.map((cause, causeIndex) => {
                          const ratio =
                            visibleCauses.length === 1
                              ? 0.48
                              : 0.18 + (causeIndex * 0.62) / (visibleCauses.length - 1)
                          const ribJointX = anchorX - ratio * branchLength * cos
                          const ribJointY = spineY - ratio * branchLength * sin
                          const ribEndX = ribJointX - ribLength

                          return (
                            <div
                              key={cause.id}
                              title={cause.text}
                              className={cn(
                                "absolute w-[140px] -translate-x-full -translate-y-1/2 truncate rounded-md px-2 py-1 text-right text-[11px] shadow-sm",
                                isSelected
                                  ? "bg-amber-50/90 text-[#182026]"
                                  : "bg-[#1a2125] text-[#dde5ea]",
                              )}
                              style={{
                                left: `${((ribEndX - 8) / svgWidth) * 100}%`,
                                top: `${(ribJointY / svgHeight) * 100}%`,
                              }}
                            >
                              {cause.text}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  {bottomCategories.map((category, index) => {
                    const anchorX = bottomAnchors[index]
                    const endX = anchorX - branchLength * cos
                    const endY = spineY + branchLength * sin
                    const isSelected = category.id === selectedCategory?.id
                    const visibleCauses = category.causes.slice(0, MAX_VISIBLE_CAUSES)

                    return (
                      <div key={category.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryId(category.id)}
                          className={cn(
                            "absolute w-[152px] -translate-x-1/2 rounded-lg border px-3 py-2 text-center text-sm shadow-md transition-transform hover:translate-y-[2%]",
                            isSelected
                              ? "border-amber-300 bg-amber-50 text-[#182026]"
                              : "border-rose-300/30 bg-[#20181b] text-rose-100",
                          )}
                          style={{
                            left: `${(endX / svgWidth) * 100}%`,
                            top: `${((endY + 14) / svgHeight) * 100}%`,
                          }}
                        >
                          <div className="font-medium leading-4">{category.title}</div>
                          <div
                            className={cn(
                              "mt-1 text-[11px] uppercase tracking-[0.16em]",
                              isSelected ? "text-amber-700" : "text-rose-300/70",
                            )}
                          >
                            {category.titleEn}
                          </div>
                        </button>

                        {visibleCauses.map((cause, causeIndex) => {
                          const ratio =
                            visibleCauses.length === 1
                              ? 0.48
                              : 0.18 + (causeIndex * 0.62) / (visibleCauses.length - 1)
                          const ribJointX = anchorX - ratio * branchLength * cos
                          const ribJointY = spineY + ratio * branchLength * sin
                          const ribEndX = ribJointX - ribLength

                          return (
                            <div
                              key={cause.id}
                              title={cause.text}
                              className={cn(
                                "absolute w-[140px] -translate-x-full -translate-y-1/2 truncate rounded-md px-2 py-1 text-right text-[11px] shadow-sm",
                                isSelected
                                  ? "bg-amber-50/90 text-[#182026]"
                                  : "bg-[#24191d] text-[#ffe4e6]",
                              )}
                              style={{
                                left: `${((ribEndX - 8) / svgWidth) * 100}%`,
                                top: `${(ribJointY / svgHeight) * 100}%`,
                              }}
                            >
                              {cause.text}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef2ef] print:hidden">
        <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border-b border-black/10 lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 lg:px-6">
              <div>
                <div className="text-sm font-semibold text-[#1f2a32]">分类列表</div>
                <div className="mt-1 text-xs text-[#5a6772]">点选分类后，在右侧集中编辑。</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 bg-white"
                onClick={addCategory}
              >
                <Plus className="size-4" />
                添加分类
              </Button>
            </div>

            <div className="divide-y divide-black/10">
              {diagram.categories.map((category) => {
                const active = category.id === selectedCategory?.id

                return (
                  <div
                    key={category.id}
                    className={cn(
                      "flex items-start gap-3 px-5 py-4 transition-colors lg:px-6",
                      active ? "bg-white" : "bg-transparent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1f2a32]">{category.title}</span>
                        <Badge
                          variant="outline"
                          className={
                            category.branch === "top"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }
                        >
                          {getBranchLabel(category.branch)}
                        </Badge>
                      </div>
                      <div className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[#7c8892]">
                        {category.titleEn || "Untitled"}
                      </div>
                      <div className="mt-2 text-xs text-[#5a6772]">
                        {category.causes.length} 条原因
                      </div>
                    </button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeCategory(category.id)}
                      disabled={diagram.categories.length <= 2}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="px-5 py-5 lg:px-8 lg:py-6">
            {selectedCategory ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-[#1b2730]">
                      {selectedCategory.title}
                    </h2>
                    <p className="text-sm text-[#5a6772]">
                      调整分类名称、支路位置和原因清单，图上会即时刷新。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategory.branch === "top" ? "default" : "outline"}
                      className={
                        selectedCategory.branch === "top"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border-slate-300 bg-white"
                      }
                      onClick={() =>
                        updateCategory(selectedCategory.id, (category) => ({
                          ...category,
                          branch: "top",
                        }))
                      }
                    >
                      <ArrowUp className="size-4" />
                      放到上支路
                    </Button>
                    <Button
                      variant={selectedCategory.branch === "bottom" ? "default" : "outline"}
                      className={
                        selectedCategory.branch === "bottom"
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "border-slate-300 bg-white"
                      }
                      onClick={() =>
                        updateCategory(selectedCategory.id, (category) => ({
                          ...category,
                          branch: "bottom",
                        }))
                      }
                    >
                      <ArrowDown className="size-4" />
                      放到下支路
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#24303a]">分类名称</label>
                    <Input
                      value={selectedCategory.title}
                      onChange={(event) =>
                        updateCategory(selectedCategory.id, (category) => ({
                          ...category,
                          title: event.target.value,
                        }))
                      }
                      className="border-slate-300 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#24303a]">英文标签</label>
                    <Input
                      value={selectedCategory.titleEn}
                      onChange={(event) =>
                        updateCategory(selectedCategory.id, (category) => ({
                          ...category,
                          titleEn: event.target.value,
                        }))
                      }
                      className="border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1f2a32]">原因清单</div>
                    <div className="mt-1 text-xs text-[#5a6772]">
                      建议每条原因尽量短而具体，方便在图上直接识别。
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-slate-300 bg-white"
                    onClick={() => addCause(selectedCategory.id)}
                  >
                    <Plus className="size-4" />
                    添加原因
                  </Button>
                </div>

                <div className="grid gap-3">
                  {selectedCategory.causes.map((cause, index) => (
                    <div
                      key={cause.id}
                      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[48px_minmax(0,1fr)_44px]"
                    >
                      <div className="flex items-center text-xs font-semibold tracking-[0.16em] text-[#7c8892]">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <Input
                        value={cause.text}
                        onChange={(event) =>
                          updateCategory(selectedCategory.id, (category) => ({
                            ...category,
                            causes: category.causes.map((item) =>
                              item.id === cause.id
                                ? { ...item, text: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="border-slate-300 bg-white"
                        placeholder="例如: 模温波动、验收标准不一致、回归用例缺失"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deleteCause(selectedCategory.id, cause.id)}
                        disabled={selectedCategory.causes.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
