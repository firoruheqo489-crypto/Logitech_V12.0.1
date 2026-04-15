"use client";

import {
	Fragment,
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
	ImageIcon,
	Microscope,
	RotateCcw,
	RotateCw,
	Trash2,
	UploadCloud,
	X,
} from "lucide-react";
import { toast } from "sonner";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import { deleteAssetViaServer, uploadAssetViaServer } from "@/lib/ossUpload";
import {
	loadMoldTrialEvidence,
	saveMoldTrialEvidence,
} from "../lib/moldTrialEvidenceStore";
import {
	fetchDashboardMoldTrialEvidenceState,
	saveDashboardMoldTrialEvidenceState,
} from "../lib/mold-trial-evidence-api";
import {
	fetchDashboardMachineSheetState,
	saveDashboardMachineSheetState,
} from "../lib/mold-trial-machine-sheet-api";
import PartFaiParserSection from "./part-fai-parser";
import SurfaceParserSection from "./surface-parser";
import ToolingFaiParserSection from "./tooling-fai-parser";

type TrialStage = string;

interface TrialEvidenceSlot {
	id: string;
	label: string;
	imageUrl?: string;
	isUploadSlot?: boolean;
}

interface TrialEvidenceStageState {
	slots: TrialEvidenceSlot[];
	groupNote: string;
	recordedAt: string | null;
}

interface TrialSummaryCard {
	labelCn: string;
	labelEn: string;
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

interface MoldTrialEvidenceStorageEnvelope {
	version: 3;
	stagesByScope: Record<string, TrialEvidenceStageState>;
}

const defaultTrialStages: TrialStage[] = ["T0"];
const trialStages = defaultTrialStages;
const MAX_EVIDENCE_SIZE_BYTES = 500 * 1024;
const EVIDENCE_SLOT_COUNT = 15;
const MOLD_TEMP_EVIDENCE_SLOT_COUNT = 5;
const DEFECT_EVIDENCE_SLOT_COUNT = 10;
const SHARED_EVIDENCE_SCOPE = "__shared__";

function buildEvidenceSlotLabel(index: number): string {
	return `证据 ${index + 1} / EVIDENCE ${index + 1}`;
}

function parseEvidenceSlotIndex(slotId: string): number {
	const match = slotId.match(/-slot-(\d+)$/);
	return match ? Number.parseInt(match[1], 10) : -1;
}

function buildTrialStageStorageKey(moldId: string, moldNo?: string): string {
	return `mold-trial-stages:${moldId}:${moldNo || "default"}`;
}

function buildTrialStageClearedStorageKey(
	moldId: string,
	moldNo?: string,
): string {
	return `mold-trial-cleared-stages:${moldId}:${moldNo || "default"}`;
}

function buildTrialEvidenceStorageKey(moldId: string, moldNo?: string): string {
	return `mold-trial-evidence:${moldId}:${moldNo || "default"}`;
}

function buildMachineSheetStorageKey(moldId: string, moldNo?: string): string {
	return `mold-trial-machine-sheet:${moldId}:${moldNo || "default"}`;
}

function normalizeStoredMachineSheetMap(
	value: unknown,
): Record<TrialStage, string> {
	if (!value || typeof value !== "object") return {};

	return Object.entries(value as Record<string, unknown>).reduce(
		(acc, [stage, imageUrl]) => {
			if (
				/^T\d+$/.test(stage) &&
				typeof imageUrl === "string" &&
				imageUrl.trim().length > 0
			) {
				acc[stage] = imageUrl.trim();
			}
			return acc;
		},
		{} as Record<TrialStage, string>,
	);
}

function sanitizeTrialStages(value: unknown): TrialStage[] {
	if (!Array.isArray(value)) return [...defaultTrialStages];

	const uniqueStages = Array.from(
		new Set(
			value.filter(
				(stage): stage is string =>
					typeof stage === "string" && /^T\d+$/.test(stage),
			),
		),
	).sort(
		(a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10),
	);

	if (uniqueStages.length === 0) return [...defaultTrialStages];

	const maxStageIndex = uniqueStages.reduce((maxIndex, stage) => {
		const match = stage.match(/^T(\d+)$/);
		if (!match) return maxIndex;
		return Math.max(maxIndex, Number.parseInt(match[1], 10));
	}, 0);

	return Array.from({ length: maxStageIndex + 1 }, (_, index) =>
		createTrialStageLabel(index),
	);
}

function readStoredTrialStages(moldId: string, moldNo?: string): TrialStage[] {
	if (typeof window === "undefined") {
		return [...defaultTrialStages];
	}

	try {
		const raw = window.localStorage.getItem(
			buildTrialStageStorageKey(moldId, moldNo),
		);
		if (!raw) return [...defaultTrialStages];
		return sanitizeTrialStages(JSON.parse(raw));
	} catch {
		return [...defaultTrialStages];
	}
}

function normalizeStoredClearedTrialStages(value: unknown): TrialStage[] {
	if (!Array.isArray(value)) return [];

	return Array.from(
		new Set(
			value.filter(
				(stage): stage is string =>
					typeof stage === "string" && /^T\d+$/.test(stage),
			),
		),
	).sort(
		(a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10),
	);
}

function readStoredClearedTrialStages(storageKey: string): TrialStage[] {
	if (typeof window === "undefined") {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) return [];
		return normalizeStoredClearedTrialStages(JSON.parse(raw));
	} catch {
		return [];
	}
}

function resolveClearedTrialStages(
	stages: TrialStage[],
	clearedStages: TrialStage[],
): TrialStage[] {
	const stageSet = new Set(stages);
	const filteredClearedStages = clearedStages.filter((stage) =>
		stageSet.has(stage),
	);
	return filteredClearedStages.length > 0
		? filteredClearedStages
		: [...stages];
}

function writeStoredTrialStages(
	storageKey: string,
	stages: TrialStage[],
): void {
	if (typeof window === "undefined") return;

	try {
		if (stages.length === 0) {
			window.localStorage.removeItem(storageKey);
			return;
		}

		window.localStorage.setItem(storageKey, JSON.stringify(stages));
	} catch {
		// Ignore storage write failures and keep the UI responsive.
	}
}

function writeStoredClearedTrialStages(
	storageKey: string,
	stages: TrialStage[],
): void {
	if (typeof window === "undefined") return;

	try {
		if (stages.length === 0) {
			window.localStorage.removeItem(storageKey);
			return;
		}

		window.localStorage.setItem(storageKey, JSON.stringify(stages));
	} catch {
		// Ignore storage write failures and keep the UI responsive.
	}
}

function isMoldTrialEvidenceStorageEnvelope(
	value: unknown,
): value is MoldTrialEvidenceStorageEnvelope {
	if (!value || typeof value !== "object") return false;

	const candidate = value as Partial<MoldTrialEvidenceStorageEnvelope>;
	return candidate.version === 3 && !!candidate.stagesByScope && typeof candidate.stagesByScope === "object";
}

