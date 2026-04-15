param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$ApiPort = 3001,
  [int]$FrontendPort = 3000,
  [int]$TimeoutSeconds = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$apiOutLog = Join-Path $RepoRoot ".codex-local-dashboard.out.log"
$apiErrLog = Join-Path $RepoRoot ".codex-local-dashboard.err.log"
$viteOutLog = Join-Path $RepoRoot ".codex-local-vite.out.log"
$viteErrLog = Join-Path $RepoRoot ".codex-local-vite.err.log"
$stateFile = Join-Path $RepoRoot ".codex-local-dashboard.state.json"
$failureFile = Join-Path $RepoRoot ".codex-local-dashboard.failure.json"

function Write-Status {
  param([string]$Message)
  Write-Host "[local-dashboard] $Message"
}

function Write-StdoutLine {
  param([string]$Message)
  [Console]::Out.WriteLine($Message)
}

function Remove-FileIfExists {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
  }
}

function Resolve-LogPath {
  param([string]$PreferredPath)

  try {
    Remove-FileIfExists -Path $PreferredPath
    return $PreferredPath
  } catch {
    $directory = Split-Path -Path $PreferredPath -Parent
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($PreferredPath)
    $extension = [System.IO.Path]::GetExtension($PreferredPath)
    $fallbackName = "{0}.{1}{2}" -f $baseName, (Get-Date -Format "yyyyMMdd-HHmmss"), $extension
    $fallbackPath = Join-Path $directory $fallbackName
    Write-Status "warning: log file was locked, switching to $fallbackName"
    return $fallbackPath
  }
}

function Get-LogTail {
  param(
    [string]$Path,
    [int]$LineCount = 20
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  return (Get-Content -LiteralPath $Path -Tail $LineCount) -join [Environment]::NewLine
}

function Get-ListeningPids {
  param([int]$Port)

  try {
    $output = netstat -ano -p tcp | Select-String -Pattern (":{0}\s" -f $Port)
  } catch {
    return @()
  }

  $processIds = @()
  foreach ($match in $output) {
    $line = $match.ToString().Trim()
    if (-not ($line -match "LISTENING")) {
      continue
    }

    $parts = $line -split "\s+"
    if ($parts.Length -lt 5) {
      continue
    }

    $listeningProcessId = $parts[$parts.Length - 1]
    if ($listeningProcessId -match "^\d+$") {
      $processIds += $listeningProcessId
    }
  }

  return @($processIds | Select-Object -Unique)
}

function Wait-ForPortFree {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 10
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $pids = @(Get-ListeningPids -Port $Port)
    if ($pids.Count -eq 0) {
      return
    }

    Start-Sleep -Milliseconds 300
  }

  $remainingPids = @(Get-ListeningPids -Port $Port)
  if ($remainingPids.Count -gt 0) {
    throw "port $Port is still occupied after waiting $TimeoutSeconds seconds. PIDs: $($remainingPids -join ', ')"
  }
}

function Resolve-ListeningPid {
  param(
    [int]$Port,
    [int]$FallbackPid
  )

  $listeningPids = @(Get-ListeningPids -Port $Port)
  if ($listeningPids.Count -gt 0) {
    return [int]$listeningPids[0]
  }

  return $FallbackPid
}

function Stop-TrackedProcess {
  param(
    [int]$ProcessId,
    [string]$Name
  )

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
    Write-Status "stopped previous $Name process ($ProcessId)"
  } catch [System.Management.Automation.ItemNotFoundException] {
    return
  } catch {
    Write-Status "warning: failed to stop previous $Name process ($ProcessId): $($_.Exception.Message)"
  }
}

function Stop-TrackedProcesses {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  try {
    $state = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    $trackedProcesses = @(
      @{ Value = $state.apiPid; Name = "api" },
      @{ Value = $state.apiLauncherPid; Name = "api launcher" },
      @{ Value = $state.vitePid; Name = "vite" },
      @{ Value = $state.viteLauncherPid; Name = "vite launcher" }
    )

    foreach ($tracked in $trackedProcesses) {
      if ($null -eq $tracked.Value) {
        continue
      }

      $pidText = [string]$tracked.Value
      if ($pidText -notmatch "^\d+$") {
        continue
      }

      Stop-TrackedProcess -ProcessId ([int]$pidText) -Name $tracked.Name
    }
  } catch {
    Write-Status "warning: failed to parse prior state file: $($_.Exception.Message)"
  } finally {
    Remove-FileIfExists -Path $Path
  }
}

function Escape-PowerShellSingleQuotedText {
  param([string]$Value)
  return ($Value -replace "'", "''")
}

