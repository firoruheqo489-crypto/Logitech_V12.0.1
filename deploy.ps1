# ============================================================================
# deploy.ps1 — Windows PowerShell 一键部署到阿里云
# ============================================================================
# 使用方法: .\deploy.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

# ======================== 配置区 ========================
$SERVER_IP   = "120.27.153.140"
$SERVER_USER = "root"
$SERVER_PORT = "22"
$REMOTE_DIR  = "/var/www/logitech"
$PM2_APPS    = @("logitech", "mold-gantt-v3")
# ========================================================

$SSH_HOST = "aliyun"  # 使用 ~/.ssh/config 中的 Host 别名（含密钥配置）
$DEST = $SSH_HOST

function Log($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

# ======================== 第1步：本地构建 ========================
Log "开始本地构建..."
pnpm build
if ($LASTEXITCODE -ne 0) { Err "构建失败" }
Log "构建完成 -> dist/"

# ======================== 第2步：上传文件 ========================
Log "上传文件到 ${DEST}:${REMOTE_DIR} ..."

# 确保远程目录存在
ssh $DEST "mkdir -p $REMOTE_DIR"

# 备份当前版本（回滚用）
ssh $DEST "if [ -d ${REMOTE_DIR}/dist ]; then rm -rf ${REMOTE_DIR}/dist.prev; cp -a ${REMOTE_DIR}/dist ${REMOTE_DIR}/dist.prev; fi"

# 上传 dist（前端 + 后端 bundle）
Log "  上传 dist/ ..."
scp -r dist/ "${DEST}:${REMOTE_DIR}/"

# 上传 package.json / lockfile
Log "  上传 package.json, pnpm-lock.yaml ..."
scp package.json pnpm-lock.yaml "${DEST}:${REMOTE_DIR}/"

# 上传 PM2 配置
Log "  上传 ecosystem.config.cjs ..."
scp ecosystem.config.cjs "${DEST}:${REMOTE_DIR}/"

# 上传 patches
if (Test-Path patches) {
    Log "  上传 patches/ ..."
    scp -r patches/ "${DEST}:${REMOTE_DIR}/"
}

# 上传 .env
if (Test-Path .env) {
    Log "  上传 .env ..."
    scp .env "${DEST}:${REMOTE_DIR}/"
} else {
    Warn ".env 文件不存在，跳过（服务器上需要手动创建）"
}

# 上传 drizzle 迁移
if (Test-Path drizzle) {
    Log "  上传 drizzle/ ..."
    scp -r drizzle/ "${DEST}:${REMOTE_DIR}/"
}

Log "文件上传完成"

# ======================== 第3步：服务器安装依赖 ========================
Log "服务器端安装依赖..."
$installCmd = @(
    "cd /var/www/logitech",
    "if ! command -v pm2 > /dev/null 2>&1; then npm install -g pm2; fi",
    "if command -v systemctl > /dev/null 2>&1; then if [ ! -f /etc/systemd/system/pm2-root.service ]; then pm2 startup systemd -u root --hp /root || true; fi; fi",
    "pnpm install --prod",
    "echo DEPS_DONE"
) -join " && "
ssh $DEST $installCmd
Log "依赖安装完成"

# ======================== 第4步：PM2 重启 ========================
Log "重启 PM2 进程..."
$restartCmd = @(
    "cd /var/www/logitech",
    "if pm2 describe logitech > /dev/null 2>&1; then pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then pm2 restart mold-gantt-v3 --update-env; else pm2 start ecosystem.config.cjs --only mold-gantt-v3 --env production && pm2 save; fi",
    "pm2 status"
) -join " && "
ssh $DEST $restartCmd
Log "PM2 重启完成"

# ======================== 第5步：健康检查 ========================
Log "执行健康检查（最多等待 20 秒）..."
$healthOk = $false
for ($i = 1; $i -le 10; $i++) {
    $result = ssh $DEST "curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || echo FAIL"
    if ($result -match '"ok":true') {
        Log "健康检查通过: $result"
        $healthOk = $true
        break
    }
    Write-Host "  重试 $i/10 ..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if (-not $healthOk) {
    Warn "健康检查失败，尝试自动回滚..."
    $primaryApp = $PM2_APPS[0]
    $rollbackCmd = @(
        "if [ -d /var/www/logitech/dist.prev ]; then rm -rf /var/www/logitech/dist && mv /var/www/logitech/dist.prev /var/www/logitech/dist && pm2 restart ${primaryApp} --update-env && echo ROLLED_BACK; else echo NO_BACKUP; fi",
        "pm2 logs ${primaryApp} --lines 30 --nostream || true"
    ) -join " ; "
    ssh $DEST $rollbackCmd
    Err "部署失败，已尝试回滚"
}

# ======================== 完成 ========================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Log "部署成功!"
Write-Host "  访问地址: http://${SERVER_IP}:3000" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
