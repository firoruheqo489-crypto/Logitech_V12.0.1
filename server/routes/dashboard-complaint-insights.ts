import type { Request, Response } from "express";
import { getComplaintInsightsPayload } from "../lib/complaint-insights.js";

export async function getDashboardComplaintInsights(_req: Request, res: Response): Promise<void> {
  try {
    const payload = getComplaintInsightsPayload();
    res.json(payload);
  } catch (error) {
    console.error("GET /api/dashboard/complaint-insights error:", error);
    res.status(500).json({
      error: "Failed to load complaint insights",
      code: "COMPLAINT_INSIGHTS_LOAD_FAILED",
    });
  }
}
