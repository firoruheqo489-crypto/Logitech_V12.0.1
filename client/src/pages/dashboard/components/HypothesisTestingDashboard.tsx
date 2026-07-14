import { useEffect, useMemo, useState, type ReactNode } from "react";
import { jStat } from "jstat";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ClipboardPaste,
  FileCheck2,
  FlaskConical,
  Gavel,
  Lock,
  ShieldCheck,
  Sigma,
  Trash2,
} from "lucide-react";
import type {
  AdjudicationState,
  PayloadMode,
  StatDomain,
  TailDirection,
  TestVariant,
} from "./axiomSigmaRouterTypes";
import { AnovaCommandCenter } from "./HypothesisTestingAnovaCommandCenter";
import {
  TwoWayAnovaWorkbench,
  type TwoWayAnovaAnalysisResult,
  TwoWayAnovaSidebarStack,
} from "./HypothesisTestingTwoWayWorkbench";
import "./hypothesis-testing.css";

type HypothesisTestingDashboardProps = {
  projectName?: string;
};

type StatisticalResult = {
  testType: "1_SAMPLE_T" | "2_SAMPLE_T" | "PAIRED_T" | "1_WAY_ANOVA" | "1_VAR_CHI_SQ" | "2_VAR_F" | "MULTI_VAR_LEVENE" | "1_PROP_Z" | "2_PROP_Z";
  meanA: number;
  meanB: number | null;
  varA: number;
  varB: number | null;
  sdA: number;
  sdB: number | null;
  deltaMean: number;
  deltaVar: number;
  deltaSd: number;
  nA: number;
  nB: number | null;
  tStat: number;
  df: number;
  dfSecondary?: number | null;
  pValue: number;
  targetMean: number | null;
  targetStdev?: number | null;
  standardError: number;
  pooledSd: number | null;
  cohensD: number;
  critical: number;
  criticalSecondary?: number | null;
  achievedPower: number;
  minimumDetectableEffect: number;
  diff: number;
  marginOfError: number;
  ciLow: number;
  ciHigh: number;
  reject: boolean;
  anovaGroupLabels?: string[];
  anovaGroupMeans?: number[];
  anovaGroupData?: number[][];
  grandMean?: number;
  dfBetween?: number;
  dfWithin?: number;
  ssBetween?: number;
  ssWithin?: number;
  msBetween?: number;
  msWithin?: number;
  totalN?: number;
  factorName?: string;
  regressionS?: number;
  rSquared?: number;
  rSquaredAdj?: number;
  anovaComparisons?: Array<{
    leftLabel: string;
    rightLabel: string;
    meanDiff: number;
    tStat: number;
    rawP: number;
    adjustedP: number;
    significant: boolean;
  }>;
  varianceGroupLabels?: string[];
  varianceGroupStdevs?: number[];
  varianceGroupMeans?: number[];
  varianceGroupNs?: number[];
  varianceGroupData?: number[][];
};

const ANOVA_SERIES_COLORS = [
  "oklch(0.88 0.14 200)",
  "#FF6B81",
  "#fbbf24",
  "#c084fc",
  "#4ade80",
  "#fb7185",
];

type BoxStats = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

type QQPoint = {
  theoretical: number;
  sample: number;
  outlier: boolean;
};

type TwoWayAnovaParsedRow = {
  id: string;
  factorA: string;
  factorB: string;
  response: number;
};

const DEFAULT_SAMPLE_A =
  "25.02, 25.05, 24.99, 25.07, 25.04, 25.08, 25.03, 25.06, 25.01, 25.05";
const DEFAULT_SAMPLE_B =
  "24.92, 24.95, 24.90, 24.97, 24.93, 24.89, 24.96, 24.91, 24.94, 24.88";
const SAFE_SAMPLE_A =
  "25.01, 25.04, 24.98, 25.06, 25.02, 25.05, 25.00, 25.03, 24.99, 25.04";
const SAFE_SAMPLE_B =
  "25.00, 25.05, 24.97, 25.04, 25.03, 24.99, 25.06, 25.01, 24.98, 25.02";
const DEFAULT_TWO_WAY_MATRIX = `S1\tLow\t25.10
S1\tLow\t25.00
S1\tHigh\t25.60
S1\tHigh\t25.50
S2\tLow\t25.40
S2\tLow\t25.35
S2\tHigh\t25.45
S2\tHigh\t25.50
S3\tLow\t25.80
S3\tLow\t25.75
S3\tHigh\t25.30
S3\tHigh\t25.35`;
const ALPHA_OPTIONS = [0.01, 0.05, 0.1] as const;
const TAIL_OPTIONS: Array<{
  id: TailDirection;
  shortLabel: string;
  label: string;
}> = [
  { id: "TWO_TAILED", shortLabel: "[=]", label: "双侧 (2-Tailed)" },
  { id: "LEFT_TAILED", shortLabel: "[<]", label: "左尾 (Left-Tail)" },
  { id: "RIGHT_TAILED", shortLabel: "[>]", label: "右尾 (Right-Tail)" },
];
const DOMAIN_OPTIONS: Array<{ id: StatDomain; label: string; zh: string }> = [
  { id: "MEANS", label: "MEANS", zh: "均值检验" },
  { id: "VARIANCES", label: "VARIANCES", zh: "方差检验" },
  { id: "PROPORTIONS", label: "PROPORTIONS", zh: "比率检验" },
  { id: "NON_PARAMETRIC", label: "NON-PARAMETRIC", zh: "非参数检验" },
  { id: "EQUIVALENCE", label: "EQUIVALENCE", zh: "等价检验" },
];

const TEST_OPTIONS_BY_DOMAIN: Record<
  StatDomain,
  Array<{ id: TestVariant; label: string; payloadMode: PayloadMode }>
> = {
  MEANS: [
    { id: "1_SAMPLE_T", label: "1-Samp T", payloadMode: "1_VECTOR" },
    { id: "2_SAMPLE_T", label: "2-Samp T", payloadMode: "2_VECTORS" },
    { id: "PAIRED_T", label: "Paired T", payloadMode: "2_VECTORS" },
    { id: "1_WAY_ANOVA", label: "1-WAY ANOVA", payloadMode: "MULTI_VECTORS" },
    { id: "2_WAY_ANOVA", label: "2-WAY ANOVA", payloadMode: "FACTOR_MATRIX" },
  ],
  VARIANCES: [
    { id: "1_VAR_CHI_SQ", label: "1-Var χ²", payloadMode: "1_VECTOR" },
    { id: "2_VAR_F", label: "2-Var F", payloadMode: "2_VECTORS" },
    { id: "MULTI_VAR_LEVENE", label: "Levene", payloadMode: "MULTI_VECTORS" },
  ],
  PROPORTIONS: [
    { id: "1_PROP_Z", label: "1-Prop Z", payloadMode: "SUMMARY_STATS" },
    { id: "2_PROP_Z", label: "2-Prop Z", payloadMode: "SUMMARY_STATS" },
    { id: "CHI_SQ_CONTINGENCY", label: "Chi-Sq", payloadMode: "SUMMARY_STATS" },
  ],
  NON_PARAMETRIC: [
    { id: "1_SAMP_WILCOXON", label: "1-Samp Wilcoxon", payloadMode: "1_VECTOR" },
    { id: "MANN_WHITNEY", label: "Mann-Whitney", payloadMode: "2_VECTORS" },
    { id: "KRUSKAL_WALLIS", label: "Kruskal-Wallis", payloadMode: "MULTI_VECTORS" },
  ],
  EQUIVALENCE: [
    { id: "2_SAMP_EQUIVALENCE", label: "2-Samp Eq", payloadMode: "2_VECTORS" },
  ],
};

const IMPLEMENTED_TESTS = new Set<TestVariant>(["1_SAMPLE_T", "2_SAMPLE_T", "PAIRED_T", "1_WAY_ANOVA", "2_WAY_ANOVA", "1_VAR_CHI_SQ", "2_VAR_F", "MULTI_VAR_LEVENE", "1_PROP_Z", "2_PROP_Z"]);

function getPayloadModeForTest(test: TestVariant): PayloadMode {
  for (const domain of DOMAIN_OPTIONS) {
    const match = TEST_OPTIONS_BY_DOMAIN[domain.id].find((option) => option.id === test);
    if (match) return match.payloadMode;
  }
  return "2_VECTORS";
}

function getDomainForTest(test: TestVariant): StatDomain {
  for (const domain of DOMAIN_OPTIONS) {
    if (TEST_OPTIONS_BY_DOMAIN[domain.id].some((option) => option.id === test)) {
      return domain.id;
    }
  }
  return "MEANS";
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((sum, value) => sum + value, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const avg = mean(xs);
  return xs.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (xs.length - 1);
}

function std(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

function normalPdf(x: number, mu = 0, sigma = 1): number {
  const safeSigma = sigma || 1e-9;
  const z = (x - mu) / safeSigma;
  return Math.exp(-0.5 * z * z) / (safeSigma * Math.sqrt(2 * Math.PI));
}

function normalizeDf(df: number) {
  return Number.isFinite(df) && df > 0 ? df : 1;
}

function tPdf(x: number, df: number): number {
  return jStat.studentt.pdf(x, normalizeDf(df));
}

function tTwoTailedP(tValue: number, df: number): number {
  const upperTail = 1 - jStat.studentt.cdf(Math.abs(tValue), normalizeDf(df));
  return Math.max(0, Math.min(1, upperTail * 2));
}

function tCritical(alpha: number, df: number): number {
  const safeAlpha = Math.min(Math.max(alpha, 1e-12), 1 - 1e-12);
  return jStat.studentt.inv(1 - safeAlpha / 2, normalizeDf(df));
}

function computeTailAwarePValue(tStat: number, df: number, tailDirection: TailDirection) {
  const safeDf = normalizeDf(df);
  const pValue2Tailed = 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), safeDf));

  if (tailDirection === "LEFT_TAILED") {
    return jStat.studentt.cdf(tStat, safeDf);
  }
  if (tailDirection === "RIGHT_TAILED") {
    return 1 - jStat.studentt.cdf(tStat, safeDf);
  }
  return pValue2Tailed;
}

function getDecisionCritical(alpha: number, df: number, tailDirection: TailDirection) {
  const safeAlpha = Math.min(Math.max(alpha, 1e-12), 1 - 1e-12);
  const safeDf = normalizeDf(df);

  if (tailDirection === "LEFT_TAILED" || tailDirection === "RIGHT_TAILED") {
    return jStat.studentt.inv(1 - safeAlpha, safeDf);
  }

  return tCritical(alpha, safeDf);
}

function computeAchievedPower(critical: number, tStat: number) {
  return (
    1 -
    jStat.normal.cdf(critical - Math.abs(tStat), 0, 1) +
    jStat.normal.cdf(-critical - Math.abs(tStat), 0, 1)
  );
}

function oneSampleT(
  data: number[],
  alpha: number,
  tailDirection: TailDirection,
  targetMean: number,
): StatisticalResult {
  const targetPower = 0.9;
  const meanA = jStat.mean(data);
  const varA = jStat.variance(data, true);
  const sdA = Math.sqrt(varA);
  const nA = data.length;
  const standardError = sdA / Math.sqrt(nA) || 1e-9;
  const tStat = (meanA - targetMean) / standardError;
  const df = nA - 1;
  const pValue = computeTailAwarePValue(tStat, df, tailDirection);
  const critical = getDecisionCritical(alpha, df, tailDirection);
  const ciCritical = tCritical(alpha, df);
  const marginOfError = ciCritical * standardError;
  const diff = meanA - targetMean;
  const cohensD = Math.abs(diff) / (sdA || 1e-9);
  const achievedPower = computeAchievedPower(critical, tStat);
  const minimumDetectableEffect =
    (critical + jStat.normal.inv(targetPower, 0, 1)) * standardError;

  return {
    testType: "1_SAMPLE_T",
    meanA,
    meanB: null,
    varA,
    varB: null,
    sdA,
    sdB: null,
    deltaMean: diff,
    deltaVar: varA,
    deltaSd: sdA,
    nA,
    nB: null,
    tStat,
    df,
    dfSecondary: null,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean,
    standardError,
    pooledSd: null,
    cohensD,
    critical,
    achievedPower: Math.max(0, Math.min(1, achievedPower)),
    minimumDetectableEffect,
    diff,
    marginOfError,
    ciLow: meanA - marginOfError,
    ciHigh: meanA + marginOfError,
    reject: pValue < alpha,
  };
}

function twoSampleT(
  a: number[],
  b: number[],
  alpha: number,
  tailDirection: TailDirection,
): StatisticalResult {
  const targetPower = 0.9;
  const meanA = jStat.mean(a);
  const meanB = jStat.mean(b);
  const varA = jStat.variance(a, true);
  const varB = jStat.variance(b, true);
  const sdA = Math.sqrt(varA);
  const sdB = Math.sqrt(varB);
  const nA = a.length;
  const nB = b.length;
  const se = Math.sqrt(varA / nA + varB / nB) || 1e-9;
  const tStat = (meanA - meanB) / se;
  const dfNumerator = (varA / nA + varB / nB) ** 2;
  const dfDenominator = ((varA / nA) ** 2) / (nA - 1) + ((varB / nB) ** 2) / (nB - 1);
  const df = dfNumerator / dfDenominator;
  const pValue = computeTailAwarePValue(tStat, df, tailDirection);
  const pooledSd = Math.sqrt((((nA - 1) * varA) + ((nB - 1) * varB)) / (nA + nB - 2)) || 1e-9;
  const cohensD = Math.abs(meanA - meanB) / pooledSd;
  const critical = getDecisionCritical(alpha, df, tailDirection);
  const ciCritical = tCritical(alpha, df);
  const achievedPower = computeAchievedPower(critical, tStat);
  const minimumDetectableEffect =
    (critical + jStat.normal.inv(targetPower, 0, 1)) * se;
  const marginOfError = ciCritical * se;

  return {
    testType: "2_SAMPLE_T",
    meanA,
    meanB,
    varA,
    varB,
    sdA,
    sdB,
    deltaMean: meanA - meanB,
    deltaVar: varA + varB,
    deltaSd: Math.sqrt(varA + varB),
    nA,
    nB,
    tStat,
    df,
    dfSecondary: null,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: null,
    standardError: se,
    pooledSd,
    cohensD,
    critical,
    achievedPower: Math.max(0, Math.min(1, achievedPower)),
    minimumDetectableEffect,
    diff: meanA - meanB,
    marginOfError,
    ciLow: meanA - meanB - marginOfError,
    ciHigh: meanA - meanB + marginOfError,
    reject: pValue < alpha,
  };
}

function pairedT(
  a: number[],
  b: number[],
  alpha: number,
  tailDirection: TailDirection,
): StatisticalResult {
  const targetPower = 0.9;
  const dataDiff = a.map((value, index) => value - b[index]);
  const n = dataDiff.length;
  const meanA = jStat.mean(a);
  const meanB = jStat.mean(b);
  const varA = jStat.variance(a, true);
  const varB = jStat.variance(b, true);
  const sdA = Math.sqrt(varA);
  const sdB = Math.sqrt(varB);
  const deltaMean = jStat.mean(dataDiff);
  const deltaVar = jStat.variance(dataDiff, true);
  const deltaSd = Math.sqrt(deltaVar);
  const standardError = deltaSd / Math.sqrt(n) || 1e-9;
  const tStat = deltaMean / standardError;
  const df = n - 1;
  const pValue = computeTailAwarePValue(tStat, df, tailDirection);
  const critical = getDecisionCritical(alpha, df, tailDirection);
  const ciCritical = tCritical(alpha, df);
  const marginOfError = ciCritical * standardError;
  const cohensD = Math.abs(deltaMean) / (deltaSd || 1e-9);
  const achievedPower = computeAchievedPower(critical, tStat);
  const minimumDetectableEffect =
    (critical + jStat.normal.inv(targetPower, 0, 1)) * standardError;

  return {
    testType: "PAIRED_T",
    meanA,
    meanB,
    varA,
    varB,
    sdA,
    sdB,
    deltaMean,
    deltaVar,
    deltaSd,
    nA: n,
    nB: n,
    tStat,
    df,
    dfSecondary: null,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: 0,
    standardError,
    pooledSd: null,
    cohensD,
    critical,
    achievedPower: Math.max(0, Math.min(1, achievedPower)),
    minimumDetectableEffect,
    diff: deltaMean,
    marginOfError,
    ciLow: deltaMean - marginOfError,
    ciHigh: deltaMean + marginOfError,
    reject: pValue < alpha,
  };
}

function oneVarianceChiSquare(
  data: number[],
  alpha: number,
  tailDirection: TailDirection,
  targetStdev: number,
): StatisticalResult {
  const targetVariance = targetStdev ** 2;
  const meanA = jStat.mean(data);
  const varA = jStat.variance(data, true);
  const sdA = Math.sqrt(varA);
  const nA = data.length;
  const df = nA - 1;
  const chiSqStat = (df * varA) / targetVariance;
  const cdfValue = jStat.chisquare.cdf(chiSqStat, df);
  const rightTail = 1 - cdfValue;
  const pValue =
    tailDirection === "RIGHT_TAILED"
      ? rightTail
      : tailDirection === "LEFT_TAILED"
        ? cdfValue
        : 2 * Math.min(cdfValue, rightTail);
  const lowerCrit =
    tailDirection === "LEFT_TAILED"
      ? jStat.chisquare.inv(alpha, df)
      : tailDirection === "TWO_TAILED"
        ? jStat.chisquare.inv(alpha / 2, df)
        : jStat.chisquare.inv(1 - alpha, df);
  const upperCrit =
    tailDirection === "RIGHT_TAILED"
      ? jStat.chisquare.inv(1 - alpha, df)
      : tailDirection === "TWO_TAILED"
        ? jStat.chisquare.inv(1 - alpha / 2, df)
        : null;
  const chiSqLowerCrit = jStat.chisquare.inv(0.025, df);
  const chiSqUpperCrit = jStat.chisquare.inv(0.975, df);
  const ciVarLower = (df * varA) / chiSqUpperCrit;
  const ciVarUpper = (df * varA) / chiSqLowerCrit;
  const ciStdevLower = Math.sqrt(ciVarLower);
  const ciStdevUpper = Math.sqrt(ciVarUpper);
  const varianceSe = Math.sqrt((2 * varA * varA) / df);

  return {
    testType: "1_VAR_CHI_SQ",
    meanA,
    meanB: null,
    varA,
    varB: null,
    sdA,
    sdB: null,
    deltaMean: 0,
    deltaVar: varA - targetVariance,
    deltaSd: sdA - targetStdev,
    nA,
    nB: null,
    tStat: chiSqStat,
    df,
    dfSecondary: null,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: null,
    targetStdev,
    standardError: varianceSe,
    pooledSd: null,
    cohensD: targetStdev > 0 ? sdA / targetStdev : 0,
    critical: lowerCrit,
    criticalSecondary: upperCrit,
    achievedPower: 0,
    minimumDetectableEffect: Math.abs(sdA - targetStdev),
    diff: sdA - targetStdev,
    marginOfError: ciStdevUpper - ciStdevLower,
    ciLow: ciStdevLower,
    ciHigh: ciStdevUpper,
    reject: pValue < alpha,
  };
}

