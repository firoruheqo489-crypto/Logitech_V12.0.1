param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$stateFile = Join-Path $RepoRoot ".codex-local-dashboard.state.json"

if (-not (Test-Path -LiteralPath $stateFile)) {
  throw "local dashboard state file not found: $stateFile"
}

$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$apiHealth = Invoke-RestMethod -Uri $state.apiHealthUrl -Method Get -TimeoutSec 5
$frontendResponse = Invoke-WebRequest -Uri $state.frontendUrl -Method Get -TimeoutSec 5 -UseBasicParsing
$apiHealthy = ($apiHealth.ok -eq $true -and $apiHealth.api -eq $true)
$frontendStatusCode = [int]$frontendResponse.StatusCode
$frontendReachable = ($frontendStatusCode -ge 200 -and $frontendStatusCode -lt 500)

if (-not $apiHealthy) {
  throw "api health check failed for $($state.apiHealthUrl)"
}

if (-not $frontendReachable) {
  throw "frontend check failed for $($state.frontendUrl) with status $frontendStatusCode"
}

[Console]::Out.WriteLine("LOCAL_DASHBOARD_READY")
[Console]::Out.WriteLine("FRONTEND_URL=$($state.frontendUrl)")
[Console]::Out.WriteLine("FRONTEND_STATUS=$frontendStatusCode")
[Console]::Out.WriteLine("API_URL=$($state.apiUrl)")
[Console]::Out.WriteLine("API_HEALTH=$($state.apiHealthUrl)")
[Console]::Out.WriteLine("API_OK=true")
[Console]::Out.WriteLine("API_PID=$($state.apiPid)")
[Console]::Out.WriteLine("VITE_PID=$($state.vitePid)")
[Console]::Out.WriteLine("STATE_FILE=$stateFile")
[Console]::Out.Flush()
