import { apiFetch } from '@/lib/api';

export type ReliabilityEventType = 'SICKNESS' | 'SURGERY' | 'CHECKUP';
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

export type ReliabilityEventRecord = {
  id: string;
  moldId: string;
  moldNo: string | null;
  type: ReliabilityEventType;
  symptom: string;
  diagnosis: string;
  procedure: string;
  operator: string | null;
  occurredAt: string;
  currentShots: number;
  recoveryRating: number;
  downtimeHours: number;
  cost: number;
  imageUrl: string | null;
  estimatedCompletion: string | null;
  createdAt: string;
};

export type ReliabilityState = {
  moldId: string;
  moldNo: string;
  metrics: ReliabilityMetrics;
  events: ReliabilityEventRecord[];
};

export type DashboardReliabilityStats = {
  totalProjects: number;
  reliability: ReliabilityMetrics | null;
  moldId: string | null;
  moldNo: string | null;
  lastEvent: ReliabilityEventRecord | null;
};

export type ReliabilityEventInput = {
  moldId: string;
  moldNo?: string;
  type: ReliabilityEventType;
  symptom: string;
  diagnosis: string;
  procedure: string;
  operator?: string;
  occurredAt?: string;
  currentShots?: number;
  recoveryRating: number;
  downtimeHours?: number;
  cost?: number;
  imageUrl?: string;
  estimatedCompletion?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function readNullableString(value: unknown): string | null {
  const normalized = readString(value).trim();
  return normalized ? normalized : null;
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeMetrics(raw: unknown): ReliabilityMetrics | null {
  const row = asRecord(raw);
  if (!row) return null;

  return {
    version: 1,
    moldId: readString(row.moldId),
    moldNo: readString(row.moldNo),
    currentShots: readNumber(row.currentShots),
    effectiveShots: readNumber(row.effectiveShots),
    theoreticalBeta: readNumber(row.theoreticalBeta),
    beta: readNumber(row.beta),
    betaPenalty: readNumber(row.betaPenalty),
    theoreticalEta: readNumber(row.theoreticalEta),
    eta: readNumber(row.eta),
    etaPenaltyFactor: readNumber(row.etaPenaltyFactor),
    currentReliability: readNumber(row.currentReliability),
    hazardRate: readNumber(row.hazardRate),
    wearOutThreshold: readNumber(row.wearOutThreshold),
    nextPmShots: readNumber(row.nextPmShots),
    pmIntervalShots: readNumber(row.pmIntervalShots),
    hazardThreshold: readNumber(row.hazardThreshold),
    pmDue: readBoolean(row.pmDue),
    recommendedEol: readBoolean(row.recommendedEol),
    avgRecoveryRating: readNumber(row.avgRecoveryRating),
    actualMtbfShots: readNumber(row.actualMtbfShots),
    theoreticalMtbfShots: readNumber(row.theoreticalMtbfShots),
    mtbfRatio: readNumber(row.mtbfRatio),
    thirtyDaySicknessCount: readNumber(row.thirtyDaySicknessCount),
    correctiveEventCount: readNumber(row.correctiveEventCount),
    checkupEventCount: readNumber(row.checkupEventCount),
    totalEventCount: readNumber(row.totalEventCount),
    lastEventAt: readNullableString(row.lastEventAt),
    lastEventType: (readNullableString(row.lastEventType) as ReliabilityEventType | null),
    moldStatus: (readString(row.moldStatus) as ReliabilityMetrics['moldStatus']) || 'ACTIVE',
    updatedAt: readString(row.updatedAt),
    chart: normalizeChart(row.chart),
  };
}

function normalizeChartPoint(raw: unknown): ReliabilityChartPoint | null {
  const row = asRecord(raw);
  if (!row) return null;

  return {
    shot: readNumber(row.shot),
    hazard: readNumber(row.hazard),
    reliability: readNumber(row.reliability),
    x: readNumber(row.x),
    y: readNumber(row.y),
  };
}

function normalizeChartMarker(raw: unknown): ReliabilityChartMarker | null {
  const row = asRecord(raw);
  if (!row) return null;

  return {
    id: readString(row.id),
    shot: readNumber(row.shot),
    physicalShot: readNumber(row.physicalShot),
    hazard: readNumber(row.hazard),
    x: readNumber(row.x),
    y: readNumber(row.y),
    xPct: readNumber(row.xPct),
    type: (readString(row.type) as ReliabilityChartMarker['type']) || 'CURRENT',
    labelKey: (readNullableString(row.labelKey) as ReliabilityChartEventLabelKey | null) || undefined,
  };
}

function normalizeChart(raw: unknown): ReliabilityChartPayload | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;

  const currentMarker = normalizeChartMarker(row.currentMarker);
  if (!currentMarker) return undefined;

  return {
    svgWidth: readNumber(row.svgWidth),
    svgHeight: readNumber(row.svgHeight),
    maxShots: readNumber(row.maxShots),
    maxHazard: readNumber(row.maxHazard),
    earlyFailureEndPct: readNumber(row.earlyFailureEndPct),
    usefulLifeEndPct: readNumber(row.usefulLifeEndPct),
    currentZoneId: (readString(row.currentZoneId) as ReliabilityChartZoneId) || 'early_failure',
    curvePoints: Array.isArray(row.curvePoints)
      ? row.curvePoints.map((point) => normalizeChartPoint(point)).filter((point): point is ReliabilityChartPoint => point !== null)
      : [],
    curvePath: readString(row.curvePath),
    fillPath: readString(row.fillPath),
    currentMarker,
    eventMarkers: Array.isArray(row.eventMarkers)
      ? row.eventMarkers.map((marker) => normalizeChartMarker(marker)).filter((marker): marker is ReliabilityChartMarker => marker !== null)
      : [],
    gridLines: Array.isArray(row.gridLines)
      ? row.gridLines.map((line) => {
          const lineRow = asRecord(line);
          if (!lineRow) return null;
          return {
            shot: readNumber(lineRow.shot),
            xPct: readNumber(lineRow.xPct),
            label: readNullableString(lineRow.label),
          } satisfies ReliabilityChartGridLine;
        }).filter((line): line is ReliabilityChartGridLine => line !== null)
      : [],
    xAxisLabels: Array.isArray(row.xAxisLabels)
      ? row.xAxisLabels.map((label) => {
          const labelRow = asRecord(label);
          if (!labelRow) return null;
          return {
            xPct: readNumber(labelRow.xPct),
            label: readString(labelRow.label),
          } satisfies ReliabilityChartAxisLabel;
        }).filter((label): label is ReliabilityChartAxisLabel => label !== null)
      : [],
  };
}

function normalizeEvent(raw: unknown): ReliabilityEventRecord | null {
  const row = asRecord(raw);
  if (!row) return null;

  return {
    id: readString(row.id),
    moldId: readString(row.moldId),
    moldNo: readNullableString(row.moldNo),
    type: readString(row.type) as ReliabilityEventType,
    symptom: readString(row.symptom),
    diagnosis: readString(row.diagnosis),
    procedure: readString(row.procedure),
    operator: readNullableString(row.operator),
    occurredAt: readString(row.occurredAt),
    currentShots: readNumber(row.currentShots),
    recoveryRating: readNumber(row.recoveryRating),
    downtimeHours: readNumber(row.downtimeHours),
    cost: readNumber(row.cost),
    imageUrl: readNullableString(row.imageUrl),
    estimatedCompletion: readNullableString(row.estimatedCompletion),
    createdAt: readString(row.createdAt),
  };
}

function normalizeState(raw: unknown): ReliabilityState | null {
  const row = asRecord(raw);
  if (!row) return null;

  const metrics = normalizeMetrics(row.metrics);
  if (!metrics) return null;

  const events = Array.isArray(row.events)
    ? row.events.map((eventRow) => normalizeEvent(eventRow)).filter((eventRow): eventRow is ReliabilityEventRecord => eventRow !== null)
    : [];

  return {
    moldId: readString(row.moldId) || metrics.moldId,
    moldNo: readString(row.moldNo) || metrics.moldNo,
    metrics,
    events,
  };
}

export async function fetchReliabilityState(moldId: string, moldNo?: string): Promise<ReliabilityState | null> {
  if (!moldId.trim()) return null;
  const search = moldNo ? `?moldNo=${encodeURIComponent(moldNo)}` : '';
  const response = await apiFetch(`/api/reliability/state/${encodeURIComponent(moldId)}${search}`);
  if (!response.ok) return null;
  return normalizeState(await response.json());
}

export async function createReliabilityEvent(input: ReliabilityEventInput): Promise<ReliabilityState | null> {
  const response = await apiFetch('/api/reliability/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) return null;
  return normalizeState(await response.json());
}

export async function generateReliabilityWorkOrder(input: {
  moldId: string;
  moldNo?: string;
  reason?: string;
  requestedBy?: string;
}): Promise<ReliabilityState | null> {
  const response = await apiFetch('/api/reliability/work-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) return null;

  const payload = await response.json();
  const row = asRecord(payload);
  if (!row) return null;
  const metrics = normalizeMetrics(row.metrics);
  if (!metrics) return null;

  return {
    moldId: readString(row.moldId) || metrics.moldId,
    moldNo: readString(row.moldNo) || metrics.moldNo,
    metrics,
    events: [],
  };
}

export async function fetchDashboardReliabilityStats(projectId: string, moldNo?: string): Promise<DashboardReliabilityStats | null> {
  if (!projectId.trim()) return null;
  const search = moldNo ? `?moldNo=${encodeURIComponent(moldNo)}` : '';
  const response = await apiFetch(`/api/dashboard/stats/${encodeURIComponent(projectId)}${search}`);
  if (!response.ok) return null;

  const payload = asRecord(await response.json());
  if (!payload) return null;

  return {
    totalProjects: readNumber(payload.totalProjects),
    reliability: normalizeMetrics(payload.reliability),
    moldId: readNullableString(payload.moldId),
    moldNo: readNullableString(payload.moldNo),
    lastEvent: normalizeEvent(payload.lastEvent),
  };
}
