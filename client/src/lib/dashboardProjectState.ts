import type { ProjectData } from '@/pages/dashboard/types/project';

export type ProjectStatus = 'ongoing' | 'completed' | 'overdue' | 'delayed' | 'unknown';
export type ProjectRiskLevel = 'high' | 'medium' | 'low' | 'unknown';
export type ProjectQualifiedFlag = 'yes' | 'no' | 'unknown';
export type DashboardFilter = 'ALL' | 'ongoing' | 'completed' | 'overdue';

type KnownProjectStatus = Exclude<ProjectStatus, 'unknown'>;
type KnownProjectRiskLevel = Exclude<ProjectRiskLevel, 'unknown'>;
type KnownProjectQualifiedFlag = Exclude<ProjectQualifiedFlag, 'unknown'>;
type KnownDashboardFilter = Exclude<DashboardFilter, 'ALL'>;

const EMPTY_TOKEN = '-';

const PROJECT_STATUS_INPUT_ALIASES = {
  completed: ['completed', 'done', '\u5df2\u5b8c\u6210', '\u5b8c\u6210'],
  overdue: ['overdue', '\u9879\u76ee\u5df2\u8d85\u65f6', '\u8d85\u65f6'],
  delayed: ['delayed', '\u5df2\u5ef6\u671f', '\u5ef6\u671f'],
  ongoing: ['ongoing', 'active', '\u8fdb\u884c\u4e2d', '\u8fdb\u884c'],
} satisfies Record<KnownProjectStatus, readonly string[]>;

const PROJECT_RISK_INPUT_ALIASES = {
  high: ['high', '\u9ad8\u98ce\u9669', '\u9ad8'],
  medium: ['medium', '\u4e2d'],
  low: ['low', '\u4f4e', '\u6b63\u5e38', 'normal'],
} satisfies Record<KnownProjectRiskLevel, readonly string[]>;

const PROJECT_QUALIFIED_INPUT_ALIASES = {
  yes: ['yes', 'true', '\u662f'],
  no: ['no', 'false', '\u5426'],
} satisfies Record<KnownProjectQualifiedFlag, readonly string[]>;

const DASHBOARD_FILTER_INPUT_ALIASES = {
  completed: ['completed', '\u5df2\u5b8c\u6210'],
  overdue: ['overdue', '\u9879\u76ee\u5df2\u8d85\u65f6', '\u8d85\u65f6'],
  ongoing: ['ongoing', 'active', '\u8fdb\u884c\u4e2d', '\u8fdb\u884c'],
} satisfies Record<KnownDashboardFilter, readonly string[]>;

const PROJECT_STATUS_LABELS = {
  completed: '\u5df2\u5b8c\u6210',
  overdue: '\u9879\u76ee\u5df2\u8d85\u65f6',
  delayed: '\u5df2\u5ef6\u671f',
  ongoing: '\u8fdb\u884c\u4e2d',
} satisfies Record<KnownProjectStatus, string>;

const PROJECT_RISK_LABELS = {
  high: '\u9ad8\u98ce\u9669',
  medium: '\u4e2d',
  low: '\u6b63\u5e38',
} satisfies Record<KnownProjectRiskLevel, string>;

const PROJECT_QUALIFIED_LABELS = {
  yes: '\u662f',
  no: '\u5426',
} satisfies Record<KnownProjectQualifiedFlag, string>;

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeByAliases<T extends string>(
  value: string | null | undefined,
  aliasesByValue: Record<T, readonly string[]>,
): T | undefined {
  const token = normalizeToken(value);
  if (!token || token === EMPTY_TOKEN) {
    return undefined;
  }

  for (const [normalizedValue, aliases] of Object.entries(aliasesByValue) as Array<[T, readonly string[]]>) {
    if (aliases.some((alias) => token === alias || token.includes(alias))) {
      return normalizedValue;
    }
  }

  return undefined;
}

function canonicalizeByAliases<T extends string>(
  value: string | null | undefined,
  aliasesByValue: Record<T, readonly string[]>,
): string | undefined {
  const normalized = normalizeByAliases(value, aliasesByValue);
  if (normalized) {
    return normalized;
  }

  const raw = String(value ?? '').trim();
  return raw && raw !== EMPTY_TOKEN ? raw : undefined;
}

export function normalizeProjectStatus(value: string | null | undefined): ProjectStatus {
  return normalizeByAliases(value, PROJECT_STATUS_INPUT_ALIASES) ?? 'unknown';
}

export function normalizeProjectRiskLevel(value: string | null | undefined): ProjectRiskLevel {
  return normalizeByAliases(value, PROJECT_RISK_INPUT_ALIASES) ?? 'unknown';
}

export function normalizeProjectQualifiedFlag(value: string | null | undefined): ProjectQualifiedFlag {
  return normalizeByAliases(value, PROJECT_QUALIFIED_INPUT_ALIASES) ?? 'unknown';
}

export function normalizeDashboardFilter(value: string | null | undefined): DashboardFilter {
  return normalizeByAliases(value, DASHBOARD_FILTER_INPUT_ALIASES) ?? 'ALL';
}

export function getProjectStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeProjectStatus(status);
  return normalized === 'unknown' ? EMPTY_TOKEN : PROJECT_STATUS_LABELS[normalized];
}

export function getProjectRiskLevelLabel(level: string | null | undefined): string {
  const normalized = normalizeProjectRiskLevel(level);
  return normalized === 'unknown' ? EMPTY_TOKEN : PROJECT_RISK_LABELS[normalized];
}

export function getProjectQualifiedFlagLabel(flag: string | null | undefined): string {
  const normalized = normalizeProjectQualifiedFlag(flag);
  return normalized === 'unknown' ? EMPTY_TOKEN : PROJECT_QUALIFIED_LABELS[normalized];
}

export function isProjectStatusDone(status: string | null | undefined): boolean {
  return normalizeProjectStatus(status) === 'completed';
}

export function isProjectStatusDelayed(status: string | null | undefined): boolean {
  const normalized = normalizeProjectStatus(status);
  return normalized === 'overdue' || normalized === 'delayed';
}

export function toProjectStatusMachineValue(status: string | null | undefined): string | undefined {
  return canonicalizeByAliases(status, PROJECT_STATUS_INPUT_ALIASES);
}

export function toProjectRiskLevelMachineValue(level: string | null | undefined): string | undefined {
  return canonicalizeByAliases(level, PROJECT_RISK_INPUT_ALIASES);
}

export function toProjectQualifiedFlagMachineValue(flag: string | null | undefined): string | undefined {
  return canonicalizeByAliases(flag, PROJECT_QUALIFIED_INPUT_ALIASES);
}

export function normalizeProjectDataEnums(project: ProjectData): ProjectData {
  return {
    ...project,
    identity: {
      ...project.identity,
      riskLevel: project.identity.riskLevel === EMPTY_TOKEN ? EMPTY_TOKEN : normalizeProjectRiskLevel(project.identity.riskLevel),
    },
    milestones: {
      ...project.milestones,
      t1SizeQualified:
        project.milestones.t1SizeQualified === EMPTY_TOKEN
          ? EMPTY_TOKEN
          : normalizeProjectQualifiedFlag(project.milestones.t1SizeQualified),
      currentNode:
        project.milestones.currentNode === EMPTY_TOKEN
          ? EMPTY_TOKEN
          : normalizeProjectStatus(project.milestones.currentNode),
    },
  };
}
