// ⚠️ env.ts 必须是第一个 import —— 它加载 .env 到 process.env
// ESM 中所有 import 按书写顺序依次执行，写在最前面就能保证
// DATABASE_URL 在 db.ts 初始化之前已经就绪。
import './env.js';

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createServer } from "http";
import { registerApiAccessPolicy } from "./middleware/apiAccessPolicy.js";
import { registerDbWarmupGate, type DbWarmupState } from "./middleware/dbWarmupGate.js";
import { securityHeaders } from "./middleware/security.js";
import { getReleaseInfoHandler } from "./release.js";
import { authSessionRouter } from "./routes/auth-session.js";
import { getGanttDataHandler, postGanttImportHandler, patchProjectImageHandler, checkProjectExistsHandler, deleteGanttProject, getTaskEvidenceHandler, postTaskEvidenceHandler, deleteEvidenceHandler, getProjectEvidenceCountsHandler } from "./routes/gantt.js";
import { listDashboardProjects, getDashboardProject, batchReplaceDashboardProjects, clearDashboardProjects, getDashboardHealthCheck, getLatestDashboardHealthCheck, runDashboardHealthCheck, ensureDashboardHealthTable, ensureDashboardModuleOrderTable } from "./routes/dashboard.js";
import { listDashboardProjectAssets, upsertDashboardProjectAsset, deleteDashboardProjectAsset, ensureDashboardProjectAssetsTable } from "./routes/dashboard-assets.js";
import { deleteDashboardPartFaiState, ensureDashboardPartFaiTable, getDashboardPartFaiState, upsertDashboardPartFaiState } from "./routes/dashboard-part-fai.js";
import {
  deleteDashboardFaiDimensionState,
  ensureDashboardFaiDimensionTable,
  getDashboardFaiDimensionState,
  upsertDashboardFaiDimensionState,
} from "./routes/dashboard-fai-dimension-state.js";
import { deleteDashboardMoldTrialEvidenceState, ensureDashboardMoldTrialEvidenceTable, getDashboardMoldTrialEvidenceState, upsertDashboardMoldTrialEvidenceState } from "./routes/dashboard-mold-trial-evidence.js";
import { deleteDashboardToolingFaiState, ensureDashboardToolingFaiTable, getDashboardToolingFaiState, upsertDashboardToolingFaiState } from "./routes/dashboard-tooling-fai.js";
import {
  deleteDashboardDocxConverterState,
  ensureDashboardDocxConverterTable,
  getDashboardDocxConverterState,
  upsertDashboardDocxConverterState,
} from "./routes/dashboard-docx-converter-state.js";
import {
  deleteDashboardProjectGanttState,
  ensureDashboardProjectGanttStateTable,
  getDashboardProjectGanttState,
  upsertDashboardProjectGanttState,
} from "./routes/dashboard-project-gantt-state.js";
import { listDashboardProductData, batchUpsertDashboardProductData, ensureDashboardProductDataTable } from "./routes/dashboard-product-data.js";
import { listDashboardProductDocs, upsertDashboardProductDoc, deleteDashboardProductDoc } from "./routes/dashboard-product-docs.js";
import { getProgressNotes, getLatestProgressBackup, saveProgressNotes, upsertProgressNote, createProgressBackup, restoreLatestProgressNotes, deleteProgressNote, getProgressNoteAuditLogs, ensureBackupTable, ensureProgressAuditTable } from "./routes/progress-notes.js";
import { listIssues, createIssue, updateIssue, deleteIssue, ensureIssuesTable } from "./routes/issues.js";
import {
  deleteMoldMaintenanceLog,
  ensureReliabilityTables,
  generateReliabilityWorkOrder,
  getDashboardStats,
  getMoldTelemetry,
  getReliabilityState,
  postMoldMaintenanceLog,
  postReliabilityEvent,
} from "./routes/reliability.js";
import { getTasksForSCurve } from "./routes/tasks.js";
import { uploadsRouter } from "./routes/uploads.js";
import {
  createTrialPreviewUrl,
  createTrialUploadUrl,
  ensureTrialDocumentsTable,
  insertTrialDocument,
  listTrialDocuments,
  streamTrialDocumentPreview,
} from "./routes/trial-documents.js";
import { db, sql } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dev API only: set DEV_API=1 and PORT=3001 so Vite proxy /api -> localhost:3001
const isDevApiOnly = process.env.DEV_API === "1";
type DbWarmupTask = { name: string; run: () => Promise<unknown> };
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWarmupErrorSignature(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    const maybeCoded = error as Error & { code?: unknown; errno?: unknown };
    return [
      error.name,
      error.message,
      typeof maybeCoded.code === "string" ? maybeCoded.code : "",
      typeof maybeCoded.errno === "string" ? maybeCoded.errno : "",
    ].join(" ");
  }

  if (typeof error === "object") {
    const maybeRecord = error as Record<string, unknown>;
    return [
      typeof maybeRecord.code === "string" ? maybeRecord.code : "",
      typeof maybeRecord.errno === "string" ? maybeRecord.errno : "",
      typeof maybeRecord.message === "string" ? maybeRecord.message : "",
    ].join(" ");
  }

  return String(error);
}

