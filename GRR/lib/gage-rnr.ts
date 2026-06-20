// ============================================================================
// GRR_AERO — Gage R&R (Measurement System Analysis) Engine
// Pure, dependency-free implementation of the AIAG X-bar & R method.
// All math runs locally in the browser. No backend.
// ============================================================================

/** measurements[operator][part][trial] = reading */
export type Measurements = number[][][]

export interface StudyConfig {
  operators: number
  parts: number
  trials: number
  operatorNames: string[]
  partNames: string[]
  /** Upper specification limit. */
  usl: number
  /** Lower specification limit. */
  lsl: number
  /**
   * Optional historical process sigma (total process std-dev). When > 0 it
   * overrides the sampled Total Variation so the analysis is not biased by a
   * non-representative set of study parts.
   */
  historicalSigma?: number
  /** Significance level for ANOVA interaction pooling (default 0.05). */
  alpha: number
  measurements: Measurements
}

/** Engineering tolerance band (USL - LSL). */
export const toleranceOf = (cfg: { usl: number; lsl: number }) => Math.max(0, cfg.usl - cfg.lsl)

// --- AIAG / SPC control-chart constants (indexed by subgroup size) ---------
const A2: Record<number, number> = { 2: 1.88, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419 }
const D4: Record<number, number> = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924 }
const D3: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076 }

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs)

// ---------------------------------------------------------------------------
// F-distribution p-values (regularized incomplete beta, Lentz continued frac.)
// Used to test significance of ANOVA sources. Pure, dependency-free.
// ---------------------------------------------------------------------------
function logGamma(x: number): number {
  // Lanczos approximation
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-30
  let qab = a + b
  let qap = a + 1
  let qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-7) break
  }
  return h
}

/** Regularized incomplete beta function I_x(a, b). */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Upper-tail p-value P(F > f) for the F-distribution with (d1, d2) DF. */
export function fPValue(f: number, d1: number, d2: number): number {
  if (!Number.isFinite(f) || f <= 0 || d1 <= 0 || d2 <= 0) return 1
  const x = d2 / (d2 + d1 * f)
  return betai(d2 / 2, d1 / 2, x)
}

// ---------------------------------------------------------------------------
// Deterministic default dataset: 3 operators x 10 parts x 3 trials.
// Part-to-part is the dominant signal; within-trial noise is small.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOMINAL = 25.0
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const operatorName = (o: number) => `APPRAISER ${LETTERS[o] ?? o + 1}`
export const partName = (p: number) => `P${String(p + 1).padStart(2, '0')}`

/** Deterministically generate a measurement grid where part-to-part is dominant. */
function genMeasurements(operators: number, parts: number, trials: number): Measurements {
  const rand = mulberry32(42)
  const partTrue = Array.from({ length: parts }, (_, p) => NOMINAL + (p - parts / 2) * 0.42)
  const operatorBias = Array.from({ length: operators }, (_, o) => (o - (operators - 1) / 2) * 0.045)

  return Array.from({ length: operators }, (_, o) =>
    Array.from({ length: parts }, (_, p) =>
      Array.from({ length: trials }, () => {
        const noise = (rand() - 0.5) * 0.12 // repeatability noise
        return +(partTrue[p] + operatorBias[o] + noise).toFixed(3)
      }),
    ),
  )
}

export function buildDefaultStudy(): StudyConfig {
  const operators = 3
  const parts = 10
  const trials = 3

  return {
    operators,
    parts,
    trials,
    operatorNames: Array.from({ length: operators }, (_, o) => operatorName(o)),
    partNames: Array.from({ length: parts }, (_, p) => partName(p)),
    usl: NOMINAL + 2.0,
    lsl: NOMINAL - 2.0,
    historicalSigma: 0,
    alpha: 0.05,
    measurements: genMeasurements(operators, parts, trials),
  }
}

/**
 * Resize the study to new dimensions, preserving any overlapping cell values
 * and filling new cells with deterministic generated data.
 */
