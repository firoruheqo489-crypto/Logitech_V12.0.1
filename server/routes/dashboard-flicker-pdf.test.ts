import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

import { parseDashboardFlickerPdfUpload } from './dashboard-flicker-pdf';

type MockParserPayload = {
  file_name: string;
  report_type: 'flicker' | 'pst' | 'svm';
  sample_name: string | null;
  measurement_time: string | null;
  average_lx: number | null;
  flicker_index: number | null;
  flicker_percent: number | null;
  pst: number | null;
  svm: number | null;
  frequency_hz: number | null;
  sample_rate_ks: number | null;
  sample_time_s: number | null;
  voltage_v: number | null;
  result: string | null;
  visibility: string | null;
  erp: string | null;
  standard: string | null;
  raw_text: string;
};

function createApp() {
  const app = express();
  app.post('/parse', parseDashboardFlickerPdfUpload);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  return app;
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function postUpload({
  fileName,
  type = 'application/pdf',
  content = '%PDF-1.4\n',
}: {
  fileName: string;
  type?: string;
  content?: string;
}) {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Test server did not bind to a TCP port');
  }

  const formData = new FormData();
  formData.append('file', new Blob([content], { type }), fileName);

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/parse`, {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json();
    return { response, payload };
  } finally {
    await closeServer(server);
  }
}

function mockParserPayload(payload: MockParserPayload) {
  execFileMock.mockImplementation((_file, _args, _options, callback) => {
    callback(null, JSON.stringify(payload), '');
  });
}

describe('dashboard flicker PDF upload route', () => {
  afterEach(() => {
    execFileMock.mockReset();
  });

  it('returns parsed Pst evidence from the parser payload', async () => {
    mockParserPayload({
      file_name: 'temp.pdf',
      report_type: 'pst',
      sample_name: 'BL212SA-10W2',
      measurement_time: '2026-07-10 15:09:49',
      average_lx: 634.24,
      flicker_index: null,
      flicker_percent: null,
      pst: 0.008,
      svm: null,
      frequency_hz: 99.995,
      sample_rate_ks: 10,
      sample_time_s: 60,
      voltage_v: null,
      result: '可接受',
      visibility: null,
      erp: null,
      standard: 'IEC TR 61547-1:2015',
      raw_text: 'Pst:0.008 Result:可接受',
    });

    const { response, payload } = await postUpload({ fileName: 'BL212SA-10W2 PST.pdf' });

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      sourceType: 'upload',
      fileName: 'BL212SA-10W2 PST.pdf',
      result: {
        file_name: 'BL212SA-10W2 PST.pdf',
        report_type: 'pst',
        pst: 0.008,
        result: '可接受',
        frequency_hz: 99.995,
        voltage_v: null,
      },
    });
  });

  it('returns parsed SVM evidence from the parser payload', async () => {
    mockParserPayload({
      file_name: 'temp.pdf',
      report_type: 'svm',
      sample_name: 'BL212SA-10W2',
      measurement_time: '2026-07-10 15:07:46',
      average_lx: 637.93,
      flicker_index: null,
      flicker_percent: null,
      pst: null,
      svm: 0.034,
      frequency_hz: 99.995,
      sample_rate_ks: 20,
      sample_time_s: 2,
      voltage_v: null,
      result: null,
      visibility: '频闪不可见',
      erp: 'PASS',
      standard: 'CIE TN:006-2016',
      raw_text: 'SVM:0.034 ERP:PASS',
    });

    const { response, payload } = await postUpload({ fileName: 'BL212SA-10W2 SVM.pdf' });

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({
      file_name: 'BL212SA-10W2 SVM.pdf',
      report_type: 'svm',
      svm: 0.034,
      erp: 'PASS',
      visibility: '频闪不可见',
      standard: 'CIE TN:006-2016',
    });
  });

  it('rejects parser payloads without flicker, Pst, or SVM evidence', async () => {
    mockParserPayload({
      file_name: 'temp.pdf',
      report_type: 'flicker',
      sample_name: null,
      measurement_time: null,
      average_lx: null,
      flicker_index: null,
      flicker_percent: null,
      pst: null,
      svm: null,
      frequency_hz: null,
      sample_rate_ks: null,
      sample_time_s: null,
      voltage_v: null,
      result: null,
      visibility: null,
      erp: null,
      standard: null,
      raw_text: 'no evidence',
    });

    const { response, payload } = await postUpload({ fileName: 'empty.pdf' });

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      code: 'FLICKER_PDF_PARSE_FAILED',
      error: 'Failed to parse flicker PDF reports',
    });
    expect(payload.details).toContain('Parser did not find flicker, Pst, or SVM evidence');
  });

  it('rejects non-PDF uploads before invoking the parser', async () => {
    const { response, payload } = await postUpload({
      fileName: 'not-a-report.txt',
      type: 'text/plain',
      content: 'hello',
    });

    expect(response.status).toBe(415);
    expect(payload).toMatchObject({
      code: 'INVALID_FILE_TYPE',
      error: 'Only PDF files are supported',
    });
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
