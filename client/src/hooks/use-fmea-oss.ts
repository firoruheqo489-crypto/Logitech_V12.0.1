"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  deleteFmeaArchiveVersion,
  getFmeaArchiveDocumentState,
  listFmeaArchiveDocuments,
  saveFmeaArchiveVersion,
  type FmeaDocument,
} from "@/lib/fmea-archive-api"
import type {
  FmeaRemoteHeaderFields,
  FmeaRemoteModule,
  FmeaRemoteWorkspaceState,
} from "@/lib/fmea-remote-state-api"

type UseFmeaOssOptions<TState extends FmeaRemoteWorkspaceState> = {
  module: FmeaRemoteModule
  projectId: string
  workspaceKey: string
  getWorkspaceState: () => TState
  applyWorkspaceState: (state: TState) => void
  onCurrentDocumentChange: (documentId: string | null) => void
}

function sortDocuments(documents: FmeaDocument[]): FmeaDocument[] {
  return [...documents].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt)
    const rightTime = Date.parse(right.createdAt)

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && rightTime !== leftTime) {
      return rightTime - leftTime
    }

    return right.createdAt.localeCompare(left.createdAt)
  })
}

function markCurrentDocument(
  documents: FmeaDocument[],
  currentDocumentId: string | null,
): FmeaDocument[] {
  return sortDocuments(
    documents.map((document) => ({
      ...document,
      isCurrent: Boolean(currentDocumentId) && document.id === currentDocumentId,
    })),
  )
}

export function deriveFmeaProjectId({
  module,
  workspaceKey,
  headerFields,
}: {
  module: FmeaRemoteModule
  workspaceKey: string
  headerFields: Pick<FmeaRemoteHeaderFields, "projectName" | "partNumber">
}): string {
  const partNumber = String(headerFields.partNumber ?? "").trim()
  if (partNumber) {
    return partNumber
  }

  const projectName = String(headerFields.projectName ?? "").trim()
  if (projectName) {
    return projectName
  }

  return `${module.toUpperCase()}-${workspaceKey}`
}

export function useFmeaOss<TState extends FmeaRemoteWorkspaceState>({
  module,
  projectId,
  workspaceKey,
  getWorkspaceState,
  applyWorkspaceState,
  onCurrentDocumentChange,
}: UseFmeaOssOptions<TState>) {
  const [documents, setDocuments] = useState<FmeaDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)

  const refreshDocuments = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      setIsLoadingDocuments(true)

      try {
        const nextDocuments = await listFmeaArchiveDocuments({
          module,
          projectId,
          workspaceKey,
        })
        setDocuments(sortDocuments(nextDocuments))
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof Error ? error.message : "云端历史档案读取失败",
          )
        }
      } finally {
        setIsLoadingDocuments(false)
      }
    },
    [module, projectId, workspaceKey],
  )

  useEffect(() => {
    setDocuments([])
    void refreshDocuments({ silent: true })
  }, [refreshDocuments])

  const saveAsVersion = useCallback(
    async (version: string) => {
      setIsSavingVersion(true)

      try {
        const document = await saveFmeaArchiveVersion({
          module,
          projectId,
          workspaceKey,
          version,
          state: getWorkspaceState(),
        })

        onCurrentDocumentChange(document.id)
        setDocuments((current) =>
          markCurrentDocument(
            [document, ...current.filter((item) => item.id !== document.id)],
            document.id,
          ),
        )

        return document
      } finally {
        setIsSavingVersion(false)
      }
    },
    [getWorkspaceState, module, onCurrentDocumentChange, projectId, workspaceKey],
  )

  const loadVersion = useCallback(
    async (document: FmeaDocument) => {
      setLoadingDocumentId(document.id)

      try {
        const result = await getFmeaArchiveDocumentState<TState>({
          module,
          projectId,
          documentId: document.id,
        })

        applyWorkspaceState(result.state)
        onCurrentDocumentChange(result.document.id)
        setDocuments((current) =>
          markCurrentDocument(
            [
              result.document,
              ...current.filter((item) => item.id !== result.document.id),
            ],
            result.document.id,
          ),
        )

        return result
      } finally {
        setLoadingDocumentId(null)
      }
    },
    [applyWorkspaceState, module, onCurrentDocumentChange, projectId],
  )

  const deleteVersion = useCallback(
    async (document: FmeaDocument) => {
      setDeletingDocumentId(document.id)

      try {
        await deleteFmeaArchiveVersion({
          module,
          projectId,
          workspaceKey,
          documentId: document.id,
        })

        setDocuments((current) => current.filter((item) => item.id !== document.id))
      } finally {
        setDeletingDocumentId(null)
      }
    },
    [module, projectId, workspaceKey],
  )

  return {
    documents,
    isLoadingDocuments,
    isSavingVersion,
    loadingDocumentId,
    deletingDocumentId,
    refreshDocuments,
    saveAsVersion,
    loadVersion,
    deleteVersion,
  }
}
