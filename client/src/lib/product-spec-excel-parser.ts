import type { CellValue, Workbook, Worksheet } from 'exceljs';

const PX_PER_COLUMN_UNIT = 8;
const PX_PER_POINT = 96 / 72;
const DEFAULT_ROW_HEIGHT_PT = 15;

const THEME_COLOR_MAP: Record<number, string> = {
  0: '#ffffff',
  1: '#000000',
  2: '#eeece1',
  3: '#1f497d',
  4: '#4f81bd',
  5: '#c0504d',
  6: '#9bbb59',
  7: '#8064a2',
  8: '#4bacc6',
  9: '#f79646',
};

const INDEXED_COLOR_MAP: Record<number, string> = {
  8: '#7a7a7a',
};

const KEY_FACT_MAPPINGS = [
  { label: 'SKU', anchor: '产品编号sku' },
  { label: 'SPU', anchor: '产品编码spu' },
  { label: '产品类型', anchor: '产品类型' },
  { label: '规格描述', anchor: '规格描述' },
  { label: '海关编码', anchor: '海关编码' },
  { label: '报关中文品名', anchor: '报关中文品名' },
  { label: '认证要求', anchor: '认证要求' },
] as const;

const RESERVED_ANCHORS: Set<string> = new Set(KEY_FACT_MAPPINGS.map((item) => item.anchor));

export interface ProductSpecFact {
  label: string;
  value: string;
}

export interface ProductSpecPreviewCellBorder {
  style: string;
  color?: string;
}

export interface ProductSpecPreviewCellStyle {
  backgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSizePx?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  horizontal?: string;
  vertical?: string;
  wrapText?: boolean;
  textRotation?: number | 'vertical';
  borderTop?: ProductSpecPreviewCellBorder;
  borderRight?: ProductSpecPreviewCellBorder;
  borderBottom?: ProductSpecPreviewCellBorder;
  borderLeft?: ProductSpecPreviewCellBorder;
}

export interface ProductSpecPreviewCell {
  id: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  style: ProductSpecPreviewCellStyle;
}

export interface ProductSpecPreviewImage {
  id: string;
  src: string;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
}

export interface ProductSpecPreviewColumn {
  index: number;
  widthPx: number;
}

export interface ProductSpecPreviewRow {
  index: number;
  heightPx: number;
}

export interface ProductSpecWorkbookPreview {
  fileName: string;
  sheetName: string;
  sheetWidthPx: number;
  sheetHeightPx: number;
  columns: ProductSpecPreviewColumn[];
  rows: ProductSpecPreviewRow[];
  cells: ProductSpecPreviewCell[];
  images: ProductSpecPreviewImage[];
  facts: ProductSpecFact[];
  metadata: {
    rowCount: number;
    columnCount: number;
    mergeCount: number;
    imageCount: number;
    highlightCount: number;
  };
}

export interface ProductSpecCellTextOverride {
  cellId: string;
  text: string;
}

interface ParsedMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

interface WorkbookMedia {
  index?: number;
  buffer?: ArrayBuffer | Uint8Array;
  extension?: string;
}

const RENDERABLE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

interface CellColorModel {
  argb?: string;
  theme?: number;
  indexed?: number;
}

interface CellBorderEdgeModel {
  style?: string;
  color?: CellColorModel;
}

interface CellBorderModel {
  top?: CellBorderEdgeModel;
  right?: CellBorderEdgeModel;
  bottom?: CellBorderEdgeModel;
  left?: CellBorderEdgeModel;
}

interface CellFillModel {
  type?: string;
  pattern?: string;
  fgColor?: CellColorModel;
}

interface CellFontModel {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | string;
  color?: CellColorModel;
}

interface CellAlignmentModel {
  horizontal?: string;
  vertical?: string;
  wrapText?: boolean;
  textRotation?: number | 'vertical';
}

