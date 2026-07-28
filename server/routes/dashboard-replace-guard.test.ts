import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_REPLACE_CONFIRMATION_HEADER,
  DASHBOARD_REPLACE_CONFIRMATION_VALUE,
  assessDashboardReplaceRisk,
} from './dashboard.js';

describe('dashboard project replacement guardrails', () => {
  it('blocks the 16-to-1 accidental replacement that caused the incident', () => {
    expect(assessDashboardReplaceRisk({
      beforeCount: 16,
      afterCount: 1,
      beforeModuleCount: 2,
      afterModuleCount: 1,
      removedModuleCount: 1,
    })).toMatchObject({
      deletedCount: 15,
      reason: 'majority-row-delete',
      requiresConfirmation: true,
    });
  });

  it('allows ordinary full-workbook updates with only a small row reduction', () => {
    expect(assessDashboardReplaceRisk({
      beforeCount: 16,
      afterCount: 14,
      beforeModuleCount: 4,
      afterModuleCount: 4,
      removedModuleCount: 0,
    })).toMatchObject({
      deletedCount: 2,
      reason: 'none',
      requiresConfirmation: false,
    });
  });

  it('also blocks a workbook that removes most project modules', () => {
    expect(assessDashboardReplaceRisk({
      beforeCount: 3,
      afterCount: 1,
      beforeModuleCount: 3,
      afterModuleCount: 1,
      removedModuleCount: 2,
    })).toMatchObject({
      reason: 'majority-module-delete',
      requiresConfirmation: true,
    });
  });

  it('keeps the explicit confirmation contract stable', () => {
    expect(DASHBOARD_REPLACE_CONFIRMATION_HEADER).toBe('x-dashboard-replace-confirmation');
    expect(DASHBOARD_REPLACE_CONFIRMATION_VALUE).toBe('allow-destructive');
  });
});
