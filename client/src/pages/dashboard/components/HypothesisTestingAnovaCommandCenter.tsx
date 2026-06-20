import type { ReactNode } from "react";
import { jStat } from "jstat";
import { AlertTriangle, FileCheck2, Gavel, Sigma, ShieldCheck } from "lucide-react";

type AnovaComparison = {
  leftLabel: string;
  rightLabel: string;
  meanDiff: number;
  tStat: number;
  adjustedP: number;
  significant: boolean;
};

type AnovaResultLike = {
  pValue: number;
  reject: boolean;
  tStat: number;
  dfBetween?: number;
  dfWithin?: number;
  ssBetween?: number;
  ssWithin?: number;
  msBetween?: number;
  msWithin?: number;
  totalN?: number;
  anovaComparisons?: AnovaComparison[];
  anovaGroupLabels?: string[];
  anovaGroupData?: number[][];
  grandMean?: number;
  factorName?: string;
  regressionS?: number;
  rSquared?: number;
  rSquaredAdj?: number;
};

type GroupSeries = {
  label: string;
  values: number[];
};

const ANOVA_SERIES_COLORS = [
  "oklch(0.88 0.14 200)",
  "#FF6B81",
  "#fbbf24",
  "#c084fc",
  "#4ade80",
  "#fb7185",
];

function getSeriesColor(index: number) {
  return ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length];
}

function formatPValue(pValue: number) {
  return pValue < 0.0001 ? "< 0.0001" : pValue.toFixed(4);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function boxStats(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0] ?? 0,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function normalPdf(x: number, mu: number, sigma: number) {
  const safeSigma = sigma || 1e-9;
  const z = (x - mu) / safeSigma;
  return Math.exp(-0.5 * z * z) / (safeSigma * Math.sqrt(2 * Math.PI));
}

function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function extractGroups(result: AnovaResultLike): GroupSeries[] {
  return (result.anovaGroupLabels ?? []).map((label, index) => ({
    label,
    values: result.anovaGroupData?.[index] ?? [],
  })).filter((group) => group.values.length >= 2);
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
    <section className="glass rounded-2xl border border-white/8 p-4 max-h-full overflow-hidden">
      <div className="mb-3 border-b border-white/5 pb-3">
        <h3 className="text-sm font-bold tracking-wide text-foreground">{title}</h3>
        <p className="font-num text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function AnovaVerdictCore({
  pValue,
  alpha,
  reject,
}: {
  pValue: number;
  alpha: number;
  reject: boolean;
}) {
  return (
    <section
      className="glass rounded-2xl border border-white/8 p-6 text-center"
      style={{
        boxShadow: reject
          ? "0 0 0 1px rgba(239,68,68,.35), 0 0 42px rgba(239,68,68,.15)"
          : "0 0 0 1px rgba(34,211,238,.25), 0 0 42px rgba(34,211,238,.10)",
      }}
    >
      <div className="mb-2 font-num text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        P-VALUE / 显著性结果
      </div>
      <div className={`font-num text-5xl font-bold tabular-nums sm:text-6xl ${reject ? "text-[var(--warning)]" : "text-primary"}`}>
        {formatPValue(pValue)}
      </div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: reject ? "rgba(239,68,68,.12)" : "rgba(34,211,238,.12)", color: reject ? "rgb(248 113 113)" : "rgb(103 232 249)" }}>
        {reject ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {reject ? "REJECT H0 / 至少一组不同" : "H0 PREVAILS / 组间无显著差异"}
      </div>
      <p className="font-num mt-3 text-[11px] text-muted-foreground">ANOVA F-TEST VERDICT · {reject ? `P < α (${alpha.toFixed(2)})` : `P ≥ α (${alpha.toFixed(2)})`}</p>
    </section>
  );
}

