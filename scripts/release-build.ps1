param(
  [string]$ReleaseNote = "",
  [string]$OutputDir = "artifacts/releases",
  [switch]$DeepVerification,
  [switch]$PreflightOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  Log $Label
  & $Command
  if ($LASTEXITCODE -ne 0) {
    Err $FailureMessage
  }
}

function Parse-SemVer([string]$Value) {
  if (-not $Value) {
    return $null
  }

  $normalized = $Value.Trim()
  if ($normalized.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
    $normalized = $normalized.Substring(1)
  }

  if ($normalized -notmatch "^(\d+)\.(\d+)\.(\d+)$") {
    return $null
  }

  return [pscustomobject]@{
    Major = [int]$matches[1]
    Minor = [int]$matches[2]
    Patch = [int]$matches[3]
  }
}

function Format-SemVer($Value) {
  return "$($Value.Major).$($Value.Minor).$($Value.Patch)"
}

function Get-LocalPackageVersion([string]$Root) {
  $packagePath = Join-Path $Root "package.json"
  if (-not (Test-Path $packagePath)) {
    return $null
  }

  try {
    $packageJson = Get-Content $packagePath -Raw | ConvertFrom-Json
    if ($packageJson.version) {
      return [string]$packageJson.version
    }
  } catch {
    return $null
  }

  return $null
}

function Resolve-ReleaseNote([string]$RawNote, [switch]$AllowEmpty) {
  $singleLine = ($RawNote -replace "(\r\n|\n|\r)+", " ").Trim()
  $singleLine = ($singleLine -replace "\s{2,}", " ").Trim()

  if (-not $singleLine -and -not $AllowEmpty) {
    Err "ReleaseNote is required. Example: -ReleaseNote '修复看板删除误触'."
  }

  if ($singleLine.Length -gt 180) {
    Warn "ReleaseNote is longer than 180 chars; truncating."
    $singleLine = $singleLine.Substring(0, 180).Trim()
  }

  return $singleLine
}

function Require-CleanGitWorkspace([string]$Root) {
  $status = git -C $Root status --porcelain=v1 --untracked-files=all 2>$null
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to read git workspace state."
  }

  if ($status) {
    Write-Host $status -ForegroundColor Yellow
    Err "Refusing release build from a dirty workspace."
  }
}

function Assert-NoMixedLineEndings([string]$Root) {
  $releasePathList = @(
    "AGENTS.md"
    ".gitignore"
    "docs/release-sop.md"
    "deploy.ps1"
    "package.json"
    "pnpm-lock.yaml"
    "scripts/show-release-sop.ps1"
    "scripts/deploy-release-artifact.ps1"
    "scripts/release-build.ps1"
    "scripts/report-local-dashboard-state.ps1"
    "scripts/start-local-dashboard.mjs"
    "scripts/write-release-manifest.mjs"
    "scripts/verify-local-reliability-smoke.ps1"
    "scripts/verify-reliability-smoke.mjs"
    "scripts/verify-reliability-smoke.ps1"
    "server/db.ts"
    "server/index.ts"
    "server/lib/reliability-engine.ts"
    "server/release.ts"
    "server/routes/reliability.ts"
  )

  $eolReport = git -C $Root ls-files --eol -- $releasePathList
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to inspect git line endings."
  }

  $invalidLines = @(
    $eolReport | Where-Object {
      $_ -match '\bw/(mixed|crlf)\b'
    }
  )

  if ($invalidLines.Count -gt 0) {
    Write-Host $invalidLines -ForegroundColor Yellow
    Err "Detected non-LF tracked files. Normalize line endings before release."
  }
}

