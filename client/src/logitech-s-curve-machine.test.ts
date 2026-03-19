import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  FORECAST_COMPLETION_MILESTONE_ID,
  SCURVE_MILESTONES,
  getNextSCurveMilestoneId,
} from './components/logitech-s-curve-machine';
import {
  formatSCurveCurrentStageLabel,
  getSCurveMilestoneBadgeLabel,
  getSCurveMilestoneLabel,
} from './components/logitech-s-curve-labels';

describe('logitech s-curve milestone machine boundary', () => {
  it('keeps milestone machine ids English-only', () => {
    expect(SCURVE_MILESTONES.map((milestone) => milestone.id)).toEqual([
      'project_launch',
      'mold_fai_cpk',
      't0_summary',
      't0_closure_report',
      'spc_inspection',
    ]);

    expect(getNextSCurveMilestoneId('project_launch')).toBe('mold_fai_cpk');
    expect(getNextSCurveMilestoneId('spc_inspection')).toBeNull();
  });

  it('keeps Han characters out of the machine definition file', () => {
    const machineFile = fileURLToPath(new URL('./components/logitech-s-curve-machine.ts', import.meta.url));
    const source = readFileSync(machineFile, 'utf8');

    expect(source).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('renders Chinese labels only through the display mapping layer', () => {
    expect(getSCurveMilestoneLabel('mold_fai_cpk')).toBe('模具FAI/CPK');
    expect(getSCurveMilestoneBadgeLabel(FORECAST_COMPLETION_MILESTONE_ID)).toBe('预测完工');
    expect(formatSCurveCurrentStageLabel('spc_inspection', true)).toBe('巡检SPC数据 ✓');
  });
});
