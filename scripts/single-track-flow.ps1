param(
  [ValidateSet("status", "preview", "deploy")]
  [string]$Mode = "status",
  [string]$ReleaseNote = "",
  [string]$ServerUrl = "http://120.27.153.140:3000",
  [int]$Port = 3000,
  [switch]$SkipVerification,
  [switch]$SkipRemoteSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log([string]$Message) {
  Write-Host "[single-track] $Message" -ForegroundColor Green
}

function Warn([string]$Message) {
  Write-Host "[single-track] $Message" -ForegroundColor Yellow
}

function Err([string]$Message) {
  Write-Host "[single-track] $Message" -ForegroundColor Red
  exit 1
}

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Resolve-LatestMetadata([string]$ReleasesDir) {
  if (-not (Test-Path -LiteralPath $ReleasesDir)) {
    return $null
  }

  return Get-ChildItem -LiteralPath $ReleasesDir -File -Filter "*.metadata.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

function Read-JsonFile([string]$PathValue) {
  $raw = Get-Content -LiteralPath $PathValue -Raw
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) {
    $raw = $raw.Substring(1)
  }

  return $raw | ConvertFrom-Json
}

function Normalize-SingleTrackState([object]$Value, [string]$SourceLabel) {
  if ($null -eq $Value) {
    return $null
  }

  if ($Value -is [System.Array]) {
    $candidates = @(
      $Value | Where-Object {
        $_ -and
        $_.PSObject.Properties.Match("MetadataPath").Count -gt 0 -and
        $_.PSObject.Properties.Match("ArtifactPath").Count -gt 0
      }
    )

    if ($candidates.Count -eq 0) {
      Err "Could not find a valid single-track state object in $SourceLabel"
    }

    if ($candidates.Count -gt 1) {
      Warn "Multiple single-track state objects found in $SourceLabel. Using the last one."
    }

    return $candidates[-1]
  }

  return $Value
}

function Get-StateValue([object]$State, [string]$Name) {
  if ($null -eq $State) {
    return $null
  }

  $property = $State.PSObject.Properties.Match($Name) | Select-Object -First 1
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Stop-PortListeners([int]$TargetPort) {
  $listeners = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return
  }

  $procIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $procIds) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    } catch {
      continue
    }
  }
}

function Wait-Release([string]$Url, [int]$TimeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      return Invoke-RestMethod -Uri $Url -TimeoutSec 3
    } catch {
      Start-Sleep -Milliseconds 600
    }
  }

  return $null
}

function Get-ReleaseOrNull([string]$Url) {
  try {
    return Invoke-RestMethod -Uri $Url -TimeoutSec 10
  } catch {
    return $null
  }
}

function Sync-LocalRuntimeEnv([string]$RepoRoot, [string]$PayloadRoot) {
  foreach ($envFile in @(".env", ".env.local")) {
    $sourcePath = Join-Path $RepoRoot $envFile
    $targetPath = Join-Path $PayloadRoot $envFile

    if (Test-Path -LiteralPath $sourcePath) {
      Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }
  }
}

