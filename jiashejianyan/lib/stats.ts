// Lightweight statistical utilities for the AXIOM SIGMA inference engine.

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)
}

export function std(xs: number[]): number {
  return Math.sqrt(variance(xs))
}

// Standard normal probability density function
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI))
}

// Lanczos approximation of the gamma function
function gamma(z: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  }
  z -= 1
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

// Student's t probability density function
export function tPdf(x: number, df: number): number {
  const num = gamma((df + 1) / 2)
  const den = Math.sqrt(df * Math.PI) * gamma(df / 2)
  return (num / den) * Math.pow(1 + (x * x) / df, -(df + 1) / 2)
}

// Regularized incomplete beta function via continued fraction
function betacf(x: number, a: number, b: number): number {
  const fpmin = 1e-30
  let qab = a + b
  let qap = a + 1
  let qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < fpmin) d = fpmin
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < fpmin) d = fpmin
    c = 1 + aa / c
    if (Math.abs(c) < fpmin) c = fpmin
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-7) break
  }
  return h
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    gammaln(a + b) -
      gammaln(a) -
      gammaln(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  )
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a
  }
  return 1 - (bt * betacf(1 - x, b, a)) / b
}

function gammaln(z: number): number {
  return Math.log(Math.abs(gamma(z)))
}

// Two-tailed cumulative probability for the Student's t distribution.
// Returns P(|T| > |t|) — i.e. the two-tailed p-value.
export function tTwoTailedP(t: number, df: number): number {
  const x = df / (df + t * t)
  return betai(df / 2, 0.5, x)
}

// Inverse t CDF (critical value) for a two-tailed alpha via bisection.
export function tCritical(alpha: number, df: number): number {
  const target = alpha // two-tailed: we want P(|T|>tc)=alpha
  let lo = 0
  let hi = 100
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const p = tTwoTailedP(mid, df)
    if (p > target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export interface TwoSampleResult {
  meanA: number
  meanB: number
  sdA: number
  sdB: number
  nA: number
  nB: number
  tStat: number
  df: number
  pValue: number
  diff: number
  marginOfError: number
  ciLow: number
  ciHigh: number
  reject: boolean
}

// Welch's two-sample t-test (unequal variances).
export function twoSampleT(
  a: number[],
  b: number[],
  alpha: number,
): TwoSampleResult {
  const nA = a.length
  const nB = b.length
  const mA = mean(a)
  const mB = mean(b)
  const vA = variance(a)
  const vB = variance(b)
  const se = Math.sqrt(vA / nA + vB / nB) || 1e-9
  const tStat = (mA - mB) / se
  // Welch–Satterthwaite degrees of freedom
  const df =
    (vA / nA + vB / nB) ** 2 /
    ((vA / nA) ** 2 / (nA - 1) + (vB / nB) ** 2 / (nB - 1))
  const pValue = tTwoTailedP(tStat, df)
  const tc = tCritical(alpha, df)
  const me = tc * se
  return {
    meanA: mA,
    meanB: mB,
    sdA: Math.sqrt(vA),
    sdB: Math.sqrt(vB),
    nA,
    nB,
    tStat,
    df,
    pValue,
    diff: mA - mB,
    marginOfError: me,
    ciLow: mA - mB - me,
    ciHigh: mA - mB + me,
    reject: pValue < alpha,
  }
}

export function parseSamples(raw: string): number[] {
  return raw
    .split(/[\s,;\n\t]+/)
    .map((s) => Number.parseFloat(s))
    .filter((n) => Number.isFinite(n))
}

// Linear-interpolated quantile of a numeric sample (0 <= q <= 1).
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

export interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

// Five-number summary used by the variance boxplot.
export function boxStats(xs: number[]): BoxStats {
  const s = [...xs].sort((a, b) => a - b)
  return {
    min: s[0] ?? 0,
    q1: quantile(s, 0.25),
    median: quantile(s, 0.5),
    q3: quantile(s, 0.75),
    max: s[s.length - 1] ?? 0,
  }
}

// Inverse standard-normal CDF (probit) — Acklam's rational approximation.
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ]
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ]
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ]
  const pLow = 0.02425
  const pHigh = 1 - pLow
  let q: number
  let r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    )
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  )
}

export interface QQPoint {
  theoretical: number
  sample: number
  outlier: boolean
}

// Standardized Q-Q points: theoretical normal quantile vs standardized sample.
export function qqPoints(xs: number[]): QQPoint[] {
  if (xs.length < 2) return []
  const s = [...xs].sort((a, b) => a - b)
  const m = mean(s)
  const sd = std(s) || 1e-9
  const n = s.length
  return s.map((x, i) => {
    const p = (i + 0.5) / n
    const theoretical = normalQuantile(p)
    const sample = (x - m) / sd
    return {
      theoretical,
      sample,
      outlier: Math.abs(sample - theoretical) > 0.55 && Math.abs(theoretical) > 1,
    }
  })
}
