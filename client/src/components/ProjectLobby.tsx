import { useEffect, useMemo, useState } from "react";
import { Clock, FolderKanban, Package } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ModuleTheme } from "@/lib/theme";
import { getModuleTheme, orderModuleNamesForDisplay } from "@/lib/theme";
import {
  getProjectStatusLabel,
  isProjectStatusDelayed,
  isProjectStatusDone,
  normalizeProjectStatus,
} from "@/lib/dashboardProjectState";
import type { ProjectData } from "@/pages/dashboard/types/project";

interface ProjectLobbyProps {
  onSelect: (projectName: string) => void;
  projects?: readonly ProjectData[];
  loading?: boolean;
}

interface DashboardProjectRow {
  id?: number | string | null;
  projectName?: string | null;
  productName?: string | null;
  moldId?: string | null;
  progressDetails?: string | null;
  updateDate?: string | null;
  moldLead?: string | null;
  pmName?: string | null;
  currentNode?: string | null;
  estimatedCompletion?: string | null;
}

interface ProjectModule {
  moduleId: string;
  moduleName: string;
  status: "active" | "completed" | "delayed" | "archived";
  progress: number;
  itemCount: number;
  lastUpdated: string;
  accentColor: ModuleTheme;
}

function getStatusConfig(status: ProjectModule["status"]) {
  switch (status) {
    case "completed":
      return {
        label: getProjectStatusLabel("completed"),
        dotColor: "bg-blue-400",
        textColor: "text-blue-400",
      };
    case "delayed":
      return {
        label: getProjectStatusLabel("delayed"),
        dotColor: "bg-rose-400",
        textColor: "text-rose-400",
      };
    case "archived":
      return {
        label: "已归档",
        dotColor: "bg-slate-400",
        textColor: "text-slate-400",
      };
    case "active":
    default:
      return {
        label: getProjectStatusLabel("ongoing"),
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-400",
      };
  }
}

function deriveModuleStatus(rows: DashboardProjectRow[], progress: number): ProjectModule["status"] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasDelayed = rows.some((row) => {
    if (isProjectStatusDelayed(row.currentNode)) {
      return true;
    }

    const estimatedCompletion = (row.estimatedCompletion ?? "").trim();
    if (!estimatedCompletion) {
      return false;
    }

    const estimatedDate = new Date(estimatedCompletion);
    if (Number.isNaN(estimatedDate.getTime())) {
      return false;
    }

    estimatedDate.setHours(0, 0, 0, 0);
    return estimatedDate < today && !isProjectStatusDone(row.currentNode);
  });

  if (hasDelayed) {
    return "delayed";
  }

  if (rows.length > 0 && progress === 100) {
    return "completed";
  }

  return "active";
}

function transformRowsToModules(rows: DashboardProjectRow[]): ProjectModule[] {
  const groups = new Map<string, DashboardProjectRow[]>();

  for (const row of rows) {
    const moduleName = (row.projectName ?? "").trim();
    if (!moduleName) {
      continue;
    }

    const bucket = groups.get(moduleName);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(moduleName, [row]);
    }
  }

  const orderedEntries = orderModuleNamesForDisplay(Array.from(groups.keys())).map((moduleName) => [
    moduleName,
    groups.get(moduleName) || [],
  ] as const);
  const orderedModuleNames = orderedEntries.map(([moduleName]) => moduleName);

  return orderedEntries
    .map(([moduleName, moduleRows], index) => {
      const completedCount = moduleRows.filter(
        (row) => normalizeProjectStatus(row.currentNode) === "completed",
      ).length;
      const progress =
        moduleRows.length > 0 ? Math.round((completedCount / moduleRows.length) * 100) : 0;
      const lastUpdated =
        moduleRows
          .map((row) => (row.updateDate ?? "").trim())
          .filter(Boolean)
          .sort((left, right) => right.localeCompare(left))[0] ?? "-";

      return {
        moduleId: `mod-${String(index + 1).padStart(3, "0")}`,
        moduleName,
        status: deriveModuleStatus(moduleRows, progress),
        progress,
        itemCount: moduleRows.length,
        lastUpdated,
        accentColor: getModuleTheme(moduleName, orderedModuleNames),
      };
    });
}

