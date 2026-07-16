import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import imageCompression from "browser-image-compression"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  RotateCcw,
  RotateCw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import { toast } from "sonner"

import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import { deleteAssetViaServer, uploadAssetViaServer } from "@/lib/ossUpload"
import type { LaboratoryModuleSummary } from "./laboratory-contract"

type ProductIllustrationSlot = {
  id: string
  label: string
  imageUrl?: string
}

type ProductIllustrationState = {
  slots: ProductIllustrationSlot[]
  groupNote: string
  recordedAt: string | null
}

type ProductIllustrationGalleryProps = {
  storageKey: string
  entityId: string
  nodeId?: number
  onSummaryChange?: (summary: LaboratoryModuleSummary | null) => void
}

const PRODUCT_ILLUSTRATION_SLOT_COUNT = 8
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 500 * 1024

function buildProductIllustrationSlots(): ProductIllustrationSlot[] {
  return Array.from({ length: PRODUCT_ILLUSTRATION_SLOT_COUNT }, (_, index) => ({
    id: `product-illustration-slot-${index + 1}`,
    label: "",
  }))
}

function normalizeSlotLabel(value: unknown): string {
  if (typeof value !== "string") return ""
  const label = value.trim()
  return /^产品图示\s*\d+\s*\/\s*IMAGE\s*\d+$/i.test(label) ? "" : label
}

function normalizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeRecordedAt(value: unknown): string | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeGalleryState(value: unknown): ProductIllustrationState {
  const baseSlots = buildProductIllustrationSlots()
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { slots: baseSlots, groupNote: "", recordedAt: null }
  }

  const record = value as Record<string, unknown>
  const inputSlots = Array.isArray(record.slots) ? record.slots : []
  const slots = baseSlots.map((slot, index) => {
    const inputSlot = inputSlots[index]
    const inputRecord =
      inputSlot && typeof inputSlot === "object" && !Array.isArray(inputSlot)
        ? (inputSlot as Record<string, unknown>)
        : {}
    return {
      ...slot,
      label: normalizeSlotLabel(inputRecord.label) || slot.label,
      imageUrl: normalizeImageUrl(inputRecord.imageUrl),
    }
  })

  return {
    slots,
    groupNote: typeof record.groupNote === "string" ? record.groupNote : "",
    recordedAt: normalizeRecordedAt(record.recordedAt),
  }
}

function readGalleryState(storageKey: string): ProductIllustrationState {
  if (typeof window === "undefined") {
    return { slots: buildProductIllustrationSlots(), groupNote: "", recordedAt: null }
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? normalizeGalleryState(JSON.parse(raw)) : normalizeGalleryState(null)
  } catch {
    return normalizeGalleryState(null)
  }
}

function writeGalleryState(storageKey: string, state: ProductIllustrationState): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Local persistence is best-effort; uploaded images remain in OSS.
  }
}

function formatRecordedAt(value: string | null): string {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  const pad = (num: number) => String(num).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function compactSlotsAfterDelete(slots: ProductIllustrationSlot[], deletedIndex: number): ProductIllustrationSlot[] {
  const nextSlots = slots.map((slot) => ({ ...slot }))
  for (let index = deletedIndex; index < nextSlots.length - 1; index += 1) {
    nextSlots[index] = {
      ...nextSlots[index],
      imageUrl: nextSlots[index + 1]?.imageUrl,
    }
  }
  nextSlots[nextSlots.length - 1] = {
    ...nextSlots[nextSlots.length - 1],
    imageUrl: undefined,
  }
  return nextSlots
}

async function compressProductImage(file: File): Promise<File> {
  if (file.size <= MAX_PRODUCT_IMAGE_SIZE_BYTES) return file

  const compressionSteps = [
    { maxWidthOrHeight: 1920, initialQuality: 0.82 },
    { maxWidthOrHeight: 1680, initialQuality: 0.74 },
    { maxWidthOrHeight: 1440, initialQuality: 0.66 },
    { maxWidthOrHeight: 1280, initialQuality: 0.58 },
    { maxWidthOrHeight: 1080, initialQuality: 0.5 },
    { maxWidthOrHeight: 920, initialQuality: 0.42 },
    { maxWidthOrHeight: 760, initialQuality: 0.34 },
    { maxWidthOrHeight: 640, initialQuality: 0.28 },
  ]
  let compressed = file

  for (const step of compressionSteps) {
    compressed = await imageCompression(compressed, {
      maxSizeMB: 0.47,
      maxWidthOrHeight: step.maxWidthOrHeight,
      useWebWorker: true,
      initialQuality: step.initialQuality,
      maxIteration: 20,
      fileType: "image/webp",
    })

    if (compressed.size <= MAX_PRODUCT_IMAGE_SIZE_BYTES) return compressed
  }

  throw new Error("图片压缩后仍超过 500KB，请更换一张更清晰或更小的图片")
}

function UploadSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 bg-slate-950/30 px-3 text-center transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/[0.04]"
    >
      <ImageIcon className="h-6 w-6 text-slate-600" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
        添加图片 / ADD IMAGE
      </span>
    </button>
  )
}

