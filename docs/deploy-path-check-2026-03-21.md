# Deploy Path Check Report (2026-03-21)

## Scope
- Run local dashboard
- Make a small visible change
- Deploy to server using `deploy.ps1` artifact flow
- Verify end-to-end deployment path and record issues

## Change Applied
- File: `client/src/pages/dashboard/DashboardHome.tsx`
- Change: updated subtitle text to include deployment-path marker
- Final text: `项目状态可视化管理系统 · 部署链路验证`
- Commit: `7a1ba26` (`chore(dashboard): add deployment path verification label`)

## Local Run Check
- Local API health:
  - `http://127.0.0.1:3001/api/health` returned `{"ok":true,"api":true,"db":"ok"}`
- Local dashboard page:
  - `http://127.0.0.1:3000` returned HTTP 200
- Note:
  - Frontend dev server was on port `3000` (not `5173`)

## Deployment Command
- Executed:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Mode all -VersionBump minor -ReleaseNote "看板文案追加部署链路验证标识" -ConfirmProduction -ConfirmText "DEPLOY_PROD"`

## Build + Verification Gates
- TypeScript verification: passed
- Client release guard tests: passed (15 tests)
- Server release guard tests: passed (21 tests)
- Local OSS smoke (`scripts/verify-local-oss-smoke.ps1` on port `3301`): passed

## Artifact Output
- Version plan: remote `11.2.6` -> target `11.2.7`
- Artifact:
  - `artifacts/releases/release-v11.2.7-c7a1ba26-20260321-080842.tar.gz`
- Metadata:
  - `artifacts/releases/release-v11.2.7-c7a1ba26-20260321-080842.metadata.json`
- SHA256:
  - `artifacts/releases/release-v11.2.7-c7a1ba26-20260321-080842.tar.gz.sha256`

## Remote Deploy Validation
- Remote deploy + PM2 restart: succeeded
- Remote health check: passed
- Remote release endpoint:
  - `curl http://127.0.0.1:3000/api/release`
  - Returned version `11.2.7`, commit `7a1ba26...`
- Remote OSS upload/proxy/delete smoke: passed
- Release history append: succeeded

## Issues Encountered (and Handling)
1. Workspace dirty guard before release build
   - Cause: local uncommitted changes existed in `AGENTS.md` and `deploy.ps1`
   - Handling: staged only target file, stashed unrelated local changes with `--keep-index`, committed deploy target change, ran release, then restored stash
   - Result: release guard satisfied, original local changes restored

2. Initial local startup check targeted wrong frontend port
   - Cause: expected default Vite port `5173`
   - Actual: project serves frontend on `3000` in this setup
   - Handling: switched probe to `http://127.0.0.1:3000`
   - Result: local dashboard verification passed

## Final Outcome
- End-to-end path is healthy:
  - local run -> small change -> artifact build -> server deploy -> remote health -> remote OSS smoke
- No blocking failures remained.
