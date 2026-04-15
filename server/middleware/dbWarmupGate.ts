import type { Express, NextFunction, Request, Response } from "express";

export type DbWarmupPhase = "pending" | "running" | "ready" | "failed";

export type DbWarmupState = {
  phase: DbWarmupPhase;
  startedAt: string | null;
  finishedAt: string | null;
  failedTasks: string[];
};

export function registerDbWarmupGate(app: Express, getWarmupState: () => DbWarmupState): void {
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health" || req.path === "/release") {
      next();
      return;
    }

    const warmupState = getWarmupState();
    if (warmupState.phase === "ready") {
      next();
      return;
    }

    const waitingForDb = warmupState.phase === "pending" || warmupState.phase === "running";
    const code = waitingForDb ? "DB_WARMUP_IN_PROGRESS" : "DB_WARMUP_FAILED";
    const message = waitingForDb
      ? "service warming up, please retry shortly"
      : "service warmup failed, database routes are temporarily unavailable";

    res.status(503).json({
      ok: false,
      api: true,
      code,
      message,
      retryable: waitingForDb,
      warmup: {
        phase: warmupState.phase,
        startedAt: warmupState.startedAt,
        finishedAt: warmupState.finishedAt,
        failedTasks: warmupState.failedTasks,
      },
    });
  });
}
