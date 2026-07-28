# Engineering Spec Monthly Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-month KPI cards and a continuous 12-month trend chart for specification count, sample orders, final-sample orders, and completion rate.

**Architecture:** Put all calendar bucketing and business classification in a focused pure-function module. Keep `EngineeringSpecAnalyticsDashboard.tsx` responsible for presentation, consuming a stable array of 12 month buckets while preserving its current seven-day, category, and ledger panels.

**Tech Stack:** React 19, TypeScript, Recharts, Vitest, React DOM server rendering

---

## File Structure

- Create `client/src/pages/dashboard/lib/engineering-spec-analytics.ts`: monthly bucket type, sample-type normalization, date parsing, and 12-month aggregation.
- Create `client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts`: business-rule and calendar-boundary unit tests.
- Modify `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx`: current-month KPI cards and monthly composed chart.
- Create `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`: rendering regression for new and retained dashboard sections.

### Task 1: Monthly aggregation model

**Files:**
- Create: `client/src/pages/dashboard/lib/engineering-spec-analytics.ts`
- Test: `client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Create records through a small test factory and assert that `buildEngineeringSpecMonthlyStats(records, new Date(2026, 0, 15))` returns 12 buckets from `2025-02` through `2026-01`. Assert the January bucket counts all valid records, classifies `送样测试` as sample and `终样测试` as final sample, counts only `合格` as complete, rounds `2 / 3` to `67`, ignores invalid dates, and leaves unknown types out of the two subtype counts.

```ts
const january = result.at(-1);
expect(result).toHaveLength(12);
expect(result[0]?.monthKey).toBe("2025-02");
expect(january).toMatchObject({
  monthKey: "2026-01",
  specCount: 3,
  sampleCount: 1,
  finalSampleCount: 1,
  completedCount: 2,
  completionRate: 67,
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run: `pnpm exec vitest run client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts`

Expected: FAIL because `engineering-spec-analytics.ts` does not exist.

- [ ] **Step 3: Implement the pure aggregation function**

Export this stable interface and function:

```ts
export interface EngineeringSpecMonthlyStat {
  monthKey: string;
  monthLabel: string;
  specCount: number;
  sampleCount: number;
  finalSampleCount: number;
  completedCount: number;
  completionRate: number;
}

export function buildEngineeringSpecMonthlyStats(
  archives: EngineeringSpecLedgerRecord[],
  now = new Date(),
): EngineeringSpecMonthlyStat[];
```

Generate 12 local-calendar month buckets ending at `now`. Parse `createdAt`, skip invalid dates and dates outside the window, classify strings containing `终样` before strings containing `送样` or `样品`, and calculate `Math.round(completedCount / specCount * 100)` with zero for empty buckets.

- [ ] **Step 4: Run the unit test and verify GREEN**

Run: `pnpm exec vitest run client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts`

Expected: all aggregation tests PASS.

- [ ] **Step 5: Commit aggregation model**

```powershell
git add -- client/src/pages/dashboard/lib/engineering-spec-analytics.ts client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts
git commit -m "feat: add engineering spec monthly aggregation"
```

### Task 2: Monthly dashboard presentation

**Files:**
- Modify: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx`
- Create: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

- [ ] **Step 1: Write a failing component regression test**

Render the dashboard with current-month sample and final-sample records using `renderToStaticMarkup`. Assert the HTML contains `规格书统计看板`, `本月规格书`, `本月样品单`, `本月终样单`, `本月完成率`, and `月度处理趋势`. Also assert retained content `每日处理量`, `样品分布`, and `最近归档记录` remains present.

```tsx
const html = renderToStaticMarkup(<EngineeringSpecAnalyticsDashboard archives={records} />);
expect(html).toContain("月度处理趋势");
expect(html).toContain("每日处理量");
expect(html).toContain("最近归档记录");
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

Expected: FAIL because the monthly headings and KPI cards are absent.

- [ ] **Step 3: Add the current-month KPI cards**

Import `buildEngineeringSpecMonthlyStats`, derive `monthlyData` and `currentMonth`, change the title to `规格书统计看板`, and replace the current three-card row with four cards:

```tsx
<KpiCard icon={Layers} label="本月规格书" sub="Monthly Specs" value={String(currentMonth.specCount)} unit="份" />
<KpiCard icon={PackageCheck} label="本月样品单" sub="Sample Orders" value={String(currentMonth.sampleCount)} unit="单" />
<KpiCard icon={BadgeCheck} label="本月终样单" sub="Final Sample Orders" value={String(currentMonth.finalSampleCount)} unit="单" />
<KpiCard icon={Gauge} label="本月完成率" sub="Completion Rate" value={String(currentMonth.completionRate)} unit="%" accent />
```

- [ ] **Step 4: Add the monthly composed chart**

Import Recharts `ComposedChart`, `Line`, `Legend`, and a right-side `YAxis`. Add a full-width panel before the existing recent-seven-day grid. Use three bars (`specCount`, `sampleCount`, `finalSampleCount`) against the left count axis and one line (`completionRate`) against a right axis with domain `[0, 100]` and percent tick formatting. The tooltip uses the existing dark theme and shows exact values.

- [ ] **Step 5: Preserve the existing detail panels**

Keep `buildDailyVolumeData`, `buildCategoryBreakdown`, sample-type summary, and the complete recent-archive table below the monthly panel. Do not change their input scope or classification rules.

- [ ] **Step 6: Run component and aggregation tests**

Run: `pnpm exec vitest run client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts`

Expected: both test files PASS.

- [ ] **Step 7: Commit dashboard presentation**

```powershell
git add -- client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
git commit -m "feat: show engineering spec monthly analytics"
```

### Task 3: Full verification

**Files:**
- Verify all changed production and test files.

- [ ] **Step 1: Format and check targeted files**

Run: `pnpm exec prettier --write client/src/pages/dashboard/lib/engineering-spec-analytics.ts client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

Run: `pnpm exec prettier --check client/src/pages/dashboard/lib/engineering-spec-analytics.ts client/src/pages/dashboard/lib/engineering-spec-analytics.test.ts client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

Expected: all matched files use Prettier style.

- [ ] **Step 2: Run complete automated verification**

Run: `pnpm exec vitest run`

Expected: all test files pass with zero failures.

Run: `pnpm exec tsc --noEmit`

Expected: exit code 0 with no TypeScript errors.

Run: `git diff --check`

Expected: exit code 0.

- [ ] **Step 3: Verify the local dashboard runtime**

Run: `pnpm run dev:dashboard:status`

Expected: command succeeds, reports the resolved frontend URL from `.codex-local-dashboard.state.json`, and confirms `http://localhost:3001/api/health` is healthy.

- [ ] **Step 4: Review final scope**

Confirm the diff changes only the monthly analytics implementation and tests. Preserve the unrelated existing `jifenqiu` edits and pre-existing staged plan file.