export function ProductIllustrationGallery({
  storageKey,
  entityId,
  nodeId,
  onSummaryChange,
}: ProductIllustrationGalleryProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropDepthRef = useRef(0)
  const stateRef = useRef<ProductIllustrationState>(normalizeGalleryState(null))
  const [galleryState, setGalleryState] = useState<ProductIllustrationState>(() => readGalleryState(storageKey))
  const [noteDraft, setNoteDraft] = useState(() => galleryState.groupNote)
  const [pendingUploadSlotId, setPendingUploadSlotId] = useState<string | null>(null)
  const [pendingDeleteSlotId, setPendingDeleteSlotId] = useState<string | null>(null)
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false)
  const [isDropActive, setIsDropActive] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [lightboxItemId, setLightboxItemId] = useState("")
  const [lightboxUrl, setLightboxUrl] = useState("")
  const [lightboxRotation, setLightboxRotation] = useState(0)

  const galleryItems = useMemo(
    () =>
      galleryState.slots
        .filter((slot): slot is ProductIllustrationSlot & { imageUrl: string } => Boolean(slot.imageUrl))
        .map((slot) => ({
          id: slot.id,
          label: slot.label,
          imageUrl: slot.imageUrl,
        })),
    [galleryState.slots],
  )
  const lightboxItemIndex = Math.max(
    0,
    galleryItems.findIndex((item) => item.id === lightboxItemId || item.imageUrl === lightboxUrl),
  )
  const hasSavedNote = galleryState.groupNote.trim().length > 0 && Boolean(galleryState.recordedAt)
  const imageCount = galleryItems.length

  const commitGalleryState = useCallback(
    (nextState: ProductIllustrationState) => {
      const normalizedState = normalizeGalleryState(nextState)
      stateRef.current = normalizedState
      setGalleryState(normalizedState)
      writeGalleryState(storageKey, normalizedState)
    },
    [storageKey],
  )

  useEffect(() => {
    const nextState = readGalleryState(storageKey)
    stateRef.current = nextState
    setGalleryState(nextState)
    setNoteDraft(nextState.groupNote)
    setPendingUploadSlotId(null)
    setPendingDeleteSlotId(null)
    setShowDeleteNoteConfirm(false)
    setLightboxItemId("")
    setLightboxUrl("")
    setLightboxRotation(0)
  }, [storageKey])

  useEffect(() => {
    stateRef.current = galleryState
  }, [galleryState])

  useEffect(() => {
    if (!onSummaryChange || typeof nodeId !== "number") return

    onSummaryChange({
      nodeId,
      type: "PRODUCT_ILLUSTRATION",
      label: "产品图示区",
      printTitle: "产品图示资料",
      category: "综合",
      status: "parsed",
      verdict: "PASS",
      sourceFiles: [],
      keyMetrics: [
        { label: "图片数量", value: `${imageCount}/8` },
        { label: "图示记录", value: hasSavedNote ? "已保存" : "未填写" },
      ],
      warnings: [],
      imageUrl: galleryItems[0]?.imageUrl,
    })
  }, [galleryItems, hasSavedNote, imageCount, nodeId, onSummaryChange])

  useEffect(() => {
    if (!isDropActive) return
    const handleWindowDrop = () => {
      dropDepthRef.current = 0
      setIsDropActive(false)
    }
    window.addEventListener("drop", handleWindowDrop)
    return () => window.removeEventListener("drop", handleWindowDrop)
  }, [isDropActive])

  const openLightbox = (slot: ProductIllustrationSlot & { imageUrl: string }) => {
    setLightboxItemId(slot.id)
    setLightboxUrl(slot.imageUrl)
    setLightboxRotation(0)
  }

  const closeLightbox = useCallback(() => {
    setLightboxItemId("")
    setLightboxUrl("")
    setLightboxRotation(0)
  }, [])

  const navigateLightbox = useCallback(
    (direction: -1 | 1) => {
      if (galleryItems.length === 0) return
      const currentIndex = Math.max(
        0,
        galleryItems.findIndex((item) => item.id === lightboxItemId || item.imageUrl === lightboxUrl),
      )
      const nextIndex = currentIndex + direction
      if (nextIndex < 0 || nextIndex >= galleryItems.length) return
      const nextItem = galleryItems[nextIndex]
      setLightboxItemId(nextItem.id)
      setLightboxUrl(nextItem.imageUrl)
      setLightboxRotation(0)
    },
    [galleryItems, lightboxItemId, lightboxUrl],
  )

  useEffect(() => {
    if (!lightboxUrl) return

    const hasCurrentItem = galleryItems.some((item) => item.id === lightboxItemId || item.imageUrl === lightboxUrl)
    if (hasCurrentItem) return

    const nextItem = galleryItems[0]
    if (!nextItem) {
      closeLightbox()
      return
    }

    setLightboxItemId(nextItem.id)
    setLightboxUrl(nextItem.imageUrl)
    setLightboxRotation(0)
  }, [closeLightbox, galleryItems, lightboxItemId, lightboxUrl])

  useEffect(() => {
    if (!lightboxUrl) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeLightbox()
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        navigateLightbox(-1)
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        navigateLightbox(1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeLightbox, lightboxUrl, navigateLightbox])

  const uploadImageToSlot = async (slotId: string, file?: File, options?: { showToast?: boolean }): Promise<boolean> => {
    if (!file) return false
    if (!file.type.startsWith("image/")) return false

    try {
      const processedFile = await compressProductImage(file)
      const previousUrl = stateRef.current.slots.find((slot) => slot.id === slotId)?.imageUrl
      const uploadResult = await uploadAssetViaServer({
        file: processedFile,
        category: "laboratory-product-illustration",
        entityId,
        slot: slotId,
      })

      const nextState = {
        ...stateRef.current,
        slots: stateRef.current.slots.map((slot) =>
          slot.id === slotId ? { ...slot, imageUrl: uploadResult.url } : slot,
        ),
      }
      commitGalleryState(nextState)

      if (previousUrl && previousUrl !== uploadResult.url) {
        void deleteAssetViaServer(previousUrl).catch(() => undefined)
      }

      if (options?.showToast !== false) {
        toast.success("图片已保存", {
          description: "产品图示已上传至 OSS。",
          position: "bottom-right",
        })
      }
      return true
    } catch (error) {
      if (options?.showToast !== false) {
        toast.error("图片上传失败", {
          description: error instanceof Error ? error.message : "请稍后重试。",
          position: "bottom-right",
        })
      }
      return false
    }
  }

  const handleFilesUpload = async (files: File[] | FileList, startSlotId?: string) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"))
    if (imageFiles.length === 0) {
      window.alert("请拖拽或选择图片文件")
      return
    }

    const slots = stateRef.current.slots
    const startIndex = startSlotId
      ? Math.max(0, slots.findIndex((slot) => slot.id === startSlotId))
      : Math.max(0, slots.findIndex((slot) => !slot.imageUrl))
    const targetSlots = slots.slice(startIndex).filter((slot) => !slot.imageUrl)
    if (targetSlots.length === 0) {
      toast.warning("产品图示区已满", {
        description: "没有可用空位，请先删除一张图片。",
        position: "bottom-right",
      })
      return
    }

    setIsUploading(true)
    const uploadPairs = imageFiles.slice(0, targetSlots.length).map((file, index) => ({
      file,
      slotId: targetSlots[index].id,
    }))
    const skippedCount = imageFiles.length - uploadPairs.length
    let successCount = 0
    let failCount = 0

    for (const pair of uploadPairs) {
      const ok = await uploadImageToSlot(pair.slotId, pair.file, { showToast: false })
      if (ok) successCount += 1
      else failCount += 1
    }

    setIsUploading(false)
    if (successCount > 0) {
      toast.success(`${successCount} 张产品图示已上传`, {
        description: skippedCount > 0 ? `剩余 ${skippedCount} 张已超过八宫格空位。` : "批量上传完成。",
        position: "bottom-right",
      })
    }
    if (failCount > 0) {
      toast.error("部分图片上传失败", {
        description: `成功 ${successCount} 张，失败 ${failCount} 张。`,
        position: "bottom-right",
      })
    }
  }

  const handleDeleteImage = async (slotId: string) => {
    const slots = stateRef.current.slots
    const deletedIndex = slots.findIndex((slot) => slot.id === slotId)
    if (deletedIndex < 0) return
    const deletedUrl = slots[deletedIndex]?.imageUrl
    const nextSlots = compactSlotsAfterDelete(slots, deletedIndex)
    commitGalleryState({
      ...stateRef.current,
      slots: nextSlots,
    })

    if (deletedUrl) {
      await deleteAssetViaServer(deletedUrl).catch(() => undefined)
    }

    if (lightboxUrl === deletedUrl) {
      const replacementUrl = nextSlots[deletedIndex]?.imageUrl
      if (replacementUrl) {
        setLightboxItemId(nextSlots[deletedIndex].id)
        setLightboxUrl(replacementUrl)
        setLightboxRotation(0)
      } else {
        closeLightbox()
      }
    }

    toast.success("图片已删除", {
      description: "产品图示已移除。",
      position: "bottom-right",
    })
  }

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dropDepthRef.current += 1
    setIsDropActive(true)
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "copy"
  }

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dropDepthRef.current = Math.max(0, dropDepthRef.current - 1)
    if (dropDepthRef.current === 0) setIsDropActive(false)
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dropDepthRef.current = 0
    setIsDropActive(false)
    void handleFilesUpload(event.dataTransfer.files, pendingUploadSlotId || undefined)
    setPendingUploadSlotId(null)
  }

  const handleSaveNote = () => {
    const normalizedNote = noteDraft.trim()
    if (!normalizedNote) {
      window.alert("请输入产品图示记录内容")
      return
    }

    commitGalleryState({
      ...stateRef.current,
      groupNote: normalizedNote,
      recordedAt: new Date().toISOString(),
    })
    setNoteDraft(normalizedNote)
    toast.success(hasSavedNote ? "记录已更新" : "记录已保存", {
      description: hasSavedNote ? "产品图示记录修改成功。" : "产品图示记录新增成功。",
      position: "bottom-right",
    })
  }

  const handleDeleteNote = () => {
    commitGalleryState({
      ...stateRef.current,
      groupNote: "",
      recordedAt: null,
    })
    setNoteDraft("")
    setShowDeleteNoteConfirm(false)
    toast.success("记录已删除", {
      description: "产品图示记录已清空。",
      position: "bottom-right",
    })
  }

  return (
    <section
      className={`relative rounded-2xl border border-slate-800 bg-[#060914]/85 p-5 shadow-[0_0_0_1px_rgba(56,189,248,0.05)] transition-colors ${
        isDropActive ? "border-cyan-400/55 bg-[#08111d]" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDropActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-cyan-400/45 bg-slate-950/75">
          <div className="rounded-2xl border border-cyan-400/30 bg-slate-950/90 px-5 py-3 text-sm font-semibold tracking-wide text-cyan-100 shadow-lg">
            松开即可批量上传图片，最多自动填充 8 张
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-cyan-700/45 bg-cyan-950/20 p-3">
          <Camera className="h-4 w-4 text-cyan-300" />
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
            产品图示区 / PRODUCT IMAGE GALLERY
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            支持拖拽多张图片到这里，或点击空位多选上传，最多补满 8 张。
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {galleryState.slots.map((slot) => (
          <div key={slot.id} className="flex flex-col">
            <div className="group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 transition-all">
              <div
                onClick={() => {
                  if (slot.imageUrl) openLightbox({ ...slot, imageUrl: slot.imageUrl })
                }}
                className={`relative flex aspect-square items-center justify-center p-3 ${slot.imageUrl ? "cursor-pointer" : ""}`}
              >
                {slot.imageUrl ? (
                  <img
                    src={slot.imageUrl}
                    alt={slot.label}
                    className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-lg object-cover"
                  />
                ) : (
                  <UploadSlot
                    onClick={() => {
                      setPendingUploadSlotId(slot.id)
                      inputRef.current?.click()
                    }}
                  />
                )}
              </div>

              <div className="border-t border-slate-800 bg-slate-900/70 p-1">
                <div className="flex flex-nowrap items-center gap-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingUploadSlotId(slot.id)
                      inputRef.current?.click()
                    }}
                    disabled={isUploading}
                    className="group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-slate-500 group-hover/btn:text-cyan-400" />
                    <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover/btn:text-cyan-100">
                      上传
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteSlotId(slot.id)}
                    disabled={!slot.imageUrl}
                    className={`group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                      slot.imageUrl ? "hover:bg-rose-950" : "cursor-not-allowed opacity-45"
                    }`}
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${slot.imageUrl ? "text-slate-500 group-hover/btn:text-rose-400" : "text-slate-600"}`} />
                    <span className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-widest ${slot.imageUrl ? "text-slate-400 group-hover/btn:text-rose-100" : "text-slate-600"}`}>
                      删除
                    </span>
                  </button>
                </div>
              </div>
              <div className="border-t border-rose-500/20 bg-rose-950/10 px-2 py-2">
                <label htmlFor={`${slot.id}-label`} className="sr-only">图片说明</label>
                <input
                  id={`${slot.id}-label`}
                  type="text"
                  value={slot.label}
                  onChange={(event) => {
                    const nextSlots = galleryState.slots.map((currentSlot) =>
                      currentSlot.id === slot.id ? { ...currentSlot, label: event.target.value } : currentSlot,
                    )
                    commitGalleryState({ ...galleryState, slots: nextSlots })
                  }}
                  placeholder="输入图片说明"
                  className="h-8 w-full rounded-md border border-rose-400/30 bg-black/25 px-2 text-center text-xs font-bold text-rose-400 outline-none placeholder:text-rose-400/45 focus:border-rose-300 focus:ring-1 focus:ring-rose-300/30"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <label
          htmlFor="product-illustration-group-note"
          className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
        >
          图示总记录 / GROUP NOTE
        </label>
        <textarea
          id="product-illustration-group-note"
          className="mt-2 h-24 w-full resize-y rounded-xl border border-cyan-900/40 bg-slate-950/80 px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/70"
          placeholder="在这里记录产品图示说明、样品位置、外观特征或关键观察信息。"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
        />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveNote}
              className="rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-900/50 hover:text-cyan-100"
            >
              保存记录 / SAVE
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteNoteConfirm(true)}
              disabled={!hasSavedNote && !noteDraft}
              className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                hasSavedNote || noteDraft
                  ? "border-rose-700/50 bg-rose-950/35 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100"
                  : "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-600"
              }`}
            >
              删除记录 / DELETE
            </button>
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            记录时间 / RECORDED AT: {formatRecordedAt(galleryState.recordedAt)}
          </span>
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        ref={inputRef}
        onChange={(event) => {
          void handleFilesUpload(event.target.files || [], pendingUploadSlotId || undefined)
          event.target.value = ""
          setPendingUploadSlotId(null)
        }}
      />

      <CyberConfirmDialog
        open={!!pendingDeleteSlotId}
        title="删除图片确认"
        message="确定要删除当前图片吗？删除后该图片将被移除，此操作不可撤销。"
        onCancel={() => setPendingDeleteSlotId(null)}
        onConfirm={() => {
          if (pendingDeleteSlotId) {
            void handleDeleteImage(pendingDeleteSlotId)
            setPendingDeleteSlotId(null)
          }
        }}
        confirmText="确认删除"
        cancelText="取消"
      />
      <CyberConfirmDialog
        open={showDeleteNoteConfirm}
        title="删除记录确认"
        message="确定要删除当前图示总记录吗？删除后内容和记录时间都会清空，此操作不可撤销。"
        onCancel={() => setShowDeleteNoteConfirm(false)}
        onConfirm={handleDeleteNote}
        confirmText="确认删除"
        cancelText="取消"
      />

      {lightboxUrl ? (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md"
        >
          {galleryItems.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigateLightbox(-1)
                }}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/90 p-3 text-slate-200 shadow-xl transition-colors hover:border-cyan-400 hover:text-cyan-200"
                aria-label="上一张"
                title="上一张"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigateLightbox(1)
                }}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/90 p-3 text-slate-200 shadow-xl transition-colors hover:border-cyan-400 hover:text-cyan-200"
                aria-label="下一张"
                title="下一张"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          <div className="flex max-w-[90vw] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-[85vh] w-[90vw] items-center justify-center overflow-hidden">
              <img
                src={lightboxUrl}
                alt="产品图示预览"
                className={`rounded-2xl border border-slate-700 object-contain shadow-2xl transition-transform duration-200 ${
                  Math.abs(lightboxRotation % 180) === 90 ? "max-h-[90vw] max-w-[85vh]" : "max-h-full max-w-full"
                }`}
                style={{ transform: `rotate(${lightboxRotation}deg)` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-center gap-3">
              <div className="min-w-20 rounded-full border border-slate-700 bg-slate-800/90 px-3 py-2 text-center text-xs font-mono text-slate-400">
                {galleryItems.length > 0 ? `${lightboxItemIndex + 1}/${galleryItems.length}` : "0/0"}
              </div>
              <button
                type="button"
                onClick={() => setLightboxRotation((current) => current - 90)}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="向左旋转"
                title="向左旋转"
              >
                <RotateCcw className="h-5 w-5 text-slate-300" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation((current) => current + 90)}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="向右旋转"
                title="向右旋转"
              >
                <RotateCw className="h-5 w-5 text-slate-300" />
              </button>
              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="关闭预览"
                title="关闭预览"
              >
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
