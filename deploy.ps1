# ============================================================================
# deploy.ps1 - Windows PowerShell one-click deploy to Aliyun
# Usage: .\deploy.ps1 [-VersionBump none|minor|major]
# ============================================================================

param(
    [ValidateSet("none", "minor", "major")]
    [string]$VersionBump = "none",
    [string]$DeployRoot = ""
)

$ErrorActionPreference = "Stop"

# ======================== Config ========================
$SERVER_IP = "120.27.153.140"
$SERVER_USER = "root"
$SERVER_PORT = "22"
$REMOTE_DIR = "/var/www/logitech"
$PM2_APPS = @("logitech", "mold-gantt-v3")
# =======================================================

$SSH_HOST = "aliyun"
$DEST = $SSH_HOST

function Log($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

function Resolve-DeployRoot() {
    if ($DeployRoot) {
        return (Resolve-Path $DeployRoot).Path
    }

    $scriptRoot = $PSScriptRoot
    $scriptRootName = Split-Path $scriptRoot -Leaf
    if ($scriptRootName -like ".codex-deploy-ready*") {
        return $scriptRoot
    }

    $preferredRoot = Join-Path $scriptRoot ".codex-deploy-ready-current"
    if (-not (Test-Path $preferredRoot)) {
        $targetCommit = (git -C $scriptRoot rev-parse HEAD).Trim()
        if ($LASTEXITCODE -ne 0 -or -not $targetCommit) {
            Err "Failed to resolve the current HEAD for clean deploy root creation."
        }

        Log "Creating clean deploy root at ${preferredRoot} for ${targetCommit}"
        git -C $scriptRoot worktree add --detach $preferredRoot $targetCommit | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Err "Failed to create clean deploy root at ${preferredRoot}"
        }
    }

    return (Resolve-Path $preferredRoot).Path
}

function Sync-DeployRootCommit($resolvedRoot) {
    if ($DeployRoot) {
        return
    }

    $scriptRoot = $PSScriptRoot
    $scriptRootName = Split-Path $scriptRoot -Leaf
    if ($scriptRootName -like ".codex-deploy-ready*") {
        return
    }

    $targetCommit = (git -C $scriptRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $targetCommit) {
        Err "Failed to resolve the source HEAD for deploy root sync."
    }

    $deployStatus = git -C $resolvedRoot status --porcelain=v1 --untracked-files=all 2>$null
    if ($LASTEXITCODE -ne 0) {
        Err "Failed to read deploy root state"
    }
    if ($deployStatus) {
        Write-Host $deployStatus -ForegroundColor Yellow
        Err "Refusing to sync a dirty deploy root. Clean ${resolvedRoot} first."
    }

    $deployCommit = (git -C $resolvedRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $deployCommit) {
        Err "Failed to resolve the deploy root commit"
    }

    if ($deployCommit -eq $targetCommit) {
        return
    }

    Log "Syncing deploy root to ${targetCommit}"
    git -C $resolvedRoot checkout --detach $targetCommit | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Err "Failed to sync deploy root to ${targetCommit}"
    }
}

function RequireCleanGitWorkspace() {
    $status = git status --porcelain=v1 --untracked-files=all 2>$null
    if ($LASTEXITCODE -ne 0) { Err "Failed to read git working tree state" }
    if ($status) {
        Write-Host $status -ForegroundColor Yellow
        Err "Refusing to deploy from a dirty workspace. Commit or stash changes first."
    }
}

$ResolvedDeployRoot = Resolve-DeployRoot
Sync-DeployRootCommit $ResolvedDeployRoot
Log "Deploy root: $ResolvedDeployRoot"

