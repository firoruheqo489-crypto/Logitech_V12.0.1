import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  BrainCircuit,
  ClipboardCheck,
  CloudUpload,
  Crosshair,
  Eye,
  EyeOff,
  FileText,
  FilterX,
  History,
  ImageIcon,
  Inbox,
  Layers,
  Loader2,
  Maximize2,
  NotebookPen,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type RootCause =
  | "wrong-model"
  | "boundary-confusion"
  | "calculation-error"
  | "concept-blindspot"
  | "";

interface AuditRecord {
  id: string;
  imageUrl: string | null;
  imageName: string | null;
  textParam: string;
  category: string;
  myLogic: string;
  correctAnswer: string;
  rootCause: RootCause;
  action: string;
  timestamp: number;
}

type DraftRecord = AuditRecord;
type EditingSource = "record" | "draft" | null;

interface EditableState {
  imageUrl: string | null;
  imageName: string | null;
  textParam: string;
  category: string;
  myLogic: string;
  correctAnswer: string;
  rootCause: RootCause;
  action: string;
}

interface PersistedWorkspaceState extends EditableState {
  editingId: string | null;
  editingSource: EditingSource;
  baselineSignature: string;
}

interface CategoryOption {
  value: string;
  label: string;
  tier: "基础篇" | "分析篇" | "应用篇";
}

const CATEGORIES: CategoryOption[] = [
  { value: "reliability-basics", label: "可靠性基础与常用指标", tier: "基础篇" },
  { value: "distribution-statistics", label: "概率统计、寿命分布与参数估计", tier: "基础篇" },
  { value: "system-modeling", label: "系统可靠性建模与预计", tier: "分析篇" },
  { value: "fmea-fta", label: "FMEA / FTA 与故障分析", tier: "分析篇" },
  { value: "testing-evaluation", label: "可靠性试验、加速试验与评定", tier: "分析篇" },
  { value: "maintainability-support", label: "维修性、测试性与保障性", tier: "应用篇" },
  { value: "reliability-management", label: "可靠性管理、FRACAS 与工程应用", tier: "应用篇" },
];

const ROOT_CAUSES: { value: Exclude<RootCause, "">; label: string; code: string }[] = [
  { value: "wrong-model", label: "模型错配", code: "WRONG MODEL" },
  { value: "boundary-confusion", label: "边界混淆", code: "BOUNDARY CONFUSION" },
  { value: "calculation-error", label: "计算失误", code: "CALCULATION ERROR" },
  { value: "concept-blindspot", label: "概念盲区", code: "CONCEPT BLINDSPOT" },
];

const TIER_STYLES: Record<CategoryOption["tier"], string> = {
  基础篇: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
  分析篇: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  应用篇: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
};

const EMPTY_FORM = {
  textParam: "",
  category: "",
  myLogic: "",
  correctAnswer: "",
  rootCause: "" as RootCause,
  action: "",
};

const EMPTY_EDITABLE_STATE: EditableState = {
  imageUrl: null,
  imageName: null,
  textParam: "",
  category: "",
  myLogic: "",
  correctAnswer: "",
  rootCause: "",
  action: "",
};

const CAQ_STORAGE_PREFIX = "caq-audit";
const CAQ_UNSAVED_FLAG_KEY = `${CAQ_STORAGE_PREFIX}:unsaved`;

function categoryMeta(value: string): CategoryOption | undefined {
  return CATEGORIES.find((item) => item.value === value);
}

