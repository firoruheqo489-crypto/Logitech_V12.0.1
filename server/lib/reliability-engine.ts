import { z } from 'zod';

export const reliabilityEventTypeSchema = z.enum(['SICKNESS', 'SURGERY', 'CHECKUP']);
export const recoveryActionSchema = z.enum([
  'WEAR_PART_CLEAN_POLISH',
  'INSERT_REPLACEMENT_LOCAL_REFIT',
  'WELDING_MAJOR_MACHINING',
]);

const boundedInteger = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max);

const boundedFloat = (min: number, max: number) =>
  z
    .number()
    .finite()
    .min(min)
    .max(max);

const optionalTrimmedString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (typeof value === 'string' && value.length > 0 ? value : undefined));

const optionalBoundedInteger = (min: number, max: number) =>
  z
    .union([boundedInteger(min, max), z.null()])
    .optional()
    .transform((value) => (typeof value === 'number' ? value : undefined));

const optionalBoundedFloat = (min: number, max: number) =>
  z
    .union([boundedFloat(min, max), z.null()])
    .optional()
    .transform((value) => (typeof value === 'number' ? value : undefined));

const optionalRecoveryAction = z
  .union([recoveryActionSchema, z.null()])
  .optional()
  .transform((value) => (typeof value === 'string' ? value : undefined));

export const reliabilityEventPayloadSchema = z.object({
  moldId: z.string().trim().min(1).max(100),
  moldNo: optionalTrimmedString(64),
  type: reliabilityEventTypeSchema,
  symptom: z.string().trim().min(1).max(500),
  diagnosis: z.string().trim().min(1).max(255),
  procedure: z.string().trim().min(1).max(1000),
  operator: optionalTrimmedString(255),
  occurredAt: optionalTrimmedString(64),
  repairAction: optionalRecoveryAction,
  currentShots: optionalBoundedInteger(0, 100_000_000),
  shotsAtEvent: optionalBoundedInteger(0, 100_000_000),
  recoveryRating: boundedFloat(Number.EPSILON, 1),
  downtimeHours: optionalBoundedFloat(0, 10_000),
  cost: optionalBoundedFloat(0, 1_000_000_000),
  imageUrl: optionalTrimmedString(2048),
  estimatedCompletion: optionalTrimmedString(64),
});

export const reliabilityWorkOrderPayloadSchema = z.object({
  moldId: z.string().trim().min(1).max(100),
  moldNo: optionalTrimmedString(64),
  reason: optionalTrimmedString(1000),
  requestedBy: optionalTrimmedString(255),
});

export type ReliabilityEventType = z.infer<typeof reliabilityEventTypeSchema>;
export type MoldRepairAction = z.infer<typeof recoveryActionSchema>;
export type ReliabilityEventPayload = z.infer<typeof reliabilityEventPayloadSchema>;
export type ReliabilityWorkOrderPayload = z.infer<typeof reliabilityWorkOrderPayloadSchema>;

export type ReliabilityEventRecord = {
  id: string;
  moldId: string;
  moldNo: string | null;
  type: ReliabilityEventType;
  symptom: string;
  diagnosis: string;
  procedure: string;
  operator: string | null;
  repairAction?: MoldRepairAction | null;
  occurredAt: string;
  currentShots: number;
  recoveryRating: number;
  downtimeHours: number;
  cost: number;
  imageUrl: string | null;
  estimatedCompletion: string | null;
  createdAt: string;
};

export type ReliabilityChartZoneId = 'early_failure' | 'useful_life' | 'wear_out';
export type ReliabilityChartEventLabelKey = 'routine_pm' | 'slider_jam' | 'ejector_pin_break';

export type ReliabilityChartPoint = {
  shot: number;
  hazard: number;
  reliability: number;
  x: number;
  y: number;
};

export type ReliabilityChartMarker = {
  id: string;
  shot: number;
  physicalShot: number;
  hazard: number;
  x: number;
  y: number;
  xPct: number;
  type: 'CURRENT' | 'PM' | 'CM';
  labelKey?: ReliabilityChartEventLabelKey;
};

export type ReliabilityChartGridLine = {
  shot: number;
  xPct: number;
  label: string | null;
};

