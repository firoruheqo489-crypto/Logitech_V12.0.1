/**
 * Gantt API — 甘特数据持久化与加载
 * GET /api/gantt/data?projectId=LA26006 — 从 DB 加载
 * POST /api/gantt/import — 写入 tasks + project，返回 GanttData
 */

import type { Request, Response } from 'express';
import { and, eq, notInArray, sql as dsql } from 'drizzle-orm';
import { db } from '../db.js';
import { tasks, projects, evidence } from '../../shared/schema.js';
import { getGanttData } from '../../shared/ganttEngine.js';
import type { TaskNode, ProjectInfo, GanttData } from '../../shared/ganttEngine.js';
import type { Task } from '../../shared/schema.js';

const DEFAULT_PROJECT_ID = 'LA26006';

const VALID_STATUS = ['NotStart', 'InProgress', 'Blocked', 'Done'] as const;
const VALID_PHASE = ['physical', 'data', 'production'] as const;

/** Normalize to YYYY-MM-DD for Postgres date columns */
function toDateStr(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    return trimmed || null;
  }
  if (typeof (val as Date).toISOString === 'function') return (val as Date).toISOString().slice(0, 10);
  return null;
}

function taskRowToTaskNode(row: Task): TaskNode {
  const id = row.logicalId ?? String(row.id);
  return {
    id,
    dbId: String(row.id),
    projectId: row.projectId,
    wbsId: row.wbsId ?? undefined,
    name: row.name,
    nameCn: row.nameCn,
    phase: (VALID_PHASE.includes(row.phase as any) ? row.phase : 'physical') as TaskNode['phase'],
    track: (row.track as TaskNode['track']) ?? undefined,
    stage: row.stage ?? undefined,
    stageOrder: Number(row.stageOrder) || 0,
    weight: Number(row.weight) || 1,
    durationDays: Number(row.durationDays) || 1,
    baselineStart: String(row.baselineStart).slice(0, 10),
    baselineEnd: String(row.baselineEnd).slice(0, 10),
    actualStart: row.actualStart != null ? String(row.actualStart).slice(0, 10) : undefined,
    actualEnd: row.actualEnd != null ? String(row.actualEnd).slice(0, 10) : undefined,
    progress: Number(row.progress) || 0,
    status: (VALID_STATUS.includes(row.status as any) ? row.status : 'NotStart') as TaskNode['status'],
    isCritical: Boolean(row.isCritical),
    isMergePoint: Boolean(row.isMergePoint),
    isMilestone: Boolean(row.isMilestone),
    assignee: row.assignee ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function taskNodeToRow(task: TaskNode, projectId: string, index: number) {
  const baseStart = toDateStr(task.baselineStart) ?? '';
  const baseEnd = toDateStr(task.baselineEnd) ?? baseStart;
  const logicalId = (task.id != null && String(task.id).trim() !== '')
    ? String(task.id).trim()
    : `${projectId}_${index}`;
  return {
    projectId,
    logicalId,
    wbsId: task.wbsId ?? null,
    name: String(task.name ?? '').slice(0, 255),
    nameCn: String(task.nameCn ?? task.name ?? '').slice(0, 255),
    phase: VALID_PHASE.includes(task.phase as any) ? task.phase : 'physical',
    track: task.track ?? null,
    stage: task.stage ?? null,
    stageOrder: Math.floor(Number(task.stageOrder)) || 0,
    weight: Number(task.weight) || 1,
    durationDays: Math.max(1, Math.floor(Number(task.durationDays)) || 1),
    baselineStart: baseStart || new Date().toISOString().slice(0, 10),
    baselineEnd: baseEnd || baseStart || new Date().toISOString().slice(0, 10),
    actualStart: toDateStr(task.actualStart),
    actualEnd: toDateStr(task.actualEnd),
    progress: Math.min(100, Math.max(0, Math.floor(Number(task.progress))) || 0),
    status: VALID_STATUS.includes(task.status as any) ? task.status : 'NotStart',
    isCritical: Boolean(task.isCritical),
    isMergePoint: Boolean(task.isMergePoint),
    isMilestone: Boolean(task.isMilestone),
    assignee: task.assignee ?? null,
    notes: task.notes ?? null,
    updatedAt: new Date(),
  };
}

export async function getGanttDataHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const projectId = (req.query.projectId as string)?.trim() || DEFAULT_PROJECT_ID;

  try {
    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const rows = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

    const taskNodes: TaskNode[] = rows.map(taskRowToTaskNode);

    const projectInfo: ProjectInfo = {
      id: projectId,
      brand: projectRow?.brand ?? 'Logitech',
      productName: projectRow?.productName ?? '',
      moldNumber: projectRow?.moldNumber ?? projectId,
      startDate: projectRow?.startDate ?? '',
      endDate: projectRow?.endDate ?? '',
      index_no: projectRow?.indexNo ?? undefined,
      project_name: projectRow?.projectName ?? undefined,
      fitter_group: projectRow?.fitterGroup ?? undefined,
      product_image_url: projectRow?.productImageUrl ?? undefined,
    };

    if (taskNodes.length === 0) {
      res.status(200).json(null);
      return;
    }

    const ganttData: GanttData = getGanttData(taskNodes, [], projectInfo);
    res.status(200).json(ganttData);
  } catch (err) {
    console.error('GET /api/gantt/data error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load gantt data' });
  }
}

