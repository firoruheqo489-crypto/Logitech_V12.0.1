'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { buildDefaultStudy, computeGrr, type StudyConfig } from './grr/gage-rnr'
import { type StudyMeta } from './grr/metadata-header'
import GrrPageContent from './grr/GrrPageContent'
import { buildGrrReportFileBaseName, exportGrrPdf, printGrrReport } from './grr/export-grr-report'
import { normalizeGrrWorkspaceState } from './grrEngine'
import { DashboardApiError } from '../lib/dashboardApi'
import {
  fetchDashboardGrrState,
  normalizeGrrWorkspaceKey,
  saveDashboardGrrState,
} from '../lib/grr-state-api'

const SAVE_DEBOUNCE_MS = 900

function isGrrSyncUnavailable(error: unknown) {
  if (error instanceof DashboardApiError) {
    return error.status === 404 || error.message.includes('not found (dev API only)')
  }

  return error instanceof Error && error.message.includes('not found (dev API only)')
}

export default function GrrWorkspace({ projectName }: { projectName?: string }) {
  const workspaceKey = useMemo(() => normalizeGrrWorkspaceKey(projectName), [projectName])
  const reportRef = useRef<HTMLElement | null>(null)
  const isSyncUnavailableRef = useRef(false)
  const [cfg, setCfg] = useState<StudyConfig>(() => buildDefaultStudy())
  const results = useMemo(() => computeGrr(cfg), [cfg])

  const [meta, setMeta] = useState<StudyMeta>(() => ({
    partName: '',
    characteristic: '',
    gageId: '',
    date: new Date().toISOString().slice(0, 10),
  }))
  const [isHydrating, setIsHydrating] = useState(true)
  const [syncStatus, setSyncStatus] = useState('云端工作区同步中')
  const isMountedRef = useRef(false)
  const lastSavedPayloadRef = useRef('')
  const statePayloadRef = useRef('')
  const syncInFlightRef = useRef(false)
  const hasShownSaveFailureRef = useRef(false)
  const [isPrintingReport, setIsPrintingReport] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const updateMeta = (patch: Partial<StudyMeta>) => setMeta((prev) => ({ ...prev, ...patch }))
  const workspacePayload = useMemo(() => JSON.stringify({ version: 1, meta, cfg }), [cfg, meta])

  useEffect(() => {
    statePayloadRef.current = workspacePayload
  }, [workspacePayload])

  useEffect(() => {
    isMountedRef.current = true
    setIsHydrating(true)
    setSyncStatus('云端工作区同步中')

    void (async () => {
      try {
        if (isSyncUnavailableRef.current) {
          return
        }

        const remote = await fetchDashboardGrrState({ workspaceKey })
        if (!isMountedRef.current) return

        const normalized = remote.state ? normalizeGrrWorkspaceState(remote.state) : null
        if (normalized) {
          setCfg(normalized.cfg)
          setMeta(normalized.meta)
          lastSavedPayloadRef.current = JSON.stringify(normalized)
        } else {
          const nextPayload = JSON.stringify({ version: 1, meta, cfg })
          lastSavedPayloadRef.current = nextPayload
        }
        hasShownSaveFailureRef.current = false
        setSyncStatus(remote.updatedAt ? `云端已同步 ${remote.updatedAt}` : '云端未发现现有GRR工作区，已载入默认模板')
      } catch (error) {
        if (!isMountedRef.current) return

        if (isGrrSyncUnavailable(error)) {
          isSyncUnavailableRef.current = true
          setSyncStatus('GRR 工作区云端同步未启用，当前以本地模式运行')
          return
        }

        const nextPayload = JSON.stringify({
          version: 1,
          meta: {
            partName: '',
            characteristic: '',
            gageId: '',
            date: new Date().toISOString().slice(0, 10),
          },
          cfg: buildDefaultStudy(),
        })
        lastSavedPayloadRef.current = nextPayload
        setSyncStatus('GRR工作区云端加载失败')
        toast.error(error instanceof Error ? error.message : 'GRR工作区云端加载失败')
      } finally {
        if (isMountedRef.current) {
          setIsHydrating(false)
        }
      }
    })()

    return () => {
      isMountedRef.current = false
    }
  }, [workspaceKey])

  useEffect(() => {
    if (!isMountedRef.current || isHydrating || isSyncUnavailableRef.current) {
      return
    }

    if (workspacePayload === lastSavedPayloadRef.current) {
      return
    }

    setSyncStatus('GRR工作区保存中')
    const timer = window.setTimeout(async () => {
      try {
        const result = await saveDashboardGrrState(
          {
            version: 1,
            meta,
            cfg,
          },
          { workspaceKey },
        )
        if (!isMountedRef.current) return

        lastSavedPayloadRef.current = workspacePayload
        hasShownSaveFailureRef.current = false
        setSyncStatus(result.updatedAt ? `GRR工作区已保存 ${result.updatedAt}` : 'GRR工作区已保存')
      } catch (error) {
        if (!isMountedRef.current) return

        if (isGrrSyncUnavailable(error)) {
          isSyncUnavailableRef.current = true
          setSyncStatus('GRR 工作区云端同步未启用，当前以本地模式运行')
          return
        }

        setSyncStatus('GRR工作区保存失败')
        if (!hasShownSaveFailureRef.current) {
          toast.error(error instanceof Error ? error.message : 'GRR工作区保存失败')
          hasShownSaveFailureRef.current = true
        }
      }
    }, SAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [cfg, isHydrating, meta, workspaceKey, workspacePayload])

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      if (isSyncUnavailableRef.current) {
        return
      }

      if (syncInFlightRef.current || statePayloadRef.current !== lastSavedPayloadRef.current) {
        return
      }

      syncInFlightRef.current = true
      void fetchDashboardGrrState({ workspaceKey })
        .then((remote) => {
          if (!isMountedRef.current || !remote.state) {
            return
          }

          const normalized = normalizeGrrWorkspaceState(remote.state)
          if (!normalized) {
            return
          }

          const nextPayload = JSON.stringify(normalized)
          if (nextPayload === lastSavedPayloadRef.current) {
            return
          }

          setCfg(normalized.cfg)
          setMeta(normalized.meta)
          lastSavedPayloadRef.current = nextPayload
          setSyncStatus(remote.updatedAt ? `云端已同步 ${remote.updatedAt}` : '云端已同步')
        })
        .catch((error) => {
          if (isGrrSyncUnavailable(error)) {
            isSyncUnavailableRef.current = true
            setSyncStatus('GRR 工作区云端同步未启用，当前以本地模式运行')
          }
        })
        .finally(() => {
          syncInFlightRef.current = false
        })
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [workspaceKey])

  const reset = () => setCfg(buildDefaultStudy())
  const fileBaseName = useMemo(
    () =>
      buildGrrReportFileBaseName({
        partName: meta.partName,
        characteristic: meta.characteristic,
        date: meta.date,
      }),
    [meta.characteristic, meta.date, meta.partName],
  )

  const handlePrintReport = async () => {
    setIsPrintingReport(true)
    try {
      await printGrrReport({
        meta,
        cfg,
        results,
        fileBaseName,
      })
      toast.success('GRR 打印预览已打开，请在预览页中点击打印')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'GRR 打印预览打开失败')
    } finally {
      setIsPrintingReport(false)
    }
  }

  const handleExportPdf = async () => {
    setIsExportingPdf(true)
    try {
      await exportGrrPdf({
        meta,
        cfg,
        results,
        fileBaseName,
      })
      toast.success('GRR PDF 已导出')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'GRR PDF 导出失败')
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {syncStatus}
      </div>
      <GrrPageContent
        ref={reportRef}
        cfg={cfg}
        meta={meta}
        onMetaChange={updateMeta}
        onCfgChange={(updater) => setCfg((prev) => updater(prev))}
        onReset={reset}
        onPrint={handlePrintReport}
        onExportPdf={handleExportPdf}
        isPrinting={isPrintingReport}
        isExportingPdf={isExportingPdf}
      />
    </>
  )
}