Push-Location $ResolvedDeployRoot
try {
    # ======================== Step 0: release safety checks ========================
    Log "Running release safety checks..."
    RequireCleanGitWorkspace

    if ($VersionBump -ne "none") {
        Err "Version bump during deploy is disabled for release safety. Commit the bumped version first, then redeploy with -VersionBump none."
    }

    $DEPLOY_COMMIT = (git rev-parse --short HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $DEPLOY_COMMIT) { Err "Failed to resolve the deploy commit" }
    Log "Deploying committed tree at ${DEPLOY_COMMIT}"

    # ======================== Step 1: local build ========================
    Log "Starting local build..."
    pnpm build
    if ($LASTEXITCODE -ne 0) { Err "Build failed" }
    Log "Build complete -> dist/"

    # ======================== Step 2: upload files ========================
    Log "Uploading files to ${DEST}:${REMOTE_DIR} ..."

    ssh $DEST "mkdir -p $REMOTE_DIR"

    # Backup current dist for rollback
    ssh $DEST "if [ -d ${REMOTE_DIR}/dist ]; then rm -rf ${REMOTE_DIR}/dist.prev; cp -a ${REMOTE_DIR}/dist ${REMOTE_DIR}/dist.prev; fi"

    Log "  Uploading dist/ ..."
    scp -r dist/ "${DEST}:${REMOTE_DIR}/"

    Log "  Uploading package.json, pnpm-lock.yaml ..."
    scp package.json pnpm-lock.yaml "${DEST}:${REMOTE_DIR}/"

    Log "  Uploading ecosystem.config.cjs ..."
    scp ecosystem.config.cjs "${DEST}:${REMOTE_DIR}/"

    if (Test-Path patches) {
        Log "  Uploading patches/ ..."
        scp -r patches/ "${DEST}:${REMOTE_DIR}/"
    }

    if (Test-Path .env) {
        Log "  Uploading .env ..."
        scp .env "${DEST}:${REMOTE_DIR}/"
    } else {
        Warn ".env not found locally, skipping upload"
    }

    if (Test-Path drizzle) {
        Log "  Uploading drizzle/ ..."
        scp -r drizzle/ "${DEST}:${REMOTE_DIR}/"
    }

    Log "File upload complete"

    # ======================== Step 3: install deps on server ========================
    Log "Installing production dependencies on server..."
    $installCmd = @(
        "cd /var/www/logitech",
        "if ! command -v pm2 > /dev/null 2>&1; then npm install -g pm2; fi",
        "if command -v systemctl > /dev/null 2>&1; then if [ ! -f /etc/systemd/system/pm2-root.service ]; then pm2 startup systemd -u root --hp /root || true; fi; fi",
        "pnpm install --prod",
        "echo DEPS_DONE"
    ) -join " && "
    ssh $DEST $installCmd
    Log "Dependency install complete"

    # ======================== Step 4: restart PM2 ========================
    Log "Restarting PM2 process..."
    $restartCmd = @(
        "cd /var/www/logitech",
        "if pm2 describe logitech > /dev/null 2>&1; then pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then pm2 restart mold-gantt-v3 --update-env; else pm2 start ecosystem.config.cjs --only mold-gantt-v3 --env production && pm2 save; fi",
        "pm2 status"
    ) -join " && "
    ssh $DEST $restartCmd
    Log "PM2 restart complete"

    # ======================== Step 5: health check ========================
    Log "Running health check (up to 20 seconds)..."
    $healthOk = $false
    for ($i = 1; $i -le 10; $i++) {
        $result = ssh $DEST "curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || echo FAIL"
        if ($result -match '"ok":true') {
            Log "Health check passed: $result"
            $healthOk = $true
            break
        }
        Write-Host "  Retry $i/10 ..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }

    if (-not $healthOk) {
        Warn "Health check failed, attempting rollback..."
        $primaryApp = $PM2_APPS[0]
        $rollbackCmd = @(
            "if [ -d /var/www/logitech/dist.prev ]; then rm -rf /var/www/logitech/dist && mv /var/www/logitech/dist.prev /var/www/logitech/dist && pm2 restart ${primaryApp} --update-env && echo ROLLED_BACK; else echo NO_BACKUP; fi",
            "pm2 logs ${primaryApp} --lines 30 --nostream || true"
        ) -join " ; "
        ssh $DEST $rollbackCmd
        Err "Deployment failed and rollback was attempted"
    }

    # ======================== Done ========================
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Log "Deployment succeeded!"
    Write-Host "  URL: http://${SERVER_IP}:3000" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}
finally {
    Pop-Location
}
