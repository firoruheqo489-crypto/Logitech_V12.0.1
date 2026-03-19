import { describe, expect, it } from 'vitest';

import {
  getGanttTaskStatusColor,
  getGanttTaskStatusLabel,
  isGanttTaskDone,
  normalizeGanttTaskStatus,
} from './ganttTaskStatus';

describe('ganttTaskStatus', () => {
  it('normalizes legacy task status aliases to machine values', () => {
    expect(normalizeGanttTaskStatus('Done')).toBe('completed');
    expect(normalizeGanttTaskStatus('InProgress')).toBe('in_progress');
    expect(normalizeGanttTaskStatus('NotStart')).toBe('not_started');
    expect(normalizeGanttTaskStatus('blocked')).toBe('blocked');
    expect(normalizeGanttTaskStatus('')).toBe('not_started');
  });

  it('renders labels from normalized machine values only', () => {
    expect(getGanttTaskStatusLabel('completed')).toBe('\u5df2\u5b8c\u6210');
    expect(getGanttTaskStatusLabel('Done')).toBe('\u5df2\u5b8c\u6210');
    expect(getGanttTaskStatusLabel('delayed')).toBe('\u5ef6\u671f');
  });

  it('exposes shared colors and completion checks for gantt surfaces', () => {
    expect(getGanttTaskStatusColor('Done')).toBe('#00B894');
    expect(getGanttTaskStatusColor('delayed')).toBe('#D63031');
    expect(isGanttTaskDone('completed')).toBe(true);
    expect(isGanttTaskDone('InProgress')).toBe(false);
  });
});
