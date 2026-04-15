# Release Truth And Handoff Checklist

Start here in any new conversation that inherits this project.

## Primary working path

- Clean handoff worktree:
  `d:\V6.3\HT\V3\.codex-release-handoff-ready`
- Verified branch:
  `codex/release-handoff-ready`
- Resolve the current handoff commit with:
  `git -C d:\\V6.3\\HT\\V3\\.codex-release-handoff-ready rev-parse HEAD`
- Last observed deployed snapshot worktree:
  `d:\V6.3\HT\V3\.codex-release-handoff-ready\.codex-deploy-ready-current`

## Server-first triage

1. Query the running server before trusting any local workspace:
   - `curl http://120.27.153.140:3000/api/release`
   - `curl http://120.27.153.140:3000/api/health`
2. Compare the server `commit` from `/api/release` with the clean handoff worktree commit:
   - `git -C d:\\V6.3\\HT\\V3\\.codex-release-handoff-ready rev-parse HEAD`
3. If the server commit and the clean handoff worktree do not match, stop and reconcile that gap before making more code changes.
4. Only deploy from the clean handoff worktree, not from the dirty main workspace.

## Release guarantees now enforced

- `pnpm build` writes `dist/release.json`.
- `GET /api/release` returns the running build version, commit, build timestamp, and dirty-tree flag.
- `deploy.ps1` in the clean handoff worktree refuses dirty worktrees.
- `deploy.ps1` in the clean handoff worktree verifies that the remote `/api/release` commit matches the local deploy commit after PM2 restart.
- `deploy.ps1` in the clean handoff worktree runs a same-origin browser-write smoke test against:
  - `POST /api/dashboard/progress-notes/CODEX_DEPLOY_PROBE/create-backup`
- `saveProgressNotes` rejects destructive snapshot deletes unless the caller explicitly confirms with:
  - `x-snapshot-confirmation: allow-destructive`

## Safe continuation rule

If a new conversation starts with limited context, it should first establish:

1. what commit the server is actually running,
2. what commit the clean handoff tree holds,
3. whether the task touches a guarded route such as `progress-notes`,
4. whether the change belongs in a fresh clean verification tree before any deployment.

## Deploy command

Use the canonical release entrypoint from the clean handoff worktree:

```powershell
pnpm run release
```
