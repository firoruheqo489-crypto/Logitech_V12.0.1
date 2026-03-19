"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import imageCompression from "browser-image-compression";
import {
  Camera,
  Download,
  FileSpreadsheet,
  ImageIcon,
  Microscope,
  RotateCcw,
  RotateCw,
  ScanEye,
  Search,
  Settings2,
  Thermometer,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import { exportMoldTrialWorkbook } from "../lib/moldTrialExport";
import {
  loadMoldTrialEvidence,
  saveMoldTrialEvidence,
} from "../lib/moldTrialEvidenceStore";
import FaiParserSection from "./fai-parser";
import SurfaceParserSection from "./surface-parser";

type TrialStage = string;

interface TrialEvidenceSlot {
  id: string;
  label: string;
  imageUrl?: string;
  isUploadSlot?: boolean;
}

interface TrialSummaryCard {
  label: string;
  value: ReactNode;
}

interface TrialDataRow {
  label: string;
  value: ReactNode;
}

interface TrialStageData {
  summaryCards: TrialSummaryCard[];
  thermalSettings: TrialDataRow[];
  injectionProfile: TrialDataRow[];
  actuals: TrialDataRow[];
  evidenceLabels: string[];
}

interface MoldTrialDatabaseProps {
  moldId: string;
  moldNo?: string;
  embedded?: boolean;
}

const defaultTrialStages: TrialStage[] = ["T0", "T1", "T2", "T3"];
const trialStages = defaultTrialStages;
const MAX_EVIDENCE_SIZE_BYTES = 500 * 1024;
const EVIDENCE_SLOT_COUNT = 5;
const SHARED_EVIDENCE_SCOPE = "__shared__";

function buildEvidenceSlotLabel(index: number): string {
  return `证据 ${index + 1} / EVIDENCE ${index + 1}`;
}

function buildTrialStageStorageKey(moldId: string, moldNo?: string): string {
  return `mold-trial-stages:${moldId}:${moldNo || "default"}`;
}

function buildTrialEvidenceStorageKey(moldId: string, moldNo?: string): string {
  return `mold-trial-evidence:${moldId}:${moldNo || "default"}`;
}

function sanitizeTrialStages(value: unknown): TrialStage[] {
  if (!Array.isArray(value)) return [...defaultTrialStages];

  const uniqueStages = Array.from(
    new Set(
      value.filter(
        (stage): stage is string =>
          typeof stage === "string" && /^T\d+$/.test(stage)
      )
    )
  ).sort(
    (a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10)
  );

  if (uniqueStages.length === 0) return [...defaultTrialStages];

  const maxStageIndex = uniqueStages.reduce((maxIndex, stage) => {
    const match = stage.match(/^T(\d+)$/);
    if (!match) return maxIndex;
    return Math.max(maxIndex, Number.parseInt(match[1], 10));
  }, 0);

  return Array.from({ length: maxStageIndex + 1 }, (_, index) =>
    createTrialStageLabel(index)
  );
}

function readStoredTrialStages(moldId: string, moldNo?: string): TrialStage[] {
  if (typeof window === "undefined") {
    return [...defaultTrialStages];
  }

  try {
    const raw = window.localStorage.getItem(
      buildTrialStageStorageKey(moldId, moldNo)
    );
    if (!raw) return [...defaultTrialStages];
    return sanitizeTrialStages(JSON.parse(raw));
  } catch {
    return [...defaultTrialStages];
  }
}

function normalizeStoredEvidenceMap(
  value: unknown
): Record<string, TrialEvidenceSlot[]> {
  const fallback = buildEvidenceStateMap(defaultTrialStages);
  const parsed =
    value && typeof value === "object"
      ? (value as Record<string, TrialEvidenceSlot[]>)
      : undefined;
  const storedSlots = Array.isArray(parsed?.[SHARED_EVIDENCE_SCOPE])
    ? parsed[SHARED_EVIDENCE_SCOPE]
    : undefined;

  return {
    [SHARED_EVIDENCE_SCOPE]: normalizeEvidenceSlotsForStage(
      defaultTrialStages[0],
      storedSlots
    ),
  };
}

const trialStageData: Record<TrialStage, TrialStageData> = {
  T0: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-03-20" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-amber-400 font-bold">待验证 (PENDING)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "245-255-260-260 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "265 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "80 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "90 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "65 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "110 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "85 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "12.5 mm" },
      { label: "保压时间 / HOLD TIME", value: "4.5 s" },
      { label: "冷却时间 / COOLING TIME", value: "15.0 s" },
    ],
    actuals: [
      {
        label: "实际残料量 / MELT CUSHION ACTUAL",
        value: (
          <span className="text-rose-400 font-semibold">1.2 mm (偏小)</span>
        ),
      },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "138 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "82.0℃ / 88.5℃" },
      {
        label: "滑块实测 / SLIDER ACTUAL",
        value: (
          <span className="text-orange-400 font-semibold">95.2 ℃ (超温)</span>
        ),
      },
      { label: "浇口实测 / GATE ACTUAL", value: "65.4 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "32.0 s" },
    ],
    evidenceLabels: ["尺寸超差 / OVERSIZED", "结合线 / WELD LINE"],
  },
  T1: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-03-24" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: <span className="text-cyan-400 font-bold">改善中 (TUNING)</span>,
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "242-250-258-258 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "262 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "78 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "88 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "60 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "105 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "82 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "12.0 mm" },
      { label: "保压时间 / HOLD TIME", value: "4.2 s" },
      { label: "冷却时间 / COOLING TIME", value: "15.5 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "2.0 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "132 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "79.5℃ / 86.2℃" },
      {
        label: "滑块实测 / SLIDER ACTUAL",
        value: (
          <span className="text-amber-400 font-semibold">88.0 ℃ (临界)</span>
        ),
      },
      { label: "浇口实测 / GATE ACTUAL", value: "63.1 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "31.2 s" },
    ],
    evidenceLabels: ["飞边改善 / FLASH REDUCED", "滑块温升 / SLIDER HOTSPOT"],
  },
  T2: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-03-28" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-cyan-400 font-bold">验证中 (VERIFYING)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "240-248-255-255 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "260 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "76 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "86 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "58 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "103 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "80 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "11.8 mm" },
      { label: "保压时间 / HOLD TIME", value: "4.0 s" },
      { label: "冷却时间 / COOLING TIME", value: "16.0 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "2.4 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "128 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "77.2℃ / 84.8℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "82.4 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "61.5 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "30.8 s" },
    ],
    evidenceLabels: ["缩水点观察 / SINK TRACE", "分型面状态 / PARTING LINE"],
  },
  T3: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-04-02" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-cyan-400 font-bold">数据稳定 (STABLE)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "238-246-252-252 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "258 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "74 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "84 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "56 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "100 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "78 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "11.5 mm" },
      { label: "保压时间 / HOLD TIME", value: "3.8 s" },
      { label: "冷却时间 / COOLING TIME", value: "16.5 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "2.7 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "124 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "75.8℃ / 83.4℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "79.1 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "60.2 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "30.1 s" },
    ],
    evidenceLabels: ["焊痕趋势 / WELD TRACE", "滑块表面 / SLIDER FACE"],
  },
  T4: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-04-08" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-cyan-400 font-bold">小批验证 (PILOT)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "238-245-250-250 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "256 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "73 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "83 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "55 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "98 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "77 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "11.2 mm" },
      { label: "保压时间 / HOLD TIME", value: "3.7 s" },
      { label: "冷却时间 / COOLING TIME", value: "16.8 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "2.9 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "122 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "74.9℃ / 82.7℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "77.8 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "59.7 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "29.8 s" },
    ],
    evidenceLabels: ["尺寸窗口 / DIMENSION WINDOW", "顶白检查 / EJECTOR CHECK"],
  },
  T5: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-04-14" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-cyan-400 font-bold">量产预演 (RAMP-UP)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "236-244-248-248 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "255 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "72 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "82 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "54 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "97 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "76 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "11.0 mm" },
      { label: "保压时间 / HOLD TIME", value: "3.6 s" },
      { label: "冷却时间 / COOLING TIME", value: "17.0 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "3.0 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "120 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "74.2℃ / 82.1℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "76.5 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "58.9 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "29.6 s" },
    ],
    evidenceLabels: ["首件确认 / FIRST ARTICLE", "熔接线弱化 / WELD REDUCED"],
  },
  T6: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-04-18" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-cyan-400 font-bold">过程锁定 (LOCKED)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "236-243-247-247 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "254 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "72 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "81 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "53 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "96 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "75 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "10.9 mm" },
      { label: "保压时间 / HOLD TIME", value: "3.5 s" },
      { label: "冷却时间 / COOLING TIME", value: "17.1 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "3.1 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "119 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "73.8℃ / 81.9℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "75.9 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "58.2 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "29.4 s" },
    ],
    evidenceLabels: ["披锋封口 / FLASH CLOSED", "循环曲线 / CYCLE CURVE"],
  },
  T7: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-04-22" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-emerald-400 font-bold">
            通过预审 (APPROVED)
          </span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "235-242-246-246 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "253 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "71 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "81 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "52 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "95 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "74 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "10.8 mm" },
      { label: "保压时间 / HOLD TIME", value: "3.5 s" },
      { label: "冷却时间 / COOLING TIME", value: "17.2 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "3.2 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "118 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "73.6℃ / 81.5℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "75.2 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "57.9 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "29.2 s" },
    ],
    evidenceLabels: [
      "外观确认 / APPEARANCE OK",
      "尺寸复核 / DIMENSION RECHECK",
    ],
  },
  T8: {
    summaryCards: [
      { label: "试模日期 / DATE", value: "2026-04-28" },
      { label: "成型机台 / HAITIAN IMM", value: "MA 1600/540" },
      { label: "测试物料 / MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
      {
        label: "试模结论 / VERDICT",
        value: (
          <span className="text-emerald-400 font-bold">试模关闭 (CLOSED)</span>
        ),
      },
    ],
    thermalSettings: [
      {
        label: "料筒设定 (1~4段) / BARREL PROFILE",
        value: "235-242-245-245 ℃",
      },
      { label: "热流道设定 / HOT RUNNER (Z1~Z8)", value: "252 ℃" },
      { label: "前模温机设定 / CAVITY TCU", value: "71 ℃" },
      { label: "后模温机设定 / CORE TCU", value: "80 ℃" },
    ],
    injectionProfile: [
      { label: "射出速度 (均值) / INJ. SPEED", value: "52 %" },
      { label: "射出压力 (限制) / INJ. PRESSURE", value: "94 Bar" },
      { label: "保压压力 / HOLD PRESSURE", value: "74 Bar" },
      { label: "V/P 切换位置 / V/P SWITCH", value: "10.7 mm" },
      { label: "保压时间 / HOLD TIME", value: "3.4 s" },
      { label: "冷却时间 / COOLING TIME", value: "17.3 s" },
    ],
    actuals: [
      { label: "实际残料量 / MELT CUSHION ACTUAL", value: "3.2 mm" },
      { label: "实际峰值压力 / PEAK PRESS ACTUAL", value: "117 Bar" },
      { label: "前/后模表面实测 / CAV&COR ACTUAL", value: "73.4℃ / 81.2℃" },
      { label: "滑块实测 / SLIDER ACTUAL", value: "74.8 ℃" },
      { label: "浇口实测 / GATE ACTUAL", value: "57.5 ℃" },
      { label: "实际成型周期 / CYCLE TIME ACTUAL", value: "29.0 s" },
    ],
    evidenceLabels: ["量产签核 / MP SIGN-OFF", "终版外观 / FINAL COSMETIC"],
  },
};

function TAxisButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "bg-cyan-900/40 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)] px-4 py-1.5 rounded text-xs font-mono whitespace-nowrap border"
          : "bg-slate-900 border border-slate-700 text-slate-500 px-4 py-1.5 rounded text-xs font-mono whitespace-nowrap hover:border-slate-600 transition-colors"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-900/30 border border-slate-800/80 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">
        {label}
      </span>
      <span className="text-base font-mono text-slate-100">{value}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">
        {label}
      </span>
      <span className="text-base md:text-lg font-mono tabular-nums text-slate-100">
        {value}
      </span>
    </div>
  );
}

function TrialModuleHeading({
  titleCn,
  titleEn,
}: {
  titleCn: string;
  titleEn: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="h-px w-10 bg-slate-800/70" />
      <div className="text-left">
        <div className="text-sm font-semibold tracking-wide text-slate-100">
          {titleCn}
          <span className="mx-2 text-slate-500">/</span>
          <span className="text-slate-300">{titleEn}</span>
        </div>
      </div>
    </div>
  );
}

function UploadSlot({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="aspect-square border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 rounded-lg transition-colors gap-2 bg-slate-900/20"
      onClick={onClick}
    >
      <ImageIcon className="w-6 h-6 text-slate-600" />
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center px-3">
        添加图片 / ADD IMAGE
      </span>
    </div>
  );
}

