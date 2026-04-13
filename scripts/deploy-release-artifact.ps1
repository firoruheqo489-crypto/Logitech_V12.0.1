param(
  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,
  [string]$MetadataPath = "",
  [string]$HostAlias = "",
  [string]$RemoteDir = "",
  [switch]$SkipRemoteSmoke
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

  return "aliyun"
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

function Format-RemoteShellPath([string]$PathValue) {
  return $PathValue
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

function Resolve-AbsolutePath([string]$PathValue) {
  try {
    return (Resolve-Path $PathValue).Path
  } catch {
    return $null
  }
}

function Resolve-ChecksumPath([string]$ArtifactAbsolutePath) {
  if (-not $ArtifactAbsolutePath) {
    return $null
  }

  $candidate = "$ArtifactAbsolutePath.sha256"
  if (Test-Path $candidate) {
    return (Resolve-Path $candidate).Path
  }

  return $null
}

function Get-RemoteReleaseJson([string]$TargetHost) {
  $raw = ssh $TargetHost "curl -fsS http://127.0.0.1:3000/api/release"
  if ($LASTEXITCODE -ne 0 -or -not $raw) {
    return $null
  }

  try {
    return ($raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Wait-RemoteHealth([string]$TargetHost, [int]$Retries = 15) {
  for ($attempt = 1; $attempt -le $Retries; $attempt += 1) {
    $result = ssh $TargetHost "curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || echo FAIL"
    if ($LASTEXITCODE -eq 0 -and $result -match '"ok"\s*:\s*true') {
      Log "Remote health check passed on attempt $attempt."
      return $true
    }
    Start-Sleep -Seconds 2
  }

  return $false
}

function Assert-RemoteHostReachable([string]$TargetHost) {
  $probeOutput = ssh -o BatchMode=yes -o ConnectTimeout=8 $TargetHost "printf READY"
  if ($LASTEXITCODE -ne 0 -or $probeOutput -notmatch "^READY$") {
    Err "Remote host alias '$TargetHost' is not reachable. Pass -HostAlias or set DEPLOY_HOST_ALIAS."
  }
}

function Invoke-RemoteRollbackAndErr([string]$Reason, [string]$TargetHost, [string]$TargetRemoteDir) {
  Warn "$Reason Attempting rollback..."
  $targetRemoteDirLiteral = Format-RemoteShellPath $TargetRemoteDir
  $rollbackCmd = @(
    "if [ -d ${targetRemoteDirLiteral}/dist.prev ]; then rm -rf ${targetRemoteDirLiteral}/dist && mv ${targetRemoteDirLiteral}/dist.prev ${targetRemoteDirLiteral}/dist; fi",
    "if pm2 describe logitech > /dev/null 2>&1; then pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then pm2 restart mold-gantt-v3 --update-env; fi",
    "pm2 status || true"
  ) -join " && "
  ssh $TargetHost $rollbackCmd | Out-Null
  Err $Reason
}

$resolvedHostAlias = Resolve-DeployHostAlias $HostAlias
$resolvedRemoteDir = Resolve-DeployRemoteDir $RemoteDir
Assert-RemoteHostReachable $resolvedHostAlias

$artifactAbsolutePath = Resolve-AbsolutePath $ArtifactPath
if (-not $artifactAbsolutePath -or -not (Test-Path $artifactAbsolutePath)) {
  Err "Artifact not found: $ArtifactPath"
}
$checksumAbsolutePath = Resolve-ChecksumPath $artifactAbsolutePath

$resolvedMetadataPath = $MetadataPath
if (-not $resolvedMetadataPath) {
  $resolvedMetadataPath = $artifactAbsolutePath -replace "\.tar\.gz$", ".metadata.json"
}
$metadataAbsolutePath = Resolve-AbsolutePath $resolvedMetadataPath
if (-not $metadataAbsolutePath -or -not (Test-Path $metadataAbsolutePath)) {
  Err "Metadata file not found: $resolvedMetadataPath"
}

$metadata = Get-Content $metadataAbsolutePath -Raw | ConvertFrom-Json
$targetVersion = [string]$metadata.version
$targetCommit = [string]$metadata.commit
$targetCommitShort = [string]$metadata.commitShort
$changeType = [string]$metadata.changeType
$releaseNote = [string]$metadata.releaseNote

if (-not $targetVersion -or -not $targetCommit) {
  Err "Metadata is missing required fields (version/commit)."
}

$artifactName = [IO.Path]::GetFileName($artifactAbsolutePath)
$remoteReleaseRoot = "$resolvedRemoteDir/releases"
$remoteIncomingDir = "$remoteReleaseRoot/incoming"
$remoteReleaseRootLiteral = Format-RemoteShellPath $remoteReleaseRoot
$remoteIncomingDirLiteral = Format-RemoteShellPath $remoteIncomingDir
$remoteDirLiteral = Format-RemoteShellPath $resolvedRemoteDir
$releaseId = "v$targetVersion-$targetCommitShort-$((Get-Date).ToString('yyyyMMddHHmmss'))"
$remoteIncomingArtifact = "$remoteIncomingDir/$artifactName"
$remoteIncomingChecksum = if ($checksumAbsolutePath) { "$remoteIncomingArtifact.sha256" } else { "" }
$remoteExtractDir = "$remoteReleaseRoot/$releaseId"
$remoteExtractDirLiteral = Format-RemoteShellPath $remoteExtractDir

Invoke-Step "Preparing remote release directories..." {
  ssh $resolvedHostAlias "mkdir -p $remoteIncomingDirLiteral"
} "Failed to prepare remote release directories."

Invoke-Step "Uploading artifact to remote server..." {
  if ($checksumAbsolutePath) {
    scp $artifactAbsolutePath $checksumAbsolutePath "${resolvedHostAlias}:$remoteIncomingDirLiteral"
  } else {
    scp $artifactAbsolutePath "${resolvedHostAlias}:$remoteIncomingArtifact"
  }
} "Failed to upload artifact archive."

$remoteDeployScript = @(
  "set -euo pipefail",
  "REMOTE_DIR=$remoteDirLiteral",
  "RELEASE_ROOT=$remoteReleaseRootLiteral",
  "INCOMING_ARTIFACT=$remoteIncomingArtifact",
  "INCOMING_CHECKSUM=$remoteIncomingChecksum",
  "EXTRACT_DIR=$remoteExtractDirLiteral",
  'trap ''rm -rf "$EXTRACT_DIR"'' EXIT',
  'mkdir -p "$EXTRACT_DIR"',
  'if [ -n "$INCOMING_CHECKSUM" ] && [ -f "$INCOMING_CHECKSUM" ]; then (cd "$RELEASE_ROOT/incoming" && sha256sum -c "$(basename "$INCOMING_CHECKSUM")"); fi',
  'tar -xzf "$INCOMING_ARTIFACT" -C "$EXTRACT_DIR"',
  '[ -d "$EXTRACT_DIR/payload/dist" ]',
  'rm -rf "$REMOTE_DIR/dist.new"',
  'cp -a "$EXTRACT_DIR/payload/dist" "$REMOTE_DIR/dist.new"',
  'rm -rf "$REMOTE_DIR/dist.prev"',
  'if [ -d "$REMOTE_DIR/dist" ]; then mv "$REMOTE_DIR/dist" "$REMOTE_DIR/dist.prev"; fi',
  'mv "$REMOTE_DIR/dist.new" "$REMOTE_DIR/dist"',
  'cp "$EXTRACT_DIR/payload/package.json" "$REMOTE_DIR/package.json"',
  'cp "$EXTRACT_DIR/payload/pnpm-lock.yaml" "$REMOTE_DIR/pnpm-lock.yaml"',
  'cp "$EXTRACT_DIR/payload/ecosystem.config.cjs" "$REMOTE_DIR/ecosystem.config.cjs"',
  'mkdir -p "$REMOTE_DIR/scripts"',
  'cp "$EXTRACT_DIR/payload/scripts/verify-oss-http-smoke.mjs" "$REMOTE_DIR/scripts/verify-oss-http-smoke.mjs"',
  'cp "$EXTRACT_DIR/payload/scripts/verify-reliability-smoke.mjs" "$REMOTE_DIR/scripts/verify-reliability-smoke.mjs"',
  'cp "$EXTRACT_DIR/payload/scripts/verify-reliability-smoke.ps1" "$REMOTE_DIR/scripts/verify-reliability-smoke.ps1"',
  'if [ -d "$EXTRACT_DIR/payload/patches" ]; then rm -rf "$REMOTE_DIR/patches"; cp -a "$EXTRACT_DIR/payload/patches" "$REMOTE_DIR/patches"; fi',
  'if [ -d "$EXTRACT_DIR/payload/drizzle" ]; then rm -rf "$REMOTE_DIR/drizzle"; cp -a "$EXTRACT_DIR/payload/drizzle" "$REMOTE_DIR/drizzle"; fi',
  'cd "$REMOTE_DIR"',
  'pnpm install --prod',
  'if pm2 describe logitech > /dev/null 2>&1; then pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then pm2 restart mold-gantt-v3 --update-env; else pm2 start ecosystem.config.cjs --only mold-gantt-v3 --env production && pm2 save; fi'
) -join " && "

Invoke-Step "Deploying artifact on remote host..." {
  ssh $resolvedHostAlias $remoteDeployScript
} "Remote deployment steps failed."

if (-not (Wait-RemoteHealth $resolvedHostAlias)) {
  Invoke-RemoteRollbackAndErr "Remote health check failed after deployment." $resolvedHostAlias $resolvedRemoteDir
}

$remoteRelease = Get-RemoteReleaseJson $resolvedHostAlias
if (-not $remoteRelease) {
  Err "Failed to read remote /api/release after deployment."
}

if ([string]$remoteRelease.version -ne $targetVersion) {
  Write-Host "Expected version: $targetVersion" -ForegroundColor Yellow
  Write-Host "Actual version:   $([string]$remoteRelease.version)" -ForegroundColor Yellow
  Invoke-RemoteRollbackAndErr "Remote version mismatch after deployment." $resolvedHostAlias $resolvedRemoteDir
}
if ([string]$remoteRelease.commit -ne $targetCommit) {
  Write-Host "Expected commit: $targetCommit" -ForegroundColor Yellow
  Write-Host "Actual commit:   $([string]$remoteRelease.commit)" -ForegroundColor Yellow
  Invoke-RemoteRollbackAndErr "Remote commit mismatch after deployment." $resolvedHostAlias $resolvedRemoteDir
}
Log "Remote release verified: version=$targetVersion commit=$targetCommitShort"

if (-not $SkipRemoteSmoke) {
  $remoteSmokeCmd = @(
    "cd $remoteDirLiteral",
    "node scripts/verify-oss-http-smoke.mjs --base-url http://127.0.0.1:3000 --env-file .env --label remote-artifact-deploy"
  ) -join " && "

  Log "Running remote OSS upload/delete smoke..."
  ssh $resolvedHostAlias $remoteSmokeCmd
  if ($LASTEXITCODE -ne 0) {
    Invoke-RemoteRollbackAndErr "Remote OSS upload/delete smoke failed." $resolvedHostAlias $resolvedRemoteDir
  }

  $remoteReliabilitySmokeCmd = @(
    "cd $remoteDirLiteral",
    "node scripts/verify-reliability-smoke.mjs --base-url http://127.0.0.1:3000 --env-file .env"
  ) -join " && "

  Log "Running remote reliability smoke..."
  ssh $resolvedHostAlias $remoteReliabilitySmokeCmd
  if ($LASTEXITCODE -ne 0) {
    Invoke-RemoteRollbackAndErr "Remote reliability smoke failed." $resolvedHostAlias $resolvedRemoteDir
  }
} else {
  Warn "SkipRemoteSmoke is enabled. Remote OSS smoke was skipped."
}

$releaseHistoryLine = "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')) | V$targetVersion | $changeType | $releaseNote | $targetCommitShort"
$releaseHistoryLineB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($releaseHistoryLine))
$appendHistoryCmd = @(
  "mkdir -p $remoteDirLiteral",
  "touch ${remoteDirLiteral}/release-history.log",
  "printf '%s' '$releaseHistoryLineB64' | base64 -d >> ${remoteDirLiteral}/release-history.log",
  "printf '\n' >> ${remoteDirLiteral}/release-history.log",
  "tail -n 5 ${remoteDirLiteral}/release-history.log"
) -join " && "

Log "Appending remote release history..."
ssh $resolvedHostAlias $appendHistoryCmd
if ($LASTEXITCODE -ne 0) {
  Invoke-RemoteRollbackAndErr "Failed to append remote release history." $resolvedHostAlias $resolvedRemoteDir
}

Log "Artifact deployment succeeded."
Write-Host "  Version: V$targetVersion" -ForegroundColor Cyan
Write-Host "  Commit:  $targetCommitShort" -ForegroundColor Cyan
Write-Host "  Note:    $releaseNote" -ForegroundColor Cyan