function Resolve-ReleaseNote([string]$RawNote, [switch]$AllowEmpty) {
  $singleLine = ($RawNote -replace "(\r\n|\n|\r)+", " ").Trim()
  $singleLine = ($singleLine -replace "\s{2,}", " ").Trim()

  if (-not $singleLine -and -not $AllowEmpty) {
    $singleLine = ((git -C $repoRoot show -s --format=%s HEAD 2>$null) | Select-Object -First 1)
    $singleLine = ($singleLine -replace "(\r\n|\n|\r)+", " ").Trim()
    $singleLine = ($singleLine -replace "\s{2,}", " ").Trim()
  }

  if ($singleLine.Length -gt 180) {
    Warn "ReleaseNote is longer than 180 chars; truncating."
    $singleLine = $singleLine.Substring(0, 180).Trim()
  }

  return $singleLine
}

function Resolve-ReleasePlan([string]$Root) {
  $localRaw = Get-LocalPackageVersion $Root
  $localVersion = Parse-SemVer $localRaw
  if (-not $localVersion) {
    Err "Invalid local package.json version: '$localRaw'"
  }

  return [pscustomobject]@{
    BaseVersion = $localRaw
    BaseSource = "local package.json"
    NextVersion = (Format-SemVer $localVersion)
    ChangeType = "local"
  }
}

function Get-FreeLocalPort([int]$StartPort = 3301, [int]$MaxPort = 3399) {
  for ($port = $StartPort; $port -le $MaxPort; $port += 1) {
    $owner = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq "Listen" } |
      Select-Object -First 1

    if (-not $owner) {
      return $port
    }
  }

  Err "Could not find a free local port between $StartPort and $MaxPort"
}

