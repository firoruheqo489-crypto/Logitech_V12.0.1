param(
  [string]$ReleaseNote = "",
  [int]$Port = 3000,
  [switch]$SkipVerification,
  [switch]$SkipDeploy,
  [switch]$NoBrowser,
  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log([string]$Message) {
  Write-Host "[board-release] $Message" -ForegroundColor Green
}

function Warn([string]$Message) {
  Write-Host "[board-release] $Message" -ForegroundColor Yellow
}

function Err([string]$Message) {
  Write-Host "[board-release] $Message" -ForegroundColor Red
  exit 1
}

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Read-ActivePreviewState([string]$StatePath) {
  if (-not (Test-Path -LiteralPath $StatePath)) {
    return $null
  }

  try {
    return Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

if ($Help) {
  Write-Host "Usage:" -ForegroundColor Cyan
  Write-Host "  board-release.cmd ""release note""" -ForegroundColor Cyan
  Write-Host "  pnpm run board:flow:ship -- -ReleaseNote ""release note""" -ForegroundColor Cyan
  Write-Host "Options:" -ForegroundColor Cyan
  Write-Host "  -Port <number>         Preview port (default: 3000)" -ForegroundColor Cyan
  Write-Host "  -SkipVerification      Skip local OSS smoke" -ForegroundColor Cyan
  Write-Host "  -SkipDeploy            Stop after preview" -ForegroundColor Cyan
  Write-Host "  -NoBrowser             Do not open the preview URL automatically" -ForegroundColor Cyan
  exit 0
}

$repoRoot = Resolve-RepoRoot
$singleTrackScript = Join-Path $PSScriptRoot "single-track-flow.ps1"
$activeStatePath = Join-Path $repoRoot "artifacts\single-track-active.json"

if (-not (Test-Path -LiteralPath $singleTrackScript)) {
  Err "Missing single-track flow script: $singleTrackScript"
}

Push-Location $repoRoot
try {
  if ([string]::IsNullOrWhiteSpace($ReleaseNote)) {
    $ReleaseNote = Read-Host "Release note"
  }

  $ReleaseNote = [string]$ReleaseNote
  $ReleaseNote = $ReleaseNote.Trim()
  if (-not $ReleaseNote) {
    Err "Release note is required."
  }

  if (-not $SkipVerification) {
    Log "Running local OSS smoke..."
    & pnpm.cmd run verify:oss-api:local
    if ($LASTEXITCODE -ne 0) {
      Err "Local OSS smoke failed."
    }
  }

  Log "Building preview artifact..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $singleTrackScript -Mode preview -ReleaseNote $ReleaseNote -Port $Port
  if ($LASTEXITCODE -ne 0) {
    Err "Preview failed."
  }

  $activeState = Read-ActivePreviewState -StatePath $activeStatePath
  $previewPort = if ($activeState -and $activeState.Port) { [int]$activeState.Port } else { $Port }
  $previewUrl = "http://localhost:$previewPort"

  Log "Preview ready at $previewUrl"
  if (-not $NoBrowser) {
    try {
      Start-Process $previewUrl | Out-Null
    } catch {
      Warn "Could not open the preview URL automatically."
    }
  }

  if ($SkipDeploy) {
    Warn "Deploy skipped. Run 'pnpm run board:flow:deploy' later to publish the validated artifact."
    exit 0
  }

  $confirm = Read-Host "Deploy this validated artifact to server? [Y/N]"
  $confirm = ([string]$confirm).Trim().ToUpperInvariant()
  if ($confirm -ne "Y") {
    Warn "Deploy cancelled. Run 'pnpm run board:flow:deploy' later when you are ready."
    exit 0
  }

  Log "Deploying validated artifact..."
  & pnpm.cmd run board:flow:deploy
  if ($LASTEXITCODE -ne 0) {
    Err "Deploy failed."
  }

  Log "Deployment completed."
} finally {
  Pop-Location
}
