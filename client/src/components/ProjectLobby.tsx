import { useState, useEffect } from "react";
import {
  FolderKanban,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Calendar,
  Hash,
  Package,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ACCENT_PALETTE } from "@/lib/theme";

// ==================== 数据接口定义 ====================
interface ProjectItem {
  id: string;
  partName: string;
  projectCode: string;
  description?: string;
  lastUpdated?: string;
  assignee?: string;
}

interface ProjectModule {
  moduleId: string;
  moduleName: string;
  status: "active" | "completed" | "delayed" | "archived";
  progress: number;
  itemCount: number;
  items: ProjectItem[];
  lastUpdated: string;
  accentColor: string;
}

// ==================== Props ====================
interface ProjectLobbyProps {
  onSelect: (projectName: string) => void;
}

// ==================== 数据库行类型 ====================
interface DashboardProjectRow {
  id: number;
  project_name: string | null;
  product_name: string | null;
  mold_id: string | null;
  progress_details: string | null;
  estimated_completion: string | null;
  update_date: string | null;
  mold_lead: string | null;
  pm_name: string | null;
  current_stage: string | null;
  current_node: string | null;
}

// ==================== 颜色轮转表（共享自 theme.ts） ====================
const ACCENT_COLORS = ACCENT_PALETTE;

// ==================== 转换函数 ====================
function rowToItem(row: DashboardProjectRow): ProjectItem {
  return {
    id: String(row.id),
    partName: row.product_name || "—",
    projectCode: row.mold_id || "—",
    description: row.progress_details || undefined,
    lastUpdated: row.update_date || undefined,
    assignee: row.mold_lead || row.pm_name || undefined,
  };
}

function getRowNodeStatus(row: DashboardProjectRow): string {
  return (row.current_node ?? row.current_stage ?? "").trim();
}

function deriveProgress(rows: DashboardProjectRow[]): number {
  const total = rows.length;
  if (total === 0) return 0;

  // Keep the same strict status source as dashboard stats: current_node === "已完成".
  const completedCount = rows.filter((r) => getRowNodeStatus(r) === "已完成").length;
  return Math.round((completedCount / total) * 100);
}

function deriveModuleStatus(rows: DashboardProjectRow[], progress: number): ProjectModule["status"] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasDelayed = rows.some((r) => {
    const status = getRowNodeStatus(r);
    if (status === "已超时" || status === "已延期") return true;
    if (!r.estimated_completion) return false;
    const d = new Date(r.estimated_completion);
    if (isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d < today;
  });

  if (hasDelayed) return "delayed";
  if (progress === 100) return "completed";
  return "active";
}

function transformToModules(allRows: DashboardProjectRow[]): ProjectModule[] {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  for (const row of allRows) {
    const name = row.project_name;
    if (name && !seen.has(name)) {
      seen.add(name);
      uniqueNames.push(name);
    }
  }
  return uniqueNames.map((moduleName, index) => {
    const rows = allRows.filter((r) => r.project_name === moduleName);
    const items = rows.map(rowToItem);
    const progress = deriveProgress(rows);
    const lastUpdated = rows
      .map((r) => r.update_date)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? "";
    return {
      moduleId: `mod-${String(index + 1).padStart(3, "0")}`,
      moduleName,
      status: deriveModuleStatus(rows, progress),
      progress,
      itemCount: items.length,
      items,
      lastUpdated,
      accentColor: ACCENT_COLORS[index % ACCENT_COLORS.length],
    };
  });
}

// ==================== 辅助函数 ====================
const getStatusConfig = (status: ProjectModule["status"]) => {
  switch (status) {
    case "active":
      return { label: "进行中", dotColor: "bg-emerald-400", textColor: "text-emerald-400" };
    case "completed":
      return { label: "已完成", dotColor: "bg-blue-400", textColor: "text-blue-400" };
    case "delayed":
      return { label: "已延期", dotColor: "bg-rose-400", textColor: "text-rose-400" };
    case "archived":
      return { label: "已归档", dotColor: "bg-slate-400", textColor: "text-slate-400" };
  }
};

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
  };
  return colorMap[color] || colorMap.cyan;
};

// ==================== 卡片组件 ====================
function ModuleCard({
  module,
  onSelect,
}: {
  module: ProjectModule;
  onSelect: (module: ProjectModule) => void;
}) {
  const statusConfig = getStatusConfig(module.status);
  const accentClasses = getAccentClasses(module.accentColor);

  return (
    <div
      className={`
        group relative bg-slate-900 rounded-2xl border-2 ${accentClasses.border}
        p-5 transition-all duration-300 ease-out cursor-pointer
        hover:scale-105 shadow-lg ${accentClasses.glow} hover:shadow-xl
      `}
      onClick={() => onSelect(module)}
    >
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
  );
}

// ==================== 主组件 ====================
export default function ProjectLobby({ onSelect }: ProjectLobbyProps) {
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase 未配置");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: sbError } = await supabase
          .from("dashboard_projects")
          .select(
            "id, project_name, product_name, mold_id, progress_details, estimated_completion, update_date, mold_lead, pm_name, current_stage, current_node"
          )
          .order("id", { ascending: true });
        if (sbError) throw sbError;
        if (!cancelled) setModules(transformToModules((data ?? []) as DashboardProjectRow[]));
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "数据加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000000]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="text-sm text-slate-400">正在加载项目数据...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000000]">
        <div className="text-center">
          <p className="mb-2 text-sm text-red-400">数据加载失败</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">项目大厅</h1>
        <p className="text-slate-400">选择一个模块以查看详细信息</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {modules.map((module) => (
          <ModuleCard
            key={module.moduleId}
            module={module}
            onSelect={(m) => onSelect(m.moduleName)}
          />
        ))}
      </div>
    </div>
  );
}
