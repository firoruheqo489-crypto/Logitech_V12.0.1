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
import {
  normalizeEvidencePayload,
  normalizeGanttImportPayload,
  normalizeProjectImagePayload,
  readTrimmedString,
  taskNodeToRow,
  taskRowToTaskNode,
  toDateStr,
} from './ganttBoundary.js';

const DEFAULT_PROJECT_ID = 'LA26006';

type GanttRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'EVIDENCE_COUNTS_LOAD_FAILED'
  | 'EVIDENCE_DELETE_FAILED'
  | 'EVIDENCE_ID_REQUIRED'
  | 'EVIDENCE_LOAD_FAILED'
  | 'EVIDENCE_SAVE_FAILED'
  | 'GANTT_DATA_LOAD_FAILED'
  | 'GANTT_SAVE_FAILED'
  | 'ID_REQUIRED'
  | 'INVALID_EVIDENCE_PAYLOAD'
  | 'INVALID_IMPORT_PAYLOAD'
  | 'PROJECT_CHECK_FAILED'
  | 'PROJECT_DELETE_FAILED'
  | 'PROJECT_ID_AND_PRODUCT_IMAGE_URL_REQUIRED'
  | 'PROJECT_ID_REQUIRED'
  | 'PROJECT_IMAGE_UPDATE_FAILED'
  | 'TASK_ID_REQUIRED';

const GANTT_ROUTE_ERROR_MESSAGES: Record<GanttRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  EVIDENCE_COUNTS_LOAD_FAILED: 'Failed',
  EVIDENCE_DELETE_FAILED: 'Failed to delete evidence',
  EVIDENCE_ID_REQUIRED: 'evidenceId is required',
  EVIDENCE_LOAD_FAILED: 'Failed to load evidence',
  EVIDENCE_SAVE_FAILED: 'Failed to save evidence',
  GANTT_DATA_LOAD_FAILED: 'Failed to load gantt data',
  GANTT_SAVE_FAILED: 'Failed to save gantt data',
  ID_REQUIRED: 'id query param required',
  INVALID_EVIDENCE_PAYLOAD: 'Valid evidence type and url are required',
  INVALID_IMPORT_PAYLOAD: 'Invalid import payload',
  PROJECT_CHECK_FAILED: 'check failed',
  PROJECT_DELETE_FAILED: 'Failed to delete project data',
  PROJECT_ID_AND_PRODUCT_IMAGE_URL_REQUIRED: 'projectId and productImageUrl are required',
  PROJECT_ID_REQUIRED: 'projectId is required',
  PROJECT_IMAGE_UPDATE_FAILED: 'Failed to update project image',
  TASK_ID_REQUIRED: 'taskId is required',
};

function sendGanttRouteError(
  res: Response,
  status: number,
  code: GanttRouteErrorCode,
  errorMessage?: string,
): void {
  res.status(status).json({
    error: errorMessage ?? GANTT_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

export async function getGanttDataHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const projectId = readTrimmedString(req.query.projectId, 50) ?? DEFAULT_PROJECT_ID;

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
    sendGanttRouteError(res, 500, 'GANTT_DATA_LOAD_FAILED');
  }
}

export async function postGanttImportHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const normalizedImport = normalizeGanttImportPayload(req.body, DEFAULT_PROJECT_ID);
  if (!normalizedImport.ok) {
    sendGanttRouteError(res, 400, 'INVALID_IMPORT_PAYLOAD', normalizedImport.error);
    return;
  }

  const { tasks: inputTasks, projectInfo, projectId } = normalizedImport;

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
    const incomingLogicalIds = [...new Set(incomingRows.map((row) => row.logicalId))];

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
    sendGanttRouteError(res, 500, 'GANTT_SAVE_FAILED');
  }
}

/** GET /api/gantt/check-project?id=LA26006 — 检查项目是否已存在 */
export async function checkProjectExistsHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }
  const projectId = readTrimmedString(req.query.id, 50);
  if (!projectId) {
    sendGanttRouteError(res, 400, 'ID_REQUIRED');
    return;
  }
  try {
    const [row] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    res.status(200).json({ exists: !!row });
  } catch (err) {
    console.error('GET /api/gantt/check-project error:', err);
    sendGanttRouteError(res, 500, 'PROJECT_CHECK_FAILED');
  }
}

