import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

import { parseDashboardDarkroomPdfUpload } from './dashboard-darkroom-pdf';

function createApp() {
  const app = express();
  app.post('/parse', parseDashboardDarkroomPdfUpload);
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

function mockParserPayload(payload: unknown) {
  execFileMock.mockImplementation((_file, _args, _options, callback) => {
    callback(null, { stdout: JSON.stringify(payload), stderr: '' });
  });
}

describe('dashboard darkroom PDF upload route', () => {
  afterEach(() => {
    execFileMock.mockReset();
  });

  it('returns parsed darkroom photometric evidence', async () => {
    mockParserPayload({
      name: 'HL222C-200W2-G3',
      filename: 'HL222C-200W2-G3.IES',
      machine: 'GON-2000',
      test_date: '2026/07/13',
      rated_flux_lm: 26682.039,
      luminaire_flux_lm: 26682.037,
      beam_lumens_lm: 18559.42,
      beam_efficiency_percent: 69.56,
      field_lumens_lm: 25255.46,
      field_efficiency_percent: 94.65,
      tested_power_w: 191.8,
      luminaire_eer_lm_per_w: 139.114,
      max_candela_cd: 14829.717,
      max_candela_angle_h: 0,
      max_candela_angle_v: 1,
      tested_voltage_v: 229.9,
      tested_current_a: 0.868,
      tested_pf: 0.961,
      beam_angle_v_deg: 82,
      beam_angle_h_deg: 81.1,
      field_angle_v_deg: 123.9,
      field_angle_h_deg: 125.4,
      erp_phiuse_lm: 20550.295,
      erp_phiuse_angle_deg: 90,
      irf_percent: 136.94,
      mounting_height_m: 3,
      plane_max_illuminance_lx: 1646.99,
      plane_max_position_h: 0,
      plane_max_position_v: 0,
      space_max_illuminance_lx: 14814.48,
      space_max_angle_deg: 1.5,
      plane_max_intensity_cd: 14829.717,
      plane_max_intensity_angle_deg: 0,
      attenuation_slots: [{ height: '1.0m', centerLux: 14801, averageLux: 8069.565, diameter: 1.711 }],
      candela_plane: [{ theta: 0, cd: 14801 }],
      raw_pages: ['Flood Luminaire Photometric Data'],
    });

    const { response, payload } = await postUpload({ fileName: 'HL222C.pdf' });

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      sourceType: 'upload',
      fileName: 'HL222C.pdf',
      result: {
        erp_phiuse_lm: 20550.295,
        irf_percent: 136.94,
        mounting_height_m: 3,
      },
    });
  });

  it('rejects parser payloads without photometric evidence', async () => {
    mockParserPayload({
      name: null,
      filename: null,
      machine: null,
      test_date: null,
      luminaire_flux_lm: null,
      rated_flux_lm: null,
      max_candela_cd: null,
      beam_lumens_lm: null,
      field_lumens_lm: null,
      erp_phiuse_lm: null,
      attenuation_slots: [],
      candela_plane: [],
      raw_pages: ['empty'],
    });

    const { response, payload } = await postUpload({ fileName: 'empty.pdf' });

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      code: 'DARKROOM_PDF_PARSE_FAILED',
      error: 'Failed to parse darkroom PDF report',
      details: 'Darkroom PDF parser could not extract supported photometric evidence',
    });
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