function buildTrialEvidenceSlots(stage: TrialStage): TrialEvidenceSlot[] {
  return Array.from({ length: EVIDENCE_SLOT_COUNT }, (_, index) => ({
    id: `${stage}-slot-${index + 1}`,
    label: buildEvidenceSlotLabel(index),
    isUploadSlot: true,
  }));
}

function createTrialStageLabel(index: number): TrialStage {
  return `T${index}`;
}

function cloneTrialStageData(source: TrialStageData): TrialStageData {
  return {
    summaryCards: source.summaryCards.map(card => ({ ...card })),
    thermalSettings: source.thermalSettings.map(row => ({ ...row })),
    injectionProfile: source.injectionProfile.map(row => ({ ...row })),
    actuals: source.actuals.map(row => ({ ...row })),
    evidenceLabels: [...source.evidenceLabels],
  };
}

function buildDefaultTrialStageData(stage: TrialStage): TrialStageData {
  return cloneTrialStageData(trialStageData[stage] || trialStageData.T8);
}

function buildInitialTrialDataMap(
  stages: TrialStage[]
): Record<TrialStage, TrialStageData> {
  return stages.reduce(
    (acc, stage) => {
      acc[stage] = buildDefaultTrialStageData(stage);
      return acc;
    },
    {} as Record<TrialStage, TrialStageData>
  );
}

function buildEvidenceStateMap(
  _: TrialStage[]
): Record<string, TrialEvidenceSlot[]> {
  return {
    [SHARED_EVIDENCE_SCOPE]: buildTrialEvidenceSlots(defaultTrialStages[0]),
  };
}

function normalizeEvidenceSlotsForStage(
  stage: TrialStage,
  slots?: TrialEvidenceSlot[]
): TrialEvidenceSlot[] {
  const baseSlots = buildTrialEvidenceSlots(stage);

  return baseSlots.map((baseSlot, index) => {
    const existingSlot =
      slots?.find(slot => slot.id === baseSlot.id) || slots?.[index];

    if (!existingSlot) {
      return baseSlot;
    }

    return {
      ...baseSlot,
      ...existingSlot,
      id: baseSlot.id,
      label: existingSlot.label || baseSlot.label,
    };
  });
}