export type ReliabilityChartAxisLabel = {
  xPct: number;
  label: string;
};

export type ReliabilityChartPayload = {
  svgWidth: number;
  svgHeight: number;
  maxShots: number;
  maxHazard: number;
  earlyFailureEndPct: number;
  usefulLifeEndPct: number;
  currentZoneId: ReliabilityChartZoneId;
  curvePoints: ReliabilityChartPoint[];
  curvePath: string;
  fillPath: string;
  currentMarker: ReliabilityChartMarker;
  eventMarkers: ReliabilityChartMarker[];
  gridLines: ReliabilityChartGridLine[];
  xAxisLabels: ReliabilityChartAxisLabel[];
};

export type ReliabilityMetrics = {
  version: 1;
  moldId: string;
  moldNo: string;
  currentShots: number;
  effectiveShots: number;
  theoreticalBeta: number;
  beta: number;
  betaPenalty: number;
  theoreticalEta: number;
  eta: number;
  etaPenaltyFactor: number;
  currentReliability: number;
  hazardRate: number;
  wearOutThreshold: number;
  nextPmShots: number;
  pmIntervalShots: number;
  hazardThreshold: number;
  pmDue: boolean;
  recommendedEol: boolean;
  avgRecoveryRating: number;
  actualMtbfShots: number;
  theoreticalMtbfShots: number;
  mtbfRatio: number;
  thirtyDaySicknessCount: number;
  correctiveEventCount: number;
  checkupEventCount: number;
  totalEventCount: number;
  lastEventAt: string | null;
  lastEventType: ReliabilityEventType | null;
  moldStatus: 'ACTIVE' | 'PM_DUE' | 'EOL_RECOMMENDED' | 'UNDER_OVERHAUL';
  updatedAt: string;
  chart?: ReliabilityChartPayload;
};

export type ReliabilityProjectSeed = {
  projectId: string | null;
  moldId: string;
  moldNo: string;
  moldStatus: string | null;
  metrics: ReliabilityMetrics | null;
};

export type ReliabilityState = {
  moldId: string;
  moldNo: string;
  metrics: ReliabilityMetrics;
  events: ReliabilityEventRecord[];
};

const DEFAULT_BASE_BETA = 1.85;
const DEFAULT_BASE_ETA = 1_000_000;
const DEFAULT_RECOVERY_PENALTY_FACTOR = 0.2;
const DEFAULT_CURRENT_SHOTS = 250_000;
const DEFAULT_PM_INTERVAL_SHOTS = 50_000;
const HIGH_RISK_PM_INTERVAL_SHOTS = 10_000;
const PM_HAZARD_THRESHOLD = 0.0000012;
const PM_MANUAL_OVERRIDE_SHOTS = 200_000;
const MIN_ETA_FACTOR = 0.4;
const MAX_BETA = 6;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EOL_RELIABILITY_THRESHOLD = 0.55;
const SVG_WIDTH = 1000;
const SVG_HEIGHT = 256;
const CURVE_STEPS = 200;
const ZONE_1_END = 0.15;
const ZONE_2_END = 0.85;

