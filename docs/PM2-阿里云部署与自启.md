# PM2 阿里云部署与自启

## 1) 服务器首次准备（仅一次）

```bash
# Node / pnpm 省略（按你现有环境）
npm i -g pm2
```

全局开机自启（root 账号，阿里云轻量常见场景）:

```bash
pm2 startup systemd -u root --hp /root
pm2 save
```

## 2) 在项目目录部署并启动

```bash
cd /var/www/logitech
pnpm install --prod
pnpm build
pm2 start ecosystem.config.cjs --only mold-gantt-v3 --env production
pm2 save
```

## 3) 配置开机自启（仅一次）

```bash
pm2 startup
# 按输出再执行一条 sudo 命令
pm2 save
```

若你使用 root，优先使用上一节的固定命令（更可复制、无需二次解析输出）。

## 4) 日常运维

```bash
cd /var/www/logitech
pm2 status
pm2 logs mold-gantt-v3
pm2 restart ecosystem.config.cjs --only mold-gantt-v3 --update-env
```

## 5) 验证

```bash
curl http://127.0.0.1:3000/api/health
```

返回 `{"ok":true,"api":true,"db":"ok"}` 即正常。
