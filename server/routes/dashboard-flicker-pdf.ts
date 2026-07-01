/// <reference path="../types/multer.d.ts" />
// @ts-ignore local declaration fallback covers runtime usage even when @types/multer is incomplete
import multer from 'multer';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';

const execFileAsync = promisify(execFile);
const DEFAULT_FLICKER_FOLDER =
  'C:\\Users\\bqgff\\Desktop\\实验室报告\\恒流MR16-8W-27k、65k\\频闪';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

type FlickerParseResult = {
  file_name: string;
  sample_name: string | null;
  measurement_time: string | null;
  average_lx: number | null;
  flicker_index: number | null;
  flicker_percent: number | null;
  frequency_hz: number | null;
  sample_rate_ks: number | null;
  sample_time_s: number | null;
  voltage_v: number | null;
  raw_text: string;
};

type FlickerRouteErrorCode =
  | 'FLICKER_FOLDER_NOT_FOUND'
  | 'FLICKER_PDF_PARSE_FAILED'
  | 'INVALID_FILE_TYPE'
  | 'PDF_FILE_REQUIRED';

const FLICKER_ROUTE_ERROR_MESSAGES: Record<FlickerRouteErrorCode, string> = {
  FLICKER_FOLDER_NOT_FOUND: 'Flicker PDF folder not found',
  FLICKER_PDF_PARSE_FAILED: 'Failed to parse flicker PDF reports',
  INVALID_FILE_TYPE: 'Only PDF files are supported',
  PDF_FILE_REQUIRED: 'PDF file is required',
};

function sendFlickerRouteError(
  res: Response,
  status: number,
  code: FlickerRouteErrorCode,
  details?: string,
): void {
  res.status(status).json({
    error: FLICKER_ROUTE_ERROR_MESSAGES[code],
    code,
    ...(details ? { details } : {}),
  });
}

function readErrorMessage(error: unknown): string {
  return typeof error === 'string' && error.trim() ? error : 'Unknown error';
}

async function runFlickerPdfParser(pdfPath: string): Promise<FlickerParseResult> {
  const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
  const { stdout, stderr } = await execFileAsync(
    pythonExecutable,
    ['-m', 'laboratory_pdf_parser.flicker_parser', pdfPath, '--compact'],
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

  return JSON.parse(payloadText) as FlickerParseResult;
}

function sampleSortKey(result: FlickerParseResult): string {
  return `${result.sample_name || ''}::${String(result.voltage_v ?? 0).padStart(4, '0')}::${result.file_name}`;
}

function readVoltageFromFileName(fileName: string): number | null {
  const match = fileName.match(/(\d+)V/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function isPdfFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith('.pdf');
}

export async function parseDashboardFlickerPdfFolder(_req: Request, res: Response): Promise<void> {
  const sourceFolder = DEFAULT_FLICKER_FOLDER;
  const tempDir = path.join(os.tmpdir(), `dashboard-flicker-pdf-${Date.now()}`);

  try {
    await mkdir(tempDir, { recursive: true });
    const entries = await readdir(sourceFolder, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));

    if (files.length === 0) {
      sendFlickerRouteError(res, 404, 'FLICKER_FOLDER_NOT_FOUND', `No PDFs found in ${sourceFolder}`);
      return;
    }

    const results: FlickerParseResult[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const fileName = files[index];
      const sourcePath = path.join(sourceFolder, fileName);
      const tempPath = path.join(tempDir, `flicker-${String(index + 1).padStart(2, '0')}.pdf`);
      await copyFile(sourcePath, tempPath);
      const parsed = await runFlickerPdfParser(tempPath);
      parsed.file_name = fileName;
      parsed.voltage_v = parsed.voltage_v ?? readVoltageFromFileName(fileName);
      results.push(parsed);
    }

    results.sort((left, right) => sampleSortKey(left).localeCompare(sampleSortKey(right), 'zh-CN'));

    res.status(200).json({
      ok: true,
      sourceType: 'folder',
      sourceFolder,
      count: results.length,
      results,
    });
  } catch (error) {
    const message = readErrorMessage(error);
    const code = message.includes('ENOENT') ? 'FLICKER_FOLDER_NOT_FOUND' : 'FLICKER_PDF_PARSE_FAILED';
    console.error('POST /api/dashboard/flicker-pdf/parse-folder error:', error);
    sendFlickerRouteError(res, code === 'FLICKER_FOLDER_NOT_FOUND' ? 404 : 422, code, message);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function handleFlickerPdfUpload(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    sendFlickerRouteError(res, 400, 'PDF_FILE_REQUIRED');
    return;
  }

  if (!isPdfFileName(file.originalname) && file.mimetype !== 'application/pdf') {
    sendFlickerRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }

  const tempFilePath = path.join(os.tmpdir(), `dashboard-flicker-single-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);

  try {
    await writeFile(tempFilePath, file.buffer);
    const parsed = await runFlickerPdfParser(tempFilePath);
    parsed.file_name = file.originalname;
    parsed.voltage_v = parsed.voltage_v ?? readVoltageFromFileName(file.originalname);

    res.status(200).json({
      ok: true,
      sourceType: 'upload',
      fileName: file.originalname,
      result: parsed,
    });
  } catch (error) {
    console.error('POST /api/dashboard/flicker-pdf/parse-upload error:', error);
    sendFlickerRouteError(res, 422, 'FLICKER_PDF_PARSE_FAILED', readErrorMessage(error));
  } finally {
    await unlink(tempFilePath).catch(() => undefined);
  }
}

export function parseDashboardFlickerPdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      void handleFlickerPdfUpload(req, res);
      return;
    }

    next(error);
  });
}
