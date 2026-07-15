import type { Response } from 'express';

type ReleaseGateSlot = () => void;

class ConcurrencyGate {
  private active = 0;
  private readonly maxActive: number;

  constructor(maxActive: number) {
    this.maxActive = maxActive;
  }

  tryEnter(): ReleaseGateSlot | null {
    if (this.active >= this.maxActive) {
      return null;
    }

    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }

  getActiveCount(): number {
    return this.active;
  }

  getMaxActive(): number {
    return this.maxActive;
  }
}

function readPositiveIntegerEnv(name: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

const pdfParseConcurrency = readPositiveIntegerEnv('PDF_PARSE_CONCURRENCY', 2, 4);
const pdfParseGate = new ConcurrencyGate(pdfParseConcurrency);

export function tryEnterPdfParseGate(): ReleaseGateSlot | null {
  return pdfParseGate.tryEnter();
}

export function sendPdfParseBusy(res: Response): void {
  res.status(429).json({
    error: 'PDF parser is busy, please retry shortly',
    code: 'PDF_PARSE_BUSY',
    active: pdfParseGate.getActiveCount(),
    limit: pdfParseGate.getMaxActive(),
  });
}
