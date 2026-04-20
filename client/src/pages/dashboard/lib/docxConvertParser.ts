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

function buildCanonicalHeaders(headers: string[]): string[] {
  const looksLikeHeaders =
    headers.filter((h) => h.trim().length > 0).length >= 5 &&
    headers.some((h) => /issue|pictures|root|solution|owner|due|status|reference|no\./i.test(h));

  if (!looksLikeHeaders) {
    return [...EXPECTED_HEADERS];
  }

  const next = headers.slice(0, 9);
  while (next.length < 9) {
    next.push(EXPECTED_HEADERS[next.length] || '');
  }
  return next;
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

    const firstRowTexts: string[] = [];
    for (const cell of firstRowCells) {
      const span = getGridSpan(cell);
      const text = collectTextWithParagraphs(cell);
      firstRowTexts.push(text);
      for (let step = 1; step < span; step += 1) {
        firstRowTexts.push('');
      }
    }

    const normalized = firstRowTexts.map((value) => value.trim().toLowerCase());
    const expected = EXPECTED_HEADERS.map((value) => value.toLowerCase());
    const matchCount = expected.filter(
      (value, index) => normalized[index] && normalized[index].includes(value.split(' ')[0]),
    ).length;

    if (firstRowTexts.length >= 9 && matchCount >= 5) {
      targetTable = tables[i];
      headers = firstRowTexts.slice(0, 9);
      break;
    }
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

  const parsedRows: ParsedRow[] = [];
  const imageCache = new Map<string, ParsedImage>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = Array.from(rows[rowIndex].children).filter(
      (node) => node.localName === 'tc' && node.namespaceURI?.includes('wordprocessingml'),
    );

    const parsedCells: ParsedCell[] = [];
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

      parsedCells.push({ text, images });
      for (let step = 1; step < span; step += 1) {
        parsedCells.push({ text: '', images: [] });
      }
    }

    const hasContent = parsedCells.some((cell) => cell.text.trim() !== '' || cell.images.length > 0);
    if (!hasContent) {
      continue;
    }

    while (parsedCells.length < 9) {
      parsedCells.push({ text: '', images: [] });
    }
    parsedRows.push(parsedCells.slice(0, 9));
  }

  onProgress?.({ stage: 'rendering', message: '正在生成预览...', progress: 92 });
  return {
    headers: buildCanonicalHeaders(headers),
    rows: parsedRows,
    columnCount: 9,
  };
}