function Start-LocalArtifactFromMetadata {
  param(
    [string]$MetadataPath,
    [string]$RepoRoot,
    [int]$TargetPort
  )

  if (-not (Test-Path -LiteralPath $MetadataPath)) {
    Err "Metadata not found: $MetadataPath"
  }

  $meta = Read-JsonFile -PathValue $MetadataPath
  $artifactPath = [string]$meta.artifactPath
  if (-not $artifactPath) {
    Err "artifactPath missing in metadata: $MetadataPath"
  }
  if (-not (Test-Path -LiteralPath $artifactPath)) {
    Err "Artifact file not found: $artifactPath"
  }

  $artifactBase = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($artifactPath))
  $runtimeRoot = Join-Path $RepoRoot "artifacts\local-runtime\$artifactBase"
  $payloadRoot = Join-Path $runtimeRoot "payload"

  if (Test-Path -LiteralPath $runtimeRoot) {
    Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

  tar -xzf $artifactPath -C $runtimeRoot
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to extract artifact: $artifactPath"
  }

  $distIndex = Join-Path $payloadRoot "dist\index.js"
  if (-not (Test-Path -LiteralPath $distIndex)) {
    Err "Extracted artifact missing dist/index.js: $payloadRoot"
  }

  Sync-LocalRuntimeEnv -RepoRoot $RepoRoot -PayloadRoot $payloadRoot
  $payloadNodeModules = Join-Path $payloadRoot "node_modules"
  if (-not (Test-Path -LiteralPath $payloadNodeModules)) {
    Push-Location $payloadRoot
    try {
      Log "Installing runtime dependencies for local preview artifact..."
      & pnpm install --prod | Out-Host
    } finally {
      Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
      Err "Failed to install runtime dependencies for local preview artifact."
    }
  }
  Stop-PortListeners -TargetPort $TargetPort

  $logDir = Join-Path $RepoRoot ".codex-local"
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $stdoutLog = Join-Path $logDir "single-track-flow-$TargetPort.out.log"
  $stderrLog = Join-Path $logDir "single-track-flow-$TargetPort.err.log"
  Remove-Item -LiteralPath $stdoutLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrLog -Force -ErrorAction SilentlyContinue

  $cmd = "/c set NODE_ENV=production&&set PORT=$TargetPort&&node dist/index.js"
  Start-Process -FilePath "cmd.exe" -ArgumentList $cmd -WorkingDirectory $payloadRoot -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -WindowStyle Hidden | Out-Null

  $localRelease = Wait-Release -Url "http://localhost:$TargetPort/api/release" -TimeoutSec 30
  if (-not $localRelease) {
    Err "Local artifact failed to start on :$TargetPort. Logs: $stdoutLog / $stderrLog"
  }

  if (($localRelease.commit -ne $meta.commit) -or ($localRelease.version -ne $meta.version)) {
    Err "Local runtime mismatch. metadata=$($meta.version)@$($meta.commit) runtime=$($localRelease.version)@$($localRelease.commit)"
  }

  return [PSCustomObject]@{
    MetadataPath = $MetadataPath
    ArtifactPath = $artifactPath
    PayloadRoot = $payloadRoot
    Commit = [string]$meta.commit
    Version = [string]$meta.version
    ReleaseNote = [string]$meta.releaseNote
    StartedAt = (Get-Date).ToString("o")
    Port = $TargetPort
  }
}

$repoRoot = Resolve-RepoRoot
$deployScript = Join-Path $repoRoot "deploy.ps1"
$releasesDir = Join-Path $repoRoot "artifacts\releases"
$statePath = Join-Path $releasesDir "single-track-active.json"

if (-not (Test-Path -LiteralPath $deployScript)) {
  Err "Missing deploy entrypoint: $deployScript"
}
if ($Mode -eq "status") {
  $localRelease = Get-ReleaseOrNull -Url "http://localhost:$Port/api/release"
  $remoteRelease = Get-ReleaseOrNull -Url "$($ServerUrl.TrimEnd('/'))/api/release"

  if (Test-Path -LiteralPath $statePath) {
    $state = Normalize-SingleTrackState -Value (Read-JsonFile -PathValue $statePath) -SourceLabel $statePath
    Write-Host "Active artifact state:" -ForegroundColor Cyan
    $state | ConvertTo-Json -Depth 5
  } else {
    Warn "No active single-track state file yet: $statePath"
  }

  Write-Host "Local release:" -ForegroundColor Cyan
  if ($localRelease) { $localRelease | ConvertTo-Json -Compress } else { Write-Host "<unreachable>" -ForegroundColor Yellow }
  Write-Host "Remote release:" -ForegroundColor Cyan
  if ($remoteRelease) { $remoteRelease | ConvertTo-Json -Compress } else { Write-Host "<unreachable>" -ForegroundColor Yellow }
  exit 0
}