function normalizeEvidenceGroupNote(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeRecordedAt(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const timestamp = new Date(value);
	if (Number.isNaN(timestamp.getTime())) return null;
	return timestamp.toISOString();
}

function formatRecordedAt(value: string | null): string {
	if (!value) return "--";

	const timestamp = new Date(value);
	if (Number.isNaN(timestamp.getTime())) return "--";

	const pad = (num: number) => String(num).padStart(2, "0");
	const year = timestamp.getFullYear();
	const month = pad(timestamp.getMonth() + 1);
	const day = pad(timestamp.getDate());
	const hours = pad(timestamp.getHours());
	const minutes = pad(timestamp.getMinutes());

	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

const trialStageData: Record<TrialStage, TrialStageData> = {
	T0: {
		summaryCards: [
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-03-20" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-amber-400 font-bold">待验证 (PENDING)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "245-255-260-260 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "265 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-03-24" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: <span className="text-cyan-400 font-bold">改善中 (TUNING)</span>,
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "242-250-258-258 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "262 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-03-28" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-cyan-400 font-bold">验证中 (VERIFYING)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "240-248-255-255 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "260 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-04-02" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-cyan-400 font-bold">数据稳定 (STABLE)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "238-246-252-252 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "258 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-04-08" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-cyan-400 font-bold">小批验证 (PILOT)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "238-245-250-250 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "256 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-04-14" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-cyan-400 font-bold">量产预演 (RAMP-UP)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "236-244-248-248 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "255 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-04-18" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-cyan-400 font-bold">过程锁定 (LOCKED)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "236-243-247-247 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "254 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-04-22" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-emerald-400 font-bold">
						通过预审 (APPROVED)
					</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "235-242-246-246 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "253 ℃" },
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
			{ labelCn: "试模日期", labelEn: "DATE", value: "2026-04-28" },
			{ labelCn: "成型机台", labelEn: "HAITIAN IMM", value: "MA 1600/540" },
			{ labelCn: "原料", labelEn: "MATERIAL", value: "PC/ABS (干燥 110℃ 4H)" },
			{
				labelCn: "试验技术员",
				labelEn: "TECHNICIAN",
				value: (
					<span className="text-emerald-400 font-bold">试模关闭 (CLOSED)</span>
				),
			},
		],
		thermalSettings: [
			{
				label: "料筒设定 / BARREL PROFILE",
				value: "235-242-245-245 ℃",
			},
			{ label: "热流道设定 / HOT RUNNER", value: "252 ℃" },
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
				<div className="text-base font-semibold tracking-wide text-slate-100 md:text-lg">
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
		summaryCards: source.summaryCards.map((card) => ({ ...card })),
		thermalSettings: source.thermalSettings.map((row) => ({ ...row })),
		injectionProfile: source.injectionProfile.map((row) => ({ ...row })),
		actuals: source.actuals.map((row) => ({ ...row })),
		evidenceLabels: [...source.evidenceLabels],
	};
}

function buildDefaultTrialStageData(stage: TrialStage): TrialStageData {
	return cloneTrialStageData(trialStageData[stage] || trialStageData.T8);
}

function buildInitialTrialDataMap(
	stages: TrialStage[],
	clearedStages: TrialStage[] = [],
): Record<TrialStage, TrialStageData> {
	const clearedStageSet = new Set(clearedStages);

	return stages.reduce(
		(acc, stage) => {
			acc[stage] = clearedStageSet.has(stage)
				? buildClearedTrialStageData(stage)
				: buildDefaultTrialStageData(stage);
			return acc;
		},
		{} as Record<TrialStage, TrialStageData>,
	);
}

function buildEvidenceStateMap(
	stages: TrialStage[],
): Record<TrialStage, TrialEvidenceStageState> {
	return stages.reduce(
		(acc, stage) => {
			acc[stage] = {
				slots: buildTrialEvidenceSlots(stage),
				groupNote: "",
				recordedAt: null,
			};
			return acc;
		},
		{} as Record<TrialStage, TrialEvidenceStageState>,
	);
}

function buildEmptyTrialEvidenceStageState(stage: TrialStage): TrialEvidenceStageState {
	return {
		slots: buildTrialEvidenceSlots(stage),
		groupNote: "",
		recordedAt: null,
	};
}

function normalizeEvidenceSlotsForStage(
	stage: TrialStage,
	slots?: TrialEvidenceSlot[],
): TrialEvidenceSlot[] {
	const baseSlots = buildTrialEvidenceSlots(stage);

	return baseSlots.map((baseSlot, index) => {
		const existingSlot =
			slots?.find((slot) => slot.id === baseSlot.id) || slots?.[index];

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

function normalizeEvidenceStageState(
	stage: TrialStage,
	value?: Partial<TrialEvidenceStageState> | TrialEvidenceSlot[] | null,
): TrialEvidenceStageState {
	const slots = Array.isArray(value)
		? value
		: Array.isArray(value?.slots)
			? value.slots
			: undefined;

	return {
		slots: normalizeEvidenceSlotsForStage(stage, slots),
		groupNote: normalizeEvidenceGroupNote(
			Array.isArray(value) ? "" : value?.groupNote,
		),
		recordedAt: Array.isArray(value)
			? null
			: normalizeRecordedAt(value?.recordedAt),
	};
}

function normalizeStoredEvidenceStateMap(
	value: unknown,
	stages: TrialStage[],
): Record<TrialStage, TrialEvidenceStageState> {
	const fallback = buildEvidenceStateMap(stages);
	if (!value || typeof value !== "object") return fallback;

	const parsed = value as Record<string, unknown> & {
		version?: unknown;
		stagesByScope?: Record<string, unknown>;
		slotsByScope?: Record<string, unknown>;
		groupNote?: unknown;
		recordedAt?: unknown;
	};

	if (parsed.version === 3 && parsed.stagesByScope && typeof parsed.stagesByScope === "object") {
		return stages.reduce(
			(acc, stage) => {
				const stageValue = parsed.stagesByScope?.[stage];
				acc[stage] = normalizeEvidenceStageState(stage, stageValue as Partial<TrialEvidenceStageState> | TrialEvidenceSlot[] | null | undefined);
				return acc;
			},
			{} as Record<TrialStage, TrialEvidenceStageState>,
		);
	}

	if (parsed.slotsByScope && typeof parsed.slotsByScope === "object") {
		const slotsByScope = parsed.slotsByScope;
		return stages.reduce(
			(acc, stage, index) => {
				const stageValue = slotsByScope[stage];
				const fallbackSlots =
					index === 0 ? slotsByScope[SHARED_EVIDENCE_SCOPE] : undefined;
				acc[stage] = normalizeEvidenceStageState(
					stage,
					(Array.isArray(stageValue) ? stageValue : fallbackSlots) as
						| TrialEvidenceSlot[]
						| undefined,
				);
				if (index === 0) {
					acc[stage].groupNote = normalizeEvidenceGroupNote(parsed.groupNote);
					acc[stage].recordedAt = normalizeRecordedAt(parsed.recordedAt);
				}
				return acc;
			},
			{} as Record<TrialStage, TrialEvidenceStageState>,
		);
	}

	const directStageMap = Object.entries(parsed).some(([key, valueItem]) => {
		return /^T\d+$/.test(key) && Array.isArray(valueItem);
	});

	if (directStageMap) {
		return stages.reduce(
			(acc, stage) => {
				const stageValue = parsed[stage];
				acc[stage] = normalizeEvidenceStageState(
					stage,
					Array.isArray(stageValue)
						? (stageValue as TrialEvidenceSlot[])
						: undefined,
				);
				return acc;
			},
			{} as Record<TrialStage, TrialEvidenceStageState>,
		);
	}

	return fallback;
}

function compactEvidenceSlotsWithinRange(
	slots: TrialEvidenceSlot[],
	startIndex: number,
	endIndex: number,
	deletedIndex: number,
): TrialEvidenceSlot[] {
	const nextSlots = slots.map((slot) => ({ ...slot }));

	for (let index = deletedIndex; index < endIndex - 1; index += 1) {
		nextSlots[index] = {
			...nextSlots[index],
			imageUrl: slots[index + 1]?.imageUrl,
		};
	}

	nextSlots[endIndex - 1] = {
		...nextSlots[endIndex - 1],
		imageUrl: undefined,
	};

	for (let index = startIndex; index < deletedIndex; index += 1) {
		nextSlots[index] = {
			...nextSlots[index],
			imageUrl: slots[index]?.imageUrl,
		};
	}

	return nextSlots;
}

function buildClearedTrialStageDataFromSource(
	baseData: TrialStageData,
): TrialStageData {
	return {
		summaryCards: baseData.summaryCards.map((card) => ({
			...card,
			value: "--",
		})),
		thermalSettings: baseData.thermalSettings.map((row) => ({
			...row,
			value: "--",
		})),
		injectionProfile: baseData.injectionProfile.map((row) => ({
			...row,
			value: "--",
		})),
		actuals: baseData.actuals.map((row) => ({
			...row,
			value: "--",
		})),
		evidenceLabels: [...baseData.evidenceLabels],
	};
}

function buildInitialEvidenceMap(
	stages: TrialStage[],
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
		{} as Record<TrialStage, TrialEvidenceSlot[]>,
	);
}

function normalizeEvidenceSlots(
	stage: TrialStage,
	slots?: TrialEvidenceSlot[],
): TrialEvidenceSlot[] {
	const baseSlots = buildTrialEvidenceSlots(stage);

	return baseSlots.map((baseSlot, index) => {
		const existingSlot =
			slots?.find((slot) => slot.id === baseSlot.id) || slots?.[index];

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
		summaryCards: baseData.summaryCards.map((card) => ({
			...card,
			value: "--",
		})),
		thermalSettings: baseData.thermalSettings.map((row) => ({
			...row,
			value: "--",
		})),
		injectionProfile: baseData.injectionProfile.map((row) => ({
			...row,
			value: "--",
		})),
		actuals: baseData.actuals.map((row) => ({
			...row,
			value: "--",
		})),
		evidenceLabels: baseData.evidenceLabels,
	};
}

function revokeEvidenceSlotUrls(
	evidenceMap: Record<TrialStage, TrialEvidenceStageState>,
): void {
	Object.values(evidenceMap).forEach((slots) => {
		slots.slots.forEach((slot) => {
			if (slot.imageUrl?.startsWith("blob:")) {
				URL.revokeObjectURL(slot.imageUrl);
			}
		});
	});
}

function extractNodeText(value: ReactNode): string {
	const text = Children.toArray(value)
		.map((node) => {
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

type WorkbookRow = unknown[];

interface ImportedMoldTrialWorkbookState {
	trialStagesState: TrialStage[];
	trialDataByStage: Record<TrialStage, TrialStageData>;
	evidenceSlots: TrialEvidenceSlot[];
}

function normalizeWorkbookCell(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number") return String(value).trim();
	if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
	return "";
}

function isBlankWorkbookRow(row: WorkbookRow): boolean {
	return row.every((cell) => normalizeWorkbookCell(cell) === "");
}

function findWorkbookSectionIndex(rows: WorkbookRow[], title: string): number {
	return rows.findIndex((row) => normalizeWorkbookCell(row[0]) === title);
}

function collectWorkbookSectionRows(
	rows: WorkbookRow[],
	sectionTitle: string,
	stopTitles: string[],
): WorkbookRow[] {
	const startIndex = findWorkbookSectionIndex(rows, sectionTitle);
	if (startIndex < 0) return [];

	const collected: WorkbookRow[] = [];
	for (let index = startIndex + 1; index < rows.length; index += 1) {
		const row = rows[index] || [];
		const label = normalizeWorkbookCell(row[0]);
		const second = normalizeWorkbookCell(row[1]);
		const third = normalizeWorkbookCell(row[2]);

		if (isBlankWorkbookRow(row)) break;
		if (stopTitles.includes(label)) break;
		if (label === "Label" && second === "Value") continue;
		if (label === "Slot" && second === "Label" && third === "Image URL")
			continue;

		collected.push(row);
	}

	return collected;
}

function mapWorkbookSectionValues(rows: WorkbookRow[]): Map<string, string> {
	return new Map(
		rows
			.map(
				(row) =>
					[
						normalizeWorkbookCell(row[0]),
						normalizeWorkbookCell(row[1]),
					] as const,
			)
			.filter(([label]) => label.length > 0),
	);
}

function getWorkbookValue(
	values: Map<string, string>,
	label: string,
	aliases: string[] = [],
): string | undefined {
	return (
		values.get(label) ||
		aliases.map((alias) => values.get(alias)).find((value) => !!value)
	);
}

function parseWorkbookEvidenceSlots(rows: WorkbookRow[]): TrialEvidenceSlot[] {
	const baseSlots = buildTrialEvidenceSlots(defaultTrialStages[0]);
	const parsedRows = collectWorkbookSectionRows(rows, "Evidence", []);

	return baseSlots.map((slot, index) => {
		const row = parsedRows[index];
		const label = normalizeWorkbookCell(row?.[1]) || slot.label;
		const imageUrl = normalizeWorkbookCell(row?.[2]);

		return {
			...slot,
			label,
			imageUrl: imageUrl && imageUrl !== "--" ? imageUrl : undefined,
		};
	});
}

function parseWorkbookStageData(
	stage: TrialStage,
	rows: WorkbookRow[],
): TrialStageData {
	const baseData = buildDefaultTrialStageData(stage);
	const summaryValues = mapWorkbookSectionValues(
		collectWorkbookSectionRows(rows, "Summary", [
			"Thermal Settings",
			"Injection Profile",
			"Actuals & Metrology",
			"Evidence",
		]),
	);
	const thermalValues = mapWorkbookSectionValues(
		collectWorkbookSectionRows(rows, "Thermal Settings", [
			"Injection Profile",
			"Actuals & Metrology",
			"Evidence",
		]),
	);
	const injectionValues = mapWorkbookSectionValues(
		collectWorkbookSectionRows(rows, "Injection Profile", [
			"Actuals & Metrology",
			"Evidence",
		]),
	);
	const actualValues = mapWorkbookSectionValues(
		collectWorkbookSectionRows(rows, "Actuals & Metrology", ["Evidence"]),
	);

	return {
		summaryCards: baseData.summaryCards.map((card) => ({
			...card,
			value:
				getWorkbookValue(
					summaryValues,
					card.labelCn,
					card.labelCn === "试验技术员"
						? ["试模结论"]
						: card.labelCn === "原料"
							? ["测试物料"]
							: [],
				) || extractNodeText(card.value),
		})),
		thermalSettings: baseData.thermalSettings.map((row) => ({
			...row,
			value: thermalValues.get(row.label) || extractNodeText(row.value),
		})),
		injectionProfile: baseData.injectionProfile.map((row) => ({
			...row,
			value: injectionValues.get(row.label) || extractNodeText(row.value),
		})),
		actuals: baseData.actuals.map((row) => ({
			...row,
			value: actualValues.get(row.label) || extractNodeText(row.value),
		})),
		evidenceLabels: [...baseData.evidenceLabels],
	};
}

async function parseImportedMoldTrialWorkbook(
	file: File,
): Promise<ImportedMoldTrialWorkbookState> {
	const XLSX = await import("xlsx");
	const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
	const stageNames = workbook.SheetNames.filter((name) =>
		/^T\d+$/.test(name),
	).sort(
		(a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10),
	);

	if (stageNames.length === 0) {
		throw new Error("未找到可导入的试模轮次工作表");
	}

	const trialDataByStage = stageNames.reduce(
		(acc, stageName) => {
			const sheet = workbook.Sheets[stageName];
			if (!sheet) return acc;

			const rows = XLSX.utils.sheet_to_json(sheet, {
				header: 1,
				defval: "",
			}) as WorkbookRow[];
			acc[stageName] = parseWorkbookStageData(stageName, rows);
			return acc;
		},
		{} as Record<TrialStage, TrialStageData>,
	);

	const evidenceSheet =
		workbook.Sheets[stageNames[0]] ||
		workbook.Sheets[workbook.SheetNames[0] || ""];
	const evidenceRows = evidenceSheet
		? (XLSX.utils.sheet_to_json(evidenceSheet, {
				header: 1,
				defval: "",
			}) as WorkbookRow[])
		: [];

	return {
		trialStagesState: stageNames,
		trialDataByStage,
		evidenceSlots: parseWorkbookEvidenceSlots(evidenceRows),
	};
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

export default function MoldTrialDatabase({
	moldId,
	moldNo,
	embedded = false,
}: MoldTrialDatabaseProps) {
	const trialStageStorageKey = buildTrialStageStorageKey(moldId, moldNo);
	const trialStageClearedStorageKey = buildTrialStageClearedStorageKey(
		moldId,
		moldNo,
	);
	const trialEvidenceStorageKey = buildTrialEvidenceStorageKey(moldId, moldNo);
	const machineSheetStorageKey = buildMachineSheetStorageKey(moldId, moldNo);
	const initialTrialStages = [...defaultTrialStages];
	const initialClearedTrialStages: TrialStage[] = [];

	const [trialStagesState, setTrialStagesState] = useState<TrialStage[]>(() => [
		...initialTrialStages,
	]);
	const [activeTrial, setActiveTrial] = useState<TrialStage>(
		initialTrialStages[0] || defaultTrialStages[0],
	);
	const excelInputRef = useRef<HTMLInputElement>(null);
	const evidenceInputRef = useRef<HTMLInputElement>(null);
	const machineSheetInputRef = useRef<HTMLInputElement>(null);
	const [trialDataByStage, setTrialDataByStage] = useState<
		Record<TrialStage, TrialStageData>
	>(() =>
		buildInitialTrialDataMap(initialTrialStages, initialClearedTrialStages),
	);
	const [clearedTrialStages, setClearedTrialStages] = useState<TrialStage[]>(
		initialClearedTrialStages,
	);
	const [evidenceByTrial, setEvidenceByTrial] = useState<
		Record<TrialStage, TrialEvidenceStageState>
	>(() => buildEvidenceStateMap(initialTrialStages));
	const [evidenceGroupNoteDraftByTrial, setEvidenceGroupNoteDraftByTrial] =
		useState<Record<TrialStage, string>>(() =>
			initialTrialStages.reduce(
				(acc, stage) => {
					acc[stage] = "";
					return acc;
				},
				{} as Record<TrialStage, string>,
			),
		);
	const [isImportingExcel, setIsImportingExcel] = useState(false);
	const evidenceByTrialRef = useRef<Record<TrialStage, TrialEvidenceStageState>>(
		buildEvidenceStateMap(initialTrialStages),
	);
	const [pendingUploadSlotId, setPendingUploadSlotId] = useState<string | null>(
		null,
	);
	const [showClearMachineConfirm, setShowClearMachineConfirm] = useState(false);
	const [pendingClearMachineTrial, setPendingClearMachineTrial] =
		useState<TrialStage | null>(null);
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [pendingDeleteEvidenceSlotId, setPendingDeleteEvidenceSlotId] =
		useState<string | null>(null);
	const [showDeleteGroupNoteConfirm, setShowDeleteGroupNoteConfirm] =
		useState(false);
	const [showClearMachineSheetConfirm, setShowClearMachineSheetConfirm] =
		useState(false);
	const [pendingClearMachineSheetTrial, setPendingClearMachineSheetTrial] =
		useState<TrialStage | null>(null);
	const [machineSheetByTrial, setMachineSheetByTrial] = useState<
		Record<TrialStage, string>
	>({});
	const machineSheetByTrialRef = useRef<Record<TrialStage, string>>({});
	const canPersistEvidenceRef = useRef(false);
	const canPersistTrialStateRef = useRef(false);
	const [isEvidenceHydrated, setIsEvidenceHydrated] = useState(false);
	const [isTrialStateHydrated, setIsTrialStateHydrated] = useState(false);
	const [isMachineSheetHydrated, setIsMachineSheetHydrated] = useState(false);
	const [isUploadingMachineSheet, setIsUploadingMachineSheet] = useState(false);
	const [isEvidenceDropActive, setIsEvidenceDropActive] = useState(false);
	const [selectedEvidenceSlotId, setSelectedEvidenceSlotId] = useState<
		string | null
	>(null);
	const [isEvidenceLightboxOpen, setIsEvidenceLightboxOpen] = useState(false);
	const [evidenceLightboxUrl, setEvidenceLightboxUrl] = useState("");
	const [evidenceLightboxRotation, setEvidenceLightboxRotation] = useState(0);
	const currentEvidenceState =
		evidenceByTrial[activeTrial] || buildEmptyTrialEvidenceStageState(activeTrial);
	const currentEvidenceSlots = normalizeEvidenceSlotsForStage(
		activeTrial,
		currentEvidenceState.slots,
	);
	const activeEvidenceSlot =
		currentEvidenceSlots.find(
			(slot) => slot.id === selectedEvidenceSlotId && slot.imageUrl,
		) ||
		currentEvidenceSlots.find((slot) => slot.imageUrl) ||
		currentEvidenceSlots[0];
	const activeEvidenceImageUrl = activeEvidenceSlot?.imageUrl || "";
	const evidenceSlotsWithImages = currentEvidenceSlots.filter(
		(slot) => !!slot.imageUrl,
	);
	const moldTempEvidenceSlots = currentEvidenceSlots.slice(0, 5);
	const defectEvidenceSlots = currentEvidenceSlots.slice(5, 15);
	const activeMachineSheetUrl = machineSheetByTrial[activeTrial] || "";
	const trialScopeKey = `${moldId}:${moldNo || "default"}:${activeTrial}`;
	const evidenceAssetEntityId = moldNo ? `${moldId}__${moldNo}` : moldId;
	const evidenceDropDepthRef = useRef(0);
	const lastTrialStage = trialStagesState[trialStagesState.length - 1];
	const canDeleteActiveTrial =
		trialStagesState.length > 1 && activeTrial === lastTrialStage;
	const hasSavedEvidenceGroupNote =
		currentEvidenceState.groupNote.trim().length > 0 &&
		!!currentEvidenceState.recordedAt;
	const evidenceGroupNoteDraft =
		evidenceGroupNoteDraftByTrial[activeTrial] ?? currentEvidenceState.groupNote;

	useEffect(() => {
		evidenceByTrialRef.current = evidenceByTrial;
	}, [evidenceByTrial]);

	useEffect(() => {
		machineSheetByTrialRef.current = machineSheetByTrial;
	}, [machineSheetByTrial]);

	useEffect(() => {
		if (!isEvidenceDropActive) return;
		const handleWindowDrop = () => {
			evidenceDropDepthRef.current = 0;
			setIsEvidenceDropActive(false);
		};

		window.addEventListener("drop", handleWindowDrop);
		return () => {
			window.removeEventListener("drop", handleWindowDrop);
		};
	}, [isEvidenceDropActive]);

	useEffect(() => {
		if (
			selectedEvidenceSlotId &&
			currentEvidenceSlots.some(
				(slot) => slot.id === selectedEvidenceSlotId && !!slot.imageUrl,
			)
		) {
			return;
		}

		const nextSelectedSlotId =
			currentEvidenceSlots.find((slot) => slot.imageUrl)?.id ||
			currentEvidenceSlots[0]?.id ||
			null;

		if (nextSelectedSlotId !== selectedEvidenceSlotId) {
			setSelectedEvidenceSlotId(nextSelectedSlotId);
		}
	}, [currentEvidenceSlots, selectedEvidenceSlotId]);

	useEffect(() => {
		const baseTrialStages = [...defaultTrialStages];
		const baseClearedTrialStages: TrialStage[] = [];
		const fallbackEvidence = buildEvidenceStateMap(baseTrialStages);
		const fallbackEvidenceDrafts = baseTrialStages.reduce(
			(acc, stage) => {
				acc[stage] = "";
				return acc;
			},
			{} as Record<TrialStage, string>,
		);
		let cancelled = false;

		revokeEvidenceSlotUrls(evidenceByTrialRef.current);
		setTrialStagesState(baseTrialStages);
		setActiveTrial(baseTrialStages[0] || defaultTrialStages[0]);
		setTrialDataByStage(
			buildInitialTrialDataMap(baseTrialStages, baseClearedTrialStages),
		);
		setClearedTrialStages(baseClearedTrialStages);
		setEvidenceByTrial(fallbackEvidence);
		evidenceByTrialRef.current = fallbackEvidence;
		setEvidenceGroupNoteDraftByTrial(fallbackEvidenceDrafts);
		setShowDeleteGroupNoteConfirm(false);
		setShowClearMachineSheetConfirm(false);
		setPendingClearMachineSheetTrial(null);
		setPendingUploadSlotId(null);
		setShowClearConfirm(false);
		setPendingDeleteEvidenceSlotId(null);
		setMachineSheetByTrial({});
		machineSheetByTrialRef.current = {};
		canPersistEvidenceRef.current = false;
		canPersistTrialStateRef.current = false;
		setIsEvidenceHydrated(false);
		setIsTrialStateHydrated(false);
		setIsMachineSheetHydrated(false);
		setIsUploadingMachineSheet(false);
		setIsImportingExcel(false);

		void (async () => {
			try {
				let remoteEvidenceState: unknown = null;
				let remoteTrialStages: TrialStage[] = [];
				let remoteClearedTrialStages: TrialStage[] = [];
				let shouldMigrateLegacyState = false;

				try {
					const remoteState = await fetchDashboardMoldTrialEvidenceState({
						moldId,
						moldNo,
					});
					if (remoteState) {
						shouldMigrateLegacyState =
							!remoteState.trialStages?.length ||
							!remoteState.clearedTrialStages?.length;
						remoteEvidenceState = {
							version: 3,
							stagesByScope: remoteState.stagesByScope,
						};
						remoteTrialStages = sanitizeTrialStages(
							remoteState.trialStages?.length
								? remoteState.trialStages
								: Object.keys(remoteState.stagesByScope),
						);
						remoteClearedTrialStages = resolveClearedTrialStages(
							remoteTrialStages,
							sanitizeTrialStages(remoteState.clearedTrialStages || []),
						);
					}
				} catch {
					remoteEvidenceState = null;
				}

				if (!remoteEvidenceState) {
					remoteEvidenceState = await loadMoldTrialEvidence<unknown>(
						trialEvidenceStorageKey,
					);
					shouldMigrateLegacyState = !!remoteEvidenceState;
				}

				if (!remoteEvidenceState && typeof window !== "undefined") {
					const legacyRaw = window.localStorage.getItem(trialEvidenceStorageKey);
					if (legacyRaw) {
						remoteEvidenceState = JSON.parse(legacyRaw) as unknown;
						shouldMigrateLegacyState = true;
						await saveMoldTrialEvidence(
							trialEvidenceStorageKey,
							remoteEvidenceState,
						);
						window.localStorage.removeItem(trialEvidenceStorageKey);
					}
				}

				if (!remoteTrialStages.length) {
					remoteTrialStages = readStoredTrialStages(moldId, moldNo);
					remoteClearedTrialStages = resolveClearedTrialStages(
						remoteTrialStages,
						readStoredClearedTrialStages(trialStageClearedStorageKey),
					);
					if (remoteTrialStages.length > 0) {
						shouldMigrateLegacyState = true;
					}
				}

				if (remoteTrialStages.length === 0) {
					remoteTrialStages = [...defaultTrialStages];
					remoteClearedTrialStages = [];
				}

				const normalizedTrialStages = sanitizeTrialStages(remoteTrialStages);
				const normalizedClearedTrialStages = resolveClearedTrialStages(
					normalizedTrialStages,
					remoteClearedTrialStages,
				);
				const parsedEvidenceState = normalizeStoredEvidenceStateMap(
					remoteEvidenceState,
					normalizedTrialStages,
				);

				if (cancelled) return;
				setTrialStagesState(normalizedTrialStages);
				setActiveTrial(normalizedTrialStages[0] || defaultTrialStages[0]);
				setTrialDataByStage(
					buildInitialTrialDataMap(
						normalizedTrialStages,
						normalizedClearedTrialStages,
					),
				);
				setClearedTrialStages(normalizedClearedTrialStages);
				setEvidenceByTrial(parsedEvidenceState);
				evidenceByTrialRef.current = parsedEvidenceState;
				setEvidenceGroupNoteDraftByTrial(
					normalizedTrialStages.reduce(
						(acc, stage) => {
							acc[stage] = parsedEvidenceState[stage]?.groupNote || "";
							return acc;
						},
						{} as Record<TrialStage, string>,
					),
				);

				if (shouldMigrateLegacyState) {
					void saveDashboardMoldTrialEvidenceState({
						moldId,
						moldNo,
						stagesByScope: parsedEvidenceState,
						trialStages: normalizedTrialStages,
						clearedTrialStages: normalizedClearedTrialStages,
					}).catch(() => undefined);
					if (typeof window !== "undefined") {
						window.localStorage.removeItem(trialStageStorageKey);
						window.localStorage.removeItem(trialStageClearedStorageKey);
					}
				}

				let storedMachineSheet: unknown = null;
				try {
					const remoteMachineSheet = await fetchDashboardMachineSheetState({
						moldId,
						moldNo,
					});
					storedMachineSheet = remoteMachineSheet?.stagesByTrial || null;
				} catch {
					storedMachineSheet = null;
				}

				if (!storedMachineSheet) {
					storedMachineSheet = await loadMoldTrialEvidence<unknown>(
						machineSheetStorageKey,
					);
				}

				if (cancelled || !storedMachineSheet) return;

				const parsedMachineSheetByTrial =
					normalizeStoredMachineSheetMap(storedMachineSheet);
				setMachineSheetByTrial(parsedMachineSheetByTrial);
				machineSheetByTrialRef.current = parsedMachineSheetByTrial;
			} catch {
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(trialEvidenceStorageKey);
				}
			} finally {
				if (!cancelled) {
					setIsEvidenceHydrated(true);
					setIsTrialStateHydrated(true);
					setIsMachineSheetHydrated(true);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		machineSheetStorageKey,
		moldId,
		moldNo,
		trialEvidenceStorageKey,
		trialStageClearedStorageKey,
		trialStageStorageKey,
	]);

	useEffect(() => {
		if (!isEvidenceHydrated || !isTrialStateHydrated) {
			canPersistEvidenceRef.current = false;
			canPersistTrialStateRef.current = false;
			return;
		}

		const enablePersistTimer = window.setTimeout(() => {
			canPersistEvidenceRef.current = true;
			canPersistTrialStateRef.current = true;
		}, 0);

		return () => {
			window.clearTimeout(enablePersistTimer);
		};
	}, [isEvidenceHydrated, isTrialStateHydrated, moldId, moldNo]);

	useEffect(() => {
		if (!isEvidenceHydrated || !isTrialStateHydrated) {
			return;
		}

		if (!canPersistEvidenceRef.current || !canPersistTrialStateRef.current) {
			return;
		}

		void (async () => {
			try {
				await saveDashboardMoldTrialEvidenceState({
					moldId,
					moldNo,
					stagesByScope: evidenceByTrial,
					trialStages: trialStagesState,
					clearedTrialStages,
				});
			} catch {
				// Ignore remote storage write failures and keep UI responsive.
			}
		})();

		void (async () => {
			try {
				await saveMoldTrialEvidence<MoldTrialEvidenceStorageEnvelope>(
					trialEvidenceStorageKey,
					{
						version: 3,
						stagesByScope: evidenceByTrial,
					},
				);
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(trialEvidenceStorageKey);
				}
			} catch {
				// Ignore storage write failures and keep UI responsive.
			}
		})();
	}, [
		evidenceByTrial,
		clearedTrialStages,
		isTrialStateHydrated,
		isEvidenceHydrated,
		moldId,
		moldNo,
		trialStagesState,
		trialEvidenceStorageKey,
	]);

	useEffect(() => {
		if (!isMachineSheetHydrated) {
			return;
		}

		void (async () => {
			try {
				await saveDashboardMachineSheetState({
					moldId,
					moldNo,
					stagesByTrial: machineSheetByTrial,
				});
			} catch {
				// Ignore remote storage write failures and keep the UI responsive.
			}
		})();

		void (async () => {
			try {
				await saveMoldTrialEvidence(machineSheetStorageKey, machineSheetByTrial);
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(machineSheetStorageKey);
				}
			} catch {
				// Ignore storage write failures and keep UI responsive.
			}
		})();
	}, [
		isMachineSheetHydrated,
		machineSheetByTrial,
		machineSheetStorageKey,
		moldId,
		moldNo,
	]);

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
		const nextTrialStages = [...trialStagesState, nextStage];
		const nextClearedTrialStages = [...clearedTrialStages, nextStage];
		const nextEvidenceState = {
			...evidenceByTrialRef.current,
			[nextStage]: buildEmptyTrialEvidenceStageState(nextStage),
		};
		const nextEvidenceDrafts = {
			...evidenceGroupNoteDraftByTrial,
			[nextStage]: "",
		};

		setTrialStagesState(nextTrialStages);
		setClearedTrialStages(nextClearedTrialStages);
		setTrialDataByStage((prev) => ({
			...prev,
			[nextStage]: buildClearedTrialStageData(nextStage),
		}));
		setEvidenceByTrial(nextEvidenceState);
		evidenceByTrialRef.current = nextEvidenceState;
		setEvidenceGroupNoteDraftByTrial(nextEvidenceDrafts);
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
				`当前只能从最后轮次开始删除，请先切换到 ${lastTrialStage} 再执行删除。`,
			);
			return;
		}

		const currentIndex = trialStagesState.indexOf(activeTrial);
		const nextActiveTrial =
			trialStagesState[currentIndex - 1] ||
			trialStagesState[currentIndex + 1] ||
			trialStagesState[0];
		const nextTrialStages = trialStagesState.filter(
			(stage) => stage !== activeTrial,
		);
		const nextClearedTrialStages = clearedTrialStages.filter(
			(stage) => stage !== activeTrial,
		);
		const nextEvidenceState = { ...evidenceByTrialRef.current };
		delete nextEvidenceState[activeTrial];
		const nextEvidenceDrafts = { ...evidenceGroupNoteDraftByTrial };
		delete nextEvidenceDrafts[activeTrial];
		const deletedMachineSheetUrl = machineSheetByTrialRef.current[activeTrial];

		setTrialStagesState(nextTrialStages);
		setTrialDataByStage((prev) => {
			const next = { ...prev };
			delete next[activeTrial];
			return next;
		});
		setClearedTrialStages(nextClearedTrialStages);
		setEvidenceByTrial(nextEvidenceState);
		evidenceByTrialRef.current = nextEvidenceState;
		setEvidenceGroupNoteDraftByTrial(nextEvidenceDrafts);
		setMachineSheetByTrial((prev) => {
			if (!prev[activeTrial]) return prev;
			const next = { ...prev };
			delete next[activeTrial];
			return next;
		});
		if (deletedMachineSheetUrl && !deletedMachineSheetUrl.startsWith("blob:")) {
			void deleteAssetViaServer(deletedMachineSheetUrl).catch(() => undefined);
		}
		setShowClearMachineSheetConfirm(false);
		setPendingClearMachineSheetTrial(null);
		setActiveTrial(nextActiveTrial);
		setShowClearConfirm(false);
	};

	const clearMachineParamsForStage = (stage: TrialStage) => {
		const nextClearedTrialStages = clearedTrialStages.includes(stage)
			? clearedTrialStages
			: [...clearedTrialStages, stage];

		setClearedTrialStages(nextClearedTrialStages);
		setTrialDataByStage((prev) => {
			const currentStageData = prev[stage] || buildDefaultTrialStageData(stage);
			return {
				...prev,
				[stage]: buildClearedTrialStageDataFromSource(currentStageData),
			};
		});
		const clearedMachineSheetUrl = machineSheetByTrialRef.current[stage];
		setMachineSheetByTrial((prev) => {
			if (!prev[stage]) return prev;
			const next = { ...prev };
			delete next[stage];
			return next;
		});
		if (clearedMachineSheetUrl && !clearedMachineSheetUrl.startsWith("blob:")) {
			void deleteAssetViaServer(clearedMachineSheetUrl).catch(() => undefined);
		}
		setShowClearMachineConfirm(false);
		setPendingClearMachineTrial(null);
		setShowClearMachineSheetConfirm(false);
		setPendingClearMachineSheetTrial(null);
	};

	const clearMachineSheetForStage = async (
		stage: TrialStage,
		options?: { silent?: boolean },
	) => {
		const existingImageUrl = machineSheetByTrialRef.current[stage];
		if (!existingImageUrl) return;

		const nextMachineSheetByTrial = {
			...machineSheetByTrialRef.current,
		};
		delete nextMachineSheetByTrial[stage];

		setMachineSheetByTrial((prev) => {
			if (!prev[stage]) return prev;
			const next = { ...prev };
			delete next[stage];
			return next;
		});
		machineSheetByTrialRef.current = nextMachineSheetByTrial;
		void saveDashboardMachineSheetState({
			moldId,
			moldNo,
			stagesByTrial: nextMachineSheetByTrial,
		}).catch(() => undefined);
		await saveMoldTrialEvidence(machineSheetStorageKey, nextMachineSheetByTrial).catch(() => undefined);
		if (!existingImageUrl.startsWith("blob:")) {
			await deleteAssetViaServer(existingImageUrl).catch(() => undefined);
		}

		if (!options?.silent) {
			toast.success("图片已删除", {
				description: "手写机台参数图已清除。",
				position: "bottom-right",
			});
		}
	};

	const handleMachineSheetUpload = async (file?: File): Promise<boolean> => {
		if (!file) return false;
		if (!file.type.startsWith("image/")) {
			window.alert("请上传图片格式文件");
			return false;
		}

		setIsUploadingMachineSheet(true);
		const targetStage = activeTrial;
		const slotId = `${targetStage}-machine-sheet-a4`;
		const previousImageUrl = machineSheetByTrialRef.current[targetStage];

		try {
			const uploadResult = await uploadAssetViaServer({
				file,
				category: "mold-trial-machine-sheet",
				entityId: evidenceAssetEntityId,
				slot: slotId,
			});
			const nextImageUrl = uploadResult.url;
			const nextMachineSheetByTrial = {
				...machineSheetByTrialRef.current,
				[targetStage]: nextImageUrl,
			};

			setMachineSheetByTrial(nextMachineSheetByTrial);
			machineSheetByTrialRef.current = nextMachineSheetByTrial;
			void saveDashboardMachineSheetState({
				moldId,
				moldNo,
				stagesByTrial: nextMachineSheetByTrial,
			}).catch(() => undefined);
			await saveMoldTrialEvidence(machineSheetStorageKey, nextMachineSheetByTrial).catch(() => undefined);

			if (
				previousImageUrl &&
				previousImageUrl !== nextImageUrl &&
				!previousImageUrl.startsWith("blob:")
			) {
				void deleteAssetViaServer(previousImageUrl).catch(() => undefined);
			}

			toast.success("图片已保存", {
				description: "手写机台参数图已上传。",
				position: "bottom-right",
			});
			return true;
		} catch {
			toast.error("上传失败", {
				description: "请重试或检查网络连接。",
				position: "bottom-right",
			});
			return false;
		} finally {
			setIsUploadingMachineSheet(false);
		}
	};

	const uploadEvidenceFileToSlot = async (
		slotId: string,
		file?: File,
		options?: { showToast?: boolean },
	): Promise<boolean> => {
		if (!file) return false;

		try {
			const processedFile = await compressEvidenceImage(file);
			const currentStageState =
				evidenceByTrialRef.current[activeTrial] ||
				buildEmptyTrialEvidenceStageState(activeTrial);
			const currentSlots = normalizeEvidenceSlotsForStage(
				activeTrial,
				currentStageState.slots,
			);
			const previousUrl = currentSlots.find(
				(slot) => slot.id === slotId,
			)?.imageUrl;
			const uploadResult = await uploadAssetViaServer({
				file: processedFile,
				category: "mold-trial-evidence",
				entityId: evidenceAssetEntityId,
				slot: slotId,
			});
			const imageUrl = uploadResult.url;
			setSelectedEvidenceSlotId(slotId);

			const nextEvidenceState = {
				...evidenceByTrialRef.current,
				[activeTrial]: {
					...currentStageState,
					slots: currentSlots.map((slot) => {
						if (slot.id !== slotId) return slot;
						if (slot.imageUrl?.startsWith("blob:")) {
							URL.revokeObjectURL(slot.imageUrl);
						}
						return { ...slot, imageUrl };
					}),
				},
			};
			setEvidenceByTrial(nextEvidenceState);
			evidenceByTrialRef.current = nextEvidenceState;

			if (
				previousUrl &&
				previousUrl !== imageUrl &&
				!previousUrl.startsWith("blob:")
			) {
				void deleteAssetViaServer(previousUrl).catch(() => undefined);
			}

			if (options?.showToast !== false) {
				toast.success("图片已保存", {
					description: "证据图片已上传至 OSS。",
					position: "bottom-right",
				});
			}

			return true;
		} catch {
			return false;
		}
	};

	const handleEvidenceFilesUpload = async (
		files: File[] | FileList,
		startSlotId?: string,
	) => {
		const imageFiles = Array.from(files).filter((file) =>
			file.type.startsWith("image/"),
		);

		if (imageFiles.length === 0) {
			window.alert("请拖拽或选择图片文件");
			return;
		}

		const currentSlots = normalizeEvidenceSlotsForStage(
			activeTrial,
			(evidenceByTrialRef.current[activeTrial] ||
				buildEmptyTrialEvidenceStageState(activeTrial)).slots,
		);
		const startIndex = startSlotId
			? currentSlots.findIndex((slot) => slot.id === startSlotId)
			: currentSlots.findIndex((slot) => !slot.imageUrl);
		const candidateSlots =
			startIndex >= 0 ? currentSlots.slice(startIndex) : currentSlots;
		const targetSlots = candidateSlots.filter((slot) => !slot.imageUrl);

		if (targetSlots.length === 0) {
			toast.warning("证据位已满", {
				description: "没有可用空位，请先删除一张图片。",
				position: "bottom-right",
			});
			return;
		}

		const uploadPairs = imageFiles
			.slice(0, targetSlots.length)
			.map((file, index) => ({
				file,
				slotId: targetSlots[index]?.id,
			}))
			.filter((pair): pair is { file: File; slotId: string } => !!pair.slotId);

		const skippedCount = imageFiles.length - uploadPairs.length;
		if (uploadPairs.length === 1) {
			const onlyPair = uploadPairs[0];
			const ok = await uploadEvidenceFileToSlot(
				onlyPair.slotId,
				onlyPair.file,
				{
					showToast: false,
				},
			);

			if (!ok) {
				window.alert("图片上传失败，请稍后重试");
				return;
			}

			setSelectedEvidenceSlotId(onlyPair.slotId);
			toast.success("1 张图片已上传至 OSS", {
				description:
					skippedCount > 0
						? `剩余 ${skippedCount} 张已超过空位上限。`
						: "批量上传完成。",
				position: "bottom-right",
			});
			return;
		}

		let successCount = 0;
		let failCount = 0;
		let lastUploadedSlotId: string | null = null;

		for (const pair of uploadPairs) {
			const ok = await uploadEvidenceFileToSlot(pair.slotId, pair.file, {
				showToast: false,
			});
			if (ok) {
				successCount += 1;
				lastUploadedSlotId = pair.slotId;
			} else {
				failCount += 1;
			}
		}

		if (lastUploadedSlotId) {
			setSelectedEvidenceSlotId(lastUploadedSlotId);
		}

		if (successCount > 0) {
			toast.success(
				successCount === 1
					? "1 张图片已上传至 OSS"
					: `${successCount} 张图片已上传至 OSS`,
				{
					description:
						skippedCount > 0
							? `剩余 ${skippedCount} 张已超过空位上限。`
							: "批量上传完成。",
					position: "bottom-right",
				},
			);
		}

		if (failCount > 0) {
			toast.error("部分图片上传失败", {
				description: `成功 ${successCount} 张，失败 ${failCount} 张。`,
				position: "bottom-right",
			});
		}

		if (successCount === 0 && failCount === 0) {
			window.alert("没有可上传的图片");
		}
	};

	const handleEvidenceDragEnter = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		event.stopPropagation();
		evidenceDropDepthRef.current += 1;
		setIsEvidenceDropActive(true);
	};

	const handleEvidenceDragOver = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "copy";
	};

	const handleEvidenceDragLeave = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		event.stopPropagation();
		evidenceDropDepthRef.current = Math.max(
			0,
			evidenceDropDepthRef.current - 1,
		);
		if (evidenceDropDepthRef.current === 0) {
			setIsEvidenceDropActive(false);
		}
	};

	const handleEvidenceDrop = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		event.stopPropagation();
		evidenceDropDepthRef.current = 0;
		setIsEvidenceDropActive(false);
		const preferredDefectSlotId = defectEvidenceSlots.find(
			(slot) => !slot.imageUrl,
		)?.id;
		void handleEvidenceFilesUpload(
			event.dataTransfer.files,
			pendingUploadSlotId ||
				preferredDefectSlotId ||
				currentEvidenceSlots.find((slot) => !slot.imageUrl)?.id,
		);
		setPendingUploadSlotId(null);
	};

	const handleEvidenceDelete = async (slotId: string) => {
		const currentStageState =
			evidenceByTrialRef.current[activeTrial] ||
			buildEmptyTrialEvidenceStageState(activeTrial);
		const currentSlots = normalizeEvidenceSlotsForStage(
			activeTrial,
			currentStageState.slots,
		);
		const deletedIndex = currentSlots.findIndex((slot) => slot.id === slotId);
		if (deletedIndex < 0) return;

		const slotNumber = parseEvidenceSlotIndex(slotId);
		if (slotNumber < 0) return;

		const sectionStartIndex =
			slotNumber <= MOLD_TEMP_EVIDENCE_SLOT_COUNT
				? 0
				: MOLD_TEMP_EVIDENCE_SLOT_COUNT;
		const sectionEndIndex =
			slotNumber <= MOLD_TEMP_EVIDENCE_SLOT_COUNT
				? MOLD_TEMP_EVIDENCE_SLOT_COUNT
				: MOLD_TEMP_EVIDENCE_SLOT_COUNT + DEFECT_EVIDENCE_SLOT_COUNT;
		const deletedUrl = currentSlots[deletedIndex]?.imageUrl;
		const nextSlots = compactEvidenceSlotsWithinRange(
			currentSlots,
			sectionStartIndex,
			sectionEndIndex,
			deletedIndex,
		);

		const nextEvidenceState = {
			...evidenceByTrialRef.current,
			[activeTrial]: {
				...currentStageState,
				slots: nextSlots,
			},
		};
		setEvidenceByTrial(nextEvidenceState);
		evidenceByTrialRef.current = nextEvidenceState;

		if (deletedUrl?.startsWith("blob:")) {
			URL.revokeObjectURL(deletedUrl);
		}
		if (deletedUrl && !deletedUrl.startsWith("blob:")) {
			await deleteAssetViaServer(deletedUrl).catch(() => undefined);
		}

		const replacementImageUrl = nextSlots[deletedIndex]?.imageUrl || "";
		const nextSelectedEvidenceSlotId =
			replacementImageUrl && slotId ? slotId : null;

		if (activeEvidenceSlot?.id === slotId) {
			setSelectedEvidenceSlotId(
				nextSelectedEvidenceSlotId ||
					nextSlots.find((slot) => slot.imageUrl)?.id ||
					null,
			);
		}

		if (evidenceLightboxUrl === deletedUrl) {
			if (replacementImageUrl) {
				setSelectedEvidenceSlotId(slotId);
				setEvidenceLightboxUrl(replacementImageUrl);
				setEvidenceLightboxRotation(0);
			} else {
				setIsEvidenceLightboxOpen(false);
				setEvidenceLightboxUrl("");
				setEvidenceLightboxRotation(0);
			}
		}

		toast.success("图片已删除", {
			description: "证据图片已从 OSS 删除。",
			position: "bottom-right",
		});
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

	const navigateEvidenceLightbox = (direction: -1 | 1) => {
		if (evidenceSlotsWithImages.length === 0) return;
		if (evidenceSlotsWithImages.length === 1) {
			const onlySlot = evidenceSlotsWithImages[0];
			setSelectedEvidenceSlotId(onlySlot.id);
			setEvidenceLightboxUrl(onlySlot.imageUrl || "");
			return;
		}

		let currentIndex = evidenceSlotsWithImages.findIndex(
			(slot) => slot.id === selectedEvidenceSlotId,
		);

		if (currentIndex < 0 && evidenceLightboxUrl) {
			currentIndex = evidenceSlotsWithImages.findIndex(
				(slot) => slot.imageUrl === evidenceLightboxUrl,
			);
		}
		if (currentIndex < 0) currentIndex = 0;

		const nextIndex = currentIndex + direction;
		if (nextIndex < 0 || nextIndex >= evidenceSlotsWithImages.length) {
			return;
		}

		const nextSlot = evidenceSlotsWithImages[nextIndex];
		if (!nextSlot) return;

		setSelectedEvidenceSlotId(nextSlot.id);
		setEvidenceLightboxUrl(nextSlot.imageUrl || "");
		setEvidenceLightboxRotation(0);
	};

	useEffect(() => {
		if (!isEvidenceLightboxOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeEvidenceLightbox();
				return;
			}

			if (event.key === "ArrowLeft") {
				event.preventDefault();
				navigateEvidenceLightbox(-1);
				return;
			}

			if (event.key === "ArrowRight") {
				event.preventDefault();
				navigateEvidenceLightbox(1);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [closeEvidenceLightbox, isEvidenceLightboxOpen, navigateEvidenceLightbox]);

	const handleSaveEvidenceGroupNote = () => {
		const normalizedNote = (evidenceGroupNoteDraftByTrial[activeTrial] || "").trim();
		if (!normalizedNote) {
			window.alert("请输入证据总记录内容");
			return;
		}

		const isUpdate = currentEvidenceState.groupNote.trim().length > 0;
		const nextEvidenceState = {
			...evidenceByTrialRef.current,
			[activeTrial]: {
				...(evidenceByTrialRef.current[activeTrial] ||
					buildEmptyTrialEvidenceStageState(activeTrial)),
				groupNote: normalizedNote,
				recordedAt: new Date().toISOString(),
			},
		};
		setEvidenceByTrial(nextEvidenceState);
		evidenceByTrialRef.current = nextEvidenceState;
		setEvidenceGroupNoteDraftByTrial((prev) => ({
			...prev,
			[activeTrial]: normalizedNote,
		}));

		toast.success(isUpdate ? "记录已更新" : "记录已保存", {
			description: isUpdate ? "证据总记录修改成功。" : "证据总记录新增成功。",
			position: "bottom-right",
		});
	};

	const handleDeleteEvidenceGroupNote = () => {
		const nextEvidenceState = {
			...evidenceByTrialRef.current,
			[activeTrial]: {
				...(evidenceByTrialRef.current[activeTrial] ||
					buildEmptyTrialEvidenceStageState(activeTrial)),
				groupNote: "",
				recordedAt: null,
			},
		};
		setEvidenceByTrial(nextEvidenceState);
		evidenceByTrialRef.current = nextEvidenceState;
		setEvidenceGroupNoteDraftByTrial((prev) => ({
			...prev,
			[activeTrial]: "",
		}));
		setShowDeleteGroupNoteConfirm(false);

		toast.success("记录已删除", {
			description: "证据总记录已清空。",
			position: "bottom-right",
		});
	};

	const handleExcelImport = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";

		if (!file) return;
		if (!/\.(xlsx|xls)$/i.test(file.name)) {
			window.alert("请上传 Excel 文件 (.xlsx 或 .xls)");
			return;
		}

		setIsImportingExcel(true);
		try {
			const imported = await parseImportedMoldTrialWorkbook(file);
			const importedEvidenceMap = buildEvidenceStateMap(imported.trialStagesState);
			const importedStage = imported.trialStagesState[0] || defaultTrialStages[0];
			importedEvidenceMap[importedStage] = {
				...importedEvidenceMap[importedStage],
				slots: normalizeEvidenceSlotsForStage(
					importedStage,
					imported.evidenceSlots,
				),
			};
			const importedEvidenceDrafts = imported.trialStagesState.reduce(
				(acc, stage) => {
					acc[stage] = "";
					return acc;
				},
				{} as Record<TrialStage, string>,
			);

			revokeEvidenceSlotUrls(evidenceByTrialRef.current);
			setTrialStagesState(imported.trialStagesState);
			setActiveTrial(imported.trialStagesState[0] || defaultTrialStages[0]);
			setTrialDataByStage(imported.trialDataByStage);
			setClearedTrialStages([]);
			setEvidenceByTrial(importedEvidenceMap);
			evidenceByTrialRef.current = importedEvidenceMap;
			setEvidenceGroupNoteDraftByTrial(importedEvidenceDrafts);
			setMachineSheetByTrial({});
			machineSheetByTrialRef.current = {};
			setSelectedEvidenceSlotId(
				importedEvidenceMap[importedStage]?.slots.find((slot) => slot.imageUrl)?.id ||
					null,
			);
			setPendingUploadSlotId(null);
			setShowClearMachineConfirm(false);
			setShowClearMachineSheetConfirm(false);
			setPendingClearMachineSheetTrial(null);
			setShowClearConfirm(false);
			setPendingDeleteEvidenceSlotId(null);
			setShowDeleteGroupNoteConfirm(false);
			setIsEvidenceLightboxOpen(false);
			setEvidenceLightboxUrl("");
			setEvidenceLightboxRotation(0);

			toast.success("Excel 已导入", {
				description: `已载入 ${imported.trialStagesState.length} 个轮次。`,
				position: "bottom-right",
			});
		} catch (error) {
			window.alert(error instanceof Error ? error.message : "Excel 导入失败");
		} finally {
			setIsImportingExcel(false);
		}
	};

	const handleMachineSheetFileChange = (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		void handleMachineSheetUpload(file);
	};

	const renderEvidenceSlotGrid = (slots: TrialEvidenceSlot[]) =>
		slots.map((slot) => {
			return (
				<div key={slot.id} className="flex flex-col">
					<div className="group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 transition-all">
						<div
							onClick={() => {
								if (slot.imageUrl) {
									setSelectedEvidenceSlotId(slot.id);
									openEvidenceLightbox(slot.imageUrl);
								}
							}}
							className={`relative flex aspect-square items-center justify-center p-3 ${
								slot.imageUrl ? "cursor-pointer" : ""
							}`}
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
									onClick={() => {
										setPendingUploadSlotId(slot.id);
										evidenceInputRef.current?.click();
									}}
									className="group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-slate-800"
								>
									<UploadCloud className="h-3.5 w-3.5 text-slate-500 group-hover/btn:text-cyan-400" />
									<span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover/btn:text-cyan-100">
										上传
									</span>
								</button>
								<button
									type="button"
									onClick={() => setPendingDeleteEvidenceSlotId(slot.id)}
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
				</div>
			);
		});

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
					</div>
				<div className="flex items-center gap-3">
						<button
							className={`rounded-md flex items-center justify-center px-4 py-2 transition-colors ${
								canDeleteActiveTrial
									? "bg-rose-950/30 hover:bg-rose-900/50 text-rose-500 border border-rose-800/50"
									: "bg-slate-900/60 text-slate-600 border border-slate-800 cursor-not-allowed"
							}`}
							onClick={() => {
								if (!canDeleteActiveTrial) {
									window.alert(
										`轮次删除必须从最后一轮开始。当前最后轮次为 ${lastTrialStage}。`,
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
							<Trash2 className="h-8 w-8" />
						</button>
					</div>
				</div>
				<div className="flex overflow-x-auto gap-2 pb-2 mt-4">
					{trialStagesState.map((stage) => (
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

			<div className="my-5">
				<TrialModuleHeading titleCn="机台参数" titleEn="Machine Parameters" />
			</div>

			{/* SECTION 3.5: Handwritten Machine Sheet (A4 Landscape) */}
			<section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/35 p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-2.5">
							<ImageIcon className="h-4 w-4 text-cyan-300" />
						</div>
						<div>
							<h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
								手写机台参数单 / HANDWRITTEN MACHINE SHEET
							</h2>
							<p className="mt-1 text-xs text-slate-500">
								固定 A4 横向比例 297:210，建议上传清晰的整页照片或扫描件。
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => machineSheetInputRef.current?.click()}
							disabled={isUploadingMachineSheet}
							className="rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-900/50 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isUploadingMachineSheet
								? "上传中..."
								: activeMachineSheetUrl
									? "替换图片"
									: "上传图片"}
						</button>
						<button
							type="button"
							onClick={() => {
								setPendingClearMachineSheetTrial(activeTrial);
								setShowClearMachineSheetConfirm(true);
							}}
							disabled={!activeMachineSheetUrl}
							className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
								activeMachineSheetUrl
									? "border-rose-700/50 bg-rose-950/35 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100"
									: "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-600"
							}`}
						>
							清除图片
						</button>
					</div>
				</div>
				<div className="mt-4">
					<div
						className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-slate-950/75 shadow-inner"
						style={{ aspectRatio: "297 / 210" }}
					>
						{activeMachineSheetUrl ? (
							<img
								src={activeMachineSheetUrl}
								alt={`${activeTrial} 手写机台参数单`}
								className="h-full w-full object-contain bg-slate-950"
							/>
						) : (
							<div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
								<ImageIcon className="h-8 w-8 text-slate-600" />
								<p className="text-sm font-semibold tracking-wide text-slate-300">
									暂无手写机台参数图
								</p>
								<p className="max-w-xl text-xs text-slate-500">
									点击右上角“上传图片”后，这里会按 A4 横向尺寸展示整页手写参数。
								</p>
							</div>
						)}
					</div>
				</div>
			</section>

			<div className="my-8 flex items-center gap-4 px-1">
				<span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
				<span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
					独立模块分隔 / Module Break
				</span>
				<span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
			</div>

			<section className="rounded-2xl border border-rose-900/30 bg-slate-950/55 p-5 shadow-[0_0_0_1px_rgba(251,113,133,0.06)]">
				<div className="flex items-start gap-3">
					<div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-2.5">
						<Camera className="h-4 w-4 text-cyan-300" />
					</div>
					<div>
						<h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
							现场模温照片 / MOLD TEMP PHOTOS
						</h2>
						<p className="mt-1 text-xs text-slate-500">
							五宫格固定用于记录现场模温拍摄照片，上传、删除、预览逻辑与下方证据区一致。
						</p>
					</div>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
					{renderEvidenceSlotGrid(moldTempEvidenceSlots)}
				</div>
			</section>

			<div className="my-5">
				<TrialModuleHeading titleCn="模具尺寸FAI" titleEn="Tooling FAI Audit" />
			</div>
			<Fragment key={trialScopeKey}>
				<ToolingFaiParserSection
					key={`${trialScopeKey}:tooling`}
					moldId={moldId}
					moldNo={moldNo}
					trialStage={activeTrial}
				/>

				<div className="my-5">
					<TrialModuleHeading titleCn="产品尺寸FAI" titleEn="Part FAI Audit" />
				</div>
				<PartFaiParserSection
					key={`${trialScopeKey}:part`}
					moldId={moldId}
					moldNo={moldNo}
					trialStage={activeTrial}
				/>

				<div className="my-5">
					<TrialModuleHeading titleCn="表面测试" titleEn="Surface Validation" />
				</div>
				<SurfaceParserSection
					key={`${trialScopeKey}:surface`}
					moldId={moldId}
					moldNo={moldNo}
					trialStage={activeTrial}
				/>
			</Fragment>

			<div className="my-5">
				<TrialModuleHeading titleCn="外观问题" titleEn="Appearance Issues" />
			</div>

			{/* SECTION 4: Defect Evidence Gallery */}
			<section
				className={`relative rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-colors ${
					isEvidenceDropActive ? "border-cyan-500/60 bg-slate-900/55" : ""
				}`}
				onDragEnter={handleEvidenceDragEnter}
				onDragOver={handleEvidenceDragOver}
				onDragLeave={handleEvidenceDragLeave}
				onDrop={handleEvidenceDrop}
			>
				{isEvidenceDropActive && (
					<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-cyan-400/50 bg-slate-950/70">
						<div className="rounded-2xl border border-cyan-400/30 bg-slate-950/90 px-5 py-3 text-sm font-semibold tracking-wide text-cyan-100 shadow-lg">
							松开即可批量上传图片，优先填充下方 10 个证据位
						</div>
					</div>
				)}
				<div className="flex items-start gap-3">
					<div className="rounded-2xl border border-rose-700/50 bg-rose-950/20 p-3">
						<Camera className="h-4 w-4 text-rose-500" />
					</div>
					<div>
						<h2 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
							试模缺陷与物理证据 / DEFECT EVIDENCE GALLERY
						</h2>
						<p className="mt-1 text-xs text-slate-500">
							这里保留 10 张外观缺陷证据位，支持拖拽上传或点击空位多选上传。
						</p>
					</div>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
					{renderEvidenceSlotGrid(defectEvidenceSlots)}
				</div>

				<div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
					<label
						htmlFor="evidence-group-note"
						className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
					>
						证据总记录 / GROUP NOTE
					</label>
					<textarea
						id="evidence-group-note"
						className="mt-2 h-24 w-full resize-y rounded-xl border border-cyan-900/40 bg-slate-950/80 px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/70"
						placeholder="在这里记录试模缺陷结论、腔号位置、冲痕/压痕等关键信息。"
						value={evidenceGroupNoteDraft}
						onChange={(event) =>
							setEvidenceGroupNoteDraftByTrial((prev) => ({
								...prev,
								[activeTrial]: event.target.value,
							}))
						}
					/>
					<div className="mt-4 flex flex-wrap items-end justify-between gap-3">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleSaveEvidenceGroupNote}
								className="rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-900/50 hover:text-cyan-100"
							>
								保存记录 / SAVE
							</button>
							<button
								type="button"
								onClick={() => setShowDeleteGroupNoteConfirm(true)}
								disabled={!hasSavedEvidenceGroupNote && !evidenceGroupNoteDraft}
								className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
									hasSavedEvidenceGroupNote || evidenceGroupNoteDraft
										? "border-rose-700/50 bg-rose-950/35 text-rose-300 hover:bg-rose-900/50 hover:text-rose-100"
										: "cursor-not-allowed border-slate-800 bg-slate-900/60 text-slate-600"
								}`}
							>
								删除记录 / DELETE
							</button>
						</div>
						<span className="text-xs font-mono uppercase tracking-wider text-slate-500">
							记录时间 / RECORDED AT:{" "}
							{formatRecordedAt(currentEvidenceState.recordedAt)}
						</span>
					</div>
				</div>
			</section>

			<CyberConfirmDialog
				open={showClearMachineConfirm}
				title="清除数据确认"
				message={`确定要清除当前 ${pendingClearMachineTrial || activeTrial} 轮次的机台参数吗？将清空试模日期、成型机台、材料、三列机台参数数据，以及手写机台参数图片；证据、FAI 和表面测试内容不会被删除。`}
				onCancel={() => {
					setShowClearMachineConfirm(false);
					setPendingClearMachineTrial(null);
				}}
				onConfirm={() => {
					const targetStage = pendingClearMachineTrial || activeTrial;
					clearMachineParamsForStage(targetStage);
				}}
				confirmText="确认清除"
				cancelText="取消"
			/>
			<CyberConfirmDialog
				open={showDeleteGroupNoteConfirm}
				title="删除记录确认"
				message="确定要删除当前证据总记录吗？删除后内容和记录时间都会清空，此操作不可撤销。"
				onCancel={() => setShowDeleteGroupNoteConfirm(false)}
				onConfirm={handleDeleteEvidenceGroupNote}
				confirmText="确认删除"
				cancelText="取消"
			/>
			<CyberConfirmDialog
				open={showClearMachineSheetConfirm}
				title="删除图片确认"
				message={`确定要删除当前 ${pendingClearMachineSheetTrial || activeTrial} 轮次的手写机台参数图片吗？删除后不可撤销。`}
				onCancel={() => {
					setShowClearMachineSheetConfirm(false);
					setPendingClearMachineSheetTrial(null);
				}}
				onConfirm={() => {
					const targetStage = pendingClearMachineSheetTrial || activeTrial;
					setShowClearMachineSheetConfirm(false);
					setPendingClearMachineSheetTrial(null);
					void clearMachineSheetForStage(targetStage);
				}}
				confirmText="确认删除"
				cancelText="取消"
			/>
			<CyberConfirmDialog
				open={showClearConfirm || !!pendingDeleteEvidenceSlotId}
				title={pendingDeleteEvidenceSlotId ? "删除图片确认" : "删除轮次确认"}
				message={
					pendingDeleteEvidenceSlotId
						? "确定要删除当前图片吗？删除后该图片将被移除，此操作不可撤销。"
						: `确定要删除当前 ${activeTrial} 轮次页面吗？删除后该轮次的参数快照将被移除，此操作不可撤销。`
				}
				onCancel={() => {
					if (pendingDeleteEvidenceSlotId) {
						setPendingDeleteEvidenceSlotId(null);
						return;
					}
					setShowClearConfirm(false);
				}}
				onConfirm={() => {
					if (pendingDeleteEvidenceSlotId) {
						void handleEvidenceDelete(pendingDeleteEvidenceSlotId);
						setPendingDeleteEvidenceSlotId(null);
						return;
					}

					deleteCurrentTrialStage();
					console.log("删除当前轮次页面", activeTrial);
				}}
				confirmText="确认删除"
				cancelText="取消"
			/>
			<input
				ref={excelInputRef}
				type="file"
				accept=".xlsx,.xls"
				className="hidden"
				onChange={handleExcelImport}
			/>
			<input
				type="file"
				accept="image/*"
				className="hidden"
				ref={machineSheetInputRef}
				onChange={handleMachineSheetFileChange}
			/>
			<input
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				ref={evidenceInputRef}
				onChange={(e) => {
					console.log("File selected", e.target.files);
					void handleEvidenceFilesUpload(
						e.target.files || [],
						pendingUploadSlotId ||
							currentEvidenceSlots.find((slot) => !slot.imageUrl)?.id ||
							currentEvidenceSlots[0]?.id ||
							`${defaultTrialStages[0]}-slot-1`,
					);
					e.target.value = "";
					setPendingUploadSlotId(null);
				}}
			/>
			{isEvidenceLightboxOpen && (
				<div
					onClick={closeEvidenceLightbox}
					className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md"
				>
					<div
						className="flex max-w-[90vw] flex-col items-center"
						onClick={(event) => event.stopPropagation()}
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
								onClick={() => setEvidenceLightboxRotation((prev) => prev - 90)}
								className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
								aria-label="向左旋转"
								title="向左旋转"
							>
								<RotateCcw className="h-5 w-5 text-slate-300" />
							</button>

							<button
								type="button"
								onClick={() => setEvidenceLightboxRotation((prev) => prev + 90)}
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
