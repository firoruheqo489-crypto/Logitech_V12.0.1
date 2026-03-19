import { describe, expect, it } from 'vitest';

import { getZoneMeta } from './pages/dashboard/components/tooling-lifecycle/toolingLifecycleMath';
import { DEFAULT_MAINTENANCE_EVENTS } from './pages/dashboard/components/tooling-lifecycle/toolingLifecycleModel';

describe('tooling lifecycle machine state boundaries', () => {
  it('returns english zone ids from the math layer', () => {
    expect(getZoneMeta(10_000, 1_000_000)).toMatchObject({
      zone: 1,
      zoneId: 'early_failure',
    });
    expect(getZoneMeta(500_000, 1_000_000)).toMatchObject({
      zone: 2,
      zoneId: 'useful_life',
    });
    expect(getZoneMeta(950_000, 1_000_000)).toMatchObject({
      zone: 3,
      zoneId: 'wear_out',
    });
  });

  it('keeps default maintenance events on english label keys only', () => {
    expect(DEFAULT_MAINTENANCE_EVENTS).toEqual([
      expect.objectContaining({ labelKey: 'routine_pm' }),
      expect.objectContaining({ labelKey: 'slider_jam' }),
      expect.objectContaining({ labelKey: 'ejector_pin_break' }),
    ]);
  });
});
