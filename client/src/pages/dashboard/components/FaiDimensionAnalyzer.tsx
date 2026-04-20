"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { FAIDashboard } from "@/components/fai/fai-dashboard";
import AssetDrawerWorkspace, {
  buildAssetPanelKey,
  type AssetPanelItem,
} from "./AssetDrawerWorkspace";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import { deleteFaiDimensionState } from "@/lib/fai-dimension-state-api";

type TrialStage = string;

const DEFAULT_TRIAL_STAGES: TrialStage[] = ["T0", "T1", "T2"];
const TRIAL_STAGE_PATTERN = /^T\d+$/;
const TRIAL_STATE_STORAGE_PREFIX = "fai-dimension-trial-state:v1:";
const FAI_LOCAL_FALLBACK_STORAGE_KEY = "fai_dimension_state_fallback_v1";
const FAI_LOCAL_SNAPSHOT_STORAGE_KEY = "fai_dimension_snapshot_v1";

function normalizeTrialStages(value: unknown): TrialStage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((stage) => String(stage ?? "").trim().toUpperCase())
        .filter((stage): stage is TrialStage => TRIAL_STAGE_PATTERN.test(stage))
    )
  ).sort((a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10));
}

function createTrialStageLabel(index: number): TrialStage {
  return `T${index}`;
}

function normalizeActiveTrial(activeTrial: string, trialStages: TrialStage[]): TrialStage {
  if (trialStages.includes(activeTrial)) {
    return activeTrial;
  }
  return trialStages[0] || DEFAULT_TRIAL_STAGES[0];
}

function buildPanelTrialStateStorageKey(panel: AssetPanelItem): string {
  return `${TRIAL_STATE_STORAGE_PREFIX}${buildAssetPanelKey(panel)}`;
}

function readPanelTrialState(panel: AssetPanelItem): { trialStages: TrialStage[]; activeTrial: TrialStage } {
  if (typeof window === "undefined") {
    return {
      trialStages: [...DEFAULT_TRIAL_STAGES],
      activeTrial: DEFAULT_TRIAL_STAGES[0],
    };
  }

  const storageKey = buildPanelTrialStateStorageKey(panel);
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return {
      trialStages: [...DEFAULT_TRIAL_STAGES],
      activeTrial: DEFAULT_TRIAL_STAGES[0],
    };
  }

  try {
    const parsed = JSON.parse(raw) as { trialStages?: unknown; activeTrial?: unknown } | null;
    const trialStages = normalizeTrialStages(parsed?.trialStages);
    const normalizedStages = trialStages.length > 0 ? trialStages : [...DEFAULT_TRIAL_STAGES];
    const activeTrial = normalizeActiveTrial(
      String(parsed?.activeTrial ?? "").trim().toUpperCase(),
      normalizedStages
    );
    return { trialStages: normalizedStages, activeTrial };
  } catch {
    return {
      trialStages: [...DEFAULT_TRIAL_STAGES],
      activeTrial: DEFAULT_TRIAL_STAGES[0],
    };
  }
}

function writePanelTrialState(panel: AssetPanelItem, trialStages: TrialStage[], activeTrial: TrialStage): void {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = buildPanelTrialStateStorageKey(panel);
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        trialStages,
        activeTrial,
      })
    );
  } catch {
  }
}

function buildFaiScope(panel: AssetPanelItem, trialStage: TrialStage): string {
  const moldId = panel.moldId.trim() || "dimension-analyzer";
  const moldNo = panel.moldNo.trim() || "NO.-";
  return `dimension-analyzer:${moldId}:${moldNo}:${trialStage}`;
}

async function clearDeletedTrialData(panel: AssetPanelItem, trialStage: TrialStage): Promise<void> {
  const scope = buildFaiScope(panel, trialStage);
  const fallbackKey = `${FAI_LOCAL_FALLBACK_STORAGE_KEY}:${scope}`;
  const snapshotKey = `${FAI_LOCAL_SNAPSHOT_STORAGE_KEY}:${scope}`;

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(fallbackKey);
    window.localStorage.removeItem(snapshotKey);
  }

  await deleteFaiDimensionState({ scope }).catch(() => undefined);
}