if ($Mode -eq "preview") {
  Log "Building release artifact from the clean current workspace..."
  & $deployScript -Mode build -ReleaseNote $ReleaseNote -SkipVerification:$SkipVerification
  if ($LASTEXITCODE -ne 0) {
    Err "Artifact build failed."
  }

  $latestMetaFile = Resolve-LatestMetadata -ReleasesDir $releasesDir
  if (-not $latestMetaFile) {
    Err "No metadata generated under $releasesDir"
  }

  $runtimeState = Normalize-SingleTrackState `
    -Value (Start-LocalArtifactFromMetadata -MetadataPath $latestMetaFile.FullName -RepoRoot $repoRoot -TargetPort $Port) `
    -SourceLabel "preview runtime state"

  $runtimeCommit = [string](Get-StateValue -State $runtimeState -Name "Commit")
  $runtimeVersion = [string](Get-StateValue -State $runtimeState -Name "Version")
  if (-not $runtimeCommit -or -not $runtimeVersion) {
    Err "Preview runtime state is missing commit/version information."
  }

  $runtimeState | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8

  $remoteRelease = Get-ReleaseOrNull -Url "$($ServerUrl.TrimEnd('/'))/api/release"
  if ($remoteRelease) {
    $sameAsRemote = ($remoteRelease.commit -eq $runtimeCommit) -and ($remoteRelease.version -eq $runtimeVersion)
    if ($sameAsRemote) {
      Log "Preview is already same as remote: $runtimeVersion@$runtimeCommit"
    } else {
      Warn "Preview differs from remote. local=$runtimeVersion@$runtimeCommit remote=$($remoteRelease.version)@$($remoteRelease.commit)"
    }
  } else {
    Warn "Remote release is unreachable: $ServerUrl"
  }

  Log "Preview ready at http://localhost:$Port"
  Write-Host "Next step deploy command:" -ForegroundColor Cyan
  Write-Host "  pnpm run release:deploy -- -ArtifactPath `"$($runtimeState.ArtifactPath)`" -MetadataPath `"$($runtimeState.MetadataPath)`"" -ForegroundColor Cyan
  exit 0
}

if (-not (Test-Path -LiteralPath $statePath)) {
  Err "No preview state found. Run preview first: pnpm run board:flow:preview -- -ReleaseNote `"your note`""
}

$activeState = Normalize-SingleTrackState -Value (Read-JsonFile -PathValue $statePath) -SourceLabel $statePath
$artifactToDeploy = [string](Get-StateValue -State $activeState -Name "ArtifactPath")
$metadataToDeploy = [string](Get-StateValue -State $activeState -Name "MetadataPath")

if (-not (Test-Path -LiteralPath $artifactToDeploy)) {
  Err "Active artifact not found: $artifactToDeploy"
}
if (-not (Test-Path -LiteralPath $metadataToDeploy)) {
  Err "Active metadata not found: $metadataToDeploy"
}

Log "Deploying the same artifact validated locally..."
& $deployScript `
  -Mode deploy `
  -ArtifactPath $artifactToDeploy `
  -MetadataPath $metadataToDeploy `
  -SkipRemoteSmoke:$SkipRemoteSmoke
if ($LASTEXITCODE -ne 0) {
  Err "Deploy failed."
}

$localAfter = Get-ReleaseOrNull -Url "http://localhost:$Port/api/release"
$remoteAfter = Get-ReleaseOrNull -Url "$($ServerUrl.TrimEnd('/'))/api/release"

if ($localAfter -and $remoteAfter) {
  $sameNow = ($localAfter.commit -eq $remoteAfter.commit) -and ($localAfter.version -eq $remoteAfter.version)
  if ($sameNow) {
    Log "Local and remote are aligned: $($remoteAfter.version)@$($remoteAfter.commit)"
  } else {
    Warn "Deploy finished but local/remote differ. local=$($localAfter.version)@$($localAfter.commit) remote=$($remoteAfter.version)@$($remoteAfter.commit)"
  }
} else {
  Warn "Could not verify local/remote release after deploy."
}
