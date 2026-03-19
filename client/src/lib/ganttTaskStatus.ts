import type { TaskStatus } from '@/lib/data';
import type { TaskStatusType } from '@shared/ganttEngine';

export type NormalizedGanttTaskStatus =
  | 'completed'
  | 'in_progress'
  | 'delayed'
  | 'blocked'
  | 'not_started';

type GanttTaskStatusInput = TaskStatus | TaskStatusType | string | null | undefined;

type GanttTaskStatusTone = {
  color: string;
  bg: string;
  border: string;
};

const GANTT_TASK_STATUS_ALIASES = {
  completed: ['completed', 'done'],
  in_progress: ['in_progress', 'inprogress'],
  delayed: ['delayed'],
  blocked: ['blocked'],
  not_started: ['not_started', 'notstart'],
} satisfies Record<NormalizedGanttTaskStatus, readonly string[]>;

const GANTT_TASK_STATUS_LABELS = {
  completed: '\u5df2\u5b8c\u6210',
  in_progress: '\u8fdb\u884c\u4e2d',
  delayed: '\u5ef6\u671f',
  blocked: '\u963b\u585e',
  not_started: '\u672a\u5f00\u59cb',
} satisfies Record<NormalizedGanttTaskStatus, string>;

const GANTT_TASK_STATUS_TONES = {
  completed: {
    color: '#00B894',
    bg: 'rgba(0,184,148,0.08)',
    border: 'rgba(0,184,148,0.15)',
  },
  in_progress: {
    color: '#FDCB6E',
    bg: 'rgba(253,203,110,0.1)',
    border: 'rgba(253,203,110,0.2)',
  },
  delayed: {
    color: '#D63031',
    bg: 'rgba(214,48,49,0.06)',
    border: 'rgba(214,48,49,0.12)',
  },
  blocked: {
    color: '#D63031',
    bg: 'rgba(214,48,49,0.06)',
    border: 'rgba(214,48,49,0.12)',
  },
  not_started: {
    color: '#B2BEC3',
    bg: 'rgba(178,190,195,0.08)',
    border: 'rgba(178,190,195,0.15)',
  },
} satisfies Record<NormalizedGanttTaskStatus, GanttTaskStatusTone>;

function normalizeStatusToken(value: GanttTaskStatusInput): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function normalizeGanttTaskStatus(
  value: GanttTaskStatusInput,
): NormalizedGanttTaskStatus {
  const token = normalizeStatusToken(value);
  if (!token) {
    return 'not_started';
  }

  for (const [status, aliases] of Object.entries(
    GANTT_TASK_STATUS_ALIASES,
  ) as Array<[NormalizedGanttTaskStatus, readonly string[]]>) {
    if (aliases.includes(token)) {
      return status;
    }
  }

  return 'not_started';
}

export function getGanttTaskStatusLabel(value: GanttTaskStatusInput): string {
  return GANTT_TASK_STATUS_LABELS[normalizeGanttTaskStatus(value)];
}

export function getGanttTaskStatusTone(
  value: GanttTaskStatusInput,
): GanttTaskStatusTone {
  return GANTT_TASK_STATUS_TONES[normalizeGanttTaskStatus(value)];
}

export function getGanttTaskStatusColor(value: GanttTaskStatusInput): string {
  return getGanttTaskStatusTone(value).color;
}

export function isGanttTaskDone(value: GanttTaskStatusInput): boolean {
  return normalizeGanttTaskStatus(value) === 'completed';
}
