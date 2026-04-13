param(
  [ValidateSet("minor", "major")]
  [string]$VersionBump = "minor",
  [string]$ReleaseNote = "",
  [string]$OutputDir = "artifacts/releases",
  [string]$HostAlias = "",
  [string]$RemoteDir = "",
  [switch]$SkipVerification,
  [switch]$PreflightOnly,
  [switch]$AllowDirtyWorkspace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red; exit 1 }

function Resolve-DeployHostAlias([string]$ConfiguredHostAlias) {
  if (-not [string]::IsNullOrWhiteSpace($ConfiguredHostAlias)) {
    return $ConfiguredHostAlias.Trim()
  }

  $envHostAlias = [string]$env:DEPLOY_HOST_ALIAS
  if (-not [string]::IsNullOrWhiteSpace($envHostAlias)) {
    return $envHostAlias.Trim()
  }

  return "root@120.27.153.140"
}

function Resolve-DeployRemoteDir([string]$ConfiguredRemoteDir) {
  $candidate = $ConfiguredRemoteDir
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $candidate = [string]$env:DEPLOY_REMOTE_DIR
  }
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $candidate = "/var/www/logitech"
  }

  $normalized = $candidate.Trim()
  while ($normalized.EndsWith("/") -and $normalized.Length -gt 1) {
    $normalized = $normalized.Substring(0, $normalized.Length - 1)
  }

  if (-not $normalized.StartsWith("/")) {
    Err "RemoteDir must be an absolute Unix path, for example /var/www/logitech."
  }

  if ($normalized -eq "/") {
    Err "RemoteDir cannot be the filesystem root."
  }

  if ($normalized -match '[\s''"`$&|;<>\(\)\{\}\[\]]') {
    Err "RemoteDir contains unsupported characters. Use a simple absolute Unix path without spaces or shell metacharacters."
  }

  return $normalized
}

function Resolve-DeployServerUrl() {
  $candidate = [string]$env:DEPLOY_SERVER_URL
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $candidate = "http://120.27.153.140:3000"
  }

  return $candidate.TrimEnd("/")
}

function Resolve-RepoKnownHostsPath([string]$RepoRootPath) {
  $sshStateDir = Join-Path $RepoRootPath ".codex-local"
  New-Item -ItemType Directory -Path $sshStateDir -Force | Out-Null
  return (Join-Path $sshStateDir "deploy-known_hosts")
}

function Invoke-Ssh {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRootPath,
    [Parameter(Mandatory = $true)][string]$TargetHost,
    [string]$RemoteCommand = "",
    [switch]$BatchMode,
    [int]$ConnectTimeoutSec = 0
  )

  $knownHostsPath = Resolve-RepoKnownHostsPath $RepoRootPath
  $sshArgs = @(
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "UserKnownHostsFile=$knownHostsPath"
  )

  if ($BatchMode) {
    $sshArgs += @("-o", "BatchMode=yes")
  }

  if ($ConnectTimeoutSec -gt 0) {
    $sshArgs += @("-o", "ConnectTimeout=$ConnectTimeoutSec")
  }

  $sshArgs += $TargetHost

  if (-not [string]::IsNullOrWhiteSpace($RemoteCommand)) {
    $sshArgs += $RemoteCommand
  }

  return (& ssh @sshArgs)
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

function Get-RemoteReleaseVersionFromHttp([string]$ServerUrl) {
  if ([string]::IsNullOrWhiteSpace($ServerUrl)) {
    return $null
  }

  try {
    $release = Invoke-RestMethod -Uri "$ServerUrl/api/release" -TimeoutSec 8
    if ($release.version) {
      return [string]$release.version
    }
  } catch {
    return $null
  }

  return $null
}