function rootCauseMeta(value: RootCause) {
  return ROOT_CAUSES.find((item) => item.value === value);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildStorageScope(projectName?: string): string {
  const normalized = (projectName || "").trim().toLowerCase().replace(/\s+/g, "-");
  return normalized || "default";
}

function buildStorageKey(scope: string, segment: "records" | "drafts" | "workspace"): string {
  return `${CAQ_STORAGE_PREFIX}:${scope}:${segment}`;
}

function serializeEditableState(state: EditableState): string {
  return JSON.stringify(state);
}

function isRootCause(value: unknown): value is RootCause {
  return value === "" || value === "wrong-model" || value === "boundary-confusion" || value === "calculation-error" || value === "concept-blindspot";
}

function normalizeRecord(input: unknown): AuditRecord | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<AuditRecord>;
  if (typeof candidate.id !== "string" || typeof candidate.timestamp !== "number" || !Number.isFinite(candidate.timestamp)) {
    return null;
  }

  return {
    id: candidate.id,
    imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : null,
    imageName: typeof candidate.imageName === "string" ? candidate.imageName : null,
    textParam: typeof candidate.textParam === "string" ? candidate.textParam : "",
    category: typeof candidate.category === "string" ? candidate.category : "",
    myLogic: typeof candidate.myLogic === "string" ? candidate.myLogic : "",
    correctAnswer: typeof candidate.correctAnswer === "string" ? candidate.correctAnswer : "",
    rootCause: isRootCause(candidate.rootCause) ? candidate.rootCause : "",
    action: typeof candidate.action === "string" ? candidate.action : "",
    timestamp: candidate.timestamp,
  };
}

function normalizeRecords(input: unknown): AuditRecord[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeRecord(item))
    .filter((item): item is AuditRecord => item !== null);
}

function normalizeWorkspaceState(input: unknown): PersistedWorkspaceState | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<PersistedWorkspaceState>;

  return {
    imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : null,
    imageName: typeof candidate.imageName === "string" ? candidate.imageName : null,
    textParam: typeof candidate.textParam === "string" ? candidate.textParam : "",
    category: typeof candidate.category === "string" ? candidate.category : "",
    myLogic: typeof candidate.myLogic === "string" ? candidate.myLogic : "",
    correctAnswer: typeof candidate.correctAnswer === "string" ? candidate.correctAnswer : "",
    rootCause: isRootCause(candidate.rootCause) ? candidate.rootCause : "",
    action: typeof candidate.action === "string" ? candidate.action : "",
    editingId: typeof candidate.editingId === "string" ? candidate.editingId : null,
    editingSource:
      candidate.editingSource === "record" || candidate.editingSource === "draft" ? candidate.editingSource : null,
    baselineSignature: typeof candidate.baselineSignature === "string" ? candidate.baselineSignature : serializeEditableState(EMPTY_EDITABLE_STATE),
  };
}

