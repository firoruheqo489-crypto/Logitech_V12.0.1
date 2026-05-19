param(
  [ValidateSet("build", "deploy", "all")]
  [string]$Mode = "all",
  [string]$ReleaseNote = "",
  [string]$CommitMessage = "",
  [string]$OutputDir = "artifacts/releases",
  [string]$ArtifactPath = "",
  [string]$MetadataPath = "",
  [string]$HostAlias = "",
  [string]$RemoteDir = "",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($RemainingArgs.Count -gt 0) {
  for ($index = 0; $index -lt $RemainingArgs.Count; $index += 1) {
    switch ($RemainingArgs[$index]) {
      "--" { continue }
      "-ReleaseNote" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $ReleaseNote = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
      "-CommitMessage" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $CommitMessage = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
      "-OutputDir" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $OutputDir = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
      "-ArtifactPath" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $ArtifactPath = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
      "-MetadataPath" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $MetadataPath = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
      "-HostAlias" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $HostAlias = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
      "-RemoteDir" {
        if ($index + 1 -lt $RemainingArgs.Count) {
          $RemoteDir = [string]$RemainingArgs[$index + 1]
          $index += 1
        }
        continue
      }
    }
  }
}

function Log($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

function Show-ReleaseSop([string]$RepoRootPath) {
  if (-not [string]::IsNullOrWhiteSpace($env:RELEASE_SOP_SHOWN)) {
    return
  }

  $showSopScript = Join-Path $RepoRootPath "scripts/show-release-sop.ps1"
  if (-not (Test-Path -LiteralPath $showSopScript)) {
    Err "Missing script: $showSopScript"
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $showSopScript
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to display release SOP."
  }

  $env:RELEASE_SOP_SHOWN = "1"
}

function Normalize-SingleLine([string]$Value) {
  if ($null -eq $Value) {
    return ""
  }

  $singleLine = ($Value -replace "(\r\n|\n|\r)+", " ").Trim()
  return ($singleLine -replace "\s{2,}", " ").Trim()
}

function Resolve-FlowLabel() {
  return (Get-Date).ToString("yyyyMMdd-HHmmss")
}

function Resolve-ReleaseText(
  [string]$PrimaryNote,
  [string]$FallbackCommitMessage,
  [string]$FallbackLabel,
  [string]$RepoRootPath
) {
  $candidates = @(
    $PrimaryNote,
    $FallbackCommitMessage,
    $FallbackLabel
  )

  foreach ($candidate in $candidates) {
    $normalized = Normalize-SingleLine $candidate
    if (-not [string]::IsNullOrWhiteSpace($normalized)) {
      if ($normalized.Length -gt 180) {
        return $normalized.Substring(0, 180).Trim()
      }
      return $normalized
    }
  }

  try {
    $headSubject = (& git -C $RepoRootPath show -s --format=%s HEAD 2>$null | Select-Object -First 1)
    $normalizedHead = Normalize-SingleLine $headSubject
    if (-not [string]::IsNullOrWhiteSpace($normalizedHead)) {
      if ($normalizedHead.Length -gt 180) {
        return $normalizedHead.Substring(0, 180).Trim()
      }
      return $normalizedHead
    }
  } catch {
  }

  return "release"
}

function Get-RepoRoot() {
  $root = (& git rev-parse --show-toplevel).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
    Err "Failed to resolve repository root."
  }

  return $root
}

function Get-GitStatus([string]$RepoRootPath) {
  $status = (& git -C $RepoRootPath status --porcelain=v1 --untracked-files=all 2>$null)
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to read git workspace state."
  }

  return @($status | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Require-CleanWorkspace([string]$RepoRootPath) {
  $statusLines = Get-GitStatus $RepoRootPath
  if (@($statusLines).Count -eq 0) {
    return
  }

  Write-Host (@($statusLines) -join "`n") -ForegroundColor Yellow
  Err "Refusing release from a dirty workspace. Please commit or stash changes before running the release flow."
}

function Resolve-LatestReleaseMetadata([string]$RepoRootPath, [string]$ConfiguredOutputDir) {
  $resolvedOutputDir = if ([IO.Path]::IsPathRooted($ConfiguredOutputDir)) {
    $ConfiguredOutputDir
  } else {
    Join-Path $RepoRootPath $ConfiguredOutputDir
  }

  if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    Err "Release output directory not found: $resolvedOutputDir"
  }

  $latestMetadata = Get-ChildItem -LiteralPath $resolvedOutputDir -File -Filter "*.metadata.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $latestMetadata) {
    Err "No release metadata found under $resolvedOutputDir"
  }

  $metadata = Get-Content -LiteralPath $latestMetadata.FullName -Raw | ConvertFrom-Json
  $artifactPath = [string]$metadata.artifactPath
  if ([string]::IsNullOrWhiteSpace($artifactPath)) {
    Err "artifactPath missing from $($latestMetadata.FullName)"
  }

  if (-not (Test-Path -LiteralPath $artifactPath)) {
    Err "Artifact not found: $artifactPath"
  }

  return [pscustomobject]@{
    OutputDir = $resolvedOutputDir
    MetadataPath = $latestMetadata.FullName
    ArtifactPath = $artifactPath
    Metadata = $metadata
  }
}