function AnovaTablePanel({ result }: { result: AnovaResultLike }) {
  if (
    result.dfBetween === undefined ||
    result.dfWithin === undefined ||
    result.ssBetween === undefined ||
    result.ssWithin === undefined ||
    result.msBetween === undefined ||
    result.msWithin === undefined ||
    result.totalN === undefined
  ) {
    return null;
  }

  const rows = [
    [result.factorName || "Factor (组间)", result.dfBetween.toFixed(0), result.ssBetween.toFixed(4), result.msBetween.toFixed(4), result.tStat.toFixed(4), formatPValue(result.pValue)],
    ["组内 (Error / Noise)", result.dfWithin.toFixed(0), result.ssWithin.toFixed(4), result.msWithin.toFixed(4), "-", "-"],
    ["总计 (Total)", (result.totalN - 1).toFixed(0), (result.ssBetween + result.ssWithin).toFixed(4), "-", "-", "-"],
  ];
  const signalNoiseRatio = result.msWithin > 0 ? result.msBetween / result.msWithin : 0;
  const signalShare = result.ssBetween + result.ssWithin > 0 ? (result.ssBetween / (result.ssBetween + result.ssWithin)) * 100 : 0;

  return (
    <Panel title="[ 方差分析表 / ANOVA TABLE ]" subtitle="F = MSA / MSE">
      <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
        <div className="min-w-[760px] font-mono tracking-tight">
          <div className="grid grid-cols-[2.3fr_.7fr_1.2fr_1.2fr_.9fr_.9fr] gap-x-3 border-b border-white/10 pb-2 text-[10px] leading-tight uppercase tracking-widest text-muted-foreground">
            <span>来源 SOURCE</span>
            <span className="text-right">自由度 DF</span>
            <span className="text-right">离差平方和 SS</span>
            <span className="text-right">均方 MS</span>
            <span className="text-right">F值</span>
            <span className="text-right">P值</span>
          </div>
          <div className="mt-3 space-y-3">
            {rows.map((row) => (
              <div key={row[0]} className="grid grid-cols-[2.3fr_.7fr_1.2fr_1.2fr_.9fr_.9fr] gap-x-3 text-[10px] leading-tight">
                <span className="truncate font-semibold text-foreground">{row[0]}</span>
                <span className="font-num truncate text-right text-foreground">{row[1]}</span>
                <span className="font-num truncate text-right text-foreground">{row[2]}</span>
                <span className="font-num truncate text-right text-foreground">{row[3]}</span>
                <span className="font-num truncate text-right text-foreground">{row[4]}</span>
                <span className="font-num truncate text-right text-foreground">{row[5]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-500/[0.05] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-100">Signal / Noise Ratio</div>
              <div className="font-num text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
                MSA divided by MSE
              </div>
            </div>
            <div className="font-num text-2xl font-bold tracking-tight text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.28)]">
              {signalNoiseRatio.toFixed(4)}x
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/6 bg-black/25 px-3 py-2">
              <div className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Signal MSA</div>
              <div className="font-num text-sm text-foreground">{result.msBetween.toFixed(4)}</div>
            </div>
            <div className="rounded-lg border border-white/6 bg-black/25 px-3 py-2">
              <div className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Noise MSE</div>
              <div className="font-num text-sm text-foreground">{result.msWithin.toFixed(4)}</div>
            </div>
            <div className="rounded-lg border border-white/6 bg-black/25 px-3 py-2">
              <div className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Signal Share</div>
              <div className="font-num text-sm text-cyan-300">{signalShare.toFixed(2)}%</div>
            </div>
          </div>
        </div>
        {result.regressionS !== undefined && result.rSquared !== undefined && result.rSquaredAdj !== undefined ? (
          <div className="mt-4 border-t border-gray-800 bg-black/40 p-3">
            <div className="mb-2 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Model Summary / 模型解释度
            </div>
            <div className="grid grid-cols-3 gap-4 text-center font-mono">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">S (标准误差)</div>
                <div className="tracking-tight text-foreground">{result.regressionS.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">R-sq (决定系数)</div>
                <div className="tracking-tight text-cyan-400 drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">
                  {(result.rSquared * 100).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">R-sq(adj) (调整后)</div>
                <div className="tracking-tight text-foreground">{(result.rSquaredAdj * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function FactorLevelMeansPanel({ result }: { result: AnovaResultLike }) {
  const groups = extractGroups(result);
  if (!groups.length || result.dfWithin === undefined || result.regressionS === undefined || result.grandMean === undefined) {
    return null;
  }

  const tCrit = jStat.studentt.inv(0.975, result.dfWithin);
  const grandMean = result.grandMean;
  const rows = groups.map((group, index) => {
    const groupMean = mean(group.values);
    const groupSd = Math.sqrt(variance(group.values));
    const margin = tCrit * (result.regressionS! / Math.sqrt(group.values.length));
    const ciLow = groupMean - margin;
    const ciHigh = groupMean + margin;
    return {
      label: group.label,
      color: getSeriesColor(index),
      n: group.values.length.toFixed(0),
      mean: groupMean.toFixed(4),
      meanValue: groupMean,
      stdev: groupSd.toFixed(4),
      ciLow,
      ciHigh,
      deltaFromGrand: groupMean - grandMean,
      ci: `[${ciLow.toFixed(4)}, ${ciHigh.toFixed(4)}]`,
    };
  });
  const rankedLabels = [...rows]
    .sort((left, right) => right.meanValue - left.meanValue)
    .map((row) => row.label);
  const highestLabel = rankedLabels[0];
  const lowestLabel = rankedLabels[rankedLabels.length - 1];
  const decoratedRows = rows.map((row) => {
    const rank = rankedLabels.indexOf(row.label) + 1;
    return {
      ...row,
      rank,
      isHighest: row.label === highestLabel,
      isLowest: row.label === lowestLabel,
    };
  });
  const ciMin = Math.min(...decoratedRows.map((row) => row.ciLow), grandMean);
  const ciMax = Math.max(...decoratedRows.map((row) => row.ciHigh), grandMean);
  const ciRange = Math.max(ciMax - ciMin, 1e-9);
  const grandMeanOffset = ((grandMean - ciMin) / ciRange) * 100;

  return (
    <Panel title="[ 因子水平统计 / FACTOR LEVEL MEANS ]" subtitle="GROUP BASELINE">
      <div className="space-y-4">
        <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/[0.04] px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-cyan-100">Grand Mean Reference</div>
              <div className="font-num text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">
                System-wide baseline across active groups
              </div>
            </div>
            <div className="font-num text-lg font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.28)]">
              {grandMean.toFixed(4)}
            </div>
          </div>
          <div className="h-10 rounded-lg border border-white/6 bg-black/25 px-3 py-2">
            <div className="relative h-full">
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
              <div
                className="absolute top-1/2 h-5 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.55)]"
                style={{ left: `${grandMeanOffset}%` }}
              />
              <div
                className="absolute top-0 -translate-x-1/2 font-num text-[9px] uppercase tracking-[0.18em] text-cyan-200"
                style={{ left: `${grandMeanOffset}%` }}
              >
                μG
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {decoratedRows.map((row) => {
            const left = ((row.ciLow - ciMin) / ciRange) * 100;
            const width = ((row.ciHigh - row.ciLow) / ciRange) * 100;
            const meanOffset = ((row.meanValue - ciMin) / ciRange) * 100;
            const deltaLabel = `${row.deltaFromGrand >= 0 ? "+" : ""}${row.deltaFromGrand.toFixed(4)}`;
            return (
              <div
                key={`${row.label}-card`}
                className={`rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                  row.isHighest
                    ? "border-amber-300/30 bg-amber-500/[0.08]"
                    : row.isLowest
                      ? "border-fuchsia-300/25 bg-fuchsia-500/[0.06]"
                      : "border-white/8 bg-black/25"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">{row.label}</div>
                      <span className="font-num rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        #{row.rank}
                      </span>
                      {row.isHighest ? (
                        <span className="font-num rounded-full border border-amber-300/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-amber-200">
                          HIGH
                        </span>
                      ) : null}
                      {row.isLowest ? (
                        <span className="font-num rounded-full border border-fuchsia-300/25 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-fuchsia-200">
                          LOW
                        </span>
                      ) : null}
                    </div>
                    <div className="font-num text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      N = {row.n} · STDEV {row.stdev}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-num text-xl font-bold tracking-tight" style={{ color: row.color }}>
                      {row.mean}
                    </div>
                    <div className="font-num text-[10px] text-muted-foreground">vs μG {deltaLabel}</div>
                  </div>
                </div>
                <div className="mb-2 h-12 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2">
                  <div className="relative h-full">
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                    <div
                      className="absolute top-1/2 h-5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 border-l border-dashed border-cyan-300/80"
                      style={{ left: `${grandMeanOffset}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                      style={{ left: `${left}%`, width: `${Math.max(width, 4)}%`, backgroundColor: row.color, opacity: 0.45 }}
                    />
                    <div
                      className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.45)]"
                      style={{ left: `${meanOffset}%` }}
                    />
                  </div>
                </div>
                <div className="font-num text-[10px] text-muted-foreground">95% CI {row.ci}</div>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
          <div className="min-w-[760px] font-mono tracking-tight">
            <div className="grid grid-cols-[1.2fr_.7fr_1fr_1fr_1.6fr] gap-x-3 border-b border-white/10 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>水平 LEVEL / RANK</span>
              <span className="text-right">样本量 N</span>
              <span className="text-right">均值 MEAN</span>
              <span className="text-right">标准差 STDEV</span>
              <span className="text-right">95% CI / vs μG</span>
            </div>
            <div className="mt-3 space-y-3 text-[10px]">
              {decoratedRows
                .slice()
                .sort((left, right) => left.rank - right.rank)
                .map((row) => (
                <div key={row.label} className="grid grid-cols-[1.2fr_.7fr_1fr_1fr_1.6fr] gap-x-3">
                  <span className="font-semibold" style={{ color: row.color }}>
                    {row.label} #{row.rank}
                    {row.isHighest ? " HIGH" : row.isLowest ? " LOW" : ""}
                  </span>
                  <span className="text-right text-foreground">{row.n}</span>
                  <span className="text-right text-foreground">{row.mean}</span>
                  <span className="text-right text-foreground">{row.stdev}</span>
                  <span className="text-right text-foreground">
                    {row.ci} / {row.deltaFromGrand >= 0 ? "+" : ""}{row.deltaFromGrand.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function AnovaPostHocPanel({ result }: { result: AnovaResultLike }) {
  const comparisons = result.anovaComparisons ?? [];
  if (!result.reject) {
    return (
      <Panel title="[ 事后多重比较 / POST-HOC ISOLATION MATRIX ]" subtitle="BONFERRONI">
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/5 text-center">
          <p className="font-num text-sm text-cyan-200">[ H0 PREVAILS: 组间无显著差异，无需剥离 ]</p>
        </div>
      </Panel>
    );
  }

  const sortComparisons = (left: AnovaComparison, right: AnovaComparison) => {
    if (left.adjustedP !== right.adjustedP) {
      return left.adjustedP - right.adjustedP;
    }
    return Math.abs(right.meanDiff) - Math.abs(left.meanDiff);
  };
  const diffRows = comparisons.filter((row) => row.significant).sort(sortComparisons);
  const sameRows = comparisons
    .filter((row) => !row.significant)
    .sort((left, right) => Math.abs(right.meanDiff) - Math.abs(left.meanDiff) || left.adjustedP - right.adjustedP);

  return (
    <Panel title="[ 事后多重比较 / POST-HOC ISOLATION MATRIX ]" subtitle="BONFERRONI">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-xl border border-red-400/20 bg-red-500/[0.05] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-red-100">显著差异目标</div>
              <div className="font-num text-[10px] uppercase tracking-[0.2em] text-red-200/70">Significant Pairs</div>
            </div>
            <div className="font-num rounded-full border border-red-400/25 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
              {diffRows.length.toString().padStart(2, "0")} LOCKS
            </div>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto no-scrollbar">
            {diffRows.length ? diffRows.map((row) => (
              <div
                key={`${row.leftLabel}-${row.rightLabel}`}
                className="grid grid-cols-[1.2fr_.8fr_.8fr_.7fr] items-center gap-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.15)]"
              >
                <span className="font-semibold">{row.leftLabel} vs {row.rightLabel}</span>
                <span className="font-num text-right">Δ={row.meanDiff.toFixed(4)}</span>
                <span className="font-num text-right">P={row.adjustedP.toFixed(4)}</span>
                <span className="font-num text-right text-red-300">⚠ DIFF</span>
              </div>
            )) : (
              <div className="font-num text-[11px] text-red-100/70">未发现需要锁定的显著差异对。</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.04] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-cyan-100">一致性对照区</div>
              <div className="font-num text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Stable Pairs</div>
            </div>
            <div className="font-num rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
              {sameRows.length.toString().padStart(2, "0")} SAME
            </div>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto no-scrollbar">
            {sameRows.length ? sameRows.map((row) => (
              <div
                key={`${row.leftLabel}-${row.rightLabel}`}
                className="grid grid-cols-[1.2fr_.8fr_.8fr_.7fr] items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.12)]"
              >
                <span className="font-semibold">{row.leftLabel} vs {row.rightLabel}</span>
                <span className="font-num text-right">Δ={row.meanDiff.toFixed(4)}</span>
                <span className="font-num text-right">P={row.adjustedP.toFixed(4)}</span>
                <span className="font-num text-right text-cyan-300">✓ SAME</span>
              </div>
            )) : (
              <div className="font-num text-[11px] text-cyan-100/70">当前全部对比均已进入异常隔离区。</div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FDistributionChart({
  fStat,
  dfBetween,
  dfWithin,
  critical,
}: {
  fStat: number;
  dfBetween: number;
  dfWithin: number;
  critical: number;
}) {
  const W = 620;
  const H = 260;
  const PAD_L = 28;
  const PAD_R = 18;
  const PAD_T = 20;
  const PAD_B = 28;
  const view = (() => {
    const startX = dfBetween <= 2 ? 0.05 : 0;
    const endX = Math.max(fStat * 1.5, jStat.centralF.inv(0.99, dfBetween, dfWithin) * 1.2, critical * 1.2, 6);
    const points = Array.from({ length: 101 }, (_, index) => {
      const x = startX + ((endX - startX) * index) / 100;
      return { x, y: jStat.centralF.pdf(Math.max(x, startX), dfBetween, dfWithin) };
    });
    const peak = Math.max(...points.map((point) => point.y)) || 1;
    const plotWidth = W - PAD_L - PAD_R;
    const plotHeight = H - PAD_T - PAD_B;
    const xScale = (value: number) => PAD_L + ((value - startX) / (endX - startX)) * plotWidth;
    const yScale = (value: number) => PAD_T + plotHeight - (value / peak) * plotHeight;
    return { points, xScale, yScale, baseY: PAD_T + plotHeight, endX, peak };
  })();
  const criticalX = view.xScale(critical);
  const observedX = view.xScale(fStat);
  const criticalLabelY = PAD_T + 20;
  const observedLabelY = PAD_T + 52;

  return (
    <Panel title="[ 理论 F-分布 / F-DISTRIBUTION PROBABILITY ]" subtitle="RIGHT-TAIL REJECTION">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="F distribution">
        <line x1={PAD_L} y1={view.baseY} x2={W - PAD_R} y2={view.baseY} stroke="oklch(0.4 0.02 240 / 0.3)" strokeWidth="1" />
        <path
          d={`M ${view.points.map((point) => `${view.xScale(point.x)},${view.yScale(point.y)}`).join(" L ")} L ${W - PAD_R},${view.baseY} L ${PAD_L},${view.baseY} Z`}
          fill="oklch(0.82 0.14 200 / 0.12)"
        />
        <path
          d={`M ${view.xScale(critical)},${view.baseY} L ${view.points.filter((point) => point.x >= critical).map((point) => `${view.xScale(point.x)},${view.yScale(point.y)}`).join(" L ")} L ${view.xScale(view.endX)},${view.baseY} Z`}
          fill="rgba(255,0,60,0.18)"
        />
        <path
          d={`M ${view.points.map((point) => `${view.xScale(point.x)},${view.yScale(point.y)}`).join(" L ")}`}
          fill="none"
          stroke="oklch(0.86 0.14 200)"
          strokeWidth="2.5"
        />
        <line x1={criticalX} y1={PAD_T} x2={criticalX} y2={view.baseY} stroke="#FF003C" strokeWidth="1.25" strokeDasharray="3 4" />
        <line x1={observedX} y1={PAD_T} x2={observedX} y2={view.baseY} stroke="oklch(0.86 0.14 200)" strokeWidth="1.5" strokeDasharray="4 4" />
        <rect x={Math.max(PAD_L, criticalX - 48)} y={criticalLabelY - 12} width="96" height="20" rx="6" fill="rgba(255,0,60,0.12)" stroke="rgba(255,0,60,0.35)" />
        <text x={criticalX} y={criticalLabelY + 2} textAnchor="middle" className="font-num" fontSize="9.5" fill="#ff7a90">
          CRIT F {critical.toFixed(4)}
        </text>
        <rect x={Math.max(PAD_L, observedX - 54)} y={observedLabelY - 12} width="108" height="20" rx="6" fill="rgba(34,211,238,0.10)" stroke="rgba(34,211,238,0.30)" />
        <text x={observedX} y={observedLabelY + 2} textAnchor="middle" className="font-num" fontSize="9.5" fill="oklch(0.88 0.14 200)">
          OBS F {fStat.toFixed(4)}
        </text>
        <text x={criticalX} y={view.baseY + 14} textAnchor="middle" className="font-num" fontSize="8.5" fill="#ff9db0">
          critical
        </text>
        <text x={observedX} y={view.baseY + 24} textAnchor="middle" className="font-num" fontSize="8.5" fill="oklch(0.88 0.14 200)">
          observed
        </text>
      </svg>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-red-400/20 bg-red-500/[0.05] px-3 py-2">
          <div className="font-num text-[10px] uppercase tracking-[0.18em] text-red-200/70">Critical Threshold</div>
          <div className="font-num text-sm text-red-100">Fcrit = {critical.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/[0.05] px-3 py-2">
          <div className="font-num text-[10px] uppercase tracking-[0.18em] text-cyan-200/70">Observed Statistic</div>
          <div className="font-num text-sm text-cyan-100">Fobs = {fStat.toFixed(4)}</div>
        </div>
      </div>
    </Panel>
  );
}

function AnovaDensityOverlay({ groups }: { groups: GroupSeries[] }) {
  const W = 520;
  const H = 300;
  const PAD_L = 18;
  const PAD_R = 18;
  const PAD_T = 22;
  const PAD_B = 34;
  const view = (() => {
    const prepared = groups.map((group, index) => ({
      ...group,
      mean: mean(group.values),
      sd: Math.sqrt(variance(group.values)) || 1e-6,
      color: ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length],
    }));
    const low = Math.min(...prepared.map((group) => group.mean - 4 * group.sd));
    const high = Math.max(...prepared.map((group) => group.mean + 4 * group.sd));
    const xScale = (value: number) => PAD_L + ((value - low) / (high - low)) * (W - PAD_L - PAD_R);
    const xs = Array.from({ length: 120 }, (_, index) => low + ((high - low) * index) / 119);
    const ySets = prepared.map((group) => xs.map((value) => normalPdf(value, group.mean, group.sd)));
    const peak = Math.max(...ySets.flat()) || 1;
    const yScale = (value: number) => PAD_T + (H - PAD_T - PAD_B) - (value / peak) * (H - PAD_T - PAD_B);
    return {
      summaries: prepared.map((group, index) => ({
        ...group,
        line: xs.map((value, pointIndex) => `${xScale(value).toFixed(2)},${yScale(ySets[index][pointIndex]).toFixed(2)}`).join(" "),
      })),
      xScale,
      baseY: H - PAD_B,
    };
  })();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ANOVA density overlay">
      <line x1={PAD_L} y1={view.baseY} x2={W - PAD_R} y2={view.baseY} stroke="oklch(0.4 0.02 240 / 0.3)" strokeWidth="1" />
      {view.summaries.map((group) => (
        <g key={group.label}>
          <polyline points={group.line} fill="none" stroke={group.color} strokeWidth="2" />
          <text x={view.xScale(group.mean)} y={PAD_T - 8} textAnchor="middle" className="font-num" fontSize="10" fill={group.color}>
            {group.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function AnovaBoxplot({ groups }: { groups: GroupSeries[] }) {
  const W = 320;
  const H = 190;
  const PAD_L = 52;
  const PAD_R = 18;
  const PAD_T = 18;
  const PAD_B = 24;
  const view = (() => {
    const prepared = groups.map((group, index) => ({
      ...group,
      stats: boxStats(group.values),
      stroke: ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length],
      fill: `${ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length]}33`,
    }));
    const low = Math.min(...prepared.map((group) => group.stats.min));
    const high = Math.max(...prepared.map((group) => group.stats.max));
    const xScale = (value: number) => PAD_L + ((value - (low - 0.1)) / ((high + 0.1) - (low - 0.1))) * (W - PAD_L - PAD_R);
    const rowGap = prepared.length > 1 ? (H - PAD_T - PAD_B) / (prepared.length - 1) : 0;
    return { rows: prepared.map((group, index) => ({ ...group, centerY: PAD_T + rowGap * index })), xScale };
  })();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="ANOVA boxplot">
      {view.rows.map((row) => {
        const top = row.centerY - 10;
        return (
          <g key={row.label}>
            <line x1={view.xScale(row.stats.min)} y1={row.centerY} x2={view.xScale(row.stats.max)} y2={row.centerY} stroke={row.stroke} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <rect x={view.xScale(row.stats.q1)} y={top} width={Math.max(1, view.xScale(row.stats.q3) - view.xScale(row.stats.q1))} height={20} fill={row.fill} stroke={row.stroke} strokeWidth="1.4" rx="2" />
            <line x1={view.xScale(row.stats.median)} y1={top - 2} x2={view.xScale(row.stats.median)} y2={top + 22} stroke={row.stroke} strokeWidth="1.3" />
            <text x={PAD_L - 8} y={row.centerY + 3} textAnchor="end" className="font-num" fontSize="8.5" fill={row.stroke} fontWeight="700">
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AnovaResidualQQPlot({ groups }: { groups: GroupSeries[] }) {
  const residuals = groups.flatMap((group) => {
    const groupMean = mean(group.values);
    return group.values.map((value) => value - groupMean);
  });
  const sorted = [...residuals].sort((left, right) => left - right);
  const avg = mean(sorted);
  const sigma = Math.sqrt(variance(sorted)) || 1e-9;
  const points = sorted.map((value, index) => ({
    theoretical: normalQuantile((index + 0.5) / sorted.length),
    sample: (value - avg) / sigma,
  }));
  const W = 300;
  const H = 150;
  const PAD = 22;
  const limit = Math.max(2.2, ...points.flatMap((point) => [Math.abs(point.theoretical), Math.abs(point.sample)]));
  const scaleX = (value: number) => PAD + ((value + limit) / (2 * limit)) * (W - PAD * 2);
  const scaleY = (value: number) => PAD + (H - PAD * 2) - ((value + limit) / (2 * limit)) * (H - PAD * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="ANOVA residual qq">
      <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="oklch(0.4 0.02 240 / 0.2)" strokeWidth="1" />
      <line x1={scaleX(-limit)} y1={scaleY(-limit)} x2={scaleX(limit)} y2={scaleY(limit)} stroke="oklch(0.86 0.14 200)" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />
      {points.map((point, index) => (
        <circle key={index} cx={scaleX(point.theoretical)} cy={scaleY(point.sample)} r="1.8" fill="oklch(0.88 0.14 200)" />
      ))}
    </svg>
  );
}

function AnovaRunChart({ groups }: { groups: GroupSeries[] }) {
  const W = 300;
  const H = 150;
  const PAD_L = 34;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 22;
  const count = Math.max(...groups.map((group) => group.values.length), 2);
  const allValues = groups.flatMap((group) => group.values);
  const low = Math.min(...allValues);
  const high = Math.max(...allValues);
  const xScale = (index: number) => PAD_L + (count <= 1 ? 0 : (index / (count - 1)) * (W - PAD_L - PAD_R));
  const yScale = (value: number) => PAD_T + (H - PAD_T - PAD_B) - ((value - low) / ((high - low) || 1)) * (H - PAD_T - PAD_B);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="ANOVA run chart">
      {groups.map((group, index) => {
        const color = ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length];
        const points = group.values.map((value, pointIndex) => `${xScale(pointIndex)},${yScale(value)}`).join(" ");
        return <polyline key={group.label} points={points} fill="none" stroke={color} strokeWidth="1.4" />;
      })}
    </svg>
  );
}

export function AnovaCommandCenter({
  result,
  alpha,
  critical,
}: {
  result: AnovaResultLike;
  alpha: number;
  critical: number;
}) {
  const validGroups = extractGroups(result);

  return (
    <div className="grid grid-cols-12 gap-5 max-h-full overflow-hidden">
      <div className="col-span-12 xl:col-span-12 max-h-full overflow-hidden">
        <div className="grid h-full grid-rows-[minmax(0,35fr)_minmax(0,65fr)] gap-5">
          <div className="max-h-full overflow-hidden">
            <AnovaVerdictCore pValue={result.pValue} alpha={alpha} reject={result.reject} />
          </div>
          <div className="max-h-full overflow-hidden">
            <AnovaTablePanel result={result} />
          </div>
        </div>
      </div>
      <div className="col-span-12 max-h-full overflow-hidden">
        <FactorLevelMeansPanel result={result} />
      </div>
      <div className="col-span-12 max-h-full overflow-hidden">
        <AnovaPostHocPanel result={result} />
      </div>
      <div className="col-span-12 xl:col-span-6 max-h-full overflow-hidden">
        <FDistributionChart
          fStat={result.tStat}
          dfBetween={result.dfBetween ?? 1}
          dfWithin={result.dfWithin ?? 1}
          critical={critical}
        />
      </div>
      <div className="col-span-12 xl:col-span-6 max-h-full overflow-hidden">
        <Panel title="[ 多维方差剥离 / MULTI-GROUP BOXPLOT ]" subtitle="EQUAL VARIANCE CHECK">
          <AnovaBoxplot groups={validGroups} />
        </Panel>
      </div>
      <div className="col-span-12 xl:col-span-6 max-h-full overflow-hidden">
        <Panel title="[ 残差正态性 / RESIDUAL Q-Q PLOT ]" subtitle="NORMALITY CHECK">
          <AnovaResidualQQPlot groups={validGroups} />
        </Panel>
      </div>
      <div className="col-span-12 xl:col-span-6 max-h-full overflow-hidden">
        <Panel title="[ 真实世界视图 / OVERLAPPING DENSITY ]" subtitle="MULTI-GROUP KDE VIEW">
          <AnovaDensityOverlay groups={validGroups} />
        </Panel>
      </div>
    </div>
  );
}
