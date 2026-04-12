param(
  [int]$Port = 3301,
  [int]$Retries = 40,
  [int]$RetryIntervalMs = 1000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stdoutPath = Join-Path $projectRoot ".codex-oss-smoke-api.log"
$stderrPath = Join-Path $projectRoot ".codex-oss-smoke-api.err.log"
$fallbackBundleDir = Join-Path $projectRoot ".codex-local\oss-smoke"
$fallbackBundlePath = Join-Path $fallbackBundleDir "server-index.js"
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

function Reset-LauncherLogs {
  Remove-Item $stdoutPath, $stderrPath -ErrorAction SilentlyContinue
}

function Get-LauncherLogTail {
  param(
    [string]$Path,
    [int]$Tail = 30
  )

  if (-not (Test-Path $Path)) {
    return ""
  }

  return ((Get-Content $Path -Tail $Tail) -join [Environment]::NewLine)
}

function Start-IsolatedApiWithTsx {
  Write-Host "[INFO] Starting isolated local API on port $Port via tsx"
  Reset-LauncherLogs
  return Start-Process -FilePath "pnpm.cmd" `
    -ArgumentList @("exec", "cross-env", "DEV_API=1", "PORT=$Port", "APP_ENV_FILE=$projectRoot\.env", "tsx", "server/index.ts") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
}

function Start-IsolatedApiWithBundle {
  Write-Host "[INFO] Falling back to bundled local API launcher"
  New-Item -ItemType Directory -Path $fallbackBundleDir -Force | Out-Null

  Invoke-Step -Label "Bundling isolated local API entrypoint" -Command {
    pnpm.cmd exec esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=$fallbackBundlePath
  }

  Reset-LauncherLogs
  $cmd = "/c set DEV_API=1&&set PORT=$Port&&set APP_ENV_FILE=$projectRoot\.env&&node `"$fallbackBundlePath`""
  return Start-Process -FilePath "cmd.exe" `
    -ArgumentList $cmd `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
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

  $launcher = Start-IsolatedApiWithTsx
  try {
    Wait-ApiHealthy -BaseUrl "http://127.0.0.1:$Port" -Retries $Retries -RetryIntervalMs $RetryIntervalMs
  } catch {
    $stderrTail = Get-LauncherLogTail -Path $stderrPath
    Write-Host "[WARN] tsx launcher did not become healthy: $($_.Exception.Message)"

    if ($launcher) {
      try {
        Stop-Process -Id $launcher.Id -Force -ErrorAction Stop
      } catch {
      }
      $launcher = $null
    }

    Stop-PortProcess -TargetPort $Port

    if ($stderrTail) {
      Write-Host "[INFO] tsx stderr tail:"
      Write-Host $stderrTail
    }

    $launcher = Start-IsolatedApiWithBundle
    Wait-ApiHealthy -BaseUrl "http://127.0.0.1:$Port" -Retries $Retries -RetryIntervalMs $RetryIntervalMs
  }

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
  if (Test-Path $fallbackBundleDir) {
    Remove-Item -LiteralPath $fallbackBundleDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
