# Repo Guardrails

For any request to deploy or upload this project to the server, use the artifact-driven flow via [`deploy.ps1`](/d:/V6.3/HT/V3/deploy.ps1) instead of ad-hoc `scp`, `ssh`, or manual PM2 commands.

Recommended release commands:
- Build artifact only: `.\deploy.ps1 -Mode build -VersionBump minor -ReleaseNote "one-line release note"`
- Deploy existing artifact: `.\deploy.ps1 -Mode deploy -ArtifactPath <artifact.tar.gz> -MetadataPath <artifact.metadata.json>`
- End-to-end (build + deploy): `.\deploy.ps1 -Mode all -VersionBump major|minor -ReleaseNote "one-line release note"`

Before deployment, run the built-in OSS gate:
- `pnpm run verify:oss-api:local`

Key deployment rules:
- Release artifacts are immutable deploy units (`build once, deploy many`).
- `.env` remains on the server as runtime source of truth and is not packed into release artifacts.
- `scripts/verify-local-oss-smoke.ps1` auto-fills missing local OSS keys from `.env.local` into `.env` when possible, then starts an isolated API and verifies upload, proxy redirect, and delete.
- `deploy.ps1` must keep the OSS smoke gate enabled during artifact build and after remote deploy restart.
