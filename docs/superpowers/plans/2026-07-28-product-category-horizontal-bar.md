# Product Category Horizontal Bar Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the product-category donut chart and legend list with a descending horizontal bar chart that shows each category's count and percentage.

**Architecture:** Keep the existing archive aggregation inside `EngineeringSpecAnalyticsDashboard.tsx`, but make `buildCategoryBreakdown` return a stable descending order. Render that data with Recharts `BarChart` using `layout="vertical"`, a numeric X axis, and a categorical Y axis; use a custom label formatter for `数量（占比）`.

**Tech Stack:** React, TypeScript, Recharts, Vitest, React server rendering

---

### Task 1: Lock the horizontal chart behavior with a failing test

**Files:**
- Modify: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`
- Test: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

- [ ] **Step 1: Write the failing assertions**

Add assertions to the existing dashboard render test:

```ts
expect(html).toContain('layout="vertical"');
expect(html).toContain('data-layout="horizontal-category-bars"');
expect(html).not.toContain('data-layout="category-donut"');
```

The explicit `data-layout` marker makes the intended chart variant testable even though Recharts suppresses responsive SVG output during server rendering.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm exec vitest run client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
```

Expected: FAIL because the rendered dashboard does not contain `layout="vertical"` or `data-layout="horizontal-category-bars"`.

### Task 2: Replace the donut with descending horizontal bars

**Files:**
- Modify: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx`
- Test: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

- [ ] **Step 1: Replace donut-only imports and constants**

Remove `Pie` and `PieChart` from the Recharts import, add `LabelList`, and keep `Cell` for per-bar colors. Rename `DONUT_COLORS` to `CATEGORY_COLORS` while retaining the same four chart CSS variables.

- [ ] **Step 2: Sort category aggregation stably by count**

Change the return expression in `buildCategoryBreakdown` to:

```ts
return Array.from(map.entries())
  .map(([type, value], index) => ({ type, value, index }))
  .sort((left, right) => right.value - left.value || left.index - right.index)
  .map(({ type, value }) => ({ type, value }));
```

- [ ] **Step 3: Render the horizontal bar chart**

Replace the donut, center total, and manual legend list with one responsive chart container:

```tsx
<div
  data-layout="horizontal-category-bars"
  className="w-full"
  style={{ height: Math.max(320, categoryData.length * 34) }}
>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      layout="vertical"
      data={categoryData}
      margin={{ top: 4, right: 96, left: 8, bottom: 4 }}
    >
      <XAxis type="number" allowDecimals={false} />
      <YAxis type="category" dataKey="type" width={100} interval={0} />
      <Tooltip />
      <Bar dataKey="value" name="单数" radius={[0, 4, 4, 0]} maxBarSize={22}>
        {categoryData.map((_, index) => (
          <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
```

Keep `Cell` because it supplies per-category colors. Add a Recharts `LabelList` whose formatter finds the current value's percentage against `categoryTotal` and outputs `数量（占比）`; place labels at `right`.

- [ ] **Step 4: Run focused test and verify GREEN**

Run:

```powershell
pnpm exec vitest run client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Format only touched source files**

Run:

```powershell
pnpm exec prettier --write client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
```

### Task 3: Verify and commit

**Files:**
- Verify: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx`
- Verify: `client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx`

- [ ] **Step 1: Run the full test suite**

Run `pnpm exec vitest run`.

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run TypeScript and formatting checks**

Run:

```powershell
pnpm exec tsc --noEmit
pnpm exec prettier --check client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
git diff --check
```

Expected: every command exits with code 0.

- [ ] **Step 3: Verify the local dashboard**

Run `pnpm run dev:dashboard:status`.

Expected: `LOCAL_DASHBOARD_READY`, frontend status 200, and API health status 200.

- [ ] **Step 4: Commit only task files**

Run:

```powershell
git add -- client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
git commit --only -m "feat: show product categories as horizontal bars" -- client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.tsx client/src/pages/dashboard/components/EngineeringSpecAnalyticsDashboard.test.tsx
```

Do not include the unrelated integral-ball or dashboard-access files already present in the working tree.