interface ImageRangeModel {
  tl: { col: number; row: number };
  br?: { col: number; row: number };
  ext?: { width: number; height: number };
}

export async function parseProductSpecWorkbook(file: File): Promise<ProductSpecWorkbookPreview> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = selectBestWorksheet(workbook, file.name);
  if (!worksheet) {
    throw new Error('解析失败：未找到可用工作表。');
  }

  const mergeRanges = getMergeRanges(worksheet);
  const mergeTopLeftMap = new Map<string, ParsedMergeRange>();
  const mergedChildren = new Set<string>();

  for (const range of mergeRanges) {
    mergeTopLeftMap.set(cellKey(range.startRow, range.startCol), range);
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      for (let col = range.startCol; col <= range.endCol; col += 1) {
        if (row === range.startRow && col === range.startCol) continue;
        mergedChildren.add(cellKey(row, col));
      }
    }
  }

  const rawColumns = Array.from({ length: worksheet.columnCount }, (_, index) => ({
    index: index + 1,
    widthPx: columnWidthToPx(worksheet.getColumn(index + 1).width),
  }));
  const rawRows = Array.from({ length: worksheet.rowCount }, (_, index) => ({
    index: index + 1,
    heightPx: rowHeightToPx(worksheet.getRow(index + 1).height),
  }));

  const cells: ProductSpecPreviewCell[] = [];
  let maxVisibleRow = 1;
  let maxVisibleCol = 1;
  let highlightCount = 0;

  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let colIndex = 1; colIndex <= worksheet.columnCount; colIndex += 1) {
      if (mergedChildren.has(cellKey(rowIndex, colIndex))) continue;

      const cell = row.getCell(colIndex);
      const mergeRange = mergeTopLeftMap.get(cellKey(rowIndex, colIndex));
      const rowSpan = mergeRange ? mergeRange.endRow - mergeRange.startRow + 1 : 1;
      const colSpan = mergeRange ? mergeRange.endCol - mergeRange.startCol + 1 : 1;
      const style = normalizeCellStyle(
        cell.fill as CellFillModel | undefined,
        cell.font as CellFontModel | undefined,
        cell.alignment as CellAlignmentModel | undefined,
        cell.border as CellBorderModel | undefined,
      );
      const text = getCellText(cell.value);

      if (!shouldRenderCell(text, style, rowSpan, colSpan)) {
        continue;
      }

      if (style.backgroundColor === '#ffff00') {
        highlightCount += 1;
      }

      cells.push({
        id: `${rowIndex}:${colIndex}`,
        row: rowIndex,
        col: colIndex,
        rowSpan,
        colSpan,
        text,
        style,
      });

      maxVisibleRow = Math.max(maxVisibleRow, rowIndex + rowSpan - 1);
      maxVisibleCol = Math.max(maxVisibleCol, colIndex + colSpan - 1);
    }
  }

  const images = getWorksheetImages(workbook, worksheet, rawColumns, rawRows);
  for (const image of images) {
    const imageBottomRow = findRowIndexAtOffset(rawRows, image.topPx + image.heightPx);
    const imageRightCol = findColumnIndexAtOffset(rawColumns, image.leftPx + image.widthPx);
    maxVisibleRow = Math.max(maxVisibleRow, imageBottomRow);
    maxVisibleCol = Math.max(maxVisibleCol, imageRightCol);
  }

  const columns = rawColumns.slice(0, maxVisibleCol);
  const rows = rawRows.slice(0, maxVisibleRow);
  const sheetWidthPx = columns.reduce((total, column) => total + column.widthPx, 0);
  const sheetHeightPx = rows.reduce((total, row) => total + row.heightPx, 0);

  const textGrid = buildExpandedTextGrid(worksheet, mergeRanges, maxVisibleRow, maxVisibleCol);
  const facts = KEY_FACT_MAPPINGS
    .map((mapping) => ({
      label: mapping.label,
      value: findValueByAnchor(textGrid, mapping.anchor),
    }))
    .filter((fact) => fact.value);

  return {
    fileName: file.name,
    sheetName: worksheet.name,
    sheetWidthPx,
    sheetHeightPx,
    columns,
    rows,
    cells: cells.filter((cell) => cell.row <= maxVisibleRow && cell.col <= maxVisibleCol),
    images,
    facts,
    metadata: {
      rowCount: maxVisibleRow,
      columnCount: maxVisibleCol,
      mergeCount: mergeRanges.length,
      imageCount: images.length,
      highlightCount,
    },
  };
}

