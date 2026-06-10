import { apiFetch } from "@/lib/api";

import type { TimeSeriesDataset } from "../components/timeSeriesData";

export type TimeSeriesRemoteState = {
  scope: string;
  dataset: TimeSeriesDataset;
  selectedRowId: string | null;
  updatedAt?: string;
};

export type TimeSeriesArchiveRecord = {
  id: string;
  scope: string;
  title: string;
  sourceName: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
};

type TimeSeriesStateIdentity = {
  scope?: string;
};

const DEFAULT_SCOPE = "dashboard-time-series-workspace";

function buildTimeSeriesStateUrl({ scope }: TimeSeriesStateIdentity = {}): string {
  const params = new URLSearchParams({
    scope: scope || DEFAULT_SCOPE,
  });

  return `/api/dashboard/time-series-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export async function fetchTimeSeriesState(identity: TimeSeriesStateIdentity = {}): Promise<TimeSeriesRemoteState | null> {
  const response = await apiFetch(buildTimeSeriesStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as { state?: TimeSeriesRemoteState | null; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load time series state"));
  }

  return payload?.state ?? null;
}

export async function saveTimeSeriesState(state: TimeSeriesRemoteState): Promise<void> {
  const response = await apiFetch("/api/dashboard/time-series-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to save time series state"));
  }
}

export async function deleteTimeSeriesState(identity: TimeSeriesStateIdentity = {}): Promise<void> {
  const response = await apiFetch(buildTimeSeriesStateUrl(identity), {
    method: "DELETE",
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to delete time series state"));
  }
}

export async function fetchTimeSeriesArchives(identity: TimeSeriesStateIdentity = {}): Promise<TimeSeriesArchiveRecord[]> {
  const response = await apiFetch(`/api/dashboard/time-series-archives?${new URLSearchParams({ scope: identity.scope || DEFAULT_SCOPE }).toString()}`);
  const payload = (await response.json().catch(() => null)) as { archives?: TimeSeriesArchiveRecord[]; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load time series archives"));
  }

  return payload?.archives ?? [];
}

export async function createTimeSeriesArchive(state: TimeSeriesRemoteState, title?: string): Promise<TimeSeriesArchiveRecord> {
  const response = await apiFetch("/api/dashboard/time-series-archives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...state,
      title: title || state.dataset.sourceName,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { archive?: TimeSeriesArchiveRecord; error?: string } | null;

  if (!response.ok || !payload?.archive) {
    throw new Error(readErrorMessage(payload, "Failed to create time series archive"));
  }

  return payload.archive;
}

export async function fetchTimeSeriesArchive(archiveId: string, identity: TimeSeriesStateIdentity = {}): Promise<TimeSeriesRemoteState | null> {
  const params = new URLSearchParams({
    scope: identity.scope || DEFAULT_SCOPE,
    archiveId,
  });
  const response = await apiFetch(`/api/dashboard/time-series-archives/document?${params.toString()}`);
  const payload = (await response.json().catch(() => null)) as { archive?: { state?: TimeSeriesRemoteState | null }; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load time series archive"));
  }

  return payload?.archive?.state ?? null;
}

export async function deleteTimeSeriesArchive(archiveId: string, identity: TimeSeriesStateIdentity = {}): Promise<void> {
  const params = new URLSearchParams({
    scope: identity.scope || DEFAULT_SCOPE,
    archiveId,
  });

  const response = await apiFetch(`/api/dashboard/time-series-archives?${params.toString()}`, {
    method: "DELETE",
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to delete time series archive"));
  }
}

export async function renameTimeSeriesArchive(
  archiveId: string,
  title: string,
  identity: TimeSeriesStateIdentity = {},
): Promise<TimeSeriesArchiveRecord> {
  const response = await apiFetch("/api/dashboard/time-series-archives", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: identity.scope || DEFAULT_SCOPE,
      archiveId,
      title,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { archive?: TimeSeriesArchiveRecord; error?: string } | null;

  if (!response.ok || !payload?.archive) {
    throw new Error(readErrorMessage(payload, "Failed to rename time series archive"));
  }

  return payload.archive;
}