function TrialAxisButton({
  label,
  active,
  onClick,
}: {
  label: TrialStage;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-4 py-1.5 text-xs font-mono whitespace-nowrap transition-colors ${
        active
          ? "border-cyan-500/80 bg-cyan-950/30 text-cyan-300"
          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300"
      }`}
    >
      {label}
    </button>
  );
}

function FaiDimensionPanel({ panel }: { panel: AssetPanelItem }) {
  const [trialStages, setTrialStages] = useState<TrialStage[]>(DEFAULT_TRIAL_STAGES);
  const [activeTrial, setActiveTrial] = useState<TrialStage>(DEFAULT_TRIAL_STAGES[0]);
  const [showDeleteTrialConfirm, setShowDeleteTrialConfirm] = useState(false);

  const panelKey = useMemo(() => buildAssetPanelKey(panel), [panel]);

  useEffect(() => {
    const state = readPanelTrialState(panel);
    setTrialStages(state.trialStages);
    setActiveTrial(state.activeTrial);
    setShowDeleteTrialConfirm(false);
  }, [panel]);

  useEffect(() => {
    writePanelTrialState(panel, trialStages, activeTrial);
  }, [activeTrial, panel, trialStages]);

  const lastTrialStage = trialStages[trialStages.length - 1] || DEFAULT_TRIAL_STAGES[0];
  const canDeleteActiveTrial = trialStages.length > 1 && activeTrial === lastTrialStage;

  const handleAddTrialStage = () => {
    const maxStageIndex = trialStages.reduce((maxValue, stage) => {
      const parsed = Number.parseInt(stage.replace(/^T/, ""), 10);
      return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
    }, 0);
    const nextStage = createTrialStageLabel(maxStageIndex + 1);

    setTrialStages((prev) => [...prev, nextStage]);
    setActiveTrial(nextStage);
  };

  const handleDeleteTrialStage = () => {
    if (!canDeleteActiveTrial) {
      setShowDeleteTrialConfirm(false);
      return;
    }

    const deletingTrial = activeTrial;
    const currentIndex = trialStages.indexOf(deletingTrial);
    const nextTrialStages = trialStages.filter((stage) => stage !== deletingTrial);
    const nextActiveTrial =
      trialStages[currentIndex - 1] ||
      trialStages[currentIndex + 1] ||
      nextTrialStages[0] ||
      DEFAULT_TRIAL_STAGES[0];

    setTrialStages(nextTrialStages);
    setActiveTrial(nextActiveTrial);
    setShowDeleteTrialConfirm(false);
    void clearDeletedTrialData(panel, deletingTrial);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/[0.06] bg-[#0b1220] px-4 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded border border-slate-700 px-2 py-0.5">
              {panel.moldId}
            </span>
            <span className="rounded border border-slate-700 px-2 py-0.5">
              {panel.moldNo}
            </span>
            <span className="rounded border border-slate-700 px-2 py-0.5">
              当前轮次: {activeTrial}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteTrialConfirm(true)}
            disabled={!canDeleteActiveTrial}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
              canDeleteActiveTrial
                ? "border-rose-500/40 bg-rose-950/20 text-rose-300 hover:border-rose-400 hover:text-rose-200"
                : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600"
            }`}
            title={
              canDeleteActiveTrial
                ? `删除当前轮次 ${activeTrial}`
                : `仅允许删除最后轮次 ${lastTrialStage}`
            }
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {trialStages.map((stage) => (
            <TrialAxisButton
              key={stage}
              label={stage}
              active={stage === activeTrial}
              onClick={() => setActiveTrial(stage)}
            />
          ))}
          <button
            type="button"
            onClick={handleAddTrialStage}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-mono whitespace-nowrap text-cyan-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
            title="新增轮次"
          >
            +
          </button>
        </div>
      </section>

      <FAIDashboard
        key={`${panelKey}:${activeTrial}`}
        moldId={panel.moldId}
        moldNo={panel.moldNo}
        trialStage={activeTrial}
      />

      <CyberConfirmDialog
        open={showDeleteTrialConfirm}
        title="删除轮次确认"
        message={
          canDeleteActiveTrial
            ? `确定删除当前轮次 ${activeTrial} 吗？该轮次已保存的尺寸分析数据将被清除，操作不可撤销。`
            : `当前不允许删除。仅支持删除最后轮次 ${lastTrialStage}，并且至少保留一个轮次。`
        }
        onCancel={() => setShowDeleteTrialConfirm(false)}
        onConfirm={handleDeleteTrialStage}
        confirmText="确认删除"
        cancelText="取消"
      />
    </div>
  );
}

interface FaiDimensionAnalyzerProps {
  panels?: AssetPanelItem[];
}

export default function FaiDimensionAnalyzer({ panels }: FaiDimensionAnalyzerProps) {
  const normalizedPanels =
    Array.isArray(panels) && panels.length > 0
      ? panels
      : [{ moldId: "LA26006", moldNo: "NO. -" }];

  return (
    <AssetDrawerWorkspace
      panels={normalizedPanels}
      badgeLabel="FAI DIMENSION"
      drawerTitle="尺寸分析抽屉"
      drawerDescription="通过 mold/no 选择当前尺寸分析面板，支持 T0/T1/T2 独立数据。"
      emptyMessage="暂无可用尺寸分析面板。"
      icon={FileSpreadsheet}
      renderPanel={(panel) => (
        <FaiDimensionPanel key={buildAssetPanelKey(panel)} panel={panel} />
      )}
    />
  );
}