function Get-BooleanEnvLiteral([bool]$Value) {
  if ($Value) {
    return "true"
  }

  return "false"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoRoot
try {
  Show-ReleaseSop $repoRoot
  Assert-NoMixedLineEndings $repoRoot
  Require-CleanGitWorkspace $repoRoot
  $workspaceStatus = ""

  if (-not $DeepVerification -and -not $PreflightOnly) {
    Err "DeepVerification is required for release builds."
  }

  $releaseNoteNormalized = Resolve-ReleaseNote $ReleaseNote -AllowEmpty:$PreflightOnly

  $commitFull = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $commitFull) {
    Err "Failed to resolve git commit."
  }
  $commitShort = (git rev-parse --short HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $commitShort) {
    Err "Failed to resolve short git commit."
  }

  $plan = Resolve-ReleasePlan $repoRoot
  $targetVersion = [string]$plan.NextVersion
  $changeType = [string]$plan.ChangeType
  Log "Release version: $($plan.BaseSource) -> $targetVersion"

  Invoke-Step "Running TypeScript verification..." { pnpm exec tsc --noEmit } "TypeScript verification failed"

  if ($DeepVerification) {
    Invoke-Step "Running release guard checks..." { pnpm.cmd run verify:release-guards } "Release guard checks failed"

    $ossSmokePort = Get-FreeLocalPort
    Invoke-Step "Running local OSS upload/delete smoke on port $ossSmokePort..." { powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local-oss-smoke.ps1 -Port $ossSmokePort -Retries 60 -RetryIntervalMs 1500 } "Local OSS upload/delete smoke failed"

    $reliabilitySmokePort = Get-FreeLocalPort -StartPort ($ossSmokePort + 1)
    Invoke-Step "Running local reliability smoke on port $reliabilitySmokePort..." { powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local-reliability-smoke.ps1 -Port $reliabilitySmokePort -Retries 60 -RetryIntervalMs 1500 } "Local reliability smoke failed"
  }

  if ($PreflightOnly) {
    Log "Preflight finished. Skipping build artifact generation."
    exit 0
  }

  $originalVersionOverride = $env:RELEASE_VERSION_OVERRIDE
  $originalCommitOverride = $env:RELEASE_COMMIT_OVERRIDE
  $originalCommitShortOverride = $env:RELEASE_COMMIT_SHORT_OVERRIDE
  $originalBuildSource = $env:RELEASE_BUILD_SOURCE
  $originalSourceWorkspaceDirty = $env:RELEASE_SOURCE_WORKSPACE_DIRTY
  try {
    $env:RELEASE_VERSION_OVERRIDE = $targetVersion
    $env:RELEASE_COMMIT_OVERRIDE = $commitFull
    $env:RELEASE_COMMIT_SHORT_OVERRIDE = $commitShort
    if ([string]::IsNullOrWhiteSpace($env:RELEASE_BUILD_SOURCE)) {
      $env:RELEASE_BUILD_SOURCE = "workspace"
    }
    if ([string]::IsNullOrWhiteSpace($env:RELEASE_SOURCE_WORKSPACE_DIRTY)) {
      $env:RELEASE_SOURCE_WORKSPACE_DIRTY = Get-BooleanEnvLiteral (-not [string]::IsNullOrWhiteSpace($workspaceStatus))
    }
    Invoke-Step "Building release bundle..." { pnpm build } "Build failed"
  } finally {
    if ($null -eq $originalVersionOverride) {
      Remove-Item "Env:RELEASE_VERSION_OVERRIDE" -ErrorAction SilentlyContinue
    } else {
      Set-Item "Env:RELEASE_VERSION_OVERRIDE" $originalVersionOverride
    }

    if ($null -eq $originalCommitOverride) {
      Remove-Item "Env:RELEASE_COMMIT_OVERRIDE" -ErrorAction SilentlyContinue
    } else {
      Set-Item "Env:RELEASE_COMMIT_OVERRIDE" $originalCommitOverride
    }

    if ($null -eq $originalCommitShortOverride) {
      Remove-Item "Env:RELEASE_COMMIT_SHORT_OVERRIDE" -ErrorAction SilentlyContinue
    } else {
      Set-Item "Env:RELEASE_COMMIT_SHORT_OVERRIDE" $originalCommitShortOverride
    }

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

  $releaseManifestPath = Join-Path $repoRoot "dist/release.json"
  if (-not (Test-Path $releaseManifestPath)) {
    Err "Build did not produce dist/release.json"
  }

  $releaseManifest = Get-Content $releaseManifestPath -Raw | ConvertFrom-Json
  if ([string]$releaseManifest.version -ne $targetVersion) {
    Err "release.json version mismatch. expected=$targetVersion actual=$([string]$releaseManifest.version)"
  }

  $resolvedOutputDir = if ([IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { (Join-Path $repoRoot $OutputDir) }
  New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null

  $timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
  $artifactBaseName = "release-v$targetVersion-c$commitShort-$timestamp"
  $stagingRoot = Join-Path $resolvedOutputDir ".staging-$artifactBaseName"
  $payloadRoot = Join-Path $stagingRoot "payload"
  $payloadScriptsRoot = Join-Path $payloadRoot "scripts"
  $metadataInStagingPath = Join-Path $stagingRoot "release-metadata.json"
  $artifactPath = Join-Path $resolvedOutputDir "$artifactBaseName.tar.gz"
  $metadataPath = Join-Path $resolvedOutputDir "$artifactBaseName.metadata.json"
  $pointerPath = Join-Path $resolvedOutputDir "latest-release.json"

  if (Test-Path $stagingRoot) {
    Remove-Item -Recurse -Force $stagingRoot
  }
  New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $payloadScriptsRoot -Force | Out-Null

  Copy-Item -Recurse -Force (Join-Path $repoRoot "dist") (Join-Path $payloadRoot "dist")
  Copy-Item -Force (Join-Path $repoRoot "package.json") (Join-Path $payloadRoot "package.json")
  Copy-Item -Force (Join-Path $repoRoot "pnpm-lock.yaml") (Join-Path $payloadRoot "pnpm-lock.yaml")
  Copy-Item -Force (Join-Path $repoRoot "ecosystem.config.cjs") (Join-Path $payloadRoot "ecosystem.config.cjs")
  Copy-Item -Force (Join-Path $repoRoot "scripts/verify-oss-http-smoke.mjs") (Join-Path $payloadScriptsRoot "verify-oss-http-smoke.mjs")
  Copy-Item -Force (Join-Path $repoRoot "scripts/verify-reliability-smoke.mjs") (Join-Path $payloadScriptsRoot "verify-reliability-smoke.mjs")
  Copy-Item -Force (Join-Path $repoRoot "scripts/verify-reliability-smoke.ps1") (Join-Path $payloadScriptsRoot "verify-reliability-smoke.ps1")
  Copy-Item -Force (Join-Path $repoRoot "scripts/verify-local-reliability-smoke.ps1") (Join-Path $payloadScriptsRoot "verify-local-reliability-smoke.ps1")

  if (Test-Path (Join-Path $repoRoot "patches")) {
    Copy-Item -Recurse -Force (Join-Path $repoRoot "patches") (Join-Path $payloadRoot "patches")
  }

  if (Test-Path (Join-Path $repoRoot "drizzle")) {
    Copy-Item -Recurse -Force (Join-Path $repoRoot "drizzle") (Join-Path $payloadRoot "drizzle")
  }

  $metadata = [ordered]@{
    schemaVersion = 1
    app = "mold-gantt-v3"
    artifactName = [IO.Path]::GetFileName($artifactPath)
    artifactPath = $artifactPath
    version = $targetVersion
    changeType = $changeType
    releaseNote = $releaseNoteNormalized
    commit = $commitFull
    commitShort = $commitShort
    builtAt = (Get-Date).ToString("o")
    createdBy = "$env:COMPUTERNAME\$env:USERNAME"
    payloadRoot = "payload"
    releaseLogLine = "$((Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz")) | V$targetVersion | $changeType | $releaseNoteNormalized | $commitShort"
  }

  $metadataJson = ($metadata | ConvertTo-Json -Depth 10)
  Set-Content -Path $metadataInStagingPath -Value $metadataJson -Encoding utf8
  Set-Content -Path $metadataPath -Value $metadataJson -Encoding utf8

  if (Test-Path $artifactPath) {
    Remove-Item -Force $artifactPath
  }

  Push-Location $stagingRoot
  try {
    tar -czf $artifactPath "payload" "release-metadata.json"
    if ($LASTEXITCODE -ne 0) {
      Err "Failed to build artifact archive."
    }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $artifactPath)) {
    Err "Artifact archive was not created: $artifactPath"
  }

  $hash = Get-FileHash -Path $artifactPath -Algorithm SHA256
  [System.IO.File]::WriteAllText(
    "$artifactPath.sha256",
    "$($hash.Hash)  $([IO.Path]::GetFileName($artifactPath))`n",
    [System.Text.Encoding]::ASCII
  )

  $pointer = [ordered]@{
    artifactPath = $artifactPath
    metadataPath = $metadataPath
    version = $targetVersion
    commit = $commitFull
    commitShort = $commitShort
    releaseNote = $releaseNoteNormalized
    builtAt = (Get-Date).ToString("o")
  }
  Set-Content -Path $pointerPath -Value ($pointer | ConvertTo-Json -Depth 10) -Encoding utf8

  if (Test-Path $stagingRoot) {
    Remove-Item -Recurse -Force $stagingRoot
  }

  Log "Release artifact created successfully."
  Write-Host "  Version: V$targetVersion" -ForegroundColor Cyan
  Write-Host "  Artifact: $artifactPath" -ForegroundColor Cyan
  Write-Host "  Metadata: $metadataPath" -ForegroundColor Cyan
  Write-Host "  SHA256:   $artifactPath.sha256" -ForegroundColor Cyan
  Write-Host "ARTIFACT_PATH=$artifactPath"
  Write-Host "METADATA_PATH=$metadataPath"
} finally {
  Pop-Location
}
