# 本地回滚机制

这个项目现在带了一套不依赖编辑器撤销栈的本地快照回滚工具。

## 常用命令

```bash
pnpm rollback:create before-header
pnpm rollback:list
pnpm rollback:restore 20260314-153000-before-header
pnpm rollback:prune 20
```

## 用法说明

1. 在大改之前先执行一次快照。
2. 如果不传文件路径，会为主要项目目录创建默认快照。
3. 如果只想保护局部文件，也可以指定路径。

```bash
pnpm rollback:create before-theme client/src/lib/theme.ts client/src/components/ProjectLobby.tsx
```

## 快照存放位置

快照保存在项目根目录的 `.rollback/entries/`。

这个目录已经加入 `.gitignore`，不会污染版本库。
