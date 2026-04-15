# Repo Guardrails

## Local Dashboard Startup

When the user says "start the local dashboard", "bring up the local dashboard", or similar, treat it as a request to start the local V3 dashboard in this workspace.

Use this standard command from `D:\V6.3\HT\V3`:
- `pnpm run dev:dashboard:local`
- Then always verify and report the resolved URLs with: `pnpm run dev:dashboard:status`

Do not guess Vite's default port, and do not hand-roll `Start-Process`, `cmd`, or mixed background launch commands.

Success criteria:
- `D:\V6.3\HT\V3\.codex-local-dashboard.state.json` exists
- `http://localhost:3001/api/health` returns `ok`
- The frontend URL must be read from `.codex-local-dashboard.state.json` field `frontendUrl`
- `pnpm run dev:dashboard:status` must succeed and print the resolved frontend URL
- If startup output looks empty, treat that as non-blocking and use `pnpm run dev:dashboard:status` instead of guessing

If startup fails, inspect these logs first:
- `D:\V6.3\HT\V3\.codex-local-dashboard.out.log`
- `D:\V6.3\HT\V3\.codex-local-dashboard.err.log`
- `D:\V6.3\HT\V3\.codex-local-vite*.log`

For any request to deploy or upload this project to the server, use the artifact-driven flow via [`deploy.ps1`](/d:/V6.3/HT/V3/deploy.ps1) instead of ad-hoc `scp`, `ssh`, or manual PM2 commands.

Recommended release commands:
- Canonical release entrypoint: `pnpm run release`
- Internal build helper: `pnpm run _release:build -- -ReleaseNote "one-line release note"`
- Internal deploy helper: `pnpm run _release:deploy -- -ArtifactPath <artifact.tar.gz> -MetadataPath <artifact.metadata.json>`
- Direct wrapper, same semantics as `pnpm run release`: `.\scripts\release-from-clean-worktree.ps1 -Mode all -ReleaseNote "one-line release note"`
- Remote deploy root defaults to `/var/www/logitech`; if the server uses a different absolute Unix path, pass `-RemoteDir /abs/path` or set `DEPLOY_REMOTE_DIR`. Keep the path simple and shell-safe.

Before deployment, run the built-in OSS gate:
- `pnpm run verify:oss-api:local`

Key deployment rules:
- `deploy.ps1` defaults to safe `build` mode. It no longer defaults to production deploy.
- `pnpm run release` is the only approved full release entrypoint.
- The release wrapper now refuses dirty workspaces before backup, so manual `git commit` happens first.
- Release artifacts are immutable deploy units (`build once, deploy many`).
- `.env` remains on the server as runtime source of truth and is not packed into release artifacts.
- `scripts/verify-local-oss-smoke.ps1` auto-fills missing local OSS keys from `.env.local` into `.env` when possible, then starts an isolated API and verifies upload, proxy redirect, and delete.
- `scripts/release-from-clean-worktree.ps1` is the release wrapper; it runs a clean check, then backup, then build, then deploy.
- Release artifacts include a `.sha256` sidecar, and `deploy-release-artifact.ps1` verifies it on the remote host before extraction when the checksum is available.
- `deploy.ps1` must keep the OSS smoke gate enabled during artifact build and after remote deploy restart.