export async function postGanttImportHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const body = req.body as { tasks?: TaskNode[]; projectInfo?: ProjectInfo };
  const inputTasks = body.tasks ?? [];
  const projectInfo = body.projectInfo;

  if (inputTasks.length === 0) {
    res.status(400).json({ error: 'tasks array is required and non-empty' });
    return;
  }

  const projectId = projectInfo?.id ?? inputTasks[0]?.projectId ?? DEFAULT_PROJECT_ID;

  try {
    const projStart = toDateStr(projectInfo?.startDate);
    const projEnd = toDateStr(projectInfo?.endDate);
    await db
      .insert(projects)
      .values({
        id: projectId,
        indexNo: projectInfo?.index_no ?? null,
        projectName: projectInfo?.project_name ?? null,
        productName: projectInfo?.productName ?? null,
        moldNumber: projectInfo?.moldNumber ?? projectId,
        brand: projectInfo?.brand ?? 'Logitech',
        fitterGroup: projectInfo?.fitter_group ?? null,
        startDate: projStart,
        endDate: projEnd,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          indexNo: projectInfo?.index_no ?? null,
          projectName: projectInfo?.project_name ?? null,
          productName: projectInfo?.productName ?? null,
          moldNumber: projectInfo?.moldNumber ?? projectId,
          brand: projectInfo?.brand ?? 'Logitech',
          fitterGroup: projectInfo?.fitter_group ?? null,
          startDate: projStart,
          endDate: projEnd,
          updatedAt: new Date(),
        },
      });

    const incomingRows = inputTasks.map((task, index) => taskNodeToRow(task, projectId, index));
    const incomingLogicalIds = Array.from(new Set(incomingRows.map((row) => row.logicalId).filter(Boolean))) as string[];

    if (incomingLogicalIds.length > 0) {
      await db
        .delete(tasks)
        .where(and(eq(tasks.projectId, projectId), notInArray(tasks.logicalId, incomingLogicalIds)));
    }

    for (const row of incomingRows) {
      await db
        .insert(tasks)
        .values(row)
        .onConflictDoUpdate({
          target: [tasks.projectId, tasks.logicalId],
          set: {
            name: row.name,
            nameCn: row.nameCn,
            phase: row.phase,
            track: row.track,
            stage: row.stage,
            stageOrder: row.stageOrder,
            weight: row.weight,
            durationDays: row.durationDays,
            baselineStart: row.baselineStart,
            baselineEnd: row.baselineEnd,
            actualStart: row.actualStart,
            actualEnd: row.actualEnd,
            progress: row.progress,
            status: row.status,
            isCritical: row.isCritical,
            isMergePoint: row.isMergePoint,
            isMilestone: row.isMilestone,
            wbsId: row.wbsId,
            assignee: row.assignee,
            notes: row.notes,
            updatedAt: row.updatedAt,
          },
        });
    }

    const ganttData: GanttData = getGanttData(inputTasks, [], {
      id: projectId,
      brand: projectInfo?.brand ?? 'Logitech',
      productName: projectInfo?.productName ?? '',
      moldNumber: projectInfo?.moldNumber ?? projectId,
      startDate: projectInfo?.startDate ?? '',
      endDate: projectInfo?.endDate ?? '',
      index_no: projectInfo?.index_no,
      project_name: projectInfo?.project_name,
      fitter_group: projectInfo?.fitter_group,
    });

    res.status(200).json(ganttData);
  } catch (err) {
    console.error('POST /api/gantt/import error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to save gantt data';
    const hint = /connection|ECONNREFUSED|timeout|connect/i.test(String(msg))
      ? '（请检查 .env 中 DATABASE_URL 与 Supabase 服务是否可用）'
      : '';
    res.status(500).json({ error: msg + hint });
  }
}

