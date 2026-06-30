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

type LaboratoryPdfParseResult = {
  sdcm: number | null;
  chromaticity_x: number | null;
  chromaticity_y: number | null;
  u_prime: number | null;
  v_prime: number | null;
  duv: number | null;
  cct_k: number | null;
  ra: number | null;
  avg_r: number | null;
  flux_lm: number | null;
  efficacy_lm_per_w: number | null;
  radiant_power_mw: number | null;
  voltage_v: number | null;
  current_a: number | null;
  power_w: number | null;
  power_factor: number | null;
  dominant_wavelength_nm: number | null;
  peak_wavelength_nm: number | null;
  fwhm_nm: number | null;
  color_purity_percent: number | null;
  model: string | null;
  report_datetime: string | null;
  energy_efficiency_class: string | null;
  cqs_tm30_metrics: string | null;
  render_indices: Array<Record<string, number | null>>;
  file_path?: string;
};

type LaboratoryPdfRouteErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'LABORATORY_PDF_PARSE_FAILED'
  | 'PDF_FILE_REQUIRED';

const LABORATORY_PDF_ROUTE_ERROR_MESSAGES: Record<LaboratoryPdfRouteErrorCode, string> = {
  INVALID_FILE_TYPE: 'Only PDF files are supported',
  LABORATORY_PDF_PARSE_FAILED: 'Failed to parse laboratory PDF report',
  PDF_FILE_REQUIRED: 'PDF file is required',
};

function sendLaboratoryPdfRouteError(
  res: Response,
  status: number,
  code: LaboratoryPdfRouteErrorCode,
  details?: string,
): void {
  res.status(status).json({
    error: LABORATORY_PDF_ROUTE_ERROR_MESSAGES[code],
    code,
    ...(details ? { details } : {}),
  });
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error ?? 'Unknown error');
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

async function runLaboratoryPdfParser(pdfPath: string): Promise<LaboratoryPdfParseResult> {
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
  const { stdout, stderr } = await execFileAsync(
    pythonExecutable,
    ['-m', 'laboratory_pdf_parser', pdfPath, '--compact'],
    {
      cwd: process.cwd(),
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    },
  );

  const payloadText = stdout.trim();
  if (!payloadText) {
    throw new Error(stderr.trim() || 'Parser returned empty output');
  }

  return JSON.parse(payloadText) as LaboratoryPdfParseResult;
}

async function handleDashboardLaboratoryPdfUpload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    sendLaboratoryPdfRouteError(res, 400, 'PDF_FILE_REQUIRED');
    return;
  }

  const resolvedFileName = decodeUploadedFileName(file.originalname);

  if (!isPdfFileName(resolvedFileName) && file.mimetype !== 'application/pdf') {
    sendLaboratoryPdfRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }

  const tempFilePath = path.join(os.tmpdir(), `dashboard-laboratory-pdf-${randomUUID()}.pdf`);

  try {
    await writeFile(tempFilePath, file.buffer);
    const result = await runLaboratoryPdfParser(tempFilePath);
    res.status(200).json({
      ok: true,
      sourceType: 'upload',
      fileName: resolvedFileName,
      result,
    });
  } catch (error) {
    console.error('POST /api/dashboard/laboratory-pdf/parse-upload error:', error);
    sendLaboratoryPdfRouteError(res, 422, 'LABORATORY_PDF_PARSE_FAILED', readErrorMessage(error));
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

export function parseDashboardLaboratoryPdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      void handleDashboardLaboratoryPdfUpload(req, res);
      return;
    }

    next(error);
  });
}
