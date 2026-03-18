export type IssueTypeId = 'appearance' | 'dimension' | 'assembly';
export type IssueProcessStepId = 'injection' | 'cnc' | 'assembly' | 'complaint';
export type IssueModuleKey = 'evidence' | 'description' | 'rootCause' | 'solution' | 'verification';

type IssueTypeOption = {
  id: IssueTypeId;
  label: string;
  aliases: readonly string[];
};

type IssueProcessStepOption = {
  id: IssueProcessStepId;
  label: string;
  aliases: readonly string[];
};

export const ISSUE_TYPE_OPTIONS: readonly IssueTypeOption[] = [
  { id: 'appearance', label: '外观问题', aliases: ['appearance', '外观问题'] },
  { id: 'dimension', label: '尺寸问题', aliases: ['dimension', '尺寸问题'] },
  { id: 'assembly', label: '装配问题', aliases: ['assembly', '装配问题'] },
];

export const PROCESS_STEP_OPTIONS: readonly IssueProcessStepOption[] = [
  { id: 'injection', label: '注塑工序', aliases: ['injection', '注塑工序'] },
  { id: 'cnc', label: 'CNC工序', aliases: ['cnc', 'cnc工序'] },
  { id: 'assembly', label: '装配工序', aliases: ['assembly', '装配工序'] },
  { id: 'complaint', label: '客诉工序', aliases: ['complaint', '客诉工序'] },
];

const ISSUE_TYPE_LABELS: Record<IssueTypeId, string> = Object.fromEntries(
  ISSUE_TYPE_OPTIONS.map((option) => [option.id, option.label]),
) as Record<IssueTypeId, string>;

const PROCESS_STEP_LABELS: Record<IssueProcessStepId, string> = Object.fromEntries(
  PROCESS_STEP_OPTIONS.map((option) => [option.id, option.label]),
) as Record<IssueProcessStepId, string>;

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function matchesAliases(token: string, aliases: readonly string[]): boolean {
  return aliases.some((alias) => token === alias || token.includes(alias));
}

export function normalizeIssueTypeId(value: string | null | undefined): IssueTypeId | undefined {
  const token = normalizeToken(value);
  if (!token) return undefined;

  return ISSUE_TYPE_OPTIONS.find((option) => matchesAliases(token, option.aliases))?.id;
}

export function normalizeIssueTypes(values: readonly string[] | null | undefined): IssueTypeId[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<IssueTypeId>();
  const normalized: IssueTypeId[] = [];

  values.forEach((value) => {
    const next = normalizeIssueTypeId(value);
    if (!next || seen.has(next)) {
      return;
    }

    seen.add(next);
    normalized.push(next);
  });

  return normalized;
}

export function normalizeIssueProcessStepId(value: string | null | undefined): IssueProcessStepId | '' {
  const token = normalizeToken(value);
  if (!token) return '';

  return PROCESS_STEP_OPTIONS.find((option) => matchesAliases(token, option.aliases))?.id ?? '';
}

export function getIssueTypeLabel(value: string | null | undefined): string {
  const normalized = normalizeIssueTypeId(value);
  if (!normalized) {
    return String(value ?? '').trim();
  }

  return ISSUE_TYPE_LABELS[normalized];
}

export function getIssueTypeLabels(values: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => getIssueTypeLabel(value))
    .filter((value) => value.length > 0);
}

export function getIssueProcessStepLabel(value: string | null | undefined): string {
  const normalized = normalizeIssueProcessStepId(value);
  if (!normalized) {
    return String(value ?? '').trim();
  }

  return PROCESS_STEP_LABELS[normalized];
}

export function matchesIssueTypeQuery(value: string | null | undefined, query: string): boolean {
  const token = normalizeToken(query);
  if (!token) return true;

  const normalized = normalizeIssueTypeId(value);
  const haystacks = normalized
    ? [normalized, ISSUE_TYPE_LABELS[normalized].toLowerCase()]
    : [normalizeToken(value)];

  return haystacks.some((haystack) => haystack.includes(token));
}

export function matchesIssueProcessStepQuery(value: string | null | undefined, query: string): boolean {
  const token = normalizeToken(query);
  if (!token) return true;

  const normalized = normalizeIssueProcessStepId(value);
  const haystacks = normalized
    ? [normalized, PROCESS_STEP_LABELS[normalized].toLowerCase()]
    : [normalizeToken(value)];

  return haystacks.some((haystack) => haystack.includes(token));
}
