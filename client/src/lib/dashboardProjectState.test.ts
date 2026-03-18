import { describe, expect, it } from 'vitest';

import {
  denormalizeProjectQualifiedFlag,
  denormalizeProjectRiskLevel,
  denormalizeProjectStatus,
  getProjectQualifiedFlagLabel,
  getProjectRiskLevelLabel,
  getProjectStatusLabel,
  normalizeDashboardFilter,
  normalizeProjectDataEnums,
  normalizeProjectQualifiedFlag,
  normalizeProjectRiskLevel,
  normalizeProjectStatus,
} from './dashboardProjectState';

describe('dashboardProjectState', () => {
  it('normalizes legacy Chinese and English project status tokens to English enums', () => {
    expect(normalizeProjectStatus('已完成')).toBe('completed');
    expect(normalizeProjectStatus('项目已超时')).toBe('overdue');
    expect(normalizeProjectStatus('已延期')).toBe('delayed');
    expect(normalizeProjectStatus('进行中')).toBe('ongoing');
    expect(normalizeProjectStatus('active')).toBe('ongoing');
    expect(normalizeProjectStatus('-')).toBe('unknown');
  });

  it('normalizes risk levels and qualified flags through the adapter layer', () => {
    expect(normalizeProjectRiskLevel('高风险')).toBe('high');
    expect(normalizeProjectRiskLevel('medium')).toBe('medium');
    expect(normalizeProjectRiskLevel('正常')).toBe('low');
    expect(normalizeProjectQualifiedFlag('是')).toBe('yes');
    expect(normalizeProjectQualifiedFlag('false')).toBe('no');
  });

  it('keeps Chinese output isolated to label helpers and denormalizers', () => {
    expect(getProjectStatusLabel('completed')).toBe('已完成');
    expect(getProjectRiskLevelLabel('high')).toBe('高');
    expect(getProjectQualifiedFlagLabel('yes')).toBe('是');
    expect(denormalizeProjectStatus('completed')).toBe('已完成');
    expect(denormalizeProjectRiskLevel('medium')).toBe('中');
    expect(denormalizeProjectQualifiedFlag('no')).toBe('否');
    expect(denormalizeProjectStatus('custom-status')).toBe('custom-status');
  });

  it('normalizes dashboard filter tokens without exposing delayed as a filter state', () => {
    expect(normalizeDashboardFilter('已完成')).toBe('completed');
    expect(normalizeDashboardFilter('超时')).toBe('overdue');
    expect(normalizeDashboardFilter('进行中')).toBe('ongoing');
    expect(normalizeDashboardFilter('delayed')).toBe('ALL');
  });

  it('normalizes project payload enums in place while preserving dash placeholders', () => {
    const normalized = normalizeProjectDataEnums({
      no: '1',
      identity: {
        customerName: '',
        customerBase: '',
        projectName: 'Project A',
        productName: 'Product A',
        factory: '',
        moldSets: '',
        partNumber: '',
        cavityNumber: '',
        moldNumber: 'LA26006',
        projectManager: '',
        projectEngineer: '',
        moldProject: '',
        qe: '',
        riskLevel: '高风险',
        fitterGroup: '',
        designEngineer: '',
      },
      milestones: {
        projectStart: '',
        t1: '',
        glTime: '',
        vmp: '',
        mp: '',
        estimatedCompletion: '',
        currentStage: '',
        t1SizeQualified: '是',
        trialCount: '',
        toolingFAI: '',
        partFAI: '',
        currentNode: '进行中',
      },
      details: {
        detailSequence: '',
        detailDate: '',
        detailProgress: '',
      },
    });

    expect(normalized.identity.riskLevel).toBe('high');
    expect(normalized.milestones.t1SizeQualified).toBe('yes');
    expect(normalized.milestones.currentNode).toBe('ongoing');

    const untouchedDash = normalizeProjectDataEnums({
      ...normalized,
      identity: { ...normalized.identity, riskLevel: '-' },
      milestones: { ...normalized.milestones, t1SizeQualified: '-', currentNode: '-' },
    });

    expect(untouchedDash.identity.riskLevel).toBe('-');
    expect(untouchedDash.milestones.t1SizeQualified).toBe('-');
    expect(untouchedDash.milestones.currentNode).toBe('-');
  });
});
