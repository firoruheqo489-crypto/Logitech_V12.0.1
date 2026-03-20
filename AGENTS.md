# Repo Guardrails

For any request to deploy or upload this project to the server, use [`deploy.ps1`](/d:/V6.3/HT/V3/deploy.ps1) instead of ad-hoc `scp`, `ssh`, or manual PM2 commands.

Before deployment, run the built-in OSS gate:
- `pnpm run verify:oss-api:local`

Key deployment rules:
- `.env` is the deploy source of truth. The server loads and the deploy script uploads `.env`, not `.env.local`.
- `scripts/verify-local-oss-smoke.ps1` auto-fills missing local OSS keys from `.env.local` into `.env` when possible, then starts an isolated API and verifies upload, proxy redirect, and delete.
- `deploy.ps1` must keep the OSS smoke gate enabled locally before upload and remotely after PM2 restart.
