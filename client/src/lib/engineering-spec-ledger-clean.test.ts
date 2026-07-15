import { describe, expect, it } from 'vitest';

import type { EngineeringSpecLedgerRecord } from '@/lib/engineering-spec-ledger-api';
import {
  extractUploadFileNameSkuCandidates,
  findDuplicateLedgerRecordByUploadFileName,
} from '@/lib/engineering-spec-ledger-clean';

function createRecord(sku: string): EngineeringSpecLedgerRecord {
  return {
    id: `doc-${sku}`,
    projectId: 'test-project',
    sequence: 1,
    sku,
    spu: '',
    type: '',
    category: '',
    description: '',
    department: '',
    productGroup: '',
    sampleQty: '',
    testDate: '',
    result: '鍚堟牸',
    pendingCount: 0,
    createdAt: '2026-07-15T00:00:00.000Z',
    ossUrl: `https://example.com/${encodeURIComponent(sku)}.json`,
  };
}

describe('engineering spec upload file name dedupe', () => {
  it('keeps meaningful suffixes such as PIR serial fragments in SKU candidates', () => {
    expect(extractUploadFileNameSkuCandidates('LG172C-10W2 PIR 1063 产品规格资料.xlsx')).toContain(
      'lg172c-10w2pir1063',
    );
  });

  it('still detects obvious duplicates when the file name only adds a generic spec suffix', () => {
    const duplicate = findDuplicateLedgerRecordByUploadFileName('LG172C-10W2 产品规格资料.xlsx', [
      createRecord('LG172C-10W2'),
    ]);

    expect(duplicate?.sku).toBe('LG172C-10W2');
  });

  it('does not treat a PIR-qualified SKU as the base SKU', () => {
    const duplicate = findDuplicateLedgerRecordByUploadFileName('LG172C-10W2 PIR 1063 产品规格资料.xlsx', [
      createRecord('LG172C-10W2'),
    ]);

    expect(duplicate).toBeNull();
  });
});
