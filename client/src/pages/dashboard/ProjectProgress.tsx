import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, GitBranch, TrendingUp } from 'lucide-react';
import { useLocation, useSearch } from 'wouter';

import { LogitechSCurve } from '@/components/logitech-s-curve';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GanttV3Chart from '@/components/v3/GanttV3Chart';
import { buildProjectProgressSeed } from '@/lib/projectProgress';
import { THEME_MAP, type ModuleTheme } from '@/lib/theme';

type ThemeKey = keyof typeof THEME_MAP;
type ProgressTab = 's-curve' | 'gantt';

const DEFAULT_THEME_KEY: ThemeKey = 'default';

function resolveModuleTheme(themeKey: string | null): ModuleTheme {
  const normalizedKey = (themeKey || DEFAULT_THEME_KEY) as ThemeKey;
  const themeConfig = THEME_MAP[normalizedKey] ?? THEME_MAP[DEFAULT_THEME_KEY];
  return {
    key: THEME_MAP[normalizedKey] ? normalizedKey : DEFAULT_THEME_KEY,
    ...themeConfig,
  };
}

export default function ProjectProgress() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState<ProgressTab>('s-curve');

  const queryModule = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('module')?.trim() || '';
  }, [searchString]);

  const storedModule =
    typeof window !== 'undefined' ? sessionStorage.getItem('dashboard_active_module')?.trim() || '' : '';
  const storedThemeKey =
    typeof window !== 'undefined' ? sessionStorage.getItem('dashboard_active_module_theme_key') : null;

  const activeModule = queryModule || storedModule;
  const moduleTheme = useMemo(() => resolveModuleTheme(storedThemeKey), [storedThemeKey]);
  const seed = useMemo(() => buildProjectProgressSeed(activeModule || undefined), [activeModule]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    sessionStorage.setItem('dashboard_active_module', seed.moduleName);
    sessionStorage.setItem('dashboard_active_module_theme_key', moduleTheme.key);
  }, [moduleTheme.key, seed.moduleName]);

  const handleBackToDashboard = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboard_active_module', seed.moduleName);
      sessionStorage.setItem('dashboard_active_module_theme_key', moduleTheme.key);
    }
    setLocation('/dashboard');
  };

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-slate-950"
      style={{ '--accent': moduleTheme.hex, '--accent-rgb': moduleTheme.rgb } as CSSProperties}
    >
      <div className="relative shrink-0 border-b border-white/[0.06] bg-[#05070b]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.018) 2px, rgba(34,211,238,0.018) 4px)',
          }}
        />
        <div className="mx-auto flex h-[84px] w-full max-w-[1720px] items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={handleBackToDashboard}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-slate-300 transition hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              返回主看板
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: moduleTheme.hex }}>
                Project Progress
              </p>
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-white">{seed.moduleName}项目进度看板</h1>
            </div>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Project ID</p>
              <p className="mt-1 font-mono text-sm font-bold text-cyan-300">{seed.projectId}</p>
            </div>
            <div className="h-10 w-px bg-white/[0.06]" />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Render Mode</p>
              <p className="mt-1 text-sm font-semibold text-amber-300">Static Seed · Forced Render</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1720px] min-h-0 flex-1 flex-col px-4 py-4 md:px-8 md:py-5">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ProgressTab)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <section className="shrink-0 rounded-[24px] border border-white/[0.08] bg-[#05070b] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[18px] bg-transparent p-0">
              <TabsTrigger
                value="s-curve"
                className="h-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-sm font-semibold text-slate-300 data-[state=active]:border-[rgba(var(--accent-rgb),0.5)] data-[state=active]:bg-[rgba(var(--accent-rgb),0.18)] data-[state=active]:text-white data-[state=active]:shadow-[0_12px_28px_rgba(15,23,42,0.28)]"
              >
                S曲线概览
              </TabsTrigger>
              <TabsTrigger
                value="gantt"
                className="h-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-sm font-semibold text-slate-300 data-[state=active]:border-[rgba(var(--accent-rgb),0.5)] data-[state=active]:bg-[rgba(var(--accent-rgb),0.18)] data-[state=active]:text-white data-[state=active]:shadow-[0_12px_28px_rgba(15,23,42,0.28)]"
              >
                甘特图明细
              </TabsTrigger>
            </TabsList>
          </section>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === 's-curve' ? (
              <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0A0A0A] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <LogitechSCurve
                  projectId={seed.projectId}
                  moldNumber={seed.moldNumber}
                  taskItems={seed.taskItems}
                  disableRemoteFetch
                  fillHeight
                  className="h-full rounded-none border-0 bg-[#111111] p-4"
                />
              </section>
            ) : (
              <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0A0A0A] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="shrink-0 border-b border-white/[0.06] bg-[#07090d] px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: moduleTheme.hex }}>
                          Gantt Stage
                        </p>
                        <h2 className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight text-white">
                          <GitBranch className="h-4 w-4 text-cyan-300" />
                          任务时间轴与甘特图
                        </h2>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
                          Static Seed 任务集已强制装载
                        </span>
                        <span className="font-mono text-cyan-300">{seed.ganttData.tasks.length} tasks</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    <GanttV3Chart
                      data={seed.ganttData}
                      projectId={seed.projectId}
                      productImageUrl={seed.ganttData.projectInfo.product_image_url}
                      evidenceCounts={{}}
                    />
                  </div>
                </div>
              </section>
            )}
          </div>
        </Tabs>
      </main>
    </div>
  );
}
