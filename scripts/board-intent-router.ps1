param(
  [ValidateSet("status", "open-local-board", "open-server-board", "before-source-change")]
  [string]$Action = "status",
  [string]$Label = "",
  [string]$ServerUrl = "http://120.27.153.140:3000",
  [switch]$SkipCheckpoint
)

$ErrorActionPreference = "Stop"

function Log([string]$Message) {
  Write-Host "[board-intent] $Message" -ForegroundColor Green
}

function Warn([string]$Message) {
  Write-Host "[board-intent] $Message" -ForegroundColor Yellow
}

function Err([string]$Message) {
  Write-Host "[board-intent] $Message" -ForegroundColor Red
  exit 1
}

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function New-Label([string]$Prefix, [string]$ManualLabel) {
  if (-not [string]::IsNullOrWhiteSpace($ManualLabel)) {
    return $ManualLabel
  }
  return "$Prefix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

function Invoke-SafeCheckpoint {
  param(
    [string]$RepoRoot,
    [string]$ReasonPrefix,
    [string]$ManualLabel
  )

  $checkpointLabel = New-Label -Prefix $ReasonPrefix -ManualLabel $ManualLabel
  Log "Creating required safety checkpoint: $checkpointLabel"

  Push-Location $RepoRoot
  try {
    & node scripts/safe-checkpoint.mjs --label $checkpointLabel
    if ($LASTEXITCODE -ne 0) {
      Err "safe:checkpoint failed. Abort."
    }
  } finally {
    Pop-Location
  }
}

function Test-BoardReady([string]$Url) {
  try {
    $null = Invoke-RestMethod -Uri "$($Url.TrimEnd('/'))/api/release" -TimeoutSec 3
    return $true
  } catch {
    return $false
  }
}

function Ensure-LocalSourceBoardRunning([string]$RepoRoot, [string]$LocalUrl) {
  if (Test-BoardReady -Url $LocalUrl) {
    Log "Local source board is already running at $LocalUrl"
    return
  }

  Log "Starting local source board from current local source (pnpm run dev)..."

  $logDir = Join-Path $RepoRoot ".codex-local"
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null

  $stdoutLog = Join-Path $logDir "local-source-board.out.log"
  $stderrLog = Join-Path $logDir "local-source-board.err.log"

  Remove-Item -LiteralPath $stdoutLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrLog -Force -ErrorAction SilentlyContinue

  Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c pnpm run dev" `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    if (Test-BoardReady -Url $LocalUrl) {
      Log "Local source board is ready at $LocalUrl"
      return
    }
    Start-Sleep -Milliseconds 800
  }

  Err "Local board did not become ready in time. Check logs: $stdoutLog / $stderrLog"
}

$repoRoot = Resolve-RepoRoot
$localSourceBoardUrl = "http://localhost:3000"

switch ($Action) {
  "status" {
    Write-Host "Intent mapping:" -ForegroundColor Cyan
    Write-Host "  open-local-board  => local source code board (localhost)" -ForegroundColor Cyan
    Write-Host "  open-server-board => Aliyun server board" -ForegroundColor Cyan
    Write-Host "  before-source-change => mandatory archive checkpoint" -ForegroundColor Cyan
    Write-Host "Local board URL:  $localSourceBoardUrl" -ForegroundColor Cyan
    Write-Host "Server board URL: $ServerUrl" -ForegroundColor Cyan
    exit 0
  }
  "before-source-change" {
    if (-not $SkipCheckpoint) {
      Invoke-SafeCheckpoint -RepoRoot $repoRoot -ReasonPrefix "before-source-change" -ManualLabel $Label
    } else {
      Warn "SkipCheckpoint used. No archive created."
    }
    Log "Source-change preflight complete."
    exit 0
  }
  "open-local-board" {
    if (-not $SkipCheckpoint) {
      Invoke-SafeCheckpoint -RepoRoot $repoRoot -ReasonPrefix "before-open-local-board" -ManualLabel $Label
    } else {
      Warn "SkipCheckpoint used. No archive created."
    }

    Ensure-LocalSourceBoardRunning -RepoRoot $repoRoot -LocalUrl $localSourceBoardUrl
    Start-Process $localSourceBoardUrl | Out-Null
    Log "Opened local source board in browser: $localSourceBoardUrl"
    exit 0
  }
  "open-server-board" {
    Log "Target server board is Aliyun: $ServerUrl"
    Start-Process $ServerUrl | Out-Null
    Log "Opened Aliyun server board in browser: $ServerUrl"
    exit 0
  }
  default {
    Err "Unknown action: $Action"
  }
}