function buildClearedTrialStageDataFromSource(
  baseData: TrialStageData
): TrialStageData {
  return {
    summaryCards: baseData.summaryCards.map(card => ({
      ...card,
      value: "--",
    })),
    thermalSettings: baseData.thermalSettings.map(row => ({
      ...row,
      value: "--",
    })),
    injectionProfile: baseData.injectionProfile.map(row => ({
      ...row,
      value: "--",
    })),
    actuals: baseData.actuals.map(row => ({
      ...row,
      value: "--",
    })),
    evidenceLabels: [...baseData.evidenceLabels],
  };
}

function buildInitialEvidenceMap(
  stages: TrialStage[]
): Record<TrialStage, TrialEvidenceSlot[]> {
  return stages.reduce(
    (acc, stage) => {
      const labels = trialStageData[stage].evidenceLabels;
      acc[stage] = [
        {
          id: `${stage}-slot-1`,
          label: labels[0] || "证据 1 / EVIDENCE 1",
          isUploadSlot: true,
        },
        {
          id: `${stage}-slot-2`,
          label: labels[1] || "证据 2 / EVIDENCE 2",
          isUploadSlot: true,
        },
        {
          id: `${stage}-slot-3`,
          label: "证据 3 / EVIDENCE 3",
          isUploadSlot: true,
        },
        {
          id: `${stage}-slot-4`,
          label: "证据 4 / EVIDENCE 4",
          isUploadSlot: true,
        },
        {
          id: `${stage}-slot-5`,
          label: "证据 5 / EVIDENCE 5",
          isUploadSlot: true,
        },
        {
          id: `${stage}-slot-6`,
          label: "证据 6 / EVIDENCE 6",
          isUploadSlot: true,
        },
      ];
      return acc;
    },
    {} as Record<TrialStage, TrialEvidenceSlot[]>
  );
}

function normalizeEvidenceSlots(
  stage: TrialStage,
  slots?: TrialEvidenceSlot[]
): TrialEvidenceSlot[] {
  const baseSlots = buildTrialEvidenceSlots(stage);

  return baseSlots.map((baseSlot, index) => {
    const existingSlot =
      slots?.find(slot => slot.id === baseSlot.id) || slots?.[index];

    if (!existingSlot) {
      return baseSlot;
    }

    return {
      ...baseSlot,
      ...existingSlot,
      id: baseSlot.id,
      label: existingSlot.label || baseSlot.label,
    };
  });
}

function buildClearedTrialStageData(stage: TrialStage): TrialStageData {
  const baseData = buildDefaultTrialStageData(stage);

  return {
    summaryCards: baseData.summaryCards.map(card => ({
      ...card,
      value: "--",
    })),
    thermalSettings: baseData.thermalSettings.map(row => ({
      ...row,
      value: "--",
    })),
    injectionProfile: baseData.injectionProfile.map(row => ({
      ...row,
      value: "--",
    })),
    actuals: baseData.actuals.map(row => ({
      ...row,
      value: "--",
    })),
    evidenceLabels: baseData.evidenceLabels,
  };
}

function revokeEvidenceSlotUrls(
  evidenceMap: Record<TrialStage, TrialEvidenceSlot[]>
): void {
  Object.values(evidenceMap).forEach(slots => {
    slots.forEach(slot => {
      if (slot.imageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(slot.imageUrl);
      }
    });
  });
}

