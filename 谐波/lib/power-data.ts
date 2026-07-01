// Synthetic power-quality data for the Obsidian Glass dashboard.

export type WavePoint = {
  deg: number
  voltage: number
  current: number
}

// One full mains cycle (0–360°). Current carries 5th/7th harmonic distortion
// plus a phase shift to make the oscilloscope feel alive.
export function generateWaveform(): WavePoint[] {
  const points: WavePoint[] = []
  const phaseShift = (18 * Math.PI) / 180 // ~18° lag
  for (let deg = 0; deg <= 360; deg += 3) {
    const rad = (deg * Math.PI) / 180
    const voltage = Math.sin(rad)
    const current =
      0.82 * Math.sin(rad - phaseShift) +
      0.16 * Math.sin(5 * rad - phaseShift) +
      0.09 * Math.sin(7 * rad - phaseShift)
    points.push({
      deg,
      voltage: +(voltage * 100).toFixed(2),
      current: +(current * 100).toFixed(2),
    })
  }
  return points
}

export type HarmonicBar = {
  order: string
  k: number
  magnitude: number
  limit: number
  exceeds: boolean
}

// Harmonic spectrum (FFT) — magnitude as % of fundamental, with IEC limits.
const RAW_HARMONICS: { k: number; magnitude: number; limit: number }[] = [
  { k: 1, magnitude: 100, limit: 100 },
  { k: 2, magnitude: 1.2, limit: 2 },
  { k: 3, magnitude: 12.4, limit: 5 },
  { k: 4, magnitude: 0.8, limit: 1 },
  { k: 5, magnitude: 9.1, limit: 6 },
  { k: 6, magnitude: 0.5, limit: 0.5 },
  { k: 7, magnitude: 6.7, limit: 5 },
  { k: 8, magnitude: 0.4, limit: 0.5 },
  { k: 9, magnitude: 7.8, limit: 1.5 },
  { k: 11, magnitude: 3.3, limit: 3.5 },
  { k: 13, magnitude: 2.1, limit: 3 },
  { k: 15, magnitude: 1.4, limit: 0.3 },
  { k: 17, magnitude: 1.1, limit: 2 },
  { k: 19, magnitude: 0.9, limit: 1.5 },
]

export function generateSpectrum(): HarmonicBar[] {
  // Drop the fundamental so the harmonics read clearly.
  return RAW_HARMONICS.filter((h) => h.k > 1).map((h) => ({
    order: `K${h.k}`,
    k: h.k,
    magnitude: h.magnitude,
    limit: h.limit,
    exceeds: h.magnitude > h.limit,
  }))
}

export type MarginRow = {
  label: string
  order: string
  value: number
  limit: number
  margin: number
  critical: boolean
}

export function generateMarginAudit(spectrum: HarmonicBar[]): MarginRow[] {
  return spectrum
    .map((h) => {
      const margin = +(h.limit - h.magnitude).toFixed(1)
      return {
        label: `Harmonic ${h.order}`,
        order: h.order,
        value: h.magnitude,
        limit: h.limit,
        margin,
        critical: margin < 0,
      }
    })
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5)
}

export type AlphaMetric = {
  label: string
  value: string
  unit: string
  sub: string
}

export const ALPHA_METRICS: AlphaMetric[] = [
  { label: 'THDi — Current Distortion', value: '18.4', unit: '%', sub: 'IEC 61000-3-2 ceiling 15%' },
  { label: 'THDv — Voltage Distortion', value: '4.2', unit: '%', sub: 'Within EN 50160 limits' },
]

export type SecondaryStat = {
  label: string
  value: string
  tone: 'neutral' | 'good' | 'critical'
}

export const SECONDARY_STATS: SecondaryStat[] = [
  { label: 'Power Factor', value: '0.91', tone: 'good' },
  { label: 'Crest Factor', value: '1.62', tone: 'neutral' },
  { label: 'K-Factor', value: '4.8', tone: 'critical' },
  { label: 'Frequency', value: '50.01 Hz', tone: 'good' },
]
