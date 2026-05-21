import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FileDown,
  FolderOpen,
  Plus,
  Printer,
  RefreshCw,
  SearchCheck,
  SendHorizontal,
  ShieldAlert,
  Trash2,
  Trophy,
  Users2,
  Wrench,
} from "lucide-react";
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
import { useEightDCaseArchive } from "@/hooks/use-eight-d-case-archive";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REPORT_8D_WORKSPACE_KEY,
  fetchReport8DRemoteWorkspaceState,
  saveReport8DRemoteWorkspaceState,
  submitReport8DWorkspaceState,
  type Report8DContainmentAction,
  type Report8DCorrectiveAction,
  type Report8DHeaderFields,
  type Report8DProblemItem,
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

type InsightEditorProps = {
  title: string;
  accentClassName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

type Report8DDocumentOptions = {
  state: Report8DWorkspaceState;
  projectName: string;
  moldNumbers: string[];
};

const SAVE_DEBOUNCE_MS = 900;
const EMPTY_MOLD_NUMBERS: string[] = [];

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
    headerFields: {
      reportNo: reportId || `8D-${openedDate.replaceAll("-", "").slice(0, 6)}-${moldSuffix}`,
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
      occurrence:
        "发生根因：说明导致问题发生的物理、过程或管理原因。\n证据：列明样品、数据、实验、记录、照片、测量或复现结果。\n5 Why / 鱼骨结论：把直接原因追到可被系统控制的根因，不停留在“人员疏忽”。",
      escape:
        "逃逸根因：说明为什么现有检验、测试、审核、报警或评审没有拦住问题。\n控制缺口：列明频次、抽样、标准、设备、人员、系统或信息传递方面的漏洞。\n风险文件：确认 DFMEA / PFMEA / 控制计划是否遗漏或低估该失效模式。",
    },
    correctiveActions: [
      {
        id: createId("corrective"),
        action: "针对发生根因制定永久纠正措施，明确动作、对象、参数和实施范围。",
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

function joinLimited(items: string[], limit: number, fallback = "待填写"): string {
  const cleaned = items.map((item) => compactPrintText(item, "", 72)).filter(Boolean);
  if (cleaned.length === 0) {
    return fallback;
  }

  const visible = cleaned.slice(0, limit).join("；");
  const remaining = cleaned.length - limit;
  return remaining > 0 ? `${visible}；等 ${remaining} 项` : visible;
}

function formatTeamPreview(members: Report8DTeamMember[]): string {
  return joinLimited(
    members.map((member) =>
      [member.name, member.department, member.role].map((value) => value.trim()).filter(Boolean).join(" / "),
    ),
    4,
  );
}

function formatContainmentPreview(actions: Report8DContainmentAction[]): string[] {
  return actions.slice(0, 3).map((action, index) => {
    const status = STATUS_STYLES[action.status]?.label ?? action.status;
    return `${index + 1}. ${compactPrintText(action.action, "待填写措施", 58)} | ${compactPrintText(action.owner, "责任人", 18)} | ${status}`;
  });
}

function formatCorrectivePreview(actions: Report8DCorrectiveAction[]): string[] {
  return actions.slice(0, 3).map((action, index) =>
    `${index + 1}. ${compactPrintText(action.action, "待填写措施", 58)} | ${compactPrintText(action.type, "类型", 16)} | ${compactPrintText(action.owner, "责任人", 18)}`,
  );
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
      height: 297mm;
      overflow: hidden;
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

    .report-8d-print-field strong,
    .report-8d-print-box h2 {
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
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .report-8d-print-span-2 {
      grid-column: span 2;
    }

    .report-8d-print-span-4 {
      grid-column: span 4;
    }

    .report-8d-print-box {
      display: flex;
      gap: 1.4mm;
      min-height: 19.6mm;
      border: 0.65px solid #cbd5e1;
      border-left: 2.4mm solid #0f766e;
      border-radius: 1.2mm;
      padding: 1.25mm 1.5mm;
      break-inside: avoid;
      background: linear-gradient(90deg, #f8fafc 0, #ffffff 24mm);
    }

    .report-8d-print-box h2 {
      align-items: flex-start;
      color: #0f172a;
      display: flex;
      flex: 0 0 31mm;
      flex-direction: column;
      gap: 0.7mm;
      margin: 0;
      font-size: 8.5px;
      font-weight: 800;
      line-height: 1.12;
    }

    .report-8d-print-code {
      border: 0.6px solid #0f766e;
      border-radius: 1mm;
      color: #0f766e;
      display: inline-flex;
      font-size: 7.2px;
      font-weight: 800;
      justify-content: center;
      min-width: 8mm;
      padding: 0.25mm 1.1mm;
    }

    .report-8d-print-body {
      flex: 1 1 auto;
      min-width: 0;
    }

    .report-8d-print-copy {
      color: #1f2937;
      font-size: 7.9px;
      margin: 0;
    }

    .report-8d-print-muted {
      color: #64748b;
      font-size: 7.3px;
      margin: 0;
    }

    .report-8d-print-list {
      margin: 0;
      padding-left: 3.1mm;
    }

    .report-8d-print-list li {
      margin: 0 0 0.45mm;
      padding: 0;
    }

    .report-8d-print-table {
      border-collapse: collapse;
      table-layout: fixed;
      width: 100%;
    }

    .report-8d-print-table td,
    .report-8d-print-table th {
      border: 0.5px solid #cbd5e1;
      padding: 0.45mm 0.8mm;
      text-align: left;
      vertical-align: top;
    }

    .report-8d-print-table th {
      background: #f1f5f9;
      color: #334155;
      font-size: 6.7px;
      font-weight: 700;
      width: 22%;
    }

    .report-8d-print-clamp-1,
    .report-8d-print-clamp-2,
    .report-8d-print-clamp-3 {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
    }

    .report-8d-print-clamp-1 {
      -webkit-line-clamp: 1;
    }

    .report-8d-print-clamp-2 {
      -webkit-line-clamp: 2;
    }

    .report-8d-print-clamp-3 {
      -webkit-line-clamp: 3;
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
  return `<div class="report-8d-print-field${spanClass}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(compactPrintText(value, "待填写", span === 4 ? 160 : 64))}</span></div>`;
}

function buildPrintBox(code: string, title: string, content: string): string {
  return `<section class="report-8d-print-box"><h2><span class="report-8d-print-code">${escapeHtml(code)}</span>${escapeHtml(title)}</h2><div class="report-8d-print-body">${content}</div></section>`;
}

function buildReport8DDocumentMarkup({ state, projectName, moldNumbers }: Report8DDocumentOptions): string {
  const { headerFields } = state;
  const problemRows = state.problemItems.slice(0, 7);
  const containmentRows = formatContainmentPreview(state.containmentActions);
  const correctiveRows = formatCorrectivePreview(state.correctiveActions);
  const verificationPreview = joinLimited(state.d6.verificationItems, 3);
  const systemUpdatePreview = joinLimited(state.d7.systemUpdates, 4);

  const problemTable = problemRows
    .map((item) => `
      <tr>
        <th>${escapeHtml(compactPrintText(item.label, "字段", 18))}</th>
        <td><span class="report-8d-print-clamp-1">${escapeHtml(compactPrintText(item.value, "待填写", 60))}</span></td>
      </tr>`)
    .join("");
  const containmentList = (containmentRows.length ? containmentRows : ["1. 待填写临时遏制措施"])
    .map((item) => `<li class="report-8d-print-clamp-1">${escapeHtml(item)}</li>`)
    .join("");
  const correctiveList = (correctiveRows.length ? correctiveRows : ["1. 待填写永久纠正措施"])
    .map((item) => `<li class="report-8d-print-clamp-1">${escapeHtml(item)}</li>`)
    .join("");

  return `
    <article class="report-8d-a4-page" aria-label="8D 报告 A4 页面">
      <div class="report-8d-print-title">
        <h1>8D 纠正措施报告</h1>
      </div>

      <div class="report-8d-print-grid report-8d-print-header">
        ${buildPrintField("客户 / 部门", headerFields.customer)}
        ${buildPrintField("项目模块", projectName || "当前项目")}
        ${buildPrintField("产品对象", headerFields.product)}
        ${buildPrintField("责任人", headerFields.champion)}
        ${buildPrintField("关联模号", moldNumbers.length ? moldNumbers.join(" / ") : "未绑定模号", 2)}
        ${buildPrintField("开案日期", headerFields.dateOpened)}
        ${buildPrintField("当前状态", headerFields.currentStatus)}
        ${buildPrintField("异常主题", headerFields.defectIssue, 4)}
      </div>

      <div class="report-8d-d-flow">
        ${buildPrintBox(
          "D0",
          "问题准备与紧急响应",
          `<p class="report-8d-print-copy report-8d-print-clamp-2">严重级别：${escapeHtml(compactPrintText(state.d0.severityLabel, "待评估", 76))}</p>
           <p class="report-8d-print-copy report-8d-print-clamp-3">${escapeHtml(compactPrintText(state.d0.summary, "问题来源、影响范围、风险等级待填写", 150))}</p>`,
        )}
        ${buildPrintBox(
          "D1",
          "团队组建",
          `<p class="report-8d-print-copy report-8d-print-clamp-3">${escapeHtml(formatTeamPreview(state.teamMembers))}</p>`,
        )}
        ${buildPrintBox("D2", "问题描述 (5W2H)", `<table class="report-8d-print-table"><tbody>${problemTable}</tbody></table>`)}
        ${buildPrintBox(
          "D3",
          "临时遏制措施",
          `<p class="report-8d-print-copy report-8d-print-clamp-2">遏制说明：${escapeHtml(compactPrintText(state.d0.containment, "待填写", 95))}</p>
           <ul class="report-8d-print-list">${containmentList}</ul>`,
        )}
        ${buildPrintBox(
          "D4",
          "根本原因分析",
          `<p class="report-8d-print-copy report-8d-print-clamp-3">发生原因：${escapeHtml(compactPrintText(state.d4.occurrence, "待填写", 135))}</p>
           <p class="report-8d-print-copy report-8d-print-clamp-2">逃逸原因：${escapeHtml(compactPrintText(state.d4.escape, "待填写", 105))}</p>`,
        )}
        ${buildPrintBox("D5", "永久纠正措施", `<ul class="report-8d-print-list">${correctiveList}</ul>`)}
        ${buildPrintBox(
          "D6",
          "实施与验证",
          `<p class="report-8d-print-copy report-8d-print-clamp-2">验证摘要：${escapeHtml(compactPrintText(state.d6.summary, "待填写", 100))}</p>
           <p class="report-8d-print-copy report-8d-print-clamp-2">验证项：${escapeHtml(verificationPreview)}</p>
           <p class="report-8d-print-muted">状态：${escapeHtml(compactPrintText(state.d6.verifiedStatus, "待验证", 36))}；日期：${escapeHtml(compactPrintText(state.d6.verifiedAt, "待定", 18))}</p>`,
        )}
        ${buildPrintBox(
          "D7",
          "防止再发",
          `<p class="report-8d-print-copy report-8d-print-clamp-2">系统回写：${escapeHtml(systemUpdatePreview)}</p>
           <p class="report-8d-print-copy report-8d-print-clamp-2">横向展开：${escapeHtml(compactPrintText(state.d7.rolloutNotes, "待填写", 105))}</p>`,
        )}
        ${buildPrintBox(
          "D8",
          "结案与团队认可",
          `<p class="report-8d-print-copy report-8d-print-clamp-3">结案总结：${escapeHtml(compactPrintText(state.d8.closureSummary, "待填写", 135))}</p>
           <p class="report-8d-print-muted">客户确认：${escapeHtml(compactPrintText(state.d8.customerClosureDate, "待定", 18))}；内部结案：${escapeHtml(compactPrintText(state.d8.internalClosureDate, "待定", 18))}</p>`,
        )}
        ${buildPrintBox(
          "签核",
          "审批签核",
          `<div class="report-8d-print-sign"><div>编制</div><div>质量确认</div><div>责任部门</div><div>批准</div></div>
           <p class="report-8d-print-copy report-8d-print-clamp-2">团队认可：${escapeHtml(compactPrintText(state.d8.recognition, "记录团队贡献、客户反馈和后续复盘安排", 90))}</p>`,
        )}
      </div>
      <div class="report-8d-print-footer">本页为 8D 报告 A4 单页摘要，完整证据、记录和附件以系统工作区为准。</div>
    </article>
  `;
}

function buildReport8DFileName(state: Report8DWorkspaceState): string {
  const base = compactPrintText(state.headerFields.reportNo, "8D-report", 60)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  return `${base || "8D-report"}.pdf`;
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
            <div class="report-8d-preview-meta">单页 A4 摘要版，确认版式后再打印</div>
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
    pdf.addImage(canvas.toDataURL("image/png", 1), "PNG", 0, 0, 210, 297, "report-8d-a4", "FAST");

    while (pdf.getNumberOfPages() > 1) {
      pdf.deletePage(pdf.getNumberOfPages());
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
  const lastSavedPayloadRef = useRef("");
  const statePayloadRef = useRef("");
  const syncInFlightRef = useRef(false);
  const hasShownSaveFailureRef = useRef(false);

  const statePayload = useMemo(() => JSON.stringify(workspaceState), [workspaceState]);
  const hasUnsavedChanges = !isHydrating && statePayload !== lastSavedPayloadRef.current;

  useEffect(() => {
    statePayloadRef.current = statePayload;
  }, [statePayload]);

  const markWorkspaceSaved = useCallback((state: Report8DWorkspaceState, updatedAt?: string) => {
    const nextPayload = JSON.stringify(state);
    lastSavedPayloadRef.current = nextPayload;
    hasShownSaveFailureRef.current = false;
    setSyncStatusLabel(formatSyncLabel("8D 工作区已保存", updatedAt));
    setSyncStatusTone("saved");
  }, []);

  const applyLoadedWorkspaceState = useCallback((state: Report8DWorkspaceState) => {
    const nextState = {
      ...state,
      workspaceKey,
    };
    setWorkspaceState(nextState);
    lastSavedPayloadRef.current = JSON.stringify(nextState);
    hasShownSaveFailureRef.current = false;
    setLoadError(null);
    setSyncStatusLabel(formatSyncLabel("云端已同步", nextState.updatedAt));
    setSyncStatusTone("saved");
  }, [workspaceKey]);

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
    const nextState = remoteState ? { ...remoteState, workspaceKey } : baselineState;
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

  const updateCorrectiveAction = useCallback((
    id: string,
    field: keyof Report8DCorrectiveAction,
    value: string,
  ) => {
    setWorkspaceState((current) => ({
      ...current,
      correctiveActions: current.correctiveActions.map((action) =>
        action.id === id ? { ...action, [field]: value } : action,
      ),
    }));
  }, []);

  const updateVerificationItem = useCallback((index: number, value: string) => {
    setWorkspaceState((current) => ({
      ...current,
      d6: {
        ...current.d6,
        verificationItems: current.d6.verificationItems.map((item, itemIndex) =>
          itemIndex === index ? value : item,
        ),
      },
    }));
  }, []);

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

  const addCorrectiveAction = useCallback(() => {
    setWorkspaceState((current) => ({
      ...current,
      correctiveActions: [
        ...current.correctiveActions,
        { id: createId("corrective"), action: "", type: "", owner: "", targetDate: "" },
      ],
    }));
  }, []);

  const addVerificationItem = useCallback(() => {
    setWorkspaceState((current) => ({
      ...current,
      d6: {
        ...current.d6,
        verificationItems: [...current.d6.verificationItems, ""],
      },
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

  const removeCorrectiveAction = useCallback((id: string) => {
    setWorkspaceState((current) => ({
      ...current,
      correctiveActions: current.correctiveActions.filter((action) => action.id !== id),
    }));
  }, []);

  const removeVerificationItem = useCallback((index: number) => {
    setWorkspaceState((current) => ({
      ...current,
      d6: {
        ...current.d6,
        verificationItems: current.d6.verificationItems.filter((_, itemIndex) => itemIndex !== index),
      },
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
      openReport8DPrintPreview(reportDocumentOptions);
      toast.success("8D 打印预览已打开");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "打印预览打开失败");
    }
  }, [reportDocumentOptions]);

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
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
      toast.success("8D 案卷已同步，索引状态已更新");
    } catch (error) {
      setSyncStatusLabel("8D 工作区保存失败");
      setSyncStatusTone("error");
      toast.error(error instanceof Error ? error.message : "8D 案卷同步失败");
    }
  }, [eightDArchive, workspaceState]);

  const handleSubmitReport = useCallback(async () => {
    setIsSubmittingReport(true);
    setSyncStatusLabel("8D 报告提交中");
    setSyncStatusTone("saving");

    try {
      const result = await submitReport8DWorkspaceState({
        state: workspaceState,
        projectName,
      });
      markWorkspaceSaved(workspaceState, result.submittedAt);
      await eightDArchive.refreshArchive();
      toast.success("8D 报告已提交并保存到数据库");
    } catch (error) {
      setSyncStatusLabel("8D 报告提交失败");
      setSyncStatusTone("error");
      toast.error(error instanceof Error ? error.message : "8D 报告提交失败");
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">8D 报告</Badge>
              </div>
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
                <FolderOpen className="h-4 w-4" />
                历史 8D 案卷
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
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryInput
              label="报告编号"
              value={workspaceState.headerFields.reportNo}
              mono
              onChange={(value) => updateHeaderField("reportNo", value)}
            />
            <SummaryInput
              label="项目模块"
              value={projectName}
              readOnly
            />
            <SummaryInput
              label="客户"
              value={workspaceState.headerFields.customer}
              onChange={(value) => updateHeaderField("customer", value)}
            />
            <SummaryInput
              label="产品对象"
              value={workspaceState.headerFields.product}
              onChange={(value) => updateHeaderField("product", value)}
            />
            <SummaryInput
              label="关联模号"
              value={stableMoldNumbers.length > 0 ? stableMoldNumbers.join(" / ") : "当前模块未绑定模号"}
              readOnly
            />
            <SummaryInput
              label="异常主题"
              value={workspaceState.headerFields.defectIssue}
              danger
              onChange={(value) => updateHeaderField("defectIssue", value)}
            />
            <SummaryInput
              label="开案日期"
              value={workspaceState.headerFields.dateOpened}
              mono
              onChange={(value) => updateHeaderField("dateOpened", value)}
            />
            <SummaryInput
              label="当前状态"
              value={workspaceState.headerFields.currentStatus}
              onChange={(value) => updateHeaderField("currentStatus", value)}
            />
            <SummaryInput
              label="责任人"
              value={workspaceState.headerFields.champion}
              onChange={(value) => updateHeaderField("champion", value)}
              className="xl:col-span-2"
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
                  <IconButton label="删除成员" onClick={() => removeTeamMember(member.id)}>
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
                className="min-h-20 border-white/10 bg-white/[0.04] text-white"
                placeholder="填写问题描述"
              />
              <div className="flex justify-end">
                <IconButton label="删除条目" onClick={() => removeProblemItem(item.id)}>
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
        <Table>
          <TableHeader>
            <TableRow className="border-white/8">
              <TableHead className="text-slate-300">措施</TableHead>
              <TableHead className="text-slate-300">责任人</TableHead>
              <TableHead className="text-slate-300">日期</TableHead>
              <TableHead className="text-slate-300">状态</TableHead>
              <TableHead className="w-[72px] text-slate-300">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaceState.containmentActions.map((action) => (
              <TableRow key={action.id} className="border-white/6 hover:bg-white/[0.03]">
                <TableCell className="align-top">
                  <Textarea
                    value={action.action}
                    onChange={(event) => updateContainmentAction(action.id, "action", event.target.value)}
                    className="min-h-20 border-white/10 bg-white/[0.04] text-white"
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={action.owner} onChange={(e) => updateContainmentAction(action.id, "owner", e.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
                </TableCell>
                <TableCell className="align-top">
                  <Input value={action.date} onChange={(e) => updateContainmentAction(action.id, "date", e.target.value)} className="border-white/10 bg-white/[0.04] font-mono text-white" />
                </TableCell>
                <TableCell className="align-top">
                  <select
                    value={action.status}
                    onChange={(event) => updateContainmentAction(action.id, "status", event.target.value)}
                    className={cn(
                      "h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm outline-none",
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
                  <IconButton label="删除措施" onClick={() => removeContainmentAction(action.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DisciplineSection>

      <DisciplineSection code="D4" title="根本原因分析" action={<SearchCheck className="h-5 w-5 text-cyan-300" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <InsightEditor
            title="发生原因"
            accentClassName="text-amber-300"
            value={workspaceState.d4.occurrence}
            onChange={(value) =>
              setWorkspaceState((current) => ({
                ...current,
                d4: { ...current.d4, occurrence: value },
              }))
            }
            placeholder="填写发生原因、5 Why、系统原因"
          />
          <InsightEditor
            title="逃逸原因"
            accentClassName="text-rose-300"
            value={workspaceState.d4.escape}
            onChange={(value) =>
              setWorkspaceState((current) => ({
                ...current,
                d4: { ...current.d4, escape: value },
              }))
            }
            placeholder="填写检测遗漏、过程缺陷、标准缺失"
          />
        </div>
      </DisciplineSection>

      <DisciplineSection
        code="D5"
        title="永久纠正措施 (PCA)"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addCorrectiveAction}>
            <Plus className="h-4 w-4" />
            新增措施
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="border-white/8">
              <TableHead className="text-slate-300">纠正措施</TableHead>
              <TableHead className="text-slate-300">类型</TableHead>
              <TableHead className="text-slate-300">责任人</TableHead>
              <TableHead className="text-slate-300">目标日期</TableHead>
              <TableHead className="w-[72px] text-slate-300">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaceState.correctiveActions.map((action) => (
              <TableRow key={action.id} className="border-white/6 hover:bg-white/[0.03]">
                <TableCell className="align-top"><Textarea value={action.action} onChange={(e) => updateCorrectiveAction(action.id, "action", e.target.value)} className="min-h-20 border-white/10 bg-white/[0.04] text-white" /></TableCell>
                <TableCell className="align-top"><Input value={action.type} onChange={(e) => updateCorrectiveAction(action.id, "type", e.target.value)} className="border-white/10 bg-white/[0.04] text-white" /></TableCell>
                <TableCell className="align-top"><Input value={action.owner} onChange={(e) => updateCorrectiveAction(action.id, "owner", e.target.value)} className="border-white/10 bg-white/[0.04] text-white" /></TableCell>
                <TableCell className="align-top"><Input value={action.targetDate} onChange={(e) => updateCorrectiveAction(action.id, "targetDate", e.target.value)} className="border-white/10 bg-white/[0.04] font-mono text-white" /></TableCell>
                <TableCell className="align-top">
                  <IconButton label="删除纠正措施" onClick={() => removeCorrectiveAction(action.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DisciplineSection>

      <DisciplineSection
        code="D6"
        title="实施与验证 PCA"
        action={
          <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100" onClick={addVerificationItem}>
            <Plus className="h-4 w-4" />
            新增验证项
          </Button>
        }
      >
        <div className="space-y-4 rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">验证摘要</label>
            <Textarea
              value={workspaceState.d6.summary}
              onChange={(event) =>
                setWorkspaceState((current) => ({
                  ...current,
                  d6: { ...current.d6, summary: event.target.value },
                }))
              }
              className="min-h-24 border-white/10 bg-white/[0.04] text-white"
            />
          </div>
          <div className="space-y-3">
            {workspaceState.d6.verificationItems.map((item, index) => (
              <div key={`${index}-${item}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_48px]">
                <Textarea
                  value={item}
                  onChange={(event) => updateVerificationItem(index, event.target.value)}
                  className="min-h-20 border-white/10 bg-white/[0.04] text-white"
                />
                <div className="flex justify-end">
                  <IconButton label="删除验证项" onClick={() => removeVerificationItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryInput
              label="验证状态"
              value={workspaceState.d6.verifiedStatus}
              onChange={(value) =>
                setWorkspaceState((current) => ({
                  ...current,
                  d6: { ...current.d6, verifiedStatus: value },
                }))
              }
            />
            <SummaryInput
              label="验证完成日期"
              value={workspaceState.d6.verifiedAt}
              mono
              onChange={(value) =>
                setWorkspaceState((current) => ({
                  ...current,
                  d6: { ...current.d6, verifiedAt: value },
                }))
              }
            />
          </div>
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
                <IconButton label="删除回写项" onClick={() => removeSystemUpdate(index)}>
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
            <p className="text-sm font-semibold text-cyan-100">提交 8D 报告</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              提交后会同步 OSS 案卷，并把当前 8D 完整内容保存到系统数据库。
            </p>
          </div>
          <Button
            className="h-11 bg-cyan-500 px-6 text-slate-950 hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmittingReport}
            onClick={handleSubmitReport}
          >
            <SendHorizontal className={cn("h-4 w-4", isSubmittingReport && "animate-pulse")} />
            {isSubmittingReport ? "提交中" : "提交 8D 报告"}
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

function InsightEditor({
  title,
  accentClassName,
  value,
  onChange,
  placeholder,
}: InsightEditorProps) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <p className={cn("mb-3 text-sm font-semibold", accentClassName)}>{title}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-52 border-white/10 bg-white/[0.04] text-white"
        placeholder={placeholder}
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