export function resizeStudy(
  cfg: StudyConfig,
  dims: { operators?: number; parts?: number; trials?: number },
): StudyConfig {
  const operators = Math.max(2, Math.min(8, dims.operators ?? cfg.operators))
  const parts = Math.max(2, Math.min(20, dims.parts ?? cfg.parts))
  const trials = Math.max(2, Math.min(7, dims.trials ?? cfg.trials))

  const seed = genMeasurements(operators, parts, trials)
  const measurements: Measurements = seed.map((opRows, o) =>
    opRows.map((trialVals, p) =>
      trialVals.map((seedVal, t) => cfg.measurements[o]?.[p]?.[t] ?? seedVal),
    ),
  )

  return {
    ...cfg,
    operators,
    parts,
    trials,
    operatorNames: Array.from({ length: operators }, (_, o) => operatorName(o)),
    partNames: Array.from({ length: parts }, (_, p) => partName(p)),
    measurements,
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
export type Verdict = 'acceptable' | 'marginal' | 'unacceptable'

export interface VariationComponent {
  key: string
  label: string
  stdDev: number
  studyVar: number // 6 * stdDev
  pctStudyVar: number // % of total variation
  pctContribution: number // % of total variance
  pctTolerance: number // (studyVar / tolerance) * 100
}

export interface ControlPoint {
  index: number
  operator: number
  part: number
  value: number
  outOfControl: boolean
}

export interface ControlChart {
  points: ControlPoint[]
  centerLine: number
  ucl: number
  lcl: number
  /** Operator subgroup boundaries (point index where each operator block starts) */
  operatorStarts: number[]
}

export type DiagnosisTone = 'good' | 'warn' | 'fail'

export interface Diagnosis {
  code: string
  title: string
  detail: string
  tone: DiagnosisTone
}

/** A single trial reading, used by the run/scatter chart. */
export interface RunPoint {
  operator: number
  part: number
  trial: number
  value: number
}

/** Min / average / max spread for one appraiser (highlights human bias). */
export interface AppraiserStat {
  operator: number
  min: number
  max: number
  avg: number
  spread: number
}

/** A single row of the Two-Way ANOVA table. */
export interface AnovaRow {
  key: string
  label: string
  df: number
  ss: number
  ms: number | null
  f: number | null
  p: number | null
  /** True when this is the interaction row that was pooled into error. */
  pooled?: boolean
}

export interface AnovaTable {
  rows: AnovaRow[]
  /** Whether the interaction term was pooled into the error term (P ≥ α). */
  pooled: boolean
  alpha: number
  /** Original (un-pooled) interaction p-value used for the pooling decision. */
  interactionP: number
}

/** One appraiser's profile of cell means across parts (for the interaction plot). */
export interface InteractionSeries {
  operator: number
  points: { part: number; avg: number }[]
}

export interface GrrResults {
  components: VariationComponent[]
  grr: VariationComponent
  totalVariation: number
  ndc: number
  tolerance: number
  pctGrrStudyVar: number
  pctGrrTolerance: number
  verdict: Verdict
  diagnosis: Diagnosis
  anova: AnovaTable
  interactionSeries: InteractionSeries[]
  /** True when Total Variation was driven by the historical sigma input. */
  usingHistoricalSigma: boolean
  xbarChart: ControlChart
  rChart: ControlChart
  runPoints: RunPoint[]
  appraiserStats: AppraiserStat[]
  grandMean: number
  // raw helpers for the matrix footer
  operatorAverages: number[]
  operatorRanges: number[]
  partAverages: number[]
}

const SIGMA = 6 // study variation multiplier (modern AIAG 6-sigma spread)

export function computeGrr(cfg: StudyConfig): GrrResults {
  const { operators, parts, trials, measurements } = cfg
  const tolerance = toleranceOf(cfg)

  // cell-level means & ranges (per operator/part across trials)
  const cellMean: number[][] = []
  const cellRange: number[][] = []
  for (let o = 0; o < operators; o++) {
    cellMean[o] = []
    cellRange[o] = []
    for (let p = 0; p < parts; p++) {
      const t = measurements[o][p]
      cellMean[o][p] = mean(t)
      cellRange[o][p] = range(t)
    }
  }

  // operator-level averages & average ranges
  const operatorAverages = cellMean.map((row) => mean(row))
  const operatorRanges = cellRange.map((row) => mean(row))
  const rDoubleBar = mean(operatorRanges)
  const grandMean = mean(operatorAverages)

  // part-level averages (across all operators & trials)
  const partAverages = Array.from({ length: parts }, (_, p) => {
    const vals: number[] = []
    for (let o = 0; o < operators; o++) vals.push(...measurements[o][p])
    return mean(vals)
  })

  // =========================================================================
  // TWO-WAY ANOVA WITH INTERACTION  (Part × Appraiser, replicated)
  // The gold-standard AIAG MSA-4 decomposition of measurement variation.
  // =========================================================================
  const p = parts
  const k = operators
  const n = trials
  const N = p * k * n

  // Sum of Squares -----------------------------------------------------------
  let ssTotal = 0
  for (let o = 0; o < k; o++)
    for (let pi = 0; pi < p; pi++)
      for (let t = 0; t < n; t++) ssTotal += Math.pow(measurements[o][pi][t] - grandMean, 2)

  // SS_Part: k*n replicates per part mean
  let ssPart = 0
  for (let pi = 0; pi < p; pi++) ssPart += Math.pow(partAverages[pi] - grandMean, 2)
  ssPart *= k * n

  // SS_Appraiser: p*n replicates per operator mean
  let ssOper = 0
  for (let o = 0; o < k; o++) ssOper += Math.pow(operatorAverages[o] - grandMean, 2)
  ssOper *= p * n

  // SS_Interaction: n replicates per cell mean
  let ssInter = 0
  for (let o = 0; o < k; o++)
    for (let pi = 0; pi < p; pi++)
      ssInter += Math.pow(cellMean[o][pi] - partAverages[pi] - operatorAverages[o] + grandMean, 2)
  ssInter *= n

  // SS_Repeatability (pure error) = within-cell variation
  const ssError = Math.max(0, ssTotal - ssPart - ssOper - ssInter)

  // Degrees of freedom -------------------------------------------------------
  const dfPart = p - 1
  const dfOper = k - 1
  const dfInter = (p - 1) * (k - 1)
  const dfError = p * k * (n - 1)
  const dfTotal = N - 1

  // Mean squares -------------------------------------------------------------
  const msPart = ssPart / dfPart
  const msOper = ssOper / dfOper
  const msInter = dfInter > 0 ? ssInter / dfInter : 0
  const msError = dfError > 0 ? ssError / dfError : 0

  // Interaction significance test (F = MS_inter / MS_error) ------------------
  const fInter = msError > 0 ? msInter / msError : 0
  const interactionP = dfInter > 0 ? fPValue(fInter, dfInter, dfError) : 1
  const alpha = cfg.alpha ?? 0.05
  // AIAG rule: pool a non-significant interaction (P ≥ α) into the error term.
  const pooled = interactionP >= alpha || dfInter <= 0

  // Effective error term after the pooling decision --------------------------
  const ssErrEff = pooled ? ssInter + ssError : ssError
  const dfErrEff = pooled ? dfInter + dfError : dfError
  const msErrEff = dfErrEff > 0 ? ssErrEff / dfErrEff : 0

  // F & p for Part / Appraiser use the appropriate denominator ---------------
  const denomMs = pooled ? msErrEff : msInter
  const denomDf = pooled ? dfErrEff : dfInter
  const fPart = denomMs > 0 ? msPart / denomMs : 0
  const fOper = denomMs > 0 ? msOper / denomMs : 0
  const pPart = fPValue(fPart, dfPart, denomDf)
  const pOper = fPValue(fOper, dfOper, denomDf)

  // Variance components (negative estimates floored at 0) --------------------
  const varEquip = msErrEff // Repeatability
  const varInter = pooled ? 0 : Math.max(0, (msInter - msError) / n)
  const varOper = pooled
    ? Math.max(0, (msOper - msErrEff) / (p * n))
    : Math.max(0, (msOper - msInter) / (p * n))
  const varPartAnova = pooled
    ? Math.max(0, (msPart - msErrEff) / (k * n))
    : Math.max(0, (msPart - msInter) / (k * n))

  const evSd = Math.sqrt(varEquip)
  const avSd = Math.sqrt(varOper + varInter) // Reproducibility = operator + interaction
  const grrSd = Math.sqrt(varEquip + varOper + varInter)

  // --- Total Variation (TV) -------------------------------------------------
  // If a historical sigma is supplied, it governs TV (and therefore %StudyVar)
  // so the result isn't biased by a non-representative set of study parts.
  const histSigma = cfg.historicalSigma && cfg.historicalSigma > 0 ? cfg.historicalSigma : 0
  const usingHistoricalSigma = histSigma > 0
  const tvSd = usingHistoricalSigma ? histSigma : Math.sqrt(grrSd * grrSd + varPartAnova)
  // Derive PV from TV & GRR when historical sigma drives the analysis.
  const pvSd = usingHistoricalSigma ? Math.sqrt(Math.max(0, tvSd * tvSd - grrSd * grrSd)) : Math.sqrt(varPartAnova)

  // --- Assemble the ANOVA table --------------------------------------------
  const anova: AnovaTable = {
    pooled,
    alpha,
    interactionP,
    rows: pooled
      ? [
          { key: 'PART', label: 'Part // 零件', df: dfPart, ss: ssPart, ms: msPart, f: fPart, p: pPart },
          { key: 'OPER', label: 'Appraiser // 评价人', df: dfOper, ss: ssOper, ms: msOper, f: fOper, p: pOper },
          {
            key: 'REPEAT',
            label: 'Repeatability // 重复性 (含交互)',
            df: dfErrEff,
            ss: ssErrEff,
            ms: msErrEff,
            f: null,
            p: null,
          },
          { key: 'TOTAL', label: 'Total // 总计', df: dfTotal, ss: ssTotal, ms: null, f: null, p: null },
        ]
      : [
          { key: 'PART', label: 'Part // 零件', df: dfPart, ss: ssPart, ms: msPart, f: fPart, p: pPart },
          { key: 'OPER', label: 'Appraiser // 评价人', df: dfOper, ss: ssOper, ms: msOper, f: fOper, p: pOper },
          {
            key: 'INTER',
            label: 'Part × Appraiser // 交互作用',
            df: dfInter,
            ss: ssInter,
            ms: msInter,
            f: fInter,
            p: interactionP,
          },
          { key: 'REPEAT', label: 'Repeatability // 重复性', df: dfError, ss: ssError, ms: msError, f: null, p: null },
          { key: 'TOTAL', label: 'Total // 总计', df: dfTotal, ss: ssTotal, ms: null, f: null, p: null },
        ],
  }

  // --- Interaction plot series (cell means per appraiser) -------------------
  const interactionSeries: InteractionSeries[] = []
  for (let o = 0; o < k; o++) {
    interactionSeries.push({
      operator: o,
      points: Array.from({ length: p }, (_, pi) => ({ part: pi, avg: cellMean[o][pi] })),
    })
  }

  const mk = (key: string, label: string, sd: number): VariationComponent => ({
    key,
    label,
    stdDev: sd,
    studyVar: SIGMA * sd,
    pctStudyVar: tvSd ? (sd / tvSd) * 100 : 0,
    pctContribution: tvSd ? (Math.pow(sd, 2) / Math.pow(tvSd, 2)) * 100 : 0,
    pctTolerance: tolerance ? ((SIGMA * sd) / tolerance) * 100 : 0,
  })

  const ev = mk('EV', 'Repeatability (EV) // 设备变差 (重复性)', evSd)
  const av = mk('AV', 'Reproducibility (AV) // 评价人变差 (再现性)', avSd)
  const pv = mk('PV', 'Part Variation (PV) // 零件变差', pvSd)
  const grr = mk('GRR', 'Gage R&R // 测量系统总变差', grrSd)

  const ndc = Math.max(1, Math.floor(1.41 * (pvSd / (grrSd || 1e-9))))
  const pctGrrStudyVar = grr.pctStudyVar
  const pctGrrTolerance = grr.pctTolerance

  let verdict: Verdict = 'acceptable'
  if (pctGrrStudyVar > 30) verdict = 'unacceptable'
  else if (pctGrrStudyVar >= 10) verdict = 'marginal'

  // --- Automated root-cause diagnosis ---
  const evVar = evSd * evSd
  const avVar = avSd * avSd
  const grrVar = evVar + avVar || 1e-12
  const avShare = (avVar / grrVar) * 100
  const evShare = (evVar / grrVar) * 100
  const tone: DiagnosisTone = verdict === 'acceptable' ? 'good' : verdict === 'marginal' ? 'warn' : 'fail'

  let diagnosis: Diagnosis
  if (verdict === 'acceptable') {
    diagnosis = {
      code: 'OPTIMAL',
      title: '✅ SYSTEM OPTIMAL // 系统合格 — 可用于生产数据采集',
      detail: `Gage R&R consumes only ${pctGrrStudyVar.toFixed(1)}% of total study variation. The system resolves ${ndc} distinct part categories — part-to-part signal (${pv.pctStudyVar.toFixed(0)}%) clearly dominates measurement noise. No corrective action required. // 测量系统总变差仅占 ${pctGrrStudyVar.toFixed(1)}%，可区分 ${ndc} 个零件类别，零件变差信号主导，系统合格，可直接用于生产数据采集。`,
      tone,
    }
  } else if (avShare >= evShare) {
    diagnosis = {
      code: 'AV_DOMINANT',
      title: '🚨 AV DOMINANT // 评价人变差主导 — 建议统一测量标准或增加培训',
      detail: `Reproducibility (AV) drives ${avShare.toFixed(0)}% of the gage error — appraisers disagree on the same parts. Root cause is human/method. // 再现性 (AV) 贡献了 ${avShare.toFixed(0)}% 的测量误差，评价人对同一零件读数不一致，根因属于人员/方法层面：建议统一测量标准、加强人员培训，并改善夹具与零件定位后重新评估。`,
      tone,
    }
  } else {
    diagnosis = {
      code: 'EV_DOMINANT',
      title: '🚨 EV DOMINANT // 设备变差主导 — 建议检查、维修或校准量具',
      detail: `Repeatability (EV) drives ${evShare.toFixed(0)}% of the gage error — the same appraiser cannot reproduce a reading on one part. Root cause is the instrument. // 重复性 (EV) 贡献了 ${evShare.toFixed(0)}% 的测量误差，同一评价人无法复现同一零件的读数，根因属于量具本身：建议检查、维修或校准量具，核查分辨率、磨损与夹紧稳定性后重新评估。`,
      tone,
    }
  }

  // --- Run / scatter points (every individual trial) ---
  const runPoints: RunPoint[] = []
  for (let o = 0; o < operators; o++) {
    for (let p = 0; p < parts; p++) {
      for (let t = 0; t < trials; t++) {
        runPoints.push({ operator: o, part: p, trial: t, value: measurements[o][p][t] })
      }
    }
  }

  // --- Appraiser spread (min / avg / max across all of an operator's readings) ---
  const appraiserStats: AppraiserStat[] = []
  for (let o = 0; o < operators; o++) {
    const all: number[] = []
    for (let p = 0; p < parts; p++) all.push(...measurements[o][p])
    const mn = Math.min(...all)
    const mx = Math.max(...all)
    appraiserStats.push({ operator: o, min: mn, max: mx, avg: mean(all), spread: mx - mn })
  }

  // --- X-bar chart (subgroup averages, grouped by operator) ---
  const a2 = A2[trials] ?? A2[7]
  const d4 = D4[trials] ?? D4[7]
  const d3 = D3[trials] ?? D3[7]
  const xUcl = grandMean + a2 * rDoubleBar
  const xLcl = grandMean - a2 * rDoubleBar
  const rUcl = d4 * rDoubleBar
  const rLcl = d3 * rDoubleBar

  const xPoints: ControlPoint[] = []
  const rPoints: ControlPoint[] = []
  const operatorStarts: number[] = []
  let idx = 0
  for (let o = 0; o < operators; o++) {
    operatorStarts.push(idx)
    for (let p = 0; p < parts; p++) {
      const xv = cellMean[o][p]
      const rv = cellRange[o][p]
      xPoints.push({ index: idx, operator: o, part: p, value: xv, outOfControl: xv > xUcl || xv < xLcl })
      rPoints.push({ index: idx, operator: o, part: p, value: rv, outOfControl: rv > rUcl || rv < rLcl })
      idx++
    }
  }

  return {
    components: [ev, av, pv],
    grr,
    totalVariation: SIGMA * tvSd,
    ndc,
    tolerance,
    pctGrrStudyVar,
    pctGrrTolerance,
    verdict,
    diagnosis,
    anova,
    interactionSeries,
    usingHistoricalSigma,
    runPoints,
    appraiserStats,
    grandMean,
    operatorAverages,
    operatorRanges,
    partAverages,
    xbarChart: { points: xPoints, centerLine: grandMean, ucl: xUcl, lcl: xLcl, operatorStarts },
    rChart: { points: rPoints, centerLine: rDoubleBar, ucl: rUcl, lcl: rLcl, operatorStarts },
  }
}
