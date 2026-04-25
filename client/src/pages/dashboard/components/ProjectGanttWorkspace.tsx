/**
 * ProjectGanttWorkspace
 *
 * Dashboard 接入：项目甘特图模块。
 * 直接挂载 gantetu 工业级动态甘特图（GanttSkeleton），并注入 Phase 13 / Phase 8 示例数据。
 * 数据形态来自 gantetu2/app/page.tsx，原样保留以便回归对照。
 */

import { GanttSkeleton } from '@/components/gantetu/gantt-skeleton';
import type { ComponentGroup, Milestone } from '@/lib/gantt/types';

const INITIAL_COMPONENTS: ComponentGroup[] = [
  {
    id: 'comp_upper_shell',
    name: '上盖模具',
    isExpanded: true,
    tasks: [
      {
        id: 'upper_cnc',
        parentId: null,
        name: 'CNC 开粗',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        baseStartDate: '2026-04-01',
        baseEndDate: '2026-04-05',
        status: 'in-progress',
        dependencies: [],
        isExpanded: true,
        children: [],
        progress: 60,
      },
      {
        id: 'upper_polish',
        parentId: null,
        name: '抛光工序',
        startDate: '2026-04-06',
        endDate: '2026-04-10',
        baseStartDate: '2026-04-06',
        baseEndDate: '2026-04-10',
        status: 'pending',
        dependencies: ['upper_cnc'],
        isExpanded: true,
        children: [],
      },
    ],
  },
  {
    id: 'comp_lower_shell',
    name: '底壳模具',
    isExpanded: true,
    tasks: [
      {
        id: 'lower_cnc',
        parentId: null,
        name: 'CNC 开粗',
        startDate: '2026-04-02',
        endDate: '2026-04-08',
        baseStartDate: '2026-04-02',
        baseEndDate: '2026-04-08',
        status: 'in-progress',
        dependencies: [],
        isExpanded: true,
        children: [],
        progress: 30,
      },
      {
        id: 'lower_edm',
        parentId: null,
        name: 'EDM 放电',
        startDate: '2026-04-09',
        endDate: '2026-04-12',
        baseStartDate: '2026-04-09',
        baseEndDate: '2026-04-12',
        status: 'pending',
        dependencies: ['lower_cnc'],
        isExpanded: true,
        children: [],
      },
      {
        id: 'lower_inspect',
        parentId: null,
        name: '尺寸检测',
        startDate: '2026-04-13',
        endDate: '2026-04-14',
        baseStartDate: '2026-04-13',
        baseEndDate: '2026-04-14',
        status: 'pending',
        dependencies: ['lower_edm'],
        isExpanded: true,
        children: [],
      },
    ],
  },
  {
    id: 'comp_side_button',
    name: '侧键模具',
    isExpanded: true,
    tasks: [
      {
        id: 'side_design',
        parentId: null,
        name: '结构设计',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        baseStartDate: '2026-04-01',
        baseEndDate: '2026-04-03',
        status: 'completed',
        dependencies: [],
        isExpanded: true,
        children: [],
        progress: 100,
      },
      {
        id: 'side_cnc',
        parentId: null,
        name: 'CNC 加工',
        startDate: '2026-04-04',
        endDate: '2026-04-07',
        baseStartDate: '2026-04-04',
        baseEndDate: '2026-04-07',
        status: 'in-progress',
        dependencies: ['side_design'],
        isExpanded: true,
        children: [],
        progress: 80,
      },
    ],
  },
];

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: 'milestone_t0',
    name: 'T0 试模',
    date: '2026-04-10',
    type: 'commercial',
  },
  {
    id: 'milestone_sop',
    name: 'SOP 量产',
    date: '2026-04-18',
    type: 'technical',
  },
];

export default function ProjectGanttWorkspace() {
  return (
    <div className="bg-[#0B0F19] text-slate-100">
      <GanttSkeleton initialComponents={INITIAL_COMPONENTS} initialMilestones={INITIAL_MILESTONES} />
    </div>
  );
}
