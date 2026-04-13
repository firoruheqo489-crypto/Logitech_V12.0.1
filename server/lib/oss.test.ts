import { describe, expect, it } from 'vitest';

import { buildAssetProxyUrl, parseOssObjectKeyFromUrl } from './oss.js';

describe('oss asset key parsing', () => {
  it('extracts object keys from proxy urls and raw keys', () => {
    const objectKey = 'files/2026/03/dashboard-product-doc/LA26021/drawing-2d/sample.pdf';

    expect(buildAssetProxyUrl(objectKey)).toBe(
      '/api/uploads/object?key=files%2F2026%2F03%2Fdashboard-product-doc%2FLA26021%2Fdrawing-2d%2Fsample.pdf',
    );
    expect(parseOssObjectKeyFromUrl(`/api/uploads/object?key=${encodeURIComponent(objectKey)}`)).toBe(objectKey);
    expect(parseOssObjectKeyFromUrl(objectKey)).toBe(objectKey);
    expect(parseOssObjectKeyFromUrl(encodeURIComponent(objectKey))).toBe(objectKey);
  });
});
