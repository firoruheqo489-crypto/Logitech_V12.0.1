import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  FileDown,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  SendHorizontal,
  ShieldAlert,
  Trash2,
  Trophy,
  Users2,
  Wrench,
  X,
  ZoomIn,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import { useEightDCaseArchive } from "@/hooks/use-eight-d-case-archive";
import { deleteAssetViaServer, uploadAssetViaServer } from "@/lib/ossUpload";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_8D_WORKSPACE_KEY,
  fetchReport8DRemoteWorkspaceState,
  type Report8DOutputCutoff,
  saveReport8DRemoteWorkspaceState,
  submitReport8DWorkspaceState,
  type Report8DContainmentAction,
  type Report8DCorrectiveAction,
  type Report8DCorrectionRound,
  type Report8DHeaderFields,
  type Report8DImplementationRound,
  type Report8DProblemItem,
  type Report8DVerificationRound,
  type Report8DTeamMember,
  type Report8DWorkspaceState,
} from "@/lib/report-8d-remote-state-api";
import EightDArchiveDrawer from "./EightDArchiveDrawer";

type Report8DWorkspaceProps = {
  projectName: string;
  productName?: string;
  moldNumbers?: string[];
};

type SyncTone = "neutral" | "saving" | "saved" | "error";

type DisciplineSectionProps = {
  code: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

type Report8DDocumentOptions = {
  state: Report8DWorkspaceState;
  projectName: string;
  moldNumbers: string[];
};

const REPORT_8D_OUTPUT_CUTOFF_OPTIONS: Array<{ value: Report8DOutputCutoff; label: string }> = [
  { value: "D0", label: "截断到 D0" },
  { value: "D1", label: "截断到 D1" },
  { value: "D2", label: "截断到 D2" },
  { value: "D3", label: "截断到 D3" },
  { value: "D4", label: "截断到 D4 根因分析" },
  { value: "D5", label: "截断到 D5 改善措施" },
  { value: "D6", label: "截断到 D6 效果验证" },
  { value: "D7", label: "截断到 D7 防止再发" },
  { value: "D8", label: "截断到 D8 结案" },
  { value: "SIGNOFF", label: "完整输出（含签核）" },
];

type DeleteConfirmState = {
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
};

const SAVE_DEBOUNCE_MS = 900;
const EMPTY_MOLD_NUMBERS: string[] = [];
const FIXED_ROW_TEXTAREA_CLASS =
  "h-28 min-h-28 max-h-28 resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all [field-sizing:fixed]";
const ROUND_INDEX_LABELS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const REPORT_8D_IMAGE_MAX_SIZE_BYTES = 500 * 1024;

const STATUS_OPTIONS: Array<Report8DContainmentAction["status"]> = [
  "completed",
  "in-progress",
  "pending",
];

const STATUS_STYLES: Record<Report8DContainmentAction["status"], { label: string; className: string }> = {
  completed: {
    label: "已完成",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
  "in-progress": {
    label: "进行中",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  pending: {
    label: "待处理",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  },
};

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildVerificationRound(verification = "", images: string[] = []): Report8DVerificationRound {
  return {
    id: createId("verification-round"),
    verification,
    images,
  };
}

function ensureVerificationRounds(items: Report8DVerificationRound[] | undefined | null): Report8DVerificationRound[] {
  return Array.isArray(items) ? items : [];
}

function buildCorrectionRound(correction = "", images: string[] = []): Report8DCorrectionRound {
  return {
    id: createId("correction-round"),
    correction,
    images,
  };
}

function ensureCorrectionRounds(items: Report8DCorrectionRound[] | undefined | null): Report8DCorrectionRound[] {
  return Array.isArray(items) ? items : [];
}

function buildImplementationRound(implementation = "", images: string[] = []): Report8DImplementationRound {
  return {
    id: createId("implementation-round"),
    implementation,
    images,
  };
}

function ensureImplementationRounds(items: Report8DImplementationRound[] | undefined | null): Report8DImplementationRound[] {
  return Array.isArray(items) ? items : [];
}

function formatRoundIndexLabel(index: number): string {
  return ROUND_INDEX_LABELS[index] || String(index + 1);
}

async function compressReport8DImage(file: File): Promise<File> {
  if (file.size <= REPORT_8D_IMAGE_MAX_SIZE_BYTES) {
    return file;
  }

  return imageCompression(file, {
    maxSizeMB: 0.48,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.82,
    maxIteration: 10,
  });
}

function normalizeWorkspaceKey(projectName: string): string {
  const normalized = projectName
    .trim()
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 120);

  return normalized ? `dashboard-report-8d-${normalized}` : DEFAULT_REPORT_8D_WORKSPACE_KEY;
}

function formatSyncLabel(prefix: string, updatedAt?: string): string {
  if (!updatedAt) {
    return prefix;
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return prefix;
  }

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${prefix} ${hh}:${mm}`;
}

function formatLocalDate(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildInitialState(
  workspaceKey: string,
  projectName: string,
  productName: string,
  moldNumbers: string[],
  reportId?: string,
): Report8DWorkspaceState {
  const openedDate = formatLocalDate();
  const moldSuffix = moldNumbers[0]?.replace(/\s+/g, "").slice(-3) || "001";

  return {
    module: "report-8d",
    workspaceKey,
    outputCutoff: "SIGNOFF",
    headerFields: {
      reportNo: reportId || `8D-${openedDate.replaceAll("-", "").slice(0, 6)}-${moldSuffix}`,
      finishedPartNumber: moldNumbers.join(" / ") || "待填写",
      finishedPartName: productName || `${projectName || "项目"} / 待填写`,
      finishedPartSpec: "待填写",
      replyTo: "内部",
      abnormalPart: moldNumbers.join(" / ") || "待填写",
      reportSubject: "一句话描述问题：对象 + 不良模式 + 影响",
      reportDate: openedDate,
      projectModule: projectName || "当前项目模块",
      moldNumber: moldNumbers.join(" / ") || "当前模块未绑定模号",
      customer: "客户 / 内部提出部门",
      product: productName || `${projectName || "项目"} / 产品或零件名称`,
      defectIssue: "一句话描述问题：对象 + 不良模式 + 影响",
      dateOpened: openedDate,
      currentStatus: "D0-D2 建案与问题定义",
      champion: "负责人 / 部门",
    },
    d0: {
      severityLabel: "请选择：客户停线 / 安全法规 / 重大质量 / 一般异常",
      summary:
        "问题来源、发现方式、影响范围、风险等级、是否需要客户通知、是否需要停止发货或停止生产。",
      containment:
        "列明已经完成的紧急响应：隔离批次、冻结库存、停止出货、标识可疑品、通知相关方、保护客户现场。",
    },
    teamMembers: [
      { id: createId("team"), name: "待填写", department: "质量", role: "8D Champion / 主导人" },
      { id: createId("team"), name: "待填写", department: "工程 / 研发", role: "技术分析与根因验证" },
      { id: createId("team"), name: "待填写", department: "生产 / 制造", role: "现场遏制与措施执行" },
      { id: createId("team"), name: "待填写", department: "供应商质量 / 采购", role: "来料或供应链风险确认" },
      { id: createId("team"), name: "待填写", department: "客户质量 / 项目", role: "客户沟通与交付协调" },
    ],
    problemItems: [
      { id: createId("problem"), label: "Who / 谁", value: "客户、内部部门、供应商、生产线、班组或受影响群体。" },
      { id: createId("problem"), label: "What / 什么", value: "失效模式、不良现象、规格偏差、客户抱怨或风险描述。" },
      { id: createId("problem"), label: "Where / 哪里", value: "发生地点、工序、设备、模具、仓库、客户现场或物流环节。" },
      { id: createId("problem"), label: "When / 何时", value: "发现时间、生产日期、批次时间、首发时间、重复发生频率。" },
      { id: createId("problem"), label: "Why / 为什么重要", value: "对安全、法规、客户、交付、成本、品牌或后续工序的影响。" },
      { id: createId("problem"), label: "How / 如何发现", value: "检验、测试、客户反馈、生产异常、稽核、数据监控或现场观察。" },
      { id: createId("problem"), label: "How Many / 多少", value: "数量、比例、批次、库存、在制、在途、客户现场和潜在暴露范围。" },
    ],
    containmentActions: [
      {
        id: createId("containment"),
        action: "定义可疑范围并隔离：库存、在制、在途、客户现场、供应商库存。",
        owner: "质量负责人",
        date: openedDate,
        status: "pending",
      },
      {
        id: createId("containment"),
        action: "建立临时检验或筛选标准，明确判定准则、记录方式和放行权限。",
        owner: "检验 / 工程",
        date: openedDate,
        status: "pending",
      },
      {
        id: createId("containment"),
        action: "通知客户、生产、仓库、供应商等相关方，防止问题继续流出。",
        owner: "项目 / 客户质量",
        date: openedDate,
        status: "pending",
      },
    ],
    d4: {
      rootCauseAnalysis: "",
      verificationRounds: [
        buildVerificationRound(),
      ],
    },
    d5: {
      correctivePlan: "",
      correctionRounds: [
        buildCorrectionRound(),
      ],
    },
    correctiveActions: [
      {
        id: createId("corrective"),
        action: "针对发生根因制定改善措施，明确动作、对象、参数和实施范围。",
        type: "发生根因",
        owner: "责任部门",
        targetDate: openedDate,
      },
      {
        id: createId("corrective"),
        action: "针对逃逸根因制定检测或拦截措施，明确检验方式、频次、记录和放行权限。",
        type: "逃逸根因",
        owner: "质量 / 检验",
        targetDate: openedDate,
      },
      {
        id: createId("corrective"),
        action: "更新风险文件、作业标准、培训材料和系统控制，确保措施固化。",
        type: "系统预防",
        owner: "体系 / 工程",
        targetDate: openedDate,
      },
    ],
    d6: {
      summary:
        "说明永久措施的实施范围、样本量、验证方法、判定标准、验证周期和是否可以解除临时遏制。",
      implementationRounds: [
        buildImplementationRound(),
      ],
      verificationItems: [
        "措施实施确认：现场、文件、系统或供应商端均已按计划执行。",
        "效果验证：用数据证明不良率、测试结果、过程能力或客户反馈达到目标。",
        "副作用确认：措施没有引入新的安全、质量、交付、成本或法规风险。",
        "遏制解除条件：明确哪些证据满足后可以恢复正常流程。",
      ],
      verifiedStatus: "待验证 / 验证中 / 验证通过 / 验证失败",
      verifiedAt: openedDate,
    },
    d7: {
      systemUpdates: [
        "DFMEA / PFMEA 风险项已更新",
        "控制计划、检验标准或测试规范已更新",
        "SOP / 作业指导书 / 点检表已更新",
        "培训、资格确认或岗位防错已完成",
        "供应商、客户或相关项目已完成横向展开",
      ],
      rolloutNotes:
        "横向展开范围：同产品、同工艺、同设备、同材料、同供应商、同客户或类似项目。\n防再发机制：系统权限、防错、报警、点检、审核、培训、标准化文件。\n责任闭环：每项更新需有责任人、完成日期和证据链接。",
    },
    d8: {
      customerClosureDate: openedDate,
      internalClosureDate: openedDate,
      closureSummary:
        "总结问题、根因、永久措施、验证结果、客户确认、标准化回写和剩余风险。结案前确认所有行动项关闭、证据齐全、责任人签核完成。",
      recognition: "记录团队贡献、客户反馈、经验教训和后续复盘安排。",
    },
  };
}

function compactPrintText(value: string | undefined, fallback = "待填写", maxLength = 120): string {
  const normalized = (value || "")
    .replace(/\s+/g, " ")
    .replace(/[；;]\s*/g, "；")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function formatPrintMultiline(value: string | undefined, fallback = "待填写"): string {
  const normalized = (value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return normalized ? escapeHtml(normalized).replace(/\n/g, "<br />") : escapeHtml(fallback);
}

function joinLimited(items: string[], limit: number, fallback = "待填写"): string {
  const cleaned = items.map((item) => compactPrintText(item, "", 72)).filter(Boolean);
  if (cleaned.length === 0) {
    return fallback;
  }

  const visible = cleaned.slice(0, limit).join("；");
  const remaining = cleaned.length - limit;
  return remaining > 0 ? `${visible}；等 ${remaining} 项` : visible;
}

function joinAllMultiline(items: string[], fallback = "待填写"): string {
  const cleaned = items
    .map((item) => item.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return fallback;
  }

  return cleaned.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatTeamPreview(members: Report8DTeamMember[]): string {
  return joinAllMultiline(
    members.map((member) =>
      [member.name, member.department, member.role].map((value) => value.trim()).filter(Boolean).join(" / "),
    ),
  );
}

function formatContainmentPreview(actions: Report8DContainmentAction[]): string[] {
  return actions.map((action, index) => {
    const status = STATUS_STYLES[action.status]?.label ?? action.status;
    return `${index + 1}. ${action.action || "待填写措施"} | ${action.owner || "责任人"} | ${status}`;
  });
}

function formatCorrectivePreview(actions: Report8DCorrectiveAction[]): string[] {
  return actions.map((action, index) =>
    `${index + 1}. ${action.action || "待填写措施"} | ${action.type || "类型"} | ${action.owner || "责任人"}`,
  );
}

function formatLegacyCorrectivePlan(actions: Report8DCorrectiveAction[]): string {
  return formatCorrectivePreview(actions).join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReport8DPrintCss(): string {
  return `
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #111827;
      font-family: Arial, "Microsoft YaHei", "PingFang SC", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-8d-a4-page {
      width: 210mm;
      min-height: 297mm;
      overflow: visible;
      margin: 0 auto;
      padding: 8.5mm 9mm;
      background: #ffffff;
      color: #111827;
      font-size: 7.8px;
      line-height: 1.18;
    }

    .report-8d-print-title {
      border-bottom: 1.4px solid #111827;
      padding-bottom: 2mm;
    }

    .report-8d-print-title h1 {
      margin: 0;
      color: #0f172a;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .report-8d-print-grid {
      display: grid;
      gap: 1mm;
    }

    .report-8d-print-header {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-top: 2mm;
    }

    .report-8d-d-flow {
      display: grid;
      gap: 1.35mm;
      margin-top: 2mm;
    }

    .report-8d-print-field {
      border: 0.55px solid #cbd5e1;
      border-radius: 1.1mm;
      padding: 1mm 1.2mm;
      break-inside: avoid;
    }

    .report-8d-print-field strong {
      display: block;
      margin: 0 0 0.45mm;
      color: #64748b;
      font-size: 6.6px;
      font-weight: 700;
    }

    .report-8d-print-field span {
      display: block;
      color: #0f172a;
      font-size: 7.7px;
      font-weight: 600;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .report-8d-print-span-2 {
      grid-column: span 2;
    }

    .report-8d-print-span-4 {
      grid-column: span 4;
    }

    .report-8d-print-box {
      display: grid;
      grid-template-columns: 31mm minmax(0, 1fr);
      align-items: stretch;
      column-gap: 2.2mm;
      border: 0.65px solid #cbd5e1;
      border-left: 2.4mm solid #0f766e;
      border-radius: 1.2mm;
      padding: 1.25mm 1.5mm;
      break-inside: avoid;
      background: linear-gradient(90deg, #f8fafc 0, #ffffff 24mm);
    }

    .report-8d-print-side {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      align-self: stretch;
      gap: 0.9mm;
      min-width: 0;
      padding-right: 1.6mm;
      border-right: 0.6px solid #cbd5e1;
      text-align: left;
    }

    .report-8d-print-side h2 {
      color: #0f172a;
      margin: 0;
      font-size: 8.5px;
      font-weight: 800;
      line-height: 1.22;
    }

    .report-8d-print-code {
      border: 0.6px solid #0f766e;
      border-radius: 1mm;
      color: #0f766e;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 7.2px;
      font-weight: 800;
      min-width: 8mm;
      line-height: 1;
      padding: 0.35mm 1.2mm;
      text-align: center;
      white-space: nowrap;
    }

    .report-8d-print-body {
      min-width: 0;
    }

    .report-8d-print-copy {
      color: #1f2937;
      font-size: 7.9px;
      margin: 0;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      break-inside: avoid-page;
      page-break-inside: avoid;
      orphans: 3;
      widows: 3;
    }

    .report-8d-print-copy-indented {
      padding-left: 3.1mm;
    }

    .report-8d-print-muted {
      color: #64748b;
      font-size: 7.3px;
      margin: 0;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      break-inside: avoid-page;
      page-break-inside: avoid;
      orphans: 3;
      widows: 3;
    }

    .report-8d-print-list {
      margin: 0;
      padding-left: 3.1mm;
    }

    .report-8d-print-list-spaced {
      margin-top: 1.8mm;
      padding-top: 1.4mm;
      border-top: 0.6px solid #cbd5e1;
    }

    .report-8d-print-list li {
      margin: 0 0 1.35mm;
      padding: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      break-inside: avoid-page;
      page-break-inside: avoid;
      orphans: 3;
      widows: 3;
    }

    .report-8d-print-list li:last-child {
      margin-bottom: 0;
    }

    .report-8d-print-table {
      border-collapse: collapse;
      table-layout: fixed;
      width: 100%;
    }

    .report-8d-print-table td,
    .report-8d-print-table th {
      border: 0.5px solid #cbd5e1;
      padding: 0.95mm 1.1mm;
      text-align: left;
      vertical-align: top;
      line-height: 1.4;
    }

    .report-8d-print-table th {
      background: #f1f5f9;
      color: #334155;
      font-size: 7.2px;
      font-weight: 700;
      width: 24%;
    }

    .report-8d-print-clamp-1,
    .report-8d-print-clamp-2,
    .report-8d-print-clamp-3 {
      display: block;
      overflow: visible;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .report-8d-print-sign {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1.4mm;
      margin-top: 1.4mm;
    }

    .report-8d-print-sign div {
      border-top: 0.65px solid #94a3b8;
      color: #475569;
      padding-top: 0.8mm;
    }

    .report-8d-print-footer {
      margin-top: 1.3mm;
      color: #64748b;
      font-size: 6.8px;
      text-align: right;
    }

    @media print {
      html,
      body {
        background: #ffffff;
      }

      .report-8d-a4-page {
        margin: 0;
        box-shadow: none;
      }
    }
  `;
}

function buildPrintField(label: string, value: string, span?: 2 | 4): string {
  const spanClass = span === 2 ? " report-8d-print-span-2" : span === 4 ? " report-8d-print-span-4" : "";
  return `<div class="report-8d-print-field${spanClass}"><strong>${escapeHtml(label)}</strong><span>${formatPrintMultiline(value, "待填写")}</span></div>`;
}

function buildPrintBox(code: string, title: string, content: string): string {
  return `<section class="report-8d-print-box"><div class="report-8d-print-side"><span class="report-8d-print-code">${escapeHtml(code)}</span><h2>${escapeHtml(title)}</h2></div><div class="report-8d-print-body">${content}</div></section>`;
}

function getCutoffIndex(cutoff: Report8DOutputCutoff): number {
  const ordered: Report8DOutputCutoff[] = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "SIGNOFF"];
  return Math.max(0, ordered.indexOf(cutoff));
}

function buildReport8DDocumentMarkup({ state, projectName, moldNumbers }: Report8DDocumentOptions): string {
  const { headerFields } = state;
  const problemRows = state.problemItems.slice(0, 7);
  const containmentRows = formatContainmentPreview(state.containmentActions);
  const verificationRounds = ensureVerificationRounds(state.d4?.verificationRounds).slice(0, 20);
  const correctionRounds = ensureCorrectionRounds(state.d5?.correctionRounds).slice(0, 20);
  const implementationRounds = ensureImplementationRounds(state.d6?.implementationRounds).slice(0, 20);
  const systemUpdatePreview = joinAllMultiline(state.d7.systemUpdates);

  const problemTable = problemRows
    .map((item) => `
      <tr>
        <th>${escapeHtml(compactPrintText(item.label, "字段", 18))}</th>
        <td><span class="report-8d-print-copy">${formatPrintMultiline(item.value, "待填写")}</span></td>
      </tr>`)
    .join("");
  const containmentList = (containmentRows.length ? containmentRows : ["1. 待填写临时遏制措施"])
    .map((item) => `<li class="report-8d-print-clamp-1">${formatPrintMultiline(item, "")}</li>`)
    .join("");
  const rootCauseAnalysis = state.d4?.rootCauseAnalysis || "";
  const verificationRoundList = (verificationRounds.length ? verificationRounds : [buildVerificationRound()])
    .map((item, index) => {
      const verificationLabel = `验证${formatRoundIndexLabel(index)}`;
      const imageSummary = item.images.length > 0 ? `；验证图片 ${item.images.length} 张` : "";
      return `<li class="report-8d-print-clamp-1"><strong>${escapeHtml(verificationLabel)}：</strong>${formatPrintMultiline(item.verification, "待填写")}${escapeHtml(imageSummary)}</li>`;
    })
    .join("");
  const correctivePlan = state.d5?.correctivePlan || formatLegacyCorrectivePlan(state.correctiveActions);
  const correctionRoundList = (correctionRounds.length ? correctionRounds : [buildCorrectionRound()])
    .map((item, index) => {
      const correctionLabel = `措施${formatRoundIndexLabel(index)}`;
      const imageSummary = item.images.length > 0 ? `；措施图片 ${item.images.length} 张` : "";
      return `<li class="report-8d-print-clamp-1"><strong>${escapeHtml(correctionLabel)}：</strong>${formatPrintMultiline(item.correction, "待填写")}${escapeHtml(imageSummary)}</li>`;
    })
    .join("");
  const legacyImplementationRounds = state.d6.verificationItems.map((item) => buildImplementationRound(item));
  const implementationRoundList = (implementationRounds.length ? implementationRounds : legacyImplementationRounds.length ? legacyImplementationRounds : [buildImplementationRound()])
    .map((item, index) => {
      const implementationLabel = `验证${formatRoundIndexLabel(index)}`;
      const imageSummary = item.images.length > 0 ? `；验证图片 ${item.images.length} 张` : "";
      return `<li class="report-8d-print-clamp-1"><strong>${escapeHtml(implementationLabel)}：</strong>${formatPrintMultiline(item.implementation, "待填写")}${escapeHtml(imageSummary)}</li>`;
    })
    .join("");

  const sections = [
    buildPrintBox(
      "D0",
      "问题准备与紧急响应",
      `<p class="report-8d-print-copy">严重级别：${escapeHtml(compactPrintText(state.d0.severityLabel, "待评估", 76))}</p>
       <p class="report-8d-print-copy">${formatPrintMultiline(state.d0.summary, "问题来源、影响范围、风险等级待填写")}</p>`,
    ),
    buildPrintBox(
      "D1",
      "团队组建",
      `<p class="report-8d-print-copy">${formatPrintMultiline(formatTeamPreview(state.teamMembers), "待填写")}</p>`,
    ),
    buildPrintBox("D2", "问题描述 (5W2H)", `<table class="report-8d-print-table"><tbody>${problemTable}</tbody></table>`),
    buildPrintBox(
      "D3",
      "临时遏制措施",
      `<p class="report-8d-print-copy report-8d-print-copy-indented">遏制说明：${formatPrintMultiline(state.d0.containment, "待填写")}</p>
       <ul class="report-8d-print-list">${containmentList}</ul>`,
    ),
    buildPrintBox(
      "D4",
      "根本原因分析",
      `<p class="report-8d-print-copy report-8d-print-copy-indented">原因分析：${formatPrintMultiline(rootCauseAnalysis, "待填写")}</p>
       <ul class="report-8d-print-list report-8d-print-list-spaced">${verificationRoundList}</ul>`,
    ),
    buildPrintBox(
      "D5",
      "改善措施",
      `<p class="report-8d-print-copy report-8d-print-copy-indented">措施说明：${formatPrintMultiline(correctivePlan, "待填写")}</p>
       <ul class="report-8d-print-list">${correctionRoundList}</ul>`,
    ),
    buildPrintBox(
      "D6",
      "效果验证",
      `<p class="report-8d-print-copy report-8d-print-copy-indented">验证摘要：${formatPrintMultiline(state.d6.summary, "待填写")}</p>
       <ul class="report-8d-print-list">${implementationRoundList}</ul>
       <p class="report-8d-print-muted">状态：${escapeHtml(compactPrintText(state.d6.verifiedStatus, "待验证", 36))}；日期：${escapeHtml(compactPrintText(state.d6.verifiedAt, "待定", 18))}</p>`,
    ),
    buildPrintBox(
      "D7",
      "防止再发",
      `<p class="report-8d-print-copy report-8d-print-copy-indented">系统回写：${formatPrintMultiline(systemUpdatePreview, "待填写")}</p>
       <p class="report-8d-print-copy report-8d-print-copy-indented">横向展开：${formatPrintMultiline(state.d7.rolloutNotes, "待填写")}</p>`,
    ),
    buildPrintBox(
      "D8",
      "结案与团队认可",
      `<p class="report-8d-print-copy report-8d-print-copy-indented">结案总结：${formatPrintMultiline(state.d8.closureSummary, "待填写")}</p>
       <p class="report-8d-print-muted">客户确认：${escapeHtml(compactPrintText(state.d8.customerClosureDate, "待定", 18))}；内部结案：${escapeHtml(compactPrintText(state.d8.internalClosureDate, "待定", 18))}</p>`,
    ),
    buildPrintBox(
      "签核",
      "审批签核",
      `<div class="report-8d-print-sign"><div>编制</div><div>质量确认</div><div>责任部门</div><div>批准</div></div>
       <p class="report-8d-print-copy report-8d-print-copy-indented">团队认可：${formatPrintMultiline(state.d8.recognition, "记录团队贡献、客户反馈和后续复盘安排")}</p>`,
    ),
  ];

  const visibleSections = sections.slice(0, getCutoffIndex(state.outputCutoff) + 1).join("");

  return `
    <article class="report-8d-a4-page" aria-label="8D 报告 A4 页面">
      <div class="report-8d-print-title">
        <h1>8D 纠正措施报告</h1>
      </div>

      <div class="report-8d-print-grid report-8d-print-header">
        ${buildPrintField("成品料号", headerFields.finishedPartNumber)}
        ${buildPrintField("成品名称", headerFields.finishedPartName)}
        ${buildPrintField("成品规格", headerFields.finishedPartSpec)}
        ${buildPrintField("异常部件", headerFields.abnormalPart)}
        ${buildPrintField("回复对象", headerFields.replyTo)}
        ${buildPrintField("报告主题", headerFields.reportSubject)}
        ${buildPrintField("报告编号", headerFields.reportNo)}
        ${buildPrintField("报告日期", headerFields.reportDate || headerFields.dateOpened)}
      </div>

      <div class="report-8d-d-flow">${visibleSections}</div>
      <div class="report-8d-print-footer">本页为 8D 报告 A4 打印版，完整证据、记录和附件以系统工作区为准。</div>
    </article>
  `;
}

function buildReport8DFileName(state: Report8DWorkspaceState): string {
  const base = compactPrintText(state.headerFields.reportNo, "8D-report", 60)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  return `${base || "8D-report"}.pdf`;
}

function mergeWorkspaceStateWithBaseline(
  state: Report8DWorkspaceState,
  baselineState: Report8DWorkspaceState,
  workspaceKey: string,
): Report8DWorkspaceState {
  const nextVerificationRounds = ensureVerificationRounds(state.d4?.verificationRounds);
  const nextCorrectionRounds = ensureCorrectionRounds(state.d5?.correctionRounds);
  const nextImplementationRounds = ensureImplementationRounds(state.d6?.implementationRounds);
  const hasRootCauseAnalysis = typeof state.d4?.rootCauseAnalysis === "string";
  const hasVerificationRounds = Array.isArray(state.d4?.verificationRounds);
  const hasCorrectivePlan = typeof state.d5?.correctivePlan === "string";
  const hasCorrectionRounds = Array.isArray(state.d5?.correctionRounds);
  const hasImplementationRounds = Array.isArray(state.d6?.implementationRounds);
  const legacyCorrectivePlan = formatLegacyCorrectivePlan(state.correctiveActions || []);
  const legacyImplementationRounds = Array.isArray(state.d6?.verificationItems)
    ? state.d6.verificationItems.map((item) => buildImplementationRound(item))
    : [];
  return {
    ...state,
    workspaceKey,
    headerFields: {
      ...baselineState.headerFields,
      ...state.headerFields,
    },
    d4: {
      ...baselineState.d4,
      ...state.d4,
      rootCauseAnalysis: hasRootCauseAnalysis ? state.d4.rootCauseAnalysis : baselineState.d4.rootCauseAnalysis,
      verificationRounds: hasVerificationRounds ? nextVerificationRounds : baselineState.d4.verificationRounds,
    },
    d5: {
      ...baselineState.d5,
      ...state.d5,
      correctivePlan: hasCorrectivePlan ? state.d5.correctivePlan : legacyCorrectivePlan || baselineState.d5.correctivePlan,
      correctionRounds: hasCorrectionRounds ? nextCorrectionRounds : baselineState.d5.correctionRounds,
    },
    d6: {
      ...baselineState.d6,
      ...state.d6,
      implementationRounds: hasImplementationRounds
        ? nextImplementationRounds
        : legacyImplementationRounds.length > 0
          ? legacyImplementationRounds
          : baselineState.d6.implementationRounds,
    },
  };
}

function buildReport8DPreviewHtml(options: Report8DDocumentOptions): string {
  const title = `8D 打印预览 - ${compactPrintText(options.state.headerFields.reportNo, "未编号", 40)}`;
  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          ${buildReport8DPrintCss()}

          .report-8d-preview-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 20px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.24);
            background: rgba(15, 23, 42, 0.94);
            color: #e2e8f0;
            font-family: Arial, "Microsoft YaHei", sans-serif;
          }

          .report-8d-preview-title {
            font-size: 14px;
            font-weight: 700;
          }

          .report-8d-preview-meta {
            margin-top: 3px;
            color: #94a3b8;
            font-size: 11px;
          }

          .report-8d-preview-actions {
            display: flex;
            gap: 10px;
          }

          .report-8d-preview-button {
            border: 1px solid rgba(56, 189, 248, 0.32);
            border-radius: 8px;
            background: rgba(8, 145, 178, 0.18);
            color: #67e8f9;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            padding: 8px 14px;
          }

          .report-8d-preview-button.secondary {
            border-color: rgba(148, 163, 184, 0.28);
            background: transparent;
            color: #cbd5e1;
          }

          .report-8d-preview-shell {
            padding: 18px 0;
          }

          .report-8d-a4-page {
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.2);
          }

          @media print {
            .report-8d-preview-toolbar {
              display: none !important;
            }

            .report-8d-preview-shell {
              padding: 0;
            }

            .report-8d-a4-page {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-8d-preview-toolbar">
          <div>
            <div class="report-8d-preview-title">8D 报告打印预览</div>
            <div class="report-8d-preview-meta">A4 打印版，支持较长正文内容换行显示</div>
          </div>
          <div class="report-8d-preview-actions">
            <button class="report-8d-preview-button secondary" type="button" onclick="window.close()">关闭</button>
            <button class="report-8d-preview-button" type="button" onclick="window.print()">打印</button>
          </div>
        </div>
        <main class="report-8d-preview-shell">
          ${buildReport8DDocumentMarkup(options)}
        </main>
      </body>
    </html>`;
}

function openReport8DPrintPreview(options: Report8DDocumentOptions): void {
  const previewBlob = new Blob([buildReport8DPreviewHtml(options)], {
    type: "text/html;charset=utf-8",
  });
  const previewUrl = URL.createObjectURL(previewBlob);
  const previewWindow = window.open(previewUrl, "_blank", "width=1100,height=900");

  if (!previewWindow) {
    URL.revokeObjectURL(previewUrl);
    throw new Error("打印预览窗口被浏览器拦截，请允许弹窗后重试");
  }

  previewWindow.addEventListener(
    "beforeunload",
    () => {
      URL.revokeObjectURL(previewUrl);
    },
    { once: true },
  );
  previewWindow.focus();
}

async function exportReport8DPdf(options: Report8DDocumentOptions): Promise<void> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "210mm";
  host.style.background = "#ffffff";
  host.innerHTML = `<style>${buildReport8DPrintCss()}</style>${buildReport8DDocumentMarkup(options)}`;
  document.body.appendChild(host);

  try {
    if ("fonts" in document) {
      await document.fonts.ready;
    }

    const pageNode = host.querySelector(".report-8d-a4-page") as HTMLElement | null;
    if (!pageNode) {
      throw new Error("8D PDF 模板生成失败");
    }

    const [{ default: html2canvas }, jspdfModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
    const canvas = await html2canvas(pageNode, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: pageNode.offsetWidth,
      height: pageNode.offsetHeight,
      windowWidth: pageNode.offsetWidth,
      windowHeight: pageNode.offsetHeight,
      imageTimeout: 0,
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: false,
    });
    const imageData = canvas.toDataURL("image/png", 1);
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imageHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imageData, "PNG", 0, position, pdfWidth, imageHeight, "report-8d-a4", "FAST");
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", 0, position, pdfWidth, imageHeight, undefined, "FAST");
      heightLeft -= pdfHeight;
    }

    pdf.save(buildReport8DFileName(options.state));
  } finally {
    host.remove();
  }
}

function SyncStateView({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center rounded-2xl border border-white/10 bg-slate-950 px-6">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-400/70">Cloud Workspace</div>
        <h2 className="mt-3 text-2xl font-semibold text-zinc-100">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p>
        {actionLabel && onAction ? (
          <div className="mt-6 flex items-center justify-center">
            <Button onClick={onAction} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DisciplineSection({ code, title, action, children }: DisciplineSectionProps) {
  return (
    <Card className="border-white/10 bg-slate-950/70 text-slate-100 shadow-[0_12px_40px_rgba(2,6,23,0.24)]">
      <CardHeader className="border-b border-white/6 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">{code}</Badge>
            <CardTitle className="text-lg font-semibold tracking-tight text-white">{title}</CardTitle>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">{children}</CardContent>
    </Card>
  );
}

export default function Report8DWorkspace({
  projectName,
  productName,
  moldNumbers = EMPTY_MOLD_NUMBERS,
}: Report8DWorkspaceProps) {
  const workspaceKey = useMemo(() => normalizeWorkspaceKey(projectName), [projectName]);
  const moldNumbersKey = moldNumbers.join("\u001f");
  const stableMoldNumbers = useMemo(
    () => moldNumbers.map((moldNumber) => moldNumber.trim()).filter(Boolean),
    [moldNumbersKey],
  );
  const baselineState = useMemo(
    () => buildInitialState(workspaceKey, projectName, productName?.trim() || "", stableMoldNumbers),
    [workspaceKey, projectName, productName, stableMoldNumbers],
  );

  const [workspaceState, setWorkspaceState] = useState<Report8DWorkspaceState>(baselineState);
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatusLabel, setSyncStatusLabel] = useState("云端工作区同步中");
  const [syncStatusTone, setSyncStatusTone] = useState<SyncTone>("saving");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isMountedRef = useRef(false);
  const workspaceStateRef = useRef<Report8DWorkspaceState>(baselineState);
  const lastSavedPayloadRef = useRef("");
  const statePayloadRef = useRef("");
  const syncInFlightRef = useRef(false);
  const hasShownSaveFailureRef = useRef(false);
  const suppressFocusSyncRef = useRef(false);

  const statePayload = useMemo(() => JSON.stringify(workspaceState), [workspaceState]);
  const hasUnsavedChanges = !isHydrating && statePayload !== lastSavedPayloadRef.current;
  const verificationRounds = ensureVerificationRounds(workspaceState.d4?.verificationRounds);
  const correctionRounds = ensureCorrectionRounds(workspaceState.d5?.correctionRounds);
  const implementationRounds = ensureImplementationRounds(workspaceState.d6?.implementationRounds);
  const [uploadingVerificationRoundId, setUploadingVerificationRoundId] = useState<string | null>(null);
  const [uploadingCorrectionRoundId, setUploadingCorrectionRoundId] = useState<string | null>(null);
  const [uploadingImplementationRoundId, setUploadingImplementationRoundId] = useState<string | null>(null);
  const [previewVerificationImageUrl, setPreviewVerificationImageUrl] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  useEffect(() => {
    workspaceStateRef.current = workspaceState;
  }, [workspaceState]);

  useEffect(() => {
    statePayloadRef.current = statePayload;
  }, [statePayload]);

  useEffect(() => {
    if (!previewVerificationImageUrl) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewVerificationImageUrl("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewVerificationImageUrl]);

  const markWorkspaceSaved = useCallback((state: Report8DWorkspaceState, updatedAt?: string) => {
    const nextPayload = JSON.stringify(state);
    lastSavedPayloadRef.current = nextPayload;
    hasShownSaveFailureRef.current = false;
    setSyncStatusLabel(formatSyncLabel("8D 工作区已保存", updatedAt));
    setSyncStatusTone("saved");
  }, []);

  const persistWorkspaceStateImmediately = useCallback(async (
    nextState: Report8DWorkspaceState,
    failureMessage: string,
  ) => {
    setSyncStatusLabel("8D 工作区保存中");
    setSyncStatusTone("saving");

    try {
      const result = await saveReport8DRemoteWorkspaceState(nextState);
      if (!isMountedRef.current) {
        return;
      }

      markWorkspaceSaved(nextState, result.updatedAt);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setSyncStatusLabel("8D 工作区保存失败");
      setSyncStatusTone("error");
      toast.error(error instanceof Error ? error.message : failureMessage);
    }
  }, [markWorkspaceSaved]);

  const openDeleteConfirm = useCallback((params: DeleteConfirmState) => {
    setDeleteConfirm(params);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    const action = deleteConfirm?.onConfirm;
    setDeleteConfirm(null);
    if (!action) {
      return;
    }

    void Promise.resolve(action());
  }, [deleteConfirm]);

  const applyLoadedWorkspaceState = useCallback((state: Report8DWorkspaceState) => {
    const nextState = mergeWorkspaceStateWithBaseline(state, baselineState, workspaceKey);
    setWorkspaceState(nextState);
    lastSavedPayloadRef.current = JSON.stringify(nextState);
    hasShownSaveFailureRef.current = false;
    setLoadError(null);
    setSyncStatusLabel(formatSyncLabel("云端已同步", nextState.updatedAt));
    setSyncStatusTone("saved");
  }, [baselineState, workspaceKey]);

  const buildEmptyCaseState = useCallback((reportId: string) => {
    const nextState = buildInitialState(workspaceKey, projectName, productName?.trim() || "", stableMoldNumbers, reportId);
    return {
      ...nextState,
      headerFields: {
        ...nextState.headerFields,
        currentStatus: "D0 建案与问题定义",
      },
    };
  }, [stableMoldNumbers, productName, projectName, workspaceKey]);

  const eightDArchive = useEightDCaseArchive({
    workspaceKey,
    buildEmptyCaseState,
    onWorkspaceLoaded: applyLoadedWorkspaceState,
    onWorkspaceSaved: markWorkspaceSaved,
  });

  const applyRemoteState = useCallback((remoteState: Report8DWorkspaceState | null) => {
    const nextState = remoteState
      ? mergeWorkspaceStateWithBaseline(remoteState, baselineState, workspaceKey)
      : baselineState;
    setWorkspaceState(nextState);
    return JSON.stringify(nextState);
  }, [baselineState, workspaceKey]);

  const loadRemoteState = useCallback(async ({
    finishHydration = false,
    silent = false,
    skipIfLocalChanges = false,
  }: {
    finishHydration?: boolean;
    silent?: boolean;
    skipIfLocalChanges?: boolean;
  } = {}) => {
    if (syncInFlightRef.current) {
      return;
    }

    if (skipIfLocalChanges && statePayloadRef.current !== lastSavedPayloadRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    if (!silent) {
      setSyncStatusLabel("云端工作区同步中");
      setSyncStatusTone("saving");
    }

    try {
      const remoteState = await fetchReport8DRemoteWorkspaceState({ workspaceKey });
      if (!isMountedRef.current) {
        return;
      }

      const nextPayload = applyRemoteState(remoteState);
      lastSavedPayloadRef.current = nextPayload;
      hasShownSaveFailureRef.current = false;
      setLoadError(null);
      setSyncStatusLabel(
        remoteState?.updatedAt
          ? formatSyncLabel("云端已同步", remoteState.updatedAt)
          : "云端未发现现有 8D 工作区，已载入默认模板",
      );
      setSyncStatusTone(remoteState?.updatedAt ? "saved" : "neutral");
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to load 8D report state";
      setSyncStatusLabel("8D 工作区加载失败");
      setSyncStatusTone("error");

      if (finishHydration) {
        setLoadError(message);
      } else if (!silent) {
        toast.error(message);
      }
    } finally {
      syncInFlightRef.current = false;
      if (finishHydration && isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [applyRemoteState, workspaceKey]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsHydrating(true);
    setLoadError(null);
    void loadRemoteState({ finishHydration: true });

    return () => {
      isMountedRef.current = false;
    };
  }, [loadRemoteState]);

  useEffect(() => {
    if (isHydrating) {
      return;
    }

    if (statePayload === lastSavedPayloadRef.current) {
      return;
    }

    setSyncStatusLabel("8D 工作区保存中");
    setSyncStatusTone("saving");

    const timer = window.setTimeout(async () => {
      try {
        const result = await saveReport8DRemoteWorkspaceState(workspaceState);
        if (!isMountedRef.current) {
          return;
        }

        lastSavedPayloadRef.current = statePayload;
        hasShownSaveFailureRef.current = false;
        setSyncStatusLabel(formatSyncLabel("8D 工作区已保存", result.updatedAt));
        setSyncStatusTone("saved");
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        setSyncStatusLabel("8D 工作区保存失败");
        setSyncStatusTone("error");
        if (!hasShownSaveFailureRef.current) {
          toast.error(error instanceof Error ? error.message : "8D 工作区保存失败");
          hasShownSaveFailureRef.current = true;
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [isHydrating, statePayload, workspaceState]);

  useEffect(() => {
    const handleFocus = () => {
      if (suppressFocusSyncRef.current) {
        suppressFocusSyncRef.current = false;
        return;
      }

      if (document.visibilityState === "hidden") {
        return;
      }

      void loadRemoteState({ silent: true, skipIfLocalChanges: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [loadRemoteState]);

  const updateHeaderField = useCallback((field: keyof Report8DHeaderFields, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      headerFields: {
        ...current.headerFields,
        [field]: value,
      },
    }));
  }, []);

  const updateTeamMember = useCallback((id: string, field: keyof Report8DTeamMember, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      teamMembers: current.teamMembers.map((member) =>
        member.id === id ? { ...member, [field]: value } : member,
      ),
    }));
  }, []);

  const updateProblemItem = useCallback((id: string, field: keyof Report8DProblemItem, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      problemItems: current.problemItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  }, []);

  const updateContainmentAction = useCallback((
    id: string,
    field: keyof Report8DContainmentAction,
    value: string,
  ) => {
    setWorkspaceState((current) => ({
      ...current,
      containmentActions: current.containmentActions.map((action) =>
        action.id === id ? { ...action, [field]: value } : action,
      ),
    }));
  }, []);

  const updateRootCauseAnalysis = useCallback((value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d4: {
        ...current.d4,
        rootCauseAnalysis: value,
      },
    }));
  }, []);

  const updateVerificationRound = useCallback((id: string, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d4: {
        ...current.d4,
        verificationRounds: ensureVerificationRounds(current.d4.verificationRounds).map((item) =>
          item.id === id ? { ...item, verification: value } : item,
        ),
      },
    }));
  }, []);

  const addVerificationRound = useCallback(() => {
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d4: {
        ...workspaceStateRef.current.d4,
        verificationRounds: [...ensureVerificationRounds(workspaceStateRef.current.d4.verificationRounds), buildVerificationRound()],
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "新增验证轮次保存失败");
  }, [persistWorkspaceStateImmediately]);

  const removeVerificationRound = useCallback(async (id: string) => {
    const targetRound = verificationRounds.find((item) => item.id === id);
    if (targetRound) {
      await Promise.all(targetRound.images.map((imageUrl) => deleteAssetViaServer(imageUrl).catch(() => undefined)));
    }

    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d4: {
        ...workspaceStateRef.current.d4,
        verificationRounds: ensureVerificationRounds(workspaceStateRef.current.d4.verificationRounds).filter((item) => item.id !== id),
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "删除验证轮次保存失败");
  }, [persistWorkspaceStateImmediately, verificationRounds]);

  const handleVerificationImageUpload = useCallback(async (roundId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setUploadingVerificationRoundId(roundId);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const processedFile = await compressReport8DImage(file);
        const uploadResult = await uploadAssetViaServer({
          file: processedFile,
          category: "report-8d-root-cause-image",
          entityId: workspaceState.headerFields.reportNo || workspaceKey,
          slot: `${roundId}-${Date.now()}`,
        });
        uploadedUrls.push(uploadResult.url);
      }

      if (uploadedUrls.length === 0) {
        toast.error("请选择图片文件后再上传");
        return;
      }

      const nextState: Report8DWorkspaceState = {
        ...workspaceStateRef.current,
        d4: {
          ...workspaceStateRef.current.d4,
          verificationRounds: ensureVerificationRounds(workspaceStateRef.current.d4.verificationRounds).map((item) =>
            item.id === roundId ? { ...item, images: [...item.images, ...uploadedUrls] } : item,
          ),
        },
      };
      setWorkspaceState(nextState);
      await persistWorkspaceStateImmediately(nextState, "验证图片上传后保存失败");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "验证图片上传失败");
    } finally {
      setUploadingVerificationRoundId(null);
    }
  }, [persistWorkspaceStateImmediately, workspaceKey, workspaceState.headerFields.reportNo]);

  const removeVerificationImage = useCallback(async (roundId: string, imageUrl: string) => {
    await deleteAssetViaServer(imageUrl).catch(() => undefined);
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d4: {
        ...workspaceStateRef.current.d4,
        verificationRounds: ensureVerificationRounds(workspaceStateRef.current.d4.verificationRounds).map((item) =>
          item.id === roundId ? { ...item, images: item.images.filter((url) => url !== imageUrl) } : item,
        ),
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "删除验证图片保存失败");
  }, [persistWorkspaceStateImmediately]);

  const updateCorrectivePlan = useCallback((value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d5: {
        ...current.d5,
        correctivePlan: value,
      },
    }));
  }, []);

  const updateCorrectionRound = useCallback((id: string, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d5: {
        ...current.d5,
        correctionRounds: ensureCorrectionRounds(current.d5.correctionRounds).map((item) =>
          item.id === id ? { ...item, correction: value } : item,
        ),
      },
    }));
  }, []);

  const addCorrectionRound = useCallback(() => {
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d5: {
        ...workspaceStateRef.current.d5,
        correctionRounds: [...ensureCorrectionRounds(workspaceStateRef.current.d5.correctionRounds), buildCorrectionRound()],
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "新增纠正措施轮次保存失败");
  }, [persistWorkspaceStateImmediately]);

  const removeCorrectionRound = useCallback(async (id: string) => {
    const targetRound = correctionRounds.find((item) => item.id === id);
    if (targetRound) {
      await Promise.all(targetRound.images.map((imageUrl) => deleteAssetViaServer(imageUrl).catch(() => undefined)));
    }

    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d5: {
        ...workspaceStateRef.current.d5,
        correctionRounds: ensureCorrectionRounds(workspaceStateRef.current.d5.correctionRounds).filter((item) => item.id !== id),
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "删除纠正措施轮次保存失败");
  }, [correctionRounds, persistWorkspaceStateImmediately]);

  const handleCorrectionImageUpload = useCallback(async (roundId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setUploadingCorrectionRoundId(roundId);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const processedFile = await compressReport8DImage(file);
        const uploadResult = await uploadAssetViaServer({
          file: processedFile,
          category: "report-8d-corrective-action-image",
          entityId: workspaceState.headerFields.reportNo || workspaceKey,
          slot: `${roundId}-${Date.now()}`,
        });
        uploadedUrls.push(uploadResult.url);
      }

      if (uploadedUrls.length === 0) {
        toast.error("请选择图片文件后再上传");
        return;
      }

      const nextState: Report8DWorkspaceState = {
        ...workspaceStateRef.current,
        d5: {
          ...workspaceStateRef.current.d5,
          correctionRounds: ensureCorrectionRounds(workspaceStateRef.current.d5.correctionRounds).map((item) =>
            item.id === roundId ? { ...item, images: [...item.images, ...uploadedUrls] } : item,
          ),
        },
      };
      setWorkspaceState(nextState);
      await persistWorkspaceStateImmediately(nextState, "纠正措施图片上传后保存失败");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "纠正措施图片上传失败");
    } finally {
      setUploadingCorrectionRoundId(null);
    }
  }, [persistWorkspaceStateImmediately, workspaceKey, workspaceState.headerFields.reportNo]);

  const removeCorrectionImage = useCallback(async (roundId: string, imageUrl: string) => {
    await deleteAssetViaServer(imageUrl).catch(() => undefined);
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d5: {
        ...workspaceStateRef.current.d5,
        correctionRounds: ensureCorrectionRounds(workspaceStateRef.current.d5.correctionRounds).map((item) =>
          item.id === roundId ? { ...item, images: item.images.filter((url) => url !== imageUrl) } : item,
        ),
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "删除纠正措施图片保存失败");
  }, [persistWorkspaceStateImmediately]);

  const updateImplementationSummary = useCallback((value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d6: {
        ...current.d6,
        summary: value,
      },
    }));
  }, []);

  const updateImplementationRound = useCallback((id: string, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d6: {
        ...current.d6,
        implementationRounds: ensureImplementationRounds(current.d6.implementationRounds).map((item) =>
          item.id === id ? { ...item, implementation: value } : item,
        ),
      },
    }));
  }, []);

  const addImplementationRound = useCallback(() => {
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d6: {
        ...workspaceStateRef.current.d6,
        implementationRounds: [...ensureImplementationRounds(workspaceStateRef.current.d6.implementationRounds), buildImplementationRound()],
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "新增实施验证轮次保存失败");
  }, [persistWorkspaceStateImmediately]);

  const removeImplementationRound = useCallback(async (id: string) => {
    const targetRound = implementationRounds.find((item) => item.id === id);
    if (targetRound) {
      await Promise.all(targetRound.images.map((imageUrl) => deleteAssetViaServer(imageUrl).catch(() => undefined)));
    }

    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d6: {
        ...workspaceStateRef.current.d6,
        implementationRounds: ensureImplementationRounds(workspaceStateRef.current.d6.implementationRounds).filter((item) => item.id !== id),
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "删除实施验证轮次保存失败");
  }, [implementationRounds, persistWorkspaceStateImmediately]);

  const handleImplementationImageUpload = useCallback(async (roundId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setUploadingImplementationRoundId(roundId);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const processedFile = await compressReport8DImage(file);
        const uploadResult = await uploadAssetViaServer({
          file: processedFile,
          category: "report-8d-implementation-verification-image",
          entityId: workspaceState.headerFields.reportNo || workspaceKey,
          slot: `${roundId}-${Date.now()}`,
        });
        uploadedUrls.push(uploadResult.url);
      }

      if (uploadedUrls.length === 0) {
        toast.error("请选择图片文件后再上传");
        return;
      }

      const nextState: Report8DWorkspaceState = {
        ...workspaceStateRef.current,
        d6: {
          ...workspaceStateRef.current.d6,
          implementationRounds: ensureImplementationRounds(workspaceStateRef.current.d6.implementationRounds).map((item) =>
            item.id === roundId ? { ...item, images: [...item.images, ...uploadedUrls] } : item,
          ),
        },
      };
      setWorkspaceState(nextState);
      await persistWorkspaceStateImmediately(nextState, "实施验证图片上传后保存失败");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "实施验证图片上传失败");
    } finally {
      setUploadingImplementationRoundId(null);
    }
  }, [persistWorkspaceStateImmediately, workspaceKey, workspaceState.headerFields.reportNo]);

  const removeImplementationImage = useCallback(async (roundId: string, imageUrl: string) => {
    await deleteAssetViaServer(imageUrl).catch(() => undefined);
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      d6: {
        ...workspaceStateRef.current.d6,
        implementationRounds: ensureImplementationRounds(workspaceStateRef.current.d6.implementationRounds).map((item) =>
          item.id === roundId ? { ...item, images: item.images.filter((url) => url !== imageUrl) } : item,
        ),
      },
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "删除实施验证图片保存失败");
  }, [persistWorkspaceStateImmediately]);

  const updateSystemUpdate = useCallback((index: number, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d7: {
        ...current.d7,
        systemUpdates: current.d7.systemUpdates.map((item, itemIndex) =>
          itemIndex === index ? value : item,
        ),
      },
    }));
  }, []);

  const addTeamMember = useCallback(() => {
    setWorkspaceState((current) => ({
      ...current,
      teamMembers: [
        ...current.teamMembers,
        { id: createId("team"), name: "", department: "", role: "" },
      ],
    }));
  }, []);

  const addProblemItem = useCallback(() => {
    setWorkspaceState((current) => ({
      ...current,
      problemItems: [...current.problemItems, { id: createId("problem"), label: "", value: "" }],
    }));
  }, []);

  const addContainmentAction = useCallback(() => {
    setWorkspaceState((current) => ({
      ...current,
      containmentActions: [
        ...current.containmentActions,
        { id: createId("containment"), action: "", owner: "", date: "", status: "pending" },
      ],
    }));
  }, []);

  const addSystemUpdate = useCallback(() => {
    setWorkspaceState((current) => ({
      ...current,
      d7: {
        ...current.d7,
        systemUpdates: [...current.d7.systemUpdates, ""],
      },
    }));
  }, []);

  const removeTeamMember = useCallback((id: string) => {
    setWorkspaceState((current) => ({
      ...current,
      teamMembers: current.teamMembers.filter((member) => member.id !== id),
    }));
  }, []);

  const removeProblemItem = useCallback((id: string) => {
    setWorkspaceState((current) => ({
      ...current,
      problemItems: current.problemItems.filter((item) => item.id !== id),
    }));
  }, []);

  const removeContainmentAction = useCallback((id: string) => {
    setWorkspaceState((current) => ({
      ...current,
      containmentActions: current.containmentActions.filter((action) => action.id !== id),
    }));
  }, []);

  const removeSystemUpdate = useCallback((index: number) => {
    setWorkspaceState((current) => ({
      ...current,
      d7: {
        ...current.d7,
        systemUpdates: current.d7.systemUpdates.filter((_, itemIndex) => itemIndex !== index),
      },
    }));
  }, []);

  const updateOutputCutoff = useCallback((value: Report8DOutputCutoff) => {
    const nextState: Report8DWorkspaceState = {
      ...workspaceStateRef.current,
      outputCutoff: value,
    };
    setWorkspaceState(nextState);
    void persistWorkspaceStateImmediately(nextState, "8D 输出截断位置保存失败");
  }, [persistWorkspaceStateImmediately]);

  const applyUniversalTemplate = useCallback(() => {
    const confirmed = window.confirm("将用通用 8D 模板覆盖当前页面内容，并自动保存。是否继续？");
    if (!confirmed) {
      return;
    }

    setWorkspaceState(baselineState);
    toast.success("已套用通用 8D 模板");
  }, [baselineState]);

  const reportDocumentOptions = useMemo<Report8DDocumentOptions>(
    () => ({
      state: workspaceState,
      projectName,
      moldNumbers: stableMoldNumbers,
    }),
    [stableMoldNumbers, projectName, workspaceState],
  );

  const handleOpenPrintPreview = useCallback(() => {
    try {
      suppressFocusSyncRef.current = true;
      openReport8DPrintPreview(reportDocumentOptions);
      toast.success("8D 打印预览已打开");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "打印预览打开失败");
    }
  }, [reportDocumentOptions]);

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      suppressFocusSyncRef.current = true;
      await exportReport8DPdf(reportDocumentOptions);
      toast.success("8D PDF 已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "8D PDF 导出失败");
    } finally {
      setIsExportingPdf(false);
    }
  }, [reportDocumentOptions]);

  const handleStageSave = useCallback(async () => {
    setSyncStatusLabel("8D 工作区保存中");
    setSyncStatusTone("saving");

    try {
      const result = await eightDArchive.stageSave(workspaceState);
      setSyncStatusLabel(formatSyncLabel("8D 工作区已保存", result.updatedAt));
      setSyncStatusTone("saved");
      toast.success("8D 案件库已同步，索引状态已更新");
    } catch (error) {
      setSyncStatusLabel("8D 工作区保存失败");
      setSyncStatusTone("error");
      toast.error(error instanceof Error ? error.message : "8D 案件库同步失败");
    }
  }, [eightDArchive, workspaceState]);

  const handleSubmitReport = useCallback(async () => {
    setIsSubmittingReport(true);
    setSyncStatusLabel("8D 报告归档中");
    setSyncStatusTone("saving");

    try {
      const result = await submitReport8DWorkspaceState({
        state: workspaceState,
        projectName,
      });
      markWorkspaceSaved(workspaceState, result.submittedAt);
      await eightDArchive.refreshArchive();
      toast.success("8D 报告已归档入库，并写入数据库");
    } catch (error) {
      setSyncStatusLabel("8D 报告归档失败");
      setSyncStatusTone("error");
      toast.error(error instanceof Error ? error.message : "8D 报告归档失败");
    } finally {
      setIsSubmittingReport(false);
    }
  }, [eightDArchive, markWorkspaceSaved, projectName, workspaceState]);

  if (isHydrating) {
    return (
      <SyncStateView
        title="正在同步 8D 云端工作区"
        message="先从 OSS 读取当前模块对应的 8D 报告快照，确认远程状态后再开放编辑。"
      />
    );
  }

  if (loadError) {
    return (
      <SyncStateView
        title="8D 云端工作区加载失败"
        message={loadError}
        actionLabel="重新加载"
        onAction={() => {
          setIsHydrating(true);
          setLoadError(null);
          void loadRemoteState({ finishHydration: true });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-cyan-400/12 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(2,6,23,0.88))]">
        <div className="flex flex-col gap-5 p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">8D 纠正措施报告</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
                onClick={() => setIsArchiveDrawerOpen(true)}
              >
                <Archive className="h-4 w-4" />
                8D 案件库
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                onClick={applyUniversalTemplate}
                aria-label="套用通用模板"
                title="套用通用模板"
              >
                <Wrench className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                disabled={eightDArchive.isCaseSaving}
                onClick={handleStageSave}
              >
                <RefreshCw className={cn("h-4 w-4", eightDArchive.isCaseSaving && "animate-spin")} />
                更新同步
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                onClick={handleOpenPrintPreview}
              >
                <Printer className="h-4 w-4" />
                打印预览
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                disabled={isExportingPdf}
                onClick={handleExportPdf}
              >
                <FileDown className="h-4 w-4" />
                {isExportingPdf ? "导出中" : "导出 PDF"}
              </Button>
              <div className="min-w-[220px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">输出截断</div>
                <select
                  value={workspaceState.outputCutoff}
                  onChange={(event) => updateOutputCutoff(event.target.value as Report8DOutputCutoff)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none"
                >
                  {REPORT_8D_OUTPUT_CUTOFF_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryInput
              label="成品料号"
              value={workspaceState.headerFields.finishedPartNumber}
              onChange={(value) => updateHeaderField("finishedPartNumber", value)}
            />
            <SummaryInput
              label="成品名称"
              value={workspaceState.headerFields.finishedPartName}
              onChange={(value) => updateHeaderField("finishedPartName", value)}
            />
            <SummaryInput
              label="成品规格"
              value={workspaceState.headerFields.finishedPartSpec}
              onChange={(value) => updateHeaderField("finishedPartSpec", value)}
            />
            <SummaryInput
              label="异常部件"
              value={workspaceState.headerFields.abnormalPart}
              onChange={(value) => updateHeaderField("abnormalPart", value)}
            />
            <SummaryInput
              label="回复对象"
              value={workspaceState.headerFields.replyTo}
              onChange={(value) => updateHeaderField("replyTo", value)}
            />
            <SummaryInput
              label="报告主题"
              value={workspaceState.headerFields.reportSubject}
              danger
              onChange={(value) => updateHeaderField("reportSubject", value)}
            />
            <SummaryInput
              label="报告编号"
              value={workspaceState.headerFields.reportNo}
              mono
              onChange={(value) => updateHeaderField("reportNo", value)}
            />
            <SummaryInput
              label="报告日期"
              value={workspaceState.headerFields.reportDate || workspaceState.headerFields.dateOpened}
              mono
              onChange={(value) => {
                updateHeaderField("reportDate", value);
                updateHeaderField("dateOpened", value);
              }}
            />
          </div>
        </div>
      </div>

      <DisciplineSection code="D0" title="问题准备与紧急响应" action={<ShieldAlert className="h-5 w-5 text-cyan-300" />}>
        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">严重级别</label>
            <Input
              value={workspaceState.d0.severityLabel}
              onChange={(event) =>
                setWorkspaceState((current) => ({
                  ...current,
                  d0: { ...current.d0, severityLabel: event.target.value },
                }))
              }
              className="border-white/10 bg-white/[0.04] text-white"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">问题摘要</label>
            <Textarea
              value={workspaceState.d0.summary}
              onChange={(event) =>
                setWorkspaceState((current) => ({
                  ...current,
                  d0: { ...current.d0, summary: event.target.value },
                }))
              }
              className="min-h-24 border-white/10 bg-white/[0.04] text-white"
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">遏制说明</label>
          <Textarea
            value={workspaceState.d0.containment}
            onChange={(event) =>
              setWorkspaceState((current) => ({
                ...current,
                d0: { ...current.d0, containment: event.target.value },
              }))
            }
            className="min-h-24 border-white/10 bg-white/[0.04] text-white"
          />
        </div>
      </DisciplineSection>

      <DisciplineSection
        code="D1"
        title="团队组建"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addTeamMember}>
            <Plus className="h-4 w-4" />
            新增成员
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="border-white/8">
              <TableHead className="text-slate-300">姓名</TableHead>
              <TableHead className="text-slate-300">部门</TableHead>
              <TableHead className="text-slate-300">角色</TableHead>
              <TableHead className="w-[72px] text-slate-300">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaceState.teamMembers.map((member) => (
              <TableRow key={member.id} className="border-white/6 hover:bg-white/[0.03]">
                <TableCell><Input value={member.name} onChange={(e) => updateTeamMember(member.id, "name", e.target.value)} className="border-white/10 bg-white/[0.04] text-white" /></TableCell>
                <TableCell><Input value={member.department} onChange={(e) => updateTeamMember(member.id, "department", e.target.value)} className="border-white/10 bg-white/[0.04] text-white" /></TableCell>
                <TableCell><Input value={member.role} onChange={(e) => updateTeamMember(member.id, "role", e.target.value)} className="border-white/10 bg-white/[0.04] text-white" /></TableCell>
                <TableCell>
                  <IconButton
                    label="删除成员"
                    onClick={() =>
                      openDeleteConfirm({
                        title: "删除成员确认",
                        message: "确定要删除该团队成员吗？\n删除后会从当前 8D 工作区移除。",
                        onConfirm: () => removeTeamMember(member.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DisciplineSection>

      <DisciplineSection
        code="D2"
        title="问题描述 (5W2H)"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addProblemItem}>
            <Plus className="h-4 w-4" />
            新增条目
          </Button>
        }
      >
        <div className="grid gap-3">
          {workspaceState.problemItems.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-4 md:grid-cols-[160px_minmax(0,1fr)_48px]"
            >
              <Input
                value={item.label}
                onChange={(event) => updateProblemItem(item.id, "label", event.target.value)}
                className="border-white/10 bg-white/[0.04] text-cyan-100"
                placeholder="字段名"
              />
              <Textarea
                value={item.value}
                onChange={(event) => updateProblemItem(item.id, "value", event.target.value)}
                className={cn(FIXED_ROW_TEXTAREA_CLASS, "border-white/10 bg-white/[0.04] text-white")}
                placeholder="填写问题描述"
              />
              <div className="flex justify-end">
                <IconButton
                  label="删除条目"
                  onClick={() =>
                    openDeleteConfirm({
                      title: "删除问题条目确认",
                      message: "确定要删除该问题描述条目吗？\n删除后会从当前 8D 工作区移除。",
                      onConfirm: () => removeProblemItem(item.id),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </DisciplineSection>

      <DisciplineSection
        code="D3"
        title="临时遏制措施 (ICA)"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addContainmentAction}>
            <Plus className="h-4 w-4" />
            新增措施
          </Button>
        }
      >
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="border-white/8">
              <TableHead className="w-[56%] text-slate-300">措施</TableHead>
              <TableHead className="w-[156px] text-slate-300">责任人</TableHead>
              <TableHead className="w-[148px] text-slate-300">日期</TableHead>
              <TableHead className="w-[128px] text-slate-300">状态</TableHead>
              <TableHead className="w-[88px] text-slate-300">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaceState.containmentActions.map((action) => (
              <TableRow key={action.id} className="border-white/6 hover:bg-white/[0.03]">
                <TableCell className="align-top whitespace-normal">
                  <Textarea
                    value={action.action}
                    onChange={(event) => updateContainmentAction(action.id, "action", event.target.value)}
                    className={cn(FIXED_ROW_TEXTAREA_CLASS, "border-white/10 bg-white/[0.04] text-white")}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={action.owner} onChange={(e) => updateContainmentAction(action.id, "owner", e.target.value)} className="h-11 border-white/10 bg-white/[0.04] text-white" />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={action.date} onChange={(e) => updateContainmentAction(action.id, "date", e.target.value)} className="h-11 border-white/10 bg-white/[0.04] font-mono text-white" />
                </TableCell>
                <TableCell className="align-top">
                  <select
                    value={action.status}
                    onChange={(event) => updateContainmentAction(action.id, "status", event.target.value)}
                    className={cn(
                      "h-11 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm outline-none",
                      STATUS_STYLES[action.status].className,
                    )}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-950 text-white">
                        {STATUS_STYLES[option].label}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="align-top">
                  <IconButton
                    label="删除措施"
                    onClick={() =>
                      openDeleteConfirm({
                        title: "删除临时措施确认",
                        message: "确定要删除该临时遏制措施吗？\n删除后会从当前 8D 工作区移除。",
                        onConfirm: () => removeContainmentAction(action.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DisciplineSection>

      <DisciplineSection
        code="D4"
        title="根本原因分析"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addVerificationRound}>
            <Plus className="h-4 w-4" />
            新增轮次
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-300">原因分析</p>
                <p className="mt-1 text-xs text-slate-500">先在这里沉淀完整的根因判断、5 Why 路径、系统原因与关键证据。</p>
              </div>
              <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                Root Cause
              </div>
            </div>
            <Textarea
              value={workspaceState.d4.rootCauseAnalysis}
              onChange={(event) => updateRootCauseAnalysis(event.target.value)}
              className="min-h-48 border-white/10 bg-white/[0.04] text-white"
              placeholder="在这里集中填写根本原因分析、5 Why、鱼骨结论、系统原因与关键证据。"
            />
          </div>

          {verificationRounds.map((item, index) => {
            const verificationLabel = `验证${formatRoundIndexLabel(index)}`;
            const inputId = `report-8d-verification-image-${item.id}`;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.018))] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
                  <div>
                    <p className="text-base font-semibold text-rose-200">{verificationLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">左侧记录验证过程与结论，右侧归档对应图片证据。</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      Round {index + 1}
                    </div>
                    <IconButton
                      label={`删除${verificationLabel}`}
                      onClick={() =>
                        openDeleteConfirm({
                          title: `删除${verificationLabel}确认`,
                          message: `确定要删除${verificationLabel}吗？\n该轮次里的图片证据也会一并删除。`,
                          onConfirm: () => removeVerificationRound(item.id),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
                  <section className="flex min-w-0 flex-col rounded-2xl border border-white/8 bg-slate-950/45 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{verificationLabel}</p>
                      <span className="text-[11px] text-slate-500">文本记录</span>
                    </div>
                    <Textarea
                      value={item.verification}
                      onChange={(event) => updateVerificationRound(item.id, event.target.value)}
                      className="min-h-[260px] flex-1 border-white/10 bg-white/[0.04] text-white"
                      placeholder="填写该轮验证的方法、样本、实验数据、判定结果与结论。"
                    />
                  </section>

                  <section className="flex min-w-0 flex-col rounded-2xl border border-white/8 bg-slate-950/45 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{verificationLabel}图片</p>
                        <p className="mt-1 text-[11px] text-slate-500">点击缩略图可放大查看，按 Esc 退出。</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadingVerificationRoundId === item.id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            上传中
                          </span>
                        ) : null}
                        <label
                          htmlFor={inputId}
                          className="inline-flex h-9 cursor-pointer items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          添加图片
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onClick={() => {
                            suppressFocusSyncRef.current = true;
                          }}
                          onChange={(event) => {
                            void handleVerificationImageUpload(item.id, event);
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex min-h-[260px] flex-1 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-3">
                      {item.images.length > 0 ? (
                        <div className="grid w-full grid-cols-2 gap-3 self-stretch">
                          {item.images.map((imageUrl, imageIndex) => (
                            <div
                              key={`${item.id}-${imageIndex}`}
                              className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 text-left transition-transform hover:-translate-y-0.5"
                              onClick={() => setPreviewVerificationImageUrl(imageUrl)}
                            >
                              <img src={imageUrl} alt={`${verificationLabel}图片${imageIndex + 1}`} className="h-36 w-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1 text-xs text-slate-100">
                                  <ZoomIn className="h-3.5 w-3.5" />
                                  放大查看
                                </span>
                              </div>
                              <button
                                type="button"
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/85 text-slate-100 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteConfirm({
                                    title: "删除验证图片确认",
                                    message: "确定要删除这张验证图片吗？\n图片会从当前轮次和 OSS 中移除。",
                                    onConfirm: () => removeVerificationImage(item.id, imageUrl),
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex w-full flex-col items-center justify-center rounded-xl border border-white/6 bg-slate-950/30 px-4 text-center text-sm text-slate-500">
                          <span>暂无验证图片</span>
                          <span className="mt-1 text-xs text-slate-600">点击右上角“添加图片”上传。</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            );
          })}
          {verificationRounds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
              暂无验证轮次，点击右上角“新增轮次”继续添加。
            </div>
          ) : null}
        </div>
      </DisciplineSection>

      <DisciplineSection
        code="D5"
        title="改善措施 (PCA)"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addCorrectionRound}>
            <Plus className="h-4 w-4" />
            新增轮次
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-300">纠正措施</p>
                <p className="mt-1 text-xs text-slate-500">在这里沉淀永久措施、对象范围、责任边界、实施条件和固化要求。</p>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Corrective Action
              </div>
            </div>
            <Textarea
              value={workspaceState.d5.correctivePlan}
              onChange={(event) => updateCorrectivePlan(event.target.value)}
              className="min-h-48 border-white/10 bg-white/[0.04] text-white"
              placeholder="在这里集中填写改善措施、责任对象、参数范围、实施计划和标准化要求。"
            />
          </div>

          {correctionRounds.map((item, index) => {
            const correctionLabel = `措施${formatRoundIndexLabel(index)}`;
            const inputId = `report-8d-correction-image-${item.id}`;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.018))] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
                  <div>
                    <p className="text-base font-semibold text-emerald-200">{correctionLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">左侧记录实施动作与结论，右侧归档对应图片证据。</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      Round {index + 1}
                    </div>
                    <IconButton
                      label={`删除${correctionLabel}`}
                      onClick={() =>
                        openDeleteConfirm({
                          title: `删除${correctionLabel}确认`,
                          message: `确定要删除${correctionLabel}吗？\n该轮次里的图片证据也会一并删除。`,
                          onConfirm: () => removeCorrectionRound(item.id),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
                  <section className="flex min-w-0 flex-col rounded-2xl border border-white/8 bg-slate-950/45 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{correctionLabel}</p>
                      <span className="text-[11px] text-slate-500">文本记录</span>
                    </div>
                    <Textarea
                      value={item.correction}
                      onChange={(event) => updateCorrectionRound(item.id, event.target.value)}
                      className="min-h-[260px] flex-1 border-white/10 bg-white/[0.04] text-white"
                      placeholder="填写该轮纠正措施的实施动作、对象范围、完成证据、判定结果与结论。"
                    />
                  </section>

                  <section className="flex min-w-0 flex-col rounded-2xl border border-white/8 bg-slate-950/45 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{correctionLabel}图片</p>
                        <p className="mt-1 text-[11px] text-slate-500">点击缩略图可放大查看，按 Esc 退出。</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadingCorrectionRoundId === item.id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            上传中
                          </span>
                        ) : null}
                        <label
                          htmlFor={inputId}
                          className="inline-flex h-9 cursor-pointer items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          添加图片
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onClick={() => {
                            suppressFocusSyncRef.current = true;
                          }}
                          onChange={(event) => {
                            void handleCorrectionImageUpload(item.id, event);
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex min-h-[260px] flex-1 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-3">
                      {item.images.length > 0 ? (
                        <div className="grid w-full grid-cols-2 gap-3 self-stretch">
                          {item.images.map((imageUrl, imageIndex) => (
                            <div
                              key={`${item.id}-${imageIndex}`}
                              className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 text-left transition-transform hover:-translate-y-0.5"
                              onClick={() => setPreviewVerificationImageUrl(imageUrl)}
                            >
                              <img src={imageUrl} alt={`${correctionLabel}图片${imageIndex + 1}`} className="h-36 w-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1 text-xs text-slate-100">
                                  <ZoomIn className="h-3.5 w-3.5" />
                                  放大查看
                                </span>
                              </div>
                              <button
                                type="button"
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/85 text-slate-100 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteConfirm({
                                    title: "删除措施图片确认",
                                    message: "确定要删除这张措施图片吗？\n图片会从当前轮次和 OSS 中移除。",
                                    onConfirm: () => removeCorrectionImage(item.id, imageUrl),
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex w-full flex-col items-center justify-center rounded-xl border border-white/6 bg-slate-950/30 px-4 text-center text-sm text-slate-500">
                          <span>暂无措施图片</span>
                          <span className="mt-1 text-xs text-slate-600">点击右上角“添加图片”上传。</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            );
          })}
          {correctionRounds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
              暂无纠正措施轮次，点击右上角“新增轮次”继续添加。
            </div>
          ) : null}
        </div>
      </DisciplineSection>

      <DisciplineSection
        code="D6"
        title="效果验证"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addImplementationRound}>
            <Plus className="h-4 w-4" />
            新增轮次
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-300">效果验证</p>
                <p className="mt-1 text-xs text-slate-500">在这里沉淀验证范围、样本量、判定标准、验证周期和解除遏制条件。</p>
              </div>
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Verification
              </div>
            </div>
            <Textarea
              value={workspaceState.d6.summary}
              onChange={(event) => updateImplementationSummary(event.target.value)}
              className="min-h-48 border-white/10 bg-white/[0.04] text-white"
              placeholder="在这里集中填写永久措施的实施范围、样本量、验证方法、判定标准、验证周期和解除临时遏制条件。"
            />
          </div>

          {implementationRounds.map((item, index) => {
            const implementationLabel = `验证${formatRoundIndexLabel(index)}`;
            const inputId = `report-8d-implementation-image-${item.id}`;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.018))] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
                  <div>
                    <p className="text-base font-semibold text-cyan-200">{implementationLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">左侧记录验证过程与结论，右侧归档对应图片证据。</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      Round {index + 1}
                    </div>
                    <IconButton
                      label={`删除${implementationLabel}`}
                      onClick={() =>
                        openDeleteConfirm({
                          title: `删除${implementationLabel}确认`,
                          message: `确定要删除${implementationLabel}吗？\n该轮次里的图片证据也会一并删除。`,
                          onConfirm: () => removeImplementationRound(item.id),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
                  <section className="flex min-w-0 flex-col rounded-2xl border border-white/8 bg-slate-950/45 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{implementationLabel}</p>
                      <span className="text-[11px] text-slate-500">文本记录</span>
                    </div>
                    <Textarea
                      value={item.implementation}
                      onChange={(event) => updateImplementationRound(item.id, event.target.value)}
                      className="min-h-[260px] flex-1 border-white/10 bg-white/[0.04] text-white"
                      placeholder="填写该轮验证的方法、样本、实验数据、效果确认、副作用确认和结论。"
                    />
                  </section>

                  <section className="flex min-w-0 flex-col rounded-2xl border border-white/8 bg-slate-950/45 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{implementationLabel}图片</p>
                        <p className="mt-1 text-[11px] text-slate-500">点击缩略图可放大查看，按 Esc 退出。</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadingImplementationRoundId === item.id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            上传中
                          </span>
                        ) : null}
                        <label
                          htmlFor={inputId}
                          className="inline-flex h-9 cursor-pointer items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          添加图片
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onClick={() => {
                            suppressFocusSyncRef.current = true;
                          }}
                          onChange={(event) => {
                            void handleImplementationImageUpload(item.id, event);
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex min-h-[260px] flex-1 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-3">
                      {item.images.length > 0 ? (
                        <div className="grid w-full grid-cols-2 gap-3 self-stretch">
                          {item.images.map((imageUrl, imageIndex) => (
                            <div
                              key={`${item.id}-${imageIndex}`}
                              className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 text-left transition-transform hover:-translate-y-0.5"
                              onClick={() => setPreviewVerificationImageUrl(imageUrl)}
                            >
                              <img src={imageUrl} alt={`${implementationLabel}图片${imageIndex + 1}`} className="h-36 w-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-all group-hover:bg-slate-950/35 group-hover:opacity-100">
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1 text-xs text-slate-100">
                                  <ZoomIn className="h-3.5 w-3.5" />
                                  放大查看
                                </span>
                              </div>
                              <button
                                type="button"
                                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/85 text-slate-100 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteConfirm({
                                    title: "删除验证图片确认",
                                    message: "确定要删除这张实施验证图片吗？\n图片会从当前轮次和 OSS 中移除。",
                                    onConfirm: () => removeImplementationImage(item.id, imageUrl),
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex w-full flex-col items-center justify-center rounded-xl border border-white/6 bg-slate-950/30 px-4 text-center text-sm text-slate-500">
                          <span>暂无验证图片</span>
                          <span className="mt-1 text-xs text-slate-600">点击右上角“添加图片”上传。</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            );
          })}
          {implementationRounds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
              暂无实施验证轮次，点击右上角“新增轮次”继续添加。
            </div>
          ) : null}
        </div>
      </DisciplineSection>

      <DisciplineSection
        code="D7"
        title="防止再发 (系统更新)"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addSystemUpdate}>
            <Plus className="h-4 w-4" />
            新增回写项
          </Button>
        }
      >
        <div className="space-y-3">
          {workspaceState.d7.systemUpdates.map((item, index) => (
            <div key={`${index}-${item}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_48px]">
              <Input
                value={item}
                onChange={(event) => updateSystemUpdate(index, event.target.value)}
                className="border-white/10 bg-white/[0.04] text-white"
              />
              <div className="flex justify-end">
                  <IconButton
                    label="删除回写项"
                    onClick={() =>
                      openDeleteConfirm({
                        title: "删除回写项确认",
                        message: "确定要删除该系统回写项吗？\n删除后会从当前 8D 工作区移除。",
                        onConfirm: () => removeSystemUpdate(index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">横向展开与系统更新说明</label>
          <Textarea
            value={workspaceState.d7.rolloutNotes}
            onChange={(event) =>
              setWorkspaceState((current) => ({
                ...current,
                d7: { ...current.d7, rolloutNotes: event.target.value },
              }))
            }
            className="min-h-28 border-white/10 bg-white/[0.04] text-white"
          />
        </div>
      </DisciplineSection>

      <DisciplineSection code="D8" title="结案与团队认可" action={<Trophy className="h-5 w-5 text-cyan-300" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryInput
            label="客户确认日期"
            value={workspaceState.d8.customerClosureDate}
            mono
            onChange={(value) =>
              setWorkspaceState((current) => ({
                ...current,
                d8: { ...current.d8, customerClosureDate: value },
              }))
            }
          />
          <SummaryInput
            label="内部结案日期"
            value={workspaceState.d8.internalClosureDate}
            mono
            onChange={(value) =>
              setWorkspaceState((current) => ({
                ...current,
                d8: { ...current.d8, internalClosureDate: value },
              }))
            }
          />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">结案总结</label>
          <Textarea
            value={workspaceState.d8.closureSummary}
            onChange={(event) =>
              setWorkspaceState((current) => ({
                ...current,
                d8: { ...current.d8, closureSummary: event.target.value },
              }))
            }
            className="min-h-28 border-white/10 bg-white/[0.04] text-white"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">团队认可</label>
          <Textarea
            value={workspaceState.d8.recognition}
            onChange={(event) =>
              setWorkspaceState((current) => ({
                ...current,
                d8: { ...current.d8, recognition: event.target.value },
              }))
            }
            className="min-h-24 border-white/10 bg-white/[0.04] text-white"
          />
        </div>
      </DisciplineSection>

      <div className="rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.14),rgba(2,6,23,0.92))] p-5 shadow-[0_18px_54px_rgba(8,145,178,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-100">归档入库</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              归档后会同步 8D 案件库，并把当前报告完整内容写入系统数据库。
            </p>
          </div>
          <Button
            className="h-11 bg-cyan-500 px-6 text-slate-950 hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmittingReport}
            onClick={handleSubmitReport}
          >
            <SendHorizontal className={cn("h-4 w-4", isSubmittingReport && "animate-pulse")} />
            {isSubmittingReport ? "归档中" : "归档入库"}
          </Button>
        </div>
      </div>
      <EightDArchiveDrawer
        open={isArchiveDrawerOpen}
        onOpenChange={setIsArchiveDrawerOpen}
        projectName={projectName}
        reports={eightDArchive.reports}
        archiveMonth={eightDArchive.archiveMonth}
        archiveLimit={eightDArchive.archiveLimit}
        isLoading={eightDArchive.isArchiveLoading}
        isSaving={eightDArchive.isCaseSaving}
        loadingReportId={eightDArchive.loadingReportId}
        hasUnsavedChanges={hasUnsavedChanges}
        onRefresh={eightDArchive.refreshArchive}
        onArchiveMonthChange={eightDArchive.setArchiveMonth}
        onCreateCase={eightDArchive.createCase}
        onLoadCase={eightDArchive.loadCase}
      />
      {deleteConfirm ? (
        <CyberConfirmDialog
          open
          title={deleteConfirm.title}
          message={deleteConfirm.message}
          onCancel={closeDeleteConfirm}
          onConfirm={handleConfirmDelete}
          confirmText="确认删除"
          cancelText="取消"
          allowEnterConfirm={false}
        />
      ) : null}
      {previewVerificationImageUrl ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
          onClick={() => setPreviewVerificationImageUrl("")}
        >
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/85 text-slate-100 transition-colors hover:bg-slate-900"
            onClick={() => setPreviewVerificationImageUrl("")}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex max-h-[92vh] max-w-[92vw] items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewVerificationImageUrl}
              alt="验证图片预览"
              className="max-h-[92vh] max-w-[92vw] rounded-2xl border border-white/10 object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryInput({
  label,
  value,
  onChange,
  mono = false,
  danger = false,
  readOnly = false,
  className,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  mono?: boolean;
  danger?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-white/8 bg-white/[0.03] p-4", className)}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <Input
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={cn(
          "mt-2 border-white/10 bg-white/[0.04] text-slate-100",
          mono && "font-mono",
          danger && "text-rose-300",
          readOnly && "cursor-default opacity-80",
        )}
      />
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      {children}
    </button>
  );
}
