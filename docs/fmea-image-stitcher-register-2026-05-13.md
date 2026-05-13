# FMEA + Image Stitcher Register (2026-05-13)

## Purpose

This document is the formal register for two active frontend workstreams in the current workspace:

1. `FMEA Lighting Line`
2. `Image Stitcher Line`

The goal is to make later rollback, scope control, and human `git commit` registration easier.

## Rollback Handle

- Local rollback snapshot ID: `20260513-165857-fmea-image-stitcher-register-20260513`
- Create time: `2026-05-13`
- Restore command:

```bash
pnpm rollback:restore 20260513-165857-fmea-image-stitcher-register-20260513
```

Notes:

- The snapshot is local-only and stored under `.rollback/entries/`.
- It is not a substitute for human `git commit`.
- It is intended as a fast safety handle before further UI or module changes.

## Workstream A: FMEA Lighting Line

### Current Status

- Status: `Active`
- Scope owner: FMEA dashboard workspace
- Current UI baseline: keep the lighting-oriented left BOM tree and lighting data model, but the premium SaaS-style right-side grid experiment has been rolled back.

### Stable Baseline Registered

The following decisions are part of the current stable baseline:

1. Left-side BOM tree remains lighting-industry specific.
2. Lighting FMEA data model remains in place, including classification, cross-risk, DVP&R links, owner gate, and severity lock logic.
3. Right-side FMEA area is currently the simpler table baseline, not the later SaaS data-grid experiment.
4. The recent premium execution-matrix UI experiment is explicitly not the baseline.

### File Scope

- `client/src/components/fmea/bom-sidebar.tsx`
- `client/src/components/fmea/fmea-data-grid.tsx`
- `client/src/components/fmea/status-bar.tsx`
- `client/src/components/fmea/top-bar.tsx`
- `client/src/lib/fmea-data.ts`
- `client/src/pages/dashboard/components/FmeaAnalysisWorkspace.tsx`

### Important Boundary

When changing FMEA again, treat the following as separate lines:

- `lighting data model / severity policy`
- `left-side BOM ownership structure`
- `right-side grid visual experiment`

Do not mix all three into one rollback decision unless explicitly intended.

## Workstream B: Image Stitcher Line

### Current Status

- Status: `Active / In Progress`
- Module ID: `image-stitcher`
- Dashboard registration status: already inserted after `pareto-analysis`
- Exposure: public dashboard tab

### Registered Module State

The image stitching line is now formally registered as an active module branch in this workspace.

Current registered scope includes:

1. Dashboard tab registration in the existing tab system.
2. Lazy-loaded workspace shell.
3. Fabric.js-based stitching workspace and helper hooks/components.
4. Kiro spec package for requirements, design, and task traceability.

### File Scope

- `client/src/pages/dashboard/DashboardHome.tsx`
- `client/src/pages/dashboard/components/ImageStitcherWorkspace.tsx`
- `client/src/pages/dashboard/components/image-stitcher/types.ts`
- `client/src/pages/dashboard/components/image-stitcher/stitchingEngine.ts`
- `client/src/pages/dashboard/components/image-stitcher/ImageDropZone.tsx`
- `client/src/pages/dashboard/components/image-stitcher/ImageStitcherToolbar.tsx`
- `client/src/pages/dashboard/components/image-stitcher/useCanvasManager.ts`
- `client/src/pages/dashboard/components/image-stitcher/useHistoryManager.ts`
- `client/src/pages/dashboard/components/image-stitcher/useAnnotationTools.ts`
- `.kiro/specs/image-stitcher-tool/requirements.md`
- `.kiro/specs/image-stitcher-tool/design.md`
- `.kiro/specs/image-stitcher-tool/tasks.md`
- `package.json`
- `pnpm-lock.yaml`

### Deferred / Refugee Register

The following items are intentionally registered as still-open, not forgotten:

1. Optional property tests listed in `.kiro/specs/image-stitcher-tool/tasks.md`
2. Final visual polish beyond MVP workflow
3. Any future export, annotation, or UX refinement outside the current stable module shell

## Do-Not-Mix Boundary

For future rollback hygiene, do not silently bundle the following into this register:

- `part-fai-parser` line
- unrelated dashboard cards or tabs
- package dependency updates unrelated to Image Stitcher
- broad FMEA visual overhauls unless re-registered

If those lines need to move, create a new register or a new rollback snapshot first.

## Human Git Registration Guidance

Recommended sequence for later human registration:

1. Review this register and confirm scope.
2. Run `git diff --name-only` and keep the commit scope aligned with one line at a time.
3. Prefer separate commits for:
   - `FMEA lighting baseline adjustments`
   - `Image Stitcher module`
4. Keep this register file in the same commit as the first code commit that formalizes the line.

## Re-open Trigger

This register should be updated or replaced when:

1. FMEA right-side UI is re-attempted with a new visual direction.
2. Image Stitcher leaves MVP scope and enters a test-hardening or production-hardening phase.
3. A human developer creates the official `git commit` record and wants a narrower follow-up register.
