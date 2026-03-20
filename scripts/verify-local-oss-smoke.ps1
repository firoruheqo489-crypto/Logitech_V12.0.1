param(
  [int]$Port = 3301
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stdoutPath = Join-Path $projectRoot ".codex-oss-smoke-api.log"
$stderrPath = Join-Path $projectRoot ".codex-oss-smoke-api.err.log"
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
    [int]$Retries = 20
  )

  for ($attempt = 1; $attempt -le $Retries; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 5
      if ([int]$response.StatusCode -eq 200) {
        Write-Host "[PASS] Local API healthy on attempt $attempt."
        return
      }
    } catch {
      Start-Sleep -Milliseconds 750
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
  Invoke-Step -Label "Ensuring local .env has required OSS keys" -Command {
    node scripts/ensure-oss-env.mjs --target .env --source .env.local --require API_SECRET_KEY
  }

  $existingOwner = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1 -ExpandProperty OwningProcess

  if ($existingOwner) {
    throw "Port $Port is already in use by PID $existingOwner. Choose a free port before running local OSS smoke."
  }

  Remove-Item $stdoutPath, $stderrPath -ErrorAction SilentlyContinue

  Write-Host "[INFO] Starting isolated local API on port $Port"
  $launcher = Start-Process -FilePath "pnpm.cmd" `
    -ArgumentList @("exec", "cross-env", "DEV_API=1", "PORT=$Port", "tsx", "server/index.ts") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  Wait-ApiHealthy -BaseUrl "http://127.0.0.1:$Port"

  Invoke-Step -Label "Running isolated OSS upload/delete smoke" -Command {
    node scripts/verify-oss-http-smoke.mjs --base-url "http://127.0.0.1:$Port" --env-file .env --label local-predeploy
  }

  Write-Host "[SUCCESS] Local OSS smoke passed."
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