function extractNodeText(value: ReactNode): string {
  const text = Children.toArray(value)
    .map(node => {
      if (typeof node === "string" || typeof node === "number") {
        return String(node);
      }

      if (node === null || node === undefined || typeof node === "boolean") {
        return "";
      }

      if (isValidElement<{ children?: ReactNode }>(node)) {
        return extractNodeText(node.props.children);
      }

      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "--";
}

async function compressEvidenceImage(file: File): Promise<File> {
  if (file.size <= MAX_EVIDENCE_SIZE_BYTES) return file;

  const compressionSteps = [
    { maxWidthOrHeight: 1920, initialQuality: 0.82 },
    { maxWidthOrHeight: 1680, initialQuality: 0.74 },
    { maxWidthOrHeight: 1440, initialQuality: 0.66 },
    { maxWidthOrHeight: 1280, initialQuality: 0.58 },
    { maxWidthOrHeight: 1080, initialQuality: 0.5 },
    { maxWidthOrHeight: 920, initialQuality: 0.42 },
    { maxWidthOrHeight: 760, initialQuality: 0.34 },
    { maxWidthOrHeight: 640, initialQuality: 0.28 },
  ];
  let compressed = file;

  for (const step of compressionSteps) {
    compressed = await imageCompression(compressed, {
      maxSizeMB: 0.47,
      maxWidthOrHeight: step.maxWidthOrHeight,
      useWebWorker: true,
      initialQuality: step.initialQuality,
      maxIteration: 20,
      fileType: "image/webp",
    });

    if (compressed.size <= MAX_EVIDENCE_SIZE_BYTES) {
      return compressed;
    }
  }

  if (compressed.size > MAX_EVIDENCE_SIZE_BYTES) {
    throw new Error("图片压缩后仍超过 500KB，请更换一张更清晰或更小的图片");
  }

  return compressed;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.trim()) {
        resolve(result);
        return;
      }

      reject(new Error("图片读取失败"));
    };

    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export default function MoldTrialDatabase({
  moldId,
  moldNo,
  embedded = false,
}: MoldTrialDatabaseProps) {
  const initialTrialStages = readStoredTrialStages(moldId, moldNo);

  const [trialStagesState, setTrialStagesState] = useState<TrialStage[]>(() => [
    ...initialTrialStages,
  ]);
  const [activeTrial, setActiveTrial] = useState<TrialStage>(
    initialTrialStages[0] || defaultTrialStages[0]
  );
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [trialDataByStage, setTrialDataByStage] = useState<
    Record<TrialStage, TrialStageData>
  >(() => buildInitialTrialDataMap(initialTrialStages));
  const [evidenceByTrial, setEvidenceByTrial] = useState<
    Record<string, TrialEvidenceSlot[]>
  >(() => buildEvidenceStateMap(defaultTrialStages));
  const evidenceByTrialRef = useRef<Record<string, TrialEvidenceSlot[]>>(
    buildEvidenceStateMap(defaultTrialStages)
  );
  const [pendingUploadSlotId, setPendingUploadSlotId] = useState<string | null>(
    null
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedEvidenceSlotId, setSelectedEvidenceSlotId] = useState<
    string | null
  >(null);
  const [isEvidenceLightboxOpen, setIsEvidenceLightboxOpen] = useState(false);
  const [evidenceLightboxUrl, setEvidenceLightboxUrl] = useState("");
  const [evidenceLightboxRotation, setEvidenceLightboxRotation] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const trialStageStorageKey = buildTrialStageStorageKey(moldId, moldNo);
  const trialEvidenceStorageKey = buildTrialEvidenceStorageKey(moldId, moldNo);
  const trialDataMap = trialDataByStage;
  const currentData =
    trialDataMap[activeTrial] || buildDefaultTrialStageData(activeTrial);
  const currentEvidenceSlots = normalizeEvidenceSlotsForStage(
    activeTrial,
    evidenceByTrial[SHARED_EVIDENCE_SCOPE]
  );
  const activeEvidenceSlot =
    currentEvidenceSlots.find(
      slot => slot.id === selectedEvidenceSlotId && slot.imageUrl
    ) ||
    currentEvidenceSlots.find(slot => slot.imageUrl) ||
    currentEvidenceSlots[0];
  const activeEvidenceImageUrl = activeEvidenceSlot?.imageUrl || "";
  const lastTrialStage = trialStagesState[trialStagesState.length - 1];
  const canDeleteActiveTrial =
    trialStagesState.length > 1 && activeTrial === lastTrialStage;

  useEffect(() => {
    evidenceByTrialRef.current = evidenceByTrial;
  }, [evidenceByTrial]);

  useEffect(() => {
    if (
      selectedEvidenceSlotId &&
      currentEvidenceSlots.some(
        slot => slot.id === selectedEvidenceSlotId && !!slot.imageUrl
      )
    ) {
      return;
    }

    const nextSelectedSlotId =
      currentEvidenceSlots.find(slot => slot.imageUrl)?.id ||
      currentEvidenceSlots[0]?.id ||
      null;

    if (nextSelectedSlotId !== selectedEvidenceSlotId) {
      setSelectedEvidenceSlotId(nextSelectedSlotId);
    }
  }, [currentEvidenceSlots, selectedEvidenceSlotId]);

  useEffect(() => {
    const nextTrialStages = readStoredTrialStages(moldId, moldNo);
    const fallbackEvidence = buildEvidenceStateMap(defaultTrialStages);
    let cancelled = false;

    revokeEvidenceSlotUrls(evidenceByTrialRef.current);
    setTrialStagesState(nextTrialStages);
    setActiveTrial(nextTrialStages[0] || defaultTrialStages[0]);
    setTrialDataByStage(buildInitialTrialDataMap(nextTrialStages));
    setEvidenceByTrial(fallbackEvidence);
    evidenceByTrialRef.current = fallbackEvidence;
    setPendingUploadSlotId(null);
    setShowClearConfirm(false);
    slotInputRefs.current = {};

    void (async () => {
      try {
        let storedEvidence = await loadMoldTrialEvidence<Record<string, TrialEvidenceSlot[]>>(
          trialEvidenceStorageKey
        );

        if (!storedEvidence && typeof window !== "undefined") {
          const legacyRaw = window.localStorage.getItem(trialEvidenceStorageKey);
          if (legacyRaw) {
            storedEvidence = JSON.parse(legacyRaw) as Record<string, TrialEvidenceSlot[]>;
            await saveMoldTrialEvidence(trialEvidenceStorageKey, storedEvidence);
            window.localStorage.removeItem(trialEvidenceStorageKey);
          }
        }

        if (cancelled || !storedEvidence) return;

        const normalizedEvidence = normalizeStoredEvidenceMap(storedEvidence);
        setEvidenceByTrial(normalizedEvidence);
        evidenceByTrialRef.current = normalizedEvidence;
      } catch {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(trialEvidenceStorageKey);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [moldId, moldNo, trialEvidenceStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        trialStageStorageKey,
        JSON.stringify(trialStagesState)
      );
    } catch {
      // Ignore storage write failures and keep UI responsive.
    }
  }, [trialStageStorageKey, trialStagesState]);

  useEffect(() => {
    void (async () => {
      try {
        await saveMoldTrialEvidence(trialEvidenceStorageKey, evidenceByTrial);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(trialEvidenceStorageKey);
        }
      } catch {
        // Ignore storage write failures and keep UI responsive.
      }
    })();
  }, [evidenceByTrial, trialEvidenceStorageKey]);

  useEffect(() => {
    if (trialStagesState.length === 0) return;
    if (trialStagesState.includes(activeTrial)) return;
    setActiveTrial(trialStagesState[0]);
  }, [activeTrial, trialStagesState]);

  useEffect(() => {
    return () => {
      revokeEvidenceSlotUrls(evidenceByTrialRef.current);
    };
  }, []);

  const handleAddTrialStage = () => {
    const nextStageIndex =
      trialStagesState.reduce((maxIndex, stage) => {
        const match = stage.match(/^T(\d+)$/);
        if (!match) return maxIndex;
        return Math.max(maxIndex, Number.parseInt(match[1], 10));
      }, -1) + 1;
    const nextStage = createTrialStageLabel(nextStageIndex);

    setTrialStagesState(prev => [...prev, nextStage]);
    setTrialDataByStage(prev => ({
      ...prev,
      [nextStage]: buildDefaultTrialStageData(nextStage),
    }));
    setActiveTrial(nextStage);
  };

  const deleteCurrentTrialStage = () => {
    if (trialStagesState.length <= 1) {
      setShowClearConfirm(false);
      window.alert("至少保留一个试模轮次");
      return;
    }

    if (activeTrial !== lastTrialStage) {
      setShowClearConfirm(false);
      window.alert(
        `当前只能从最后轮次开始删除，请先切换到 ${lastTrialStage} 再执行删除。`
      );
      return;
    }

    const currentIndex = trialStagesState.indexOf(activeTrial);
    const nextActiveTrial =
      trialStagesState[currentIndex - 1] ||
      trialStagesState[currentIndex + 1] ||
      trialStagesState[0];

    setTrialStagesState(prev => prev.filter(stage => stage !== activeTrial));
    setTrialDataByStage(prev => {
      const next = { ...prev };
      delete next[activeTrial];
      return next;
    });
    setActiveTrial(nextActiveTrial);
    setShowClearConfirm(false);
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    console.log("触发 Excel 导入逻辑", file);
    event.target.value = "";
  };

  const handleEvidenceUpload = async (slotId: string, file?: File) => {
    if (!file) return;

    try {
      const processedFile = await compressEvidenceImage(file);
      const imageUrl = await readFileAsDataUrl(processedFile);
      setSelectedEvidenceSlotId(slotId);

      setEvidenceByTrial(prev => {
        const currentSlots = normalizeEvidenceSlotsForStage(
          activeTrial,
          prev[SHARED_EVIDENCE_SCOPE]
        );
        const nextSlots = currentSlots.map(slot => {
          if (slot.id !== slotId) return slot;
          if (slot.imageUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(slot.imageUrl);
          }
          return { ...slot, imageUrl };
        });

        return {
          ...prev,
          [SHARED_EVIDENCE_SCOPE]: nextSlots,
        };
      });
    } catch (error) {
      window.alert("图片处理失败，请稍后重试");
    }
  };

  const handleEvidenceDelete = (slotId: string) => {
    setEvidenceByTrial(prev => {
      const currentSlots = normalizeEvidenceSlotsForStage(
        activeTrial,
        prev[SHARED_EVIDENCE_SCOPE]
      );
      const nextSlots = currentSlots.map(slot => {
        if (slot.id !== slotId) return slot;
        if (slot.imageUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(slot.imageUrl);
        }
        return { ...slot, imageUrl: undefined };
      });

      return {
        ...prev,
        [SHARED_EVIDENCE_SCOPE]: nextSlots,
      };
    });

    if (activeEvidenceSlot?.id === slotId) {
      setSelectedEvidenceSlotId(null);
    }

    if (evidenceLightboxUrl) {
      const targetSlot = currentEvidenceSlots.find(slot => slot.id === slotId);
      if (targetSlot?.imageUrl === evidenceLightboxUrl) {
        setIsEvidenceLightboxOpen(false);
        setEvidenceLightboxUrl("");
        setEvidenceLightboxRotation(0);
      }
    }
  };

  const openEvidenceLightbox = (imageUrl: string) => {
    setEvidenceLightboxUrl(imageUrl);
    setEvidenceLightboxRotation(0);
    setIsEvidenceLightboxOpen(true);
  };

  const closeEvidenceLightbox = () => {
    setIsEvidenceLightboxOpen(false);
    setEvidenceLightboxUrl("");
    setEvidenceLightboxRotation(0);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);

    try {
      await exportMoldTrialWorkbook({
        moldId,
        moldNo,
        exportedAt: new Date().toLocaleString(),
        stages: trialStagesState.map(stage => {
          const stageData =
            trialDataByStage[stage] || buildDefaultTrialStageData(stage);
          const evidenceSlots = normalizeEvidenceSlotsForStage(
            stage,
            evidenceByTrial[SHARED_EVIDENCE_SCOPE]
          );

          return {
            stage,
            summaryCards: stageData.summaryCards.map(item => ({
              label: item.label,
              value: extractNodeText(item.value),
            })),
            thermalSettings: stageData.thermalSettings.map(item => ({
              label: item.label,
              value: extractNodeText(item.value),
            })),
            injectionProfile: stageData.injectionProfile.map(item => ({
              label: item.label,
              value: extractNodeText(item.value),
            })),
            actuals: stageData.actuals.map(item => ({
              label: item.label,
              value: extractNodeText(item.value),
            })),
            evidence: evidenceSlots.map((slot, index) => ({
              slot: `Slot ${index + 1}`,
              label: slot.label,
              imageUrl: slot.imageUrl || "--",
            })),
          };
        }),
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Excel 导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`flex flex-col gap-6 p-6 bg-slate-950 ${embedded ? "" : "min-h-screen"}`}
    >
      {/* SECTION 1: Header & Infinite T-Axis */}
      <section>
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Microscope className="w-5 h-5 text-cyan-500" />
            <h1 className="text-lg font-bold tracking-widest text-slate-100 uppercase">
              试模数据档案 / MOLD TRIAL DATABASE
            </h1>
            <span className="text-xs font-mono text-slate-500">
              {moldNo ? `${moldId} | ${moldNo}` : moldId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-800/50 px-3 py-1.5 rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleExportExcel();
              }}
              type="button"
              disabled={isExporting}
            >
              <Download className="w-4 h-4" />
              {isExporting ? "导出中" : "导出Excel"}
            </button>
            <button
              className="bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-500 border border-emerald-800/50 px-3 py-1.5 rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
              onClick={() => excelInputRef.current?.click()}
              type="button"
            >
              <FileSpreadsheet className="w-4 h-4" />
              导入机台参数
            </button>
            <button
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                canDeleteActiveTrial
                  ? "bg-rose-950/30 hover:bg-rose-900/50 text-rose-500 border border-rose-800/50"
                  : "bg-slate-900/60 text-slate-600 border border-slate-800 cursor-not-allowed"
              }`}
              onClick={() => {
                if (!canDeleteActiveTrial) {
                  window.alert(
                    `轮次删除必须从最后一轮开始。当前最后轮次为 ${lastTrialStage}。`
                  );
                  return;
                }
                setShowClearConfirm(true);
              }}
              type="button"
              disabled={!canDeleteActiveTrial}
              title={
                canDeleteActiveTrial
                  ? "删除当前最后轮次"
                  : `只能删除最后轮次 ${lastTrialStage}`
              }
            >
              <Trash2 className="w-4 h-4" />
              删除轮次
            </button>
          </div>
        </div>
        <div className="flex overflow-x-auto gap-2 pb-2 mt-4">
          {trialStagesState.map(stage => (
            <TAxisButton
              key={stage}
              label={stage}
              active={stage === activeTrial}
              onClick={() => setActiveTrial(stage)}
            />
          ))}
          <button
            className="bg-slate-900 border border-slate-700 text-cyan-400 px-4 py-1.5 rounded text-xs font-mono whitespace-nowrap hover:border-cyan-500 transition-colors"
            onClick={handleAddTrialStage}
            type="button"
          >
            +
          </button>
        </div>
      </section>

      {/* SECTION 2: Equipment & Material Base (4 Cards) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {currentData.summaryCards.map(card => (
          <InfoCard key={card.label} label={card.label} value={card.value} />
        ))}
      </section>

      <div className="my-5">
        <TrialModuleHeading titleCn="机台参数" titleEn="Machine Parameters" />
      </div>

      {/* SECTION 3: The 3-Column Engineering Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: THERMAL SETTINGS */}
        <div className="bg-[#050812]/80 border border-slate-800 rounded-xl p-5 shadow-inner flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              温度系统设定 / THERMAL SETTINGS
            </h2>
          </div>
          {currentData.thermalSettings.map(row => (
            <DataRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>

        {/* Column 2: INJECTION PROFILE */}
        <div className="bg-[#050812]/80 border border-slate-800 rounded-xl p-5 shadow-inner flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-4 h-4 text-cyan-500" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              成型参数设定 / INJECTION PROFILE
            </h2>
          </div>
          {currentData.injectionProfile.map(row => (
            <DataRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>

        {/* Column 3: ACTUALS & METROLOGY */}
        <div className="bg-slate-900/60 border border-cyan-900/50 rounded-xl p-5 relative overflow-hidden flex flex-col gap-3">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
          <div className="flex items-center gap-2 mb-2">
            <ScanEye className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              物理反馈实测 / ACTUALS & METROLOGY
            </h2>
          </div>
          {currentData.actuals.map(row => (
            <DataRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </section>

      <div className="my-5">
        <TrialModuleHeading titleCn="FAI尺寸" titleEn="FAI Dimensional Audit" />
      </div>
      <FaiParserSection
        moldId={moldId}
        moldNo={moldNo}
        trialStage={activeTrial}
      />

      <div className="my-5">
        <TrialModuleHeading titleCn="表面测试" titleEn="Surface Validation" />
      </div>
      <SurfaceParserSection
        moldId={moldId}
        moldNo={moldNo}
        trialStage={activeTrial}
      />

      <div className="my-5">
        <TrialModuleHeading titleCn="外观问题" titleEn="Appearance Issues" />
      </div>

      {/* SECTION 4: Defect Evidence Gallery */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-rose-500" />
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            试模缺陷与物理证据 / DEFECT EVIDENCE GALLERY
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {currentEvidenceSlots.map(slot => {
            const inputKey = `${activeTrial}-${slot.id}`;
            return (
              <div key={slot.id} className="flex flex-col">
                <div
                  className={`group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 border-dashed bg-slate-900/30 transition-all ${
                    slot.id === activeEvidenceSlot?.id
                      ? "border-cyan-500/70 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                      : "border-slate-700"
                  }`}
                >
                  <div
                    onClick={() => {
                      if (slot.imageUrl) {
                        setSelectedEvidenceSlotId(slot.id);
                      }
                    }}
                    className={`relative flex aspect-square items-center justify-center p-3 ${
                      slot.imageUrl ? "cursor-pointer" : ""
                    }`}
                  >
                    {slot.imageUrl ? (
                      <>
                        <img
                          src={slot.imageUrl}
                          alt={slot.label}
                          className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            setSelectedEvidenceSlotId(slot.id);
                            openEvidenceLightbox(slot.imageUrl || "");
                          }}
                          className="absolute right-3 top-3 rounded-full border border-slate-700 bg-slate-900/85 p-2 opacity-0 transition-opacity hover:bg-slate-800 group-hover:opacity-100"
                          aria-label="放大图片"
                          title="放大图片"
                        >
                          <Search className="h-3.5 w-3.5 text-slate-200" />
                        </button>
                      </>
                    ) : (
                      <UploadSlot
                        onClick={() => {
                          setPendingUploadSlotId(slot.id);
                          evidenceInputRef.current?.click();
                        }}
                      />
                    )}
                  </div>

                  <div className="border-t border-slate-800 bg-slate-900/70 p-1">
                    <div className="flex flex-nowrap items-center gap-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => slotInputRefs.current[inputKey]?.click()}
                        className="group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-slate-800"
                      >
                        <UploadCloud className="h-3.5 w-3.5 text-slate-500 group-hover/btn:text-cyan-400" />
                        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover/btn:text-cyan-100">
                          上传
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEvidenceDelete(slot.id)}
                        disabled={!slot.imageUrl}
                        className={`group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                          slot.imageUrl
                            ? "hover:bg-rose-950"
                            : "cursor-not-allowed opacity-45"
                        }`}
                      >
                        <Trash2
                          className={`h-3.5 w-3.5 ${
                            slot.imageUrl
                              ? "text-slate-500 group-hover/btn:text-rose-400"
                              : "text-slate-600"
                          }`}
                        />
                        <span
                          className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-widest ${
                            slot.imageUrl
                              ? "text-slate-400 group-hover/btn:text-rose-100"
                              : "text-slate-600"
                          }`}
                        >
                          删除
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <input
                  accept="image/*"
                  className="hidden"
                  ref={node => {
                    slotInputRefs.current[inputKey] = node;
                  }}
                  type="file"
                  onChange={e => {
                    void handleEvidenceUpload(slot.id, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>

      <input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        ref={excelInputRef}
        onChange={handleExcelUpload}
      />
      <CyberConfirmDialog
        open={showClearConfirm}
        title="删除轮次确认"
        message={`确定要删除当前 ${activeTrial} 轮次页面吗？删除后该轮次的参数快照将被移除，此操作不可撤销。`}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => {
          deleteCurrentTrialStage();
          console.log("删除当前轮次页面", activeTrial);
        }}
        confirmText="确认删除"
        cancelText="取消"
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={evidenceInputRef}
        onChange={e => {
          console.log("File selected", e.target.files);
          void handleEvidenceUpload(
            pendingUploadSlotId ||
              currentEvidenceSlots[0]?.id ||
              `${defaultTrialStages[0]}-slot-1`,
            e.target.files?.[0]
          );
          e.target.value = "";
        }}
      />
      {isEvidenceLightboxOpen && (
        <div
          onClick={closeEvidenceLightbox}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md"
        >
          <div
            className="flex max-w-[90vw] flex-col items-center"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex h-[85vh] w-[90vw] items-center justify-center overflow-hidden">
              <img
                src={evidenceLightboxUrl}
                alt="Evidence preview"
                className={`rounded-2xl border border-slate-700 object-contain shadow-2xl transition-transform duration-200 ${
                  Math.abs(evidenceLightboxRotation % 180) === 90
                    ? "max-h-[90vw] max-w-[85vh]"
                    : "max-h-full max-w-full"
                }`}
                style={{ transform: `rotate(${evidenceLightboxRotation}deg)` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setEvidenceLightboxRotation(prev => prev - 90)}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="向左旋转"
                title="向左旋转"
              >
                <RotateCcw className="h-5 w-5 text-slate-300" />
              </button>

              <button
                type="button"
                onClick={() => setEvidenceLightboxRotation(prev => prev + 90)}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="向右旋转"
                title="向右旋转"
              >
                <RotateCw className="h-5 w-5 text-slate-300" />
              </button>

              <button
                type="button"
                onClick={closeEvidenceLightbox}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="关闭预览"
                title="关闭预览"
              >
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
