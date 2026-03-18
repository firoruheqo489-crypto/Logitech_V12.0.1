export type SurfaceParseSummary = {
  totalRows: number;
  ngRows: number;
  qualifiedRows: number;
  qualifiedRate: number | null;
};

export type SurfaceSectionMeta = {
  title: string;
  standard: string;
  placement: string;
};

export type RoughnessRow = {
  cavity: string;
  frontRa: number | null;
  frontRpc: number | null;
  frontJudge: string;
  backRa: number | null;
  backRpc: number | null;
  backJudge: string;
  isNG: boolean;
};

export type SurfaceValueRow = {
  cavity: string;
  frontVal: number | null;
  frontJudge: string;
  backVal: number | null;
  backJudge: string;
  isNG: boolean;
};

export type SurfaceParseResult = {
  roughnessMeta: SurfaceSectionMeta;
  glossMeta: SurfaceSectionMeta;
  colorMeta: SurfaceSectionMeta;
  roughnessData: RoughnessRow[];
  glossData: SurfaceValueRow[];
  colorData: SurfaceValueRow[];
  roughnessSummary: SurfaceParseSummary;
  glossSummary: SurfaceParseSummary;
  colorSummary: SurfaceParseSummary;
};

const EMPTY_META_PLACEHOLDER: SurfaceSectionMeta = {
  title: '--',
  standard: '--',
  placement: '--',
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function joinRowText(row: unknown[] = []): string {
  return row
    .map((cell) => String(cell ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function hasCellValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text.replace(/,/g, '').replace(/[^\d.+-]/g, '');
  if (!normalized || normalized === '+' || normalized === '-' || normalized === '.') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeJudge(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function findRequiredIndex(headers: unknown[], matcher: (header: string) => boolean, label: string): number {
  const index = headers.findIndex((cell) => matcher(normalizeHeader(cell)));
  if (index < 0) {
    throw new Error(`Missing required column: ${label}`);
  }

  return index;
}

function findSurfaceAnchorIndexes(rows: unknown[][]): number[] {
  return rows.reduce<number[]>((indexes, row, index) => {
    const firstCell = normalizeHeader(row?.[0]);
    if (firstCell.includes('模具穴号')) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

function buildSectionMeta(rows: unknown[][], anchorIndex: number, previousBoundary: number): SurfaceSectionMeta {
  const contextRows = rows
    .slice(previousBoundary, anchorIndex)
    .map((row) => joinRowText(row))
    .filter(Boolean)
    .slice(-3);

  return {
    title: contextRows[0] || '--',
    standard: contextRows[1] || '--',
    placement: contextRows[2] || '--',
  };
}

function buildSummary<T extends { isNG: boolean }>(rows: T[]): SurfaceParseSummary {
  const totalRows = rows.length;
  const ngRows = rows.filter((row) => row.isNG).length;
  const qualifiedRows = totalRows - ngRows;

  return {
    totalRows,
    ngRows,
    qualifiedRows,
    qualifiedRate: totalRows > 0 ? Number(((qualifiedRows / totalRows) * 100).toFixed(2)) : null,
  };
}

function extractBlockRows(
  rows: unknown[][],
  headerIndex: number,
  nextHeaderIndex?: number,
): unknown[][] {
  const block: unknown[][] = [];
  const limit = nextHeaderIndex ?? rows.length;

  for (let index = headerIndex + 1; index < limit; index += 1) {
    const row = rows[index] ?? [];
    const firstCell = String(row[0] ?? '').trim();

    if (!firstCell || firstCell.startsWith('#') || firstCell.includes('测试')) {
      continue;
    }

    block.push(row);
  }

  return block;
}

function parseRoughnessBlock(rows: unknown[][]): RoughnessRow[] {
  return rows
    .filter((row) => hasCellValue(row[0]))
    .map((row) => {
      const frontJudge = normalizeJudge(row[3]);
      const backJudge = normalizeJudge(row[6]);

      return {
        cavity: String(row[0] ?? '').trim(),
        frontRa: coerceNumber(row[1]),
        frontRpc: coerceNumber(row[2]),
        frontJudge,
        backRa: coerceNumber(row[4]),
        backRpc: coerceNumber(row[5]),
        backJudge,
        isNG: frontJudge.includes('NG') || backJudge.includes('NG'),
      };
    });
}

function parseValueBlock(rows: unknown[][]): SurfaceValueRow[] {
  return rows
    .filter((row) => hasCellValue(row[0]))
    .map((row) => {
      const frontJudge = normalizeJudge(row[2]);
      const backJudge = normalizeJudge(row[4]);

      return {
        cavity: String(row[0] ?? '').trim(),
        frontVal: coerceNumber(row[1]),
        frontJudge,
        backVal: coerceNumber(row[3]),
        backJudge,
        isNG: frontJudge.includes('NG') || backJudge.includes('NG'),
      };
    });
}

export function parseSurfaceSheetRows(rows: unknown[][]): SurfaceParseResult {
  const anchorIndexes = findSurfaceAnchorIndexes(rows);
  const [roughnessAnchor, glossAnchor, colorAnchor] = anchorIndexes;

  if (anchorIndexes.length < 3) {
    console.warn('未能找到完整的3个测试模块锚点，请检查表格格式。');
  }

  const roughnessBlock = roughnessAnchor !== undefined
    ? extractBlockRows(rows, roughnessAnchor, glossAnchor)
    : [];
  const glossBlock = glossAnchor !== undefined
    ? extractBlockRows(rows, glossAnchor, colorAnchor)
    : [];
  const colorBlock = colorAnchor !== undefined
    ? extractBlockRows(rows, colorAnchor)
    : [];

  const roughnessData = roughnessBlock.length > 0 ? parseRoughnessBlock(roughnessBlock) : [];
  const glossData = glossBlock.length > 0 ? parseValueBlock(glossBlock) : [];
  const colorData = colorBlock.length > 0 ? parseValueBlock(colorBlock) : [];

  return {
    roughnessMeta: roughnessAnchor !== undefined ? buildSectionMeta(rows, roughnessAnchor, 0) : { ...EMPTY_META_PLACEHOLDER },
    glossMeta: glossAnchor !== undefined
      ? buildSectionMeta(rows, glossAnchor, (roughnessAnchor ?? 0) + 1)
      : { ...EMPTY_META_PLACEHOLDER },
    colorMeta: colorAnchor !== undefined
      ? buildSectionMeta(rows, colorAnchor, (glossAnchor ?? roughnessAnchor ?? 0) + 1)
      : { ...EMPTY_META_PLACEHOLDER },
    roughnessData,
    glossData,
    colorData,
    roughnessSummary: buildSummary(roughnessData),
    glossSummary: buildSummary(glossData),
    colorSummary: buildSummary(colorData),
  };
}
