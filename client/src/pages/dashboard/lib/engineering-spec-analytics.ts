import type { EngineeringSpecLedgerRecord } from "@/lib/engineering-spec-ledger-api";

export interface EngineeringSpecMonthlyStat {
  monthKey: string;
  monthLabel: string;
  specCount: number;
  sampleCount: number;
  finalSampleCount: number;
  completedCount: number;
  completionRate: number;
}

export interface EngineeringSpecDailyStat {
  day: string;
  count: number;
  pass: number;
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function classifySampleType(value?: string): "sample" | "final-sample" | null {
  const normalized = String(value || "").trim();
  if (normalized.includes("终样")) return "final-sample";
  if (normalized.includes("送样") || normalized.includes("样品"))
    return "sample";
  return null;
}

function parseSampleDeliveryDate(value: string): Date | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const dateOnly = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildEngineeringSpecMonthlyStats(
  archives: EngineeringSpecLedgerRecord[],
  now = new Date()
): EngineeringSpecMonthlyStat[] {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return {
      monthKey: formatMonthKey(date),
      monthLabel: `${String(date.getMonth() + 1).padStart(2, "0")}月`,
      specCount: 0,
      sampleCount: 0,
      finalSampleCount: 0,
      completedCount: 0,
      completionRate: 0,
    } satisfies EngineeringSpecMonthlyStat;
  });
  const monthByKey = new Map(months.map(month => [month.monthKey, month]));

  for (const archive of archives) {
    const sampleDeliveryDate = parseSampleDeliveryDate(archive.testDate);
    if (!sampleDeliveryDate) continue;

    const month = monthByKey.get(formatMonthKey(sampleDeliveryDate));
    if (!month) continue;

    month.specCount += 1;
    const sampleType = classifySampleType(archive.sampleType);
    if (sampleType === "sample") month.sampleCount += 1;
    if (sampleType === "final-sample") month.finalSampleCount += 1;
    if (archive.result === "合格") month.completedCount += 1;
  }

  for (const month of months) {
    month.completionRate =
      month.specCount === 0
        ? 0
        : Math.min(
            100,
            Math.max(
              0,
              Math.round((month.completedCount / month.specCount) * 100)
            )
          );
  }

  return months;
}

export function buildEngineeringSpecDailyStats(
  archives: EngineeringSpecLedgerRecord[],
  now = new Date()
): EngineeringSpecDailyStat[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => ({
    day: `${index + 1}号`,
    count: 0,
    pass: 0,
  }));

  for (const archive of archives) {
    const sampleDeliveryDate = parseSampleDeliveryDate(archive.testDate);
    if (
      !sampleDeliveryDate ||
      sampleDeliveryDate.getFullYear() !== year ||
      sampleDeliveryDate.getMonth() !== month
    ) {
      continue;
    }

    const day = days[sampleDeliveryDate.getDate() - 1];
    day.count += 1;
    if (archive.result === "合格") day.pass += 1;
  }

  return days;
}
