import type { EngineeringSpecLedgerRecord } from '@/lib/engineering-spec-ledger-api';

const INVALID_SKU_MARKERS = new Set([
  'sku',
  '产品编号',
  '产品编号sku',
  '产品编号(sku)',
  '产品编号（sku）',
]);

const INVALID_DESCRIPTION_MARKERS = new Set([
  '规格描述',
  '确认项目',
]);

export function normalizeEngineeringSpecComparable(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[()（）:：]/g, '')
    .toLowerCase();
}

export function isInvalidEngineeringSpecSkuValue(value: string): boolean {
  const sku = normalizeEngineeringSpecComparable(value || '');
  if (!sku) return true;
  if (INVALID_SKU_MARKERS.has(sku)) return true;
  if (sku.startsWith('产品编号')) return true;
  return false;
}

function isHeaderLikeRecord(record: EngineeringSpecLedgerRecord): boolean {
  const sku = normalizeEngineeringSpecComparable(record.sku || '');
  const description = normalizeEngineeringSpecComparable(record.description || '');
  const type = normalizeEngineeringSpecComparable(record.type || '');

  if (isInvalidEngineeringSpecSkuValue(record.sku || '')) return true;
  if (INVALID_DESCRIPTION_MARKERS.has(description)) return true;
  if (type === '产品类型' || type.startsWith('产品类型')) return true;

  return false;
}

export function sanitizeEngineeringSpecLedgerRecords(
  records: EngineeringSpecLedgerRecord[],
): EngineeringSpecLedgerRecord[] {
  return records.filter((record) => !isHeaderLikeRecord(record));
}
