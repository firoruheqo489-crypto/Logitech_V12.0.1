import { describe, expect, it } from 'vitest';

import {
  buildReliabilityState,
  computePmRecoveryRating,
  createProjectSeed,
  type ReliabilityEventRecord,
} from './reliability-engine.js';

function buildEvent(input: Partial<ReliabilityEventRecord> & Pick<ReliabilityEventRecord, 'id' | 'type' | 'occurredAt' | 'currentShots' | 'recoveryRating'>): ReliabilityEventRecord {
  return {
    moldId: 'FRACAS-TEST',
    moldNo: 'NO. TEST',
    symptom: 'slider jam',
    diagnosis: 'slider jam',
    procedure: 'repair',
    operator: 'tester',
    downtimeHours: 2,
    cost: 100,
    imageUrl: null,
    estimatedCompletion: null,
    createdAt: input.occurredAt,
    ...input,
  };
}

describe('reliability-engine', () => {
  it('decays PM recovery as the mold ages', () => {
    const earlyPmRecovery = computePmRecoveryRating(100_000, 1_000_000);
    const latePmRecovery = computePmRecoveryRating(900_000, 1_000_000);

    expect(earlyPmRecovery).toBeGreaterThan(latePmRecovery);
    expect(earlyPmRecovery).toBeCloseTo(0.931, 3);
    expect(latePmRecovery).toBeCloseTo(0.779, 3);
  });

  it('builds backend chart data and accumulates beta penalty after repeated sickness events', () => {
    const seed = createProjectSeed({
      moldId: 'FRACAS-TEST',
      moldNo: 'NO. TEST',
      metrics: null,
    });

    const events: ReliabilityEventRecord[] = [
      buildEvent({ id: '1', type: 'SICKNESS', occurredAt: '2026-03-01T00:00:00.000Z', currentShots: 820_000, recoveryRating: 0.2 }),
      buildEvent({ id: '2', type: 'SICKNESS', occurredAt: '2026-03-05T00:00:00.000Z', currentShots: 820_250, recoveryRating: 0.2 }),
      buildEvent({ id: '3', type: 'SICKNESS', occurredAt: '2026-03-09T00:00:00.000Z', currentShots: 820_500, recoveryRating: 0.2 }),
      buildEvent({ id: '4', type: 'SICKNESS', occurredAt: '2026-03-12T00:00:00.000Z', currentShots: 820_750, recoveryRating: 0.2 }),
    ];

    const state = buildReliabilityState({
      moldId: 'FRACAS-TEST',
      moldNo: 'NO. TEST',
      seed,
      events,
      currentShotsOverride: 821_000,
      now: new Date('2026-03-21T00:00:00.000Z'),
    });

    expect(state.metrics.beta).toBeGreaterThan(state.metrics.theoreticalBeta);
    expect(state.metrics.betaPenalty).toBe(0.6);
    expect(state.metrics.chart?.curvePoints.length).toBe(201);
    expect(state.metrics.chart?.curvePath.length).toBeGreaterThan(0);
    expect(state.metrics.chart?.currentMarker.type).toBe('CURRENT');
    expect(state.metrics.chart?.eventMarkers.length).toBe(4);
  });
});
