import { describe, expect, it } from 'vitest';

import {
  getIssueProcessStepLabel,
  getIssueTypeLabels,
  matchesIssueProcessStepQuery,
  matchesIssueTypeQuery,
  normalizeIssueProcessStepId,
  normalizeIssueTypeId,
  normalizeIssueTypes,
} from './issueDomain';

describe('issueDomain', () => {
  it('normalizes legacy Chinese and English issue types to English ids', () => {
    expect(normalizeIssueTypeId('外观问题')).toBe('appearance');
    expect(normalizeIssueTypeId('dimension')).toBe('dimension');
    expect(normalizeIssueTypeId('装配问题')).toBe('assembly');
    expect(normalizeIssueTypeId('')).toBeUndefined();
  });

  it('normalizes legacy Chinese and English process steps to English ids', () => {
    expect(normalizeIssueProcessStepId('注塑工序')).toBe('injection');
    expect(normalizeIssueProcessStepId('cnc')).toBe('cnc');
    expect(normalizeIssueProcessStepId('客诉工序')).toBe('complaint');
    expect(normalizeIssueProcessStepId(undefined)).toBe('');
  });

  it('deduplicates type arrays and keeps UI labels in the rendering layer', () => {
    expect(normalizeIssueTypes(['外观问题', 'appearance', '装配问题'])).toEqual(['appearance', 'assembly']);
    expect(getIssueTypeLabels(['appearance', 'assembly'])).toEqual(['外观问题', '装配问题']);
    expect(getIssueProcessStepLabel('injection')).toBe('注塑工序');
  });

  it('supports searching against both English ids and Chinese labels', () => {
    expect(matchesIssueTypeQuery('appearance', 'appearance')).toBe(true);
    expect(matchesIssueTypeQuery('appearance', '外观')).toBe(true);
    expect(matchesIssueProcessStepQuery('complaint', '客诉')).toBe(true);
    expect(matchesIssueProcessStepQuery('complaint', 'cnc')).toBe(false);
  });
});
