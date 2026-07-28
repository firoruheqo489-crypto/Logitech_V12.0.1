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

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function classifySampleType(value?: string): "sample" | "final-sample" | null {
  const normalized = String(value || "").trim();
  if (normalized.includes("终样")) return "final-sample";
  if (normalized.includes("送样") || normalized.includes("样品")) return "sample";
  return null;
}

export function buildEngineeringSpecMonthlyStats(
  archives: EngineeringSpecLedgerRecord[],
  now = new Date(),
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
  const monthByKey = new Map(months.map((month) => [month.monthKey, month]));

  for (const archive of archives) {
    const createdAt = new Date(archive.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;

    const month = monthByKey.get(formatMonthKey(createdAt));
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
        : Math.min(100, Math.max(0, Math.round((month.completedCount / month.specCount) * 100)));
  }

  return months;
}
