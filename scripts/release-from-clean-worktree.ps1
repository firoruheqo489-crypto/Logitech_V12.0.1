param(
  [ValidateSet("build", "deploy", "all")]
  [string]$Mode = "all",
  [string]$ReleaseNote = "",
  [string]$OutputDir = "artifacts/releases",
  [string]$ArtifactPath = "",
  [string]$MetadataPath = "",
  [string]$HostAlias = "",
  [string]$RemoteDir = "",
  [switch]$SkipVerification,
  [switch]$SkipRemoteSmoke,
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
      "-SkipVerification" {
        $SkipVerification = $true
        continue
      }
      "-SkipRemoteSmoke" {
        $SkipRemoteSmoke = $true
        continue
      }
    }
  }
}

function Log($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

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
  [string]$FallbackLabel,
  [string]$RepoRootPath
) {
  $candidates = @(
    $PrimaryNote,
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

  $normalizedLabel = Normalize-SingleLine $FallbackLabel
  if (-not [string]::IsNullOrWhiteSpace($normalizedLabel)) {
    if ($normalizedLabel.Length -gt 180) {
      return $normalizedLabel.Substring(0, 180).Trim()
    }
    return $normalizedLabel
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
  $status = (& git -C $RepoRootPath status --porcelain 2>$null)
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to read git workspace state."
  }

  return @($status | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Assert-CleanGitWorkspace([string]$RepoRootPath) {
  $statusLines = Get-GitStatus $RepoRootPath
  if (@($statusLines).Count -gt 0) {
    Err "致命错误：工作区不干净。请人工执行 git commit 进行资产登记后，再启动发布流程。"
  }
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

  if (-not $SkipVerification) {
    & $deployScriptPath -Mode build -ReleaseNote $ReleaseText -OutputDir $OutputDir -DeepVerification
  } else {
    & $deployScriptPath -Mode build -ReleaseNote $ReleaseText -OutputDir $OutputDir
  }

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

  if (-not $SkipRemoteSmoke) {
    if (-not [string]::IsNullOrWhiteSpace($HostAlias) -and -not [string]::IsNullOrWhiteSpace($RemoteDir)) {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -HostAlias $HostAlias -RemoteDir $RemoteDir -DeepVerification
    } elseif (-not [string]::IsNullOrWhiteSpace($HostAlias)) {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -HostAlias $HostAlias -DeepVerification
    } elseif (-not [string]::IsNullOrWhiteSpace($RemoteDir)) {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -RemoteDir $RemoteDir -DeepVerification
    } else {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -DeepVerification
    }
  } else {
    if (-not [string]::IsNullOrWhiteSpace($HostAlias) -and -not [string]::IsNullOrWhiteSpace($RemoteDir)) {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -HostAlias $HostAlias -RemoteDir $RemoteDir
    } elseif (-not [string]::IsNullOrWhiteSpace($HostAlias)) {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -HostAlias $HostAlias
    } elseif (-not [string]::IsNullOrWhiteSpace($RemoteDir)) {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue -RemoteDir $RemoteDir
    } else {
      & $deployScriptPath -Mode deploy -ArtifactPath $ArtifactValue -MetadataPath $MetadataValue
    }
  }

  if ($LASTEXITCODE -ne 0) {
    Err "deploy.ps1 deploy failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = Get-RepoRoot
Push-Location $repoRoot
try {
  Assert-CleanGitWorkspace -RepoRootPath $repoRoot
  $flowLabel = Resolve-FlowLabel
  $releaseText = Resolve-ReleaseText -PrimaryNote $ReleaseNote -FallbackLabel $flowLabel -RepoRootPath $repoRoot

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
