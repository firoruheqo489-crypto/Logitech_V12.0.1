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

const PROJECT_STATUS_INPUT_ALIASES: Record<KnownProjectStatus, readonly string[]> = {
  completed: ['completed', 'done', '已完成', '完成'],
  overdue: ['overdue', '已超时', '超时'],
  delayed: ['delayed', '已延期', '延期'],
  ongoing: ['ongoing', 'active', '进行中', '进行'],
};

const PROJECT_RISK_INPUT_ALIASES: Record<KnownProjectRiskLevel, readonly string[]> = {
  high: ['high', '高'],
  medium: ['medium', '中'],
  low: ['low', '低', '正常', 'normal'],
};

const PROJECT_QUALIFIED_INPUT_ALIASES: Record<KnownProjectQualifiedFlag, readonly string[]> = {
  yes: ['yes', 'true', '是'],
  no: ['no', 'false', '否'],
};

const DASHBOARD_FILTER_INPUT_ALIASES: Record<KnownDashboardFilter, readonly string[]> = {
  completed: ['completed', '已完成'],
  overdue: ['overdue', '已超时', '超时'],
  ongoing: ['ongoing', 'active', '进行中', '进行'],
};

const PROJECT_STATUS_LABELS: Record<KnownProjectStatus, string> = {
  completed: '已完成',
  overdue: '已超时',
  delayed: '已延期',
  ongoing: '进行中',
};

const PROJECT_RISK_LABELS: Record<KnownProjectRiskLevel, string> = {
  high: '高',
  medium: '中',
  low: '正常',
};

const PROJECT_QUALIFIED_LABELS: Record<KnownProjectQualifiedFlag, string> = {
  yes: '是',
  no: '否',
};

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

export function denormalizeProjectStatus(status: string | null | undefined): string | undefined {
  const normalized = normalizeProjectStatus(status);
  if (normalized === 'unknown') {
    const raw = String(status ?? '').trim();
    return raw && raw !== EMPTY_TOKEN ? raw : undefined;
  }

  return PROJECT_STATUS_LABELS[normalized];
}

export function denormalizeProjectRiskLevel(level: string | null | undefined): string | undefined {
  const normalized = normalizeProjectRiskLevel(level);
  if (normalized === 'unknown') {
    const raw = String(level ?? '').trim();
    return raw && raw !== EMPTY_TOKEN ? raw : undefined;
  }

  return PROJECT_RISK_LABELS[normalized];
}

export function denormalizeProjectQualifiedFlag(flag: string | null | undefined): string | undefined {
  const normalized = normalizeProjectQualifiedFlag(flag);
  if (normalized === 'unknown') {
    const raw = String(flag ?? '').trim();
    return raw && raw !== EMPTY_TOKEN ? raw : undefined;
  }

  return PROJECT_QUALIFIED_LABELS[normalized];
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