function Invoke-Backup([string]$RepoRootPath) {
  $backupScriptPath = Join-Path $RepoRootPath "backup.ps1"
  if (-not (Test-Path -LiteralPath $backupScriptPath)) {
    Err "Missing script: $backupScriptPath"
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupScriptPath
  if ($LASTEXITCODE -ne 0) {
    Err "backup.ps1 failed with exit code $LASTEXITCODE"
  }
}

function Invoke-ReleaseBuild(
  [string]$RepoRootPath,
  [string]$ReleaseText
) {
  $deployScriptPath = Join-Path $RepoRootPath "deploy.ps1"
  if (-not (Test-Path -LiteralPath $deployScriptPath)) {
    Err "Missing script: $deployScriptPath"
  }

  & $deployScriptPath -Mode build -ReleaseNote $ReleaseText -OutputDir $OutputDir -DeepVerification

  if ($LASTEXITCODE -ne 0) {
    Err "deploy.ps1 build failed with exit code $LASTEXITCODE"
  }
}

function Invoke-ReleaseDeploy(
  [string]$RepoRootPath,
  [string]$ArtifactValue,
  [string]$MetadataValue
) {
  $deployScriptPath = Join-Path $RepoRootPath "deploy.ps1"
  if (-not (Test-Path -LiteralPath $deployScriptPath)) {
    Err "Missing script: $deployScriptPath"
  }

  $deployParams = @{
    Mode = "deploy"
    ArtifactPath = $ArtifactValue
    MetadataPath = $MetadataValue
  }
  if (-not [string]::IsNullOrWhiteSpace($HostAlias)) {
    $deployParams.HostAlias = $HostAlias
  }
  if (-not [string]::IsNullOrWhiteSpace($RemoteDir)) {
    $deployParams.RemoteDir = $RemoteDir
  }
  & $deployScriptPath @deployParams

  if ($LASTEXITCODE -ne 0) {
    Err "deploy.ps1 deploy failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = Get-RepoRoot
Push-Location $repoRoot
try {
  Show-ReleaseSop -RepoRootPath $repoRoot
  $flowLabel = Resolve-FlowLabel
  $releaseText = Resolve-ReleaseText -PrimaryNote $ReleaseNote -FallbackCommitMessage $CommitMessage -FallbackLabel $flowLabel -RepoRootPath $repoRoot

  Log "Flow label: $flowLabel"
  Log "Release text: $releaseText"

  if ($Mode -eq "deploy") {
    if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
      $latest = Resolve-LatestReleaseMetadata -RepoRootPath $repoRoot -ConfiguredOutputDir $OutputDir
      $ArtifactPath = $latest.ArtifactPath
      $MetadataPath = $latest.MetadataPath
    }

    Log "Deploying artifact via the verified release chain..."
    Invoke-ReleaseDeploy -RepoRootPath $repoRoot -ArtifactValue $ArtifactPath -MetadataValue $MetadataPath
    Log "One-click release flow finished."
    exit 0
  }

  Require-CleanWorkspace -RepoRootPath $repoRoot
  Log "Creating physical backup snapshot..."
  Invoke-Backup -RepoRootPath $repoRoot

  if ($Mode -eq "build") {
    Log "Running verified release build..."
    Invoke-ReleaseBuild -RepoRootPath $repoRoot -ReleaseText $releaseText
    $latest = Resolve-LatestReleaseMetadata -RepoRootPath $repoRoot -ConfiguredOutputDir $OutputDir
    Write-Host "ARTIFACT_PATH=$($latest.ArtifactPath)"
    Write-Host "METADATA_PATH=$($latest.MetadataPath)"
    Log "One-click release build finished."
    exit 0
  }

  Log "Running verified release build..."
  Invoke-ReleaseBuild -RepoRootPath $repoRoot -ReleaseText $releaseText
  $latestRelease = Resolve-LatestReleaseMetadata -RepoRootPath $repoRoot -ConfiguredOutputDir $OutputDir

  Log "Deploying verified artifact..."
  Invoke-ReleaseDeploy -RepoRootPath $repoRoot -ArtifactValue $latestRelease.ArtifactPath -MetadataValue $latestRelease.MetadataPath

  Log "One-click release flow finished."
  Write-Host "  Artifact: $($latestRelease.ArtifactPath)" -ForegroundColor Cyan
  Write-Host "  Metadata: $($latestRelease.MetadataPath)" -ForegroundColor Cyan
} finally {
  Pop-Location
}
