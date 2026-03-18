import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, FolderOpen } from 'lucide-react';
import type { ProjectStats } from '../types/project';
import type { ModuleTheme } from '@/lib/theme';
import { getThemeGlowClass } from '@/lib/theme';
import type { DashboardFilter } from '@/lib/dashboardProjectState';
import { getProjectStatusLabel } from '@/lib/dashboardProjectState';

interface StatsPanelProps {
  stats: ProjectStats;
  theme: ModuleTheme;
  onFilterChange?: (status: DashboardFilter) => void;
  activeFilter?: DashboardFilter;
}

export default function StatsPanel({ stats, theme, onFilterChange, activeFilter = 'ALL' }: StatsPanelProps) {
  const themeGlow = getThemeGlowClass(theme.shadowGlow);

  const statCards = [
    {
      label: '全部项目',
      value: stats.total,
      icon: FolderOpen,
      filterValue: 'ALL' as const,
    },
    {
      label: '超时项目',
      value: stats.highRisk,
      icon: AlertTriangle,
      filterValue: 'overdue' as const,
    },
    {
      label: getProjectStatusLabel('ongoing'),
      value: stats.inProgress,
      icon: Clock,
      filterValue: 'ongoing' as const,
    },
    {
      label: getProjectStatusLabel('completed'),
      value: stats.completed,
      icon: CheckCircle2,
      filterValue: 'completed' as const,
    },
  ] as const;

  return (
    <>
      <div className="mb-10 hidden gap-6 px-1 md:grid md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isActive = activeFilter === stat.filterValue;

          return (
            <button
              key={index}
              type="button"
              className={`group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6 text-left shadow-2xl backdrop-blur-xl transition-all duration-500 ${
                isActive ? `${theme.glassBorder} ${themeGlow}` : `${theme.glassBorder} hover:shadow-xl`
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFilterChange?.(stat.filterValue);
              }}
            >
              <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[50px] opacity-20 transition-opacity duration-700 group-hover:opacity-40 ${theme.ambientGlow}`} />
              <div className="relative z-10 mb-6 flex items-start justify-between">
                <span className="text-sm font-medium tracking-wide text-slate-400">{stat.label}</span>
                <div className={`rounded-xl p-2.5 ${theme.iconBg} ${theme.text}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className={`relative z-10 bg-gradient-to-br bg-clip-text text-4xl font-mono font-extrabold tracking-tighter text-transparent ${theme.textGradient}`}>
                {stat.value}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex gap-2.5 overflow-x-auto pb-3 scrollbar-none md:hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isActive = activeFilter === stat.filterValue;

          return (
            <button
              key={index}
              type="button"
              className={`group relative flex-none overflow-hidden rounded-full border border-slate-700/50 bg-slate-900/40 px-4 py-2 backdrop-blur-xl transition-all duration-500 ${
                isActive
                  ? `${theme.glassBorder} ${themeGlow}`
                  : `${theme.glassBorder} text-[#8B949E]`
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFilterChange?.(stat.filterValue);
              }}
            >
              <div className={`absolute -right-8 -top-8 h-20 w-20 rounded-full blur-[36px] opacity-15 transition-opacity duration-700 group-hover:opacity-30 ${theme.ambientGlow}`} />
              <div className="relative z-10 flex min-h-[44px] touch-manipulation select-none items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? theme.text : ''}`} strokeWidth={2} />
                <span className="whitespace-nowrap text-[13px] font-semibold">{stat.label}</span>
                <span className={`bg-gradient-to-br bg-clip-text text-[15px] font-extrabold tabular-nums text-transparent ${isActive ? theme.textGradient : 'from-[#E6EDF3] to-[#94A3B8]'}`}>{stat.value}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