export function deriveProductSpecFacts(
  preview: ProductSpecWorkbookPreview,
  overrides: ProductSpecCellTextOverride[] = [],
): ProductSpecFact[] {
  const overrideMap = new Map(overrides.map((item) => [item.cellId, item.text]));
  const grid = Array.from({ length: preview.metadata.rowCount }, () =>
    Array.from({ length: preview.metadata.columnCount }, () => ''),
  );

  for (const cell of preview.cells) {
    const text = cleanText(overrideMap.get(cell.id) ?? cell.text);
    for (let row = cell.row; row < cell.row + cell.rowSpan; row += 1) {
      for (let col = cell.col; col < cell.col + cell.colSpan; col += 1) {
        if (!grid[row - 1] || typeof grid[row - 1][col - 1] === 'undefined') continue;
        grid[row - 1][col - 1] = text;
      }
    }
  }

  return KEY_FACT_MAPPINGS
    .map((mapping) => ({
      label: mapping.label,
      value: findValueByAnchor(grid, mapping.anchor),
    }))
    .filter((fact) => fact.value);
}

function getMergeRanges(worksheet: Worksheet): ParsedMergeRange[] {
  const mergeRefs = ((worksheet.model as { merges?: string[] } | undefined)?.merges ?? []).filter(Boolean);
  return mergeRefs.map(parseRangeRef);
}

function parseRangeRef(rangeRef: string): ParsedMergeRange {
  const [startRef, endRef] = rangeRef.includes(':') ? rangeRef.split(':') : [rangeRef, rangeRef];
  const start = decodeCellRef(startRef);
  const end = decodeCellRef(endRef);
  return {
    startRow: start.row,
    endRow: end.row,
    startCol: start.col,
    endCol: end.col,
  };
}

function decodeCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    return { row: 1, col: 1 };
  }

  const [, letters, rowText] = match;
  let col = 0;
  for (const char of letters.toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }

  return {
    row: Number.parseInt(rowText, 10),
    col,
  };
}

function buildExpandedTextGrid(
  worksheet: Worksheet,
  mergeRanges: ParsedMergeRange[],
  rowCount: number,
  columnCount: number,
): string[][] {
  const grid = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''));

  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    for (let colIndex = 1; colIndex <= columnCount; colIndex += 1) {
      grid[rowIndex - 1][colIndex - 1] = getCellText(row.getCell(colIndex).value);
    }
  }

  for (const range of mergeRanges) {
    const value = grid[range.startRow - 1]?.[range.startCol - 1] ?? '';
    for (let row = range.startRow; row <= Math.min(range.endRow, rowCount); row += 1) {
      for (let col = range.startCol; col <= Math.min(range.endCol, columnCount); col += 1) {
        grid[row - 1][col - 1] = grid[row - 1][col - 1] || value;
      }
    }
  }

  return grid;
}

function findValueByAnchor(grid: string[][], normalizedAnchor: string): string {
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cellText = row[colIndex];
      if (!cellText) continue;
      if (!normalizeSearchText(cellText).includes(normalizedAnchor)) continue;

      const inlineValue = extractInlineValue(cellText);
      if (inlineValue) return inlineValue;

      const sameRowValue = findCandidateValue(row, normalizedAnchor, colIndex + 1, row.length);
      if (sameRowValue) return sameRowValue;

      for (let nextRow = rowIndex + 1; nextRow < Math.min(grid.length, rowIndex + 3); nextRow += 1) {
        const candidateRow = grid[nextRow];
        const downRowValue = findCandidateValue(
          candidateRow,
          normalizedAnchor,
          colIndex,
          Math.min(candidateRow.length, colIndex + 3),
        );
        if (downRowValue) return downRowValue;
      }
    }
  }

  return '';
}

