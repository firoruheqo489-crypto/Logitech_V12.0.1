# AI Coding Safety Checkpoint Runbook

## 目的

这份文档是给“AI 高频改代码 + 本地工作区经常很脏 + 网络偶尔不稳定”的场景准备的最低复杂度方案。

目标只有三件事：

1. 每次重要改动前，先打一个可恢复快照。
2. 快照自动推送到本地离线备份仓库，避免只依赖远端网络仓库。
3. 需要回滚时，1-2 条命令可以恢复。

## 一条命令（建议每天多次执行）

```bash
pnpm run safe:checkpoint -- --label "short-note"
```

示例：

```bash
pnpm run safe:checkpoint -- --label "before-reliability-refactor"
```

执行后会自动完成：

- 创建 Git 安全快照（`refs/safety-snapshots/*`）
- 检查工作区是否脏
- 推送分支、标签、快照到本地 `backup` 远程（默认 `D:\git-backup\V3.git`）

## 如果你希望顺手自动提交当前工作区

```bash
pnpm run safe:checkpoint:auto -- --label "short-note"
```

或：

```bash
pnpm run safe:checkpoint -- --label "short-note" --auto-commit
```

## 查看帮助

```bash
pnpm run safe:checkpoint:help
```

## 口令化快捷命令（避免语义混淆）

```bash
pnpm run intent:status
pnpm run intent:open:local
pnpm run intent:open:server
pnpm run intent:before-change -- --Label "before-edit-reliability"
```

语义固定如下：

- `intent:open:local` = 打开本地源码看板（`http://localhost:3000`），不是历史版本或其他环境。
- `intent:open:server` = 打开阿里云服务器看板。
- `intent:before-change` = 改源码前先强制创建存档（安全快照）。

## 误删/错改后的恢复流程

1. 查看快照列表：

```bash
pnpm run git-backup:list
```

2. 选择一个快照 ID 恢复：

```bash
pnpm run git-backup:restore <snapshot-id>
```

说明：`restore` 前会自动再创建一个“恢复前快照”，防止二次误操作。

## 建议操作节奏（低复杂度版本）

1. 开工前先 `safe:checkpoint` 一次。
2. 完成一个功能块再 `safe:checkpoint` 一次。
3. 做预览/部署前再 `safe:checkpoint` 一次。

## 与发布流程的衔接

根据仓库 guardrails，发布必须走 single-track flow：

```bash
pnpm run board:flow:status
pnpm run board:flow:preview -- -ReleaseNote "one-line release note"
pnpm run verify:oss-api:local
pnpm run board:flow:deploy
```

建议把 `safe:checkpoint` 放在 `board:flow:preview` 之前执行，确保任何时候都能回到最近安全点。
