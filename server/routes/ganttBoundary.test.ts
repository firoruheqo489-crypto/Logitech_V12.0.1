import { describe, expect, it } from 'vitest';

import {
  normalizeEvidencePayload,
  normalizeGanttImportPayload,
  normalizeProjectImagePayload,
  taskNodeToRow,
} from './ganttBoundary.js';

describe('ganttBoundary', () => {
  it('normalizes import payloads to English enums and safe defaults', () => {
    const normalized = normalizeGanttImportPayload(
      {
        projectInfo: {
          project_name: 'Alpha',
        },
        tasks: [
          {
            id: 'task-1',
            name: 'Mold FAI',
            phase: 'unexpected',
            status: 'bad-status',
            track: 'slider',
            baselineStart: '2026-03-18T09:00:00.000Z',
            baselineEnd: '2026-03-20T09:00:00.000Z',
            progress: '101',
            durationDays: '0',
            weight: '0',
          },
        ],
      },
      'LA26006',
    );

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) {
      return;
    }

    expect(normalized.projectId).toBe('LA26006');
    expect(normalized.projectInfo.project_name).toBe('Alpha');
    expect(normalized.tasks[0]).toMatchObject({
      id: 'task-1',
      projectId: 'LA26006',
      phase: 'physical',
      status: 'NotStart',
      track: 'slider',
      progress: 100,
      durationDays: 1,
      weight: 1,
      baselineStart: '2026-03-18',
      baselineEnd: '2026-03-20',
    });
  });

  it('rejects duplicate task ids before write amplification reaches the database', () => {
    const normalized = normalizeGanttImportPayload(
      {
        tasks: [
          { id: 'duplicate', name: 'A', baselineStart: '2026-03-18', baselineEnd: '2026-03-19' },
          { id: 'duplicate', name: 'B', baselineStart: '2026-03-19', baselineEnd: '2026-03-20' },
        ],
      },
      'LA26006',
    );

    expect(normalized).toEqual({
      ok: false,
      error: 'Duplicate task id "duplicate" detected in import payload',
    });
  });

  it('accepts only known evidence enums and trims payload strings at the boundary', () => {
    expect(
      normalizeEvidencePayload({
        type: 'fai_report',
        url: ' https://example.com/report.pdf ',
        fileName: '  report.pdf ',
        fileSize: '128',
        mimeType: ' application/pdf ',
        description: ' uploaded from audit ',
      }),
    ).toEqual({
      type: 'fai_report',
      url: 'https://example.com/report.pdf',
      fileName: 'report.pdf',
      fileSize: 128,
      mimeType: 'application/pdf',
      description: 'uploaded from audit',
    });

    expect(
      normalizeEvidencePayload({
        type: '中文类型',
        url: 'https://example.com/report.pdf',
      }),
    ).toBeNull();
  });

  it('normalizes project image payloads and row upserts without any casts', () => {
    expect(
      normalizeProjectImagePayload({
        productImageUrl: ' https://example.com/image.png ',
      }),
    ).toEqual({
      productImageUrl: 'https://example.com/image.png',
    });

    expect(
      taskNodeToRow(
        {
          id: ' task-2 ',
          projectId: 'LA26006',
          name: 'Trim Test',
          nameCn: 'Trim Test CN',
          phase: 'physical',
          stageOrder: 3,
          weight: 2,
          durationDays: 5,
          baselineStart: '2026-03-18',
          baselineEnd: '2026-03-22',
          progress: 45,
          status: 'InProgress',
          isCritical: true,
          isMergePoint: false,
          isMilestone: false,
          assignee: ' owner ',
          notes: ' details ',
        },
        'LA26006',
        0,
      ),
    ).toMatchObject({
      logicalId: 'task-2',
      assignee: 'owner',
      notes: 'details',
      status: 'InProgress',
    });
  });
});
