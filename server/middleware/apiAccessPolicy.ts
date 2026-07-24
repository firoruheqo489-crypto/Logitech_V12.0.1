import type { RequestHandler } from "express";
import { apiKeyAuth, dashboardAccessAuth } from "./auth.js";
import { apiCors } from "./apiCors.js";

type ApiAccessPolicyApp = {
  use: (path: string, handler: RequestHandler) => unknown;
};

export const API_ACCESS_POLICY_PATH = "/api";

export function registerApiAccessPolicy(app: ApiAccessPolicyApp): void {
  app.use(API_ACCESS_POLICY_PATH, apiCors);
  app.use(API_ACCESS_POLICY_PATH, dashboardAccessAuth);
  app.use(API_ACCESS_POLICY_PATH, apiKeyAuth);
}
