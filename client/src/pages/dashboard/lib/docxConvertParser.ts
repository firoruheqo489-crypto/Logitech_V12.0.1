import JSZip from 'jszip';

export type ParsedImage = {
  base64: string;
  mimeType: string;
  extension: string;
};

export type ParsedCell = {
  text: string;
  images: ParsedImage[];
};

export type ParsedRow = ParsedCell[];

export type ParseProgress = {
  stage: 'unzipping' | 'parsing-xml' | 'extracting-images' | 'rendering' | 'done';
  message: string;
  progress: number;
};

export type ParseResult = {
  headers: string[];
  rows: ParsedRow[];
  columnCount: number;
};

const EXPECTED_HEADERS = [
  'No.',
  'Issue Description',
  'Pictures',
  'Root Cause',
  'Solution',
  'Owner',
  'Due-Date',
  'Status',
  'Reference Link',
];

const HEADER_ALIAS_RULES: Array<{ canonicalIndex: number; patterns: RegExp[] }> = [
  { canonicalIndex: 0, patterns: [/^no\b/i, /序号|编号|項次|no\./i] },
  { canonicalIndex: 1, patterns: [/issue|description/i, /问题|異常|不良|描述|现象/i] },
  { canonicalIndex: 2, patterns: [/picture|photo|image/i, /图片|照片|图像/i] },
  { canonicalIndex: 3, patterns: [/root\s*cause|cause/i, /根因|原因/i] },
  { canonicalIndex: 4, patterns: [/solution|action/i, /对策|措施|改善|方案/i] },
  { canonicalIndex: 5, patterns: [/owner|pic|assignee/i, /负责人|责任人|担当/i] },
  { canonicalIndex: 6, patterns: [/due|date|deadline/i, /截止|日期|完成时间|完成日期/i] },
  { canonicalIndex: 7, patterns: [/status|open|close/i, /状态|开|关|已关闭|待关闭/i] },
  { canonicalIndex: 8, patterns: [/reference|link|url/i, /参考|链接|备注/i] },
];

