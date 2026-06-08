import { useCallback, useEffect, useState } from "react";

import {
  fetchReport8DArchiveReports,
  fetchReport8DRemoteWorkspaceState,
  saveReport8DRemoteWorkspaceState,
  type EightDReport,
  type Report8DWorkspaceState,
} from "@/lib/report-8d-remote-state-api";

type UseEightDCaseArchiveOptions = {
  workspaceKey: string;
  buildEmptyCaseState: (reportId: string) => Report8DWorkspaceState;
  onWorkspaceLoaded: (state: Report8DWorkspaceState) => void;
  onWorkspaceSaved?: (state: Report8DWorkspaceState, updatedAt?: string) => void;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function buildTimestampReportId(value = new Date()): string {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hour = pad(value.getHours());
  const minute = pad(value.getMinutes());
  const second = pad(value.getSeconds());
  return `8D-${year}${month}${day}-${hour}${minute}${second}`;
}

function formatArchiveMonth(value = new Date()): string {
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  return `${year}-${month}`;
}

export function useEightDCaseArchive({
  workspaceKey,
  buildEmptyCaseState,
  onWorkspaceLoaded,
  onWorkspaceSaved,
}: UseEightDCaseArchiveOptions) {
  const [reports, setReports] = useState<EightDReport[]>([]);
  const [archiveMonth, setArchiveMonth] = useState(() => formatArchiveMonth());
  const [archiveLimit, setArchiveLimit] = useState<number | undefined>();
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [isCaseSaving, setIsCaseSaving] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const refreshArchive = useCallback(async () => {
    setIsArchiveLoading(true);
    try {
      const result = await fetchReport8DArchiveReports({ workspaceKey, archiveMonth });
      setReports(result.reports);
      setArchiveLimit(result.limit);
      return result.reports;
    } finally {
      setIsArchiveLoading(false);
    }
  }, [archiveMonth, workspaceKey]);

  useEffect(() => {
    void refreshArchive().catch(() => {
      setReports([]);
    });
  }, [refreshArchive]);

  const stageSave = useCallback(async (state: Report8DWorkspaceState) => {
    setIsCaseSaving(true);
    try {
      const result = await saveReport8DRemoteWorkspaceState(state);
      onWorkspaceSaved?.(state, result.updatedAt);
      await refreshArchive();
      return result;
    } finally {
      setIsCaseSaving(false);
    }
  }, [onWorkspaceSaved, refreshArchive]);

  const createCase = useCallback(async () => {
    const newState = buildEmptyCaseState(buildTimestampReportId());
    setIsCaseSaving(true);
    try {
      const result = await saveReport8DRemoteWorkspaceState(newState);
      onWorkspaceLoaded(newState);
      onWorkspaceSaved?.(newState, result.updatedAt);
      await refreshArchive();
      return newState;
    } finally {
      setIsCaseSaving(false);
    }
  }, [buildEmptyCaseState, onWorkspaceLoaded, onWorkspaceSaved, refreshArchive]);

  const loadCase = useCallback(async (report: EightDReport) => {
    setLoadingReportId(report.reportId);
    try {
      const state = await fetchReport8DRemoteWorkspaceState({
        workspaceKey,
        reportId: report.reportId,
        ossUrl: report.ossUrl,
        archiveMonth: report.archiveMonth || archiveMonth,
      });

      if (!state) {
        throw new Error("该 8D 案件在 OSS 中不存在或已被删除");
      }

      onWorkspaceLoaded(state);
      onWorkspaceSaved?.(state, state.updatedAt);
      return state;
    } finally {
      setLoadingReportId(null);
    }
  }, [archiveMonth, onWorkspaceLoaded, onWorkspaceSaved, workspaceKey]);

  return {
    reports,
    archiveMonth,
    archiveLimit,
    setArchiveMonth,
    isArchiveLoading,
    isCaseSaving,
    loadingReportId,
    refreshArchive,
    stageSave,
    createCase,
    loadCase,
  };
}