function findCandidateValue(
  row: string[],
  currentAnchor: string,
  startCol: number,
  endCol: number,
): string {
  for (let colIndex = startCol; colIndex < endCol; colIndex += 1) {
    const candidate = cleanText(row[colIndex]);
    if (!candidate) continue;

    const normalizedCandidate = normalizeSearchText(candidate);
    if (!normalizedCandidate) continue;
    if (normalizedCandidate.includes(currentAnchor)) continue;
    if (RESERVED_ANCHORS.has(normalizedCandidate)) continue;
    return candidate;
  }

  return '';
}

function extractInlineValue(text: string): string {
  const parts = text.split(/[：:]/);
  if (parts.length <= 1) return '';
  return cleanText(parts.slice(1).join(':'));
}

function normalizeSearchText(text: string): string {
  return text.replace(/\s+/g, '').replace(/[()（）:：]/g, '').toLowerCase();
}

function normalizeCellStyle(
  fill?: CellFillModel,
  font?: CellFontModel,
  alignment?: CellAlignmentModel,
  border?: CellBorderModel,
): ProductSpecPreviewCellStyle {
  return {
    backgroundColor: resolveFillColor(fill),
    color: resolveColor(font?.color) ?? undefined,
    fontFamily: font?.name ?? undefined,
    fontSizePx: typeof font?.size === 'number' ? round(font.size * PX_PER_POINT) : undefined,
    fontWeight: font?.bold ? 700 : 400,
    fontStyle: font?.italic ? 'italic' : 'normal',
    textDecoration: font?.underline ? 'underline' : undefined,
    horizontal: alignment?.horizontal ?? undefined,
    vertical: alignment?.vertical ?? undefined,
    wrapText: alignment?.wrapText ?? false,
    textRotation: alignment?.textRotation ?? undefined,
    borderTop: normalizeBorderEdge(border?.top),
    borderRight: normalizeBorderEdge(border?.right),
    borderBottom: normalizeBorderEdge(border?.bottom),
    borderLeft: normalizeBorderEdge(border?.left),
  };
}

function normalizeBorderEdge(
  edge?: CellBorderEdgeModel,
): ProductSpecPreviewCellBorder | undefined {
  if (!edge?.style) return undefined;
  return {
    style: edge.style,
    color: resolveColor(edge.color) ?? '#666666',
  };
}

function resolveFillColor(fill?: CellFillModel): string | undefined {
  if (!fill || fill.type !== 'pattern') return undefined;
  if (fill.pattern !== 'solid') return undefined;
  return resolveColor(fill.fgColor) ?? undefined;
}

function resolveColor(color?: { argb?: string; theme?: number; indexed?: number }): string | null {
  if (!color) return null;
  if (color.argb) {
    const hex = color.argb.slice(-6).toLowerCase();
    return `#${hex}`;
  }
  if (typeof color.theme === 'number') {
    return THEME_COLOR_MAP[color.theme] ?? null;
  }
  if (typeof color.indexed === 'number') {
    return INDEXED_COLOR_MAP[color.indexed] ?? null;
  }
  return null;
}

function shouldRenderCell(
  text: string,
  style: ProductSpecPreviewCellStyle,
  rowSpan: number,
  colSpan: number,
): boolean {
  return Boolean(
    text ||
      style.backgroundColor ||
      style.borderTop ||
      style.borderRight ||
      style.borderBottom ||
      style.borderLeft ||
      rowSpan > 1 ||
      colSpan > 1,
  );
}

