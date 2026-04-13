param(
  [ValidateSet("build", "deploy", "all")]
  [string]$Mode = "build",
  [ValidateSet("minor", "major")]
  [string]$VersionBump = "minor",
  [string]$ReleaseNote = "",
  [string]$ArtifactPath = "",
  [string]$MetadataPath = "",
  [string]$OutputDir = "artifacts/releases",
  [switch]$SkipVerification,
  [switch]$SkipRemoteSmoke,
  [switch]$ConfirmProduction,
  [string]$ConfirmText = "",
  [string]$HostAlias = "",
  [string]$RemoteDir = "",
  [switch]$PreflightOnly,
  [string]$Ref = "HEAD",
  [switch]$KeepWorktree
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

function Resolve-AbsolutePath([string]$PathValue) {
  if (-not $PathValue) {
    return $null
  }
  try {
    return (Resolve-Path $PathValue).Path
  } catch {
    return $null
  }
}

function Resolve-RepoPath([string]$Root, [string]$PathValue) {
  if (-not $PathValue) {
    return $null
  }
  if ([IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }
  return (Join-Path $Root $PathValue)
}

function Remove-PathWithRetry([string]$PathValue, [int]$Attempts = 6) {
  if (-not $PathValue -or -not (Test-Path $PathValue)) {
    return $true
  }

  $lastError = $null
  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    try {
      if (Test-Path $PathValue) {
        Remove-Item -LiteralPath $PathValue -Recurse -Force -ErrorAction Stop
      }
    } catch {
      $lastError = $_
      try {
        cmd /c "rmdir /s /q `"$PathValue`"" | Out-Null
      } catch {
        $lastError = $_
      }
    }

    if (-not (Test-Path $PathValue)) {
      return $true
    }

    if ($attempt -lt $Attempts) {
      Start-Sleep -Milliseconds (250 * $attempt)
    }
  }

  if ($lastError) {
    Warn "Cleanup retry exhausted for ${PathValue}: $($lastError.Exception.Message)"
  }

  return -not (Test-Path $PathValue)
}

function Test-TrackedPathInWorktree([string]$WorktreeRoot, [string]$RelativePath) {
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & git -C $WorktreeRoot ls-files --error-unmatch -- $RelativePath 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Sync-WorkingTreeSnapshot([string]$SourceRoot, [string]$TargetRoot) {
  $statusLines = git -c core.quotepath=false -C $SourceRoot status --porcelain=v1 -uall
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to inspect working tree state for sync."
  }

  $synced = 0
  foreach ($line in $statusLines) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) {
      continue
    }

    $code = $line.Substring(0, 2)
    $rawPath = $line.Substring(3).Trim()
    if (-not $rawPath) {
      continue
    }

    if ($rawPath.StartsWith('"') -and $rawPath.EndsWith('"')) {
      $rawPath = $rawPath.Substring(1, $rawPath.Length - 2)
    }

    if ($rawPath.StartsWith('.release-worktrees/')) {
      continue
    }

    if ($rawPath.StartsWith('.codex-local/')) {
      continue
    }

    if ($rawPath -like '.codex-local-*') {
      continue
    }

    if ($rawPath.StartsWith('recovery/')) {
      continue
    }

    $targetRelativePath = $rawPath
    if ($rawPath.Contains(' -> ')) {
      $targetRelativePath = ($rawPath -split ' -> ')[-1]
    }

    $sourcePath = Join-Path $SourceRoot $targetRelativePath
    $targetPath = Join-Path $TargetRoot $targetRelativePath

    if ($code.StartsWith('??')) {
      if (-not (Test-Path $sourcePath)) {
        continue
      }
      $targetParent = Split-Path -Parent $targetPath
      if ($targetParent -and -not (Test-Path $targetParent)) {
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
      }
      Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force
      git -C $TargetRoot add -A -- $targetRelativePath | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Err "Failed to stage synced path in temporary worktree: $targetRelativePath"
      }
      $synced += 1
      continue
    }

    if ($code.Contains('D')) {
      $trackedInTarget = Test-TrackedPathInWorktree -WorktreeRoot $TargetRoot -RelativePath $targetRelativePath
      if (Test-Path $targetPath) {
        Remove-Item -Path $targetPath -Recurse -Force
      }

      if ($trackedInTarget) {
        git -C $TargetRoot add -A -- $targetRelativePath | Out-Null
        if ($LASTEXITCODE -ne 0) {
          Err "Failed to stage deleted path in temporary worktree: $targetRelativePath"
        }
      }

      continue
    }

    if (-not (Test-Path $sourcePath)) {
      continue
    }

    $targetParent = Split-Path -Parent $targetPath
    if ($targetParent -and -not (Test-Path $targetParent)) {
      New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    }
    Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force
    git -C $TargetRoot add -A -- $targetRelativePath | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Err "Failed to stage synced path in temporary worktree: $targetRelativePath"
    }
    $synced += 1
  }

  if ($synced -gt 0) {
    Log "Synced $synced working tree path(s) into temporary worktree."
  } else {
    Log "No working tree changes needed to be synced into temporary worktree."
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deployScript = Join-Path $repoRoot "deploy.ps1"
if (-not (Test-Path $deployScript)) {
  Err "Missing deploy entrypoint: $deployScript"
}

$resolvedRef = (git -C $repoRoot rev-parse --verify $Ref 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $resolvedRef) {
  Err "Invalid git ref: $Ref"
}
$shortRef = (git -C $repoRoot rev-parse --short $resolvedRef).Trim()
if ($LASTEXITCODE -ne 0 -or -not $shortRef) {
  Err "Failed to resolve short ref for $resolvedRef"
}

$workspaceStatus = git -c core.quotepath=false -C $repoRoot status --short
if ($LASTEXITCODE -ne 0) {
  Err "Failed to read git workspace state."
}
if ($workspaceStatus) {
  Warn "Primary workspace has local changes. Release will run from a clean temporary worktree."
}

$resolvedOutputDir = Resolve-RepoPath -Root $repoRoot -PathValue $OutputDir
$resolvedArtifactPath = Resolve-AbsolutePath $ArtifactPath
$resolvedMetadataPath = Resolve-AbsolutePath $MetadataPath

$timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$worktreeRoot = Join-Path $repoRoot ".release-worktrees"
$worktreePath = Join-Path $worktreeRoot "wt-$shortRef-$timestamp"

if (-not (Test-Path $worktreeRoot)) {
  New-Item -ItemType Directory -Path $worktreeRoot -Force | Out-Null
}

Log "Creating clean worktree at $worktreePath (ref=$shortRef)..."
git -C $repoRoot worktree add --detach $worktreePath $resolvedRef | Out-Null
if ($LASTEXITCODE -ne 0) {
  Err "Failed to create temporary worktree."
}

try {
  $runtimeEnvFiles = @(".env", ".env.local")
  foreach ($envFile in $runtimeEnvFiles) {
    $sourcePath = Join-Path $repoRoot $envFile
    $targetPath = Join-Path $worktreePath $envFile
    if ((Test-Path $sourcePath) -and -not (Test-Path $targetPath)) {
      Copy-Item -Path $sourcePath -Destination $targetPath -Force
      Log "Synced $envFile into temporary worktree."
    }
  }

  Sync-WorkingTreeSnapshot -SourceRoot $repoRoot -TargetRoot $worktreePath

  $worktreeNodeModules = Join-Path $worktreePath "node_modules"
  if (-not (Test-Path $worktreeNodeModules)) {
    Log "Installing dependencies in temporary worktree..."
    Push-Location $worktreePath
    try {
      pnpm install --frozen-lockfile
    } finally {
      Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
      Err "Failed to install dependencies in temporary worktree."
    }
  }

  $deployArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $worktreePath "deploy.ps1"),
    "-Mode", $Mode,
    "-VersionBump", $VersionBump,
    "-ReleaseNote", $ReleaseNote,
    "-OutputDir", $resolvedOutputDir
  )

  if ($resolvedArtifactPath) {
    $deployArgs += @("-ArtifactPath", $resolvedArtifactPath)
  }
  if ($resolvedMetadataPath) {
    $deployArgs += @("-MetadataPath", $resolvedMetadataPath)
  }
  if ($RemoteDir) { $deployArgs += @("-RemoteDir", $RemoteDir) }
  if ($SkipVerification) { $deployArgs += "-SkipVerification" }
  if ($SkipRemoteSmoke) { $deployArgs += "-SkipRemoteSmoke" }
  if ($ConfirmProduction) { $deployArgs += "-ConfirmProduction" }
  if ($ConfirmText) { $deployArgs += @("-ConfirmText", $ConfirmText) }
  if ($HostAlias) { $deployArgs += @("-HostAlias", $HostAlias) }
  if ($PreflightOnly) { $deployArgs += "-PreflightOnly" }
  $deployArgs += "-AllowDirtyWorkspace"

  Log "Running deploy.ps1 in clean worktree..."
  Push-Location $worktreePath
  try {
    $originalBuildSource = $env:RELEASE_BUILD_SOURCE
    $originalSourceWorkspaceDirty = $env:RELEASE_SOURCE_WORKSPACE_DIRTY
    $env:RELEASE_BUILD_SOURCE = "clean-worktree"
    $env:RELEASE_SOURCE_WORKSPACE_DIRTY = if ([string]::IsNullOrWhiteSpace($workspaceStatus)) { "false" } else { "true" }

    try {
      & powershell @deployArgs
    } finally {
      if ($null -eq $originalBuildSource) {
        Remove-Item "Env:RELEASE_BUILD_SOURCE" -ErrorAction SilentlyContinue
      } else {
        Set-Item "Env:RELEASE_BUILD_SOURCE" $originalBuildSource
      }

      if ($null -eq $originalSourceWorkspaceDirty) {
        Remove-Item "Env:RELEASE_SOURCE_WORKSPACE_DIRTY" -ErrorAction SilentlyContinue
      } else {
        Set-Item "Env:RELEASE_SOURCE_WORKSPACE_DIRTY" $originalSourceWorkspaceDirty
      }
    }
  } finally {
    Pop-Location
  }

  if ($LASTEXITCODE -ne 0) {
    Err "deploy.ps1 failed in temporary worktree."
  }
  Log "Clean-worktree release flow succeeded."
} finally {
  if ($KeepWorktree) {
    Warn "Keeping temporary worktree: $worktreePath"
  } else {
    Log "Removing temporary worktree..."
    $generatedCleanupTargets = @(
      (Join-Path $worktreePath "node_modules"),
      (Join-Path $worktreePath "dist")
    )

    foreach ($cleanupTarget in $generatedCleanupTargets) {
      if (Test-Path $cleanupTarget) {
        Remove-PathWithRetry -PathValue $cleanupTarget | Out-Null
      }
    }

    git -C $repoRoot worktree remove --force $worktreePath | Out-Null
    if ($LASTEXITCODE -ne 0 -or (Test-Path $worktreePath)) {
      Warn "git worktree remove did not fully clear the temporary worktree; attempting filesystem cleanup."
      if (-not (Remove-PathWithRetry -PathValue $worktreePath)) {
        Warn "Failed to remove temporary worktree automatically: $worktreePath"
      }
    }

    if (-not (Test-Path $worktreePath)) {
      git -C $repoRoot worktree prune --expire now | Out-Null
      Log "Cleaned up temporary worktree directory."
    }
  }
}