/** GET /api/gantt/check-project?id=LA26006 — 检查项目是否已存在 */
export async function checkProjectExistsHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }
  const projectId = (req.query.id as string)?.trim();
  if (!projectId) {
    res.status(400).json({ error: 'id query param required' });
    return;
  }
  try {
    const [row] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    res.status(200).json({ exists: !!row });
  } catch (err) {
    console.error('GET /api/gantt/check-project error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'check failed' });
  }
}

/** PATCH /api/gantt/project-image — 更新项目 product_image_url */
export async function patchProjectImageHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }

  const projectId = (req.params.projectId as string)?.trim();
  const { productImageUrl } = (req.body as { productImageUrl?: string }) ?? {};

  if (!projectId || typeof productImageUrl !== 'string' || !productImageUrl.trim()) {
    res.status(400).json({ error: 'projectId and productImageUrl are required' });
    return;
  }

  try {
    await db
      .update(projects)
      .set({
        productImageUrl: productImageUrl.trim().slice(0, 1024),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('PATCH /api/gantt/project-image error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update project image' });
  }
}

/** DELETE /api/gantt/project/:projectId — 清除指定项目的甘特数据 */
export async function deleteGanttProject(req: Request, res: Response): Promise<void> {
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return;
  }
  const projectId = (req.params.projectId as string)?.trim();
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required' });
    return;
  }
  try {
    await db.delete(tasks).where(eq(tasks.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    res.status(200).json({ success: true, projectId });
  } catch (err) {
    console.error('DELETE /api/gantt/project error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete project data' });
  }
}



/** GET /api/gantt/task/:taskId/evidence — 获取任务的所有证据 */
export async function getTaskEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!db) { res.status(503).json({ error: 'Database not configured' }); return; }
  const taskId = req.params.taskId?.trim();
  if (!taskId) { res.status(400).json({ error: 'taskId is required' }); return; }
  try {
    const rows = await db.select().from(evidence).where(eq(evidence.taskId, taskId));
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/gantt/task/:taskId/evidence error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load evidence' });
  }
}

/** POST /api/gantt/task/:taskId/evidence — 添加证据记录 */
export async function postTaskEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!db) { res.status(503).json({ error: 'Database not configured' }); return; }
  const taskId = req.params.taskId?.trim();
  if (!taskId) { res.status(400).json({ error: 'taskId is required' }); return; }
  const { type, url, fileName, fileSize, mimeType, description } = req.body ?? {};
  if (!type || !url) { res.status(400).json({ error: 'type and url are required' }); return; }
  try {
    const [row] = await db.insert(evidence).values({
      taskId,
      type,
      url,
      fileName: fileName ?? null,
      fileSize: fileSize ?? null,
      mimeType: mimeType ?? null,
      description: description ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /api/gantt/task/:taskId/evidence error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save evidence' });
  }
}

/** DELETE /api/gantt/evidence/:evidenceId — 删除单条证据 */
export async function deleteEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!db) { res.status(503).json({ error: 'Database not configured' }); return; }
  const evidenceId = req.params.evidenceId?.trim();
  if (!evidenceId) { res.status(400).json({ error: 'evidenceId is required' }); return; }
  try {
    await db.delete(evidence).where(eq(evidence.id, evidenceId));
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /api/gantt/evidence/:evidenceId error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete evidence' });
  }
}

/** GET /api/gantt/project/:projectId/evidence-counts — 批量获取项目所有任务的证据数量 */
export async function getProjectEvidenceCountsHandler(req: Request, res: Response): Promise<void> {
  if (!db) { res.status(503).json({ error: 'Database not configured' }); return; }
  const projectId = req.params.projectId?.trim();
  if (!projectId) { res.status(400).json({ error: 'projectId is required' }); return; }
  try {
    const rows = await db
      .select({
        taskId: evidence.taskId,
        count: dsql<number>`count(*)::int`,
      })
      .from(evidence)
      .innerJoin(tasks, eq(evidence.taskId, tasks.id))
      .where(eq(tasks.projectId, projectId))
      .groupBy(evidence.taskId);
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.taskId] = r.count;
    res.status(200).json(counts);
  } catch (err) {
    console.error('GET evidence-counts error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
}
