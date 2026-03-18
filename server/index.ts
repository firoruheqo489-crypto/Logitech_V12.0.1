// ⚠️ env.ts 必须是第一个 import —— 它加载 .env 到 process.env
// ESM 中所有 import 按书写顺序依次执行，写在最前面就能保证
// DATABASE_URL 在 db.ts 初始化之前已经就绪。
import './env.js';

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createServer } from "http";
import { apiKeyAuth } from "./middleware/auth.js";
import { securityHeaders } from "./middleware/security.js";
import { getGanttDataHandler, postGanttImportHandler, patchProjectImageHandler, checkProjectExistsHandler, deleteGanttProject, getTaskEvidenceHandler, postTaskEvidenceHandler, deleteEvidenceHandler, getProjectEvidenceCountsHandler } from "./routes/gantt.js";
import { listDashboardProjects, getDashboardProject, batchReplaceDashboardProjects, clearDashboardProjects, getDashboardHealthCheck, getLatestDashboardHealthCheck, runDashboardHealthCheck, ensureDashboardHealthTable, ensureDashboardModuleOrderTable } from "./routes/dashboard.js";
import { listDashboardProjectAssets, upsertDashboardProjectAsset, deleteDashboardProjectAsset, ensureDashboardProjectAssetsTable } from "./routes/dashboard-assets.js";
import { listDashboardProductData, batchUpsertDashboardProductData, ensureDashboardProductDataTable } from "./routes/dashboard-product-data.js";
import { getProgressNotes, getLatestProgressBackup, saveProgressNotes, createProgressBackup, restoreLatestProgressNotes, deleteProgressNote, getProgressNoteAuditLogs, ensureBackupTable, ensureProgressAuditTable } from "./routes/progress-notes.js";
import { getTasksForSCurve } from "./routes/tasks.js";
import { db, sql } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dev API only: set DEV_API=1 and PORT=3001 so Vite proxy /api -> localhost:3001
const isDevApiOnly = process.env.DEV_API === "1";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '20mb' }));

  // ── 安全中间件 ──
  app.use(securityHeaders);

  // CORS：GET 对公网开放，写操作预检仅放行可信来源
  const TRUSTED_ORIGINS = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://120.27.153.140',
    'http://120.27.153.140:3000',
  ]);

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin as string | undefined;

    if (req.method === 'OPTIONS') {
      // 预检请求：只有可信来源才能获得写操作许可
      if (origin && TRUSTED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.sendStatus(204);
      } else {
        // 非可信来源的预检：只允许简单 GET
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        if (origin) {
          res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.sendStatus(204);
      }
      return;
    }

    // 实际请求：设置对应的 CORS 响应头
    if (origin && TRUSTED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    next();
  });

  app.use('/api', apiKeyAuth);

  // 健康检查：用于确认后端与数据库是否可用
  app.get("/api/health", async (_req, res) => {
    if (!db || !sql) {
      res.status(200).json({ ok: true, api: true, db: "missing" });
      return;
    }
    try {
      await sql`SELECT 1`;
      res.status(200).json({ ok: true, api: true, db: "ok" });
    } catch (e) {
      res.status(503).json({
        ok: false,
        api: true,
        db: "error",
        message: "database unavailable",
        code: "DATABASE_UNAVAILABLE",
      });
    }
  });

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

  // API — 看板项目数据 (V1 Dashboard)
  app.get("/api/dashboard/projects", listDashboardProjects);
  app.get("/api/dashboard/projects/:id", getDashboardProject);
  app.post("/api/dashboard/projects/batch-replace", batchReplaceDashboardProjects);
  app.get("/api/dashboard/project-assets", listDashboardProjectAssets);
  app.patch("/api/dashboard/project-assets/:moldNumber/:slotType", upsertDashboardProjectAsset);
  app.delete("/api/dashboard/project-assets/:moldNumber/:slotType", deleteDashboardProjectAsset);
  app.get("/api/dashboard/product-data", listDashboardProductData);
  app.post("/api/dashboard/product-data/batch-upsert", batchUpsertDashboardProductData);
  app.delete("/api/dashboard/projects", clearDashboardProjects);
  app.get("/api/dashboard/health-check", getDashboardHealthCheck);
  app.get("/api/dashboard/health-check/latest", getLatestDashboardHealthCheck);

  // API — 项目推进细节 (Progress Notes)
  app.get("/api/dashboard/progress-notes/:moldNumber", getProgressNotes);
  app.get("/api/dashboard/progress-notes/:moldNumber/latest-backup", getLatestProgressBackup);
  app.post("/api/dashboard/progress-notes/:moldNumber", saveProgressNotes);
  app.post("/api/dashboard/progress-notes/:moldNumber/create-backup", createProgressBackup);
  app.post("/api/dashboard/progress-notes/:moldNumber/restore-latest", restoreLatestProgressNotes);
  app.delete("/api/dashboard/progress-notes/:moldNumber/:noteId", deleteProgressNote);
  app.get("/api/dashboard/progress-notes/:moldNumber/audit", getProgressNoteAuditLogs);

  // API — S 曲线任务数据（替代前端直连 Supabase）
  app.get("/api/tasks", getTasksForSCurve);

  if (!isDevApiOnly) {
    const staticPath =
      process.env.NODE_ENV === "production"
        ? path.resolve(__dirname, "public")
        : path.resolve(__dirname, "..", "dist", "public");

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
      res.status(404).json({ error: "Not found (dev API only)" });
    });
  }

  const warmupResults = await Promise.allSettled([
    ensureDashboardProjectAssetsTable(),
    ensureDashboardProductDataTable(),
    ensureDashboardHealthTable(),
    ensureDashboardModuleOrderTable(),
    ensureBackupTable(),
    ensureProgressAuditTable(),
  ]);

  warmupResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[db-warmup] task-${index} failed:`, result.reason);
    }
  });

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
        const report = await runDashboardHealthCheck();
        if (!report) return;
        console.log('[dashboard-health]', JSON.stringify(report));
      } catch (error) {
        console.error('[dashboard-health] run failed:', (error as Error).message);
      }
    };

    runAndLogHealthCheck();
    setInterval(runAndLogHealthCheck, 24 * 60 * 60 * 1000);
  });
}

startServer().catch(console.error);