function twoVarianceF(
  a: number[],
  b: number[],
  alpha: number,
  tailDirection: TailDirection,
): StatisticalResult {
  const meanA = jStat.mean(a);
  const meanB = jStat.mean(b);
  const varA = jStat.variance(a, true);
  const varB = jStat.variance(b, true);
  const sdA = Math.sqrt(varA);
  const sdB = Math.sqrt(varB);
  const nA = a.length;
  const nB = b.length;
  const df1 = nA - 1;
  const df2 = nB - 1;
  const fStat = varA / (varB || 1e-9);
  const cdfValue = jStat.centralF.cdf(fStat, df1, df2);
  const rightTail = 1 - cdfValue;
  const pValue =
    tailDirection === "RIGHT_TAILED"
      ? rightTail
      : tailDirection === "LEFT_TAILED"
        ? cdfValue
        : 2 * Math.min(cdfValue, rightTail);
  const lowerCrit =
    tailDirection === "LEFT_TAILED"
      ? jStat.centralF.inv(alpha, df1, df2)
      : tailDirection === "TWO_TAILED"
        ? jStat.centralF.inv(alpha / 2, df1, df2)
        : jStat.centralF.inv(1 - alpha, df1, df2);
  const upperCrit =
    tailDirection === "RIGHT_TAILED"
      ? jStat.centralF.inv(1 - alpha, df1, df2)
      : tailDirection === "TWO_TAILED"
        ? jStat.centralF.inv(1 - alpha / 2, df1, df2)
        : null;
  const ciVarRatioLow = fStat / jStat.centralF.inv(1 - alpha / 2, df1, df2);
  const ciVarRatioHigh = fStat / jStat.centralF.inv(alpha / 2, df1, df2);

  return {
    testType: "2_VAR_F",
    meanA,
    meanB,
    varA,
    varB,
    sdA,
    sdB,
    deltaMean: 0,
    deltaVar: varA - varB,
    deltaSd: sdA - sdB,
    nA,
    nB,
    tStat: fStat,
    df: df1,
    dfSecondary: df2,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: null,
    standardError: Math.abs(varA - varB),
    pooledSd: null,
    cohensD: varB > 0 ? varA / varB : 0,
    critical: lowerCrit,
    criticalSecondary: upperCrit,
    achievedPower: 0,
    minimumDetectableEffect: Math.abs(sdA - sdB),
    diff: sdA - sdB,
    marginOfError: ciVarRatioHigh - ciVarRatioLow,
    ciLow: ciVarRatioLow,
    ciHigh: ciVarRatioHigh,
    reject: pValue < alpha,
  };
}

function oneProportionZ(
  events: number,
  trials: number,
  alpha: number,
  tailDirection: TailDirection,
  targetProportion: number,
): StatisticalResult {
  const n = trials;
  const phat = events / trials;
  const se = Math.sqrt((targetProportion * (1 - targetProportion)) / n) || 1e-9;
  const zStat = (phat - targetProportion) / se;
  let pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zStat), 0, 1));
  if (tailDirection === "LEFT_TAILED") {
    pValue = jStat.normal.cdf(zStat, 0, 1);
  } else if (tailDirection === "RIGHT_TAILED") {
    pValue = 1 - jStat.normal.cdf(zStat, 0, 1);
  }
  const critical =
    tailDirection === "TWO_TAILED"
      ? jStat.normal.inv(1 - alpha / 2, 0, 1)
      : jStat.normal.inv(1 - alpha, 0, 1);
  const marginOfError = jStat.normal.inv(0.975, 0, 1) * Math.sqrt((phat * (1 - phat)) / n);

  return {
    testType: "1_PROP_Z",
    meanA: phat,
    meanB: null,
    varA: phat * (1 - phat),
    varB: null,
    sdA: Math.sqrt(phat * (1 - phat)),
    sdB: null,
    deltaMean: phat - targetProportion,
    deltaVar: phat * (1 - phat),
    deltaSd: Math.sqrt(phat * (1 - phat)),
    nA: n,
    nB: null,
    tStat: zStat,
    df: n,
    dfSecondary: null,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: targetProportion,
    standardError: se,
    pooledSd: null,
    cohensD: Math.abs(phat - targetProportion) / se,
    critical,
    criticalSecondary: null,
    achievedPower: 0,
    minimumDetectableEffect: Math.abs(phat - targetProportion),
    diff: phat - targetProportion,
    marginOfError,
    ciLow: Math.max(0, phat - marginOfError),
    ciHigh: Math.min(1, phat + marginOfError),
    reject: pValue < alpha,
  };
}

function twoProportionZ(
  eventsA: number,
  trialsA: number,
  eventsB: number,
  trialsB: number,
  alpha: number,
  tailDirection: TailDirection,
): StatisticalResult {
  const p1 = eventsA / trialsA;
  const p2 = eventsB / trialsB;
  const pooled = (eventsA + eventsB) / (trialsA + trialsB);
  const pooledSe = Math.sqrt(pooled * (1 - pooled) * ((1 / trialsA) + (1 / trialsB))) || 1e-9;
  const zStat = (p1 - p2) / pooledSe;
  let pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zStat), 0, 1));
  if (tailDirection === "LEFT_TAILED") {
    pValue = jStat.normal.cdf(zStat, 0, 1);
  } else if (tailDirection === "RIGHT_TAILED") {
    pValue = 1 - jStat.normal.cdf(zStat, 0, 1);
  }
  const critical =
    tailDirection === "TWO_TAILED"
      ? jStat.normal.inv(1 - alpha / 2, 0, 1)
      : jStat.normal.inv(1 - alpha, 0, 1);
  const unpooledSe = Math.sqrt((p1 * (1 - p1)) / trialsA + (p2 * (1 - p2)) / trialsB) || 1e-9;
  const marginOfError = jStat.normal.inv(0.975, 0, 1) * unpooledSe;

  return {
    testType: "2_PROP_Z",
    meanA: p1,
    meanB: p2,
    varA: p1 * (1 - p1),
    varB: p2 * (1 - p2),
    sdA: Math.sqrt(p1 * (1 - p1)),
    sdB: Math.sqrt(p2 * (1 - p2)),
    deltaMean: p1 - p2,
    deltaVar: (p1 * (1 - p1)) - (p2 * (1 - p2)),
    deltaSd: Math.sqrt(Math.abs((p1 * (1 - p1)) - (p2 * (1 - p2)))),
    nA: trialsA,
    nB: trialsB,
    tStat: zStat,
    df: trialsA + trialsB,
    dfSecondary: null,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: null,
    standardError: pooledSe,
    pooledSd: null,
    cohensD: Math.abs(p1 - p2) / pooledSe,
    critical,
    criticalSecondary: null,
    achievedPower: 0,
    minimumDetectableEffect: Math.abs(p1 - p2),
    diff: p1 - p2,
    marginOfError,
    ciLow: p1 - p2 - marginOfError,
    ciHigh: p1 - p2 + marginOfError,
    reject: pValue < alpha,
  };
}

function leveneTest(
  groups: Array<{ label: string; values: number[] }>,
  alpha: number,
): StatisticalResult {
  const prepared = groups.filter((group) => group.values.length >= 2);
  const transformed = prepared.map((group) => {
    const center = jStat.mean(group.values);
    return {
      label: group.label,
      values: group.values.map((value) => Math.abs(value - center)),
    };
  });
  const base = oneWayAnova(transformed, alpha, "Levene Statistic");
  const rawMeans = prepared.map((group) => jStat.mean(group.values));
  const rawStdevs = prepared.map((group) => Math.sqrt(jStat.variance(group.values, true)));
  const rawNs = prepared.map((group) => group.values.length);

  return {
    ...base,
    testType: "MULTI_VAR_LEVENE",
    meanA: rawMeans[0] ?? 0,
    meanB: rawMeans[1] ?? null,
    varA: (rawStdevs[0] ?? 0) ** 2,
    varB: rawStdevs[1] !== undefined ? rawStdevs[1] ** 2 : null,
    sdA: rawStdevs[0] ?? 0,
    sdB: rawStdevs[1] ?? null,
    deltaMean: 0,
    deltaVar: (Math.max(...rawStdevs.map((value) => value ** 2), 0)) - (Math.min(...rawStdevs.map((value) => value ** 2), 0)),
    deltaSd: Math.max(...rawStdevs, 0) - Math.min(...rawStdevs, 0),
    diff: Math.max(...rawStdevs, 0) - Math.min(...rawStdevs, 0),
    factorName: "Levene Statistic",
    varianceGroupLabels: prepared.map((group) => group.label),
    varianceGroupStdevs: rawStdevs,
    varianceGroupMeans: rawMeans,
    varianceGroupNs: rawNs,
    varianceGroupData: prepared.map((group) => group.values),
  };
}

function oneWayAnova(
  groups: Array<{ label: string; values: number[] }>,
  alpha: number,
  factorName: string,
): StatisticalResult {
  const prepared = groups.filter((group) => group.values.length >= 2);
  const k = prepared.length;
  let totalN = 0;
  let grandSum = 0;

  prepared.forEach((group) => {
    totalN += group.values.length;
    grandSum += jStat.sum(group.values);
  });

  const grandMean = grandSum / totalN;
  let ssBetween = 0;
  let ssWithin = 0;

  prepared.forEach((group) => {
    const groupMean = jStat.mean(group.values);
    ssBetween += group.values.length * (groupMean - grandMean) ** 2;

    group.values.forEach((value) => {
      ssWithin += (value - groupMean) ** 2;
    });
  });

  const dfBetween = k - 1;
  const dfWithin = totalN - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const fStat = msBetween / msWithin;
  const pValue = 1 - jStat.centralF.cdf(fStat, dfBetween, dfWithin);
  const critical = jStat.centralF.inv(1 - alpha, dfBetween, dfWithin);
  const regressionS = Math.sqrt(msWithin);
  const totalSS = ssBetween + ssWithin;
  const rSquared = totalSS > 0 ? ssBetween / totalSS : 0;
  const rSquaredAdj = totalN > 1 && totalSS > 0 ? 1 - msWithin / (totalSS / (totalN - 1)) : 0;
  const groupMeans = prepared.map((group) => jStat.mean(group.values));
  const maxMean = Math.max(...groupMeans);
  const minMean = Math.min(...groupMeans);
  const diff = maxMean - minMean;
  const pairCount = (k * (k - 1)) / 2;
  const anovaComparisons: StatisticalResult["anovaComparisons"] = [];

  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
      const left = prepared[leftIndex];
      const right = prepared[rightIndex];
      const meanDiff = jStat.mean(left.values) - jStat.mean(right.values);
      const standardError = Math.sqrt(msWithin * (1 / left.values.length + 1 / right.values.length)) || 1e-9;
      const tValue = meanDiff / standardError;
      const rawP = 2 * (1 - jStat.studentt.cdf(Math.abs(tValue), dfWithin));
      const adjustedP = Math.min(rawP * pairCount, 1);

      anovaComparisons.push({
        leftLabel: left.label,
        rightLabel: right.label,
        meanDiff,
        tStat: tValue,
        rawP,
        adjustedP,
        significant: adjustedP < alpha,
      });
    }
  }

  return {
    testType: "1_WAY_ANOVA",
    meanA: groupMeans[0] ?? 0,
    meanB: groupMeans[1] ?? null,
    varA: 0,
    varB: null,
    sdA: 0,
    sdB: null,
    deltaMean: diff,
    deltaVar: ssBetween + ssWithin,
    deltaSd: Math.sqrt(msWithin || 0),
    nA: prepared[0]?.values.length ?? 0,
    nB: prepared[1]?.values.length ?? null,
    tStat: fStat,
    df: dfWithin,
    pValue: Math.max(0, Math.min(1, pValue)),
    targetMean: null,
    standardError: Math.sqrt(msWithin || 0),
    pooledSd: null,
    cohensD: msWithin > 0 ? Math.sqrt(msBetween / msWithin) : 0,
    critical,
    achievedPower: 0,
    minimumDetectableEffect: 0,
    diff,
    marginOfError: 0,
    ciLow: 0,
    ciHigh: 0,
    reject: pValue < alpha,
    anovaGroupLabels: prepared.map((group) => group.label),
    anovaGroupMeans: groupMeans,
    anovaGroupData: prepared.map((group) => group.values),
    grandMean,
    dfBetween,
    dfWithin,
    ssBetween,
    ssWithin,
    msBetween,
    msWithin,
    totalN,
    factorName,
    regressionS,
    rSquared,
    rSquaredAdj,
    anovaComparisons,
  };
}

function twoWayAnova(
  rows: TwoWayAnovaParsedRow[],
  alpha: number,
  factorAName: string,
  factorBName: string,
  responseName: string,
): TwoWayAnovaAnalysisResult | null {
  const factorALevels = Array.from(new Set(rows.map((row) => row.factorA))).sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );
  const factorBLevels = Array.from(new Set(rows.map((row) => row.factorB))).sort((left, right) =>
    left.localeCompare(right, "zh-CN"),
  );

  if (factorALevels.length < 2 || factorBLevels.length < 2) {
    return null;
  }

  const cellMap = new Map<string, number[]>();
  rows.forEach((row) => {
    const key = `${row.factorA}__${row.factorB}`;
    const current = cellMap.get(key) ?? [];
    current.push(row.response);
    cellMap.set(key, current);
  });

  const counts: number[] = [];
  for (const levelA of factorALevels) {
    for (const levelB of factorBLevels) {
      const values = cellMap.get(`${levelA}__${levelB}`);
      if (!values || values.length < 2) {
        return null;
      }
      counts.push(values.length);
    }
  }

  const replicatesPerCell = counts[0];
  if (!counts.every((count) => count === replicatesPerCell)) {
    return null;
  }

  const totalN = rows.length;
  const grandMean = rows.reduce((sum, row) => sum + row.response, 0) / totalN;
  const meanA = factorALevels.map((level) => {
    const values = rows.filter((row) => row.factorA === level).map((row) => row.response);
    return {
      level,
      mean: jStat.mean(values),
      stdev: Math.sqrt(jStat.variance(values, true) || 0),
      n: values.length,
    };
  });
  const meanB = factorBLevels.map((level) => {
    const values = rows.filter((row) => row.factorB === level).map((row) => row.response);
    return {
      level,
      mean: jStat.mean(values),
      stdev: Math.sqrt(jStat.variance(values, true) || 0),
      n: values.length,
    };
  });

  const meanAMap = new Map(meanA.map((item) => [item.level, item.mean]));
  const meanBMap = new Map(meanB.map((item) => [item.level, item.mean]));
  const meanCellMap = new Map<string, number>();
  const meanCells: TwoWayAnovaAnalysisResult["meanCells"] = [];
  let ssError = 0;

  factorALevels.forEach((levelA) => {
    factorBLevels.forEach((levelB) => {
      const key = `${levelA}__${levelB}`;
      const values = cellMap.get(key) ?? [];
      const cellMean = jStat.mean(values);
      meanCellMap.set(key, cellMean);
      meanCells.push({ factorA: levelA, factorB: levelB, mean: cellMean });
      values.forEach((value) => {
        ssError += (value - cellMean) ** 2;
      });
    });
  });
  const residuals: TwoWayAnovaAnalysisResult["residuals"] = rows.map((row) => {
    const fitted = meanCellMap.get(`${row.factorA}__${row.factorB}`) ?? row.response;
    return {
      fitted,
      residual: row.response - fitted,
      factorA: row.factorA,
      factorB: row.factorB,
    };
  });

  const a = factorALevels.length;
  const b = factorBLevels.length;
  const n = replicatesPerCell;
  const ssA =
    b *
    n *
    meanA.reduce((sum, item) => sum + (item.mean - grandMean) ** 2, 0);
  const ssB =
    a *
    n *
    meanB.reduce((sum, item) => sum + (item.mean - grandMean) ** 2, 0);

  let ssInteraction = 0;
  factorALevels.forEach((levelA) => {
    factorBLevels.forEach((levelB) => {
      const cellMean = meanCellMap.get(`${levelA}__${levelB}`) ?? grandMean;
      const meanLevelA = meanAMap.get(levelA) ?? grandMean;
      const meanLevelB = meanBMap.get(levelB) ?? grandMean;
      ssInteraction += n * (cellMean - meanLevelA - meanLevelB + grandMean) ** 2;
    });
  });

  const ssTotal = rows.reduce((sum, row) => sum + (row.response - grandMean) ** 2, 0);
  const dfA = a - 1;
  const dfB = b - 1;
  const dfInteraction = (a - 1) * (b - 1);
  const dfError = a * b * (n - 1);
  const dfTotal = totalN - 1;
  const msA = ssA / dfA;
  const msB = ssB / dfB;
  const msInteraction = ssInteraction / dfInteraction;
  const msError = ssError / dfError;

  const computeFValue = (meanSquare: number) => {
    if (msError <= 1e-12) {
      return meanSquare > 0 ? Number.POSITIVE_INFINITY : 0;
    }
    return meanSquare / msError;
  };
  const computeFProbability = (fValue: number, df1: number) => {
    if (!Number.isFinite(fValue)) {
      return 0;
    }
    return Math.max(0, Math.min(1, 1 - jStat.centralF.cdf(fValue, df1, dfError)));
  };

  const fA = computeFValue(msA);
  const fB = computeFValue(msB);
  const fInteraction = computeFValue(msInteraction);
  const pA = computeFProbability(fA, dfA);
  const pB = computeFProbability(fB, dfB);
  const pInteraction = computeFProbability(fInteraction, dfInteraction);
  const criticalA = jStat.centralF.inv(1 - alpha, dfA, dfError);
  const criticalB = jStat.centralF.inv(1 - alpha, dfB, dfError);
  const criticalInteraction = jStat.centralF.inv(1 - alpha, dfInteraction, dfError);
  const rSquared = ssTotal > 0 ? 1 - ssError / ssTotal : 0;
  const rSquaredAdj =
    ssTotal > 0 && dfTotal > 0
      ? 1 - (msError / (ssTotal / dfTotal))
      : 0;

  return {
    factorAName,
    factorBName,
    responseName,
    levelsA: factorALevels,
    levelsB: factorBLevels,
    replicatesPerCell,
    totalN,
    grandMean,
    dfA,
    dfB,
    dfInteraction,
    dfError,
    dfTotal,
    ssA,
    ssB,
    ssInteraction,
    ssError,
    ssTotal,
    msA,
    msB,
    msInteraction,
    msError,
    fA,
    fB,
    fInteraction,
    pA,
    pB,
    pInteraction,
    criticalA,
    criticalB,
    criticalInteraction,
    rejectA: pA < alpha,
    rejectB: pB < alpha,
    rejectInteraction: pInteraction < alpha,
    rSquared,
    rSquaredAdj,
    meanA,
    meanB,
    meanCells,
    residuals,
  };
}

function parseSamples(raw: string): number[] {
  return raw
    .split(/[\s,;\n\t]+/)
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value));
}

function parseTwoWayMatrix(raw: string): TwoWayAnovaParsedRow[] {
  if (!raw.trim()) return [];

  return raw
    .split(/\r?\n/)
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      let factorA = "";
      let factorB = "";
      let response = Number.NaN;

      if (trimmed.includes("\t")) {
        const parts = trimmed.split("\t").map((part) => part.trim()).filter(Boolean);
        if (parts.length >= 3) {
          factorA = parts[0] ?? "";
          factorB = parts[1] ?? "";
          response = Number.parseFloat(parts[2] ?? "");
        }
      } else if (trimmed.includes(",")) {
        const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
        if (parts.length >= 3) {
          factorA = parts[0] ?? "";
          factorB = parts[1] ?? "";
          response = Number.parseFloat(parts[2] ?? "");
        }
      } else {
        const multiSpaceParts = trimmed.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
        if (multiSpaceParts.length >= 3) {
          factorA = multiSpaceParts[0] ?? "";
          factorB = multiSpaceParts[1] ?? "";
          response = Number.parseFloat(multiSpaceParts[2] ?? "");
        } else {
          const rawParts = trimmed.split(/\s+/).filter(Boolean);
          if (rawParts.length >= 3) {
            const tailValue = Number.parseFloat(rawParts.pop() ?? "");
            const tailFactorB = rawParts.pop() ?? "";
            const tailFactorA = rawParts.join(" ").trim();
            factorA = tailFactorA;
            factorB = tailFactorB.trim();
            response = tailValue;
          }
        }
      }

      if (!factorA || !factorB || !Number.isFinite(response)) return null;

      return {
        id: `anova2-matrix-${index + 1}`,
        factorA,
        factorB,
        response,
      };
    })
    .filter((row): row is TwoWayAnovaParsedRow => row !== null);
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

