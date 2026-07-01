/// <reference path="../types/multer.d.ts" />
// @ts-ignore local declaration fallback covers runtime usage even when @types/multer is incomplete
import multer from 'multer';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';

const execFileAsync = promisify(execFile);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

type DarkroomParseResult = {
  name: string | null;
  filename: string | null;
  machine: string | null;
  test_date: string | null;
  rated_flux_lm: number | null;
  luminaire_flux_lm: number | null;
  beam_lumens_lm: number | null;
  beam_efficiency_percent: number | null;
  field_lumens_lm: number | null;
  field_efficiency_percent: number | null;
  tested_power_w: number | null;
  luminaire_eer_lm_per_w: number | null;
  max_candela_cd: number | null;
  max_candela_angle_h: number | null;
  max_candela_angle_v: number | null;
  tested_voltage_v: number | null;
  tested_current_a: number | null;
  tested_pf: number | null;
  beam_angle_v_deg: number | null;
  beam_angle_h_deg: number | null;
  field_angle_v_deg: number | null;
  field_angle_h_deg: number | null;
  erp_phiuse_lm: number | null;
  irf_percent: number | null;
  plane_max_illuminance_lx: number | null;
  plane_max_position_h: number | null;
  plane_max_position_v: number | null;
  space_max_illuminance_lx: number | null;
  space_max_angle_deg: number | null;
  plane_max_intensity_cd: number | null;
  plane_max_intensity_angle_deg: number | null;
  attenuation_slots: Array<{
    height: string;
    centerLux: number;
    averageLux: number;
    diameter: number;
  }>;
  raw_pages: string[];
};

type DarkroomRouteErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'DARKROOM_PDF_PARSE_FAILED'
  | 'PDF_FILE_REQUIRED';

const DARKROOM_ROUTE_ERROR_MESSAGES: Record<DarkroomRouteErrorCode, string> = {
  INVALID_FILE_TYPE: 'Only PDF files are supported',
  DARKROOM_PDF_PARSE_FAILED: 'Failed to parse darkroom PDF report',
  PDF_FILE_REQUIRED: 'PDF file is required',
};

function sendDarkroomRouteError(
  res: Response,
  status: number,
  code: DarkroomRouteErrorCode,
  details?: string,
): void {
  res.status(status).json({
    error: DARKROOM_ROUTE_ERROR_MESSAGES[code],
    code,
    ...(details ? { details } : {}),
  });
}

function readErrorMessage(error: unknown): string {
  return typeof error === 'string' && error.trim() ? error : 'Unknown error';
}

function isLikelyMojibakeFileName(fileName: string): boolean {
  return /[-¿À-ÿ]/.test(fileName);
}

function decodeUploadedFileName(fileName: string): string {
  const normalized = fileName.trim();
  if (!normalized || !isLikelyMojibakeFileName(normalized)) {
    return normalized || fileName;
  }

  const decoded = Buffer.from(normalized, 'latin1').toString('utf8').trim();
  if (!decoded) {
    return normalized;
  }

  const hasReadableCjk = /[\u3400-\u9fff]/.test(decoded);
  const hasReplacementChar = /\uFFFD/.test(decoded);
  return hasReadableCjk && !hasReplacementChar ? decoded : normalized;
}

function isPdfFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith('.pdf');
}

async function runDarkroomPdfParser(pdfPath: string): Promise<DarkroomParseResult> {
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
  const { stdout, stderr } = await execFileAsync(
    pythonExecutable,
    ['-m', 'laboratory_pdf_parser.darkroom_parser', pdfPath, '--compact'],
    {
      cwd: process.cwd(),
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );

  const payloadText = stdout.trim();
  if (!payloadText) {
    throw new Error(stderr.trim() || 'Parser returned empty output');
  }

  return JSON.parse(payloadText) as DarkroomParseResult;
}

async function handleDarkroomPdfUpload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    sendDarkroomRouteError(res, 400, 'PDF_FILE_REQUIRED');
    return;
  }

  const resolvedFileName = decodeUploadedFileName(file.originalname);

  if (!isPdfFileName(resolvedFileName) && file.mimetype !== 'application/pdf') {
    sendDarkroomRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }

  const tempFilePath = path.join(os.tmpdir(), `dashboard-darkroom-pdf-${randomUUID()}.pdf`);

  try {
    await writeFile(tempFilePath, file.buffer);
    const result = await runDarkroomPdfParser(tempFilePath);
    res.status(200).json({
      ok: true,
      sourceType: 'upload',
      fileName: resolvedFileName,
      result,
    });
  } catch (error) {
    console.error('POST /api/dashboard/darkroom-pdf/parse-upload error:', error);
    sendDarkroomRouteError(res, 422, 'DARKROOM_PDF_PARSE_FAILED', readErrorMessage(error));
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

export function parseDashboardDarkroomPdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      void handleDarkroomPdfUpload(req, res);
      return;
    }

    next(error);
  });
}
