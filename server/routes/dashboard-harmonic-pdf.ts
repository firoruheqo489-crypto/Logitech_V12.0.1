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

type HarmonicRow = {
  order: number;
  avg_ma: number | null;
  max_ma: number | null;
  limit_100_ma: number | null;
  limit_150_ma: number | null;
  ratio_percent: number | null;
  avg_percent: number;
  limit_percent: number | null;
  max_percent: number | null;
  max_limit_percent: number | null;
  status: string;
};

type PhaseCheck = {
  checkpoint: string;
  measured_deg: number;
  limit_expression: string;
  status: string;
};

type StructuralCheck = {
  code: string;
  value: number | null;
  limit: number | null;
  unit: string | null;
  status: string;
};

type HarmonicParseResult = {
  file_name: string;
  product_name: string | null;
  mode: string | null;
  test_date: string | null;
  start_time: string | null;
  end_time: string | null;
  standard: string | null;
  duration_min: number | null;
  remarks: string | null;
  verdict: string | null;
  thc_ma: number | null;
  ithd_percent: number | null;
  pohc_ma: number | null;
  pohc_limit_ma: number | null;
  distortion_factor: number | null;
  process_metrics: Record<string, number | null>;
  phase_checks: PhaseCheck[];
  structural_checks: StructuralCheck[];
  harmonics: HarmonicRow[];
  raw_text: string;
};

type HarmonicRouteErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'HARMONIC_PDF_PARSE_FAILED'
  | 'PDF_FILE_REQUIRED';

const HARMONIC_ROUTE_ERROR_MESSAGES: Record<HarmonicRouteErrorCode, string> = {
  INVALID_FILE_TYPE: 'Only PDF files are supported',
  HARMONIC_PDF_PARSE_FAILED: 'Failed to parse harmonic PDF report',
  PDF_FILE_REQUIRED: 'PDF file is required',
};

function sendHarmonicRouteError(
  res: Response,
  status: number,
  code: HarmonicRouteErrorCode,
  details?: string,
): void {
  res.status(status).json({
    error: HARMONIC_ROUTE_ERROR_MESSAGES[code],
    code,
    ...(details ? { details } : {}),
  });
}

function readErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Unknown error';
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

async function runHarmonicPdfParser(pdfPath: string): Promise<HarmonicParseResult> {
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
  const { stdout, stderr } = await execFileAsync(
    pythonExecutable,
    ['-m', 'laboratory_pdf_parser.harmonic_parser', pdfPath, '--compact'],
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

  return JSON.parse(payloadText) as HarmonicParseResult;
}

function validateHarmonicEvidence(result: HarmonicParseResult): string | null {
  const hasVerdict = typeof result.verdict === 'string' && result.verdict.trim().length > 0;
  const hasHarmonics = Array.isArray(result.harmonics) && result.harmonics.length > 0;
  const hasChecks =
    (Array.isArray(result.phase_checks) && result.phase_checks.length > 0) ||
    (Array.isArray(result.structural_checks) && result.structural_checks.length > 0);
  const hasProcessMetric = Object.values(result.process_metrics || {}).some((value) => typeof value === 'number');

  if (!hasVerdict && !hasHarmonics && !hasChecks && !hasProcessMetric) {
    return 'No harmonic report evidence was found in this PDF';
  }

  if (!hasHarmonics) {
    return 'Harmonic limit table was not found in this PDF';
  }

  return null;
}

async function handleHarmonicPdfUpload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    sendHarmonicRouteError(res, 400, 'PDF_FILE_REQUIRED');
    return;
  }

  const resolvedFileName = decodeUploadedFileName(file.originalname);

  if (!isPdfFileName(resolvedFileName) || file.mimetype !== 'application/pdf') {
    sendHarmonicRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }

  const tempFilePath = path.join(os.tmpdir(), `dashboard-harmonic-pdf-${randomUUID()}.pdf`);

  try {
    await writeFile(tempFilePath, file.buffer);
    const result = await runHarmonicPdfParser(tempFilePath);
    const evidenceError = validateHarmonicEvidence(result);
    if (evidenceError) {
      sendHarmonicRouteError(res, 422, 'HARMONIC_PDF_PARSE_FAILED', evidenceError);
      return;
    }
    res.status(200).json({
      ok: true,
      sourceType: 'upload',
      fileName: resolvedFileName,
      result: {
        ...result,
        file_name: resolvedFileName,
      },
    });
  } catch (error) {
    console.error('POST /api/dashboard/harmonic-pdf/parse-upload error:', error);
    sendHarmonicRouteError(res, 422, 'HARMONIC_PDF_PARSE_FAILED', readErrorMessage(error));
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

export function parseDashboardHarmonicPdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      void handleHarmonicPdfUpload(req, res);
      return;
    }

    next(error);
  });
}