function Start-LoggedProcess {
  param(
    [string]$Name,
    [string[]]$ArgumentList,
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  $resolvedStdOutPath = Resolve-LogPath -PreferredPath $StdOutPath
  $resolvedStdErrPath = Resolve-LogPath -PreferredPath $StdErrPath
  $escapedRepoRoot = Escape-PowerShellSingleQuotedText -Value $RepoRoot
  $escapedStdOutPath = Escape-PowerShellSingleQuotedText -Value $resolvedStdOutPath
  $escapedStdErrPath = Escape-PowerShellSingleQuotedText -Value $resolvedStdErrPath

  $commandText = switch ($Name) {
    "api" { "& 'node' --experimental-strip-types --loader './scripts/ts-path-loader.mjs' 'server/index.ts'" }
    "vite" { "& 'node' './node_modules/vite/bin/vite.js' --host --configLoader native" }
    default { throw "unsupported process name: $Name" }
  }

  $launchScript = @"
Set-Location -LiteralPath '$escapedRepoRoot'
$(
    if ($Name -eq 'api') {
      "`$env:DEV_API = '1'`n`$env:PORT = '$ApiPort'"
    } else {
      "`$env:PORT = '$FrontendPort'"
    }
)
$commandText 1>> '$escapedStdOutPath' 2>> '$escapedStdErrPath'
"@
  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($launchScript))
  $process = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      $encodedCommand
    ) `
    -WorkingDirectory $RepoRoot `
    -PassThru `
    -WindowStyle Hidden

  Write-Status "started $Name launcher (PID $($process.Id))"
  return [PSCustomObject]@{
    Process = $process
    StdOutPath = $resolvedStdOutPath
    StdErrPath = $resolvedStdErrPath
  }
}

function Get-ProcessFailureMessage {
  param(
    [string]$Name,
    [System.Diagnostics.Process]$Process,
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  $stdoutTail = Get-LogTail -Path $StdOutPath
  $stderrTail = Get-LogTail -Path $StdErrPath
  $message = @(
    "$Name exited before startup completed (PID $($Process.Id))."
    "stdout:"
    $stdoutTail
    "stderr:"
    $stderrTail
  ) -join [Environment]::NewLine

  return $message
}

function Get-FrontendUrlFromLog {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $content = Get-Content -LiteralPath $Path -Raw
  if ($null -eq $content) {
    $content = ""
  }

  $match = [regex]::Match($content, "http://localhost:\d+/")
  if ($match.Success) {
    return $match.Value.TrimEnd("/")
  }

  return $null
}

function Test-FrontendUrl {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 2 -UseBasicParsing
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-ForServices {
  param(
    [string]$ApiHealthUrl,
    [int]$PreferredPort,
    [System.Diagnostics.Process]$ApiProcess,
    [string]$ApiStdOutPath,
    [string]$ApiStdErrPath,
    [System.Diagnostics.Process]$ViteProcess,
    [string]$ViteStdOutPath,
    [string]$ViteStdErrPath,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $apiReady = $false
  $frontendReady = $false
  $frontendUrl = $null

  while ((Get-Date) -lt $deadline) {
    if (-not $apiReady) {
      try {
        $response = Invoke-RestMethod -Uri $ApiHealthUrl -Method Get -TimeoutSec 2
        if ($response.ok -eq $true -and $response.api -eq $true) {
          $apiReady = $true
          Write-Status "api ready at $ApiHealthUrl"
        }
      } catch {
      }
    }

    if (-not $frontendReady) {
      $loggedUrl = Get-FrontendUrlFromLog -Path $ViteStdOutPath
      if ($loggedUrl -and (Test-FrontendUrl -Url $loggedUrl)) {
        $frontendReady = $true
        $frontendUrl = $loggedUrl
        Write-Status "frontend ready at $frontendUrl"
      }

      if (-not $frontendReady) {
        foreach ($port in $PreferredPort..($PreferredPort + 10)) {
          $candidateUrl = "http://localhost:$port"
          if (Test-FrontendUrl -Url $candidateUrl) {
            $frontendReady = $true
            $frontendUrl = $candidateUrl
            Write-Status "frontend ready at $frontendUrl"
            break
          }
        }
      }
    }

    $ApiProcess.Refresh()
    if ($ApiProcess.HasExited) {
      throw (Get-ProcessFailureMessage -Name "api" -Process $ApiProcess -StdOutPath $ApiStdOutPath -StdErrPath $ApiStdErrPath)
    }

    $ViteProcess.Refresh()
    if ($ViteProcess.HasExited) {
      throw (Get-ProcessFailureMessage -Name "vite" -Process $ViteProcess -StdOutPath $ViteStdOutPath -StdErrPath $ViteStdErrPath)
    }

    if ($apiReady -and $frontendReady -and $frontendUrl) {
      return $frontendUrl
    }

    Start-Sleep -Milliseconds 500
  }

  throw "probe acceptance failed: services were not ready within $TimeoutSeconds seconds. Review logs: $ApiStdOutPath, $ApiStdErrPath, $ViteStdOutPath, $ViteStdErrPath"
}

Remove-FileIfExists -Path $failureFile
$apiProcessInfo = $null
$viteProcessInfo = $null

try {
  Write-Status "repo root: $RepoRoot"
  Stop-TrackedProcesses -Path $stateFile

  Write-Status "freeing dev ports"
  Push-Location $RepoRoot
  try {
    & node "scripts/free-dev-ports.mjs"
  } finally {
    Pop-Location
  }

  Write-Status "waiting for ports $FrontendPort and $ApiPort to become free"
  Wait-ForPortFree -Port $FrontendPort
  Wait-ForPortFree -Port $ApiPort

  $apiProcessInfo = Start-LoggedProcess -Name "api" -ArgumentList @("run", "dev:api") -StdOutPath $apiOutLog -StdErrPath $apiErrLog

  $apiUrl = "http://localhost:$ApiPort"
  $apiHealthUrl = "$apiUrl/api/health"

  $viteProcessInfo = Start-LoggedProcess -Name "vite" -ArgumentList @("run", "dev:only") -StdOutPath $viteOutLog -StdErrPath $viteErrLog

  Write-Status "waiting for api/frontend readiness in parallel"
  $frontendUrl = Wait-ForServices `
    -ApiHealthUrl $apiHealthUrl `
    -PreferredPort $FrontendPort `
    -ApiProcess $apiProcessInfo.Process `
    -ApiStdOutPath $apiProcessInfo.StdOutPath `
    -ApiStdErrPath $apiProcessInfo.StdErrPath `
    -ViteProcess $viteProcessInfo.Process `
    -ViteStdOutPath $viteProcessInfo.StdOutPath `
    -ViteStdErrPath $viteProcessInfo.StdErrPath `
    -TimeoutSeconds $TimeoutSeconds

  $frontendPort = ([System.Uri]$frontendUrl).Port
  $resolvedApiPid = Resolve-ListeningPid -Port $ApiPort -FallbackPid $apiProcessInfo.Process.Id
  $resolvedVitePid = Resolve-ListeningPid -Port $frontendPort -FallbackPid $viteProcessInfo.Process.Id

  $state = [PSCustomObject]@{
    startedAt = (Get-Date).ToString("o")
    apiPid = $resolvedApiPid
    vitePid = $resolvedVitePid
    apiLauncherPid = $apiProcessInfo.Process.Id
    viteLauncherPid = $viteProcessInfo.Process.Id
    apiUrl = $apiUrl
    apiHealthUrl = $apiHealthUrl
    frontendUrl = $frontendUrl
    apiOutLog = $apiProcessInfo.StdOutPath
    apiErrLog = $apiProcessInfo.StdErrPath
    viteOutLog = $viteProcessInfo.StdOutPath
    viteErrLog = $viteProcessInfo.StdErrPath
  }

  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8

  Write-StdoutLine "LOCAL_DASHBOARD_READY"
  Write-StdoutLine "FRONTEND_URL=$frontendUrl"
  Write-StdoutLine "API_URL=$apiUrl"
  Write-StdoutLine "API_HEALTH=$apiHealthUrl"
  Write-StdoutLine "API_PID=$resolvedApiPid"
  Write-StdoutLine "VITE_PID=$resolvedVitePid"
  Write-StdoutLine "STATE_FILE=$stateFile"
  [Console]::Out.Flush()
  exit 0
} catch {
  $failure = [PSCustomObject]@{
    failedAt = (Get-Date).ToString("o")
    message = $_.Exception.Message
    apiOutLog = if ($apiProcessInfo) { $apiProcessInfo.StdOutPath } else { $apiOutLog }
    apiErrLog = if ($apiProcessInfo) { $apiProcessInfo.StdErrPath } else { $apiErrLog }
    viteOutLog = if ($viteProcessInfo) { $viteProcessInfo.StdOutPath } else { $viteOutLog }
    viteErrLog = if ($viteProcessInfo) { $viteProcessInfo.StdErrPath } else { $viteErrLog }
    stateFile = $stateFile
  }
  $failure | ConvertTo-Json | Set-Content -LiteralPath $failureFile -Encoding utf8
  throw
}
