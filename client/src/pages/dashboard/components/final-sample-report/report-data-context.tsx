import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  INITIAL_REPORT_DATA,
  parseFinalSampleReportMatrix,
  type FinalSampleReportData,
} from "./report-data"

const EMBEDDED_SOURCE_NAME = "内置 A1-c1dc8d.xlsx"
const EMPTY_SOURCE_NAME = "未载入 Excel"
const STORAGE_KEY = "dashboard.final-sample-report.source.v1"

export type ReportSourceKind = "embedded" | "uploaded" | "empty"

export interface PersistedReportSource {
  version: 1
  data: FinalSampleReportData
  sourceName: string
  sourceKind: ReportSourceKind
  syncedAt: string | null
}

interface ReportDataContextValue {
  data: FinalSampleReportData
  isLoading: boolean
  error: string | null
  sourceName: string
  sourceKind: ReportSourceKind
  syncedAt: string | null
  importWorkbook: (file: File) => Promise<void>
  resetToEmbeddedWorkbook: () => Promise<void>
  clearReportData: () => void
}

const ReportDataContext = createContext<ReportDataContextValue>({
  data: INITIAL_REPORT_DATA,
  isLoading: true,
  error: null,
  sourceName: EMBEDDED_SOURCE_NAME,
  sourceKind: "embedded",
  syncedAt: null,
  importWorkbook: async () => {},
  resetToEmbeddedWorkbook: async () => {},
  clearReportData: () => {},
})

async function parseWorkbookBuffer(buffer: ArrayBuffer): Promise<FinalSampleReportData> {
  const { read, utils } = await import("xlsx")
  const workbook = read(buffer, { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  })
  return parseFinalSampleReportMatrix(rows)
}

function isFinalSampleReportData(value: unknown): value is FinalSampleReportData {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<FinalSampleReportData>
  return Boolean(
    candidate.meta &&
      candidate.modules &&
      candidate.appendixTemperature &&
      candidate.appendixPhotometric &&
      candidate.appendixDimension,
  )
}

function readPersistedSource(): PersistedReportSource | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PersistedReportSource>
    if (
      parsed.version !== 1 ||
      typeof parsed.sourceName !== "string" ||
      (parsed.sourceKind !== "embedded" && parsed.sourceKind !== "uploaded" && parsed.sourceKind !== "empty") ||
      !isFinalSampleReportData(parsed.data)
    ) {
      return null
    }

    return {
      version: 1,
      data: parsed.data,
      sourceName: parsed.sourceName,
      sourceKind: parsed.sourceKind,
      syncedAt: typeof parsed.syncedAt === "string" ? parsed.syncedAt : null,
    }
  } catch {
    return null
  }
}

function persistSource(payload: PersistedReportSource) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function clearPersistedSource() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function FinalSampleReportDataProvider({
  children,
  initialSource,
  enableBrowserPersistence = true,
}: {
  children: ReactNode
  initialSource?: PersistedReportSource | null
  enableBrowserPersistence?: boolean
}) {
  const [data, setData] = useState(() => initialSource?.data ?? INITIAL_REPORT_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState(() => initialSource?.sourceName ?? EMBEDDED_SOURCE_NAME)
  const [sourceKind, setSourceKind] = useState<ReportSourceKind>(() => initialSource?.sourceKind ?? "embedded")
  const [syncedAt, setSyncedAt] = useState<string | null>(() => initialSource?.syncedAt ?? null)

  const applySource = (
    nextData: FinalSampleReportData,
    nextSourceName: string,
    nextSourceKind: ReportSourceKind,
    nextSyncedAt: string | null,
  ) => {
    setData(nextData)
    setSourceName(nextSourceName)
    setSourceKind(nextSourceKind)
    setSyncedAt(nextSyncedAt)
  }

  const loadEmbeddedWorkbook = async () => {
    const response = await fetch("/final-sample-report/A1-c1dc8d.xlsx")

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const parsed = await parseWorkbookBuffer(buffer)
    applySource(parsed, EMBEDDED_SOURCE_NAME, "embedded", null)
    if (enableBrowserPersistence) clearPersistedSource()
  }

  const importWorkbook = async (file: File) => {
    setIsLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = await parseWorkbookBuffer(buffer)
      const nextSyncedAt = new Date().toISOString()
      applySource(parsed, file.name, "uploaded", nextSyncedAt)
      if (enableBrowserPersistence) {
        persistSource({
          version: 1,
          data: parsed,
          sourceName: file.name,
          sourceKind: "uploaded",
          syncedAt: nextSyncedAt,
        })
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const resetToEmbeddedWorkbook = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await loadEmbeddedWorkbook()
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const clearReportData = () => {
    applySource(INITIAL_REPORT_DATA, EMPTY_SOURCE_NAME, "empty", null)
    if (enableBrowserPersistence) {
      persistSource({
        version: 1,
        data: INITIAL_REPORT_DATA,
        sourceName: EMPTY_SOURCE_NAME,
        sourceKind: "empty",
        syncedAt: null,
      })
    }
    setError(null)
    setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    async function loadDefaultWorkbook() {
      try {
        setIsLoading(true)
        setError(null)
        if (initialSource && isFinalSampleReportData(initialSource.data)) {
          if (!cancelled) {
            applySource(initialSource.data, initialSource.sourceName, initialSource.sourceKind, initialSource.syncedAt)
            if (enableBrowserPersistence) persistSource(initialSource)
          }
          return
        }

        const persisted = enableBrowserPersistence ? readPersistedSource() : null

        if (persisted) {
          if (!cancelled) {
            applySource(persisted.data, persisted.sourceName, persisted.sourceKind, persisted.syncedAt)
          }
          return
        }

        if (!cancelled) {
          await loadEmbeddedWorkbook()
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : String(loadError)
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDefaultWorkbook()

    return () => {
      cancelled = true
    }
  }, [enableBrowserPersistence, initialSource])

  const value = useMemo(
    () => ({
      data,
      isLoading,
      error,
      sourceName,
      sourceKind,
      syncedAt,
      importWorkbook,
      resetToEmbeddedWorkbook,
      clearReportData,
    }),
    [data, isLoading, error, sourceName, sourceKind, syncedAt],
  )

  return <ReportDataContext.Provider value={value}>{children}</ReportDataContext.Provider>
}

export function useReportData() {
  return useContext(ReportDataContext)
}
