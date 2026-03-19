import { describe, expect, it } from 'vitest';

import {
  getProjectQualifiedFlagLabel,
  getProjectRiskLevelLabel,
  getProjectStatusLabel,
  normalizeDashboardFilter,
  normalizeProjectDataEnums,
  normalizeProjectQualifiedFlag,
  normalizeProjectRiskLevel,
  normalizeProjectStatus,
  toProjectQualifiedFlagMachineValue,
  toProjectRiskLevelMachineValue,
  toProjectStatusMachineValue,
} from './dashboardProjectState';

describe('dashboardProjectState', () => {
  it('normalizes legacy Chinese and English project status tokens to English enums', () => {
    expect(normalizeProjectStatus('\u5df2\u5b8c\u6210')).toBe('completed');
    expect(normalizeProjectStatus('\u9879\u76ee\u5df2\u8d85\u65f6')).toBe('overdue');
    expect(normalizeProjectStatus('\u5df2\u5ef6\u671f')).toBe('delayed');
    expect(normalizeProjectStatus('\u8fdb\u884c\u4e2d')).toBe('ongoing');
    expect(normalizeProjectStatus('active')).toBe('ongoing');
    expect(normalizeProjectStatus('-')).toBe('unknown');
  });

  it('normalizes risk levels and qualified flags through the adapter layer', () => {
    expect(normalizeProjectRiskLevel('\u9ad8\u98ce\u9669')).toBe('high');
    expect(normalizeProjectRiskLevel('medium')).toBe('medium');
    expect(normalizeProjectRiskLevel('\u6b63\u5e38')).toBe('low');
    expect(normalizeProjectQualifiedFlag('\u662f')).toBe('yes');
    expect(normalizeProjectQualifiedFlag('false')).toBe('no');
  });

  it('keeps Chinese isolated to label helpers while storage values stay in English', () => {
    expect(getProjectStatusLabel('completed')).toBe('\u5df2\u5b8c\u6210');
    expect(getProjectRiskLevelLabel('high')).toBe('\u9ad8\u98ce\u9669');
    expect(getProjectQualifiedFlagLabel('yes')).toBe('\u662f');

    expect(toProjectStatusMachineValue('\u5df2\u5b8c\u6210')).toBe('completed');
    expect(toProjectRiskLevelMachineValue('\u4e2d')).toBe('medium');
    expect(toProjectQualifiedFlagMachineValue('\u5426')).toBe('no');
    expect(toProjectStatusMachineValue('custom-status')).toBe('custom-status');
  });

  it('normalizes dashboard filter tokens without exposing delayed as a filter state', () => {
    expect(normalizeDashboardFilter('\u5df2\u5b8c\u6210')).toBe('completed');
    expect(normalizeDashboardFilter('\u8d85\u65f6')).toBe('overdue');
    expect(normalizeDashboardFilter('\u8fdb\u884c\u4e2d')).toBe('ongoing');
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
        riskLevel: '\u9ad8\u98ce\u9669',
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
        t1SizeQualified: '\u662f',
        trialCount: '',
        toolingFAI: '',
        partFAI: '',
        currentNode: '\u8fdb\u884c\u4e2d',
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
