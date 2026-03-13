/**
 * StatsPanel - Industrial Control Console
 * SINGLE SOURCE OF TRUTH: Only displays stats based on 当前节点 (Current Node)
 * 4 Cards: 全部项目 | 超时项目 | 进行中 | 已完成
 */

import React from 'react';
import { ProjectStats } from '../types/project';
import { AlertTriangle, Clock, CheckCircle2, FolderOpen } from 'lucide-react';

interface StatsPanelProps {
  stats: ProjectStats;
  onFilterChange?: (status: string) => void;
  activeFilter?: string;
}

export default function StatsPanel({ stats, onFilterChange, activeFilter = 'ALL' }: StatsPanelProps) {
  const statCards = [
    {
      label: '全部项目',
      value: stats.total,
      icon: FolderOpen,
      filterValue: 'ALL',
      variant: 'is-all',
      style: { '--accent': '0,180,255', '--accent-hex': '#00B4FF' } as React.CSSProperties,
    },
    {
      label: '超时项目',
      value: stats.highRisk,
      icon: AlertTriangle,
      filterValue: '已超时',
      variant: 'is-risk',
      style: { '--accent': '255,59,59', '--accent-hex': '#FF3B3B' } as React.CSSProperties,
    },
    {
      label: '进行中',
      value: stats.inProgress,
      icon: Clock,
      filterValue: '进行中',
      variant: 'is-progress',
      style: { '--accent': '255,204,0', '--accent-hex': '#FFCC00' } as React.CSSProperties,
    },
    {
      label: '已完成',
      value: stats.completed,
      icon: CheckCircle2,
      filterValue: '已完成',
      variant: 'is-done',
      style: { '--accent': '0,255,163', '--accent-hex': '#00FFA3' } as React.CSSProperties,
    },
  ];

  return (
    <>
      {/* ── PC: Grid layout ── */}
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isActive = activeFilter === stat.filterValue;
          return (
            <button
              key={index}
              type="button"
              className={`stat-card ${stat.variant}${isActive ? ' is-active' : ''} group relative cursor-pointer text-left touch-manipulation select-none`}
              style={stat.style}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFilterChange?.(stat.filterValue);
              }}
            >
              <div className="stat-card-inner relative z-[1] p-7 flex items-start justify-between">
                <div className="space-y-2.5 min-w-0">
                  <p className="stat-label text-[13px] font-semibold tracking-widest uppercase whitespace-nowrap">
                    {stat.label}
                  </p>
                  <p className="stat-value text-[42px] font-extrabold tabular-nums whitespace-nowrap leading-none">
                    {stat.value}
                  </p>
                </div>
                <div className="stat-icon-wrap relative">
                  <div className="stat-icon-glow absolute inset-0 rounded-full blur-xl opacity-15 group-hover:opacity-30 transition-opacity duration-300" />
                  <div className="stat-icon relative w-12 h-12 rounded-xl flex items-center justify-center">
                    <Icon className="w-6 h-6" strokeWidth={1.8} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Mobile: Horizontal scrollable pill bar ── */}
      <div className="md:hidden flex gap-2.5 overflow-x-auto pb-3 mb-4 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isActive = activeFilter === stat.filterValue;
          return (
            <button
              key={index}
              type="button"
              className={`flex-none flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border transition-all duration-200 touch-manipulation select-none ${
                isActive
                  ? 'border-[var(--accent-hex)] bg-[var(--accent-hex)]/15 text-[var(--accent-hex)] shadow-[0_0_12px_var(--accent-hex)/20]'
                  : 'border-white/[0.08] bg-[#151B23] text-[#8B949E]'
              }`}
              style={stat.style as React.CSSProperties}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFilterChange?.(stat.filterValue);
              }}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="text-[13px] font-semibold whitespace-nowrap">{stat.label}</span>
              <span className={`text-[15px] font-extrabold tabular-nums ${isActive ? '' : 'text-[#E6EDF3]'}`}>{stat.value}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
