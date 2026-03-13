# ============================================================================
# deploy-lobby.ps1 — 大厅 UI 两个 Next.js 项目一键部署到阿里云
# 方案: tar.gz 打包 → 单文件 SCP → 服务端解压（比逐文件 scp 快 ~5-10 倍）
# 部署路径:
#   /var/www/lobby-v1  (V0-0312DATING,               端口 3010)
#   /var/www/lobby-v2  (b_44Zays25yCM-1773305939377, 端口 3011)
# ============================================================================
# 使用方法: .\deploy-lobby.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

# ======================== 配置区 ========================
$SERVER_IP = "120.27.153.140"
$DEST      = "aliyun"   # ~/.ssh/config 中的 Host 别名，与 deploy.ps1 保持一致
$V1_LOCAL  = "$PSScriptRoot\V0-0312DATING"
$V2_LOCAL  = "$PSScriptRoot\b_44Zays25yCM-1773305939377"
$V1_REMOTE = "/var/www/lobby-v1"
$V2_REMOTE = "/var/www/lobby-v2"
$TMP       = $env:TEMP
# ========================================================

function Log($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

# ======================== 辅助: 打包 + 上传 + 解压 ========================
function Deploy-Project {
    param(
        [string]$Name,         # "V1" / "V2"
        [string]$LocalDir,     # 本地项目根目录
        [string]$RemoteDir     # 服务器目标目录
    )

    # Next.js monorepo standalone 会按工作区层级嵌套，动态定位 server.js 所在目录
    $serverJsPath = Get-ChildItem "$LocalDir\.next\standalone" -Recurse -Filter "server.js" `
        | Where-Object { $_.DirectoryName -notmatch "node_modules" } `
        | Select-Object -First 1
    if (-not $serverJsPath) { Err "${Name}: 找不到 standalone/server.js" }
    $standaloneDir = $serverJsPath.DirectoryName
    Log "${Name}: standalone 根目录 = $standaloneDir"

    $staticDir     = "$LocalDir\.next\static"
    $publicDir     = "$LocalDir\public"
    $envFile       = "$LocalDir\.env.local"

    $archiveMain   = "$TMP\lobby-${Name}-main.tar.gz"
    $archiveStatic = "$TMP\lobby-${Name}-static.tar.gz"

    # --- 打包 standalone（从实际 server.js 所在目录）---
    Log "${Name}: 打包 standalone → $archiveMain"
    Remove-Item $archiveMain -ErrorAction SilentlyContinue
    tar czf $archiveMain -C $standaloneDir .
    if ($LASTEXITCODE -ne 0) { Err "${Name}: tar standalone 失败" }

    # --- 打包 static ---
    Log "${Name}: 打包 static → $archiveStatic"
    Remove-Item $archiveStatic -ErrorAction SilentlyContinue
    tar czf $archiveStatic -C $staticDir .
    if ($LASTEXITCODE -ne 0) { Err "${Name}: tar static 失败" }

    # --- 服务端建目录 ---
    ssh $DEST "mkdir -p ${RemoteDir}/.next/static ${RemoteDir}/public"

    # --- SCP: 2 个文件 ---
    Log "${Name}: 上传 main.tar.gz ..."
    scp $archiveMain "${DEST}:/tmp/"
    Log "${Name}: 上传 static.tar.gz ..."
    scp $archiveStatic "${DEST}:/tmp/"

    # --- 上传 public（如存在）---
    if (Test-Path $publicDir) {
        $archivePublic = "$TMP\lobby-${Name}-public.tar.gz"
        tar czf $archivePublic -C $publicDir .
        scp $archivePublic "${DEST}:/tmp/"
        $extractPublic = "tar xzf /tmp/lobby-${Name}-public.tar.gz -C ${RemoteDir}/public && rm /tmp/lobby-${Name}-public.tar.gz"
    } else {
        $extractPublic = "true"
    }

    # --- 上传 .env.local ---
    scp $envFile "${DEST}:${RemoteDir}/.env.local"

    # --- 服务端解压 ---
    Log "${Name}: 服务端解压..."
    $extractCmd = @(
        "tar xzf /tmp/lobby-${Name}-main.tar.gz   -C ${RemoteDir}",
        "tar xzf /tmp/lobby-${Name}-static.tar.gz -C ${RemoteDir}/.next/static",
        $extractPublic,
        "rm -f /tmp/lobby-${Name}-main.tar.gz /tmp/lobby-${Name}-static.tar.gz"
    ) -join " && "
    ssh $DEST $extractCmd

    # --- 清理本地临时文件 ---
    Remove-Item $archiveMain, $archiveStatic -ErrorAction SilentlyContinue

    Log "${Name}: 上传完成"
}

# ======================== 第1步：本地构建 ========================
Log "构建 V1 (V0-0312DATING)..."
Push-Location $V1_LOCAL
npx next build
if ($LASTEXITCODE -ne 0) { Pop-Location; Err "V1 构建失败" }
Pop-Location
Log "V1 构建完成"

Log "构建 V2 (ProjectLobbyV2)..."
Push-Location $V2_LOCAL
npx next build
if ($LASTEXITCODE -ne 0) { Pop-Location; Err "V2 构建失败" }
Pop-Location
Log "V2 构建完成"

# ======================== 第2步：打包 + 上传 + 解压 ========================
Deploy-Project -Name "V1" -LocalDir $V1_LOCAL -RemoteDir $V1_REMOTE
Deploy-Project -Name "V2" -LocalDir $V2_LOCAL -RemoteDir $V2_REMOTE

# ======================== 第3步：服务器启动 PM2 ========================
Log "服务器端注册并启动 PM2 进程..."
$remoteCmd = @(
    "command -v pm2 > /dev/null 2>&1 || npm install -g pm2",
    "cd ${V1_REMOTE} && pm2 delete lobby-v1 2>/dev/null || true",
    "cd ${V1_REMOTE} && PORT=3010 pm2 start server.js --name lobby-v1",
    "cd ${V2_REMOTE} && pm2 delete lobby-v2 2>/dev/null || true",
    "cd ${V2_REMOTE} && PORT=3011 pm2 start server.js --name lobby-v2",
    "pm2 save",
    "pm2 list"
) -join " && "
ssh $DEST $remoteCmd

# ======================== 完成 ========================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Log "部署成功!"
Write-Host "  大厅 V1: http://${SERVER_IP}:3010" -ForegroundColor Cyan
Write-Host "  大厅 V2: http://${SERVER_IP}:3011" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