/** PATCH /api/gantt/project-image — 更新项目 product_image_url */
export async function patchProjectImageHandler(req: Request, res: Response): Promise<void> {
  if (!db) {
    sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const projectId = readTrimmedString(req.params.projectId, 50);
  const payload = normalizeProjectImagePayload(req.body);

  if (!projectId || !payload) {
    sendGanttRouteError(res, 400, 'PROJECT_ID_AND_PRODUCT_IMAGE_URL_REQUIRED');
    return;
  }

  try {
    await db
      .update(projects)
      .set({
        productImageUrl: payload.productImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('PATCH /api/gantt/project-image error:', err);
    sendGanttRouteError(res, 500, 'PROJECT_IMAGE_UPDATE_FAILED');
  }
}

/** DELETE /api/gantt/project/:projectId — 清除指定项目的甘特数据 */
export async function deleteGanttProject(req: Request, res: Response): Promise<void> {
  if (!db) {
    sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }
  const projectId = readTrimmedString(req.params.projectId, 50);
  if (!projectId) {
    sendGanttRouteError(res, 400, 'PROJECT_ID_REQUIRED');
    return;
  }
  try {
    await db.delete(tasks).where(eq(tasks.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    res.status(200).json({ success: true, projectId });
  } catch (err) {
    console.error('DELETE /api/gantt/project error:', err);
    sendGanttRouteError(res, 500, 'PROJECT_DELETE_FAILED');
  }
}



/** GET /api/gantt/task/:taskId/evidence — 获取任务的所有证据 */
export async function getTaskEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!db) { sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const taskId = readTrimmedString(req.params.taskId, 64);
  if (!taskId) { sendGanttRouteError(res, 400, 'TASK_ID_REQUIRED'); return; }
  try {
    const rows = await db.select().from(evidence).where(eq(evidence.taskId, taskId));
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/gantt/task/:taskId/evidence error:', err);
    sendGanttRouteError(res, 500, 'EVIDENCE_LOAD_FAILED');
  }
}

/** POST /api/gantt/task/:taskId/evidence — 添加证据记录 */
export async function postTaskEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!db) { sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const taskId = readTrimmedString(req.params.taskId, 64);
  if (!taskId) { sendGanttRouteError(res, 400, 'TASK_ID_REQUIRED'); return; }
  const payload = normalizeEvidencePayload(req.body);
  if (!payload) { sendGanttRouteError(res, 400, 'INVALID_EVIDENCE_PAYLOAD'); return; }
  try {
    const [row] = await db.insert(evidence).values({
      taskId,
      type: payload.type,
      url: payload.url,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      description: payload.description,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /api/gantt/task/:taskId/evidence error:', err);
    sendGanttRouteError(res, 500, 'EVIDENCE_SAVE_FAILED');
  }
}

/** DELETE /api/gantt/evidence/:evidenceId — 删除单条证据 */
export async function deleteEvidenceHandler(req: Request, res: Response): Promise<void> {
  if (!db) { sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const evidenceId = readTrimmedString(req.params.evidenceId, 64);
  if (!evidenceId) { sendGanttRouteError(res, 400, 'EVIDENCE_ID_REQUIRED'); return; }
  try {
    await db.delete(evidence).where(eq(evidence.id, evidenceId));
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /api/gantt/evidence/:evidenceId error:', err);
    sendGanttRouteError(res, 500, 'EVIDENCE_DELETE_FAILED');
  }
}

/** GET /api/gantt/project/:projectId/evidence-counts — 批量获取项目所有任务的证据数量 */
export async function getProjectEvidenceCountsHandler(req: Request, res: Response): Promise<void> {
  if (!db) { sendGanttRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const projectId = readTrimmedString(req.params.projectId, 50);
  if (!projectId) { sendGanttRouteError(res, 400, 'PROJECT_ID_REQUIRED'); return; }
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
    sendGanttRouteError(res, 500, 'EVIDENCE_COUNTS_LOAD_FAILED');
  }
}
