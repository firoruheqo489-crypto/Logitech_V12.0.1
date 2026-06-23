import { jStat } from "jstat";
import { useEffect, useState, type ReactNode } from "react";

type TwoWayAnovaDesignRow = {
  id: string;
  factorA: string;
  factorB: string;
  response: number;
};

export type TwoWayAnovaAnalysisResult = {
  factorAName: string;
  factorBName: string;
  responseName: string;
  levelsA: string[];
  levelsB: string[];
  replicatesPerCell: number;
  totalN: number;
  grandMean: number;
  dfA: number;
  dfB: number;
  dfInteraction: number;
  dfError: number;
  dfTotal: number;
  ssA: number;
  ssB: number;
  ssInteraction: number;
  ssError: number;
  ssTotal: number;
  msA: number;
  msB: number;
  msInteraction: number;
  msError: number;
  fA: number;
  fB: number;
  fInteraction: number;
  pA: number;
  pB: number;
  pInteraction: number;
  criticalA: number;
  criticalB: number;
  criticalInteraction: number;
  rejectA: boolean;
  rejectB: boolean;
  rejectInteraction: boolean;
  rSquared: number;
  rSquaredAdj: number;
  meanA: Array<{ level: string; mean: number; stdev: number; n: number }>;
  meanB: Array<{ level: string; mean: number; stdev: number; n: number }>;
  meanCells: Array<{ factorA: string; factorB: string; mean: number }>;
  residuals: Array<{ fitted: number; residual: number; factorA: string; factorB: string }>;
};

type TwoWayAnovaWorkbenchProps = {
  factorAName: string;
  factorBName: string;
  responseName: string;
  rows: TwoWayAnovaDesignRow[];
  h0: string;
  h1: string;
  reject: boolean;
  matrixInput: string;
  validCount: number;
  alpha: number;
  analysis?: TwoWayAnovaAnalysisResult | null;
  onGenerateSnapshot: () => void;
  onAlphaChange: (value: number) => void;
  onMatrixChange: (value: string) => void;
  onFactorANameChange: (value: string) => void;
  onFactorBNameChange: (value: string) => void;
  onResponseNameChange: (value: string) => void;
};

type MatrixSummary = {
  levelsA: string[];
  levelsB: string[];
  totalCells: number;
  observedCells: number;
  coverage: number;
  minReplicates: number;
  maxReplicates: number;
  balanced: boolean;
  balanceError: string | null;
  missingCells: Array<{ factorA: string; factorB: string }>;
};

type EditableMatrixRow = {
  id: string;
  factorA: string;
  factorB: string;
  response: string;
};

