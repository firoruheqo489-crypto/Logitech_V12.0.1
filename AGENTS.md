# Repo Guardrails

For any request to deploy or upload this project to the server, use the artifact-driven flow via [`deploy.ps1`](/d:/V6.3/HT/V3/deploy.ps1) instead of ad-hoc `scp`, `ssh`, or manual PM2 commands.

## Default Path (Mandatory)

All future conversations must use this default single-track path and must not depend on prior chat context:

1. Local source change.
2. Build + local preview using the same artifact.
3. Deploy that exact preview-validated artifact to server.

Use these commands by default:
- Status check: `pnpm run board:flow:status`
- Local preview from current source: `pnpm run board:flow:preview -- -ReleaseNote "one-line release note"`
- Deploy the exact artifact validated in preview: `pnpm run board:flow:deploy`
- Convenience launcher for routine releases: `board-release.cmd "one-line release note"` or `pnpm run board:flow:ship -- -ReleaseNote "one-line release note"`
- The convenience launcher still follows the same single-track path: OSS smoke -> preview artifact -> explicit confirm -> deploy the exact validated artifact

Before deployment, run the built-in OSS gate:
- `pnpm run verify:oss-api:local`

Key deployment rules:
- Release artifacts are immutable deploy units (`build once, deploy many`).
- Deploy is guarded by `single-track-active.json`; deploy is blocked if preview was not run first, or if artifact/metadata do not match preview state.
- `deploy.ps1 -Mode all` is blocked by default under single-track policy.
- Do not use ad-hoc deploy paths (`scp`, manual PM2 restart, or direct remote file replacement).
- If emergency bypass is truly required, it must be explicit via `deploy.ps1 -AllowDirectDeploy` and documented in release note.
- `.env` remains on the server as runtime source of truth and is not packed into release artifacts.
- `scripts/verify-local-oss-smoke.ps1` auto-fills missing local OSS keys from `.env.local` into `.env` when possible, then starts an isolated API and verifies upload, proxy redirect, and delete.
- `deploy.ps1` must keep the OSS smoke gate enabled during artifact build and after remote deploy restart.