export default function CaqAuditWorkspace({ projectName }: { projectName?: string }) {
  const storageScope = useMemo(() => buildStorageScope(projectName), [projectName]);
  const storageKeys = useMemo(
    () => ({
      records: buildStorageKey(storageScope, "records"),
      drafts: buildStorageKey(storageScope, "drafts"),
      workspace: buildStorageKey(storageScope, "workspace"),
    }),
    [storageScope],
  );
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [textParam, setTextParam] = useState("");
  const [category, setCategory] = useState("");
  const [myLogic, setMyLogic] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [rootCause, setRootCause] = useState<RootCause>("");
  const [action, setAction] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<EditingSource>(null);
  const [baselineSignature, setBaselineSignature] = useState(() => serializeEditableState(EMPTY_EDITABLE_STATE));
  const [isDragging, setIsDragging] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const storageWarningShownRef = useRef(false);

  const editableState = useMemo<EditableState>(
    () => ({
      imageUrl,
      imageName,
      textParam,
      category,
      myLogic,
      correctAnswer,
      rootCause,
      action,
    }),
    [action, category, correctAnswer, imageName, imageUrl, myLogic, rootCause, textParam],
  );

  const currentSignature = useMemo(() => serializeEditableState(editableState), [editableState]);
  const hasWorkspaceContent = useMemo(
    () =>
      Boolean(
        imageUrl ||
          textParam.trim() ||
          category ||
          myLogic.trim() ||
          correctAnswer.trim() ||
          rootCause ||
          action.trim(),
      ),
    [action, category, correctAnswer, imageUrl, myLogic, rootCause, textParam],
  );
  const isDirty = currentSignature !== baselineSignature;

  const setEditableState = useCallback((state: EditableState) => {
    setImageUrl(state.imageUrl);
    setImageName(state.imageName);
    setTextParam(state.textParam);
    setCategory(state.category);
    setMyLogic(state.myLogic);
    setCorrectAnswer(state.correctAnswer);
    setRootCause(state.rootCause);
    setAction(state.action);
  }, []);

  useEffect(() => {
    setStorageReady(false);
    try {
      const rawRecords = typeof window !== "undefined" ? window.localStorage.getItem(storageKeys.records) : null;
      const rawDrafts = typeof window !== "undefined" ? window.localStorage.getItem(storageKeys.drafts) : null;
      const rawWorkspace = typeof window !== "undefined" ? window.localStorage.getItem(storageKeys.workspace) : null;

      setRecords(normalizeRecords(rawRecords ? JSON.parse(rawRecords) : []));
      setDrafts(normalizeRecords(rawDrafts ? JSON.parse(rawDrafts) : []));

      const workspace = normalizeWorkspaceState(rawWorkspace ? JSON.parse(rawWorkspace) : null);
      if (workspace) {
        setEditableState(workspace);
        setEditingId(workspace.editingId);
        setEditingSource(workspace.editingSource);
        setBaselineSignature(workspace.baselineSignature);
      } else {
        setEditableState(EMPTY_EDITABLE_STATE);
        setEditingId(null);
        setEditingSource(null);
        setBaselineSignature(serializeEditableState(EMPTY_EDITABLE_STATE));
      }
    } catch (error) {
      console.warn("Failed to restore CAQ local state:", error);
      setRecords([]);
      setDrafts([]);
      setEditableState(EMPTY_EDITABLE_STATE);
      setEditingId(null);
      setEditingSource(null);
      setBaselineSignature(serializeEditableState(EMPTY_EDITABLE_STATE));
    } finally {
      setStorageReady(true);
    }
  }, [setEditableState, storageKeys]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(storageKeys.records, JSON.stringify(records));
      window.localStorage.setItem(storageKeys.drafts, JSON.stringify(drafts));

      if (hasWorkspaceContent || editingSource) {
        const workspaceState: PersistedWorkspaceState = {
          ...editableState,
          editingId,
          editingSource,
          baselineSignature,
        };
        window.localStorage.setItem(storageKeys.workspace, JSON.stringify(workspaceState));
      } else {
        window.localStorage.removeItem(storageKeys.workspace);
      }
    } catch (error) {
      console.warn("Failed to persist CAQ local state:", error);
      if (!storageWarningShownRef.current) {
        storageWarningShownRef.current = true;
        toast.error("本地暂存空间不足，部分 CAQ 图片草稿可能无法持久保存");
      }
    }
  }, [
    baselineSignature,
    drafts,
    editableState,
    editingId,
    editingSource,
    hasWorkspaceContent,
    records,
    storageKeys,
    storageReady,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(CAQ_UNSAVED_FLAG_KEY, isDirty && hasWorkspaceContent ? "1" : "0");
  }, [hasWorkspaceContent, isDirty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || !hasWorkspaceContent) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasWorkspaceContent, isDirty]);

  const processFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("仅接受图片格式", { description: "请上传考题截图 / 故障树 / 公式图纸" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setImageUrl(result);
      setImageName(file.name);
    };
    reader.onerror = () => {
      toast.error("图片读取失败", { description: "请重试，或更换截图后再次上传" });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setImageUrl(null);
    setImageName(null);
    setIsImagePreviewOpen(false);
  }, []);

  const resetWorkspace = useCallback(() => {
    clearImage();
    setTextParam(EMPTY_FORM.textParam);
    setCategory(EMPTY_FORM.category);
    setMyLogic(EMPTY_FORM.myLogic);
    setCorrectAnswer(EMPTY_FORM.correctAnswer);
    setRootCause(EMPTY_FORM.rootCause);
    setAction(EMPTY_FORM.action);
    setShowAnswer(false);
    setEditingId(null);
    setEditingSource(null);
    setBaselineSignature(serializeEditableState(EMPTY_EDITABLE_STATE));
  }, [clearImage]);

  const confirmDiscardChanges = useCallback(
    (message?: string) => {
      if (!isDirty || !hasWorkspaceContent || typeof window === "undefined") {
        return true;
      }
      return window.confirm(message ?? "当前内容还没有保存，是否确认离开并放弃本次编辑？");
    },
    [hasWorkspaceContent, isDirty],
  );

  const saveRecord = useCallback(async () => {
    if (!category) {
      toast.warning("知识战区未锁定", { description: "请先选择本题归属的战区分类" });
      return;
    }
    if (!rootCause) {
      toast.warning("错误根因未锁定", { description: "请归类本次失误的核心症结" });
      return;
    }

    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const nextRecord: AuditRecord = {
      id:
        editingSource === "record" || editingSource === "draft"
          ? (editingId ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now())))
          : (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      imageUrl,
      imageName,
      textParam,
      category,
      myLogic,
      correctAnswer,
      rootCause,
      action,
      timestamp: Date.now(),
    };

    setRecords((previous) => {
      const exists = previous.some((record) => record.id === nextRecord.id);
      if (exists) {
        return previous.map((record) => (record.id === nextRecord.id ? nextRecord : record));
      }
      return [nextRecord, ...previous];
    });
    if (editingSource === "draft" && editingId) {
      setDrafts((previous) => previous.filter((draft) => draft.id !== editingId));
    }

    setIsSyncing(false);
    resetWorkspace();
    toast.success("审计切片已归档", {
      description:
        editingSource === "draft"
          ? "草稿已转为正式归档记录"
          : editingId
            ? "二次复盘内容已覆盖更新"
            : "当前 CAQ 记录已写入本地工作区",
    });
  }, [
    action,
    category,
    correctAnswer,
    editingId,
    editingSource,
    imageName,
    imageUrl,
    myLogic,
    resetWorkspace,
    rootCause,
    textParam,
  ]);

  const saveDraft = useCallback(() => {
    if (!hasWorkspaceContent) {
      toast.warning("当前工作区没有可暂存内容");
      return;
    }

    const nextDraft: DraftRecord = {
      id:
        editingSource === "draft"
          ? (editingId ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now())))
          : (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
      imageUrl,
      imageName,
      textParam,
      category,
      myLogic,
      correctAnswer,
      rootCause,
      action,
      timestamp: Date.now(),
    };

    setDrafts((previous) => {
      const exists = previous.some((draft) => draft.id === nextDraft.id);
      if (exists) {
        return previous.map((draft) => (draft.id === nextDraft.id ? nextDraft : draft));
      }
      return [nextDraft, ...previous];
    });

    toast.success("已丢进草稿箱", {
      description: "当前题目已暂存，工作区已释放给下一道题。",
    });
    resetWorkspace();
  }, [
    action,
    category,
    correctAnswer,
    editingId,
    editingSource,
    hasWorkspaceContent,
    imageName,
    imageUrl,
    myLogic,
    resetWorkspace,
    rootCause,
    textParam,
  ]);

  const loadRecord = useCallback(
    (record: AuditRecord) => {
      if (!confirmDiscardChanges("当前工作区还有未保存内容，确认切换到这条归档记录吗？")) {
        return;
      }
      setEditableState(record);
      setShowAnswer(false);
      setEditingId(record.id);
      setEditingSource("record");
      setBaselineSignature(serializeEditableState(record));
      setHistoryOpen(false);
      toast.info("切片已载入工作台", { description: "保存后会覆盖原有归档记录" });
    },
    [confirmDiscardChanges, setEditableState],
  );

  const loadDraft = useCallback(
    (draft: DraftRecord) => {
      if (!confirmDiscardChanges("当前工作区还有未保存内容，确认切换到这条草稿继续编辑吗？")) {
        return;
      }
      setEditableState(draft);
      setShowAnswer(false);
      setEditingId(draft.id);
      setEditingSource("draft");
      setBaselineSignature(serializeEditableState(draft));
      setDraftsOpen(false);
      toast.info("草稿已载入工作台", { description: "可继续补充，归档后会自动从草稿箱移除。" });
    },
    [confirmDiscardChanges, setEditableState],
  );

  const deleteRecord = useCallback(
    (id: string) => {
      setRecords((previous) => previous.filter((record) => record.id !== id));
      if (editingId === id) {
        setEditingId(null);
      }
      toast.success("切片已删除");
    },
    [editingId],
  );

  const deleteDraft = useCallback(
    (id: string) => {
      setDrafts((previous) => previous.filter((draft) => draft.id !== id));
      if (editingSource === "draft" && editingId === id) {
        resetWorkspace();
      }
      toast.success("草稿已删除");
    },
    [editingId, editingSource, resetWorkspace],
  );

  const handleResetWorkspace = useCallback(() => {
    if (!confirmDiscardChanges("当前工作区还有未保存内容，确认清空并开始下一道题吗？")) {
      return;
    }
    resetWorkspace();
  }, [confirmDiscardChanges, resetWorkspace]);

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_30px_120px_rgba(2,6,23,0.55)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
            <ClipboardCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-white">CAQ 错题审计台</h2>
            <p className="text-sm text-slate-400">面向《可靠性工程师（第2版）》题库复盘的独立工作区</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Sheet open={draftsOpen} onOpenChange={setDraftsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15">
                <NotebookPen className="size-4" />
                草稿箱
                <span className="rounded bg-amber-300/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-100">
                  {drafts.length}
                </span>
              </Button>
            </SheetTrigger>
            <DraftDrawer drafts={drafts} onLoad={loadDraft} onDelete={deleteDraft} />
          </Sheet>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 md:flex">
            <span className="inline-block size-2 rounded-full bg-cyan-300" aria-hidden="true" />
            已归档切片
            <span className="font-mono font-semibold text-white">{records.length}</span>
          </div>

          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                <History className="size-4" />
                已归档切片
                <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-200">
                  {records.length}
                </span>
              </Button>
            </SheetTrigger>
            <HistoryDrawer records={records} onLoad={loadRecord} onDelete={deleteRecord} />
          </Sheet>
        </div>
      </header>

      {editingId && (
        <div className="flex items-center gap-2 border-b border-cyan-400/20 bg-cyan-400/8 px-5 py-2 text-xs text-cyan-200 md:px-6">
          <RotateCcw className="size-3.5" />
          {editingSource === "draft" ? "草稿续写模式，可继续补充后归档或再次暂存" : "二次复盘模式，保存后将覆盖原归档记录"}
        </div>
      )}

      <div className="flex min-h-[68vh] flex-col lg:flex-row">
        <section className="flex w-full flex-col border-b border-white/10 lg:w-2/5 lg:border-r lg:border-b-0">
          <PanelHeader index="01" title="客观事实区" subtitle="QUESTION BOX" icon={<ImageIcon className="size-4" />} />
          <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
            {imageUrl ? (
              <div className="flex min-h-[360px] flex-1 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 truncate text-xs text-slate-400">
                    <CloudUpload className="size-3.5 shrink-0 text-cyan-300" />
                    <span className="truncate">{imageName ?? "当前图像"}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsImagePreviewOpen(true)}
                      className="border-cyan-400/30 bg-transparent text-cyan-100 hover:bg-cyan-400/10 hover:text-cyan-50"
                    >
                      <Maximize2 className="size-3.5" />
                      放大查看
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearImage}
                      className="border-rose-400/30 bg-transparent text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                    >
                      <Trash2 className="size-3.5" />
                      清除图片
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3">
                  <button
                    type="button"
                    onClick={() => setIsImagePreviewOpen(true)}
                    className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl"
                  >
                    <img
                      src={imageUrl}
                      alt="考题截图预览"
                      className="max-h-full max-w-full rounded-xl object-contain transition duration-200 group-hover:scale-[1.01]"
                    />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-[11px] text-slate-200 opacity-90 shadow-lg">
                      <Maximize2 className="size-3.5" />
                      点击放大
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  processFile(event.dataTransfer.files?.[0]);
                }}
                className={`flex min-h-[360px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  isDragging
                    ? "border-cyan-300 bg-cyan-400/10"
                    : "border-white/12 bg-white/[0.03] hover:border-cyan-300/60 hover:bg-white/[0.05]"
                }`}
              >
                <UploadCloud className={`size-11 ${isDragging ? "text-cyan-200" : "text-slate-500"}`} />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">拖拽考题截图到这里</p>
                  <p className="text-xs text-slate-400">或点击选取本地文件，用于还原原题、故障树或公式图纸</p>
                </div>
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                processFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                <FileText className="size-3.5" />
                题干补充 · 关键参数
              </label>
              <Textarea
                value={textParam}
                onChange={(event) => setTextParam(event.target.value)}
                placeholder="粘贴关键文字参数，例如：λ=0.001 /h，t=1000 h，要求计算系统可靠度 R(t)..."
                className="min-h-28 resize-none rounded-2xl border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="flex w-full flex-col lg:w-3/5">
          <PanelHeader index="02" title="逻辑审计区" subtitle="AUDIT BOX" icon={<BrainCircuit className="size-4" />} />
          <div className="flex flex-1 flex-col gap-5 p-5 md:p-6">
            <FieldBlock
              icon={<Layers className="size-3.5" />}
              label="教材章节归属 · CATEGORY"
              hint="必填项：按《可靠性工程师（第2版）》的知识结构归类，便于后续按章节复盘。"
            >
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 w-full rounded-2xl border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="选择教材章节 / 专题" />
                </SelectTrigger>
                <SelectContent>
                  {(["基础篇", "分析篇", "应用篇"] as const).map((tier) => (
                    <SelectGroup key={tier}>
                      <SelectLabel>[{tier}]</SelectLabel>
                      {CATEGORIES.filter((item) => item.tier === tier).map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>

            <FieldBlock
              icon={<BrainCircuit className="size-3.5" />}
              label="我的推演 · MY LOGIC"
              hint="完整记录当时的解题思路、所用模型、公式和推导路径。"
            >
              <Textarea
                value={myLogic}
                onChange={(event) => setMyLogic(event.target.value)}
                placeholder="还原思考路径：选用了哪个可靠性模型？如何代入参数？在哪一步开始产生分歧？"
                className="min-h-36 resize-none rounded-2xl border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500"
              />
            </FieldBlock>

            <FieldBlock
              icon={<ShieldCheck className="size-3.5" />}
              label="标准协议 · CORRECT ANSWER"
              hint="默认隐藏底牌，完成独立推演后再展开核对。"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnswer((current) => !current)}
                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                >
                  {showAnswer ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {showAnswer ? "隐藏底牌" : "展示底牌"}
                </Button>
              }
            >
              <div className="relative">
                <Textarea
                  value={correctAnswer}
                  onChange={(event) => setCorrectAnswer(event.target.value)}
                  placeholder="录入标准解题协议与正确结论..."
                  className={`min-h-28 resize-none rounded-2xl border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 transition-all ${
                    showAnswer ? "" : "blur-sm select-none"
                  }`}
                  tabIndex={showAnswer ? 0 : -1}
                />
                {!showAnswer && (
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
                    className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-slate-950/35 text-xs text-slate-300"
                  >
                    <EyeOff className="size-4" />
                    底牌已封存，点击揭示
                  </button>
                )}
              </div>
            </FieldBlock>

            <FieldBlock
              icon={<Crosshair className="size-3.5" />}
              label="错误根因锁定 · ROOT CAUSE"
              hint="必填项：归类本次失误最核心的症结。"
            >
              <RadioGroup
                value={rootCause}
                onValueChange={(value) => setRootCause(value as RootCause)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {ROOT_CAUSES.map((item) => {
                  const active = rootCause === item.value;
                  return (
                    <label
                      key={item.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                        active
                          ? "border-cyan-300/50 bg-cyan-400/10"
                          : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/8"
                      }`}
                    >
                      <RadioGroupItem value={item.value} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{item.code}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </FieldBlock>

            <FieldBlock
              icon={<Wrench className="size-3.5" />}
              label="纠偏指令 · CORRECTIVE ACTION"
              hint="输出下次遇到同类题型时可执行的规避策略。"
            >
              <Textarea
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="制定可执行动作，例如：先画串并联系统框图，再判断模型，最后代入公式，禁止凭直觉直接套算。"
                className="min-h-28 resize-none rounded-2xl border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500"
              />
            </FieldBlock>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.03] px-5 py-4 md:flex-row md:px-6">
            <Button onClick={saveRecord} disabled={isSyncing} className="flex-1 rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {isSyncing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  正在归档...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  {editingId ? "覆盖归档切片" : "保存当前切片"}
                </>
              )}
            </Button>
            <Button
              onClick={saveDraft}
              variant="outline"
              disabled={isSyncing}
              className="flex-1 rounded-2xl border-amber-400/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
            >
              <NotebookPen className="size-4" />
              丢进草稿箱
            </Button>
            <Button
              onClick={handleResetWorkspace}
              variant="outline"
              disabled={isSyncing}
              className="flex-1 rounded-2xl border-white/10 bg-transparent text-slate-200 hover:bg-white/8"
            >
              <RotateCcw className="size-4" />
              清空工作台
            </Button>
          </div>
        </section>
      </div>

      <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] max-w-[96vw] overflow-hidden border-white/10 bg-slate-950 p-0 text-white shadow-[0_40px_140px_rgba(2,6,23,0.8)]"
        >
          <DialogHeader className="border-b border-white/10 px-5 py-4">
            <DialogTitle className="truncate text-white">{imageName ?? "CAQ 题图预览"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              当前截图已放大显示，可直接查看题干细节。
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[calc(92vh-88px)] items-center justify-center overflow-auto bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_38%),#020617] p-4">
            {imageUrl && (
              <img
                src={imageUrl}
                alt="CAQ 题图放大预览"
                className="h-auto max-h-none w-auto max-w-full rounded-2xl object-contain shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function HistoryDrawer({
  records,
  onLoad,
  onDelete,
}: {
  records: AuditRecord[];
  onLoad: (record: AuditRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterRootCause, setFilterRootCause] = useState<string>("all");

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const categoryMatches = filterCategory === "all" || record.category === filterCategory;
      const rootCauseMatches = filterRootCause === "all" || record.rootCause === filterRootCause;
      return categoryMatches && rootCauseMatches;
    });
  }, [filterCategory, filterRootCause, records]);

  const resetFilters = useCallback(() => {
    setFilterCategory("all");
    setFilterRootCause("all");
  }, []);

  return (
    <SheetContent className="w-full gap-0 border-white/10 bg-slate-950 text-white sm:max-w-lg">
      <SheetHeader className="border-b border-white/10">
        <SheetTitle className="flex items-center gap-2 text-white">
          <Archive className="size-4 text-cyan-300" />
          已归档切片
        </SheetTitle>
        <SheetDescription className="text-slate-400">
          当前工作区共有 {records.length} 条 CAQ 审计记录，可继续筛选和二次复盘。
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.03] p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="战区分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部战区</SelectItem>
              {CATEGORIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRootCause} onValueChange={setFilterRootCause}>
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="错误根因" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部根因</SelectItem>
              {ROOT_CAUSES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(filterCategory !== "all" || filterRootCause !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="ml-auto w-fit text-slate-400 hover:bg-white/8 hover:text-white"
          >
            <FilterX className="size-3.5" />
            清除过滤 · 命中 {filtered.length} 条
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center text-slate-500">
            <Inbox className="size-10 opacity-50" />
            <p className="text-sm">{records.length === 0 ? "当前还没有归档切片" : "当前过滤条件下没有命中记录"}</p>
          </div>
        ) : (
          filtered.map((record) => {
            const category = categoryMeta(record.category);
            const rootCause = rootCauseMeta(record.rootCause);

            return (
              <div
                key={record.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-cyan-300/30 hover:bg-white/[0.06]"
              >
                <button type="button" onClick={() => onLoad(record)} className="w-full text-left">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{formatTime(record.timestamp)}</span>
                    {record.imageUrl && (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                        图像
                      </span>
                    )}
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {category && (
                      <Badge variant="outline" className={TIER_STYLES[category.tier]}>
                        {category.label}
                      </Badge>
                    )}
                    {rootCause && (
                      <Badge variant="outline" className="border-rose-400/30 bg-rose-400/10 text-rose-100">
                        {rootCause.label}
                      </Badge>
                    )}
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                    {record.myLogic || record.textParam || "无推演记录"}
                  </p>
                </button>

                <div className="mt-3 flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                      >
                        <Trash2 className="size-3.5" />
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-slate-950 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除这条切片？</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          删除后该条 CAQ 审计记录将从当前工作区移除，无法恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-transparent text-slate-200 hover:bg-white/8 hover:text-white">
                          取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(record.id)}
                          className="bg-rose-500 text-white hover:bg-rose-400"
                        >
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SheetContent>
  );
}

function DraftDrawer({
  drafts,
  onLoad,
  onDelete,
}: {
  drafts: DraftRecord[];
  onLoad: (draft: DraftRecord) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <SheetContent className="w-full gap-0 border-white/10 bg-slate-950 text-white sm:max-w-lg">
      <SheetHeader className="border-b border-white/10">
        <SheetTitle className="flex items-center gap-2 text-white">
          <NotebookPen className="size-4 text-amber-300" />
          草稿箱
        </SheetTitle>
        <SheetDescription className="text-slate-400">
          暂存未完成题目，随时取回继续编辑，同时不占用下一题的工作区。
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {drafts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center text-slate-500">
            <Inbox className="size-10 opacity-50" />
            <p className="text-sm">草稿箱还是空的</p>
          </div>
        ) : (
          drafts.map((draft) => {
            const category = categoryMeta(draft.category);
            const rootCause = rootCauseMeta(draft.rootCause);

            return (
              <div
                key={draft.id}
                className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-3 transition-colors hover:border-amber-300/30 hover:bg-amber-400/[0.08]"
              >
                <button type="button" onClick={() => onLoad(draft)} className="w-full text-left">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{formatTime(draft.timestamp)}</span>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100">
                      草稿
                    </span>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {category && (
                      <Badge variant="outline" className={TIER_STYLES[category.tier]}>
                        {category.label}
                      </Badge>
                    )}
                    {rootCause && (
                      <Badge variant="outline" className="border-rose-400/30 bg-rose-400/10 text-rose-100">
                        {rootCause.label}
                      </Badge>
                    )}
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-300">
                    {draft.myLogic || draft.textParam || draft.correctAnswer || "无正文内容"}
                  </p>
                </button>

                <div className="mt-3 flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                      >
                        <Trash2 className="size-3.5" />
                        删除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-slate-950 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除这条草稿？</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          删除后该条未完成题目将从草稿箱移除，无法恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-transparent text-slate-200 hover:bg-white/8 hover:text-white">
                          取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(draft.id)}
                          className="bg-rose-500 text-white hover:bg-rose-400"
                        >
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SheetContent>
  );
}

function PanelHeader({
  index,
  title,
  subtitle,
  icon,
}: {
  index: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3 md:px-6">
      <span className="font-mono text-xs font-bold text-cyan-300">{index}</span>
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <span className="ml-auto text-[10px] uppercase tracking-[0.28em] text-slate-500">{subtitle}</span>
    </div>
  );
}

function FieldBlock({
  icon,
  label,
  hint,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white">
            <span className="text-cyan-300">{icon}</span>
            {label}
          </span>
          <p className="mt-1 pl-5 text-xs leading-relaxed text-slate-400">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
