param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sopPath = Join-Path $repoRoot "docs/release-sop.md"

if (-not (Test-Path -LiteralPath $sopPath)) {
  Err "Missing release SOP: $sopPath"
}

$sopText = Get-Content -LiteralPath $sopPath -Raw
if ([string]::IsNullOrWhiteSpace($sopText)) {
  Err "Release SOP is empty: $sopPath"
}

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "RELEASE SOP" -ForegroundColor DarkCyan
Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host $sopText
Write-Host "========================================" -ForegroundColor DarkCyan
