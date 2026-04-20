# Local Dashboard Fix Log (2026-04-20)

## Scope

- Problem class: local dashboard startup/status probe instability.
- Target: avoid startup/status hard-fail when DB is degraded but API is reachable.

## Root Cause (confirmed)

- `scripts/start-local-dashboard.mjs` treated API as ready only when `/api/health` returned `ok=true && api=true`.
- In DB timeout windows (`CONNECT_TIMEOUT`), API could be up while `ok=false`, causing false-negative readiness and startup failure.

## Changes Applied

1. `scripts/start-local-dashboard.mjs`
- Relaxed API readiness check:
  - from `payload.ok === true && payload.api === true`
  - to `payload.api === true`
- Added readiness log with DB state marker:
  - `db-ready` / `db-degraded`

2. `scripts/report-local-dashboard-state.ps1`
- Replaced strict `Invoke-RestMethod` path with resilient JSON probe that can read non-200 responses.
- API health pass condition updated to:
  - payload present and `api == true`
- Added output fields:
  - `API_DB_OK`
  - `API_HEALTH_STATUS`

## Verification Notes

- Startup flow can now pass when API is reachable even if DB is degraded.
- Existing intermittent process-exit behavior after startup is a separate runtime issue and not part of this probe-logic fix.

## Files Modified

- `scripts/start-local-dashboard.mjs`
- `scripts/report-local-dashboard-state.ps1`
