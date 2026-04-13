param(
  [int]$Port = 3302,
  [int]$Retries = 60,
  [int]$RetryIntervalMs = 1500
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stdoutPath = Join-Path $projectRoot ".codex-reliability-smoke-api.log"
$stderrPath = Join-Path $projectRoot ".codex-reliability-smoke-api.err.log"
$launcher = $null

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host "[INFO] $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Wait-ApiHealthy {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,
    [int]$Retries = 40,
    [int]$RetryIntervalMs = 1000
  )

  for ($attempt = 1; $attempt -le $Retries; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 5
      if ([int]$response.StatusCode -eq 200) {
        Write-Host "[PASS] Local API healthy on attempt $attempt."
        return
      }
    } catch {
      Start-Sleep -Milliseconds $RetryIntervalMs
    }
  }

  throw "Timed out waiting for local API at $BaseUrl"
}

function Stop-PortProcess {
  param([int]$TargetPort)

  $owners = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($owner in $owners) {
    try {
      Stop-Process -Id $owner -Force -ErrorAction Stop
    } catch {
    }
  }
}

Push-Location $projectRoot
try {
  $existingOwner = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1 -ExpandProperty OwningProcess

  if ($existingOwner) {
    throw "Port $Port is already in use by PID $existingOwner. Choose a free port before running local reliability smoke."
  }

  Remove-Item $stdoutPath, $stderrPath -ErrorAction SilentlyContinue

  Write-Host "[INFO] Starting isolated local API on port $Port"
  $launcher = Start-Process -FilePath "pnpm.cmd" `
    -ArgumentList @("exec", "cross-env", "DEV_API=1", "PORT=$Port", "tsx", "server/index.ts") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  Wait-ApiHealthy -BaseUrl "http://127.0.0.1:$Port" -Retries $Retries -RetryIntervalMs $RetryIntervalMs

  Invoke-Step -Label "Running isolated reliability smoke" -Command {
    node scripts/verify-reliability-smoke.mjs --base-url "http://127.0.0.1:$Port"
  }

  Write-Host "[SUCCESS] Local reliability smoke passed."
  exit 0
} catch {
  Write-Host "[FAIL] $($_.Exception.Message)"

  if (Test-Path $stdoutPath) {
    Write-Host "[INFO] Last stdout lines:"
    Get-Content $stdoutPath -Tail 30
  }

  if (Test-Path $stderrPath) {
    Write-Host "[INFO] Last stderr lines:"
    Get-Content $stderrPath -Tail 30
  }

  exit 1
} finally {
  if ($launcher) {
    try {
      Stop-Process -Id $launcher.Id -Force -ErrorAction Stop
    } catch {
    }
  }

  Stop-PortProcess -TargetPort $Port
  Pop-Location
}