function Get-RemoteReleaseVersionFromSsh([string]$Root, [string]$TargetHost, [string]$TargetRemoteDir) {
  $remoteDirLiteral = "'$TargetRemoteDir'"
  $cmd = "if [ -f ${remoteDirLiteral}/dist/release.json ]; then cat ${remoteDirLiteral}/dist/release.json; elif [ -f ${remoteDirLiteral}/package.json ]; then cat ${remoteDirLiteral}/package.json; fi"
  $raw = Invoke-Ssh -RepoRootPath $Root -TargetHost $TargetHost -RemoteCommand $cmd
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

function Assert-NoMixedLineEndings([string]$Root) {
  $releasePathList = @(
    "AGENTS.md"
    ".gitignore"
    "deploy.ps1"
    "package.json"
    "pnpm-lock.yaml"
    "scripts/deploy-release-artifact.ps1"
    "scripts/release-build.ps1"
    "scripts/release-from-clean-worktree.ps1"
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

function Resolve-ReleasePlan([string]$Root, [string]$BumpType, [string]$TargetHost, [string]$TargetRemoteDir, [string]$ServerUrl) {
  $localRaw = Get-LocalPackageVersion $Root
  $localVersion = Parse-SemVer $localRaw
  if (-not $localVersion) {
    Err "Invalid local package.json version: '$localRaw'"
  }

  $baseRaw = $localRaw
  $baseSource = "local package.json"

  $remoteHttpRaw = Get-RemoteReleaseVersionFromHttp $ServerUrl
  $remoteHttpVersion = Parse-SemVer $remoteHttpRaw
  if ($remoteHttpVersion) {
    $baseRaw = $remoteHttpRaw
    $baseSource = "remote /api/release"
  } else {
    if ($remoteHttpRaw) {
      Warn "Remote HTTP version '$remoteHttpRaw' is invalid. Falling back to SSH lookup."
    }

    $remoteSshRaw = Get-RemoteReleaseVersionFromSsh $Root $TargetHost $TargetRemoteDir
    $remoteSshVersion = Parse-SemVer $remoteSshRaw
    if ($remoteSshVersion) {
      $baseRaw = $remoteSshRaw
      $baseSource = "remote deployed version"
    } elseif ($remoteSshRaw) {
      Warn "Remote SSH version '$remoteSshRaw' is invalid. Falling back to local version."
    } else {
      Warn "Remote version not found from HTTP or SSH. Falling back to local version."
    }
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

function Get-BooleanEnvLiteral([bool]$Value) {
  if ($Value) {
    return "true"
  }

  return "false"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoRoot
try {
  $resolvedHostAlias = Resolve-DeployHostAlias $HostAlias
  $resolvedRemoteDir = Resolve-DeployRemoteDir $RemoteDir
  $resolvedServerUrl = Resolve-DeployServerUrl

  Assert-NoMixedLineEndings $repoRoot

  $workspaceStatus = git -C $repoRoot status --porcelain=v1 --untracked-files=all 2>$null
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to read git workspace state."
  }

  if ($AllowDirtyWorkspace) {
    Warn "AllowDirtyWorkspace is enabled. Using the current workspace snapshot."
  } else {
    if ($workspaceStatus) {
      Write-Host $workspaceStatus -ForegroundColor Yellow
      Err "Refusing release build from a dirty workspace."
    }
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

  $plan = Resolve-ReleasePlan $repoRoot $VersionBump $resolvedHostAlias $resolvedRemoteDir $resolvedServerUrl
  $targetVersion = [string]$plan.NextVersion
  $changeType = [string]$plan.ChangeType
  Log "Release version plan: $($plan.BaseSource) $($plan.BaseVersion) -> $targetVersion ($changeType)"

  if (-not $SkipVerification) {
    Invoke-Step "Running TypeScript verification..." { pnpm exec tsc --noEmit } "TypeScript verification failed"
    Invoke-Step "Running client release guard tests..." { pnpm exec vitest run client/src/server-index.structure.test.ts client/src/server-error-payload.structure.test.ts client/src/critical-entrypoints.structure.test.ts client/src/pages/dashboard/lib/dashboardApi.test.ts } "Client release guard tests failed"
    Invoke-Step "Running server release guard tests..." { pnpm exec vitest run --root . server/middleware/apiCors.test.ts server/middleware/apiAccessPolicy.test.ts server/release.test.ts server/routes/progress-notes-guard.test.ts } "Server release guard tests failed"

    $ossSmokePort = Get-FreeLocalPort
    Invoke-Step "Running local OSS upload/delete smoke on port $ossSmokePort..." { powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local-oss-smoke.ps1 -Port $ossSmokePort -Retries 60 -RetryIntervalMs 1500 } "Local OSS upload/delete smoke failed"

    $reliabilitySmokePort = Get-FreeLocalPort -StartPort ($ossSmokePort + 1)
    Invoke-Step "Running local reliability smoke on port $reliabilitySmokePort..." { powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local-reliability-smoke.ps1 -Port $reliabilitySmokePort -Retries 60 -RetryIntervalMs 1500 } "Local reliability smoke failed"
  } else {
    Warn "SkipVerification is enabled. Build will continue without verification gates."
  }

  if ($PreflightOnly) {
    Log "Preflight finished. Skipping build artifact generation."
    exit 0
  }

  $originalVersionOverride = $env:RELEASE_VERSION_OVERRIDE
  $originalBuildSource = $env:RELEASE_BUILD_SOURCE
  $originalSourceWorkspaceDirty = $env:RELEASE_SOURCE_WORKSPACE_DIRTY
  try {
    $env:RELEASE_VERSION_OVERRIDE = $targetVersion
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
