/**
 * Home — Mold Gantt V3 Dashboard
 * Tesla Mission Control style: full-screen immersive gantt chart
 * 
 * Design philosophy: Breathable whitespace, layered transparency,
 * warm precision, borderless design
 */

import { useMemo } from 'react';
import { buildProjectData } from '@/lib/data';
import GanttHeader from '@/components/GanttHeader';
import GanttChart from '@/components/GanttChart';

export default function Home() {
  const { tasks, milestones, projectInfo } = useMemo(() => buildProjectData(), []);

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
      <GanttHeader projectInfo={projectInfo} milestones={milestones} />
      <GanttChart tasks={tasks} milestones={milestones} projectInfo={projectInfo} />
    </div>
  );
}
