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

function normalizeComparable(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[()（）:：]/g, '')
    .toLowerCase();
}

function isHeaderLikeRecord(record: EngineeringSpecLedgerRecord): boolean {
  const sku = normalizeComparable(record.sku || '');
  const description = normalizeComparable(record.description || '');
  const type = normalizeComparable(record.type || '');

  if (!sku) return true;
  if (INVALID_SKU_MARKERS.has(sku)) return true;
  if (sku.startsWith('产品编号')) return true;
  if (INVALID_DESCRIPTION_MARKERS.has(description)) return true;
  if (type === '产品类型' || type.startsWith('产品类型')) return true;

  return false;
}

export function sanitizeEngineeringSpecLedgerRecords(
  records: EngineeringSpecLedgerRecord[],
): EngineeringSpecLedgerRecord[] {
  return records.filter((record) => !isHeaderLikeRecord(record));
}
