"use client"

import { useState, useEffect, useMemo } from "react"
import type { DashboardProjectViewData } from '@/pages/dashboard/lib/dashboardApi'
import {
  getProjectStatusLabel,
  isProjectStatusDelayed,
  normalizeProjectStatus,
} from '@/lib/dashboardProjectState'
import { fetchDashboardProjectData } from '@/pages/dashboard/lib/dashboardApi'
import {
  FolderKanban,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Calendar,
  Hash,
  Package,
  Clock,
} from "lucide-react"

// ==================== 数据接口定义 ====================
interface ProjectItem {
  id: string
  partName: string
  projectCode: string
  description?: string
  lastUpdated?: string
  assignee?: string
}

interface ProjectModule {
  moduleId: string
  moduleName: string
  status: "active" | "completed" | "delayed" | "archived"
  progress: number
  itemCount: number
  items: ProjectItem[]
  lastUpdated: string
  accentColor: string
}

// ==================== 辅助函数 ====================
const getStatusConfig = (status: ProjectModule["status"]) => {
  switch (status) {
    case "active":
      return { label: getProjectStatusLabel('ongoing'), dotColor: "bg-emerald-400", textColor: "text-emerald-400" }
    case "completed":
      return { label: getProjectStatusLabel('completed'), dotColor: "bg-blue-400", textColor: "text-blue-400" }
    case "delayed":
      return { label: getProjectStatusLabel('delayed'), dotColor: "bg-rose-400", textColor: "text-rose-400" }
    case "archived":
      return { label: "已归档", dotColor: "bg-slate-400", textColor: "text-slate-400" }
  }
}

const getAccentClasses = (color: string) => {
  const colorMap: Record<string, { border: string; bg: string; glow: string; progressBg: string }> = {
    cyan: {
      border: "border-cyan-500/50 hover:border-cyan-400",
      bg: "from-cyan-600 to-blue-600",
      glow: "shadow-cyan-500/20 hover:shadow-cyan-500/40",
      progressBg: "bg-cyan-500",
    },
    purple: {
      border: "border-purple-500/50 hover:border-purple-400",
      bg: "from-purple-600 to-pink-600",
      glow: "shadow-purple-500/20 hover:shadow-purple-500/40",
      progressBg: "bg-purple-500",
    },
    rose: {
      border: "border-rose-500/50 hover:border-rose-400",
      bg: "from-rose-600 to-orange-600",
      glow: "shadow-rose-500/20 hover:shadow-rose-500/40",
      progressBg: "bg-rose-500",
    },
    amber: {
      border: "border-amber-500/50 hover:border-amber-400",
      bg: "from-amber-600 to-yellow-600",
      glow: "shadow-amber-500/20 hover:shadow-amber-500/40",
      progressBg: "bg-amber-500",
    },
    emerald: {
      border: "border-emerald-500/50 hover:border-emerald-400",
      bg: "from-emerald-600 to-teal-600",
      glow: "shadow-emerald-500/20 hover:shadow-emerald-500/40",
      progressBg: "bg-emerald-500",
    },
    sky: {
      border: "border-sky-500/50 hover:border-sky-400",
      bg: "from-sky-600 to-indigo-600",
      glow: "shadow-sky-500/20 hover:shadow-sky-500/40",
      progressBg: "bg-sky-500",
    },
  }
  return colorMap[color] || colorMap.cyan
}

// ==================== 颜色循环函数 ====================
const ACCENT_COLORS = ["cyan", "purple", "rose", "amber", "emerald", "sky"] as const
function hashStringToIndex(input: string, mod: number): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return mod === 0 ? 0 : h % mod
}
function getAccentColor(name: string): string {
  return ACCENT_COLORS[hashStringToIndex(name, ACCENT_COLORS.length)]
}

