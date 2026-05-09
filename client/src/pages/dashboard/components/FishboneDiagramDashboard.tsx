import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  GitBranch,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  FISHBONE_STORAGE_KEY,
  FISHBONE_TEMPLATES,
  createFishboneCause,
  getFishboneBranchLabel,
  getNextFishboneBranch,
  getSelectedFishboneCategory,
  materializeFishboneTemplate,
  normalizeFishboneState,
  type FishboneBranch,
  type FishboneCategory,
  type FishboneDiagramState,
  type FishboneTemplateId,
} from "./fishboneDiagramData";
import {
  FISHBONE_CAUSE_WRAP,
  FISHBONE_CATEGORY_WRAP,
  FISHBONE_IMPACT_WRAP,
  FISHBONE_PROBLEM_WRAP,
  wrapFishboneText,
} from "./fishboneTextLayout";

const MAX_VISIBLE_CAUSES = 3;
const SVG_WIDTH = 1360;
const SVG_HEIGHT = 760;
const SPINE_Y = SVG_HEIGHT / 2;
const TAIL_X = 166;
const HEAD_X = 972;
const HEAD_WIDTH = 124;
const HEAD_HEIGHT = 74;
const BRANCH_LENGTH = 230;
const RIB_LENGTH = 92;
const BRANCH_ANGLE = 34;
const CATEGORY_CARD_WIDTH = 172;
const CAUSE_CARD_WIDTH = 156;
const PROBLEM_CARD_WIDTH = 214;
const PROBLEM_CARD_LEFT = 1114;
const PROBLEM_CARD_TOP = 168;

function getAnchorPositions(count: number, start: number, end: number) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [(start + end) / 2];
  }

  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function getCauseRatios(count: number) {
  if (count <= 1) {
    return [0.5];
  }

  if (count === 2) {
    return [0.26, 0.76];
  }

  return [0.18, 0.5, 0.82];
}

function wrapLabel(text: string, kind: "category" | "cause" | "problem" | "impact") {
  switch (kind) {
    case "category":
      return wrapFishboneText(text, FISHBONE_CATEGORY_WRAP);
    case "cause":
      return wrapFishboneText(text, FISHBONE_CAUSE_WRAP);
    case "problem":
      return wrapFishboneText(text, FISHBONE_PROBLEM_WRAP);
    case "impact":
      return wrapFishboneText(text, FISHBONE_IMPACT_WRAP);
    default:
      return [text];
  }
}

function TextLineBlock({
  lines,
  align = "left",
  className,
}: {
  lines: string[];
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-0.5 leading-4 whitespace-normal break-words",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
  );
}

