'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { buildDefaultStudy, type StudyConfig } from './grr/gage-rnr'
import { type StudyMeta } from './grr/metadata-header'
import GrrPageContent from './grr/GrrPageContent'
import { normalizeGrrWorkspaceState } from './grrEngine'
import {
  fetchDashboardGrrState,
  normalizeGrrWorkspaceKey,
  saveDashboardGrrState,
} from '../lib/grr-state-api'

const SAVE_DEBOUNCE_MS = 900

export default function GrrWorkspace({ projectName }: { projectName?: string }) {
  const workspaceKey = useMemo(() => normalizeGrrWorkspaceKey(projectName), [projectName])
  const [cfg, setCfg] = useState<StudyConfig>(() => buildDefaultStudy())

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
    if (!isMountedRef.current || isHydrating) {
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
        .catch(() => {
          // Keep the current state if background sync fails.
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

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {syncStatus}
      </div>
      <GrrPageContent
        cfg={cfg}
        meta={meta}
        onMetaChange={updateMeta}
        onCfgChange={(updater) => setCfg((prev) => updater(prev))}
        onReset={reset}
      />
    </>
  )
}