function summarizeMatrix(rows: TwoWayAnovaDesignRow[]): MatrixSummary {
  const levelsA = Array.from(new Set(rows.map((row) => row.factorA.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );
  const levelsB = Array.from(new Set(rows.map((row) => row.factorB.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = `${row.factorA}__${row.factorB}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const totalCells = levelsA.length * levelsB.length;
  const observedCells = counts.size;
  const coverage = totalCells > 0 ? observedCells / totalCells : 0;
  const countValues = Array.from(counts.values());
  const minReplicates = countValues.length ? Math.min(...countValues) : 0;
  const maxReplicates = countValues.length ? Math.max(...countValues) : 0;
  const missingCells: Array<{ factorA: string; factorB: string }> = [];

  levelsA.forEach((factorA) => {
    levelsB.forEach((factorB) => {
      if (!counts.has(`${factorA}__${factorB}`)) {
        missingCells.push({ factorA, factorB });
      }
    });
  });

  const balanced =
    countValues.length > 0 &&
    countValues.every((count) => count === countValues[0]) &&
    missingCells.length === 0;
  const balanceError =
    rows.length > 0 && !balanced
      ? "[SYS_ERR] 非平衡设计 (Unbalanced Design). 双因子方差分析需要各交叉水平样本量一致。"
      : null;

  return {
    levelsA,
    levelsB,
    totalCells,
    observedCells,
    coverage,
    minReplicates,
    maxReplicates,
    balanced,
    balanceError,
    missingCells,
  };
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="glass rounded-2xl border border-white/8 p-4">
      <div className="mb-3 border-b border-white/5 pb-3">
        <h3 className="text-sm font-bold tracking-wide text-foreground">{title}</h3>
        <p className="font-num text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function valueDomain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 1e-6);
  return { min: min - padding, max: max + padding };
}

function statsMean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function statsVariance(values: number[]) {
  if (values.length < 2) return 0;
  const avg = statsMean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function formatPValue(value: number) {
  return value < 0.0001 ? "< 0.0001" : value.toFixed(4);
}

function serializeTwoWayRows(rows: EditableMatrixRow[]) {
  return rows
    .map((row) => `${row.factorA}\t${row.factorB}\t${row.response}`)
    .join("\n");
}

async function readClipboardText() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

function factorLabelZh(name: string, fallback: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized.includes("supplier")) return "供应商";
  if (normalized.includes("temperature")) return "温度";
  if (normalized.includes("response")) return "响应值";
  if (normalized.includes("factor a")) return "因子 1";
  if (normalized.includes("factor b")) return "因子 2";
  return name.trim();
}

function TriVerdictCard({
  title,
  pValue,
  active,
  emphasize = false,
  alpha,
}: {
  title: string;
  pValue: number;
  active: boolean;
  emphasize?: boolean;
  alpha: number;
}) {
  const criticalGlow = active && pValue < alpha;
  return (
    <div
      className={`rounded-2xl border px-5 py-6 ${
        active
          ? emphasize
            ? "border-red-400/30 bg-red-500/[0.08] shadow-[0_0_22px_rgba(239,68,68,0.18)]"
            : "border-cyan-400/25 bg-cyan-500/[0.06] shadow-[0_0_18px_rgba(34,211,238,0.12)]"
          : "border-white/8 bg-black/25"
      }`}
    >
      <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      <div className="flex min-h-[56px] flex-col items-center justify-center text-center">
        <div
          className={`font-num text-3xl font-bold tracking-tight sm:text-4xl ${
            active ? (emphasize ? "text-red-200" : "text-cyan-200") : "text-foreground"
          } ${
            criticalGlow
              ? emphasize
                ? "drop-shadow-[0_0_15px_rgba(255,0,60,0.8)]"
                : "drop-shadow-[0_0_15px_rgba(0,243,255,0.55)]"
              : ""
          }`}
        >
          {formatPValue(pValue)}
        </div>
        <div className={`font-num mt-2 text-[10px] uppercase tracking-[0.18em] ${active ? (emphasize ? "text-red-200/75" : "text-cyan-200/75") : "text-muted-foreground"}`}>
          {active ? "REJECT H0" : "H0 HOLDS"}
        </div>
      </div>
    </div>
  );
}

function MainEffectsPlot({
  title,
  values,
  grandMean,
}: {
  title: string;
  values: Array<{ level: string; mean: number }>;
  grandMean: number;
}) {
  const W = 420;
  const H = 220;
  const PAD_L = 42;
  const PAD_R = 18;
  const PAD_T = 20;
  const PAD_B = 34;
  const domain = valueDomain([...values.map((item) => item.mean), grandMean]);
  const xScale = (index: number) =>
    PAD_L + (values.length <= 1 ? 0 : (index / (values.length - 1)) * (W - PAD_L - PAD_R));
  const yScale = (value: number) =>
    PAD_T + (H - PAD_T - PAD_B) - ((value - domain.min) / (domain.max - domain.min || 1)) * (H - PAD_T - PAD_B);
  const polyline = values.map((item, index) => `${xScale(index)},${yScale(item.mean)}`).join(" ");
  const grandY = yScale(grandMean);

  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        <line x1={PAD_L} y1={grandY} x2={W - PAD_R} y2={grandY} stroke="rgba(34,211,238,0.55)" strokeWidth="1.2" strokeDasharray="4 4" />
        <polyline points={polyline} fill="none" stroke="oklch(0.88 0.14 200)" strokeWidth="2.2" />
        {values.map((item, index) => (
          <g key={item.level}>
            <circle cx={xScale(index)} cy={yScale(item.mean)} r="4" fill="oklch(0.88 0.14 200)" />
            <text x={xScale(index)} y={H - 10} textAnchor="middle" className="font-num" fontSize="9" fill="rgba(255,255,255,0.72)">
              {item.level}
            </text>
            <text x={xScale(index)} y={yScale(item.mean) - 10} textAnchor="middle" className="font-num" fontSize="9" fill="oklch(0.88 0.14 200)">
              {item.mean.toFixed(4)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function InteractionPlot({
  factorAName,
  factorBName,
  levelsA,
  levelsB,
  cellMeans,
}: {
  factorAName: string;
  factorBName: string;
  levelsA: string[];
  levelsB: string[];
  cellMeans: Array<{ factorA: string; factorB: string; mean: number }>;
}) {
  const W = 520;
  const H = 230;
  const PAD_L = 42;
  const PAD_R = 18;
  const PAD_T = 20;
  const PAD_B = 36;
  const colors = ["oklch(0.88 0.14 200)", "#FF6B81", "#fbbf24", "#c084fc", "#4ade80"];
  const domain = valueDomain(cellMeans.map((item) => item.mean));
  const xScale = (index: number) =>
    PAD_L + (levelsA.length <= 1 ? 0 : (index / (levelsA.length - 1)) * (W - PAD_L - PAD_R));
  const yScale = (value: number) =>
    PAD_T + (H - PAD_T - PAD_B) - ((value - domain.min) / (domain.max - domain.min || 1)) * (H - PAD_T - PAD_B);

  return (
    <div className="glass rounded-2xl border border-white/8 p-4 min-h-[250px]">
      <div className="mb-3 border-b border-white/5 pb-3">
        <h3 className="text-sm font-bold tracking-wide text-foreground">[ 交互作用图 / INTERACTION PLOT ]</h3>
        <p className="font-num text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {factorAName} × {factorBName}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Interaction plot">
        {levelsB.map((levelB, seriesIndex) => {
          const color = colors[seriesIndex % colors.length];
          const points = levelsA.map((levelA) => {
            const match = cellMeans.find((item) => item.factorA === levelA && item.factorB === levelB);
            return { x: xScale(levelsA.indexOf(levelA)), y: yScale(match?.mean ?? 0), mean: match?.mean ?? 0 };
          });
          return (
            <g key={levelB}>
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth="2.4"
              />
              {points.map((point, index) => (
                <g key={`${levelB}-${levelsA[index]}`}>
                  <circle cx={point.x} cy={point.y} r="4.2" fill={color} />
                  <circle cx={point.x} cy={point.y} r="8" fill={color} opacity="0.15" />
                </g>
              ))}
              <text x={W - PAD_R} y={PAD_T + 12 + seriesIndex * 12} textAnchor="end" className="font-num" fontSize="9" fill={color}>
                {levelB}
              </text>
            </g>
          );
        })}
        {levelsA.map((levelA, index) => (
          <text key={levelA} x={xScale(index)} y={H - 10} textAnchor="middle" className="font-num" fontSize="9" fill="rgba(255,255,255,0.72)">
            {levelA}
          </text>
        ))}
      </svg>
    </div>
  );
}

function CellMeansHeatmap({
  factorAName,
  factorBName,
  levelsA,
  levelsB,
  cellMeans,
}: {
  factorAName: string;
  factorBName: string;
  levelsA: string[];
  levelsB: string[];
  cellMeans: Array<{ factorA: string; factorB: string; mean: number }>;
}) {
  const values = cellMeans.map((item) => item.mean);
  const domain = valueDomain(values);
  const normalize = (value: number) => (value - domain.min) / (domain.max - domain.min || 1);

  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">
        Cell Means Heatmap · {factorAName} × {factorBName}
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-[420px]">
          <div
            className="grid gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
            style={{ gridTemplateColumns: `1.1fr repeat(${levelsB.length}, minmax(0, 1fr))` }}
          >
            <span>{factorAName} \\ {factorBName}</span>
            {levelsB.map((levelB) => (
              <span key={levelB} className="text-center">{levelB}</span>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {levelsA.map((levelA) => (
              <div
                key={levelA}
                className="grid gap-2"
                style={{ gridTemplateColumns: `1.1fr repeat(${levelsB.length}, minmax(0, 1fr))` }}
              >
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm font-semibold text-foreground">
                  {levelA}
                </div>
                {levelsB.map((levelB) => {
                  const cell = cellMeans.find((item) => item.factorA === levelA && item.factorB === levelB);
                  const value = cell?.mean ?? 0;
                  const normalized = normalize(value);
                  const background = `linear-gradient(180deg, rgba(15,23,42,0.55), rgba(15,23,42,0.72)), rgba(${Math.round(34 + normalized * 205)}, ${Math.round(211 - normalized * 120)}, ${Math.round(238 - normalized * 170)}, ${0.18 + normalized * 0.28})`;
                  return (
                    <div key={`${levelA}-${levelB}`} className="rounded-lg border border-white/8 px-3 py-2 text-center" style={{ background }}>
                      <div className="font-num text-sm font-bold text-foreground">{value.toFixed(4)}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResidualScatterPlot({
  residuals,
}: {
  residuals: Array<{ fitted: number; residual: number; factorA: string; factorB: string }>;
}) {
  const W = 420;
  const H = 220;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 20;
  const PAD_B = 34;
  const fittedDomain = valueDomain(residuals.map((item) => item.fitted));
  const residualDomain = valueDomain([...residuals.map((item) => item.residual), 0]);
  const xScale = (value: number) =>
    PAD_L + ((value - fittedDomain.min) / (fittedDomain.max - fittedDomain.min || 1)) * (W - PAD_L - PAD_R);
  const yScale = (value: number) =>
    PAD_T + (H - PAD_T - PAD_B) - ((value - residualDomain.min) / (residualDomain.max - residualDomain.min || 1)) * (H - PAD_T - PAD_B);
  const zeroY = yScale(0);

  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">Residuals vs Fitted</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Residuals vs fitted">
        <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="rgba(34,211,238,0.5)" strokeWidth="1.2" strokeDasharray="4 4" />
        {residuals.map((item, index) => (
          <circle key={`${item.factorA}-${item.factorB}-${index}`} cx={xScale(item.fitted)} cy={yScale(item.residual)} r="3.2" fill="oklch(0.88 0.14 200)" opacity="0.9" />
        ))}
      </svg>
    </div>
  );
}

function ResidualQQPlot({
  residuals,
}: {
  residuals: Array<{ fitted: number; residual: number; factorA: string; factorB: string }>;
}) {
  const W = 420;
  const H = 220;
  const PAD = 24;
  const values = residuals.map((item) => item.residual).sort((left, right) => left - right);
  const avg = statsMean(values);
  const sigma = Math.sqrt(statsVariance(values)) || 1e-9;
  const points = values.map((value, index) => ({
    theoretical: jStat.normal.inv((index + 0.5) / values.length, 0, 1),
    sample: (value - avg) / sigma,
  }));
  const limit = Math.max(2.5, ...points.flatMap((point) => [Math.abs(point.theoretical), Math.abs(point.sample)]));
  const xScale = (value: number) => PAD + ((value + limit) / (2 * limit)) * (W - PAD * 2);
  const yScale = (value: number) => PAD + (H - PAD * 2) - ((value + limit) / (2 * limit)) * (H - PAD * 2);

  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">Residual Normal Q-Q</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Residual QQ plot">
        <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1={xScale(-limit)} y1={yScale(-limit)} x2={xScale(limit)} y2={yScale(limit)} stroke="rgba(34,211,238,0.65)" strokeWidth="1.2" strokeDasharray="4 4" />
        {points.map((point, index) => (
          <circle key={index} cx={xScale(point.theoretical)} cy={yScale(point.sample)} r="3" fill="#FF6B81" />
        ))}
      </svg>
    </div>
  );
}

function ResidualHistogram({
  residuals,
}: {
  residuals: Array<{ fitted: number; residual: number; factorA: string; factorB: string }>;
}) {
  const W = 420;
  const H = 220;
  const PAD_L = 26;
  const PAD_R = 16;
  const PAD_T = 18;
  const PAD_B = 28;
  const values = residuals.map((item) => item.residual);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(8, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const step = (max - min || 1) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + index * step;
    const end = index === binCount - 1 ? max + 1e-9 : start + step;
    const count = values.filter((value) => value >= start && value < end).length;
    return { start, end, count };
  });
  const peak = Math.max(...bins.map((bin) => bin.count), 1);
  const plotWidth = W - PAD_L - PAD_R;
  const plotHeight = H - PAD_T - PAD_B;
  const barWidth = plotWidth / binCount;

  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">Residual Histogram</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Residual histogram">
        {bins.map((bin, index) => {
          const height = (bin.count / peak) * plotHeight;
          return (
            <rect
              key={index}
              x={PAD_L + index * barWidth + 3}
              y={PAD_T + plotHeight - height}
              width={Math.max(barWidth - 6, 6)}
              height={height}
              fill="rgba(34,211,238,0.7)"
              stroke="rgba(34,211,238,0.9)"
              rx="2"
            />
          );
        })}
      </svg>
    </div>
  );
}

function ResidualOrderPlot({
  residuals,
}: {
  residuals: Array<{ fitted: number; residual: number; factorA: string; factorB: string }>;
}) {
  const W = 420;
  const H = 220;
  const PAD_L = 30;
  const PAD_R = 16;
  const PAD_T = 18;
  const PAD_B = 28;
  const domain = valueDomain([...residuals.map((item) => item.residual), 0]);
  const xScale = (index: number) =>
    PAD_L + (residuals.length <= 1 ? 0 : (index / (residuals.length - 1)) * (W - PAD_L - PAD_R));
  const yScale = (value: number) =>
    PAD_T + (H - PAD_T - PAD_B) - ((value - domain.min) / (domain.max - domain.min || 1)) * (H - PAD_T - PAD_B);
  const zeroY = yScale(0);
  const polyline = residuals.map((item, index) => `${xScale(index)},${yScale(item.residual)}`).join(" ");

  return (
    <div className="rounded-xl border border-white/8 bg-black/25 p-3">
      <div className="mb-2 text-sm font-semibold text-foreground">Residuals vs Order</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Residuals vs order">
        <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="rgba(34,211,238,0.5)" strokeWidth="1.2" strokeDasharray="4 4" />
        <polyline points={polyline} fill="none" stroke="rgba(34,211,238,0.9)" strokeWidth="2" />
        {residuals.map((item, index) => (
          <circle key={index} cx={xScale(index)} cy={yScale(item.residual)} r="3" fill="rgba(34,211,238,0.95)" />
        ))}
      </svg>
    </div>
  );
}

export function TwoWayAnovaSidebarStack({
  factorAName,
  factorBName,
  analysis,
}: {
  factorAName: string;
  factorBName: string;
  analysis: TwoWayAnovaAnalysisResult | null | undefined;
}) {
  const levelsA = analysis?.levelsA ?? ["A1", "A2", "A3"];
  const levelsB = analysis?.levelsB ?? ["B1", "B2"];
  const cellMeans = analysis?.meanCells ?? [
    { factorA: levelsA[0], factorB: levelsB[0], mean: 0.3 },
    { factorA: levelsA[1] ?? "A2", factorB: levelsB[0], mean: 0.5 },
    { factorA: levelsA[2] ?? "A3", factorB: levelsB[0], mean: 0.4 },
    { factorA: levelsA[0], factorB: levelsB[1] ?? "B2", mean: 0.2 },
    { factorA: levelsA[1] ?? "A2", factorB: levelsB[1] ?? "B2", mean: 0.45 },
    { factorA: levelsA[2] ?? "A3", factorB: levelsB[1] ?? "B2", mean: 0.65 },
  ];

  return (
    <div className="grid gap-3">
      <InteractionPlot
        factorAName={factorAName}
        factorBName={factorBName}
        levelsA={levelsA}
        levelsB={levelsB}
        cellMeans={cellMeans}
      />
    </div>
  );
}

export function TwoWayAnovaWorkbench({
  factorAName,
  factorBName,
  responseName,
  rows,
  h0,
  h1,
  reject,
  matrixInput,
  validCount,
  alpha,
  analysis,
  onGenerateSnapshot,
  onAlphaChange,
  onMatrixChange,
  onFactorANameChange,
  onFactorBNameChange,
  onResponseNameChange,
}: TwoWayAnovaWorkbenchProps) {
  const summary = summarizeMatrix(rows);
  const [editableRows, setEditableRows] = useState<EditableMatrixRow[]>([]);

  useEffect(() => {
    setEditableRows(
      rows.map((row) => ({
        id: row.id,
        factorA: row.factorA,
        factorB: row.factorB,
        response: row.response.toFixed(4),
      })),
    );
  }, [rows]);
  const factorAZh = factorLabelZh(factorAName, "因子 1");
  const factorBZh = factorLabelZh(factorBName, "因子 2");
  const responseZh = factorLabelZh(responseName, "响应值");
  const sortedConclusions = analysis
    ? [
        {
          title: `主效应: ${analysis.factorAName}`,
          reject: analysis.rejectA,
          pValue: analysis.pA,
          priority: analysis.rejectInteraction ? 1 : analysis.rejectA ? 0 : 3,
          statement: analysis.rejectA
            ? `${analysis.factorAName} 主效应显著，不同水平会稳定改变 ${analysis.responseName}。`
            : `${analysis.factorAName} 主效应暂未显著，当前水平变化尚未形成稳定差异。`,
        },
        {
          title: `主效应: ${analysis.factorBName}`,
          reject: analysis.rejectB,
          pValue: analysis.pB,
          priority: analysis.rejectInteraction ? 2 : analysis.rejectB ? (analysis.rejectA ? 1 : 0) : 4,
          statement: analysis.rejectB
            ? `${analysis.factorBName} 主效应显著，需要进一步定位哪个水平在推高或压低 ${analysis.responseName}。`
            : `${analysis.factorBName} 主效应暂未显著，当前切换尚未形成统计锁定。`,
        },
        {
          title: `交互效应: ${analysis.factorAName} × ${analysis.factorBName}`,
          reject: analysis.rejectInteraction,
          pValue: analysis.pInteraction,
          priority: analysis.rejectInteraction ? 0 : 5,
          statement: analysis.rejectInteraction
            ? `交互显著，${analysis.factorAName} 的影响取决于 ${analysis.factorBName} 当前所处水平。`
            : "交互效应暂未显著，主效应可以相对独立地解释。",
        },
      ].sort((left, right) => left.priority - right.priority || left.pValue - right.pValue)
    : [];
  const modelSummary = analysis
    ? {
        s: Math.sqrt(analysis.msError),
        rSquared: (analysis.ssA + analysis.ssB + analysis.ssInteraction) / (analysis.ssTotal || 1),
        rSquaredAdj: analysis.rSquaredAdj,
      }
    : null;
  const hasMatrixRows = rows.length > 0;

  function handleMatrixPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    if (pasted.trim()) {
      onMatrixChange(pasted);
    }
  }

  function handleGridCellChange(id: string, field: "factorA" | "factorB" | "response", value: string) {
    setEditableRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function handleGridCommit() {
    onMatrixChange(serializeTwoWayRows(editableRows));
  }

  return (
    <div className="grid grid-cols-12 gap-5 max-h-full overflow-hidden">
      <div className="col-span-12">
        <Panel title="[ 多维数据矩阵注入 / MULTI-FACTOR MATRIX INGESTION ]" subtitle="FACTOR A · FACTOR B · RESPONSE">
          <div className="mb-4 grid gap-4 xl:grid-cols-3">
            <TriVerdictCard
              title={`主效应: ${factorAName}`}
              pValue={analysis?.pA ?? 1}
              active={analysis?.rejectA ?? false}
              alpha={alpha}
            />
            <TriVerdictCard
              title={`主效应: ${factorBName}`}
              pValue={analysis?.pB ?? 1}
              active={analysis?.rejectB ?? false}
              alpha={alpha}
            />
            <TriVerdictCard
              title={`交互效应: ${factorAName} × ${factorBName}`}
              pValue={analysis?.pInteraction ?? 1}
              active={analysis?.rejectInteraction ?? false}
              alpha={alpha}
              emphasize
            />
          </div>
          <div className="mb-4 recessed rounded-lg border border-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-wide text-foreground">假设陈述</span>
                <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Hypothesis Statement
                </span>
              </div>
              <span className={`font-num text-[9px] uppercase tracking-[0.2em] ${reject ? "text-[var(--warning)]" : "text-primary"}`}>
                {reject ? "H1 Prevails" : "H0 Holds"}
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
              <div className="grid gap-2">
                <div className={`flex items-center gap-2 rounded-md p-2 ${reject ? "opacity-70 line-through decoration-[var(--warning)]/70" : "bg-primary/6"}`}>
                  <span className="font-num grid h-6 w-9 shrink-0 place-items-center rounded bg-primary/12 text-[11px] font-bold text-primary">H0</span>
                  <p className="font-num text-xs leading-relaxed text-foreground/85">{h0}</p>
                </div>
                <div className={`flex items-center gap-2 rounded-md p-2 ${reject ? "bg-[var(--warning)]/8" : "opacity-75"}`}>
                  <span className="font-num grid h-6 w-9 shrink-0 place-items-center rounded bg-[var(--rose-gold)]/15 text-[11px] font-bold text-[var(--rose-gold)]">H1</span>
                  <p className={`font-num text-xs leading-relaxed ${reject ? "text-[var(--warning)]" : "text-foreground/85"}`}>{h1}</p>
                </div>
              </div>
              <div className="rounded-md border border-white/6 bg-black/20 p-3">
                <div className="text-[11px] font-medium tracking-wide text-foreground/88">置信区间</div>
                <div className="font-num text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Confidence Level</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "99%", alphaValue: 0.01 },
                    { label: "95%", alphaValue: 0.05 },
                    { label: "90%", alphaValue: 0.1 },
                  ].map((option) => {
                    const isActive = Math.abs(alpha - option.alphaValue) < 1e-9;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => onAlphaChange(option.alphaValue)}
                        className={`font-num rounded-md border px-2 py-2 text-[11px] font-bold transition-all duration-200 ${
                          isActive
                            ? "border-cyan-400/55 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.16)]"
                            : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="font-num mt-3 text-[10px] text-muted-foreground">
                  当前 α = {alpha.toFixed(2)} / CI = {((1 - alpha) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
          <div className="mb-4 grid gap-3 xl:grid-cols-3">
            <div className="rounded-lg border border-white/6 bg-white/[0.02] px-4 py-2.5">
              <div className="text-[10px] font-medium tracking-wide text-foreground/82">因子 1 名称</div>
              <div className="font-num text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Factor A Name</div>
              <input
                type="text"
                value={factorAName}
                onChange={(event) => onFactorANameChange(event.target.value)}
                className="font-num mt-1.5 w-full bg-transparent text-sm font-semibold tracking-tight text-foreground outline-none"
                placeholder="Supplier"
              />
            </div>
            <div className="rounded-lg border border-white/6 bg-white/[0.02] px-4 py-2.5">
              <div className="text-[10px] font-medium tracking-wide text-foreground/82">因子 2 名称</div>
              <div className="font-num text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Factor B Name</div>
              <input
                type="text"
                value={factorBName}
                onChange={(event) => onFactorBNameChange(event.target.value)}
                className="font-num mt-1.5 w-full bg-transparent text-sm font-semibold tracking-tight text-foreground outline-none"
                placeholder="Temperature"
              />
            </div>
            <div className="rounded-lg border border-white/6 bg-white/[0.02] px-4 py-2.5">
              <div className="text-[10px] font-medium tracking-wide text-foreground/82">响应值名称</div>
              <div className="font-num text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Response Name</div>
              <input
                type="text"
                value={responseName}
                onChange={(event) => onResponseNameChange(event.target.value)}
                className="font-num mt-1.5 w-full bg-transparent text-sm font-semibold tracking-tight text-foreground outline-none"
                placeholder="Response"
              />
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-medium tracking-wide text-foreground/88">
                第1列填写{factorAZh}，第2列填写{factorBZh}，第3列填写{responseZh}
              </div>
              <div className="font-num text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Excel paste prefers Tab. CSV uses comma. Plain text fallback requires 2+ spaces between columns.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const pasted = await readClipboardText();
                  if (pasted.trim()) onMatrixChange(pasted);
                }}
                className="font-num rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:bg-cyan-500/16"
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => onMatrixChange("")}
                className="font-num rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
              >
                Clear
              </button>
              <div className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Valid Rows: {validCount}
              </div>
            </div>
          </div>
          <div
            className="overflow-hidden rounded-lg border border-white/5 bg-black/20"
            onPaste={handleMatrixPaste}
          >
            <div className="grid grid-cols-[.45fr_1.2fr_1.2fr_1fr_.55fr] items-center border-b border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="select-none cursor-default text-center leading-tight">
                <div className="text-[11px] font-medium tracking-wide text-foreground/88">序号</div>
                <div className="font-num text-[9px] uppercase tracking-[0.18em] text-cyan-200/75">Row</div>
              </div>
              <div className="px-2 text-center leading-tight">
                <input
                  type="text"
                  value={factorAName}
                  onChange={(event) => onFactorANameChange(event.target.value)}
                  className="font-num w-full bg-transparent text-center text-[11px] font-medium tracking-wide text-foreground/88 outline-none"
                  aria-label="Factor A header"
                />
                <div className="font-num text-[9px] uppercase tracking-[0.18em] text-cyan-200/75">Column 1</div>
              </div>
              <div className="px-2 text-center leading-tight">
                <input
                  type="text"
                  value={factorBName}
                  onChange={(event) => onFactorBNameChange(event.target.value)}
                  className="font-num w-full bg-transparent text-center text-[11px] font-medium tracking-wide text-foreground/88 outline-none"
                  aria-label="Factor B header"
                />
                <div className="font-num text-[9px] uppercase tracking-[0.18em] text-cyan-200/75">Column 2</div>
              </div>
              <div className="px-2 text-center leading-tight">
                <input
                  type="text"
                  value={responseName}
                  onChange={(event) => onResponseNameChange(event.target.value)}
                  className="font-num w-full bg-transparent text-center text-[11px] font-medium tracking-wide text-foreground/88 outline-none"
                  aria-label="Response header"
                />
                <div className="font-num text-[9px] uppercase tracking-[0.18em] text-cyan-200/75">Column 3</div>
              </div>
              <div className="select-none cursor-default text-center leading-tight">
                <div className="text-[11px] font-medium tracking-wide text-foreground/88">操作</div>
                <div className="font-num text-[9px] uppercase tracking-[0.18em] text-cyan-200/75">Del</div>
              </div>
            </div>
            {!hasMatrixRows ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center border border-dashed border-white/10 bg-gray-950/35 text-center" onPaste={handleMatrixPaste}>
                <div className="font-num mb-2 text-[18px] font-bold tracking-[0.22em] text-cyan-300">CTRL + V</div>
                <div className="text-sm font-semibold text-foreground">[ AWAITING TELEMETRY INGESTION ]</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  点击此区域后按 Ctrl+V，粘贴 3 列 Excel 数据
                </div>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto no-scrollbar w-full">
                {editableRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[.45fr_1.2fr_1.2fr_1fr_.55fr] items-center border-b border-gray-800/50 text-[11px] font-mono text-gray-300 hover:bg-gray-900/50"
                  >
                    <div className="border-r border-gray-800/50 px-3 py-1.5 text-center text-muted-foreground">
                      {editableRows.indexOf(row) + 1}
                    </div>
                    <div className="border-r border-gray-800/50 px-3 py-1.5">
                      <input
                        type="text"
                        value={row.factorA}
                        onChange={(event) => handleGridCellChange(row.id, "factorA", event.target.value)}
                        onBlur={handleGridCommit}
                        className="font-num w-full bg-transparent text-center text-[11px] text-gray-300 outline-none"
                      />
                    </div>
                    <div className="border-r border-gray-800/50 px-3 py-1.5">
                      <input
                        type="text"
                        value={row.factorB}
                        onChange={(event) => handleGridCellChange(row.id, "factorB", event.target.value)}
                        onBlur={handleGridCommit}
                        className="font-num w-full bg-transparent text-center text-[11px] text-gray-300 outline-none"
                      />
                    </div>
                    <div className="px-3 py-1.5">
                      <input
                        type="text"
                        value={row.response}
                        onChange={(event) => handleGridCellChange(row.id, "response", event.target.value)}
                        onBlur={handleGridCommit}
                        className="font-num w-full bg-transparent text-center text-[11px] text-cyan-400 outline-none"
                      />
                    </div>
                    <div className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const nextRows = editableRows.filter((item) => item.id !== row.id);
                          setEditableRows(nextRows);
                          onMatrixChange(serializeTwoWayRows(nextRows));
                        }}
                        className="font-num rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {analysis ? (
        <>
          <div className="col-span-12">
            <Panel title="[ 双因子方差分析表 / TWO-WAY ANOVA TABLE ]" subtitle="FACTOR A · FACTOR B · INTERACTION · ERROR · TOTAL">
              <div className="overflow-x-auto no-scrollbar">
                <div className="min-w-[760px] font-mono tracking-tight">
                  <div className="grid grid-cols-[1.8fr_.7fr_1fr_1fr_.9fr_.9fr] gap-x-3 border-b border-white/10 pb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                    <span>Source</span>
                    <span className="text-right">DF</span>
                    <span className="text-right">SS</span>
                    <span className="text-right">MS</span>
                    <span className="text-right">F</span>
                    <span className="text-right">P</span>
                  </div>
                  {[
                    [analysis.factorAName, analysis.dfA, analysis.ssA, analysis.msA, analysis.fA, formatPValue(analysis.pA)],
                    [analysis.factorBName, analysis.dfB, analysis.ssB, analysis.msB, analysis.fB, formatPValue(analysis.pB)],
                    [`Interaction (${analysis.factorAName} × ${analysis.factorBName})`, analysis.dfInteraction, analysis.ssInteraction, analysis.msInteraction, analysis.fInteraction, formatPValue(analysis.pInteraction)],
                    ["Error", analysis.dfError, analysis.ssError, analysis.msError, "-", "-"],
                    ["Total", analysis.dfTotal, analysis.ssTotal, "-", "-", "-"],
                  ].map((row) => (
                    <div key={String(row[0])} className="mt-3 grid grid-cols-[1.8fr_.7fr_1fr_1fr_.9fr_.9fr] gap-x-3 text-[11px] leading-tight">
                      <span className="font-semibold text-foreground">{row[0]}</span>
                      <span className="text-right text-foreground">{typeof row[1] === "number" ? row[1].toFixed(0) : row[1]}</span>
                      <span className="text-right text-foreground">{typeof row[2] === "number" ? row[2].toFixed(4) : row[2]}</span>
                      <span className="text-right text-foreground">{typeof row[3] === "number" ? row[3].toFixed(4) : row[3]}</span>
                      <span className="text-right text-foreground">{typeof row[4] === "number" ? row[4].toFixed(4) : row[4]}</span>
                      <span className="text-right text-foreground">{row[5]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {modelSummary ? (
                <div className="mt-4 border-t border-gray-800 bg-black/40 p-3">
                  <div className="grid grid-cols-3 gap-4 text-center font-mono">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">S (标准误差)</div>
                      <div className="text-lg font-bold tracking-tight text-foreground">{modelSummary.s.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">R-sq (决定系数)</div>
                      <div className="text-lg font-bold tracking-tight text-cyan-400 drop-shadow-[0_0_10px_rgba(0,243,255,0.6)]">
                        {(modelSummary.rSquared * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">R-sq(adj) (调整后)</div>
                      <div className="text-lg font-bold tracking-tight text-foreground">{(modelSummary.rSquaredAdj * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </Panel>
          </div>

          <div className="col-span-12">
            <Panel title="[ 因子边际均值 / MARGINAL MEANS ]" subtitle="LEVEL MEAN · STDEV · N">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="overflow-x-auto no-scrollbar">
                  <div className="min-w-[360px] font-mono tracking-tight">
                    <div className="mb-3 text-sm font-semibold text-foreground">{analysis.factorAName}</div>
                    <div className="grid grid-cols-[1.2fr_.7fr_1fr_1fr] gap-x-3 border-b border-white/10 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>Level</span>
                      <span className="text-right">N</span>
                      <span className="text-right">Mean</span>
                      <span className="text-right">StDev</span>
                    </div>
                    {analysis.meanA.map((item) => (
                      <div key={item.level} className="mt-3 grid grid-cols-[1.2fr_.7fr_1fr_1fr] gap-x-3 text-[10px]">
                        <span className="text-foreground">{item.level}</span>
                        <span className="text-right text-foreground">{item.n.toFixed(0)}</span>
                        <span className="text-right text-foreground">{item.mean.toFixed(4)}</span>
                        <span className="text-right text-foreground">{item.stdev.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <div className="min-w-[360px] font-mono tracking-tight">
                    <div className="mb-3 text-sm font-semibold text-foreground">{analysis.factorBName}</div>
                    <div className="grid grid-cols-[1.2fr_.7fr_1fr_1fr] gap-x-3 border-b border-white/10 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>Level</span>
                      <span className="text-right">N</span>
                      <span className="text-right">Mean</span>
                      <span className="text-right">StDev</span>
                    </div>
                    {analysis.meanB.map((item) => (
                      <div key={item.level} className="mt-3 grid grid-cols-[1.2fr_.7fr_1fr_1fr] gap-x-3 text-[10px]">
                        <span className="text-foreground">{item.level}</span>
                        <span className="text-right text-foreground">{item.n.toFixed(0)}</span>
                        <span className="text-right text-foreground">{item.mean.toFixed(4)}</span>
                        <span className="text-right text-foreground">{item.stdev.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="col-span-12">
            <Panel title="[ 主效应图 / MAIN EFFECTS PLOTS ]" subtitle="FACTOR A · FACTOR B">
              <div className="grid gap-4 xl:grid-cols-2">
                <MainEffectsPlot title={`${analysis.factorAName} Main Effect`} values={analysis.meanA} grandMean={analysis.grandMean} />
                <MainEffectsPlot title={`${analysis.factorBName} Main Effect`} values={analysis.meanB} grandMean={analysis.grandMean} />
              </div>
            </Panel>
          </div>

          <div className="col-span-12">
            <Panel title="[ 审计结论 / AUDIT CONCLUSION ]" subtitle="INTERACTION-FIRST DECISION LOGIC">
              <div className="mb-3 rounded-xl border px-4 py-3 border-white/10 bg-black/25">
                <div className="font-num text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {analysis.rejectInteraction
                    ? "INTERACTION DOMINATES"
                    : analysis.rejectA || analysis.rejectB
                      ? "MAIN EFFECTS ACTIVE"
                      : "NO ACTIVE EFFECT"}
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground/85">
                  {analysis.rejectInteraction
                    ? `${factorAName} × ${factorBName} 交互显著，必须优先解释交互，再回看主效应。`
                    : analysis.rejectA || analysis.rejectB
                      ? "当前应优先解读主效应，并结合边际均值判断哪个因子水平正在主导响应变化。"
                      : "当前没有足够证据证明主效应或交互效应显著，系统建议回看采样量与工艺扰动。"}
                </p>
              </div>
              <div className="grid gap-3 xl:grid-cols-3">
                {sortedConclusions.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-xl border p-3 ${
                      item.reject
                        ? item.title.includes("交互效应")
                          ? "border-red-400/20 bg-red-500/[0.06]"
                          : "border-cyan-400/15 bg-cyan-500/[0.05]"
                        : "border-white/8 bg-black/25 opacity-85"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <div className={`font-num text-[10px] uppercase tracking-[0.18em] ${item.reject ? "text-red-200" : "text-muted-foreground"}`}>
                        {item.reject ? "REJECT H0" : "H0 HOLDS"}
                      </div>
                    </div>
                    <div className="font-num mb-2 text-[10px] text-muted-foreground">P = {formatPValue(item.pValue)}</div>
                    <p className="text-sm leading-6 text-foreground/78">{item.statement}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="col-span-12">
            <Panel title="[ 残差四合一图 / RESIDUAL DIAGNOSTICS 4-IN-1 ]" subtitle="QQ · HISTOGRAM · VS FITS · VS ORDER">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="residual-diagnostic-card">
                  <ResidualQQPlot residuals={analysis.residuals} />
                </div>
                <div className="residual-diagnostic-card">
                  <ResidualHistogram residuals={analysis.residuals} />
                </div>
                <div className="residual-diagnostic-card">
                  <ResidualScatterPlot residuals={analysis.residuals} />
                </div>
                <div className="residual-diagnostic-card">
                  <ResidualOrderPlot residuals={analysis.residuals} />
                </div>
              </div>
            </Panel>
          </div>

          <div className="col-span-12">
            <button
              type="button"
              onClick={onGenerateSnapshot}
              className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px"
              style={{
                background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))",
                boxShadow:
                  "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)",
              }}
            >
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span>
                <span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span>
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="col-span-12">
            <Panel title="[ 平衡设计熔断 / BALANCED DESIGN LOCKDOWN ]" subtitle="MATRIX LEGALITY CHECK">
              <div className={`rounded-xl border p-4 ${summary.balanceError ? "border-amber-400/25 bg-amber-500/[0.08]" : "border-white/8 bg-black/25"}`}>
                <div className="font-num text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {summary.balanceError ? "SYSTEM LOCKED" : "WAITING MATRIX"}
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground/85">
                  {summary.balanceError
                    ? summary.balanceError
                    : "请继续粘贴完整的三列矩阵数据。双因子方差分析只在交叉水平完整且样本量一致时解锁。"}
                </p>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