function boxStats(xs: number[]): BoxStats {
  const sorted = [...xs].sort((left, right) => left - right);
  return {
    min: sorted[0] ?? 0,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -39.69683028665376,
    220.9460984245205,
    -275.9285104469687,
    138.357751867269,
    -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406,
    161.5858368580409,
    -155.6989798598866,
    66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293,
    -0.3223964580411365,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    0.007784695709041462,
    0.3224671290700398,
    2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

function qqPoints(xs: number[]): QQPoint[] {
  if (xs.length < 2) return [];
  const sorted = [...xs].sort((left, right) => left - right);
  const avg = mean(sorted);
  const sigma = std(sorted) || 1e-9;
  return sorted.map((value, index) => {
    const probability = (index + 0.5) / sorted.length;
    const theoretical = normalQuantile(probability);
    const sample = (value - avg) / sigma;
    return {
      theoretical,
      sample,
      outlier: Math.abs(sample - theoretical) > 0.55 && Math.abs(theoretical) > 1,
    };
  });
}

function formatPValue(pValue: number): string {
  return pValue < 0.0001 ? "< 0.0001" : pValue.toFixed(4);
}

function buildPolyline(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function StackedLabel({
  zh,
  en,
  className,
  align = "left",
  size = "md",
}: {
  zh: string;
  en: string;
  className?: string;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
}) {
  const zhSize = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";
  return (
    <div
      className={cn(
        "flex flex-col leading-tight",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
        className,
      )}
    >
      <span className={cn("font-semibold tracking-wide text-foreground", zhSize)}>{zh}</span>
      <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {en}
      </span>
    </div>
  );
}

function ModuleSelector({
  active,
  onChange,
}: {
  active: StatDomain;
  onChange: (id: StatDomain) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/25 p-2">
      {DOMAIN_OPTIONS.map((domain) => {
        const isActive = domain.id === active;
        return (
          <button
            key={domain.id}
            type="button"
            onClick={() => onChange(domain.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-all duration-200",
              isActive
                ? "border-cyan-500/80 bg-cyan-500/10 text-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.18)]"
                : "border-transparent text-gray-600 hover:text-gray-400",
            )}
          >
            <span className="block text-[11px] font-semibold tracking-wide">{domain.zh}</span>
            <span className="font-num block text-[9px] uppercase tracking-[0.2em]">
              {domain.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TestVariantSelector({
  activeDomain,
  activeTest,
  onChange,
}: {
  activeDomain: StatDomain;
  activeTest: TestVariant;
  onChange: (value: TestVariant) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/5 bg-black/20 p-1.5">
      {TEST_OPTIONS_BY_DOMAIN[activeDomain].map((option) => {
        const isActive = option.id === activeTest;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "font-num rounded-md border px-2.5 py-2 text-[9px] uppercase tracking-[0.14em] transition-all duration-200 whitespace-nowrap",
              isActive
                ? "border-cyan-500/80 bg-cyan-500/10 text-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.16)]"
                : "border-transparent text-gray-600 hover:text-gray-400",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MicroButton({
  icon,
  label,
  tone = "cyan",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone?: "cyan" | "rose";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "recessed font-num flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
        tone === "cyan"
          ? "text-primary glow-cyan-hover hover:bg-primary/10"
          : "text-[var(--rose-gold)] hover:bg-[var(--rose-gold)]/10",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SampleInput({
  tone,
  tag,
  zh,
  en,
  n,
  value,
  onChange,
  onPaste,
}: {
  tone: "cyan" | "rose";
  tag: string;
  zh: string;
  en: string;
  n: number;
  value: string;
  onChange: (value: string) => void;
  onPaste: () => void;
}) {
  const accent = tone === "cyan" ? "text-primary" : "text-[var(--rose-gold)]";
  const tagStyles =
    tone === "cyan"
      ? "bg-primary/15 text-primary"
      : "bg-[var(--rose-gold)]/15 text-[var(--rose-gold)]";
  const lineCount = Math.max(3, value.split("\n").length);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("font-num grid h-6 min-w-8 place-items-center rounded text-[11px] font-bold", tagStyles)}>
            {tag}
          </span>
          <StackedLabel zh={zh} en={en} size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-num text-[10px] uppercase tracking-wider text-muted-foreground">
            n = {n}
          </span>
          <button
            type="button"
            onClick={onPaste}
            className={cn("font-num text-[9px] uppercase tracking-wider transition-colors", accent)}
          >
            粘贴
          </button>
        </div>
      </div>
      <div className="recessed rounded-lg border border-white/5 p-2">
        <textarea
          rows={lineCount}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-num min-h-[92px] w-full resize-y bg-transparent text-xs leading-6 text-foreground outline-none placeholder:text-muted-foreground/40"
          placeholder="输入或粘贴测量值，支持逗号、空格、换行分隔"
        />
      </div>
    </div>
  );
}

function ParameterPanel({
  h0,
  h1,
  alpha,
  factorName,
  factorAName,
  factorBName,
  responseName,
  activeTest,
  tailDirection,
  payloadMode,
  sampleA,
  sampleB,
  targetMean,
  targetStdev,
  targetProportion,
  multiVectorInputs,
  twoWayMatrixInput,
  twoWayValidCount,
  twoWayAnalysis,
  summaryRows,
  nA,
  nB,
  reject,
  moduleLocked,
  onAlpha,
  onFactorNameChange,
  onFactorANameChange,
  onFactorBNameChange,
  onResponseNameChange,
  onTailDirection,
  onSampleA,
  onSampleB,
  onTargetMeanChange,
  onTargetStdevChange,
  onTargetProportionChange,
  onMultiVectorChange,
  onAddMultiVectorGroup,
  onRemoveMultiVectorGroup,
  onTwoWayMatrixChange,
  onSummaryRowChange,
}: {
  h0: string;
  h1: string;
  alpha: number;
  factorName: string;
  factorAName: string;
  factorBName: string;
  responseName: string;
  activeTest: TestVariant;
  tailDirection: TailDirection;
  payloadMode: PayloadMode;
  sampleA: string;
  sampleB: string;
  targetMean: string;
  targetStdev: string;
  targetProportion: string;
  multiVectorInputs: Array<{ id: string; label: string; value: string }>;
  twoWayMatrixInput: string;
  twoWayValidCount: number;
  twoWayAnalysis: TwoWayAnovaAnalysisResult | null;
  summaryRows: Array<{ id: string; label: string; events: string; trials: string }>;
  nA: number;
  nB: number;
  reject: boolean;
  moduleLocked: boolean;
  onAlpha: (value: number) => void;
  onFactorNameChange: (value: string) => void;
  onFactorANameChange: (value: string) => void;
  onFactorBNameChange: (value: string) => void;
  onResponseNameChange: (value: string) => void;
  onTailDirection: (value: TailDirection) => void;
  onSampleA: (value: string) => void;
  onSampleB: (value: string) => void;
  onTargetMeanChange: (value: string) => void;
  onTargetStdevChange: (value: string) => void;
  onTargetProportionChange: (value: string) => void;
  onMultiVectorChange: (id: string, value: string) => void;
  onAddMultiVectorGroup: () => void;
  onRemoveMultiVectorGroup: (id: string) => void;
  onTwoWayMatrixChange: (value: string) => void;
  onSummaryRowChange: (id: string, field: "events" | "trials", value: string) => void;
}) {
  async function pasteInto(setter: (value: string) => void) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setter(text);
    } catch {
      // Clipboard may be unavailable in some embedded environments.
    }
  }

  const tailLabel = TAIL_OPTIONS.find((option) => option.id === tailDirection)?.label ?? tailDirection;
  const pairedLabels =
    activeTest === "PAIRED_T"
      ? {
          labelA: "样本组 A (处理前)",
          labelB: "样本组 B (处理后)",
          enA: "Group A (Before)",
          enB: "Group B (After)",
        }
      : activeTest === "1_VAR_CHI_SQ" || activeTest === "2_VAR_F"
        ? {
            labelA: "样本集 A",
            labelB: "样本集 B",
            enA: "Sample Set A",
            enB: "Sample Set B",
          }
      : {
          labelA: "样本组 A",
          labelB: "样本组 B",
          enA: "Sample Group A",
          enB: "Sample Group B",
        };

  const renderDataInjection = () => {
    switch (payloadMode) {
      case "1_VECTOR":
        return (
          <>
            <SampleInput
              tone="cyan"
              tag="A"
              zh={pairedLabels.labelA}
              en={pairedLabels.enA}
              n={nA}
              value={sampleA}
              onChange={onSampleA}
              onPaste={() => void pasteInto(onSampleA)}
            />
            {activeTest === "1_SAMPLE_T" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <StackedLabel zh="目标基准值" en="Target Mean" size="sm" />
                  <span className="font-num text-[10px] uppercase tracking-wider text-muted-foreground">μ₀</span>
                </div>
                <div className="recessed rounded-lg border border-white/5 p-3">
                  <input
                    type="number"
                    step="any"
                    value={targetMean}
                    onChange={(event) => onTargetMeanChange(event.target.value)}
                    className="font-num w-full bg-transparent text-sm text-foreground outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : null}
          </>
        );
      case "MULTI_VECTORS":
        return (
          <>
            <div className="flex items-center justify-between gap-2">
              <StackedLabel zh="多组数据阵列" en="Multi-Group Arrays" size="sm" />
              <MicroButton icon={<Activity className="h-3 w-3" />} label="新增样本组" onClick={onAddMultiVectorGroup} />
            </div>
            {multiVectorInputs.map((group, index) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </span>
                  {index >= 2 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveMultiVectorGroup(group.id)}
                      className="recessed rounded-md px-2 py-1 text-[11px] text-[var(--warning)]"
                      title="删除样本组"
                    >
                      [🗑]
                    </button>
                  ) : null}
                </div>
                <SampleInput
                  tone={index % 2 === 0 ? "cyan" : "rose"}
                  tag={String.fromCharCode(65 + index)}
                  zh={group.label}
                  en={`Group ${String.fromCharCode(65 + index)}`}
                  n={parseSamples(group.value).length}
                  value={group.value}
                  onChange={(value) => onMultiVectorChange(group.id, value)}
                  onPaste={() => void pasteInto((value) => onMultiVectorChange(group.id, value))}
                />
              </div>
            ))}
            <div className="pt-1">
              <MicroButton icon={<Activity className="h-3 w-3" />} label="+ ADD GROUP" onClick={onAddMultiVectorGroup} />
            </div>
          </>
        );
      case "SUMMARY_STATS":
        return (
          <div className="grid gap-3">
            {(activeTest === "1_PROP_Z" ? summaryRows.slice(0, 1) : summaryRows).map((row, index) => (
              <div key={row.id} className="recessed rounded-lg border border-white/5 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <StackedLabel
                    zh={activeTest === "1_PROP_Z" || activeTest === "2_PROP_Z" ? `样本组 ${String.fromCharCode(65 + index)}` : row.label}
                    en={activeTest === "1_PROP_Z" || activeTest === "2_PROP_Z" ? `SAMPLE ${String.fromCharCode(65 + index)}` : row.label.toUpperCase()}
                    size="sm"
                  />
                  <span className="font-num text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    Summary Grid
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Events</span>
                    <input
                      type="number"
                      value={row.events}
                      onChange={(event) => onSummaryRowChange(row.id, "events", event.target.value)}
                      className="font-num recessed rounded-md border border-white/5 px-3 py-2 text-sm text-foreground outline-none"
                      placeholder="0"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Trials</span>
                    <input
                      type="number"
                      value={row.trials}
                      onChange={(event) => onSummaryRowChange(row.id, "trials", event.target.value)}
                      className="font-num recessed rounded-md border border-white/5 px-3 py-2 text-sm text-foreground outline-none"
                      placeholder="0"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        );
      case "FACTOR_MATRIX":
        return null;
      case "2_VECTORS":
      default:
        return (
          <>
            <SampleInput
              tone="cyan"
              tag="A"
              zh={pairedLabels.labelA}
              en={pairedLabels.enA}
              n={nA}
              value={sampleA}
              onChange={onSampleA}
              onPaste={() => void pasteInto(onSampleA)}
            />
            <SampleInput
              tone="rose"
              tag="B"
              zh={pairedLabels.labelB}
              en={pairedLabels.enB}
              n={nB}
              value={sampleB}
              onChange={onSampleB}
              onPaste={() => void pasteInto(onSampleB)}
            />
          </>
        );
    }
  };

  return (
    <section className="metal-panel flex flex-col gap-5 rounded-2xl p-5">
      <header className="flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary glow-cyan">
          <FlaskConical className="h-4 w-4" />
        </span>
        <StackedLabel zh="参数配置" en="Audit Setup & Parameters" size="lg" />
      </header>

      {activeTest !== "2_WAY_ANOVA" ? (
      <div className="recessed flex flex-col gap-3 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <StackedLabel zh="假设陈述" en="Hypothesis Statement" size="sm" />
          <span
            className={cn(
              "font-num text-[9px] uppercase tracking-[0.2em]",
              reject ? "text-[var(--warning)]" : "text-primary",
            )}
          >
            {reject ? "H1 Prevails" : "H0 Holds"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className={cn("flex items-center gap-2 rounded-md p-1.5 transition-all duration-500", reject ? "opacity-30" : "opacity-100")}>
            <span className="font-num grid h-6 w-9 shrink-0 place-items-center rounded bg-primary/15 text-[11px] font-bold text-primary">
              H0
            </span>
            <p className={cn("font-num text-xs leading-relaxed text-foreground/85 transition-all", reject && "line-through decoration-[var(--warning)]/70")}>
              {h0}
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md p-1.5 transition-all duration-500",
              reject ? "bg-[var(--warning)]/8" : "opacity-70",
            )}
            style={
              reject
                ? {
                    boxShadow:
                      "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.55), 0 0 18px -6px oklch(0.7 0.24 25 / 0.6)",
                  }
                : undefined
            }
          >
            <span className="font-num grid h-6 w-9 shrink-0 place-items-center rounded bg-[var(--rose-gold)]/15 text-[11px] font-bold text-[var(--rose-gold)]">
              H1
            </span>
            <p className={cn("font-num text-xs font-medium leading-relaxed transition-colors", reject ? "text-[var(--warning)]" : "text-foreground/85")}>
              {h1}
            </p>
          </div>
        </div>
      </div>
      ) : null}

      {activeTest === "1_WAY_ANOVA" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <StackedLabel zh="实验因子名称" en="Factor Name" size="sm" />
            <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Audit Subject
            </span>
          </div>
          <div className="recessed rounded-lg border border-white/5 p-3">
            <input
              type="text"
              value={factorName}
              onChange={(event) => onFactorNameChange(event.target.value)}
              className="font-num w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="Factor (组间)"
            />
          </div>
        </div>
      ) : null}

      {activeTest === "1_VAR_CHI_SQ" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <StackedLabel zh="目标标准差" en="Target StDev (σ₀)" size="sm" />
            <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Variance Audit</span>
          </div>
          <div className="recessed rounded-lg border border-white/5 p-3">
            <input
              type="number"
              step="any"
              value={targetStdev}
              onChange={(event) => onTargetStdevChange(event.target.value)}
              className="font-num w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="1.0"
            />
          </div>
        </div>
      ) : null}

      {activeTest === "1_PROP_Z" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <StackedLabel zh="目标比例" en="Target Proportion (p₀)" size="sm" />
            <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Proportion Audit</span>
          </div>
          <div className="recessed rounded-lg border border-white/5 p-3">
            <input
              type="number"
              step="any"
              value={targetProportion}
              onChange={(event) => onTargetProportionChange(event.target.value)}
              className="font-num w-full bg-transparent text-sm text-foreground outline-none"
              placeholder="0.50"
            />
          </div>
        </div>
      ) : null}

      {activeTest !== "2_WAY_ANOVA" ? (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <StackedLabel zh="显著性水平" en="Significance Level α" size="sm" />
          <span className="font-num text-sm font-bold text-primary text-glow-cyan">α = {alpha.toFixed(2)}</span>
        </div>
        <div className="recessed grid grid-cols-3 gap-1.5 rounded-lg p-1.5">
          {ALPHA_OPTIONS.map((candidate) => {
            const isActive = candidate === alpha;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => onAlpha(candidate)}
                className={cn(
                  "font-num rounded-md py-2.5 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "glow-cyan bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {candidate.toFixed(2)}
              </button>
            );
          })}
        </div>
      </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <StackedLabel zh="检验方向" en="Directionality (Tails)" size="sm" />
          <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{tailLabel}</span>
        </div>
        <div className="recessed grid grid-cols-1 gap-1.5 rounded-lg p-1.5">
          {TAIL_OPTIONS.map((option) => {
            const isActive = option.id === tailDirection;
            const disabled =
              (activeTest === "1_WAY_ANOVA" || activeTest === "2_WAY_ANOVA") &&
              option.id !== "RIGHT_TAILED";
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onTailDirection(option.id)}
                className={cn(
                  "font-num flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "glow-cyan bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="min-w-7 text-[11px]">{option.shortLabel}</span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <StackedLabel zh="数据源注入" en="Data Source Injection" size="sm" />
          <div className="flex items-center gap-1.5">
            <MicroButton
              icon={<ClipboardPaste className="h-3 w-3" />}
              label="PASTE"
              onClick={() => {
                if (payloadMode === "FACTOR_MATRIX") {
                  void pasteInto(onTwoWayMatrixChange);
                  return;
                }
                void pasteInto(onSampleA);
                void pasteInto(onSampleB);
              }}
            />
            <MicroButton
              icon={<Trash2 className="h-3 w-3" />}
              label="CLEAR"
              tone="rose"
              onClick={() => {
                if (payloadMode === "FACTOR_MATRIX") {
                  onTwoWayMatrixChange("");
                  return;
                }
                onSampleA("");
                onSampleB("");
              }}
            />
          </div>
        </div>

        {renderDataInjection()}

        {moduleLocked ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-amber-400/20 bg-slate-950/88 backdrop-blur-sm">
            <div className="recessed rounded-xl px-5 py-4 text-center">
              <p className="font-num text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                [ SYSTEM LOCKED: MODULE PENDING INSTALL ]
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OfflineModulePanel({
  activeTest,
  compact = false,
}: {
  activeTest: TestVariant;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center justify-center rounded-2xl border border-amber-400/20 bg-slate-950/60 text-center",
        compact ? "min-h-[220px] p-6" : "min-h-[320px] p-10",
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/10 text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.16)]">
        <Lock className="h-7 w-7" />
      </div>
      <p className="font-num text-sm font-bold uppercase tracking-[0.24em] text-amber-200">
        [ MODULE OFFLINE: REQUIRED ALGORITHMS PENDING INJECTION ]
      </p>
      <p className="mt-3 font-num text-[11px] uppercase tracking-[0.18em] text-amber-100/70">
        Awaiting specific jStat/Math.js compute integration for {activeTest}
      </p>
    </div>
  );
}

function VerdictHud({
  pValue,
  alpha,
  reject,
  testType,
}: {
  pValue: number;
  alpha: number;
  reject: boolean;
  testType: StatisticalResult["testType"];
}) {
  const systemLog =
    testType === "1_PROP_Z"
      ? "SYS_LOG: One-Proportion Z-Test Executed"
      : testType === "2_PROP_Z"
        ? "SYS_LOG: Two-Proportion Z-Test Executed"
      : testType === "1_VAR_CHI_SQ"
        ? "SYS_LOG: Chi-Square Variance Test Executed"
        : testType === "2_VAR_F"
          ? "SYS_LOG: F-Test for Variance Ratio Executed"
          : "SYS_LOG: Welch's T-Test Executed (Unequal Variances Assumed)";
  return (
    <section
      className="mech-frame glass relative overflow-hidden rounded-2xl p-5 text-center transition-colors duration-500"
      style={
        {
          "--bracket": reject ? "oklch(0.7 0.24 25 / 0.8)" : "oklch(0.82 0.14 200 / 0.8)",
          boxShadow: reject
            ? "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 0 1px oklch(0.7 0.24 25 / 0.4), 0 0 30px oklch(0.7 0.24 25 / 0.18), 0 0 80px -10px oklch(0.7 0.24 25 / 0.55)"
            : "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 30px oklch(0.82 0.14 200 / 0.05), 0 0 80px -12px oklch(0.82 0.14 200 / 0.45)",
        } as React.CSSProperties
      }
    >
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <div className="flex items-center justify-center gap-2">
        <span className={cn("font-num text-[10px] uppercase tracking-[0.3em]", reject ? "text-[var(--warning)]" : "text-primary")}>
          {testType === "1_PROP_Z" || testType === "2_PROP_Z"
            ? "Proportion P-Value / 比率显著性"
            : testType === "1_VAR_CHI_SQ" || testType === "2_VAR_F"
              ? "Variance P-Value / 波动显著性"
              : "P-Value / 显著性结果"}
        </span>
      </div>

      <div
        className={cn(
          "font-num mt-1 text-5xl font-bold tabular-nums sm:text-6xl",
          reject ? "text-[var(--warning)] text-glow-warning" : "text-primary text-glow-cyan",
        )}
      >
        {formatPValue(pValue)}
      </div>

      <div
        className={cn(
          "mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
          reject ? "animate-pulse bg-[var(--warning)]/15 text-[var(--warning)]" : "bg-primary/15 text-primary",
        )}
      >
        {reject ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {reject
          ? (testType === "1_PROP_Z" || testType === "2_PROP_Z"
              ? "REJECT H0 / 比率偏移"
              : testType === "1_VAR_CHI_SQ" || testType === "2_VAR_F"
                ? "REJECT H0 / 波动超标"
                : "REJECT H0 / 拒绝原假设")
          : (testType === "1_PROP_Z" || testType === "2_PROP_Z"
              ? "PROPORTION IN CONTROL / 比率受控"
              : testType === "1_VAR_CHI_SQ" || testType === "2_VAR_F"
                ? "VARIANCE IN CONTROL / 波动受控"
                : "FAIL TO REJECT / 暂不拒绝 H0")}
      </div>

      <p className="font-num mt-2 text-[11px] text-muted-foreground">
        {reject ? `P < α (${alpha.toFixed(2)})` : `P ≥ α (${alpha.toFixed(2)})`}
      </p>

      <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/40 pt-3">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        <p className="font-num text-[10px] tracking-wide text-muted-foreground/80">
          {systemLog}
        </p>
      </div>
    </section>
  );
}


function TelemetryReadout({
  result,
  critical,
}: {
  result: StatisticalResult;
  critical: number;
}) {
  if (result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z") {
    const cells = [
      { zh: "Z 统计量", en: "Z Value", value: result.tStat.toFixed(4), tag: "Z" },
      { zh: "样本组 A 比例", en: "Sample A Proportion", value: result.meanA.toFixed(4), tag: "p̂A" },
      { zh: result.testType === "1_PROP_Z" ? "目标比例" : "样本组 B 比例", en: result.testType === "1_PROP_Z" ? "Target Proportion" : "Sample B Proportion", value: (result.testType === "1_PROP_Z" ? result.targetMean ?? 0 : result.meanB ?? 0).toFixed(4), tag: result.testType === "1_PROP_Z" ? "p0" : "p̂B" },
      { zh: "标准误差", en: "Std. Error", value: result.standardError.toFixed(4), tag: "SE" },
    ];

    return (
      <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-foreground">比率遥测读数</span>
            <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Proportion Telemetry Readout
            </span>
          </div>
          <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Streaming
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cells.map((cell) => (
            <div key={cell.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">{cell.en}</span>
                <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">{cell.tag}</span>
              </div>
              <span className="font-num text-2xl font-bold tabular-nums text-foreground">{cell.value}</span>
              <span className="text-[10px] text-muted-foreground">{cell.zh}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result.testType === "MULTI_VAR_LEVENE") {
    const spread = result.varianceGroupStdevs ?? [];
    const maxSpread = spread.length ? Math.max(...spread) : 0;
    const minSpread = spread.length ? Math.min(...spread) : 0;
    const cells = [
      { zh: "Levene F 统计量", en: "Levene F", value: result.tStat.toFixed(4), tag: "F" },
      { zh: "组间自由度", en: "DF Between", value: (result.dfBetween ?? 0).toFixed(0), tag: "DFB" },
      { zh: "组内自由度", en: "DF Within", value: (result.dfWithin ?? result.df).toFixed(0), tag: "DFW" },
      { zh: "波动跨度", en: "StDev Spread", value: (maxSpread - minSpread).toFixed(4), tag: "ΔS" },
    ];

    return (
      <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-foreground">齐性遥测读数</span>
            <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Homogeneity Telemetry
            </span>
          </div>
          <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Streaming
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cells.map((cell) => (
            <div key={cell.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">{cell.en}</span>
                <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">{cell.tag}</span>
              </div>
              <span className="font-num text-2xl font-bold tabular-nums text-foreground">{cell.value}</span>
              <span className="text-[10px] text-muted-foreground">{cell.zh}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result.testType === "2_VAR_F") {
    const cells = [
      { zh: "F 统计量", en: "F Ratio", value: result.tStat.toFixed(4), tag: "F" },
      { zh: "自由度 (A)", en: "DF1", value: result.df.toFixed(0), tag: "DF1" },
      { zh: "自由度 (B)", en: "DF2", value: (result.dfSecondary ?? 0).toFixed(0), tag: "DF2" },
      { zh: "方差比", en: "Variance Ratio", value: result.cohensD.toFixed(4), tag: "σA²/σB²" },
    ];

    return (
      <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-foreground">方差比遥测读数</span>
            <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Variance Ratio Telemetry
            </span>
          </div>
          <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Streaming
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cells.map((cell) => (
            <div key={cell.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">{cell.en}</span>
                <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">{cell.tag}</span>
              </div>
              <span className="font-num text-2xl font-bold tabular-nums text-foreground">{cell.value}</span>
              <span className="text-[10px] text-muted-foreground">{cell.zh}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result.testType === "1_VAR_CHI_SQ") {
    const cells = [
      { zh: "卡方统计量", en: "Chi-Square", value: result.tStat.toFixed(4), tag: "X²" },
      { zh: "自由度", en: "Degrees of Freedom", value: result.df.toFixed(0), tag: "DF" },
      { zh: "目标标准差", en: "Target StDev", value: (result.targetStdev ?? 0).toFixed(4), tag: "σ₀" },
      { zh: "样本标准差", en: "Sample StDev", value: result.sdA.toFixed(4), tag: "S" },
    ];

    return (
      <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-foreground">波动遥测读数</span>
            <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Dispersion Telemetry Readout
            </span>
          </div>
          <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Streaming
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cells.map((cell) => (
            <div key={cell.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">{cell.en}</span>
                <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">{cell.tag}</span>
              </div>
              <span className="font-num text-2xl font-bold tabular-nums text-foreground">{cell.value}</span>
              <span className="text-[10px] text-muted-foreground">{cell.zh}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (
    result.testType === "1_WAY_ANOVA" &&
    result.dfBetween !== undefined &&
    result.dfWithin !== undefined &&
    result.msBetween !== undefined &&
    result.msWithin !== undefined &&
    result.grandMean !== undefined
  ) {
    const cells = [
      { zh: "F 统计量", en: "F-Value", value: result.tStat.toFixed(3), tag: "F" },
      { zh: "组间自由度", en: "DF Between", value: result.dfBetween.toFixed(0), tag: "DFB" },
      { zh: "组内自由度", en: "DF Within", value: result.dfWithin.toFixed(0), tag: "DFW" },
      { zh: "总均值", en: "Grand Mean", value: result.grandMean.toFixed(3), tag: "μG" },
      { zh: "组间均方", en: "MS Between", value: result.msBetween.toFixed(4), tag: "MSB" },
      { zh: "组内均方", en: "MS Within", value: result.msWithin.toFixed(4), tag: "MSW" },
    ];

    return (
      <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-wide text-foreground">实时遥测读数</span>
            <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Live Telemetry Readout
            </span>
          </div>
          <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Streaming
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {cells.map((cell) => (
            <div key={cell.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">
                  {cell.en}
                </span>
                <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">
                  {cell.tag}
                </span>
              </div>
              <span className="font-num text-2xl font-bold tabular-nums text-foreground">
                {cell.value}
              </span>
              <span className="text-[10px] text-muted-foreground">{cell.zh}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const effectLabel =
    result.cohensD >= 0.8 ? "LARGE" : result.cohensD >= 0.5 ? "MEDIUM" : "SMALL";
  const exceedRatio = Math.abs(result.tStat) / critical;
  const cells = [
    { zh: "效应量 / Cohen's d", en: "Effect Size", value: result.cohensD.toFixed(2), tag: effectLabel },
    { zh: "临界值超出倍数", en: "Critical Exceedance", value: `${exceedRatio.toFixed(1)}x`, tag: exceedRatio >= 1 ? "BEYOND" : "WITHIN" },
    { zh: "标准误差", en: "Std. Error", value: result.standardError.toFixed(4), tag: "SE" },
    { zh: result.testType === "1_SAMPLE_T" ? "样本自由度" : "Welch 自由度", en: result.testType === "1_SAMPLE_T" ? "Sample df" : "Welch df", value: result.df.toFixed(2), tag: "DF" },
  ];

  return (
    <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-wide text-foreground">实时遥测读数</span>
          <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Live Telemetry Readout
          </span>
        </div>
        <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Streaming
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cells.map((cell) => (
          <div key={cell.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">{cell.en}</span>
              <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">{cell.tag}</span>
            </div>
            <span className="font-num text-2xl font-bold tabular-nums text-foreground">{cell.value}</span>
            <span className="text-[10px] text-muted-foreground">{cell.zh}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestRobustnessPanel({ result }: { result: StatisticalResult }) {
  if (result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z") {
    return (
      <section className="glass rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
        <div className="mb-3 flex flex-col gap-1 border-b border-white/5 pb-3">
          <h3 className="font-num text-[12px] font-bold uppercase tracking-[0.22em] text-foreground">
            [ 比率置信边界 / PROPORTION CONFIDENCE ]
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {result.testType === "1_PROP_Z"
              ? "聚焦当前样本比例与目标比例的偏移，以及 95% 置信区间是否覆盖当前过程要求。"
              : "聚焦两组事件占比的真实差距，以及差值置信区间是否远离零差异基线。"}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">{result.testType === "1_PROP_Z" ? "目标比例 / TARGET p0" : "样本组 A 比例 / SAMPLE A"}</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{(result.testType === "1_PROP_Z" ? result.targetMean ?? 0 : result.meanA).toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">{result.testType === "1_PROP_Z" ? "样本比例 / SAMPLE p̂" : "样本组 B 比例 / SAMPLE B"}</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{(result.testType === "1_PROP_Z" ? result.meanA : result.meanB ?? 0).toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">{result.testType === "1_PROP_Z" ? "95% CI / PROPORTION RANGE" : "95% CI / DELTA RANGE"}</p>
            <p className="mt-2 font-num text-base font-bold text-slate-100">[{result.ciLow.toFixed(4)}, {result.ciHigh.toFixed(4)}]</p>
          </div>
        </div>
      </section>
    );
  }

  if (result.testType === "MULTI_VAR_LEVENE") {
    const spread = result.varianceGroupStdevs ?? [];
    const maxSpread = spread.length ? Math.max(...spread) : 0;
    const minSpread = spread.length ? Math.min(...spread) : 0;
    return (
      <section className="glass rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
        <div className="mb-3 flex flex-col gap-1 border-b border-white/5 pb-3">
          <h3 className="font-num text-[12px] font-bold uppercase tracking-[0.22em] text-foreground">
            [ 波动齐性边界 / HOMOGENEITY CONFIDENCE ]
          </h3>
          <p className="text-[11px] text-muted-foreground">
            聚焦各样本组标准差的跨度，以及当前 Levene F 统计量是否显示出波动不一致风险。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">最大标准差 / MAX S</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{maxSpread.toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">最小标准差 / MIN S</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{minSpread.toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">标准差跨度 / SPREAD</p>
            <p className="mt-2 font-num text-base font-bold text-slate-100">{(maxSpread - minSpread).toFixed(4)}</p>
          </div>
        </div>
      </section>
    );
  }

  if (result.testType === "2_VAR_F") {
    return (
      <section className="glass rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
        <div className="mb-3 flex flex-col gap-1 border-b border-white/5 pb-3">
          <h3 className="font-num text-[12px] font-bold uppercase tracking-[0.22em] text-foreground">
            [ 方差比置信边界 / VARIANCE RATIO CONFIDENCE ]
          </h3>
          <p className="text-[11px] text-muted-foreground">
            聚焦两组样本标准差的真实差距，以及方差比区间是否稳定落在当前工艺容差内。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">样本 A 标准差 / SAMPLE A</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{result.sdA.toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">样本 B 标准差 / SAMPLE B</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{(result.sdB ?? 0).toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">方差比区间 / VARIANCE RATIO CI</p>
            <p className="mt-2 font-num text-base font-bold text-slate-100">[{result.ciLow.toFixed(4)}, {result.ciHigh.toFixed(4)}]</p>
          </div>
        </div>
      </section>
    );
  }

  if (result.testType === "1_VAR_CHI_SQ") {
    return (
      <section className="glass rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
        <div className="mb-3 flex flex-col gap-1 border-b border-white/5 pb-3">
          <h3 className="font-num text-[12px] font-bold uppercase tracking-[0.22em] text-foreground">
            [ 波动置信边界 / VARIANCE CONFIDENCE ]
          </h3>
          <p className="text-[11px] text-muted-foreground">
            聚焦样本标准差与目标标准差的偏移，以及 95% 置信区间是否覆盖当前目标波动标准。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">目标标准差 / TARGET σ₀</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{(result.targetStdev ?? 0).toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">样本标准差 / SAMPLE S</p>
            <p className="mt-2 font-num text-2xl font-bold text-slate-100">{result.sdA.toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
            <p className="text-[11px] font-semibold text-foreground">95% CI / STDEV RANGE</p>
            <p className="mt-2 font-num text-base font-bold text-slate-100">[{result.ciLow.toFixed(4)}, {result.ciHigh.toFixed(4)}]</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
      <div className="mb-3 flex flex-col gap-1 border-b border-white/5 pb-3">
        <h3 className="font-num text-[12px] font-bold uppercase tracking-[0.22em] text-foreground">
          [ 检验健壮性评估 / TEST ROBUSTNESS ]
        </h3>
        <p className="text-[11px] text-muted-foreground">
          聚焦两个关键防线：当前样本量能分辨多小的差异，以及置信区间与零差异线的真实偏移距离。
        </p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-3">
        <p className="text-[11px] font-semibold text-foreground">最小可辨识差异 / M.D.E.</p>
        <p className="mt-2 font-num text-2xl font-bold text-slate-100">{result.minimumDetectableEffect.toFixed(3)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">当前 N=10 极限界限</p>
      </div>
    </section>
  );
}

function EmptyChart({ variant = "grid" }: { variant?: "grid" | "flatline" }) {
  return (
    <div className="relative flex min-h-[120px] w-full items-center justify-center overflow-hidden rounded-lg">
      <svg viewBox="0 0 240 120" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
        <line x1="0" y1="60" x2="240" y2="60" stroke="oklch(0.82 0.14 200 / 0.5)" strokeWidth="1.25" className={variant === "flatline" ? "animate-flatline" : undefined} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/70" />
        <span className="font-num text-[9px] uppercase tracking-[0.25em] text-primary/60">Awaiting Telemetry</span>
      </div>
    </div>
  );
}

function DistributionCurve({
  tStat,
  df,
  critical,
  distribution = "t",
  df2,
  criticalSecondary,
  titleZh,
  titleEn,
  rejectLegendZh,
  rejectLegendEn,
  statLegendZh,
  statLegendEn,
  ariaLabel,
}: {
  tStat: number;
  df: number;
  critical: number;
  distribution?: "t" | "f" | "chi2" | "normal";
  df2?: number;
  criticalSecondary?: number | null;
  titleZh?: string;
  titleEn?: string;
  rejectLegendZh?: string;
  rejectLegendEn?: string;
  statLegendZh?: string;
  statLegendEn?: string;
  ariaLabel?: string;
}) {
  const W = 820;
  const H = 340;
  const PAD_X = 36;
  const PAD_TOP = 28;
  const PAD_BOTTOM = 40;

  const view = useMemo(() => {
    const fStartX = df <= 2 ? 0.1 : 0;
    const fEndX = Math.max(
      tStat * 1.5,
      jStat.centralF.inv(0.99, Math.max(df, 1), Math.max(df2 ?? df, 1)) * 1.2,
      critical * 1.2,
      6,
    );
    const chiEndX = Math.max(
      tStat * 1.35,
      (criticalSecondary ?? critical) * 1.2,
      jStat.chisquare.inv(0.995, Math.max(df, 1)) * 1.1,
      8,
    );
    const limit =
      distribution === "f"
        ? fEndX
        : distribution === "chi2"
          ? chiEndX
          : Math.max(4.2, Math.abs(tStat) + 1.2, critical + 1);
    const xMin = distribution === "f" ? fStartX : distribution === "chi2" ? 0 : -limit;
    const xMax = limit;
    const sampleCount = distribution === "f" || distribution === "chi2" ? 120 : 240;
    const plotWidth = W - PAD_X * 2;
    const plotHeight = H - PAD_TOP - PAD_BOTTOM;
    const xs: number[] = [];
    const ys: number[] = [];
    let peak = 0;
    for (let index = 0; index <= sampleCount; index += 1) {
      const x = xMin + ((xMax - xMin) * index) / sampleCount;
      const y =
        distribution === "f"
          ? jStat.centralF.pdf(Math.max(x, fStartX), df, df2 ?? df)
          : distribution === "chi2"
            ? jStat.chisquare.pdf(Math.max(x, 1e-6), df)
            : distribution === "normal"
              ? jStat.normal.pdf(x, 0, 1)
              : tPdf(x, df);
      xs.push(x);
      ys.push(y);
      if (y > peak) peak = y;
    }
    const xScale = (value: number) => PAD_X + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (value: number) => PAD_TOP + plotHeight - (value / peak) * plotHeight;
    const curvePath = `M ${xs.map((value, index) => `${xScale(value)},${yScale(ys[index])}`).join(" L ")}`;
    const baseY = PAD_TOP + plotHeight;
    const rightTailHeight =
      distribution === "f"
        ? jStat.centralF.pdf(Math.max(critical, fStartX), df, df2 ?? df)
        : distribution === "chi2"
          ? jStat.chisquare.pdf(Math.max(criticalSecondary ?? critical, 1e-6), df)
          : distribution === "normal"
            ? jStat.normal.pdf(critical, 0, 1)
            : tPdf(critical, df);
    const rightTailStart = distribution === "chi2" ? (criticalSecondary ?? critical) : critical;
    const rightTail = `M ${xScale(rightTailStart)},${baseY} L ${xScale(rightTailStart)},${yScale(rightTailHeight)} L ${xScale(xMax)},${baseY} Z`;
    return { curvePath, xScale, yScale, baseY, rightTail };
  }, [critical, criticalSecondary, df, df2, distribution, tStat]);

  return (
    <>
      <header className="mb-2 flex items-center justify-between">
        <StackedLabel zh={titleZh ?? (distribution === "chi2" ? "方差抽样分布" : "抽样分布")} en={titleEn ?? (distribution === "f" ? "Sampling Distribution / F(df1, df2)" : distribution === "chi2" ? "Sampling Distribution / χ²(df)" : "Sampling Distribution / t(df)")} />
        <div className="flex items-center gap-4">
          <Legend color="#FF003C" zh={rejectLegendZh ?? (distribution === "chi2" ? "卡方拒绝域" : "拒绝域")} en={rejectLegendEn ?? (distribution === "f" ? "α right tail" : distribution === "chi2" ? "χ² tail zone" : "α tails")} />
          <Legend color="var(--primary)" zh={statLegendZh ?? (distribution === "chi2" ? "卡方统计量" : "检验统计量")} en={statLegendEn ?? (distribution === "f" ? "F-Stat" : distribution === "chi2" ? "χ² Stat" : "T-Stat")} filled />
        </div>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel ?? (distribution === "f" ? "F 分布与检验统计量位置" : distribution === "chi2" ? "卡方分布与检验统计量位置" : "双侧 t 分布与检验统计量位置")}>
        <line x1={PAD_X} y1={view.baseY} x2={W - PAD_X} y2={view.baseY} stroke="oklch(0.5 0.02 240 / 0.3)" strokeWidth="1" />
        <path d={`${view.curvePath} L ${W - PAD_X},${view.baseY} L ${PAD_X},${view.baseY} Z`} fill="oklch(0.82 0.14 200 / 0.12)" />
        <path d={view.rightTail} fill="rgba(255,0,60,0.18)" />
        <path d={view.curvePath} fill="none" stroke="oklch(0.86 0.14 200)" strokeWidth="2.5" />
        <line x1={view.xScale(critical)} y1={PAD_TOP} x2={view.xScale(critical)} y2={view.baseY} stroke="#FF003C" strokeWidth="1.25" strokeDasharray="3 4" />
        {distribution === "chi2" && criticalSecondary ? (
          <line x1={view.xScale(criticalSecondary)} y1={PAD_TOP} x2={view.xScale(criticalSecondary)} y2={view.baseY} stroke="#FF003C" strokeWidth="1.25" strokeDasharray="3 4" />
        ) : null}
      </svg>
    </>
  );
}

function Legend({ color, zh, en, filled = false }: { color: string; zh: string; en: string; filled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: filled ? color : "transparent", border: `1px solid ${color}` }} />
      <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">{en}</span>
      <span className="text-[10px] text-muted-foreground">{zh}</span>
    </div>
  );
}

function DensityOverlay({ dataA, dataB }: { dataA: number[]; dataB?: number[]; targetValue?: number | null }) {
  return <AnovaDensityOverlay groups={[{ label: "A", values: dataA }, ...(dataB && dataB.length >= 2 ? [{ label: "B", values: dataB }] : [])]} />;
}

function VarianceAuditBand({
  sampleStdev,
  targetStdev,
  ciLow,
  ciHigh,
}: {
  sampleStdev: number;
  targetStdev: number;
  ciLow: number;
  ciHigh: number;
}) {
  const W = 520;
  const H = 170;
  const PAD_X = 30;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 34;
  const min = Math.min(ciLow, targetStdev, sampleStdev) * 0.85;
  const max = Math.max(ciHigh, targetStdev, sampleStdev) * 1.15;
  const xScale = (value: number) => PAD_X + ((value - min) / (max - min || 1)) * (W - PAD_X * 2);
  const centerY = 92;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="标准差置信带">
      <line x1={PAD_X} y1={centerY} x2={W - PAD_X} y2={centerY} stroke="oklch(0.4 0.02 240 / 0.28)" strokeWidth="1" />
      <rect
        x={xScale(ciLow)}
        y={centerY - 11}
        width={Math.max(6, xScale(ciHigh) - xScale(ciLow))}
        height={22}
        rx="11"
        fill="rgba(34,211,238,0.20)"
        stroke="rgba(34,211,238,0.55)"
      />
      <line x1={xScale(sampleStdev)} y1={centerY - 20} x2={xScale(sampleStdev)} y2={centerY + 20} stroke="oklch(0.88 0.14 200)" strokeWidth="2" />
      <line x1={xScale(targetStdev)} y1={centerY - 26} x2={xScale(targetStdev)} y2={centerY + 26} stroke="#FF003C" strokeWidth="1.6" strokeDasharray="4 4" />
      <text x={xScale(targetStdev)} y={centerY - 32} textAnchor="middle" className="font-num" fontSize="9" fill="#ff8ea3">
        σ₀ {targetStdev.toFixed(4)}
      </text>
      <text x={xScale(sampleStdev)} y={centerY + 34} textAnchor="middle" className="font-num" fontSize="9" fill="oklch(0.88 0.14 200)">
        S {sampleStdev.toFixed(4)}
      </text>
    </svg>
  );
}

function VarianceRatioBand({
  sampleAStdev,
  sampleBStdev,
  ciLow,
  ciHigh,
}: {
  sampleAStdev: number;
  sampleBStdev: number;
  ciLow: number;
  ciHigh: number;
}) {
  const W = 520;
  const H = 170;
  const PAD_X = 30;
  const centerY = 92;
  const ratio = sampleBStdev > 0 ? (sampleAStdev ** 2) / (sampleBStdev ** 2) : 0;
  const min = Math.min(ciLow, 1, ratio) * 0.85;
  const max = Math.max(ciHigh, 1, ratio) * 1.15;
  const xScale = (value: number) => PAD_X + ((value - min) / (max - min || 1)) * (W - PAD_X * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="方差比置信带">
      <line x1={PAD_X} y1={centerY} x2={W - PAD_X} y2={centerY} stroke="oklch(0.4 0.02 240 / 0.28)" strokeWidth="1" />
      <rect
        x={xScale(ciLow)}
        y={centerY - 11}
        width={Math.max(6, xScale(ciHigh) - xScale(ciLow))}
        height={22}
        rx="11"
        fill="rgba(34,211,238,0.20)"
        stroke="rgba(34,211,238,0.55)"
      />
      <line x1={xScale(ratio)} y1={centerY - 20} x2={xScale(ratio)} y2={centerY + 20} stroke="oklch(0.88 0.14 200)" strokeWidth="2" />
      <line x1={xScale(1)} y1={centerY - 26} x2={xScale(1)} y2={centerY + 26} stroke="#FF003C" strokeWidth="1.6" strokeDasharray="4 4" />
      <text x={xScale(1)} y={centerY - 32} textAnchor="middle" className="font-num" fontSize="9" fill="#ff8ea3">
        ratio 1.0000
      </text>
      <text x={xScale(ratio)} y={centerY + 34} textAnchor="middle" className="font-num" fontSize="9" fill="oklch(0.88 0.14 200)">
        F {ratio.toFixed(4)}
      </text>
    </svg>
  );
}

function VarianceBoxplot({ dataA, dataB }: { dataA: number[]; dataB?: number[] }) {
  return <AnovaBoxplot groups={[{ label: "A", values: dataA }, ...(dataB && dataB.length >= 2 ? [{ label: "B", values: dataB }] : [])]} />;
}

function AnovaDensityOverlay({ groups }: { groups: Array<{ label: string; values: number[] }> }) {
  const W = 520;
  const H = 300;
  const PAD_L = 18;
  const PAD_R = 18;
  const PAD_T = 22;
  const PAD_B = 34;
  const view = useMemo(() => {
    const prepared = groups.filter((group) => group.values.length >= 2).map((group, index) => ({ ...group, mean: jStat.mean(group.values), sd: Math.sqrt(jStat.variance(group.values, true)) || 1e-6, color: ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length] }));
    const low = Math.min(...prepared.map((group) => group.mean - 4 * group.sd));
    const high = Math.max(...prepared.map((group) => group.mean + 4 * group.sd));
    const plotWidth = W - PAD_L - PAD_R;
    const plotHeight = H - PAD_T - PAD_B;
    const xScale = (value: number) => PAD_L + ((value - low) / (high - low)) * plotWidth;
    const xs = Array.from({ length: 120 }, (_, index) => low + ((high - low) * index) / 119);
    const ySets = prepared.map((group) => xs.map((value) => normalPdf(value, group.mean, group.sd)));
    const peak = Math.max(...ySets.flat()) || 1;
    const yScale = (value: number) => PAD_T + plotHeight - (value / peak) * plotHeight;
    return { summaries: prepared.map((group, index) => ({ ...group, line: xs.map((value, pointIndex) => `${xScale(value).toFixed(2)},${yScale(ySets[index][pointIndex]).toFixed(2)}`).join(" ") })), xScale, baseY: H - PAD_B };
  }, [groups]);
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="ANOVA 多组密度叠加图"><line x1={PAD_L} y1={view.baseY} x2={W - PAD_R} y2={view.baseY} stroke="oklch(0.4 0.02 240 / 0.3)" strokeWidth="1" />{view.summaries.map((group) => <g key={group.label}><polyline points={group.line} fill="none" stroke={group.color} strokeWidth="2" /><text x={view.xScale(group.mean)} y={PAD_T - 8} textAnchor="middle" className="font-num" fontSize="10" fill={group.color}>{group.label}</text></g>)}</svg>;
}

function AnovaBoxplot({ groups }: { groups: Array<{ label: string; values: number[] }> }) {
  const W = 320;
  const H = 190;
  const PAD_L = 52;
  const PAD_R = 18;
  const PAD_T = 18;
  const PAD_B = 24;
  const view = useMemo(() => {
    const prepared = groups.filter((group) => group.values.length > 0).map((group, index) => ({ ...group, stats: boxStats(group.values), stroke: ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length], fill: `${ANOVA_SERIES_COLORS[index % ANOVA_SERIES_COLORS.length]}33` }));
    const low = Math.min(...prepared.map((group) => group.stats.min));
    const high = Math.max(...prepared.map((group) => group.stats.max));
    const padding = (high - low) * 0.12 || 0.1;
    const xMin = low - padding;
    const xMax = high + padding;
    const plotWidth = W - PAD_L - PAD_R;
    const xScale = (value: number) => PAD_L + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const rowGap = prepared.length > 1 ? (H - PAD_T - PAD_B) / (prepared.length - 1) : 0;
    return { rows: prepared.map((group, index) => ({ ...group, centerY: PAD_T + rowGap * index })), xScale };
  }, [groups]);
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="多组样本箱线图">{view.rows.map((row)=>{const top=row.centerY-10; return <g key={row.label}><line x1={view.xScale(row.stats.min)} y1={row.centerY} x2={view.xScale(row.stats.max)} y2={row.centerY} stroke={row.stroke} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" /><rect x={view.xScale(row.stats.q1)} y={top} width={Math.max(1, view.xScale(row.stats.q3)-view.xScale(row.stats.q1))} height={20} fill={row.fill} stroke={row.stroke} strokeWidth="1.4" rx="2" /><line x1={view.xScale(row.stats.median)} y1={top-2} x2={view.xScale(row.stats.median)} y2={top+22} stroke={row.stroke} strokeWidth="1.3" /><text x={PAD_L-8} y={row.centerY+3} textAnchor="end" className="font-num" fontSize="8.5" fill={row.stroke} fontWeight="700">{row.label}</text></g>})}</svg>;
}

function QQPlot({ dataA, dataB }: { dataA: number[]; dataB?: number[] }) {
  const W = 300;
  const H = 150;
  const PAD = 22;
  const view = useMemo(() => {
    const combined = [...qqPoints(dataA), ...(dataB && dataB.length >= 2 ? qqPoints(dataB) : [])];
    const allValues = combined.flatMap((point) => [point.theoretical, point.sample]);
    const finite = allValues.filter((value) => Number.isFinite(value));
    const limit = Math.max(2.2, ...finite.map((value) => Math.abs(value))) || 2.2;
    const plotWidth = W - PAD * 2;
    const plotHeight = H - PAD * 2;
    const scaleX = (value: number) => PAD + ((value + limit) / (2 * limit)) * plotWidth;
    const scaleY = (value: number) => PAD + plotHeight - ((value + limit) / (2 * limit)) * plotHeight;
    return { points: combined.filter((point) => Number.isFinite(point.theoretical) && Number.isFinite(point.sample)).map((point) => ({ x: scaleX(point.theoretical), y: scaleY(point.sample), outlier: point.outlier })), scaleX, scaleY, limit };
  }, [dataA, dataB]);
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Q-Q 图"><rect x={PAD} y={PAD} width={W-PAD*2} height={H-PAD*2} fill="none" stroke="oklch(0.4 0.02 240 / 0.2)" strokeWidth="1" /><line x1={view.scaleX(-view.limit)} y1={view.scaleY(-view.limit)} x2={view.scaleX(view.limit)} y2={view.scaleY(view.limit)} stroke="oklch(0.86 0.14 200)" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />{view.points.map((point,index)=><circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={point.outlier ? 2.2 : 1.7} fill={point.outlier ? 'var(--warning)' : 'oklch(0.88 0.14 200)'} />)}</svg>;
}

function AnovaResidualQQPlot({ groups }: { groups: Array<{ label: string; values: number[] }> }) {
  const residuals = groups.filter((group) => group.values.length >= 2).flatMap((group) => {
    const groupMean = jStat.mean(group.values);
    return group.values.map((value) => value - groupMean);
  });
  return <QQPlot dataA={residuals} />;
}

function RunChart({ dataA, dataB }: { dataA: number[]; dataB?: number[] }) {
  const W = 300;
  const H = 150;
  const PAD_L = 34;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 22;
  const view = useMemo(() => {
    const hasB = Boolean(dataB && dataB.length >= 2);
    const count = Math.max(dataA.length, hasB ? (dataB as number[]).length : 0, 2);
    const allValues = [...dataA, ...(hasB ? (dataB as number[]) : [])];
    const low = Math.min(...allValues);
    const high = Math.max(...allValues);
    const padding = (high - low) * 0.18 || 0.05;
    const yMin = low - padding;
    const yMax = high + padding;
    const plotWidth = W - PAD_L - PAD_R;
    const plotHeight = H - PAD_T - PAD_B;
    const xScale = (index: number) => PAD_L + (count <= 1 ? 0 : (index / (count - 1)) * plotWidth);
    const yScale = (value: number) => PAD_T + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
    const pointsA = dataA.map((value, index) => ({ x: xScale(index), y: yScale(value) }));
    const pointsB = hasB ? (dataB as number[]).map((value, index) => ({ x: xScale(index), y: yScale(value) })) : [];
    return { hasB, yScale, pointsA, pointsB, lineA: buildPolyline(pointsA), lineB: buildPolyline(pointsB), ticks: [yMax, (yMin + yMax) / 2, yMin] };
  }, [dataA, dataB]);
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="样本时序运行图">{view.ticks.map((tick)=><line key={tick} x1={PAD_L} y1={view.yScale(tick)} x2={W-PAD_R} y2={view.yScale(tick)} stroke="oklch(0.4 0.02 240 / 0.14)" strokeWidth="1" strokeDasharray="2 4" />)}{view.hasB ? <polyline points={view.lineB} fill="none" stroke="#FF6B81" strokeWidth="1.5" opacity="0.9" /> : null}<polyline points={view.lineA} fill="none" stroke="oklch(0.88 0.14 200)" strokeWidth="1.5" />{view.pointsB.map((point,index)=><circle key={`point-b-${index}`} cx={point.x} cy={point.y} r="2" fill="#FF6B81" />)}{view.pointsA.map((point,index)=><circle key={`point-a-${index}`} cx={point.x} cy={point.y} r="2" fill="oklch(0.9 0.14 200)" />)}</svg>;
}

function AnovaRunChart({ groups }: { groups: Array<{ label: string; values: number[] }> }) {
  const W = 300;
  const H = 150;
  const PAD_L = 34;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 22;
  const view = useMemo(() => {
    const prepared = groups.filter((group) => group.values.length >= 2);
    const count = Math.max(...prepared.map((group) => group.values.length), 2);
    const allValues = prepared.flatMap((group) => group.values);
    const low = Math.min(...allValues);
    const high = Math.max(...allValues);
    const padding = (high - low) * 0.18 || 0.05;
    const yMin = low - padding;
    const yMax = high + padding;
    const plotWidth = W - PAD_L - PAD_R;
    const plotHeight = H - PAD_T - PAD_B;
    const xScale = (index: number) => PAD_L + (count <= 1 ? 0 : (index / (count - 1)) * plotWidth);
    const yScale = (value: number) => PAD_T + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
    return { ticks: [yMax, (yMin + yMax) / 2, yMin], yScale, series: prepared.map((group,index)=>({label:group.label,color:ANOVA_SERIES_COLORS[index%ANOVA_SERIES_COLORS.length],points:group.values.map((value,pointIndex)=>({x:xScale(pointIndex),y:yScale(value)}))})) };
  }, [groups]);
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="ANOVA 多组运行图">{view.ticks.map((tick)=><line key={tick} x1={PAD_L} y1={view.yScale(tick)} x2={W-PAD_R} y2={view.yScale(tick)} stroke="oklch(0.4 0.02 240 / 0.14)" strokeWidth="1" strokeDasharray="2 4" />)}{view.series.map((series)=><g key={series.label}><polyline points={buildPolyline(series.points)} fill="none" stroke={series.color} strokeWidth="1.4" />{series.points.map((point,index)=><circle key={`${series.label}-${index}`} cx={point.x} cy={point.y} r="2" fill={series.color} />)}</g>)}</svg>;
}

function RackUnit({ zh, en, children }: { zh: string; en: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 py-2.5 first:pt-1 last:pb-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-foreground">{zh}</span>
          <span className="font-num text-[8px] uppercase tracking-tighter text-muted-foreground">{en}</span>
        </div>
        <span className="font-num text-[8px] text-primary/70">ON</span>
      </div>
      <div className="recessed flex flex-1 items-stretch rounded-lg p-2 [&>*]:w-full">{children}</div>
    </div>
  );
}

function DescriptiveRow({ tone, tag, meanValue, sdValue }: { tone: "cyan" | "rose"; tag: string; meanValue: number; sdValue: number }) {
  const accent = tone === "cyan" ? "text-primary" : "text-[var(--rose-gold)]";
  const tagStyles = tone === "cyan" ? "bg-primary/15 text-primary" : "bg-[var(--rose-gold)]/15 text-[var(--rose-gold)]";
  const varianceValue = sdValue * sdValue;
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5">
      <span className={cn("font-num grid h-6 min-w-9 place-items-center rounded px-1 text-[11px] font-bold", tagStyles)}>{tag}</span>
      <span className={cn("font-num text-right text-sm font-bold tabular-nums", accent)}>{meanValue.toFixed(3)}</span>
      <span className="font-num text-right text-sm font-bold tabular-nums text-foreground/85">{sdValue.toFixed(3)}</span>
      <span className="font-num text-right text-sm font-bold tabular-nums text-foreground/70">{varianceValue.toFixed(4)}</span>
    </div>
  );
}

function ExecutiveSummary({
  result,
  critical,
  alpha,
  onGenerate,
}: {
  result: StatisticalResult;
  critical: number;
  alpha: number;
  onGenerate: () => void;
}) {
  if (result.testType === "1_VAR_CHI_SQ") {
    const metrics = [
      { zh: "卡方统计量", en: "Chi-Square", value: result.tStat.toFixed(4) },
      { zh: "自由度", en: "Degrees of Freedom", value: result.df.toFixed(0) },
      { zh: "目标标准差", en: "Target StDev", value: (result.targetStdev ?? 0).toFixed(4) },
      { zh: "样本标准差", en: "Sample StDev", value: result.sdA.toFixed(4) },
      { zh: "95% 标准差区间", en: "StDev Confidence Interval", value: `[${result.ciLow.toFixed(4)}, ${result.ciHigh.toFixed(4)}]` },
    ];

    return (
      <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
        <span className="mech-corners pointer-events-none absolute inset-0" />
        <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="管理层结论" en="Executive Summary" size="lg" /></header>
        <div className="recessed flex flex-col gap-3 rounded-lg p-4">
          <div className="flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="波动描述统计" en="Dispersion Statistics" size="sm" /></div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5"><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">Src</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Mean</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">StDev</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Var</span></div>
          <DescriptiveRow tone="cyan" tag="A" meanValue={result.meanA} sdValue={result.sdA} />
        </div>
        <dl className="flex flex-col">{metrics.map((metric,index)=><div key={metric.en} className={cn("flex items-center justify-between gap-3 py-3", index !== metrics.length - 1 && "border-b border-border/40")}><dt className="flex flex-col leading-tight"><span className="text-xs font-semibold text-foreground">{metric.zh}</span><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">{metric.en}</span></dt><dd className="font-num text-sm font-bold tabular-nums text-foreground">{metric.value}</dd></div>)}</dl>
        <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，当前批次波动与目标标准差存在显著偏差，建议立即复核过程稳定性与量测系统。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明批次波动偏离目标标准差，可视为离散度暂时受控。`}</p></div>
        <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
      </section>
    );
  }

  if (result.testType === "2_VAR_F") {
    const metrics = [
      { zh: "F 统计量", en: "F Ratio", value: result.tStat.toFixed(4) },
      { zh: "自由度 (A)", en: "DF1", value: result.df.toFixed(0) },
      { zh: "样本 A 标准差", en: "Sample A StDev", value: result.sdA.toFixed(4) },
      { zh: "样本 B 标准差", en: "Sample B StDev", value: (result.sdB ?? 0).toFixed(4) },
      { zh: "方差比区间", en: "Variance Ratio Confidence Interval", value: `[${result.ciLow.toFixed(4)}, ${result.ciHigh.toFixed(4)}]` },
    ];

    return (
      <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
        <span className="mech-corners pointer-events-none absolute inset-0" />
        <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="管理层结论" en="Executive Summary" size="lg" /></header>
        <div className="recessed flex flex-col gap-3 rounded-lg p-4">
          <div className="flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="方差比描述统计" en="Variance Ratio Statistics" size="sm" /></div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5"><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">Src</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Mean</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">StDev</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Var</span></div><DescriptiveRow tone="cyan" tag="A" meanValue={result.meanA} sdValue={result.sdA} />{result.meanB !== null && result.sdB !== null ? <DescriptiveRow tone="rose" tag="B" meanValue={result.meanB} sdValue={result.sdB} /> : null}</div>
        <dl className="flex flex-col">{metrics.map((metric,index)=><div key={metric.en} className={cn("flex items-center justify-between gap-3 py-3", index !== metrics.length - 1 && "border-b border-border/40")}><dt className="flex flex-col leading-tight"><span className="text-xs font-semibold text-foreground">{metric.zh}</span><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">{metric.en}</span></dt><dd className="font-num text-sm font-bold tabular-nums text-foreground">{metric.value}</dd></div>)}</dl>
        <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，两组样本波动存在显著差异，建议立即核查工艺稳定性或量测系统一致性。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明两组波动存在显著差异，可视为离散度水平一致。`}</p></div>
        <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
      </section>
    );
  }

  if (result.testType === "MULTI_VAR_LEVENE") {
    const metrics = [
      { zh: "Levene F 统计量", en: "Levene F", value: result.tStat.toFixed(4) },
      { zh: "组间自由度", en: "DF Between", value: (result.dfBetween ?? 0).toFixed(0) },
      { zh: "组内自由度", en: "DF Within", value: (result.dfWithin ?? result.df).toFixed(0) },
      { zh: "最大标准差", en: "Max StDev", value: Math.max(...(result.varianceGroupStdevs ?? [0])).toFixed(4) },
      { zh: "最小标准差", en: "Min StDev", value: Math.min(...(result.varianceGroupStdevs ?? [0])).toFixed(4) },
    ];

    return (
      <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
        <span className="mech-corners pointer-events-none absolute inset-0" />
        <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="方差审计结论" en="Variance Audit Summary" size="lg" /></header>
        <div className="recessed flex flex-col gap-3 rounded-lg p-4">
          <div className="flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="齐性描述统计" en="Homogeneity Statistics" size="sm" /></div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5"><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">Src</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Mean</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">StDev</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Var</span></div>
          {(result.varianceGroupLabels ?? []).map((label, index) => (
            <DescriptiveRow
              key={label}
              tone={index % 2 === 0 ? "cyan" : "rose"}
              tag={label}
              meanValue={result.varianceGroupMeans?.[index] ?? 0}
              sdValue={result.varianceGroupStdevs?.[index] ?? 0}
            />
          ))}
        </div>
        <dl className="flex flex-col">{metrics.map((metric,index)=><div key={metric.en} className={cn("flex items-center justify-between gap-3 py-3", index !== metrics.length - 1 && "border-b border-border/40")}><dt className="flex flex-col leading-tight"><span className="text-xs font-semibold text-foreground">{metric.zh}</span><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">{metric.en}</span></dt><dd className="font-num text-sm font-bold tabular-nums text-foreground">{metric.value}</dd></div>)}</dl>
        <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，样本组波动不一致，方差齐性不成立，建议优先排查异常波动源。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明各样本组波动不同，可视为方差齐性成立。`}</p></div>
        <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
      </section>
    );
  }

  if (
    result.testType === "1_WAY_ANOVA" &&
    result.dfBetween !== undefined &&
    result.dfWithin !== undefined &&
    result.ssBetween !== undefined &&
    result.ssWithin !== undefined &&
    result.msBetween !== undefined &&
    result.msWithin !== undefined &&
    result.totalN !== undefined
  ) {
    const significantComparisons = result.anovaComparisons?.filter((comparison) => comparison.significant) ?? [];
    const rows = [
      { source: result.factorName || "Factor (组间)", df: result.dfBetween.toFixed(0), ss: result.ssBetween.toFixed(4), ms: result.msBetween.toFixed(4), f: result.tStat.toFixed(4), p: formatPValue(result.pValue) },
      { source: "Error (组内)", df: result.dfWithin.toFixed(0), ss: result.ssWithin.toFixed(4), ms: result.msWithin.toFixed(4), f: "-", p: "-" },
      { source: "Total (总计)", df: (result.totalN - 1).toFixed(0), ss: (result.ssBetween + result.ssWithin).toFixed(4), ms: "-", f: "-", p: "-" },
    ];
    return (
      <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
        <span className="mech-corners pointer-events-none absolute inset-0" />
        <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="管理层结论" en="Executive Summary" size="lg" /></header>
        <div className="recessed rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="方差分析表" en="ANOVA Table" size="sm" /></div>
          <div className="overflow-x-auto overflow-y-hidden no-scrollbar"><div className="min-w-[420px]"><div className="grid grid-cols-[1.8fr_.55fr_.95fr_.95fr_.7fr_.7fr] gap-x-2 border-b border-border/40 pb-2 text-[10px] leading-tight uppercase tracking-widest text-muted-foreground"><span>SOURCE</span><span className="text-right">DF</span><span className="text-right">SS</span><span className="text-right">MS</span><span className="text-right">F</span><span className="text-right">P</span></div><div className="mt-3 space-y-3">{rows.map((row) => <div key={row.source} className="grid grid-cols-[1.8fr_.55fr_.95fr_.95fr_.7fr_.7fr] gap-x-2 text-[10px] leading-tight"><span className="truncate font-semibold text-foreground">{row.source}</span><span className="font-num truncate text-right text-foreground">{row.df}</span><span className="font-num truncate text-right text-foreground">{row.ss}</span><span className="font-num truncate text-right text-foreground">{row.ms}</span><span className="font-num truncate text-right text-foreground">{row.f}</span><span className="font-num truncate text-right text-foreground">{row.p}</span></div>)}</div></div></div>
        </div>
        {significantComparisons.length > 0 ? <div className="recessed rounded-lg p-4"><div className="mb-3 flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="事后多重比较" en="Post-hoc Bonferroni" size="sm" /></div><div className="max-h-32 overflow-y-auto overflow-x-hidden no-scrollbar"><div className="grid grid-cols-[1.45fr_.9fr_.8fr_.9fr_.6fr] gap-x-2 border-b border-border/40 pb-2 text-[10px] leading-tight uppercase tracking-widest text-muted-foreground"><span>PAIR</span><span className="text-right">ΔMEAN</span><span className="text-right">T</span><span className="text-right">P-ADJ</span><span className="text-right">FLAG</span></div><div className="mt-2 space-y-2">{significantComparisons.map((row) => <div key={`${row.leftLabel}-${row.rightLabel}`} className="grid grid-cols-[1.45fr_.9fr_.8fr_.9fr_.6fr] gap-x-2 text-[10px] leading-tight"><span className="truncate font-semibold text-foreground">{row.leftLabel} vs {row.rightLabel}</span><span className="font-num truncate text-right text-foreground">{row.meanDiff.toFixed(4)}</span><span className="font-num truncate text-right text-foreground">{row.tStat.toFixed(3)}</span><span className="font-num truncate text-right text-foreground">{row.adjustedP.toFixed(4)}</span><span className="font-num text-right text-[var(--warning)]">DIFF</span></div>)}</div></div></div> : null}
        <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，至少存在一个样本组均值与其他组不同，建议立即定位异常组并展开复盘。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明各样本组均值存在显著差异。`}</p></div>
        <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
      </section>
    );
  }

  if (result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z") {
    const metrics = [
      { zh: "Z 统计量", en: "Z Value", value: result.tStat.toFixed(4) },
      { zh: result.testType === "1_PROP_Z" ? "样本量" : "样本组 A / B", en: result.testType === "1_PROP_Z" ? "Sample Size" : "Sample A / B", value: result.testType === "1_PROP_Z" ? result.nA.toFixed(0) : `${result.nA.toFixed(0)} / ${(result.nB ?? 0).toFixed(0)}` },
      { zh: result.testType === "1_PROP_Z" ? "目标比例" : "样本组 B 比例", en: result.testType === "1_PROP_Z" ? "Target Proportion" : "Sample B Proportion", value: (result.testType === "1_PROP_Z" ? result.targetMean ?? 0 : result.meanB ?? 0).toFixed(4) },
      { zh: result.testType === "1_PROP_Z" ? "比例偏移" : "比率差值", en: result.testType === "1_PROP_Z" ? "Delta from Target" : "Proportion Difference", value: result.diff.toFixed(4) },
      { zh: `${((1 - alpha) * 100).toFixed(0)}% ${result.testType === "1_PROP_Z" ? "比率区间" : "差值区间"}`, en: result.testType === "1_PROP_Z" ? "Proportion Interval" : "Delta Interval", value: `[${result.ciLow.toFixed(4)}, ${result.ciHigh.toFixed(4)}]` },
    ];

    return (
      <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
        <span className="mech-corners pointer-events-none absolute inset-0" />
        <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="管理层结论" en="Executive Summary" size="lg" /></header>
        <div className="recessed flex flex-col gap-3 rounded-lg p-4">
          <div className="flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="比率描述统计" en="Proportion Statistics" size="sm" /></div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5"><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">Src</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Rate</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">SE</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Var</span></div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 py-2.5">
            <span className="recessed font-num rounded-md px-2 py-1 text-center text-[11px] font-bold text-primary">A</span>
            <span className="font-num text-right text-sm font-semibold text-foreground">{result.meanA.toFixed(4)}</span>
            <span className="font-num text-right text-sm font-semibold text-foreground">{result.standardError.toFixed(4)}</span>
            <span className="font-num text-right text-sm font-semibold text-foreground">{result.varA.toFixed(4)}</span>
          </div>
          {result.testType === "2_PROP_Z" && result.meanB !== null && result.varB !== null ? (
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 py-2.5">
              <span className="recessed font-num rounded-md px-2 py-1 text-center text-[11px] font-bold text-[var(--rose-gold)]">B</span>
              <span className="font-num text-right text-sm font-semibold text-foreground">{result.meanB.toFixed(4)}</span>
              <span className="font-num text-right text-sm font-semibold text-foreground">-</span>
              <span className="font-num text-right text-sm font-semibold text-foreground">{result.varB.toFixed(4)}</span>
            </div>
          ) : null}
        </div>
        <dl className="flex flex-col">{metrics.map((metric,index)=><div key={metric.en} className={cn("flex items-center justify-between gap-3 py-3", index !== metrics.length - 1 && "border-b border-border/40")}><dt className="flex flex-col leading-tight"><span className="text-xs font-semibold text-foreground">{metric.zh}</span><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">{metric.en}</span></dt><dd className="font-num text-sm font-bold tabular-nums text-foreground">{metric.value}</dd></div>)}</dl>
        <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{result.testType === "1_PROP_Z" ? (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，当前事件占比与目标比例存在显著偏移，建议立即核查良率、漏判率或不良率控制条件。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明事件占比偏离目标比例，可视为比率水平暂时受控。`) : (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，两组事件占比存在显著差异，建议立即核查批次良率、漏判率或工艺切换影响。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明两组事件占比存在显著差异，可视为比率水平一致。`)}</p></div>
        <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
      </section>
    );
  }

  const metrics = [
    { zh: "T 检验统计量", en: "T-Value", value: result.tStat.toFixed(4) },
    { zh: "自由度", en: "Degrees of Freedom", value: result.df.toFixed(2) },
    { zh: "临界值", en: "Critical Value ±", value: `±${critical.toFixed(3)}` },
    { zh: result.testType === "1_SAMPLE_T" ? "目标偏移" : result.testType === "PAIRED_T" ? "配对差值均值" : "均值差", en: result.testType === "1_SAMPLE_T" ? "Delta from Target" : result.testType === "PAIRED_T" ? "Mean Paired Delta" : "Mean Difference", value: result.diff.toFixed(4) },
    { zh: `${((1 - alpha) * 100).toFixed(0)}% 置信区间`, en: "Confidence Interval", value: `[${result.ciLow.toFixed(3)}, ${result.ciHigh.toFixed(3)}]` },
  ];

  return (
    <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="管理层结论" en="Executive Summary" size="lg" /></header>
      <div className="recessed flex flex-col gap-3 rounded-lg p-4"><div className="flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh="描述性统计" en="Descriptive Statistics" size="sm" /></div><div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5"><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">Src</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Mean</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">StDev</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Var</span></div><DescriptiveRow tone="cyan" tag="A" meanValue={result.meanA} sdValue={result.sdA} />{result.meanB !== null && result.sdB !== null ? <DescriptiveRow tone="rose" tag="B" meanValue={result.meanB} sdValue={result.sdB} /> : null}{result.testType === "PAIRED_T" ? <DescriptiveRow tone="cyan" tag="D" meanValue={result.deltaMean} sdValue={result.deltaSd} /> : null}</div>
      <dl className="flex flex-col">{metrics.map((metric,index)=><div key={metric.en} className={cn("flex items-center justify-between gap-3 py-3", index !== metrics.length - 1 && "border-b border-border/40")}><dt className="flex flex-col leading-tight"><span className="text-xs font-semibold text-foreground">{metric.zh}</span><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">{metric.en}</span></dt><dd className="font-num text-sm font-bold tabular-nums text-foreground">{metric.value}</dd></div>)}</dl>
      <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{result.testType === "1_SAMPLE_T" ? (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，当前批次均值与目标基准存在显著偏移，建议立即复核工艺、设备或量测条件。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明批次均值偏离目标基准，可视为暂时受控。`) : result.testType === "PAIRED_T" ? (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，前后配对差值存在统计学显著变化，说明处理过程带来了可识别影响。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明前后配对差值存在显著变化，处理影响暂不显著。`) : (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，两组样本存在统计学显著差异，建议立即复核工艺、设备或量测条件。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明两组均值存在显著差异，可视为过程暂时受控。`)}</p></div>
      <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
    </section>
  );
}

function VarianceExecutivePanel({
  result,
  alpha,
  onGenerate,
}: {
  result: StatisticalResult;
  alpha: number;
  onGenerate: () => void;
}) {
  const isSingleVariance = result.testType === "1_VAR_CHI_SQ";
  const isLeveneAudit = result.testType === "MULTI_VAR_LEVENE";
  const metrics = isSingleVariance
    ? [
        { zh: "卡方统计量", en: "Chi-Square", value: result.tStat.toFixed(4) },
        { zh: "自由度", en: "Degrees of Freedom", value: result.df.toFixed(0) },
        { zh: "目标标准差", en: "Target StDev", value: (result.targetStdev ?? 0).toFixed(4) },
        { zh: "样本标准差", en: "Sample StDev", value: result.sdA.toFixed(4) },
        { zh: "95% 标准差区间", en: "StDev Confidence Interval", value: `[${result.ciLow.toFixed(4)}, ${result.ciHigh.toFixed(4)}]` },
      ]
    : isLeveneAudit
      ? [
          { zh: "Levene F 统计量", en: "Levene F", value: result.tStat.toFixed(4) },
          { zh: "组间自由度", en: "DF Between", value: (result.dfBetween ?? 0).toFixed(0) },
          { zh: "组内自由度", en: "DF Within", value: (result.dfWithin ?? result.df).toFixed(0) },
          { zh: "最大标准差", en: "Max StDev", value: Math.max(...(result.varianceGroupStdevs ?? [0])).toFixed(4) },
          { zh: "最小标准差", en: "Min StDev", value: Math.min(...(result.varianceGroupStdevs ?? [0])).toFixed(4) },
        ]
    : [
        { zh: "F 统计量", en: "F Ratio", value: result.tStat.toFixed(4) },
        { zh: "自由度 (A)", en: "DF1", value: result.df.toFixed(0) },
        { zh: "自由度 (B)", en: "DF2", value: (result.dfSecondary ?? 0).toFixed(0) },
        { zh: "样本 A 标准差", en: "Sample A StDev", value: result.sdA.toFixed(4) },
        { zh: "样本 B 标准差", en: "Sample B StDev", value: (result.sdB ?? 0).toFixed(4) },
        { zh: "方差比区间", en: "Variance Ratio Confidence Interval", value: `[${result.ciLow.toFixed(4)}, ${result.ciHigh.toFixed(4)}]` },
      ];

  return (
      <section className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5" style={{ "--bracket": "oklch(0.78 0.08 45 / 0.7)", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)" } as React.CSSProperties}>
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <header className="flex items-center gap-3 border-b border-border/60 pb-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]"><Gavel className="h-4 w-4" /></span><StackedLabel zh="方差审计结论" en="Variance Audit Summary" size="lg" /></header>
      <div className="recessed flex flex-col gap-3 rounded-lg p-4">
        <div className="flex items-center gap-2"><Sigma className="h-3.5 w-3.5 text-muted-foreground" /><StackedLabel zh={isSingleVariance ? "波动描述统计" : isLeveneAudit ? "齐性描述统计" : "方差比描述统计"} en={isSingleVariance ? "Dispersion Statistics" : isLeveneAudit ? "Homogeneity Statistics" : "Variance Ratio Statistics"} size="sm" /></div>
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5"><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">Src</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Mean</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">StDev</span><span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">Var</span></div>
        {isLeveneAudit
          ? (result.varianceGroupLabels ?? []).map((label, index) => (
              <DescriptiveRow
                key={label}
                tone={index % 2 === 0 ? "cyan" : "rose"}
                tag={label}
                meanValue={result.varianceGroupMeans?.[index] ?? 0}
                sdValue={result.varianceGroupStdevs?.[index] ?? 0}
              />
            ))
          : (
            <>
              <DescriptiveRow tone="cyan" tag="A" meanValue={result.meanA} sdValue={result.sdA} />
              {!isSingleVariance && result.meanB !== null && result.sdB !== null ? <DescriptiveRow tone="rose" tag="B" meanValue={result.meanB} sdValue={result.sdB} /> : null}
            </>
          )}
      </div>
      <dl className="flex flex-col">{metrics.map((metric,index)=><div key={metric.en} className={cn("flex items-center justify-between gap-3 py-3", index !== metrics.length - 1 && "border-b border-border/40")}><dt className="flex flex-col leading-tight"><span className="text-xs font-semibold text-foreground">{metric.zh}</span><span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">{metric.en}</span></dt><dd className="font-num text-sm font-bold tabular-nums text-foreground">{metric.value}</dd></div>)}</dl>
      <div className="rounded-xl p-4" style={{ background: result.reject ? "oklch(0.7 0.24 25 / 0.1)" : "oklch(0.82 0.14 200 / 0.08)", boxShadow: result.reject ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)" : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)" }}><div className="mb-2 flex items-center gap-2"><FileCheck2 className={cn("h-4 w-4", result.reject ? "text-[var(--warning)]" : "text-primary")} /><StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" /></div><p className={cn("font-num text-sm font-medium leading-relaxed", result.reject ? "text-[var(--warning)]" : "text-primary")}>{isSingleVariance ? (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，当前批次波动与目标标准差存在显著偏差，建议立即复核过程稳定性与量测系统。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明批次波动偏离目标标准差，可视为离散度暂时受控。`) : isLeveneAudit ? (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，各样本组波动不一致，方差齐性不成立，建议优先定位异常波动组。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明各样本组波动不同，可视为方差齐性成立。`) : (result.reject ? `P = ${formatPValue(result.pValue)} < ${alpha.toFixed(2)}，两组样本波动存在显著差异，建议立即核查工艺稳定性或量测系统一致性。` : `P = ${formatPValue(result.pValue)} ≥ ${alpha.toFixed(2)}，当前没有足够证据证明两组波动存在显著差异，可视为离散度水平一致。`)}</p></div>
      <button type="button" onClick={onGenerate} className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px" style={{ background: "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))", boxShadow: "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)" }}><FileCheck2 className="h-5 w-5 text-primary" /><span className="flex flex-col items-start leading-tight"><span className="text-sm font-bold tracking-wide text-foreground">生成结论快照</span><span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">Generate Audit Snapshot</span></span></button>
    </section>
  );
}

function ForensicBadge({ seed }: { seed: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hash = useMemo(() => hashSeed(seed), [seed]);
  const timestamp = now
    ? `${now.toISOString().slice(0, 10)} // ${now.toISOString().slice(11, 19)} UTC`
    : "---- -- -- // --:--:-- UTC";

  return (
    <div className="recessed flex items-center gap-3 rounded-md px-3 py-1.5" title="Forensic audit trail">
      <div className="flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-primary" />
        <span className="font-num text-[10px] tracking-wider text-primary">
          0x{hash.slice(0, 4)}…{hash.slice(-2)}
        </span>
      </div>
      <span className="h-3 w-px bg-border/60" />
      <span className="font-num text-[10px] tabular-nums tracking-wider text-muted-foreground">{timestamp}</span>
    </div>
  );
}

export default function HypothesisTestingDashboard({
  projectName = "",
}: HypothesisTestingDashboardProps) {
  const [adjudication, setAdjudication] = useState<AdjudicationState>({
    activeDomain: "MEANS",
    activeTest: "2_SAMPLE_T",
    tailDirection: "TWO_TAILED",
    payloadMode: "2_VECTORS",
  });
  const [alpha, setAlpha] = useState(0.05);
  const [factorName, setFactorName] = useState("Factor (组间)");
  const [factorAName, setFactorAName] = useState("Supplier");
  const [factorBName, setFactorBName] = useState("Temperature");
  const [responseName, setResponseName] = useState("Response Value");
  const [sampleA, setSampleA] = useState(DEFAULT_SAMPLE_A);
  const [sampleB, setSampleB] = useState(DEFAULT_SAMPLE_B);
  const [targetMean, setTargetMean] = useState("0");
  const [targetStdev, setTargetStdev] = useState("1.0");
  const [targetProportion, setTargetProportion] = useState("0.50");
  const [twoWayMatrixInput, setTwoWayMatrixInput] = useState(DEFAULT_TWO_WAY_MATRIX);
  const [multiVectorInputs, setMultiVectorInputs] = useState([
    { id: "group-1", label: "样本组 A", value: DEFAULT_SAMPLE_A },
    { id: "group-2", label: "样本组 B", value: DEFAULT_SAMPLE_B },
    { id: "group-3", label: "样本组 C", value: "" },
  ]);
  const [summaryRows, setSummaryRows] = useState([
    { id: "summary-a", label: "Group A", events: "", trials: "" },
    { id: "summary-b", label: "Group B", events: "", trials: "" },
  ]);
  const [previewSafe, setPreviewSafe] = useState(false);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<StatisticalResult | null>(null);

  const implementedTest = IMPLEMENTED_TESTS.has(adjudication.activeTest);
  const moduleLocked = !implementedTest;
  const effectiveSampleA = implementedTest && previewSafe ? SAFE_SAMPLE_A : sampleA;
  const effectiveSampleB = implementedTest && previewSafe ? SAFE_SAMPLE_B : sampleB;
  const dataA = useMemo(() => parseSamples(effectiveSampleA), [effectiveSampleA]);
  const dataB = useMemo(() => parseSamples(effectiveSampleB), [effectiveSampleB]);
  const parsedTargetMean = Number.parseFloat(targetMean);
  const parsedTargetStdev = Number.parseFloat(targetStdev);
  const parsedTargetProportion = Number.parseFloat(targetProportion);
  const summaryEventsA = Number.parseFloat(summaryRows[0]?.events ?? "");
  const summaryTrialsA = Number.parseFloat(summaryRows[0]?.trials ?? "");
  const summaryEventsB = Number.parseFloat(summaryRows[1]?.events ?? "");
  const summaryTrialsB = Number.parseFloat(summaryRows[1]?.trials ?? "");
  const isOneSampleMode = adjudication.activeTest === "1_SAMPLE_T";
  const isOnePropZMode = adjudication.activeTest === "1_PROP_Z";
  const isTwoPropZMode = adjudication.activeTest === "2_PROP_Z";
  const isVarianceChiSqMode = adjudication.activeTest === "1_VAR_CHI_SQ";
  const isTwoVarianceFMode = adjudication.activeTest === "2_VAR_F";
  const isLeveneMode = adjudication.activeTest === "MULTI_VAR_LEVENE";
  const isPairedMode = adjudication.activeTest === "PAIRED_T";
  const isAnovaMode = adjudication.activeTest === "1_WAY_ANOVA";
  const isTwoWayAnovaMode = adjudication.activeTest === "2_WAY_ANOVA";
  const proportionSeriesA = useMemo(() => {
    if (
      !Number.isFinite(summaryEventsA) ||
      !Number.isFinite(summaryTrialsA) ||
      summaryTrialsA <= 0 ||
      summaryEventsA < 0 ||
      summaryEventsA > summaryTrialsA
    ) {
      return [];
    }

    const events = Math.round(summaryEventsA);
    const trials = Math.round(summaryTrialsA);
    return [...Array(events).fill(1), ...Array(Math.max(0, trials - events)).fill(0)];
  }, [summaryEventsA, summaryTrialsA]);
  const proportionSeriesB = useMemo(() => {
    if (
      !Number.isFinite(summaryEventsB) ||
      !Number.isFinite(summaryTrialsB) ||
      summaryTrialsB <= 0 ||
      summaryEventsB < 0 ||
      summaryEventsB > summaryTrialsB
    ) {
      return [];
    }

    const events = Math.round(summaryEventsB);
    const trials = Math.round(summaryTrialsB);
    return [...Array(events).fill(1), ...Array(Math.max(0, trials - events)).fill(0)];
  }, [summaryEventsB, summaryTrialsB]);
  const secondaryData = isOneSampleMode || isOnePropZMode || isTwoPropZMode ? undefined : dataB;
  const pairedAlignmentError = isPairedMode && dataA.length !== dataB.length;
  const anovaGroups = useMemo(
    () =>
      multiVectorInputs
        .map((group) => ({ ...group, values: parseSamples(group.value) }))
        .filter((group) => group.values.length > 0),
    [multiVectorInputs],
  );
  const pairedDiffData = useMemo(
    () => (isPairedMode && !pairedAlignmentError ? dataA.map((value, index) => value - dataB[index]) : []),
    [dataA, dataB, isPairedMode, pairedAlignmentError],
  );
  const evidenceCurveData = isOnePropZMode || isTwoPropZMode ? proportionSeriesA : isPairedMode ? pairedDiffData : dataA;
  const evidenceSecondarySeries = isOnePropZMode ? undefined : isTwoPropZMode ? proportionSeriesB : isPairedMode ? undefined : secondaryData;
  const validTwoWayRows = useMemo<TwoWayAnovaParsedRow[]>(
    () => parseTwoWayMatrix(twoWayMatrixInput),
    [twoWayMatrixInput],
  );
  const twoWayAnalysis = useMemo(
    () =>
      isTwoWayAnovaMode
        ? twoWayAnova(validTwoWayRows, alpha, factorAName, factorBName, responseName)
        : null,
    [alpha, factorAName, factorBName, isTwoWayAnovaMode, responseName, validTwoWayRows],
  );
  const valid =
    implementedTest &&
    (isOnePropZMode
      ? Number.isFinite(parsedTargetProportion) &&
        parsedTargetProportion >= 0 &&
        parsedTargetProportion <= 1 &&
        Number.isFinite(summaryEventsA) &&
        Number.isFinite(summaryTrialsA) &&
        summaryTrialsA > 0 &&
        summaryEventsA >= 0 &&
        summaryEventsA <= summaryTrialsA
      : isTwoPropZMode
        ? Number.isFinite(summaryEventsA) &&
          Number.isFinite(summaryTrialsA) &&
          summaryTrialsA > 0 &&
          summaryEventsA >= 0 &&
          summaryEventsA <= summaryTrialsA &&
          Number.isFinite(summaryEventsB) &&
          Number.isFinite(summaryTrialsB) &&
          summaryTrialsB > 0 &&
          summaryEventsB >= 0 &&
          summaryEventsB <= summaryTrialsB
      : isVarianceChiSqMode
      ? dataA.length >= 2 && Number.isFinite(parsedTargetStdev) && parsedTargetStdev > 0
      : isTwoVarianceFMode
        ? dataA.length >= 2 && dataB.length >= 2
      : isLeveneMode
        ? anovaGroups.length >= 2 && anovaGroups.every((group) => group.values.length >= 2)
      : isOneSampleMode
      ? dataA.length >= 2 && Number.isFinite(parsedTargetMean)
      : isPairedMode
        ? !pairedAlignmentError && dataA.length >= 2 && dataB.length >= 2
        : isAnovaMode
          ? anovaGroups.length >= 2 && anovaGroups.every((group) => group.values.length >= 2)
          : isTwoWayAnovaMode
            ? validTwoWayRows.length >= 4
          : dataA.length >= 2 && dataB.length >= 2);

  useEffect(() => {
    if ((isAnovaMode || isTwoWayAnovaMode || isLeveneMode) && adjudication.tailDirection !== "RIGHT_TAILED") {
      setAdjudication((current) => ({ ...current, tailDirection: "RIGHT_TAILED" }));
    }
  }, [adjudication.tailDirection, isAnovaMode, isTwoWayAnovaMode, isLeveneMode]);

  useEffect(() => {
    if (!implementedTest || !valid) {
      setResult(null);
      return;
    }

    if (isOneSampleMode) {
      setResult(oneSampleT(dataA, alpha, adjudication.tailDirection, parsedTargetMean));
      return;
    }

    if (isOnePropZMode) {
      setResult(oneProportionZ(summaryEventsA, summaryTrialsA, alpha, adjudication.tailDirection, parsedTargetProportion));
      return;
    }

    if (isTwoPropZMode) {
      setResult(twoProportionZ(summaryEventsA, summaryTrialsA, summaryEventsB, summaryTrialsB, alpha, adjudication.tailDirection));
      return;
    }

    if (isVarianceChiSqMode) {
      setResult(oneVarianceChiSquare(dataA, alpha, adjudication.tailDirection, parsedTargetStdev));
      return;
    }

    if (isTwoVarianceFMode) {
      setResult(twoVarianceF(dataA, dataB, alpha, adjudication.tailDirection));
      return;
    }

    if (isLeveneMode) {
      setResult(leveneTest(anovaGroups, alpha));
      return;
    }

    if (isPairedMode) {
      setResult(pairedT(dataA, dataB, alpha, adjudication.tailDirection));
      return;
    }

    if (isAnovaMode) {
      setResult(oneWayAnova(anovaGroups, alpha, factorName));
      return;
    }

    if (isTwoWayAnovaMode) {
      setResult(null);
      return;
    }

    setResult(twoSampleT(dataA, dataB, alpha, adjudication.tailDirection));
  }, [
    adjudication.tailDirection,
    alpha,
    anovaGroups,
    dataA,
    dataB,
    factorName,
    implementedTest,
    isAnovaMode,
    isOneSampleMode,
    isOnePropZMode,
    isTwoPropZMode,
    isPairedMode,
    isVarianceChiSqMode,
    isTwoVarianceFMode,
    isLeveneMode,
    isTwoWayAnovaMode,
    parsedTargetMean,
    parsedTargetProportion,
    parsedTargetStdev,
    summaryEventsA,
    summaryEventsB,
    summaryTrialsA,
    summaryTrialsB,
    validTwoWayRows,
    valid,
  ]);

  const critical = result?.critical ?? (adjudication.tailDirection === "TWO_TAILED" ? 1.96 : 1.645);
  const isVarianceAuditMode = isVarianceChiSqMode || isTwoVarianceFMode || isLeveneMode;
  const isProportionAuditMode = isOnePropZMode || isTwoPropZMode;
  const evidenceMatrixLabel = isVarianceAuditMode ? "波动证据矩阵" : isProportionAuditMode ? "比率证据矩阵" : "证据遥测矩阵";
  const evidenceMatrixSubLabel = isVarianceAuditMode ? "Variance Evidence Matrix / Dispersion Audit" : isProportionAuditMode ? "Proportion Evidence Matrix / Ratio Audit" : "Evidence Telemetry Matrix / 5-Dimensional Audit";
  const probabilityCoreLabel = isVarianceAuditMode ? "波动概率核心" : isProportionAuditMode ? "比率概率核心" : "概率核心";
  const probabilityCoreSubLabel = isVarianceChiSqMode
    ? "CHI-SQUARE VARIANCE PROBABILITY"
    : isLeveneMode
      ? "LEVENE F VARIANCE PROBABILITY"
      : isTwoVarianceFMode
      ? "F-RATIO VARIANCE PROBABILITY"
      : isProportionAuditMode
        ? "ONE-PROP Z PROBABILITY"
        : "F-DISTRIBUTION PROBABILITY";
  const varianceSupportLabel = isVarianceChiSqMode
    ? "STDEV CONFIDENCE BAND"
    : isTwoVarianceFMode
      ? "VARIANCE RATIO BAND"
      : isLeveneMode
        ? "MULTI-GROUP SPREAD OVERLAY"
        : isProportionAuditMode
          ? "PROPORTION SHIFT OVERLAY"
          : "OVERLAPPING DENSITY";
  const assumptionStackLabel = isVarianceAuditMode ? "波动诊断机架 / Dispersion Assumption Stack" : isProportionAuditMode ? "比率诊断机架 / Proportion Assumption Stack" : "假设验证机架 / Assumption Stack";
  const tailHypothesis = isVarianceChiSqMode
    ? adjudication.tailDirection === "LEFT_TAILED"
      ? {
          h0: "H0: σ² ≥ σ₀²，当前批次波动不小于法定标准。",
          h1: "H1: σ² < σ₀²，当前批次波动低于目标标准。",
        }
      : adjudication.tailDirection === "RIGHT_TAILED"
        ? {
            h0: "H0: σ² ≤ σ₀²，当前批次波动不高于法定标准。",
            h1: "H1: σ² > σ₀²，当前批次波动高于目标标准。",
          }
        : {
            h0: "H0: σ² = σ₀²，当前批次波动符合法定标准。",
            h1: "H1: σ² ≠ σ₀²，当前批次波动不符合法定标准。",
          }
    : isTwoVarianceFMode
      ? adjudication.tailDirection === "LEFT_TAILED"
        ? {
            h0: "H0: σA² ≥ σB²，样本 A 波动不小于样本 B。",
            h1: "H1: σA² < σB²，样本 A 波动小于样本 B。",
          }
        : adjudication.tailDirection === "RIGHT_TAILED"
          ? {
              h0: "H0: σA² ≤ σB²，样本 A 波动不大于样本 B。",
              h1: "H1: σA² > σB²，样本 A 波动大于样本 B。",
            }
          : {
              h0: "H0: σA² = σB²，两组样本波动不存在显著差异。",
              h1: "H1: σA² ≠ σB²，两组样本波动存在显著差异。",
            }
    : isLeveneMode
      ? {
          h0: "H0: σ1² = σ2² = ... = σk²，各样本组波动水平一致。",
          h1: "H1: 至少存在一个样本组波动与其他组不同。",
        }
    : isOnePropZMode
      ? adjudication.tailDirection === "LEFT_TAILED"
        ? {
            h0: "H0: p >= p0，当前事件占比不低于目标比例。",
            h1: "H1: p < p0，当前事件占比低于目标比例。",
          }
        : adjudication.tailDirection === "RIGHT_TAILED"
          ? {
              h0: "H0: p <= p0，当前事件占比不高于目标比例。",
              h1: "H1: p > p0，当前事件占比高于目标比例。",
            }
          : {
              h0: "H0: p = p0，当前事件占比符合目标比例。",
              h1: "H1: p != p0，当前事件占比偏离目标比例。",
            }
    : isTwoPropZMode
      ? adjudication.tailDirection === "LEFT_TAILED"
        ? {
            h0: "H0: pA >= pB，样本组 A 事件占比不低于样本组 B。",
            h1: "H1: pA < pB，样本组 A 事件占比低于样本组 B。",
          }
        : adjudication.tailDirection === "RIGHT_TAILED"
          ? {
              h0: "H0: pA <= pB，样本组 A 事件占比不高于样本组 B。",
              h1: "H1: pA > pB，样本组 A 事件占比高于样本组 B。",
            }
          : {
              h0: "H0: pA = pB，两组事件占比不存在显著差异。",
              h1: "H1: pA != pB，两组事件占比存在显著差异。",
            }
    : isOneSampleMode
    ? adjudication.tailDirection === "LEFT_TAILED"
      ? {
          h0: "H0: μ ≥ μ0，当前批次均值不低于图纸基准。",
          h1: "H1: μ < μ0，当前批次均值低于图纸基准。",
        }
      : adjudication.tailDirection === "RIGHT_TAILED"
        ? {
            h0: "H0: μ ≤ μ0，当前批次均值不高于图纸基准。",
            h1: "H1: μ > μ0，当前批次均值高于图纸基准。",
          }
        : {
            h0: "H0: μ = μ0，当前批次均值等于图纸基准。",
            h1: "H1: μ ≠ μ0，当前批次均值偏离图纸基准。",
          }
    : isPairedMode
      ? adjudication.tailDirection === "LEFT_TAILED"
        ? {
            h0: "H0: μd ≥ 0，前后配对均值差不小于零。",
            h1: "H1: μd < 0，前后配对均值差小于零。",
          }
        : adjudication.tailDirection === "RIGHT_TAILED"
          ? {
              h0: "H0: μd ≤ 0，前后配对均值差不大于零。",
              h1: "H1: μd > 0，前后配对均值差大于零。",
            }
          : {
              h0: "H0: μd = 0，前后配对均值差为零，处理无显著影响。",
              h1: "H1: μd ≠ 0，前后配对均值差不为零，处理存在显著影响。",
            }
      : isAnovaMode
        ? {
            h0: "H0: μ1 = μ2 = ... = μk，所有样本组均值完全相等。",
            h1: "H1: 至少存在一个 μi 与其他组不同。",
          }
        : adjudication.activeTest === "2_WAY_ANOVA"
          ? {
              h0: "H0: 主效应与交互效应均不显著。",
              h1: "H1: 至少存在一个主效应或交互效应显著。",
            }
        : adjudication.tailDirection === "LEFT_TAILED"
        ? {
            h0: "H0: μA ≥ μB，样本 A 不低于样本 B。",
            h1: "H1: μA < μB，样本 A 显著低于样本 B。",
          }
        : adjudication.tailDirection === "RIGHT_TAILED"
          ? {
              h0: "H0: μA ≤ μB，样本 A 不高于样本 B。",
              h1: "H1: μA > μB，样本 A 显著高于样本 B。",
            }
          : {
              h0: "H0: μA = μB，两组样本均值不存在显著差异。",
              h1: "H1: μA ≠ μB，两组样本均值存在显著差异。",
            };
  const seed = `${projectName}|${adjudication.activeDomain}|${adjudication.activeTest}|${adjudication.tailDirection}|${alpha}|${effectiveSampleA}|${effectiveSampleB}|${targetMean}|${targetStdev}|${targetProportion}|${factorAName}|${factorBName}|${responseName}|${twoWayMatrixInput}|${JSON.stringify(summaryRows)}`;

  function handleDomainChange(domain: StatDomain) {
    const nextTest = TEST_OPTIONS_BY_DOMAIN[domain][0];
    setAdjudication((current) => ({
      ...current,
      activeDomain: domain,
      activeTest: nextTest.id,
      payloadMode: nextTest.payloadMode,
    }));
  }

  function handleTestChange(test: TestVariant) {
    const forcedTail =
      test === "1_WAY_ANOVA" || test === "2_WAY_ANOVA" || test === "MULTI_VAR_LEVENE" ? "RIGHT_TAILED" : adjudication.tailDirection;
    setAdjudication((current) => ({
      ...current,
      activeDomain: getDomainForTest(test),
      activeTest: test,
      tailDirection: forcedTail,
      payloadMode: getPayloadModeForTest(test),
    }));
  }

  function handleTailDirectionChange(direction: TailDirection) {
    setAdjudication((current) => ({ ...current, tailDirection: direction }));
  }

  function handleMultiVectorChange(id: string, value: string) {
    setMultiVectorInputs((current) => current.map((group) => (group.id === id ? { ...group, value } : group)));
  }

  function handleAddMultiVectorGroup() {
    setMultiVectorInputs((current) => [
      ...current,
      {
        id: `group-${current.length + 1}`,
        label: `样本组 ${String.fromCharCode(65 + current.length)}`,
        value: "",
      },
    ]);
  }

  function handleRemoveMultiVectorGroup(id: string) {
    setMultiVectorInputs((current) => (current.length <= 2 ? current : current.filter((group) => group.id !== id)));
  }

  function handleSummaryRowChange(id: string, field: "events" | "trials", value: string) {
    setSummaryRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function handleGenerate() {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1400);
  }

  async function handleGenerateSnapshot() {
    const targetElement = document.getElementById("axiom-sigma-adjudication-matrix");
    if (!targetElement) return;

    targetElement.classList.add("exporting-snapshot");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(targetElement, {
        backgroundColor: "#050505",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `AXIOM_SIGMA_AUDIT_${adjudication.activeTest}_${timestamp}.png`;
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      targetElement.classList.remove("exporting-snapshot");
    }
  }

  return (
    <div className="hypothesis-terminal">
      <div className="hud-screen hud-hex relative overflow-hidden rounded-[28px] border border-white/8">
        <div className="relative z-[1] mx-auto flex min-h-[calc(100vh-14rem)] max-w-[1560px] flex-col gap-4 p-3 sm:p-4 lg:p-5">
          <header className="metal-panel flex flex-col gap-3 rounded-xl p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary glow-cyan">
                  <Activity className="h-5 w-5" />
                </span>
                <div className="flex flex-col leading-tight">
                  <h1 className="text-lg font-bold tracking-wide text-foreground sm:text-xl">
                    AXIOM SIGMA <span className="text-primary text-glow-cyan">Statistical Router Hub</span>
                  </h1>
                  <p className="font-num text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
                    Six Sigma Black Belt Adjudication Matrix
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {projectName ? `${projectName} 系列` : "当前系列"}统计仲裁中枢，已升级为多域路由骨架。
                  </p>
                </div>
              </div>

              <div className="flex w-full max-w-[900px] flex-col gap-3 xl:items-stretch">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!implementedTest}
                    onClick={() => setPreviewSafe((current) => !current)}
                    className={cn(
                      "glow-cyan-hover recessed font-num flex items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                      implementedTest ? (previewSafe ? "text-primary" : "text-[var(--warning)]") : "cursor-not-allowed text-gray-600",
                    )}
                  >
                    {previewSafe ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {previewSafe ? "SAFE PREVIEW" : "PREVIEW SAFE"}
                  </button>
                  <ForensicBadge seed={seed} />
                </div>
                <ModuleSelector active={adjudication.activeDomain} onChange={handleDomainChange} />
                <TestVariantSelector
                  activeDomain={adjudication.activeDomain}
                  activeTest={adjudication.activeTest}
                  onChange={handleTestChange}
                />
              </div>
            </div>
          </header>

          {moduleLocked ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              当前测试路径已切换到 {adjudication.activeTest}，算法模块仍待注入，左侧数据结构已按 payload mode 就绪。
            </div>
          ) : null}

          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              isTwoWayAnovaMode
                ? "xl:grid-cols-1"
                : isAnovaMode
                ? "xl:grid-cols-[320px_minmax(0,1fr)]"
                : "xl:grid-cols-[320px_minmax(0,1fr)_340px]",
            )}
          >
            {!isTwoWayAnovaMode ? (
              <ParameterPanel
                h0={tailHypothesis.h0}
                h1={tailHypothesis.h1}
                alpha={alpha}
                factorName={factorName}
                factorAName={factorAName}
                factorBName={factorBName}
                responseName={responseName}
                activeTest={adjudication.activeTest}
                tailDirection={adjudication.tailDirection}
                payloadMode={adjudication.payloadMode}
                sampleA={sampleA}
                sampleB={sampleB}
                targetMean={targetMean}
                targetStdev={targetStdev}
                targetProportion={targetProportion}
                multiVectorInputs={multiVectorInputs}
                twoWayMatrixInput={twoWayMatrixInput}
                twoWayValidCount={validTwoWayRows.length}
                twoWayAnalysis={twoWayAnalysis}
                summaryRows={summaryRows}
                nA={dataA.length}
                nB={secondaryData?.length ?? 0}
                reject={result?.reject ?? false}
                moduleLocked={moduleLocked}
                onAlpha={setAlpha}
                onFactorNameChange={setFactorName}
                onFactorANameChange={setFactorAName}
                onFactorBNameChange={setFactorBName}
                onResponseNameChange={setResponseName}
                onTailDirection={handleTailDirectionChange}
                onSampleA={setSampleA}
                onSampleB={setSampleB}
                onTargetMeanChange={setTargetMean}
                onTargetStdevChange={setTargetStdev}
                onTargetProportionChange={setTargetProportion}
                onMultiVectorChange={handleMultiVectorChange}
                onAddMultiVectorGroup={handleAddMultiVectorGroup}
                onRemoveMultiVectorGroup={handleRemoveMultiVectorGroup}
                onTwoWayMatrixChange={setTwoWayMatrixInput}
                onSummaryRowChange={handleSummaryRowChange}
              />
            ) : null}

            {isAnovaMode ? (
              <>
                <div className="flex flex-col gap-4">
                  {implementedTest ? (
                    pairedAlignmentError ? (
                      <AlignmentErrorCard />
                    ) : result ? (
                      <AnovaCommandCenter result={result} alpha={alpha} critical={critical} />
                    ) : (
                      <div className="metal-panel flex flex-1 items-center justify-center rounded-2xl p-10 text-center">
                        <p className="font-num text-sm text-muted-foreground">
                          至少需要 2 组且每组不少于 2 个有效数据点
                          <br />
                          <span className="text-[11px] uppercase tracking-widest">Awaiting valid data injection</span>
                        </p>
                      </div>
                    )
                  ) : (
                    <OfflineModulePanel activeTest={adjudication.activeTest} compact />
                  )}
                </div>
              </>
            ) : isTwoWayAnovaMode ? (
              <div id="axiom-sigma-adjudication-matrix" className="flex flex-col gap-4">
                <TwoWayAnovaWorkbench
                  factorAName={factorAName}
                  factorBName={factorBName}
                  responseName={responseName}
                  rows={validTwoWayRows}
                  h0={tailHypothesis.h0}
                  h1={tailHypothesis.h1}
                  reject={Boolean(twoWayAnalysis && (twoWayAnalysis.rejectA || twoWayAnalysis.rejectB || twoWayAnalysis.rejectInteraction))}
                  matrixInput={twoWayMatrixInput}
                  validCount={validTwoWayRows.length}
                  alpha={alpha}
                  analysis={twoWayAnalysis}
                  onGenerateSnapshot={handleGenerateSnapshot}
                  onAlphaChange={setAlpha}
                  onMatrixChange={setTwoWayMatrixInput}
                  onFactorANameChange={setFactorAName}
                  onFactorBNameChange={setFactorBName}
                  onResponseNameChange={setResponseName}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4">
                  {implementedTest ? (
                    pairedAlignmentError ? (
                      <AlignmentErrorCard />
                    ) : result ? (
                      <>
                        <VerdictHud pValue={result.pValue} alpha={alpha} reject={result.reject} testType={result.testType} />
                        <TelemetryReadout result={result} critical={critical} />
                        <TestRobustnessPanel result={result} />
                      </>
                    ) : (
                      <div className="metal-panel flex flex-1 items-center justify-center rounded-2xl p-10 text-center">
                        <p className="font-num text-sm text-muted-foreground">
                          每组至少需要 2 个有效数据点
                          <br />
                          <span className="text-[11px] uppercase tracking-widest">Awaiting valid data injection</span>
                        </p>
                      </div>
                    )
                  ) : (
                    <OfflineModulePanel activeTest={adjudication.activeTest} compact />
                  )}
                </div>

                {implementedTest ? (
                  pairedAlignmentError ? (
                    <div className="glass flex items-center justify-center rounded-2xl p-6 text-center text-sm text-amber-100">
                      配对样本长度不一致，管理层摘要已锁定，等待数据对齐后再生成结论。
                    </div>
                  ) : result ? (
                    result.testType === "1_VAR_CHI_SQ" || result.testType === "2_VAR_F" ? (
                      <VarianceExecutivePanel result={result} alpha={alpha} onGenerate={handleGenerate} />
                    ) : (
                      <ExecutiveSummary result={result} critical={critical} alpha={alpha} onGenerate={handleGenerate} />
                    )
                  ) : (
                    <div className="glass flex items-center justify-center rounded-2xl p-6 text-center text-sm text-muted-foreground">
                      录入样本后，这里会展示统计摘要、置信区间和审计结论。
                    </div>
                  )
                ) : (
                  <OfflineModulePanel activeTest={adjudication.activeTest} compact />
                )}
              </>
            )}
          </div>

          {implementedTest && !isAnovaMode && !isTwoWayAnovaMode ? (
          <section className="relative flex flex-col gap-3">
            <svg
              className="pointer-events-none absolute -top-4 left-0 h-4 w-full"
              viewBox="0 0 1000 24"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path className="pcb-trace" d="M120 0 L120 12 L500 12 L500 24" />
              <path className="pcb-trace" d="M500 0 L500 12 L500 24" />
              <path className="pcb-trace" d="M880 0 L880 12 L500 12 L500 24" />
              <circle className="pcb-node" cx="500" cy="20" r="3" />
            </svg>

            <header className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary glow-cyan" />
                <div className="flex flex-col leading-tight">
                  <h2 className="text-base font-bold tracking-wide text-foreground">{evidenceMatrixLabel}</h2>
                  <span className="font-num text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                    {evidenceMatrixSubLabel}
                  </span>
                </div>
              </div>
              <span className="font-num rounded bg-primary/10 px-2.5 py-1 text-[9px] uppercase tracking-widest text-primary">
                5 Visualizers Online
              </span>
            </header>

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="evidence-slab flex flex-col rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-num text-primary/80">[</span>
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-bold tracking-wide text-foreground">{probabilityCoreLabel}</span>
                      <span className="font-num text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                        {probabilityCoreSubLabel}
                      </span>
                    </div>
                    <span className="font-num text-primary/80">]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="h-2 w-2 rounded-full bg-[#FF6B81]" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-primary/90">
                    [ {probabilityCoreSubLabel} ]
                  </span>
                  <div className="recessed rounded-lg p-2">
                    {result ? (
                      <DistributionCurve
                        tStat={result.tStat}
                        df={result.testType === "1_WAY_ANOVA" ? result.dfBetween ?? result.df : result.df}
                        df2={result.testType === "1_WAY_ANOVA" || result.testType === "MULTI_VAR_LEVENE" ? result.dfWithin : result.testType === "2_VAR_F" ? result.dfSecondary ?? undefined : undefined}
                        critical={critical}
                        criticalSecondary={result.criticalSecondary}
                        distribution={result.testType === "1_WAY_ANOVA" || result.testType === "2_VAR_F" || result.testType === "MULTI_VAR_LEVENE" ? "f" : result.testType === "1_VAR_CHI_SQ" ? "chi2" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "normal" : "t"}
                        titleZh={result.testType === "1_VAR_CHI_SQ" ? "方差抽样分布" : result.testType === "2_VAR_F" ? "方差比抽样分布" : result.testType === "MULTI_VAR_LEVENE" ? "齐性抽样分布" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "比率抽样分布" : undefined}
                        titleEn={result.testType === "1_VAR_CHI_SQ" ? "Sampling Distribution / χ²(df)" : result.testType === "2_VAR_F" ? "Sampling Distribution / F(df1, df2)" : result.testType === "MULTI_VAR_LEVENE" ? "Sampling Distribution / Levene F" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "Sampling Distribution / Z(0,1)" : undefined}
                        rejectLegendZh={result.testType === "1_VAR_CHI_SQ" ? "卡方拒绝域" : result.testType === "2_VAR_F" ? "方差比拒绝域" : result.testType === "MULTI_VAR_LEVENE" ? "齐性拒绝域" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "Z 拒绝域" : undefined}
                        rejectLegendEn={result.testType === "1_VAR_CHI_SQ" ? "χ² tail zone" : result.testType === "2_VAR_F" ? "F ratio tail zone" : result.testType === "MULTI_VAR_LEVENE" ? "Levene rejection zone" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "Z rejection zone" : undefined}
                        statLegendZh={result.testType === "1_VAR_CHI_SQ" ? "卡方统计量" : result.testType === "2_VAR_F" ? "方差比统计量" : result.testType === "MULTI_VAR_LEVENE" ? "Levene 统计量" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "Z 统计量" : undefined}
                        statLegendEn={result.testType === "1_VAR_CHI_SQ" ? "χ² Stat" : result.testType === "2_VAR_F" ? "F Ratio Stat" : result.testType === "MULTI_VAR_LEVENE" ? "Levene F" : result.testType === "1_PROP_Z" || result.testType === "2_PROP_Z" ? "Z Stat" : undefined}
                      />
                    ) : (
                      <EmptyChart variant="flatline" />
                    )}
                  </div>
                </div>

                <div className="my-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-white/5" />
                  <span className="font-num text-[8px] uppercase tracking-[0.3em] text-muted-foreground/60">
                    Cross-Validation
                  </span>
                  <span className="h-px flex-1 bg-white/5" />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-primary/90">
                    [ {varianceSupportLabel} ]
                  </span>
                  <div className="recessed rounded-lg p-2">
                    {valid && !isAnovaMode ? (
                      result?.testType === "1_VAR_CHI_SQ" ? (
                        <VarianceAuditBand
                          sampleStdev={result.sdA}
                          targetStdev={result.targetStdev ?? 0}
                          ciLow={result.ciLow}
                          ciHigh={result.ciHigh}
                        />
                      ) : result?.testType === "2_VAR_F" ? (
                        <VarianceRatioBand
                          sampleAStdev={result.sdA}
                          sampleBStdev={result.sdB ?? 0}
                          ciLow={result.ciLow}
                          ciHigh={result.ciHigh}
                        />
                      ) : result?.testType === "MULTI_VAR_LEVENE" && result.varianceGroupData && result.varianceGroupLabels ? (
                        <AnovaDensityOverlay
                          groups={result.varianceGroupLabels.map((label, index) => ({
                            label,
                            values: result.varianceGroupData?.[index] ?? [],
                          }))}
                        />
                      ) : (
                        <DensityOverlay
                          dataA={evidenceCurveData}
                          dataB={evidenceSecondarySeries}
                          targetValue={result?.testType === "1_SAMPLE_T" ? result.targetMean : isPairedMode ? 0 : null}
                        />
                      )
                    ) : isAnovaMode ? (
                      result?.anovaGroupData && result?.anovaGroupLabels ? (
                        <AnovaDensityOverlay
                          groups={result.anovaGroupLabels.map((label, index) => ({
                            label,
                            values: result.anovaGroupData?.[index] ?? [],
                          }))}
                        />
                      ) : (
                        <EmptyChart />
                      )
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </div>
              </div>

              <div className="evidence-slab flex flex-col rounded-xl p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-foreground">
                    {assumptionStackLabel}
                  </span>
                  <span className="font-num text-[8px] uppercase tracking-widest text-primary">RACK-03</span>
                </div>
                <div className="flex flex-1 flex-col divide-y divide-white/5">
                  <RackUnit zh="方差分布" en="Variance Boxplot">
                    {valid ? (
                      (isAnovaMode || result?.testType === "MULTI_VAR_LEVENE") && ((result?.anovaGroupData && result?.anovaGroupLabels) || (result?.varianceGroupData && result?.varianceGroupLabels)) ? (
                        <AnovaBoxplot
                          groups={(result.anovaGroupLabels ?? result.varianceGroupLabels ?? []).map((label, index) => ({
                            label,
                            values: result.anovaGroupData?.[index] ?? result.varianceGroupData?.[index] ?? [],
                          }))}
                        />
                      ) : (
                        <VarianceBoxplot
                          dataA={evidenceCurveData}
                          dataB={evidenceSecondarySeries}
                        />
                      )
                    ) : (
                      <EmptyChart />
                    )}
                  </RackUnit>
                  <RackUnit zh="正态拟合" en="Normality Q-Q">
                    {valid && !isAnovaMode && !isLeveneMode ? (
                      <QQPlot dataA={evidenceCurveData} dataB={evidenceSecondarySeries} />
                    ) : (isAnovaMode || result?.testType === "MULTI_VAR_LEVENE") && ((result?.anovaGroupData && result?.anovaGroupLabels) || (result?.varianceGroupData && result?.varianceGroupLabels)) ? (
                      <AnovaResidualQQPlot
                        groups={(result.anovaGroupLabels ?? result.varianceGroupLabels ?? []).map((label, index) => ({
                          label,
                          values: result.anovaGroupData?.[index] ?? result.varianceGroupData?.[index] ?? [],
                        }))}
                      />
                    ) : (
                      <EmptyChart />
                    )}
                  </RackUnit>
                  <RackUnit zh="过程稳定性" en="Run Chart">
                    {valid && !isAnovaMode && !isLeveneMode ? (
                      <RunChart dataA={isOnePropZMode ? proportionSeriesA : dataA} dataB={isOnePropZMode ? undefined : secondaryData} />
                    ) : (isAnovaMode || result?.testType === "MULTI_VAR_LEVENE") && ((result?.anovaGroupData && result?.anovaGroupLabels) || (result?.varianceGroupData && result?.varianceGroupLabels)) ? (
                      <AnovaRunChart
                        groups={(result.anovaGroupLabels ?? result.varianceGroupLabels ?? []).map((label, index) => ({
                          label,
                          values: result.anovaGroupData?.[index] ?? result.varianceGroupData?.[index] ?? [],
                        }))}
                      />
                    ) : (
                      <EmptyChart variant="flatline" />
                    )}
                  </RackUnit>
                </div>
              </div>
            </div>
          </section>
          ) : !implementedTest ? (
            <OfflineModulePanel activeTest={adjudication.activeTest} />
          ) : null}
        {flash ? (
          <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm">
            <div className="glass glow-cyan flex items-center gap-3 rounded-xl px-6 py-4">
              <Activity className="h-5 w-5 animate-pulse text-primary" />
              <span className="font-num text-sm font-semibold text-primary">
                结论快照已生成 / AUDIT SNAPSHOT SEALED
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
    </div>
  );
}

function AlignmentErrorCard() {
  return (
    <section className="mech-frame glass relative overflow-hidden rounded-2xl border border-amber-400/40 p-5 text-center">
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <div className="flex items-center justify-center gap-2">
        <span className="font-num text-[10px] uppercase tracking-[0.3em] text-amber-300">
          ⚠ DATA ALIGNMENT ERROR
        </span>
      </div>
      <div className="mt-3 font-num text-2xl font-bold text-amber-200">PAIR LOCKDOWN</div>
      <p className="mt-3 text-sm text-amber-100/85">
        [SYS] 样本长度不匹配 (N_A ≠ N_B). 配对检验已熔断。
      </p>
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
      className="mech-frame glass relative overflow-hidden rounded-2xl p-6 text-center"
      style={
        {
          "--bracket": reject ? "oklch(0.7 0.24 25 / 0.8)" : "oklch(0.82 0.14 200 / 0.8)",
          boxShadow: reject
            ? "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 0 1px oklch(0.7 0.24 25 / 0.4), 0 0 32px oklch(0.7 0.24 25 / 0.18), 0 0 90px -18px oklch(0.7 0.24 25 / 0.5)"
            : "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 32px oklch(0.82 0.14 200 / 0.08), 0 0 90px -18px oklch(0.82 0.14 200 / 0.42)",
        } as React.CSSProperties
      }
    >
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className={cn("font-num text-[10px] uppercase tracking-[0.32em]", reject ? "text-[var(--warning)]" : "text-primary")}>
          ANOVA F-TEST VERDICT
        </span>
      </div>

      <div
        className={cn(
          "font-num text-5xl font-bold tabular-nums sm:text-6xl",
          reject ? "text-[var(--warning)] text-glow-warning" : "text-primary text-glow-cyan",
        )}
      >
        {formatPValue(pValue)}
      </div>

      <div
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
          reject ? "bg-[var(--warning)]/15 text-[var(--warning)]" : "bg-primary/15 text-primary",
        )}
      >
        {reject ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {reject ? "REJECT H0 / 至少一组不同" : "H0 PREVAILS / 组间无显著差异"}
      </div>

      <p className="font-num mt-3 text-[11px] text-muted-foreground">
        {reject ? `P < α (${alpha.toFixed(2)})` : `P ≥ α (${alpha.toFixed(2)})`}
      </p>
    </section>
  );
}
