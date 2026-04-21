# P2 Performance Board Freeze Register (2026-04-21)

## Purpose

This document is the formal registry record for the P2 parallel performance line freeze.

## Scope Closed

- Workstream: `P2 Performance and Engineering Hygiene`
- Freeze date: `2026-04-21`
- Status: `Closed`
- Policy: no further deep performance optimization in this line unless explicitly re-opened.

## Completed Before Freeze

1. Enabled production minification for JS and CSS.
2. Added chunk split strategy in Vite build output.
3. Reduced entry and dashboard critical payload significantly.
4. Removed duplicated backend route registration for `/api/release`.

## Deferred / Registered Items (Refugee Register)

The following items are intentionally deferred and registered, not dropped:

1. Further preload-chain pruning for score-oriented tuning.
2. Deep split/rewrite for `pdf.worker` loading behavior.
3. Deep split/rewrite for `exceljs` loading behavior.
4. Additional critical-CSS extraction and page-level CSS partitioning.
5. Strict CI chunk budget gates for this line.
6. Lighthouse/Web Vitals score-driven follow-up optimization.

## Explicit Do-Not-Touch Boundary

Under the current freeze decision, do not modify:

- `pdf.worker` low-level loading mechanism
- `exceljs` low-level loading mechanism

## Re-open Trigger

This line can be re-opened only by explicit product/owner instruction, or by a new blocking business requirement proving current performance is insufficient for internal dashboard usage.