function getWorksheetImages(
  workbook: Workbook,
  worksheet: Worksheet,
  columns: ProductSpecPreviewColumn[],
  rows: ProductSpecPreviewRow[],
): ProductSpecPreviewImage[] {
  const media = getWorkbookMedia(workbook);
  const anchoredImages = worksheet
    .getImages()
    .map((image, index) => {
      const linkedMedia = media.find((item) => Number(item.index) === Number(image.imageId));
      if (!linkedMedia?.buffer || !linkedMedia.extension) return null;

      const range = image.range as unknown as ImageRangeModel;
      const leftPx = getAbsoluteOffsetPx(columns, range.tl.col);
      const topPx = getAbsoluteOffsetPx(rows, range.tl.row);

      const widthPx =
        range.ext?.width ??
        Math.max(24, getAbsoluteOffsetPx(columns, range.br?.col ?? range.tl.col) - leftPx);
      const heightPx =
        range.ext?.height ??
        Math.max(24, getAbsoluteOffsetPx(rows, range.br?.row ?? range.tl.row) - topPx);

      return {
        id: `image-${index}`,
        src: buildImageDataUrl(linkedMedia),
        leftPx: round(leftPx),
        topPx: round(topPx),
        widthPx: round(widthPx),
        heightPx: round(heightPx),
      };
    })
    .filter((image): image is ProductSpecPreviewImage => Boolean(image));

  if (anchoredImages.length > 0) {
    return anchoredImages;
  }

  const fallbackMedia = media
    .filter((item) => isRenderableWorkbookMedia(item))
    .sort((left, right) => getWorkbookMediaByteLength(right) - getWorkbookMediaByteLength(left))[0];
  if (!fallbackMedia) {
    return [];
  }

  const fallbackSrc = buildImageDataUrl(fallbackMedia);
  if (!fallbackSrc) {
    return [];
  }

  return [
    {
      id: 'image-fallback-0',
      src: fallbackSrc,
      leftPx: 0,
      topPx: 0,
      widthPx: 160,
      heightPx: 160,
    },
  ];
}

function getWorkbookMedia(workbook: Workbook): WorkbookMedia[] {
  const model = workbook.model as { media?: WorkbookMedia[] } | undefined;
  return model?.media ?? [];
}

function isRenderableWorkbookMedia(media: WorkbookMedia): boolean {
  const extension = (media.extension || '').toLowerCase();
  return Boolean(media.buffer) && RENDERABLE_IMAGE_EXTENSIONS.has(extension);
}

function getWorkbookMediaByteLength(media: WorkbookMedia): number {
  if (media.buffer instanceof Uint8Array) {
    return media.buffer.byteLength;
  }
  if (media.buffer instanceof ArrayBuffer) {
    return media.buffer.byteLength;
  }
  return 0;
}