export default function FishboneDiagramDashboard() {
  const [diagram, setDiagram] = useState<FishboneDiagramState>(() =>
    materializeFishboneTemplate("manufacturing")
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let normalized: FishboneDiagramState | null = null;

    try {
      const saved = window.localStorage.getItem(FISHBONE_STORAGE_KEY);
      normalized = saved ? normalizeFishboneState(JSON.parse(saved)) : null;
    } catch {
      normalized = null;
    }

    const nextState = normalized ?? materializeFishboneTemplate("manufacturing");
    setDiagram(nextState);
    setSelectedCategoryId(nextState.categories[0]?.id ?? "");
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(FISHBONE_STORAGE_KEY, JSON.stringify(diagram));
  }, [diagram, isReady]);

  useEffect(() => {
    if (!diagram.categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(diagram.categories[0]?.id ?? "");
    }
  }, [diagram.categories, selectedCategoryId]);

  const selectedCategory = getSelectedFishboneCategory(
    diagram.categories,
    selectedCategoryId
  );
  const totalCauses = useMemo(
    () => diagram.categories.reduce((sum, category) => sum + category.causes.length, 0),
    [diagram.categories]
  );
  const topCategories = useMemo(
    () => diagram.categories.filter((category) => category.branch === "top"),
    [diagram.categories]
  );
  const bottomCategories = useMemo(
    () => diagram.categories.filter((category) => category.branch === "bottom"),
    [diagram.categories]
  );
  const activeTemplate = useMemo(
    () => FISHBONE_TEMPLATES.find((item) => item.id === diagram.templateId) ?? FISHBONE_TEMPLATES[0],
    [diagram.templateId]
  );

  const branchRadians = (BRANCH_ANGLE * Math.PI) / 180;
  const branchCos = Math.cos(branchRadians);
  const branchSin = Math.sin(branchRadians);
  const topAnchors = getAnchorPositions(topCategories.length, 470, 900);
  const bottomAnchors = getAnchorPositions(bottomCategories.length, 470, 900);
  const problemLines = wrapLabel(diagram.problem, "problem");
  const impactLines = wrapLabel(diagram.impact, "impact");

  const updateDiagram = (updater: (current: FishboneDiagramState) => FishboneDiagramState) => {
    setDiagram((current) => updater(current));
  };

  const applyTemplate = (templateId: FishboneTemplateId) => {
    const nextState = materializeFishboneTemplate(templateId);
    setDiagram(nextState);
    setSelectedCategoryId(nextState.categories[0]?.id ?? "");
  };

  const updateCategory = (
    categoryId: string,
    updater: (category: FishboneCategory) => FishboneCategory
  ) => {
    updateDiagram((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? updater(category) : category
      ),
    }));
  };

  const addCategory = () => {
    const nextCategory: FishboneCategory = {
      id: `category-${Date.now()}`,
      title: `分类 ${diagram.categories.length + 1}`,
      titleEn: `Category ${diagram.categories.length + 1}`,
      branch: getNextFishboneBranch(diagram.categories),
      causes: [createFishboneCause("待补充原因")],
    };

    updateDiagram((current) => ({
      ...current,
      categories: [...current.categories, nextCategory],
    }));
    setSelectedCategoryId(nextCategory.id);
  };

  const removeCategory = (categoryId: string) => {
    updateDiagram((current) => {
      if (current.categories.length <= 2) {
        return current;
      }

      return {
        ...current,
        categories: current.categories.filter((category) => category.id !== categoryId),
      };
    });
  };

  const addCause = (categoryId: string) => {
    updateCategory(categoryId, (category) => ({
      ...category,
      causes: [...category.causes, createFishboneCause("待补充原因")],
    }));
  };

  const removeCause = (categoryId: string, causeId: string) => {
    updateCategory(categoryId, (category) => ({
      ...category,
      causes:
        category.causes.length <= 1
          ? category.causes
          : category.causes.filter((cause) => cause.id !== causeId),
    }));
  };

  const downloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      ...diagram,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fishbone-diagram-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderBranchLayer = (
    categories: FishboneCategory[],
    anchors: number[],
    branch: FishboneBranch
  ) =>
    categories.map((category, index) => {
      const anchorX = anchors[index];
      const endX = anchorX - BRANCH_LENGTH * branchCos;
      const endY =
        branch === "top"
          ? SPINE_Y - BRANCH_LENGTH * branchSin
          : SPINE_Y + BRANCH_LENGTH * branchSin;
      const isSelected = category.id === selectedCategory?.id;
      const stroke =
        isSelected ? "#a78bfa" : branch === "top" ? "#7ee787" : "#7dcfff";
      const ribStroke =
        isSelected ? "#d8b4fe" : branch === "top" ? "#a7f3d0" : "#bae6fd";
      const visibleCauses = category.causes.slice(0, MAX_VISIBLE_CAUSES);

      return (
        <g key={category.id}>
          <g onClick={() => setSelectedCategoryId(category.id)} className="cursor-pointer">
            <line
              x1={anchorX}
              y1={SPINE_Y}
              x2={endX}
              y2={endY}
              stroke={stroke}
              strokeWidth={isSelected ? 4 : 3}
              strokeLinecap="round"
            />
            <circle
              cx={anchorX}
              cy={SPINE_Y}
              r={isSelected ? 7 : 6}
              fill="#020617"
              stroke={stroke}
              strokeWidth="2"
            />
            {visibleCauses.map((cause, causeIndex) => {
              const ratio = getCauseRatios(visibleCauses.length)[causeIndex] ?? 0.5;
              const ribJointX = anchorX - ratio * BRANCH_LENGTH * branchCos;
              const ribJointY =
                branch === "top"
                  ? SPINE_Y - ratio * BRANCH_LENGTH * branchSin
                  : SPINE_Y + ratio * BRANCH_LENGTH * branchSin;
              const ribEndX = ribJointX - RIB_LENGTH;

              return (
                <g key={cause.id}>
                  <line
                    x1={ribJointX}
                    y1={ribJointY}
                    x2={ribEndX}
                    y2={ribJointY}
                    stroke={ribStroke}
                    strokeWidth={isSelected ? 2.1 : 1.5}
                    strokeLinecap="round"
                    opacity={0.92}
                  />
                  <circle cx={ribJointX} cy={ribJointY} r="2.5" fill={ribStroke} />
                </g>
              );
            })}
          </g>
        </g>
      );
    });

  return (
    <section className="space-y-5">
      <div className="border-b border-slate-800/70 pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-100">鱼骨图</h2>
                <p className="text-sm text-slate-500">
                  Fishbone / Ishikawa Diagram for root cause analysis
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border border-violet-400/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/10">
                当前模板: {activeTemplate.name}
              </Badge>
              <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">
                {diagram.categories.length} 个分类
              </Badge>
              <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                {totalCauses} 条原因
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => applyTemplate(diagram.templateId)}
              className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              重置当前模板
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={downloadJson}
              className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Download className="h-4 w-4" />
              导出 JSON
            </Button>
            <Button
              type="button"
              onClick={() => window.print()}
              className="bg-violet-600 text-white hover:bg-violet-500"
            >
              <Printer className="h-4 w-4" />
              打印图表
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid gap-4 rounded border border-slate-800 bg-slate-900 p-4 md:grid-cols-2 md:p-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-200">问题定义</label>
            <Textarea
              value={diagram.problem}
              onChange={(event) =>
                updateDiagram((current) => ({ ...current, problem: event.target.value }))
              }
              rows={3}
              className="min-h-[92px] border-slate-700 bg-slate-950/60 text-slate-100"
              placeholder="写清现象、对象和时间边界。"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">影响说明</label>
            <Textarea
              value={diagram.impact}
              onChange={(event) =>
                updateDiagram((current) => ({ ...current, impact: event.target.value }))
              }
              rows={4}
              className="min-h-[120px] border-slate-700 bg-slate-950/60 text-slate-100"
              placeholder="记录影响范围、客户感知、节拍或成本。"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">当前假设</label>
            <Textarea
              value={diagram.rootCause}
              onChange={(event) =>
                updateDiagram((current) => ({ ...current, rootCause: event.target.value }))
              }
              rows={4}
              className="min-h-[120px] border-slate-700 bg-slate-950/60 text-slate-100"
              placeholder="写下当前最值得验证的假设。"
            />
          </div>
        </div>

        <div className="grid gap-4 rounded border border-slate-800 bg-slate-900 p-4 md:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-medium text-slate-200">快速模板</h3>
          </div>
          <div className="grid gap-2">
            {FISHBONE_TEMPLATES.map((template) => {
              const active = template.id === diagram.templateId;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template.id)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-violet-400/40 bg-violet-500/10"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-100">{template.name}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {template.description}
                      </div>
                    </div>
                    {active ? (
                      <Badge className="bg-violet-600 text-white hover:bg-violet-600">
                        当前
                      </Badge>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
            图上每个分类最多显示 {MAX_VISIBLE_CAUSES} 条原因，优先保证每一行能看清楚，
            完整内容仍保留在下方编辑区。
          </div>
        </div>
      </div>

      <div className="rounded border border-slate-800 bg-slate-900 p-4 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Target className="h-4 w-4 text-violet-300" />
              选中分类: {selectedCategory?.title ?? "未选择"}
            </div>
            <div className="text-xs text-slate-500">
              点击骨架分支切换分类，编辑区的修改会同步到图上；现在每块标签都按固定宽度自动换行。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">
              上支路 {topCategories.length}
            </Badge>
            <Badge className="border border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/10">
              下支路 {bottomCategories.length}
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="relative min-w-[1100px] overflow-hidden rounded-xl border border-slate-800 bg-[#050816]">
            <div className="relative aspect-[16/9]">
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="fishbone-spine-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#64748b" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                <path
                  d={`M ${TAIL_X} ${SPINE_Y}
                    L ${TAIL_X - 42} ${SPINE_Y - 54}
                    Q ${TAIL_X - 18} ${SPINE_Y - 28}, ${TAIL_X + 8} ${SPINE_Y - 10}
                    L ${TAIL_X + 8} ${SPINE_Y + 10}
                    Q ${TAIL_X - 18} ${SPINE_Y + 28}, ${TAIL_X - 42} ${SPINE_Y + 54}
                    Z`}
                  fill="rgba(248, 250, 252, 0.03)"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                />

                <line
                  x1={TAIL_X}
                  y1={SPINE_Y}
                  x2={HEAD_X}
                  y2={SPINE_Y}
                  stroke="url(#fishbone-spine-gradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />

                {renderBranchLayer(topCategories, topAnchors, "top")}
                {renderBranchLayer(bottomCategories, bottomAnchors, "bottom")}

                <g>
                  <path
                    d={`M ${HEAD_X} ${SPINE_Y}
                      C ${HEAD_X + 14} ${SPINE_Y - HEAD_HEIGHT}, ${HEAD_X + HEAD_WIDTH * 0.55} ${SPINE_Y - HEAD_HEIGHT}, ${HEAD_X + HEAD_WIDTH} ${SPINE_Y}
                      C ${HEAD_X + HEAD_WIDTH * 0.55} ${SPINE_Y + HEAD_HEIGHT}, ${HEAD_X + 14} ${SPINE_Y + HEAD_HEIGHT}, ${HEAD_X} ${SPINE_Y}
                      Z`}
                    fill="rgba(248, 250, 252, 0.05)"
                    stroke="#f8fafc"
                    strokeWidth="2"
                  />
                  <circle
                    cx={HEAD_X + HEAD_WIDTH * 0.48}
                    cy={SPINE_Y - HEAD_HEIGHT * 0.28}
                    r="9"
                    fill="#020617"
                    stroke="#f8fafc"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={HEAD_X + HEAD_WIDTH * 0.48}
                    cy={SPINE_Y - HEAD_HEIGHT * 0.28}
                    r="4.5"
                    fill="#f8fafc"
                  />
                </g>

                <text x="34" y={SVG_HEIGHT - 18} fill="#64748b" style={{ fontSize: "12px" }}>
                  Fishbone / Ishikawa Diagram
                </text>
              </svg>

              <div className="absolute inset-0">
                <div
                  data-fishbone-role="problem-card"
                  className="absolute rounded-xl border border-violet-400/40 bg-slate-900/95 px-4 py-3 text-slate-100 shadow-lg shadow-violet-950/30"
                  style={{
                    left: `${(PROBLEM_CARD_LEFT / SVG_WIDTH) * 100}%`,
                    top: `${(PROBLEM_CARD_TOP / SVG_HEIGHT) * 100}%`,
                    width: `${(PROBLEM_CARD_WIDTH / SVG_WIDTH) * 100}%`,
                  }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Problem
                  </div>
                  <TextLineBlock
                    lines={problemLines}
                    className="mt-2 text-[14px] font-semibold text-slate-50"
                  />
                  {impactLines.length > 0 ? (
                    <TextLineBlock
                      lines={impactLines}
                      className="mt-3 text-[12px] text-slate-400"
                    />
                  ) : null}
                </div>

                {topCategories.map((category, index) => {
                  const anchorX = topAnchors[index];
                  const endX = anchorX - BRANCH_LENGTH * branchCos;
                  const endY = SPINE_Y - BRANCH_LENGTH * branchSin;
                  const visibleCauses = category.causes.slice(0, MAX_VISIBLE_CAUSES);
                  const hiddenCauseCount = Math.max(0, category.causes.length - visibleCauses.length);
                  const isSelected = category.id === selectedCategory?.id;
                  const titleLines = wrapLabel(category.title, "category");

                  return (
                    <div key={category.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        data-fishbone-role="category-card"
                        className={cn(
                          "absolute rounded-lg border px-3 py-2 text-center shadow-md transition-transform hover:-translate-y-[102%]",
                          isSelected
                            ? "border-violet-400/50 bg-violet-500/15 text-slate-100"
                            : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                        )}
                        style={{
                          left: `${((endX - CATEGORY_CARD_WIDTH / 2) / SVG_WIDTH) * 100}%`,
                          top: `${((endY - 62) / SVG_HEIGHT) * 100}%`,
                          width: `${(CATEGORY_CARD_WIDTH / SVG_WIDTH) * 100}%`,
                        }}
                      >
                        <TextLineBlock
                          lines={titleLines}
                          align="center"
                          className="text-[13px] font-semibold text-slate-100"
                        />
                        <div
                          className={cn(
                            "mt-1 text-[11px] uppercase tracking-[0.18em]",
                            isSelected ? "text-violet-200" : "text-emerald-200/80"
                          )}
                        >
                          {category.titleEn}
                        </div>
                        {hiddenCauseCount > 0 ? (
                          <div className="mt-1 text-[10px] font-medium text-slate-300/80">
                            +{hiddenCauseCount} 条
                          </div>
                        ) : null}
                      </button>

                      {visibleCauses.map((cause, causeIndex) => {
                        const ratio = getCauseRatios(visibleCauses.length)[causeIndex] ?? 0.5;
                        const ribJointX = anchorX - ratio * BRANCH_LENGTH * branchCos;
                        const ribJointY = SPINE_Y - ratio * BRANCH_LENGTH * branchSin;
                        const ribEndX = ribJointX - RIB_LENGTH;
                        const causeLines = wrapLabel(cause.text, "cause");
                        const causeCardX = Math.max(26, ribEndX - CAUSE_CARD_WIDTH - 10);

                        return (
                          <div
                            key={cause.id}
                            data-fishbone-role="cause-label"
                            data-line-count={causeLines.length}
                            title={cause.text}
                            className={cn(
                              "pointer-events-none absolute rounded-md px-3 py-2 text-[12px] shadow-sm",
                              isSelected
                                ? "bg-violet-500/15 text-violet-50"
                                : "bg-emerald-500/10 text-emerald-50"
                            )}
                            style={{
                              left: `${(causeCardX / SVG_WIDTH) * 100}%`,
                              top: `${(ribJointY / SVG_HEIGHT) * 100}%`,
                              width: `${(CAUSE_CARD_WIDTH / SVG_WIDTH) * 100}%`,
                              transform: "translateY(-50%)",
                            }}
                          >
                            <TextLineBlock lines={causeLines} align="right" />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {bottomCategories.map((category, index) => {
                  const anchorX = bottomAnchors[index];
                  const endX = anchorX - BRANCH_LENGTH * branchCos;
                  const endY = SPINE_Y + BRANCH_LENGTH * branchSin;
                  const visibleCauses = category.causes.slice(0, MAX_VISIBLE_CAUSES);
                  const hiddenCauseCount = Math.max(0, category.causes.length - visibleCauses.length);
                  const isSelected = category.id === selectedCategory?.id;
                  const titleLines = wrapLabel(category.title, "category");

                  return (
                    <div key={category.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryId(category.id)}
                        data-fishbone-role="category-card"
                        className={cn(
                          "absolute rounded-lg border px-3 py-2 text-center shadow-md transition-transform hover:translate-y-[2%]",
                          isSelected
                            ? "border-violet-400/50 bg-violet-500/15 text-slate-100"
                            : "border-sky-400/20 bg-sky-500/10 text-sky-100"
                        )}
                        style={{
                          left: `${((endX - CATEGORY_CARD_WIDTH / 2) / SVG_WIDTH) * 100}%`,
                          top: `${((endY + 20) / SVG_HEIGHT) * 100}%`,
                          width: `${(CATEGORY_CARD_WIDTH / SVG_WIDTH) * 100}%`,
                        }}
                      >
                        <TextLineBlock
                          lines={titleLines}
                          align="center"
                          className="text-[13px] font-semibold text-slate-100"
                        />
                        <div
                          className={cn(
                            "mt-1 text-[11px] uppercase tracking-[0.18em]",
                            isSelected ? "text-violet-200" : "text-sky-200/80"
                          )}
                        >
                          {category.titleEn}
                        </div>
                        {hiddenCauseCount > 0 ? (
                          <div className="mt-1 text-[10px] font-medium text-slate-300/80">
                            +{hiddenCauseCount} 条
                          </div>
                        ) : null}
                      </button>

                      {visibleCauses.map((cause, causeIndex) => {
                        const ratio = getCauseRatios(visibleCauses.length)[causeIndex] ?? 0.5;
                        const ribJointX = anchorX - ratio * BRANCH_LENGTH * branchCos;
                        const ribJointY = SPINE_Y + ratio * BRANCH_LENGTH * branchSin;
                        const ribEndX = ribJointX - RIB_LENGTH;
                        const causeLines = wrapLabel(cause.text, "cause");
                        const causeCardX = Math.max(26, ribEndX - CAUSE_CARD_WIDTH - 10);

                        return (
                          <div
                            key={cause.id}
                            data-fishbone-role="cause-label"
                            data-line-count={causeLines.length}
                            title={cause.text}
                            className={cn(
                              "pointer-events-none absolute rounded-md px-3 py-2 text-[12px] shadow-sm",
                              isSelected
                                ? "bg-violet-500/15 text-violet-50"
                                : "bg-sky-500/10 text-sky-50"
                            )}
                            style={{
                              left: `${(causeCardX / SVG_WIDTH) * 100}%`,
                              top: `${(ribJointY / SVG_HEIGHT) * 100}%`,
                              width: `${(CAUSE_CARD_WIDTH / SVG_WIDTH) * 100}%`,
                              transform: "translateY(-50%)",
                            }}
                          >
                            <TextLineBlock lines={causeLines} align="right" />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 md:px-5">
            <div>
              <div className="text-sm font-semibold text-slate-100">分类列表</div>
              <div className="mt-1 text-xs text-slate-500">
                先选分类，再在右侧集中维护原因。
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCategory}
              className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              添加分类
            </Button>
          </div>
          <div className="divide-y divide-slate-800">
            {diagram.categories.map((category) => {
              const isActive = category.id === selectedCategory?.id;
              return (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-4 transition-colors md:px-5",
                    isActive ? "bg-slate-800/60" : "bg-transparent"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{category.title}</span>
                      <Badge
                        className={
                          category.branch === "top"
                            ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10"
                            : "border border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/10"
                        }
                      >
                        {getFishboneBranchLabel(category.branch)}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-slate-500">
                      {category.titleEn || "Untitled"}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {category.causes.length} 条原因
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCategory(category.id)}
                    disabled={diagram.categories.length <= 2}
                    className="text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded border border-slate-800 bg-slate-900 p-4 md:p-6">
          {selectedCategory ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-slate-100">
                    {selectedCategory.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    调整分类名称、支路位置和原因清单，图上会即时刷新。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedCategory.branch === "top" ? "default" : "outline"}
                    onClick={() =>
                      updateCategory(selectedCategory.id, (category) => ({
                        ...category,
                        branch: "top",
                      }))
                    }
                    className={
                      selectedCategory.branch === "top"
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
                    }
                  >
                    <ArrowUp className="h-4 w-4" />
                    放到上支路
                  </Button>
                  <Button
                    type="button"
                    variant={selectedCategory.branch === "bottom" ? "default" : "outline"}
                    onClick={() =>
                      updateCategory(selectedCategory.id, (category) => ({
                        ...category,
                        branch: "bottom",
                      }))
                    }
                    className={
                      selectedCategory.branch === "bottom"
                        ? "bg-sky-600 text-white hover:bg-sky-500"
                        : "border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
                    }
                  >
                    <ArrowDown className="h-4 w-4" />
                    放到下支路
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">分类名称</label>
                  <Input
                    value={selectedCategory.title}
                    onChange={(event) =>
                      updateCategory(selectedCategory.id, (category) => ({
                        ...category,
                        title: event.target.value,
                      }))
                    }
                    className="border-slate-700 bg-slate-950/60 text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">英文标签</label>
                  <Input
                    value={selectedCategory.titleEn}
                    onChange={(event) =>
                      updateCategory(selectedCategory.id, (category) => ({
                        ...category,
                        titleEn: event.target.value,
                      }))
                    }
                    className="border-slate-700 bg-slate-950/60 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">原因清单</div>
                  <div className="mt-1 text-xs text-slate-500">
                    建议每条原因短而具体，图上自动按固定宽度换成多行。
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addCause(selectedCategory.id)}
                  className="border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800 hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  添加原因
                </Button>
              </div>

              <div className="grid gap-3">
                {selectedCategory.causes.map((cause, index) => (
                  <div
                    key={cause.id}
                    className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-[48px_minmax(0,1fr)_44px]"
                  >
                    <div className="flex items-center text-xs font-semibold tracking-[0.16em] text-slate-500">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <Input
                      value={cause.text}
                      onChange={(event) =>
                        updateCategory(selectedCategory.id, (category) => ({
                          ...category,
                          causes: category.causes.map((item) =>
                            item.id === cause.id ? { ...item, text: event.target.value } : item
                          ),
                        }))
                      }
                      className="border-slate-700 bg-slate-950/60 text-slate-100"
                      placeholder="例如：模温波动、验收标准不一致、回归用例缺失"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCause(selectedCategory.id, cause.id)}
                      disabled={selectedCategory.causes.length <= 1}
                      className="text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