type HeaderCandidate = {
  table: Element;
  headerRowIndex: number;
  headers: string[];
  score: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getMimeType(ext: string): string {
  const value = ext.toLowerCase().replace('.', '');
  switch (value) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const parser = new DOMParser();
  const doc = parser.parseFromString(relsXml, 'application/xml');
  const rels = doc.getElementsByTagName('Relationship');

  for (let i = 0; i < rels.length; i += 1) {
    const rel = rels[i];
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    const type = rel.getAttribute('Type') || '';
    if (!id || !target || !type.includes('image')) {
      continue;
    }
    const normalized = target.startsWith('/') ? target.slice(1) : `word/${target}`;
    map.set(id, normalized);
  }

  return map;
}

function collectText(node: Element): string {
  const parts: string[] = [];
  const walk = (el: Element) => {
    const local = el.localName;
    if (local === 't') {
      parts.push(el.textContent || '');
      return;
    }
    if (local === 'tab') {
      parts.push('\t');
      return;
    }
    if (local === 'br') {
      parts.push('\n');
      return;
    }
    for (let i = 0; i < el.children.length; i += 1) {
      walk(el.children[i]);
    }
  };

  walk(node);
  return parts.join('');
}

function collectTextWithParagraphs(node: Element): string {
  const pNodes = node.getElementsByTagNameNS('*', 'p');
  if (pNodes.length === 0) {
    return collectText(node).trim();
  }

  const lines: string[] = [];
  for (let i = 0; i < pNodes.length; i += 1) {
    const line = collectText(pNodes[i]).trim();
    if (line) {
      lines.push(line);
    }
  }
  return lines.join('\n');
}

function collectImageRelIds(cell: Element): string[] {
  const ids: string[] = [];
  const blips = cell.getElementsByTagNameNS('*', 'blip');
  for (let i = 0; i < blips.length; i += 1) {
    const embed =
      blips[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ||
      blips[i].getAttribute('r:embed');
    if (embed) {
      ids.push(embed);
    }
  }

  const imageData = cell.getElementsByTagNameNS('*', 'imagedata');
  for (let i = 0; i < imageData.length; i += 1) {
    const rid =
      imageData[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
      imageData[i].getAttribute('r:id');
    if (rid) {
      ids.push(rid);
    }
  }

  return ids;
}

function getGridSpan(cell: Element): number {
  const spans = cell.getElementsByTagNameNS('*', 'gridSpan');
  if (spans.length === 0) {
    return 1;
  }

  const value =
    spans[0].getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val') ||
    spans[0].getAttribute('w:val');
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function expandHeaderTexts(cells: Element[]): string[] {
  const texts: string[] = [];
  for (const cell of cells) {
    const span = getGridSpan(cell);
    const text = collectTextWithParagraphs(cell).trim();
    for (let step = 0; step < span; step += 1) {
      texts.push(text);
    }
  }
  return texts;
}

function normalizeHeaderToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[：:]/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesHeaderAlias(value: string, canonicalIndex: number): boolean {
  const normalized = normalizeHeaderToken(value);
  if (!normalized) {
    return false;
  }

  const rule = HEADER_ALIAS_RULES.find((item) => item.canonicalIndex === canonicalIndex);
  if (!rule) {
    return false;
  }
  return rule.patterns.some((pattern) => pattern.test(normalized));
}

function scoreHeaderRow(headers: string[]): number {
  if (headers.length < 7) {
    return 0;
  }

  let score = 0;
  for (let index = 0; index < EXPECTED_HEADERS.length; index += 1) {
    if (headers.some((header) => matchesHeaderAlias(header, index))) {
      score += 1;
    }
  }
  return score;
}

function chooseHeaderCandidate(tables: HTMLCollectionOf<Element>): HeaderCandidate | null {
  let best: HeaderCandidate | null = null;

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const table = tables[tableIndex];
    const rows = Array.from(table.children).filter(
      (node) => node.localName === 'tr' && node.namespaceURI?.includes('wordprocessingml'),
    );
    if (rows.length === 0) {
      continue;
    }

    const rowScanLimit = Math.min(rows.length, 4);
    for (let rowIndex = 0; rowIndex < rowScanLimit; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowCells = Array.from(row.children).filter(
        (node) => node.localName === 'tc' && node.namespaceURI?.includes('wordprocessingml'),
      );
      if (rowCells.length === 0) {
        continue;
      }

      const headerTexts = expandHeaderTexts(rowCells).slice(0, 12);
      const score = scoreHeaderRow(headerTexts);
      if (score === 0) {
        continue;
      }

      const candidate: HeaderCandidate = {
        table,
        headerRowIndex: rowIndex,
        headers: headerTexts,
        score,
      };

      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }
  }

  return best;
}

function buildCanonicalColumnMapping(headers: string[]): number[] {
  const mapping = Array.from({ length: EXPECTED_HEADERS.length }, () => -1);
  const used = new Set<number>();
  const limitedHeaders = headers.slice(0, 12);

  for (let canonicalIndex = 0; canonicalIndex < EXPECTED_HEADERS.length; canonicalIndex += 1) {
    const candidates: number[] = [];
    for (let sourceIndex = 0; sourceIndex < limitedHeaders.length; sourceIndex += 1) {
      if (matchesHeaderAlias(limitedHeaders[sourceIndex] || '', canonicalIndex)) {
        candidates.push(sourceIndex);
      }
    }
    if (candidates.length === 0) {
      continue;
    }

    candidates.sort((left, right) => {
      const leftDistance = Math.abs(left - canonicalIndex);
      const rightDistance = Math.abs(right - canonicalIndex);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return left - right;
    });

    const preferred = candidates.find((value) => !used.has(value));
    const picked = preferred ?? candidates[0];
    mapping[canonicalIndex] = picked;
    used.add(picked);
  }

  if (mapping[5] >= 0 && mapping[6] < 0) {
    const ownerCandidate = mapping[5] + 1;
    if (ownerCandidate >= 0 && ownerCandidate < limitedHeaders.length && !used.has(ownerCandidate)) {
      mapping[6] = ownerCandidate;
      used.add(ownerCandidate);
    }
  }

  for (let canonicalIndex = 0; canonicalIndex < EXPECTED_HEADERS.length; canonicalIndex += 1) {
    if (mapping[canonicalIndex] >= 0) {
      continue;
    }
    if (canonicalIndex < limitedHeaders.length && !used.has(canonicalIndex)) {
      mapping[canonicalIndex] = canonicalIndex;
      used.add(canonicalIndex);
    }
  }

  return mapping;
}

function buildCanonicalHeaders(headers: string[]): string[] {
  const score = scoreHeaderRow(headers);
  if (score < 3) {
    return [...EXPECTED_HEADERS];
  }
  return [...EXPECTED_HEADERS];
}

function resequenceNoColumn(rows: ParsedRow[]): ParsedRow[] {
  return rows.map((row, index) => {
    if (row.length === 0) {
      return row;
    }
    const nextRow = row.slice();
    nextRow[0] = {
      ...nextRow[0],
      text: String(index + 1),
    };
    return nextRow;
  });
}

export async function parseDocxReport(
  file: File,
  onProgress?: (next: ParseProgress) => void,
): Promise<ParseResult> {
  onProgress?.({ stage: 'unzipping', message: '正在解压 DOCX 文件...', progress: 10 });
  const zip = await JSZip.loadAsync(file);

  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('无效 DOCX：缺少 word/document.xml');
  }
  const documentXml = await documentFile.async('string');

  const relsFile = zip.file('word/_rels/document.xml.rels');
  const relsXml = relsFile ? await relsFile.async('string') : '';

  onProgress?.({ stage: 'parsing-xml', message: '正在解析文档结构...', progress: 35 });
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('文档 XML 解析失败');
  }

  const relationshipMap = relsXml ? parseRelationships(relsXml) : new Map<string, string>();
  const tables = xmlDoc.getElementsByTagNameNS('*', 'tbl');
  if (tables.length === 0) {
    throw new Error('未在 DOCX 中找到表格');
  }

  let targetTable: Element | null = null;
  let headers: string[] = [];
  let headerRowIndex = 0;

  const bestCandidate = chooseHeaderCandidate(tables);
  if (bestCandidate && bestCandidate.score >= 3) {
    targetTable = bestCandidate.table;
    headers = bestCandidate.headers.slice(0, 9);
    headerRowIndex = bestCandidate.headerRowIndex;
  }

  if (!targetTable) {
    for (let i = 0; i < tables.length; i += 1) {
      const rows = Array.from(tables[i].children).filter(
        (node) => node.localName === 'tr' && node.namespaceURI?.includes('wordprocessingml'),
      );
      if (rows.length === 0) {
        continue;
      }
      const firstRowCells = Array.from(rows[0].children).filter(
        (node) => node.localName === 'tc' && node.namespaceURI?.includes('wordprocessingml'),
      );

      let colCount = 0;
      for (const cell of firstRowCells) {
        colCount += getGridSpan(cell);
      }
      if (colCount < 9) {
        continue;
      }

      const firstRowTexts: string[] = [];
      for (const cell of firstRowCells) {
        const span = getGridSpan(cell);
        const text = collectTextWithParagraphs(cell);
        firstRowTexts.push(text);
        for (let step = 1; step < span; step += 1) {
          firstRowTexts.push('');
        }
      }

      targetTable = tables[i];
      headers = firstRowTexts.slice(0, 9);
      headerRowIndex = 0;
      break;
    }
  }

  if (!targetTable) {
    throw new Error('未识别到 9 列问题表，请确认 DOCX 模板');
  }

  onProgress?.({ stage: 'extracting-images', message: '正在提取图片与单元格内容...', progress: 70 });
  const rows = Array.from(targetTable.children).filter(
    (node) => node.localName === 'tr' && node.namespaceURI?.includes('wordprocessingml'),
  );
  const columnMapping = buildCanonicalColumnMapping(headers);

  const parsedRows: ParsedRow[] = [];
  const imageCache = new Map<string, ParsedImage>();

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = Array.from(rows[rowIndex].children).filter(
      (node) => node.localName === 'tc' && node.namespaceURI?.includes('wordprocessingml'),
    );

    const parsedCellsByOrder: ParsedCell[] = [];
    const expandedCells: ParsedCell[] = [];
    for (const cell of cells) {
      const span = getGridSpan(cell);
      const text = collectTextWithParagraphs(cell);
      const imageIds = collectImageRelIds(cell);

      const images: ParsedImage[] = [];
      for (const imageId of imageIds) {
        const path = relationshipMap.get(imageId);
        if (!path) {
          continue;
        }

        const cached = imageCache.get(path);
        if (cached) {
          images.push(cached);
          continue;
        }

        const imageFile = zip.file(path);
        if (!imageFile) {
          continue;
        }

        const buffer = await imageFile.async('arraybuffer');
        const extensionMatch = path.match(/\.([a-zA-Z0-9]+)$/);
        const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'png';
        const nextImage: ParsedImage = {
          base64: arrayBufferToBase64(buffer),
          mimeType: getMimeType(extension),
          extension,
        };
        imageCache.set(path, nextImage);
        images.push(nextImage);
      }

      const parsedCell: ParsedCell = { text, images };
      parsedCellsByOrder.push(parsedCell);
      expandedCells.push(parsedCell);
      for (let step = 1; step < span; step += 1) {
        expandedCells.push({ text: '', images: [] });
      }
    }

    const hasContent = parsedCellsByOrder.some((cell) => cell.text.trim() !== '' || cell.images.length > 0);
    if (!hasContent) {
      continue;
    }

    if (parsedCellsByOrder.length >= EXPECTED_HEADERS.length) {
      const normalizedRow = parsedCellsByOrder.slice(0, EXPECTED_HEADERS.length);
      while (normalizedRow.length < EXPECTED_HEADERS.length) {
        normalizedRow.push({ text: '', images: [] });
      }
      parsedRows.push(normalizedRow);
      continue;
    }

    const normalizedRow: ParsedRow = Array.from({ length: EXPECTED_HEADERS.length }, () => ({ text: '', images: [] }));
    for (let canonicalIndex = 0; canonicalIndex < EXPECTED_HEADERS.length; canonicalIndex += 1) {
      const sourceIndex = columnMapping[canonicalIndex];
      if (sourceIndex >= 0 && sourceIndex < expandedCells.length) {
        normalizedRow[canonicalIndex] = expandedCells[sourceIndex];
      }
    }
    parsedRows.push(normalizedRow);
  }

  onProgress?.({ stage: 'rendering', message: '正在生成预览...', progress: 92 });
  return {
    headers: buildCanonicalHeaders(headers),
    rows: resequenceNoColumn(parsedRows),
    columnCount: 9,
  };
}
