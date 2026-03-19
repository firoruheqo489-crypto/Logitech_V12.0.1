export type SCurveMilestoneId =
  | 'project_launch'
  | 'mold_fai_cpk'
  | 't0_summary'
  | 't0_closure_report'
  | 'spc_inspection';

export const FORECAST_COMPLETION_MILESTONE_ID = 'forecast_completion' as const;

export type SCurvePointMilestoneId =
  | SCurveMilestoneId
  | typeof FORECAST_COMPLETION_MILESTONE_ID;

export interface SCurveMilestoneDefinition {
  id: SCurveMilestoneId;
  stageIds: readonly string[];
  progress: number;
  shortLabel: string;
}

export const SCURVE_MILESTONES: readonly SCurveMilestoneDefinition[] = [
  { id: 'project_launch', stageIds: ['project_launch'], progress: 0, shortLabel: 'KO' },
  { id: 'mold_fai_cpk', stageIds: ['mold_fai_cpk'], progress: 25, shortLabel: 'FAI' },
  { id: 't0_summary', stageIds: ['t0_summary'], progress: 50, shortLabel: 'T0' },
  { id: 't0_closure_report', stageIds: ['t0_closure_report'], progress: 75, shortLabel: 'T1' },
  { id: 'spc_inspection', stageIds: ['spc_inspection'], progress: 100, shortLabel: 'SPC' },
];

export function getNextSCurveMilestoneId(
  currentId: SCurveMilestoneId,
): SCurveMilestoneId | null {
  const currentIndex = SCURVE_MILESTONES.findIndex((milestone) => milestone.id === currentId);
  if (currentIndex === -1) {
    return null;
  }

  return SCURVE_MILESTONES[currentIndex + 1]?.id ?? null;
}
