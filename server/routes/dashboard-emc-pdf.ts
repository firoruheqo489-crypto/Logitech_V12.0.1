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

type EmcPdfPoint = {
  freq: number;
  qp: number | null;
  av: number | null;
  qp_limit: number | null;
  av_limit: number | null;
};

type EmcPdfPeak = {
  index: number;
  freq_mhz: number;
  reading_dbuv: number;
  limit_dbuv: number;
  margin_db: number;
  detector: 'QP' | 'AV';
  remark: string;
};

type EmcPdfParseResult = {
  file_name: string;
  project_no: string | null;
  standard: string | null;
  date: string | null;
  time: string | null;
  band: 'conducted' | 'radiated';
  channel: 'L' | 'N' | 'F' | null;
  peaks: EmcPdfPeak[];
  points: EmcPdfPoint[];
  raw_text: string;
};

type EmcPdfRouteErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'EMC_PDF_PARSE_FAILED'
  | 'PDF_FILE_REQUIRED';

const EMC_PDF_ROUTE_ERROR_MESSAGES: Record<EmcPdfRouteErrorCode, string> = {
  INVALID_FILE_TYPE: 'Only PDF files are supported',
  EMC_PDF_PARSE_FAILED: 'Failed to parse EMC PDF report',
  PDF_FILE_REQUIRED: 'PDF file is required',
};

function sendEmcPdfRouteError(
  res: Response,
  status: number,
  code: EmcPdfRouteErrorCode,
  details?: string,
): void {
  res.status(status).json({
    error: EMC_PDF_ROUTE_ERROR_MESSAGES[code],
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

async function runEmcPdfParser(pdfPath: string): Promise<EmcPdfParseResult> {
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
  const { stdout, stderr } = await execFileAsync(
    pythonExecutable,
    ['-m', 'laboratory_pdf_parser.emc_pdf_parser', pdfPath, '--compact'],
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

  return JSON.parse(payloadText) as EmcPdfParseResult;
}

async function handleEmcPdfUpload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    sendEmcPdfRouteError(res, 400, 'PDF_FILE_REQUIRED');
    return;
  }

  const resolvedFileName = decodeUploadedFileName(file.originalname);

  if (!isPdfFileName(resolvedFileName) && file.mimetype !== 'application/pdf') {
    sendEmcPdfRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }

  const tempFilePath = path.join(os.tmpdir(), `dashboard-emc-pdf-${randomUUID()}.pdf`);

  try {
    await writeFile(tempFilePath, file.buffer);
    const result = await runEmcPdfParser(tempFilePath);
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
    console.error('POST /api/dashboard/emc-pdf/parse-upload error:', error);
    sendEmcPdfRouteError(res, 422, 'EMC_PDF_PARSE_FAILED', readErrorMessage(error));
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

export function parseDashboardEmcPdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      void handleEmcPdfUpload(req, res);
      return;
    }

    next(error);
  });
}
