# Single-Track Release Flow (Default)

This repository uses a strict single-track release flow:

1. Edit source locally.
2. Run local preview from built artifact.
3. Deploy the exact artifact that passed local preview.

## Commands

Run status:

```powershell
pnpm run board:flow:status
```

Run preview (build + local artifact runtime):

```powershell
pnpm run board:flow:preview -- -ReleaseNote "one-line release note"
```

Deploy the same preview-validated artifact:

```powershell
pnpm run board:flow:deploy
```

## One-Time Deploy Setup

Keep machine-specific SSH settings in `deploy.local.json` (copy from `deploy.local.example.json` if needed).

Generate or refresh the local deploy key:

```powershell
pnpm run deploy:key:init
```

Test SSH connectivity before the first deploy:

```powershell
pnpm run deploy:ssh:test
```

## Guardrails

- `deploy.ps1 -Mode all` is blocked by default.
- `deploy.ps1 -Mode deploy` is blocked unless artifact + metadata match `artifacts/releases/single-track-active.json`.
- Manual deploy paths (`scp`, manual PM2 restarts without artifact flow) are not allowed.

## Emergency Bypass

Use only for incident response, with explicit approval and audit trail:

```powershell
.\deploy.ps1 -Mode deploy -ArtifactPath <artifact.tar.gz> -MetadataPath <artifact.metadata.json> -AllowDirectDeploy
```