export function normalizeIsoTimestamp(value?: string | null): string {
  if (!value) return new Date().toISOString();
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const normalized = trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00Z`;
  const normalizedParsed = new Date(normalized);
  if (!Number.isNaN(normalizedParsed.getTime())) {
    return normalizedParsed.toISOString();
  }

  return new Date().toISOString();
}

export function weibullReliability(shots: number, eta: number, beta: number): number {
  if (eta <= 0 || beta <= 0) return 0;
  const normalizedShots = Math.max(0, shots);
  return Math.exp(-Math.pow(normalizedShots / eta, beta));
}

export function weibullHazardRate(shots: number, eta: number, beta: number): number {
  if (eta <= 0 || beta <= 0) return 0;
  const normalizedShots = Math.max(1, shots);
  return (beta / eta) * Math.pow(normalizedShots / eta, beta - 1);
}

function gammaLanczos(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    0.000009984369578019571,
    0.00000015056327351493116,
  ];

  if (value < 0.5) {
    return Math.PI / (Math.sin(Math.PI * value) * gammaLanczos(1 - value));
  }

  let accumulator = 0.9999999999998099;
  const shifted = value - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    accumulator += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, shifted + 0.5) * Math.exp(-t) * accumulator;
}

function roundMetric(value: number, fractionDigits = 6): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(fractionDigits));
}

function sanitizeShotValue(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function sanitizeProbability(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function formatShotLabel(value: number): string {
  if (value === 0) return '0';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions % 1 === 0 ? `${millions.toFixed(0)}M` : `${millions.toFixed(1)}M`;
  }

  const thousands = value / 1_000;
  return thousands % 1 === 0 ? `${thousands.toFixed(0)}K` : `${thousands.toFixed(1)}K`;
}

function resolveChartZoneId(shots: number, maxShots: number): ReliabilityChartZoneId {
  if (maxShots <= 0) return 'early_failure';
  const pct = shots / maxShots;
  if (pct < ZONE_1_END) return 'early_failure';
  if (pct < ZONE_2_END) return 'useful_life';
  return 'wear_out';
}

function resolveMaintenanceLabelKey(eventRecord: ReliabilityEventRecord): ReliabilityChartEventLabelKey {
  if (eventRecord.type === 'CHECKUP') {
    return 'routine_pm';
  }

  const normalizedHint = `${eventRecord.symptom} ${eventRecord.diagnosis}`.toLowerCase();
  return normalizedHint.includes('ejector') ? 'ejector_pin_break' : 'slider_jam';
}

function createSmoothPath(points: ReliabilityChartPoint[]): string {
  if (points.length === 0) {
    return '';
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const point = points[index];
    const controlX = previousPoint.x + (point.x - previousPoint.x) * 0.5;
    path += ` C ${controlX} ${previousPoint.y} ${controlX} ${point.y} ${point.x} ${point.y}`;
  }
  return path;
}

const RECOVERY_BASE_BY_ACTION: Record<MoldRepairAction, number> = {
  WEAR_PART_CLEAN_POLISH: 0.98,
  INSERT_REPLACEMENT_LOCAL_REFIT: 0.85,
  WELDING_MAJOR_MACHINING: 0.7,
};

function computeRecoveryRatingFromBase(
  currentShots: number,
  limitShots: number,
  baseRecovery: number,
): number {
  const normalizedCurrentShots = sanitizeShotValue(currentShots);
  const normalizedLimitShots = Math.max(1, sanitizeShotValue(limitShots) || DEFAULT_BASE_ETA);
  const ageRatio = Math.min(1, normalizedCurrentShots / normalizedLimitShots);
  const actualRecovery = baseRecovery * (1 - ageRatio * DEFAULT_RECOVERY_PENALTY_FACTOR);
  return roundMetric(Math.min(baseRecovery, Math.max(Number.EPSILON, actualRecovery)), 6);
}

function resolveRecoveryBase(action: MoldRepairAction): number {
  return RECOVERY_BASE_BY_ACTION[action];
}

export function computeActionRecoveryRating(
  currentShots: number,
  limitShots: number,
  action: MoldRepairAction,
): number {
  return computeRecoveryRatingFromBase(currentShots, limitShots, resolveRecoveryBase(action));
}

export function computePmRecoveryRating(currentShots: number, limitShots: number): number {
  return computeRecoveryRatingFromBase(currentShots, limitShots, 0.95);
}

function parseStoredMetrics(value: unknown): ReliabilityMetrics | null {
  const chartSchema = z.object({
    svgWidth: z.number(),
    svgHeight: z.number(),
    maxShots: z.number(),
    maxHazard: z.number(),
    earlyFailureEndPct: z.number(),
    usefulLifeEndPct: z.number(),
    currentZoneId: z.enum(['early_failure', 'useful_life', 'wear_out']),
    curvePoints: z.array(z.object({
      shot: z.number(),
      hazard: z.number(),
      reliability: z.number(),
      x: z.number(),
      y: z.number(),
    })),
    curvePath: z.string(),
    fillPath: z.string(),
    currentMarker: z.object({
      id: z.string(),
      shot: z.number(),
      physicalShot: z.number(),
      hazard: z.number(),
      x: z.number(),
      y: z.number(),
      xPct: z.number(),
      type: z.enum(['CURRENT', 'PM', 'CM']),
      labelKey: z.enum(['routine_pm', 'slider_jam', 'ejector_pin_break']).optional(),
    }),
    eventMarkers: z.array(z.object({
      id: z.string(),
      shot: z.number(),
      physicalShot: z.number(),
      hazard: z.number(),
      x: z.number(),
      y: z.number(),
      xPct: z.number(),
      type: z.enum(['CURRENT', 'PM', 'CM']),
      labelKey: z.enum(['routine_pm', 'slider_jam', 'ejector_pin_break']).optional(),
    })),
    gridLines: z.array(z.object({
      shot: z.number(),
      xPct: z.number(),
      label: z.string().nullable(),
    })),
    xAxisLabels: z.array(z.object({
      xPct: z.number(),
      label: z.string(),
    })),
  });

  const schema = z.object({
    version: z.literal(1),
    moldId: z.string(),
    moldNo: z.string(),
    currentShots: z.number(),
    effectiveShots: z.number(),
    theoreticalBeta: z.number(),
    beta: z.number(),
    betaPenalty: z.number(),
    theoreticalEta: z.number(),
    eta: z.number(),
    etaPenaltyFactor: z.number(),
    currentReliability: z.number(),
    hazardRate: z.number(),
    wearOutThreshold: z.number(),
    nextPmShots: z.number(),
    pmIntervalShots: z.number(),
    hazardThreshold: z.number(),
    pmDue: z.boolean(),
    recommendedEol: z.boolean(),
    avgRecoveryRating: z.number(),
    actualMtbfShots: z.number(),
    theoreticalMtbfShots: z.number(),
    mtbfRatio: z.number(),
    thirtyDaySicknessCount: z.number(),
    correctiveEventCount: z.number(),
    checkupEventCount: z.number(),
    totalEventCount: z.number(),
    lastEventAt: z.string().nullable(),
    lastEventType: reliabilityEventTypeSchema.nullable(),
    moldStatus: z.enum(['ACTIVE', 'PM_DUE', 'EOL_RECOMMENDED', 'UNDER_OVERHAUL']),
    updatedAt: z.string(),
    chart: chartSchema.optional(),
  });

  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createProjectSeed(input: {
  moldId: string;
  moldNo?: string | null;
  moldStatus?: string | null;
  metrics?: unknown;
  projectId?: string | null;
}): ReliabilityProjectSeed {
  return {
    projectId: input.projectId ?? null,
    moldId: input.moldId.trim(),
    moldNo: (input.moldNo || '').trim(),
    moldStatus: input.moldStatus ?? null,
    metrics: parseStoredMetrics(input.metrics),
  };
}

function getResolvedCurrentShots(seed: ReliabilityProjectSeed, events: ReliabilityEventRecord[], overrideShots?: number): number {
  const lastEventShots = events.reduce((maxShots, eventRecord) => (
    Math.max(maxShots, sanitizeShotValue(eventRecord.currentShots))
  ), 0);
  const seedShots = sanitizeShotValue(seed.metrics?.currentShots);
  const requestedShots = sanitizeShotValue(overrideShots);
  return Math.max(DEFAULT_CURRENT_SHOTS, seedShots, lastEventShots, requestedShots);
}

type EffectiveAgeTimelinePoint = {
  eventId: string;
  physicalShot: number;
  effectiveShot: number;
  eventRecord: ReliabilityEventRecord;
};

function buildEffectiveAgeTimeline(events: ReliabilityEventRecord[], currentShots: number): {
  currentEffectiveShots: number;
  points: EffectiveAgeTimelinePoint[];
} {
  const orderedEvents = [...events].sort((left, right) => {
    if (left.occurredAt === right.occurredAt) {
      return left.currentShots - right.currentShots;
    }
    return left.occurredAt.localeCompare(right.occurredAt);
  });

  let effectiveShots = 0;
  let previousPhysicalShots = 0;
  const points: EffectiveAgeTimelinePoint[] = [];

  for (const eventRecord of orderedEvents) {
    const absoluteShots = Math.max(previousPhysicalShots, sanitizeShotValue(eventRecord.currentShots));
    effectiveShots += absoluteShots - previousPhysicalShots;
    effectiveShots *= 1 - sanitizeProbability(eventRecord.recoveryRating);
    previousPhysicalShots = absoluteShots;
    points.push({
      eventId: eventRecord.id,
      physicalShot: absoluteShots,
      effectiveShot: Math.max(0, Math.round(effectiveShots)),
      eventRecord,
    });
  }

  effectiveShots += Math.max(0, currentShots - previousPhysicalShots);
  return {
    currentEffectiveShots: Math.max(0, Math.round(effectiveShots)),
    points,
  };
}

function computeActualMtbfShots(events: ReliabilityEventRecord[], fallback: number): number {
  const correctiveEvents = [...events]
    .filter((eventRecord) => eventRecord.type === 'SICKNESS' || eventRecord.type === 'SURGERY')
    .sort((left, right) => left.currentShots - right.currentShots);

  if (correctiveEvents.length <= 1) {
    return fallback;
  }

  const deltas: number[] = [];
  for (let index = 1; index < correctiveEvents.length; index += 1) {
    const delta = correctiveEvents[index].currentShots - correctiveEvents[index - 1].currentShots;
    if (delta > 0) {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) {
    return fallback;
  }

  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  return Math.round(total / deltas.length);
}

function resolveMoldStatus(params: {
  seedStatus: string | null;
  pmDue: boolean;
  recommendedEol: boolean;
}): ReliabilityMetrics['moldStatus'] {
  if (params.seedStatus === 'UNDER_OVERHAUL') {
    return 'UNDER_OVERHAUL';
  }
  if (params.recommendedEol) {
    return 'EOL_RECOMMENDED';
  }
  if (params.pmDue) {
    return 'PM_DUE';
  }
  return 'ACTIVE';
}

function mapMoldNo(seed: ReliabilityProjectSeed, events: ReliabilityEventRecord[], moldNo?: string | null): string {
  const incoming = (moldNo || '').trim();
  if (incoming) return incoming;
  if (seed.moldNo) return seed.moldNo;
  const lastEventMoldNo = [...events]
    .reverse()
    .map((eventRecord) => (eventRecord.moldNo || '').trim())
    .find(Boolean);
  return lastEventMoldNo || 'NO. -';
}

function buildChartPayload(params: {
  effectiveShots: number;
  currentShots: number;
  eta: number;
  beta: number;
  timeline: EffectiveAgeTimelinePoint[];
}): ReliabilityChartPayload {
  const maxShots = DEFAULT_BASE_ETA;
  const curvePoints: ReliabilityChartPoint[] = [];
  let maxHazard = 0;

  for (let step = 0; step <= CURVE_STEPS; step += 1) {
    const shot = Math.round((step / CURVE_STEPS) * maxShots);
    const hazard = weibullHazardRate(shot, maxShots, params.beta);
    if (hazard > maxHazard) {
      maxHazard = hazard;
    }
    curvePoints.push({
      shot,
      hazard: roundMetric(hazard, 10),
      reliability: roundMetric(weibullReliability(shot, maxShots, params.beta), 6),
      x: roundMetric((step / CURVE_STEPS) * SVG_WIDTH, 4),
      y: SVG_HEIGHT,
    });
  }

  const safeMaxHazard = maxHazard > 0 ? maxHazard : 1;
  const normalizedCurvePoints = curvePoints.map((point) => ({
    ...point,
    y: roundMetric(
      SVG_HEIGHT - (point.hazard / safeMaxHazard) * (SVG_HEIGHT * 0.85) - SVG_HEIGHT * 0.05,
      4,
    ),
  }));

  const buildMarker = (
    markerId: string,
    shot: number,
    physicalShot: number,
    hazard: number,
    type: ReliabilityChartMarker['type'],
    labelKey?: ReliabilityChartEventLabelKey,
  ): ReliabilityChartMarker => {
    const normalizedShot = Math.max(0, Math.min(maxShots, physicalShot));
    const normalizedHazard = weibullHazardRate(normalizedShot, maxShots, params.beta);
    const x = roundMetric((normalizedShot / maxShots) * SVG_WIDTH, 4);
    const y = roundMetric(
      SVG_HEIGHT - (normalizedHazard / safeMaxHazard) * (SVG_HEIGHT * 0.85) - SVG_HEIGHT * 0.05,
      4,
    );

    return {
      id: markerId,
      shot: normalizedShot,
      physicalShot,
      hazard: roundMetric(normalizedHazard, 10),
      x,
      y,
      xPct: roundMetric((normalizedShot / maxShots) * 100, 4),
      type,
      labelKey,
    };
  };

  const eventMarkers = params.timeline.map((timelinePoint) => buildMarker(
    timelinePoint.eventId,
    timelinePoint.physicalShot,
    timelinePoint.physicalShot,
    weibullHazardRate(timelinePoint.physicalShot, maxShots, params.beta),
    timelinePoint.eventRecord.type === 'CHECKUP' ? 'PM' : 'CM',
    resolveMaintenanceLabelKey(timelinePoint.eventRecord),
  ));

  const currentMarker = buildMarker(
    'current',
    params.currentShots,
    params.currentShots,
    weibullHazardRate(params.currentShots, maxShots, params.beta),
    'CURRENT',
  );

  const gridLines: ReliabilityChartGridLine[] = Array.from({ length: 11 }, (_, index) => {
    const shot = Math.round((index / 10) * maxShots);
    const xPct = roundMetric((index / 10) * 100, 4);
    return {
      shot,
      xPct,
      label: index > 0 && index < 10 ? formatShotLabel(shot) : null,
    };
  });

  const xAxisLabels: ReliabilityChartAxisLabel[] = Array.from({ length: 5 }, (_, index) => {
    const pct = index / 4;
    return {
      xPct: roundMetric(pct * 100, 4),
      label: formatShotLabel(Math.round(maxShots * pct)),
    };
  });

  const curvePath = createSmoothPath(normalizedCurvePoints);

  return {
    svgWidth: SVG_WIDTH,
    svgHeight: SVG_HEIGHT,
    maxShots,
    maxHazard: roundMetric(safeMaxHazard, 10),
    earlyFailureEndPct: roundMetric(ZONE_1_END * 100, 4),
    usefulLifeEndPct: roundMetric(ZONE_2_END * 100, 4),
    currentZoneId: resolveChartZoneId(params.currentShots, maxShots),
    curvePoints: normalizedCurvePoints,
    curvePath,
    fillPath: `${curvePath} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`,
    currentMarker,
    eventMarkers,
    gridLines,
    xAxisLabels,
  };
}

export function buildReliabilityState(params: {
  moldId: string;
  moldNo?: string | null;
  seed: ReliabilityProjectSeed;
  events: ReliabilityEventRecord[];
  currentShotsOverride?: number;
  now?: Date;
}): ReliabilityState {
  const now = params.now ?? new Date();
  const normalizedMoldId = params.moldId.trim();
  const currentShots = getResolvedCurrentShots(params.seed, params.events, params.currentShotsOverride);
  const timeline = buildEffectiveAgeTimeline(params.events, currentShots);
  const effectiveShots = timeline.currentEffectiveShots;
  const theoreticalBeta = params.seed.metrics?.theoreticalBeta ?? DEFAULT_BASE_BETA;
  const theoreticalEta = sanitizeShotValue(params.seed.metrics?.theoreticalEta ?? DEFAULT_BASE_ETA);
  const thirtyDayCutoff = now.getTime() - THIRTY_DAYS_MS;
  const thirtyDaySicknessCount = params.events.filter((eventRecord) => (
    eventRecord.type === 'SICKNESS' && new Date(eventRecord.occurredAt).getTime() >= thirtyDayCutoff
  )).length;
  const betaPenalty = thirtyDaySicknessCount > 3 ? roundMetric(thirtyDaySicknessCount * 0.15, 4) : 0;
  const beta = Math.min(MAX_BETA, roundMetric(theoreticalBeta + betaPenalty, 4));

  const correctiveEvents = params.events.filter((eventRecord) => (
    eventRecord.type === 'SICKNESS' || eventRecord.type === 'SURGERY'
  ));
  const avgRecoveryRating = correctiveEvents.length > 0
    ? correctiveEvents.reduce((sum, eventRecord) => sum + sanitizeProbability(eventRecord.recoveryRating), 0) / correctiveEvents.length
    : 1;
  const correctiveDeficit = correctiveEvents.length > 0
    ? correctiveEvents.reduce((sum, eventRecord) => sum + (1 - sanitizeProbability(eventRecord.recoveryRating)), 0) / correctiveEvents.length
    : 0;
  const severeLowRecoveryCount = correctiveEvents.filter((eventRecord) => eventRecord.recoveryRating < 0.6).length;
  const etaPenaltyFactor = Math.max(
    MIN_ETA_FACTOR,
    1 - correctiveDeficit * 0.45 - severeLowRecoveryCount * 0.05 - Math.max(0, correctiveEvents.length - 2) * 0.02,
  );
  const eta = Math.max(100_000, Math.round(theoreticalEta * etaPenaltyFactor));
  const currentReliability = roundMetric(weibullReliability(effectiveShots, eta, beta), 6);
  const hazardRate = roundMetric(weibullHazardRate(effectiveShots, eta, beta), 10);
  const theoreticalMtbfShots = Math.max(1, Math.round(theoreticalEta * gammaLanczos(1 + 1 / theoreticalBeta)));
  const actualMtbfShots = computeActualMtbfShots(params.events, theoreticalMtbfShots);
  const mtbfRatio = roundMetric(actualMtbfShots / theoreticalMtbfShots, 6);
  const pmIntervalShots = effectiveShots >= eta * 0.85 || beta >= 2.6
    ? HIGH_RISK_PM_INTERVAL_SHOTS
    : DEFAULT_PM_INTERVAL_SHOTS;

  let nextPmShots = sanitizeShotValue(params.seed.metrics?.nextPmShots);
  const lastEvent = params.events.length > 0 ? [...params.events].sort((left, right) => (
    right.occurredAt.localeCompare(left.occurredAt)
  ))[0] : null;
  if (!nextPmShots || nextPmShots <= currentShots) {
    nextPmShots = currentShots + pmIntervalShots;
  }
  if (lastEvent?.type === 'CHECKUP') {
    nextPmShots = currentShots + pmIntervalShots;
  }

  const pmDue = hazardRate >= PM_HAZARD_THRESHOLD
    || currentShots >= nextPmShots
    || effectiveShots >= PM_MANUAL_OVERRIDE_SHOTS;
  const recommendedEol = avgRecoveryRating < 0.6
    || mtbfRatio < 0.4
    || beta > 3.0
    || currentReliability < EOL_RELIABILITY_THRESHOLD;
  const moldStatus = resolveMoldStatus({
    seedStatus: params.seed.moldStatus,
    pmDue,
    recommendedEol,
  });
  const moldNo = mapMoldNo(params.seed, params.events, params.moldNo);
  const chart = buildChartPayload({
    effectiveShots,
    currentShots,
    eta,
    beta,
    timeline: timeline.points,
  });

  const metrics: ReliabilityMetrics = {
    version: 1,
    moldId: normalizedMoldId,
    moldNo,
    currentShots,
    effectiveShots,
    theoreticalBeta: roundMetric(theoreticalBeta, 4),
    beta,
    betaPenalty,
    theoreticalEta,
    eta,
    etaPenaltyFactor: roundMetric(etaPenaltyFactor, 6),
    currentReliability,
    hazardRate,
    wearOutThreshold: Math.floor(eta * 0.85),
    nextPmShots,
    pmIntervalShots,
    hazardThreshold: PM_HAZARD_THRESHOLD,
    pmDue,
    recommendedEol,
    avgRecoveryRating: roundMetric(avgRecoveryRating, 6),
    actualMtbfShots,
    theoreticalMtbfShots,
    mtbfRatio,
    thirtyDaySicknessCount,
    correctiveEventCount: correctiveEvents.length,
    checkupEventCount: params.events.filter((eventRecord) => eventRecord.type === 'CHECKUP').length,
    totalEventCount: params.events.length,
    lastEventAt: lastEvent?.occurredAt ?? null,
    lastEventType: lastEvent?.type ?? null,
    moldStatus,
    updatedAt: now.toISOString(),
    chart,
  };

  return {
    moldId: normalizedMoldId,
    moldNo,
    metrics,
    events: [...params.events].sort((left, right) => (
      right.occurredAt.localeCompare(left.occurredAt)
    )),
  };
}