// ==================== 卡片组件 ====================
function ModuleCard({
  module,
  onSelect,
}: {
  module: ProjectModule
  onSelect: (module: ProjectModule) => void
}) {
  const statusConfig = getStatusConfig(module.status)
  const accentClasses = getAccentClasses(module.accentColor)

  return (
    <div
      className={`
        group relative bg-slate-900 rounded-2xl border-2 ${accentClasses.border}
        p-5 transition-all duration-300 ease-out cursor-pointer
        hover:scale-105 shadow-lg ${accentClasses.glow} hover:shadow-xl
      `}
      onClick={() => onSelect(module)}
    >
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-xl bg-gradient-to-br ${accentClasses.bg}`}>
          <FolderKanban className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate">{module.moduleName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor} animate-pulse`} />
            <span className={`text-xs font-medium ${statusConfig.textColor}`}>{statusConfig.label}</span>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">项目进度</span>
          <span className="text-sm font-semibold text-white">{module.progress}%</span>
        </div>
        <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full ${accentClasses.progressBg} rounded-full transition-all duration-500`}
            style={{ width: `${module.progress}%` }}
          />
        </div>
      </div>

      {/* 信息概要 */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          <span>{module.itemCount} 个零件项</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{module.lastUpdated}</span>
        </div>
      </div>

      {/* 进入按钮 */}
      <button
        className={`
          w-full py-2.5 rounded-xl font-semibold text-sm text-white
          bg-gradient-to-r ${accentClasses.bg}
          transition-all duration-300
          hover:opacity-90 active:scale-[0.98]
          border border-white/10
        `}
      >
        进入项目
      </button>
    </div>
  )
}

// ==================== 详情视图折叠面板 ====================
function DetailAccordion({ item }: { item: ProjectItem }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-700">
            <Package className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <h4 className="font-semibold text-white">{item.partName}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{item.projectCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-slate-700/50">
          <div className="pt-4 space-y-3">
            {item.description && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">描述</span>
                <span className="text-sm text-slate-300">{item.description}</span>
              </div>
            )}
            {item.assignee && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">负责人</span>
                <span className="text-sm text-slate-300">{item.assignee}</span>
              </div>
            )}
            {item.lastUpdated && (
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">更新日期</span>
                <span className="text-sm text-slate-300">{item.lastUpdated}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 详情视图 ====================
function DetailView({
  module,
  onBack,
}: {
  module: ProjectModule
  onBack: () => void
}) {
  const statusConfig = getStatusConfig(module.status)
  const accentClasses = getAccentClasses(module.accentColor)

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* 返回按钮 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">返回大厅</span>
      </button>

      {/* 模块头部 */}
      <div className={`bg-slate-900 rounded-2xl border-2 ${accentClasses.border} p-6 mb-6`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${accentClasses.bg}`}>
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{module.moduleName}</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                <span className={`text-sm ${statusConfig.textColor}`}>{statusConfig.label}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-400">
                <Hash className="w-4 h-4" />
                <span>{module.moduleId}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-400">
                <Calendar className="w-4 h-4" />
                <span>{module.lastUpdated}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{module.progress}%</div>
            <div className="text-xs text-slate-400 mt-1">完成进度</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-4 h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full ${accentClasses.progressBg} rounded-full transition-all duration-500`}
            style={{ width: `${module.progress}%` }}
          />
        </div>
      </div>

      {/* 零件列表 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white mb-4">
          零件项目 ({module.items.length})
        </h2>
        {module.items.map((item) => (
          <DetailAccordion key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

// ==================== 主组件 ====================
export default function ProjectLobbyV2() {
  const [dbProjects, setDbProjects] = useState<DashboardProjectViewData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState<ProjectModule | null>(null)

  // 获取真实数据
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        setDbProjects(await fetchDashboardProjectData())
      } catch {
        if (cancelled) return
        setDbProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 将真实数据转换为 ProjectModule[] - 按 projectName 分组
  const modules = useMemo(() => {
    if (!dbProjects.length) return []

    // 按 projectName 分组
    const groups: Record<string, DashboardProjectViewData[]> = {}
    for (const row of dbProjects) {
      const projectName = (row.identity.projectName || '').trim()
      if (!projectName) continue
      if (!groups[projectName]) groups[projectName] = []
      groups[projectName].push(row)
    }

    // 为每个分组创建 ProjectModule
    const result: ProjectModule[] = Object.entries(groups).map(([projectName, items]) => {
      // 计算进度：基于 currentNode 状态
      let completedCount = 0
      let delayedCount = 0
      let latestDate = ''

      for (const item of items) {
        const currentNode = normalizeProjectStatus(item.milestones.currentNode)
        const detailDate = (item.details.detailDate || '').trim()

        // 更新最新日期
        if (detailDate && (!latestDate || detailDate > latestDate)) {
          latestDate = detailDate
        }

        // 计算完成/延期数量
        if (currentNode === 'completed') {
          completedCount++
        } else if (isProjectStatusDelayed(currentNode)) {
          delayedCount++
        }
      }

      const total = items.length
      const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0

      // 判断整体状态
      let status: ProjectModule["status"] = "active"
      if (completedCount === total && total > 0) {
        status = "completed"
      } else if (delayedCount > 0) {
        status = "delayed"
      }

      // 将每行数据转换为 ProjectItem
      const projectItems: ProjectItem[] = items.map((row, idx) => ({
        id: row.identity.moldNumber || `item-${idx}`,
        partName: row.productName || row.moldNumber || '未命名',
        projectCode: row.identity.moldNumber || '-',
        description: row.details.detailProgress || row.identity.projectEngineer || undefined,
        lastUpdated: row.details.detailDate || row.uploadBatch || undefined,
        assignee: row.identity.projectManager || undefined,
      }))

      return {
        moduleId: projectName,
        moduleName: projectName,
        status,
        progress,
        itemCount: items.length,
        items: projectItems,
        lastUpdated: latestDate || '-',
        accentColor: getAccentColor(projectName),
      }
    })

    // 按名称排序
    return result.sort((a, b) => a.moduleName.localeCompare(b.moduleName, 'zh-CN'))
  }, [dbProjects])

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="w-5 h-5 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  // 空状态
  if (modules.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">项目大厅</h1>
          <p className="text-slate-400">选择一个模块以查看详细信息</p>
        </div>
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
          <p className="text-slate-400">暂无项目数据</p>
        </div>
      </div>
    )
  }

  // 详情视图
  if (selectedModule) {
    return <DetailView module={selectedModule} onBack={() => setSelectedModule(null)} />
  }

  // 大厅视图
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* 大厅头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">项目大厅</h1>
        <p className="text-slate-400">选择一个模块以查看详细信息</p>
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {modules.map((module) => (
          <ModuleCard key={module.moduleId} module={module} onSelect={setSelectedModule} />
        ))}
      </div>
    </div>
  )
}
