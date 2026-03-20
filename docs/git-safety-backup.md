# Git Safety Backup

This project now includes a Git-backed safety snapshot tool.

## Commands

```bash
pnpm git-backup:create before-pdm-layout
pnpm git-backup:list
pnpm git-backup:restore 20260315-230000-before-pdm-layout
pnpm git-backup:prune 30
```

## What It Does

- `git-backup:create`
  Creates a snapshot commit under `refs/safety-snapshots/...`.
- `git-backup:list`
  Lists available snapshots.
- `git-backup:restore`
  Restores the working tree to a saved snapshot.
- `git-backup:prune`
  Deletes older snapshots and keeps the newest ones.

## Safety Notes

- Snapshots are stored inside `.git` refs, so they do not add files to the working tree.
- `restore` automatically creates one more safety snapshot before rolling back.
- Restoring a snapshot rewrites the current working tree files to match that snapshot.

## Recommended Workflow

```bash
pnpm git-backup:create before-any-risky-change
```

Then edit code. If something goes wrong:

```bash
pnpm git-backup:list
pnpm git-backup:restore <snapshot-id>
```
