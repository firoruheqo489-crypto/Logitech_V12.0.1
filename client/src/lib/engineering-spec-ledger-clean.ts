import type { EngineeringSpecLedgerRecord } from '@/lib/engineering-spec-ledger-api';

const INVALID_SKU_MARKERS = new Set([
  'sku',
  '\u4ea7\u54c1\u7f16\u53f7',
  '\u4ea7\u54c1\u7f16\u53f7sku',
  '\u4ea7\u54c1\u7f16\u53f7sku',
]);

const INVALID_DESCRIPTION_MARKERS = new Set([
  '\u89c4\u683c\u63cf\u8ff0',
  '\u786e\u8ba4\u9879\u76ee',
]);

const PRODUCT_TYPE_MARKER = '\u4ea7\u54c1\u7c7b\u578b';
const SKU_LABEL_PREFIX = '\u4ea7\u54c1\u7f16\u53f7';
const GENERIC_SPEC_SUFFIX_PATTERN =
  /(?:\u4ea7\u54c1\u89c4\u683c\u4e66|\u4ea7\u54c1\u89c4\u683c\u8d44\u6599|\u4ea7\u54c1\u89c4\u683c|\u89c4\u683c\u4e66|\u89c4\u683c\u8d44\u6599|specification|spec)/iu;

export function normalizeEngineeringSpecComparable(value: string): string {
  return value.replace(/[\s()（）:：]+/gu, '').toLowerCase();
}

function stripGenericSuffixRemainder(value: string): string {
  return value
    .replace(/^[\s\-_.()[\]{}]+/u, '')
    .replace(GENERIC_SPEC_SUFFIX_PATTERN, '')
    .replace(/^[\s\-_.()[\]{}]+/u, '')
    .trim();
}

export function extractUploadFileNameSkuCandidates(fileName: string): string[] {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim();
  const candidates = new Set<string>();

  const pushCandidate = (value: string) => {
    const trimmed = value.trim();
    const normalized = normalizeEngineeringSpecComparable(trimmed);
    if (!normalized || isInvalidEngineeringSpecSkuValue(trimmed)) return;
    candidates.add(normalized);
  };

  if (!baseName) return [];

  pushCandidate(baseName);

  const withoutCommonSuffix = baseName
    .replace(new RegExp(`[-_\\s]*${GENERIC_SPEC_SUFFIX_PATTERN.source}$`, 'iu'), '')
    .trim();
  pushCandidate(withoutCommonSuffix);

  const beforeChinese =
    baseName.split(/[\u4e00-\u9fff]/u)[0]?.replace(/[-_\s]+$/u, '').trim() || '';
  pushCandidate(beforeChinese);

  const leadingAscii = baseName.match(/^[A-Za-z0-9]+(?:[A-Za-z0-9._-]*[A-Za-z0-9])?/u);
  if (leadingAscii) {
    const trailing = baseName.slice(leadingAscii[0].length);
    if (!stripGenericSuffixRemainder(trailing)) {
      pushCandidate(leadingAscii[0]);
    }
  }

  return [...candidates];
}

export function findDuplicateLedgerRecordByUploadFileName(
  fileName: string,
  records: EngineeringSpecLedgerRecord[],
): EngineeringSpecLedgerRecord | null {
  const candidates = extractUploadFileNameSkuCandidates(fileName);
  if (candidates.length === 0) return null;

  return (
    records.find((record) => {
      if (isInvalidEngineeringSpecSkuValue(record.sku || '')) return false;
      const normalizedSku = normalizeEngineeringSpecComparable(record.sku || '');
      return candidates.includes(normalizedSku);
    }) || null
  );
}

export function isInvalidEngineeringSpecSkuValue(value: string): boolean {
  const sku = normalizeEngineeringSpecComparable(value || '');
  if (!sku) return true;
  if (INVALID_SKU_MARKERS.has(sku)) return true;
  if (sku.startsWith(SKU_LABEL_PREFIX)) return true;
  return false;
}

function isHeaderLikeRecord(record: EngineeringSpecLedgerRecord): boolean {
  const description = normalizeEngineeringSpecComparable(record.description || '');
  const type = normalizeEngineeringSpecComparable(record.type || '');

  if (isInvalidEngineeringSpecSkuValue(record.sku || '')) return true;
  if (INVALID_DESCRIPTION_MARKERS.has(description)) return true;
  if (type === PRODUCT_TYPE_MARKER || type.startsWith(PRODUCT_TYPE_MARKER)) return true;

  return false;
}

export function sanitizeEngineeringSpecLedgerRecords(
  records: EngineeringSpecLedgerRecord[],
): EngineeringSpecLedgerRecord[] {
  return records.filter((record) => !isHeaderLikeRecord(record));
}
