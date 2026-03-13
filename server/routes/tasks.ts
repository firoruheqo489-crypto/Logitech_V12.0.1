/**
 * Tasks API — S 曲线数据查询
 * GET /api/tasks?projectId=LA26006 — 返回指定项目的所有任务（供 S 曲线组件使用）
 *
 * 此接口替代前端直连 Supabase，避免浏览器跨域/网络问题。
 */

import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { tasks } from '../../shared/schema.js';

export async function getTasksForSCurve(req: Request, res: Response): Promise<void> {
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const projectId = (req.query.projectId as string)?.trim();
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }

  try {
    const rows = await db
      .select({
        id: tasks.id,
        project_id: tasks.projectId,
        name: tasks.name,
        name_cn: tasks.nameCn,
        phase: tasks.phase,
        track: tasks.track,
        stage: tasks.stage,
        weight: tasks.weight,
        duration_days: tasks.durationDays,
        baseline_start: tasks.baselineStart,
        baseline_end: tasks.baselineEnd,
        actual_start: tasks.actualStart,
        actual_end: tasks.actualEnd,
        progress: tasks.progress,
        status: tasks.status,
        is_milestone: tasks.isMilestone,
        is_merge_point: tasks.isMergePoint,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(tasks.baselineStart);

    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load tasks' });
  }
}