function buildImageDataUrl(media: WorkbookMedia): string {
  const extension = (media.extension || 'png').toLowerCase();
  const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
  const bytes = media.buffer instanceof Uint8Array ? media.buffer : media.buffer ? new Uint8Array(media.buffer) : null;
  if (!bytes) {
    return '';
  }
  const base64 = bytesToBase64(bytes);
  return `data:${mimeType};base64,${base64}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getAbsoluteOffsetPx(
  sizes: Array<{ widthPx?: number; heightPx?: number }>,
  position: number,
): number {
  if (position <= 0) return 0;
  const whole = Math.floor(position);
  const fraction = position - whole;
  let offset = 0;

  for (let index = 0; index < whole; index += 1) {
    offset += sizes[index]?.widthPx ?? sizes[index]?.heightPx ?? 0;
  }

  const currentSize = sizes[whole]?.widthPx ?? sizes[whole]?.heightPx ?? 0;
  return offset + currentSize * fraction;
}

function findRowIndexAtOffset(rows: ProductSpecPreviewRow[], offsetPx: number): number {
  let acc = 0;
  for (const row of rows) {
    acc += row.heightPx;
    if (offsetPx <= acc) return row.index;
  }
  return rows.length;
}

function findColumnIndexAtOffset(columns: ProductSpecPreviewColumn[], offsetPx: number): number {
  let acc = 0;
  for (const column of columns) {
    acc += column.widthPx;
    if (offsetPx <= acc) return column.index;
  }
  return columns.length;
}

function getCellText(value: CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanText(String(value));
  }
  if (value instanceof Date) {
    return cleanText(value.toISOString().slice(0, 10));
  }
  if (Array.isArray(value)) {
    return cleanText(value.map((item) => getCellText(item as CellValue)).join(' '));
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return cleanText(value.richText.map((part) => part.text || '').join(''));
    }
    if ('text' in value && typeof value.text === 'string') {
      return cleanText(value.text);
    }
    if ('result' in value && value.result != null) {
      return cleanText(String(value.result));
    }
    if ('formula' in value && typeof value.formula === 'string') {
      return cleanText(value.formula);
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') {
      return cleanText(value.hyperlink);
    }
  }
  return cleanText(String(value));
}

function cleanText(text: string): string {
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

function columnWidthToPx(width?: number): number {
  if (!width || !Number.isFinite(width)) return 72;
  return round(Math.max(48, width * PX_PER_COLUMN_UNIT));
}

function rowHeightToPx(height?: number): number {
  return round((height || DEFAULT_ROW_HEIGHT_PT) * PX_PER_POINT);
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeWorksheetComparable(value: string): string {
  return (value || '')
    .replace(/\.[^.]+$/u, '')
    .replace(/规格书[\d.\-]*/giu, '')
    .replace(/[（）()【】\[\]_\s]/gu, '')
    .toLowerCase();
}

function scoreWorksheet(worksheet: Worksheet, fileName: string): number {
  const normalizedFileName = normalizeWorksheetComparable(fileName);
  const sheetName = normalizeWorksheetComparable(worksheet.name || '');
  const title = normalizeWorksheetComparable(getCellText(worksheet.getCell('A1').value));
  const sku = normalizeWorksheetComparable(getCellText(worksheet.getCell('C3').value));
  const spu = normalizeWorksheetComparable(getCellText(worksheet.getCell('G3').value));
  const description = normalizeWorksheetComparable(getCellText(worksheet.getCell('C4').value));
  const productType = normalizeWorksheetComparable(getCellText(worksheet.getCell('G2').value));

  let score = 0;

  if (sheetName && normalizedFileName.includes(sheetName)) score += 80;
  if (sku && normalizedFileName.includes(sku)) score += 90;
  if (spu && normalizedFileName.includes(spu)) score += 35;
  if (title.includes('产品规格资料')) score += 10;
  if (productType) score += 10;
  if (description && !description.includes('包装信息')) score += 40;
  if (sku && spu && sku !== spu) score += 15;

  if (!sku) score -= 50;
  if (!description || description.includes('包装信息')) score -= 60;
  if (/^\d+w$/iu.test((worksheet.name || '').trim())) score -= 40;

  return score;
}

function selectBestWorksheet(workbook: Workbook, fileName: string): Worksheet | undefined {
  const visibleWorksheets = workbook.worksheets.filter((worksheet) => worksheet.state !== 'hidden');
  const candidateWorksheets = visibleWorksheets.length > 0 ? visibleWorksheets : [];

  if (candidateWorksheets.length <= 1) {
    return candidateWorksheets[0] ?? workbook.worksheets[0];
  }

  let bestWorksheet = candidateWorksheets[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const worksheet of candidateWorksheets) {
    const score = scoreWorksheet(worksheet, fileName);
    if (score > bestScore) {
      bestScore = score;
      bestWorksheet = worksheet;
    }
  }

  return bestWorksheet;
}
