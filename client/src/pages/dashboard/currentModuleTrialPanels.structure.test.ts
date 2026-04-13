import { describe, expect, it } from 'vitest';

import { formatProductSequenceLabel, normalizeMoldLookupKey } from './lib/productModuleUtils';

function buildCurrentModuleTrialPanels(
  currentModuleData: Array<{ no?: string; identity?: { moldNumber?: string } }>,
  currentModuleMoldIds: string[],
) {
  const seen = new Set<string>();
  const panels = currentModuleData.flatMap((project) => {
    const moldId = project.identity?.moldNumber?.trim() || '';
    const moldNo = formatProductSequenceLabel(project.no) || '';
    if (!moldId || !moldNo) return [];

    const panelKey = `${normalizeMoldLookupKey(moldId)}::${moldNo}`;
    if (seen.has(panelKey)) return [];
    seen.add(panelKey);

    return [{ moldId, moldNo }];
  });

  if (panels.length > 0) {
    return panels;
  }

  const fallbackMoldId = currentModuleData[0]?.identity?.moldNumber?.trim() || currentModuleMoldIds[0] || 'LA26006';
  return [{ moldId: fallbackMoldId, moldNo: 'NO. -' }];
}

describe('currentModuleTrialPanels', () => {
  it('uses the project no from the home card data instead of inventing an index', () => {
    const panels = buildCurrentModuleTrialPanels(
      [
        { no: '5', identity: { moldNumber: 'LA26021' } },
        { no: '8', identity: { moldNumber: 'LA26022' } },
      ],
      ['LA26021', 'LA26022'],
    );

    expect(panels).toEqual([
      { moldId: 'LA26021', moldNo: 'No. 5' },
      { moldId: 'LA26022', moldNo: 'No. 8' },
    ]);
  });

  it('falls back safely when no home card no is available', () => {
    const panels = buildCurrentModuleTrialPanels([], ['LA26006']);
    expect(panels).toEqual([{ moldId: 'LA26006', moldNo: 'NO. -' }]);
  });
});
