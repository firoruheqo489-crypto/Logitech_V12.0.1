# Release Truth And Handoff Checklist

Start here in any new conversation.

## Primary working path

- Clean handoff worktree:
  `d:\V6.3\HT\V3\.codex-release-handoff-ready`

## First checks in a new conversation

1. Verify the running server first:
   - `curl http://120.27.153.140:3000/api/release`
   - `curl http://120.27.153.140:3000/api/health`
2. Verify the clean handoff worktree commit:
   - `git -C d:\\V6.3\\HT\\V3\\.codex-release-handoff-ready rev-parse HEAD`
3. Only deploy from the clean handoff worktree, not from the dirty main workspace.

## Guaranteed guardrails in this worktree

- `pnpm build` writes `dist/release.json`
- `GET /api/release` returns the running commit/build metadata
- `deploy.ps1` refuses dirty worktrees
- `deploy.ps1` verifies remote `/api/release` commit after restart
- `deploy.ps1` runs a same-origin write smoke test after restart
- `saveProgressNotes` rejects destructive snapshot deletes unless the caller explicitly confirms with:
  - `x-snapshot-confirmation: allow-destructive`

## Recommended deploy command

Run the deploy script that lives inside the clean handoff worktree:

```powershell
powershell -ExecutionPolicy Bypass -File d:\V6.3\HT\V3\.codex-release-handoff-ready\deploy.ps1 -VersionBump none -DeployRoot d:\V6.3\HT\V3\.codex-release-handoff-ready
```
