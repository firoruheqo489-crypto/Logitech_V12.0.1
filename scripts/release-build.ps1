param(
  [ValidateSet("minor", "major")]
  [string]$VersionBump = "minor",
  [string]$ReleaseNote = "",
  [string]$OutputDir = "artifacts/releases",
  [string]$HostAlias = "aliyun",
  [string]$RemoteDir = "/var/www/logitech",
  [switch]$SkipVerification,
  [switch]$PreflightOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

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

function Get-RemoteReleaseVersion([string]$TargetHost, [string]$TargetRemoteDir) {
  $cmd = "if [ -f ${TargetRemoteDir}/dist/release.json ]; then cat ${TargetRemoteDir}/dist/release.json; elif [ -f ${TargetRemoteDir}/package.json ]; then cat ${TargetRemoteDir}/package.json; fi"
  $raw = ssh $TargetHost $cmd
  if ($LASTEXITCODE -ne 0 -or -not $raw) {
    return $null
  }

  try {
    $obj = $raw | ConvertFrom-Json
    if ($obj.version) {
      return [string]$obj.version
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

function Resolve-ReleasePlan([string]$Root, [string]$BumpType, [string]$TargetHost, [string]$TargetRemoteDir) {
  $localRaw = Get-LocalPackageVersion $Root
  $localVersion = Parse-SemVer $localRaw
  if (-not $localVersion) {
    Err "Invalid local package.json version: '$localRaw'"
  }

  $baseRaw = $localRaw
  $baseSource = "local package.json"

  $remoteRaw = Get-RemoteReleaseVersion $TargetHost $TargetRemoteDir
  $remoteVersion = Parse-SemVer $remoteRaw
  if ($remoteVersion) {
    $baseRaw = $remoteRaw
    $baseSource = "remote deployed version"
  } elseif ($remoteRaw) {
    Warn "Remote version '$remoteRaw' is invalid. Falling back to local version."
  } else {
    Warn "Remote version not found. Falling back to local version."
  }

  $baseVersion = Parse-SemVer $baseRaw
  $nextVersion = [pscustomobject]@{
    Major = $baseVersion.Major
    Minor = $baseVersion.Minor
    Patch = $baseVersion.Patch
  }

  $changeType = "small"
  if ($BumpType -eq "major") {
    $nextVersion.Minor = $nextVersion.Minor + 1
    $nextVersion.Patch = 1
    $changeType = "major"
  } else {
    $nextVersion.Patch = $nextVersion.Patch + 1
  }

  return [pscustomobject]@{
    BaseVersion = $baseRaw
    BaseSource = $baseSource
    NextVersion = (Format-SemVer $nextVersion)
    ChangeType = $changeType
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

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoRoot
try {
  Require-CleanGitWorkspace $repoRoot

  $releaseNoteNormalized = Resolve-ReleaseNote $ReleaseNote -AllowEmpty:$PreflightOnly

  $commitFull = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $commitFull) {
    Err "Failed to resolve git commit."
  }
  $commitShort = (git rev-parse --short HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $commitShort) {
    Err "Failed to resolve short git commit."
  }

  $plan = Resolve-ReleasePlan $repoRoot $VersionBump $HostAlias $RemoteDir
  $targetVersion = [string]$plan.NextVersion
  $changeType = [string]$plan.ChangeType
  Log "Release version plan: $($plan.BaseSource) $($plan.BaseVersion) -> $targetVersion ($changeType)"

  if (-not $SkipVerification) {
    Invoke-Step "Running TypeScript verification..." { pnpm exec tsc --noEmit } "TypeScript verification failed"
    Invoke-Step "Running client release guard tests..." { pnpm exec vitest run client/src/server-index.structure.test.ts client/src/server-error-payload.structure.test.ts client/src/pages/dashboard/lib/dashboardApi.test.ts } "Client release guard tests failed"
    Invoke-Step "Running server release guard tests..." { pnpm exec vitest run --root . server/middleware/apiCors.test.ts server/middleware/apiAccessPolicy.test.ts server/release.test.ts server/routes/progress-notes-guard.test.ts } "Server release guard tests failed"

    $smokePort = Get-FreeLocalPort
    Invoke-Step "Running local OSS upload/delete smoke on port $smokePort..." { powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local-oss-smoke.ps1 -Port $smokePort -Retries 40 } "Local OSS upload/delete smoke failed"
  } else {
    Warn "SkipVerification is enabled. Build will continue without verification gates."
  }

  if ($PreflightOnly) {
    Log "Preflight finished. Skipping build artifact generation."
    exit 0
  }

  $originalVersionOverride = $env:RELEASE_VERSION_OVERRIDE
  try {
    $env:RELEASE_VERSION_OVERRIDE = $targetVersion
    Invoke-Step "Building release bundle..." { pnpm build } "Build failed"
  } finally {
    if ($null -eq $originalVersionOverride) {
      Remove-Item "Env:RELEASE_VERSION_OVERRIDE" -ErrorAction SilentlyContinue
    } else {
      Set-Item "Env:RELEASE_VERSION_OVERRIDE" $originalVersionOverride
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
  Set-Content -Path "$artifactPath.sha256" -Value "$($hash.Hash)  $([IO.Path]::GetFileName($artifactPath))" -Encoding ascii

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
