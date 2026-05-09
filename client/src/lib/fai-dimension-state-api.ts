import { apiFetch } from "./api";

export type FaiDimensionRemoteState = {
  scope: string;
  fileName: string;
  assetUrl: string;
  selectedFai: string;
  payload?: unknown;
  updatedAt?: string;
};

type FaiDimensionIdentity = {
  scope?: string;
};

const DEFAULT_SCOPE = "global";

function buildFaiDimensionStateUrl({ scope }: FaiDimensionIdentity): string {
  const params = new URLSearchParams({
    scope: scope || DEFAULT_SCOPE,
  });

  return `/api/dashboard/fai-dimension-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export async function fetchFaiDimensionState(identity: FaiDimensionIdentity = {}): Promise<FaiDimensionRemoteState | null> {
  const response = await apiFetch(buildFaiDimensionStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as { state?: FaiDimensionRemoteState | null; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load FAI dimension state"));
  }

  return payload?.state ?? null;
}

export async function saveFaiDimensionState(state: FaiDimensionRemoteState): Promise<void> {
  const response = await apiFetch("/api/dashboard/fai-dimension-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to save FAI dimension state"));
  }
}

export async function deleteFaiDimensionState(identity: FaiDimensionIdentity = {}): Promise<void> {
  const response = await apiFetch(buildFaiDimensionStateUrl(identity), {
    method: "DELETE",
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to delete FAI dimension state"));
  }
}
