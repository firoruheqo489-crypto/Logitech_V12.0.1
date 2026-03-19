import {
  FORECAST_COMPLETION_MILESTONE_ID,
  type SCurveMilestoneId,
  type SCurvePointMilestoneId,
} from './logitech-s-curve-machine';

const SCURVE_MILESTONE_LABELS: Record<SCurveMilestoneId, string> = {
  project_launch: '项目立项',
  mold_fai_cpk: '模具FAI/CPK',
  t0_summary: 'T0综合报告',
  t0_closure_report: 'T0问题闭环',
  spc_inspection: '巡检SPC数据',
};

const SCURVE_MILESTONE_BADGE_LABELS: Record<SCurvePointMilestoneId, string> = {
  ...SCURVE_MILESTONE_LABELS,
  [FORECAST_COMPLETION_MILESTONE_ID]: '预测完工',
};

export function getSCurveMilestoneLabel(id: SCurveMilestoneId): string {
  return SCURVE_MILESTONE_LABELS[id];
}

export function getSCurveMilestoneBadgeLabel(id: SCurvePointMilestoneId): string {
  return SCURVE_MILESTONE_BADGE_LABELS[id];
}

export function formatSCurveCurrentStageLabel(
  id: SCurveMilestoneId | 'unknown',
  isComplete = false,
): string {
  if (id === 'unknown') {
    return 'N/A';
  }

  return isComplete ? `${SCURVE_MILESTONE_LABELS[id]} ✓` : SCURVE_MILESTONE_LABELS[id];
}
