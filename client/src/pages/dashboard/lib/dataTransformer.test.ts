import { describe, expect, it } from 'vitest';

import { transformDataToProject, transformProjectToData } from './dataTransformer';

describe('dataTransformer', () => {
  it('reads legacy localized dashboard enums into English machine values', () => {
    const normalized = transformProjectToData(
      {
        id: 1,
        customerName: 'Customer',
        customerBase: null,
        projectName: 'Project A',
        productName: 'Product A',
        factoryLocation: null,
        moldCount: null,
        partNumber: null,
        cavityNumber: null,
        moldId: 'LA26006',
        pmName: null,
        peName: null,
        moldLead: null,
        pqeName: null,
        riskLevel: '\u9ad8\u98ce\u9669',
        fitterGroup: null,
        designEngineer: null,
        kickoffDate: null,
        t1Date: null,
        glDate: null,
        vmpDate: null,
        mpDate: null,
        currentStage: null,
        t1DimensionOk: '\u662f',
        trialCount: null,
        toolingFai: null,
        partFai: null,
        currentNode: '\u8fdb\u884c\u4e2d',
        estimatedCompletion: null,
        progressDetails: null,
        updateDate: null,
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-19T00:00:00.000Z',
      },
      0,
    );

    expect(normalized.identity.riskLevel).toBe('high');
    expect(normalized.milestones.t1SizeQualified).toBe('yes');
    expect(normalized.milestones.currentNode).toBe('ongoing');
  });

  it('writes dashboard enums back as English machine values', () => {
    const serialized = transformDataToProject({
      no: '1',
      identity: {
        customerName: 'Customer',
        customerBase: '-',
        projectName: 'Project A',
        productName: 'Product A',
        factory: '-',
        moldSets: '-',
        partNumber: '-',
        cavityNumber: '-',
        moldNumber: 'LA26006',
        projectManager: '-',
        projectEngineer: '-',
        moldProject: '-',
        qe: '-',
        riskLevel: 'high',
        fitterGroup: '-',
        designEngineer: '-',
      },
      milestones: {
        projectStart: '-',
        t1: '-',
        glTime: '-',
        vmp: '-',
        mp: '-',
        estimatedCompletion: '-',
        currentStage: '-',
        t1SizeQualified: 'yes',
        trialCount: '-',
        toolingFAI: '-',
        partFAI: '-',
        currentNode: 'ongoing',
      },
      details: {
        detailSequence: '1',
        detailDate: '-',
        detailProgress: '-',
      },
    });

    expect(serialized.riskLevel).toBe('high');
    expect(serialized.t1DimensionOk).toBe('yes');
    expect(serialized.currentNode).toBe('ongoing');
  });
});
