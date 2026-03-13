import { useState, useMemo } from 'react';

export type MaterialType = 'PC/ABS' | 'POM/PA' | 'PP/PE';

export interface VDIData {
  level: number;
  ra: number;
  glossRange: [number, number];
  glossPercent: number;
  draft: number;        // base draft angle (PC/ABS baseline)
  textureClass: 'mirror' | 'high-gloss' | 'semi-matte' | 'matte' | 'rough';
  isCustom?: boolean;
}

const MATERIAL_COEFFICIENTS: Record<MaterialType, number> = {
  'PC/ABS': 1.0,
  'POM/PA': 0.85,
  'PP/PE': 0.6,
};

/** Static reference data — never changes */
export const BASE_VDI_DATA: VDIData[] = [
  { level: 12, ra: 0.4,  glossRange: [75, 95], glossPercent: 95, draft: 0.5, textureClass: 'mirror' },
  { level: 18, ra: 1.6,  glossRange: [40, 70], glossPercent: 75, draft: 1.5, textureClass: 'high-gloss' },
  { level: 24, ra: 3.2,  glossRange: [20, 40], glossPercent: 50, draft: 2.0, textureClass: 'semi-matte' },
  { level: 30, ra: 6.3,  glossRange: [10, 25], glossPercent: 30, draft: 3.0, textureClass: 'matte' },
  { level: 36, ra: 12.5, glossRange: [3, 10],  glossPercent: 10, draft: 4.0, textureClass: 'rough' },
];

/** Ra = 0.1 × 10^(VDI/20) */
function vdiToRa(vdi: number): number {
  return 0.1 * Math.pow(10, vdi / 20);
}

/** Linear interpolation helper */
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function classifyTexture(vdi: number): VDIData['textureClass'] {
  if (vdi <= 14) return 'mirror';
  if (vdi <= 20) return 'high-gloss';
  if (vdi <= 27) return 'semi-matte';
  if (vdi <= 33) return 'matte';
  return 'rough';
}

/** Interpolate gloss & draft from known data points */
function interpolateFromVDI(vdi: number): Omit<VDIData, 'level' | 'ra' | 'textureClass' | 'isCustom'> {
  const pts = BASE_VDI_DATA;

  // Clamp to range
  if (vdi <= pts[0].level) {
    return { glossRange: pts[0].glossRange, glossPercent: pts[0].glossPercent, draft: pts[0].draft };
  }
  if (vdi >= pts[pts.length - 1].level) {
    return { glossRange: pts[pts.length - 1].glossRange, glossPercent: pts[pts.length - 1].glossPercent, draft: pts[pts.length - 1].draft };
  }

  // Find surrounding points
  let lo = pts[0], hi = pts[1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (vdi >= pts[i].level && vdi <= pts[i + 1].level) {
      lo = pts[i]; hi = pts[i + 1]; break;
    }
  }

  const glossLow = Math.round(lerp(vdi, lo.level, hi.level, lo.glossRange[0], hi.glossRange[0]));
  const glossHigh = Math.round(lerp(vdi, lo.level, hi.level, lo.glossRange[1], hi.glossRange[1]));
  const glossPercent = Math.round(lerp(vdi, lo.level, hi.level, lo.glossPercent, hi.glossPercent));
  const draft = parseFloat(lerp(vdi, lo.level, hi.level, lo.draft, hi.draft).toFixed(1));

  return { glossRange: [glossLow, glossHigh], glossPercent, draft };
}

export function useVDICalculator() {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialType>('PC/ABS');
  const [searchTerm, setSearchTerm] = useState('');

  const coefficient = MATERIAL_COEFFICIENTS[selectedMaterial];

  /** Apply material coefficient to a base draft angle */
  const adjustDraft = (baseDraft: number) => parseFloat((baseDraft * coefficient).toFixed(1));

  /** Build custom card from arbitrary VDI input */
  const customCard = useMemo<VDIData | null>(() => {
    const num = parseFloat(searchTerm);
    if (isNaN(num) || num < 1 || num > 50) return null;
    // Skip if it exactly matches an existing level
    if (BASE_VDI_DATA.some(d => d.level === num)) return null;

    const ra = parseFloat(vdiToRa(num).toFixed(2));
    const interp = interpolateFromVDI(num);

    return {
      level: num,
      ra,
      glossRange: interp.glossRange,
      glossPercent: interp.glossPercent,
      draft: interp.draft,
      textureClass: classifyTexture(num),
      isCustom: true,
    };
  }, [searchTerm]);

  /** Filtered static cards (always show all, search only triggers custom) */
  const cards = useMemo(() => {
    return BASE_VDI_DATA;
  }, []);

  return {
    selectedMaterial,
    setSelectedMaterial,
    searchTerm,
    setSearchTerm,
    coefficient,
    adjustDraft,
    customCard,
    cards,
  };
}