function isRetryableWarmupError(error: unknown): boolean {
  const signature = getWarmupErrorSignature(error).toUpperCase();
  return [
    "CONNECT_TIMEOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EPIPE",
    "ENOTFOUND",
    "EAI_AGAIN",
    "SOCKET HANG UP",
    "CONNECTION TERMINATED",
    "CONNECTION REFUSED",
    "CONNECTION TIMEOUT",
  ].some((token) => signature.includes(token));
}

function createDbWarmupFailedError(taskName: string, cause: unknown): Error {
  const error = new Error(`DB_WARMUP_FAILED: ${taskName} failed after ${MAX_RETRIES} physical attempts`);
  const codedError = error as Error & { code: string; cause?: unknown };
  codedError.code = "DB_WARMUP_FAILED";
  codedError.cause = cause;
  return error;
}

async function runWithWarmupRetry<T>(taskName: string, run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const retryable = isRetryableWarmupError(error);
      if (!retryable) {
        throw error;
      }

      if (attempt >= MAX_RETRIES) {
        console.error(
          `[WARMUP] DB_WARMUP_FAILED ${taskName} fatal meltdown after ${MAX_RETRIES} physical attempts:`,
          error,
        );
        throw createDbWarmupFailedError(taskName, error);
      }

      const delayMs = BASE_DELAY * Math.pow(2, attempt - 1);
      console.warn(
        `[WARMUP] ${taskName} 数据库未响应，进行第 ${attempt} 次退避重试... delay=${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error(`[WARMUP] ${taskName} retry loop exhausted unexpectedly`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const warmupState: DbWarmupState = {
    phase: "pending",
    startedAt: null,
    finishedAt: null,
    failedTasks: [],
  };
  const warmupTasks: DbWarmupTask[] = [
    { name: "dashboard_project_assets", run: ensureDashboardProjectAssetsTable },
    { name: "dashboard_product_data", run: ensureDashboardProductDataTable },
    { name: "dashboard_tooling_fai", run: ensureDashboardToolingFaiTable },
    { name: "dashboard_part_fai", run: ensureDashboardPartFaiTable },
    { name: "dashboard_fai_dimension", run: ensureDashboardFaiDimensionTable },
    { name: "dashboard_mold_trial_evidence", run: ensureDashboardMoldTrialEvidenceTable },
    { name: "dashboard_docx_converter", run: ensureDashboardDocxConverterTable },
    { name: "dashboard_project_gantt", run: ensureDashboardProjectGanttStateTable },
    { name: "dashboard_trial_documents", run: ensureTrialDocumentsTable },
    { name: "dashboard_health", run: ensureDashboardHealthTable },
    { name: "dashboard_module_order", run: ensureDashboardModuleOrderTable },
    { name: "progress_backup", run: ensureBackupTable },
    { name: "progress_audit", run: ensureProgressAuditTable },
    { name: "issues", run: ensureIssuesTable },
    { name: "reliability", run: ensureReliabilityTables },
  ];
  const startDbWarmup = () => {
    warmupState.phase = "running";
    warmupState.startedAt = new Date().toISOString();
    warmupState.finishedAt = null;
    warmupState.failedTasks = [];

    void Promise.allSettled(warmupTasks.map((task) => runWithWarmupRetry(task.name, task.run))).then((results) => {
      const failedTasks = results
        .map((result, index) => {
          if (result.status !== "rejected") return null;
          return warmupTasks[index]?.name ?? `task-${index}`;
        })
        .filter((name): name is string => Boolean(name));

      warmupState.failedTasks = failedTasks;
      warmupState.phase = failedTasks.length > 0 ? "failed" : "ready";
      warmupState.finishedAt = new Date().toISOString();

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`[db-warmup] ${warmupTasks[index]?.name ?? `task-${index}`} failed:`, result.reason);
        }
      });
    });
  };
  const sendFreshSpaHtml = (res: express.Response, staticPath: string) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(staticPath, "index.html"));
  };

  app.use(express.json({ limit: '20mb' }));

  // ── 安全中间件 ──
  app.use(securityHeaders);
  registerApiAccessPolicy(app);

  // 健康检查：用于确认后端与数据库是否可用
  app.get("/api/release", getReleaseInfoHandler);
  app.get("/api/health", async (_req, res) => {
    if (!db || !sql) {
      res.status(200).json({
        ok: true,
        api: true,
        db: "missing",
        dbReady: false,
        warmup: {
          phase: warmupState.phase,
          startedAt: warmupState.startedAt,
          finishedAt: warmupState.finishedAt,
          failedTasks: warmupState.failedTasks,
        },
      });
      return;
    }

    try {
      await sql`SELECT 1`;
      res.status(200).json({
        ok: true,
        api: true,
        db: "ok",
        dbReady: warmupState.phase === "ready",
        warmup: {
          phase: warmupState.phase,
          startedAt: warmupState.startedAt,
          finishedAt: warmupState.finishedAt,
          failedTasks: warmupState.failedTasks,
        },
      });
    } catch (e) {
      res.status(503).json({
        ok: false,
        api: true,
        db: "error",
        message: "database unavailable",
        code: "DATABASE_UNAVAILABLE",
        dbReady: false,
        warmup: {
          phase: warmupState.phase,
          startedAt: warmupState.startedAt,
          finishedAt: warmupState.finishedAt,
          failedTasks: warmupState.failedTasks,
        },
      });
    }
  });

  app.use("/api/auth", authSessionRouter);

  registerDbWarmupGate(app, () => warmupState);

  // API — 甘特数据持久化与加载
  app.get("/api/gantt/data", getGanttDataHandler);
  app.get("/api/gantt/check-project", checkProjectExistsHandler);
  app.post("/api/gantt/import", postGanttImportHandler);
  app.patch("/api/gantt/project/:projectId/image", patchProjectImageHandler);
  app.delete("/api/gantt/project/:projectId", deleteGanttProject);

  // API — 证据文档 (Evidence)
  app.get("/api/gantt/task/:taskId/evidence", getTaskEvidenceHandler);
  app.post("/api/gantt/task/:taskId/evidence", postTaskEvidenceHandler);
  app.delete("/api/gantt/evidence/:evidenceId", deleteEvidenceHandler);
  app.get("/api/gantt/project/:projectId/evidence-counts", getProjectEvidenceCountsHandler);
  app.use("/api/uploads", uploadsRouter);
  app.post("/api/storage/presigned-url/upload-url", createTrialUploadUrl);
  app.post("/api/storage/presigned-url/preview-url", createTrialPreviewUrl);

  // API — 看板项目数据 (V1 Dashboard)
  app.get("/api/dashboard/projects", listDashboardProjects);
  app.get("/api/dashboard/trial-documents", listTrialDocuments);
  app.post("/api/dashboard/trial-documents", insertTrialDocument);
  app.get("/api/dashboard/trial-documents/preview", streamTrialDocumentPreview);
  app.get("/api/dashboard/projects/:id", getDashboardProject);
  app.post("/api/dashboard/projects/batch-replace", batchReplaceDashboardProjects);
  app.get("/api/dashboard/project-assets", listDashboardProjectAssets);
  app.patch("/api/dashboard/project-assets/:moldNumber/:slotType", upsertDashboardProjectAsset);
  app.delete("/api/dashboard/project-assets/:moldNumber/:slotType", deleteDashboardProjectAsset);
  app.get("/api/dashboard/product-data", listDashboardProductData);
  app.post("/api/dashboard/product-data/batch-upsert", batchUpsertDashboardProductData);
  app.get("/api/dashboard/product-docs", listDashboardProductDocs);
  app.patch("/api/dashboard/product-docs/:moldNumber/:slotType", upsertDashboardProductDoc);
  app.delete("/api/dashboard/product-docs/:moldNumber/:slotType", deleteDashboardProductDoc);
  app.get("/api/dashboard/tooling-fai-state", getDashboardToolingFaiState);
  app.put("/api/dashboard/tooling-fai-state", upsertDashboardToolingFaiState);
  app.delete("/api/dashboard/tooling-fai-state", deleteDashboardToolingFaiState);
  app.get("/api/dashboard/part-fai-state", getDashboardPartFaiState);
  app.put("/api/dashboard/part-fai-state", upsertDashboardPartFaiState);
  app.delete("/api/dashboard/part-fai-state", deleteDashboardPartFaiState);
  app.get("/api/dashboard/fai-dimension-state", getDashboardFaiDimensionState);
  app.put("/api/dashboard/fai-dimension-state", upsertDashboardFaiDimensionState);
  app.delete("/api/dashboard/fai-dimension-state", deleteDashboardFaiDimensionState);
  app.get("/api/dashboard/mold-trial-evidence-state", getDashboardMoldTrialEvidenceState);
  app.put("/api/dashboard/mold-trial-evidence-state", upsertDashboardMoldTrialEvidenceState);
  app.delete("/api/dashboard/mold-trial-evidence-state", deleteDashboardMoldTrialEvidenceState);
  app.get("/api/dashboard/docx-converter-state", getDashboardDocxConverterState);
  app.put("/api/dashboard/docx-converter-state", upsertDashboardDocxConverterState);
  app.delete("/api/dashboard/docx-converter-state", deleteDashboardDocxConverterState);
  app.get("/api/dashboard/project-gantt-state", getDashboardProjectGanttState);
  app.put("/api/dashboard/project-gantt-state", upsertDashboardProjectGanttState);
  app.delete("/api/dashboard/project-gantt-state", deleteDashboardProjectGanttState);
  app.delete("/api/dashboard/projects", clearDashboardProjects);
  app.get("/api/dashboard/health-check", getDashboardHealthCheck);
  app.get("/api/dashboard/health-check/latest", getLatestDashboardHealthCheck);
  app.get("/api/dashboard/stats", getDashboardStats);
  app.get("/api/dashboard/stats/:projectId", getDashboardStats);

  // API — 项目推进细节 (Progress Notes)
  app.get("/api/dashboard/progress-notes/:moldNumber", getProgressNotes);
  app.get("/api/dashboard/progress-notes/:moldNumber/latest-backup", getLatestProgressBackup);
  app.post("/api/dashboard/progress-notes/:moldNumber", saveProgressNotes);
  app.post("/api/dashboard/progress-notes/:moldNumber/entry", upsertProgressNote);
  app.post("/api/dashboard/progress-notes/:moldNumber/create-backup", createProgressBackup);
  app.post("/api/dashboard/progress-notes/:moldNumber/restore-latest", restoreLatestProgressNotes);
  app.delete("/api/dashboard/progress-notes/:moldNumber/:noteId", deleteProgressNote);
  app.get("/api/dashboard/progress-notes/:moldNumber/audit", getProgressNoteAuditLogs);

  // API — S 曲线任务数据（替代前端直连 Supabase）
  app.get("/api/tasks", getTasksForSCurve);
  app.get("/api/issues", listIssues);
  app.post("/api/issues", createIssue);
  app.patch("/api/issues/:id", updateIssue);
  app.delete("/api/issues/:id", deleteIssue);
  app.get("/api/mold/:moldId/telemetry", getMoldTelemetry);
  app.post("/api/mold/:moldId/maintenance-logs", postMoldMaintenanceLog);
  app.delete("/api/mold/:moldId/maintenance-logs/:id", deleteMoldMaintenanceLog);
  app.get("/api/reliability/state/:moldId", getReliabilityState);
  app.post("/api/reliability/event", postReliabilityEvent);
  app.post("/api/reliability/work-order", generateReliabilityWorkOrder);

  if (!isDevApiOnly) {
    const staticPath =
      process.env.NODE_ENV === "production"
        ? path.resolve(__dirname, "public")
        : path.resolve(__dirname, "..", "dist", "public");

    app.get(["/", "/index.html"], (_req, res) => {
      sendFreshSpaHtml(res, staticPath);
    });

    // /assets/ 下带 hash 的 JS/CSS → 一年强缓存 + immutable
    app.use('/assets', express.static(path.join(staticPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
      etag: false,
      lastModified: false,
    }));

    // 其余静态文件（favicon 等）→ 短缓存
    app.use(express.static(staticPath, {
      maxAge: 0,
      etag: true,
    }));

    // SPA fallback → HTML 永远不缓存
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    app.use((_req, res) => {
      res.status(404).json({ error: "not found (dev API only)", code: "ROUTE_NOT_FOUND" });
    });
  }

  const port = process.env.PORT || (isDevApiOnly ? 3001 : 3000);
  server.listen(port, () => {
    console.log(isDevApiOnly
      ? `API only on http://localhost:${port}/`
      : `Server running on http://localhost:${port}/`);
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️  DATABASE_URL 未设置，/api/gantt/data 与 /api/gantt/import 将返回 503。请在 .env 中配置 Supabase 连接。');
    }

    const runAndLogHealthCheck = async () => {
      try {
        const report = await runWithWarmupRetry("dashboard_health_check", runDashboardHealthCheck);
        if (!report) return;
        console.log('[dashboard-health]', JSON.stringify(report));
      } catch (error) {
        console.error('[dashboard-health] run failed:', (error as Error).message);
      }
    };

    startDbWarmup();
    runAndLogHealthCheck();
    setInterval(runAndLogHealthCheck, 24 * 60 * 60 * 1000);
  });
}

startServer().catch(console.error);