function ModuleCard({
  module,
  onSelect,
}: {
  module: ProjectModule;
  onSelect: (moduleName: string) => void;
}) {
  const statusConfig = getStatusConfig(module.status);
  const accentTheme = module.accentColor;

  return (
    <button
      type="button"
      onClick={() => onSelect(module.moduleName)}
      className={`
        group relative flex min-h-[294px] h-full flex-col justify-between gap-6 overflow-hidden
        rounded-2xl border-2 bg-slate-900/95 p-7 text-left shadow-lg transition-all duration-300
        ease-out ${accentTheme.borderFocus} ${accentTheme.shadowGlow} hover:scale-[1.02] hover:shadow-xl
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-black/10" />
      <div className={`pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100 ${accentTheme.surfaceGlow}`} />

      <div className="relative flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${accentTheme.iconBg}`}>
          <FolderKanban className={`h-5 w-5 ${accentTheme.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-2xl font-bold tracking-tight text-white">{module.moduleName}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusConfig.dotColor} animate-pulse`} />
            <span className={`text-xs font-medium ${statusConfig.textColor}`}>{statusConfig.label}</span>
          </div>
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">项目进度</span>
          <span className="text-xl font-mono font-bold tracking-tighter text-white">{module.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700/50">
          <div
            className={`h-full rounded-full transition-all duration-500 ${accentTheme.progressBg}`}
            style={{ width: `${module.progress}%` }}
          />
        </div>

        <div className="relative flex items-center justify-between text-sm font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            <span>{module.itemCount} 个子项目</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">{module.lastUpdated}</span>
          </div>
        </div>
      </div>

      <div
        className={`
          relative flex w-full items-center justify-center rounded-xl border border-white/10
          py-3 text-[15px] font-bold tracking-widest text-white transition-all duration-300
          hover:opacity-90 active:scale-[0.98] ${accentTheme.buttonBg}
        `}
      >
        进入项目
      </div>
    </button>
  );
}

function mapProjectDataToLobbyRow(project: ProjectData): DashboardProjectRow {
  return {
    id: project.no,
    projectName: project.identity.projectName,
    productName: project.identity.productName,
    moldId: project.identity.moldNumber,
    progressDetails: project.details.detailProgress,
    updateDate: project.details.detailDate,
    moldLead: project.identity.projectEngineer,
    pmName: project.identity.projectManager,
    currentNode: project.milestones.currentNode,
    estimatedCompletion: project.milestones.estimatedCompletion,
  };
}

export default function ProjectLobby({ onSelect, projects, loading: controlledLoading = false }: ProjectLobbyProps) {
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(projects === undefined);
  const [error, setError] = useState<string | null>(null);
  const controlledModules = useMemo(
    () => projects === undefined
      ? null
      : transformRowsToModules(projects.map(mapProjectDataToLobbyRow)),
    [projects],
  );
  const resolvedModules = controlledModules ?? modules;
  const loading = projects === undefined ? remoteLoading : controlledLoading;

  useEffect(() => {
    if (projects !== undefined) return;
    let cancelled = false;

    async function loadModules() {
      setRemoteLoading(true);
      setError(null);

      try {
        const response = await apiFetch("/api/dashboard/projects");
        if (!response.ok) {
          throw new Error("Project list load failed");
        }

        const data = (await response.json()) as DashboardProjectRow[];
        if (cancelled) {
          return;
        }

        setModules(transformRowsToModules(Array.isArray(data) ? data : []));
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        setError("项目列表加载失败，请稍后重试");
      } finally {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      }
    }

    void loadModules();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(139,92,246,0.14),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.94)_0%,_rgba(2,6,23,1)_55%)]" />
        <div className="relative mx-auto w-full max-w-7xl" aria-busy="true">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">项目大厅</h1>
            <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-slate-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              正在加载项目数据…
            </div>
          </div>
          <div className="grid justify-start gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 400px), 400px))" }}>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="min-h-[294px] animate-pulse rounded-2xl border-2 border-slate-800 bg-slate-900/75 p-7">
                <div className="mb-12 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-800" />
                  <div className="h-7 w-44 rounded-lg bg-slate-800" />
                </div>
                <div className="space-y-5">
                  <div className="h-5 w-28 rounded bg-slate-800" />
                  <div className="h-2 w-full rounded-full bg-slate-800" />
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-slate-800" />
                    <div className="h-4 w-28 rounded bg-slate-800" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.12),_transparent_28%)]" />
        <div className="relative rounded-2xl border border-red-500/20 bg-slate-900/80 px-8 py-7 text-center shadow-lg shadow-red-950/30 backdrop-blur">
          <p className="mb-2 text-sm text-red-400">数据加载失败</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(139,92,246,0.14),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.94)_0%,_rgba(2,6,23,1)_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent)]" />

      <div className="relative mx-auto w-full max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">项目大厅</h1>
          <p className="text-sm font-medium tracking-wide text-slate-400">选择一个模块以查看详细信息</p>
        </div>

        {resolvedModules.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-lg shadow-black/20 backdrop-blur">
            <p className="text-slate-400">暂无项目数据</p>
          </div>
        ) : (
          <div
            className="grid justify-start gap-6"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 400px), 400px))",
            }}
          >
            {resolvedModules.map((module) => (
              <ModuleCard key={module.moduleId} module={module} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
