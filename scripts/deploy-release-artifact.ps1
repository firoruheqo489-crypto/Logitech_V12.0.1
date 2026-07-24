param(
  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,
  [string]$MetadataPath = "",
  [string]$HostAlias = "",
  [string]$RemoteDir = ""
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

function Resolve-RepoKnownHostsPath([string]$RepoRootPath) {
  $sshStateDir = Join-Path $RepoRootPath ".codex-local"
  New-Item -ItemType Directory -Path $sshStateDir -Force | Out-Null
  return (Join-Path $sshStateDir "deploy-known_hosts")
}

function Resolve-NodeSshRuntimeDir([string]$RepoRootPath) {
  $sshStateDir = Join-Path $RepoRootPath ".codex-local"
  New-Item -ItemType Directory -Path $sshStateDir -Force | Out-Null
  return (Join-Path $sshStateDir "ssh-runtime")
}

function Resolve-NodeSshBridgePath([string]$RepoRootPath) {
  return (Join-Path $RepoRootPath "scripts\ssh-bridge.mjs")
}

function Ensure-NodeSshRuntime([string]$RepoRootPath) {
  $runtimeDir = Resolve-NodeSshRuntimeDir $RepoRootPath
  $runtimePackageJson = Join-Path $runtimeDir "package.json"
  $runtimeModulePath = Join-Path $runtimeDir "node_modules\ssh2"

  if (Test-Path -LiteralPath $runtimeModulePath) {
    return $runtimeDir
  }

  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  if (-not (Test-Path -LiteralPath $runtimePackageJson)) {
    '{"name":"codex-ssh-runtime","private":true}' | Set-Content -LiteralPath $runtimePackageJson -Encoding UTF8
  }

  Log "Bootstrapping local SSH runtime..."
  & pnpm.cmd add ssh2@1.16.0 --dir $runtimeDir
  if ($LASTEXITCODE -ne 0) {
    Err "Failed to bootstrap local SSH runtime under $runtimeDir"
  }

  if (-not (Test-Path -LiteralPath $runtimeModulePath)) {
    Err "Local SSH runtime missing ssh2 module after bootstrap: $runtimeModulePath"
  }

  return $runtimeDir
}

function Resolve-DeployIdentityPath([string]$RepoRootPath) {
  $configuredPath = [string]$env:DEPLOY_SSH_KEY_PATH
  if (-not [string]::IsNullOrWhiteSpace($configuredPath)) {
    $resolvedConfiguredPath = Resolve-AbsolutePath $configuredPath
    if (-not $resolvedConfiguredPath) {
      Err "DEPLOY_SSH_KEY_PATH does not exist: $configuredPath"
    }
    return $resolvedConfiguredPath
  }

  foreach ($candidate in @(
    (Join-Path $RepoRootPath ".codex-local\deploy_id_rsa"),
    (Join-Path $RepoRootPath ".codex-local\deploy_id_ed25519")
  )) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  return $null
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
  $identityPath = Resolve-DeployIdentityPath $RepoRootPath
  $bridgeScript = Resolve-NodeSshBridgePath $RepoRootPath

  if ($identityPath -and (Test-Path -LiteralPath $bridgeScript)) {
    $runtimeDir = Ensure-NodeSshRuntime $RepoRootPath
    $nodeArgs = @(
      $bridgeScript,
      "exec",
      "--host", $TargetHost,
      "--private-key", $identityPath,
      "--known-hosts", $knownHostsPath,
      "--runtime-dir", $runtimeDir
    )

    if (-not [string]::IsNullOrWhiteSpace($RemoteCommand)) {
      $nodeArgs += @("--command", $RemoteCommand)
    }
    if ($ConnectTimeoutSec -gt 0) {
      $nodeArgs += @("--connect-timeout-sec", [string]$ConnectTimeoutSec)
    }

    return (& node @nodeArgs)
  }

  $sshArgs = @(
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "UserKnownHostsFile=$knownHostsPath"
  )

  if ($identityPath) {
    $sshArgs += @(
      "-o", "IdentitiesOnly=yes",
      "-i", $identityPath
    )
  }

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

function Invoke-Scp {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRootPath,
    [Parameter(Mandatory = $true)][string[]]$Sources,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $knownHostsPath = Resolve-RepoKnownHostsPath $RepoRootPath
  $identityPath = Resolve-DeployIdentityPath $RepoRootPath
  $bridgeScript = Resolve-NodeSshBridgePath $RepoRootPath

  if ($identityPath -and (Test-Path -LiteralPath $bridgeScript)) {
    $destinationParts = $Destination -split ":", 2
    if ($destinationParts.Count -ne 2) {
      Err "Invalid upload destination. Expected host:path, got: $Destination"
    }

    $runtimeDir = Ensure-NodeSshRuntime $RepoRootPath
    $targetHost = $destinationParts[0]
    $remoteTarget = $destinationParts[1]
    $nodeArgs = @(
      $bridgeScript,
      "upload",
      "--host", $targetHost,
      "--private-key", $identityPath,
      "--known-hosts", $knownHostsPath,
      "--runtime-dir", $runtimeDir,
      "--destination", $remoteTarget
    )

    if ($Sources.Count -gt 1) {
      $nodeArgs += "--destination-is-directory"
    }

    foreach ($source in $Sources) {
      $nodeArgs += @("--source", $source)
    }

    & node @nodeArgs
    return
  }

  $scpArgs = @(
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "UserKnownHostsFile=$knownHostsPath"
  )

  if ($identityPath) {
    $scpArgs += @(
      "-o", "IdentitiesOnly=yes",
      "-i", $identityPath
    )
  }

  $scpArgs += $Sources
  $scpArgs += $Destination

  & scp @scpArgs
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

function Get-RemoteReleaseJson([string]$RepoRootPath, [string]$TargetHost) {
  $raw = Invoke-Ssh -RepoRootPath $RepoRootPath -TargetHost $TargetHost -RemoteCommand "curl -fsS http://127.0.0.1:3000/api/release"
  if ($LASTEXITCODE -ne 0 -or -not $raw) {
    return $null
  }

  try {
    return ($raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Wait-RemoteHealth([string]$RepoRootPath, [string]$TargetHost, [int]$Retries = 15) {
  for ($attempt = 1; $attempt -le $Retries; $attempt += 1) {
    $result = Invoke-Ssh -RepoRootPath $RepoRootPath -TargetHost $TargetHost -RemoteCommand "curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || echo FAIL"
    if ($LASTEXITCODE -ne 0 -or -not $result) {
      Start-Sleep -Seconds 2
      continue
    }

    try {
      $payload = $result | ConvertFrom-Json
    } catch {
      $payload = $null
    }

    if ($payload -and $payload.ok -eq $true -and $payload.api -eq $true -and $payload.dbReady -eq $true) {
      Log "Remote health check passed on attempt $attempt."
      return $true
    }
    Start-Sleep -Seconds 2
  }

  return $false
}

function Assert-RemoteHostReachable([string]$RepoRootPath, [string]$TargetHost) {
  $identityPath = Resolve-DeployIdentityPath $RepoRootPath
  $probeOutput = Invoke-Ssh -RepoRootPath $RepoRootPath -TargetHost $TargetHost -RemoteCommand "printf READY" -BatchMode -ConnectTimeoutSec 8
  if ($LASTEXITCODE -ne 0 -or $probeOutput -notmatch "^READY$") {
    if ($identityPath) {
      Err "Remote host alias '$TargetHost' rejected SSH authentication. Checked deploy key: $identityPath"
    }

    Err "Remote host alias '$TargetHost' is not reachable because no deploy SSH key is available in this workspace. Put a private key at .codex-local\\deploy_id_ed25519 or set DEPLOY_SSH_KEY_PATH, then add the matching public key to the server's authorized_keys."
  }
}

function Invoke-RemoteRollbackAndErr([string]$Reason, [string]$RepoRootPath, [string]$TargetHost, [string]$TargetRemoteDir) {
  Warn "$Reason Attempting rollback..."
  $targetRemoteDirLiteral = Format-RemoteShellPath $TargetRemoteDir
  $rollbackCmd = @(
    "cd $targetRemoteDirLiteral",
    "if [ -d ${targetRemoteDirLiteral}/dist.prev ]; then rm -rf ${targetRemoteDirLiteral}/dist && mv ${targetRemoteDirLiteral}/dist.prev ${targetRemoteDirLiteral}/dist; fi",
    "if pm2 describe logitech > /dev/null 2>&1; then PM2_APP_NAME=logitech pm2 startOrReload ecosystem.config.cjs --only logitech --env production --update-env || pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then PM2_APP_NAME=mold-gantt-v3 pm2 startOrReload ecosystem.config.cjs --only mold-gantt-v3 --env production --update-env || pm2 restart mold-gantt-v3 --update-env; fi",
    "pm2 status || true"
  ) -join " && "
  Invoke-Ssh -RepoRootPath $RepoRootPath -TargetHost $TargetHost -RemoteCommand $rollbackCmd | Out-Null
  Err $Reason
}

$resolvedHostAlias = Resolve-DeployHostAlias $HostAlias
$resolvedRemoteDir = Resolve-DeployRemoteDir $RemoteDir
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Assert-RemoteHostReachable $repoRoot $resolvedHostAlias

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
$assetArchiveRoot = "$resolvedRemoteDir/assets-legacy/releases"
$assetArchiveRootLiteral = Format-RemoteShellPath $assetArchiveRoot
$assetArchiveKeep = 3

Invoke-Step "Preparing remote release directories..." {
  Invoke-Ssh -RepoRootPath $repoRoot -TargetHost $resolvedHostAlias -RemoteCommand "mkdir -p $remoteIncomingDirLiteral"
} "Failed to prepare remote release directories."

Invoke-Step "Uploading artifact to remote server..." {
  if ($checksumAbsolutePath) {
    Invoke-Scp -RepoRootPath $repoRoot -Sources @($artifactAbsolutePath, $checksumAbsolutePath) -Destination "${resolvedHostAlias}:$remoteIncomingDirLiteral"
  } else {
    Invoke-Scp -RepoRootPath $repoRoot -Sources @($artifactAbsolutePath) -Destination "${resolvedHostAlias}:$remoteIncomingArtifact"
  }
} "Failed to upload artifact archive."

$remoteDeployScript = @(
  "set -euo pipefail",
  "REMOTE_DIR=$remoteDirLiteral",
  "RELEASE_ROOT=$remoteReleaseRootLiteral",
  "INCOMING_ARTIFACT=$remoteIncomingArtifact",
  "INCOMING_CHECKSUM=$remoteIncomingChecksum",
  "EXTRACT_DIR=$remoteExtractDirLiteral",
  "ASSET_ARCHIVE_ROOT=$assetArchiveRootLiteral",
  "ASSET_ARCHIVE_KEEP=$assetArchiveKeep",
  "RELEASE_ID=$releaseId",
  'trap ''rm -rf "$EXTRACT_DIR"'' EXIT',
  'mkdir -p "$EXTRACT_DIR"',
  'if [ -n "$INCOMING_CHECKSUM" ] && [ -f "$INCOMING_CHECKSUM" ]; then CHECKSUM_NAME="${INCOMING_CHECKSUM##*/}"; (cd "$RELEASE_ROOT/incoming" && sha256sum -c "$CHECKSUM_NAME"); fi',
  'tar -xzf "$INCOMING_ARTIFACT" -C "$EXTRACT_DIR"',
  '[ -d "$EXTRACT_DIR/payload/dist" ]',
  '[ -f "$REMOTE_DIR/.env" ]',
  'mkdir -p "$REMOTE_DIR/scripts"',
  'cp "$EXTRACT_DIR/payload/scripts/export-dashboard-grr-state.mjs" "$REMOTE_DIR/scripts/export-dashboard-grr-state.mjs"',
  'cd "$REMOTE_DIR"',
  'node scripts/export-dashboard-grr-state.mjs --env-file "$REMOTE_DIR/.env" --disable-pinned-hosts --out "$EXTRACT_DIR/dashboard-grr-state.snapshot.json"',
  'cp "$EXTRACT_DIR/dashboard-grr-state.snapshot.json" "$REMOTE_DIR/dashboard-grr-state.snapshot.json"',
  'rm -rf "$REMOTE_DIR/dist.new"',
  'cp -a "$EXTRACT_DIR/payload/dist" "$REMOTE_DIR/dist.new"',
  'mkdir -p "$ASSET_ARCHIVE_ROOT/$RELEASE_ID"',
  'rm -rf "$ASSET_ARCHIVE_ROOT/$RELEASE_ID"',
  'mkdir -p "$ASSET_ARCHIVE_ROOT/$RELEASE_ID"',
  'if [ -d "$REMOTE_DIR/dist.new/public/assets" ]; then cp -a "$REMOTE_DIR/dist.new/public/assets/." "$ASSET_ARCHIVE_ROOT/$RELEASE_ID/"; fi',
  'prune_index=0; for snapshot in $(find "$ASSET_ARCHIVE_ROOT" -mindepth 1 -maxdepth 1 -type d | sort -r); do prune_index=$((prune_index + 1)); if [ "$prune_index" -gt "$ASSET_ARCHIVE_KEEP" ]; then rm -rf "$snapshot"; fi; done',
  'rm -rf "$REMOTE_DIR/dist.prev"',
  'if [ -d "$REMOTE_DIR/dist" ]; then mv "$REMOTE_DIR/dist" "$REMOTE_DIR/dist.prev"; fi',
  'mv "$REMOTE_DIR/dist.new" "$REMOTE_DIR/dist"',
  'cp "$EXTRACT_DIR/payload/package.json" "$REMOTE_DIR/package.json"',
  'cp "$EXTRACT_DIR/payload/pnpm-lock.yaml" "$REMOTE_DIR/pnpm-lock.yaml"',
  'cp "$EXTRACT_DIR/payload/ecosystem.config.cjs" "$REMOTE_DIR/ecosystem.config.cjs"',
  'mkdir -p "$REMOTE_DIR/scripts"',
  'rm -rf "$REMOTE_DIR/laboratory_pdf_parser"',
  'cp -a "$EXTRACT_DIR/payload/laboratory_pdf_parser" "$REMOTE_DIR/laboratory_pdf_parser"',
  'cp "$EXTRACT_DIR/payload/scripts/bootstrap-parser-runtime.sh" "$REMOTE_DIR/scripts/bootstrap-parser-runtime.sh"',
  'chmod +x "$REMOTE_DIR/scripts/bootstrap-parser-runtime.sh"',
  'cp "$EXTRACT_DIR/payload/scripts/verify-oss-http-smoke.mjs" "$REMOTE_DIR/scripts/verify-oss-http-smoke.mjs"',
  'cp "$EXTRACT_DIR/payload/scripts/verify-reliability-smoke.mjs" "$REMOTE_DIR/scripts/verify-reliability-smoke.mjs"',
  'cp "$EXTRACT_DIR/payload/scripts/verify-reliability-smoke.ps1" "$REMOTE_DIR/scripts/verify-reliability-smoke.ps1"',
  'cp "$EXTRACT_DIR/payload/scripts/import-dashboard-grr-state.mjs" "$REMOTE_DIR/scripts/import-dashboard-grr-state.mjs"',
  'if [ -d "$EXTRACT_DIR/payload/patches" ]; then rm -rf "$REMOTE_DIR/patches"; cp -a "$EXTRACT_DIR/payload/patches" "$REMOTE_DIR/patches"; fi',
  'if [ -d "$EXTRACT_DIR/payload/drizzle" ]; then rm -rf "$REMOTE_DIR/drizzle"; cp -a "$EXTRACT_DIR/payload/drizzle" "$REMOTE_DIR/drizzle"; fi',
  'cd "$REMOTE_DIR"',
  '"$REMOTE_DIR/scripts/bootstrap-parser-runtime.sh" "$REMOTE_DIR"',
  'pnpm install --prod --reporter append-only --loglevel error',
  'if [ -f "$REMOTE_DIR/dashboard-grr-state.snapshot.json" ]; then node scripts/import-dashboard-grr-state.mjs --file "$REMOTE_DIR/dashboard-grr-state.snapshot.json"; fi',
  'if pm2 describe logitech > /dev/null 2>&1; then PM2_APP_NAME=logitech pm2 startOrReload ecosystem.config.cjs --only logitech --env production --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then PM2_APP_NAME=mold-gantt-v3 pm2 startOrReload ecosystem.config.cjs --only mold-gantt-v3 --env production --update-env; else PM2_APP_NAME=logitech pm2 start ecosystem.config.cjs --only logitech --env production && pm2 save; fi'
) -join "`n"

Invoke-Step "Deploying artifact on remote host..." {
  Invoke-Ssh -RepoRootPath $repoRoot -TargetHost $resolvedHostAlias -RemoteCommand $remoteDeployScript
} "Remote deployment steps failed."

if (-not (Wait-RemoteHealth $repoRoot $resolvedHostAlias)) {
  Invoke-RemoteRollbackAndErr "Remote health check failed after deployment." $repoRoot $resolvedHostAlias $resolvedRemoteDir
}

$remoteRelease = Get-RemoteReleaseJson $repoRoot $resolvedHostAlias
if (-not $remoteRelease) {
  Err "Failed to read remote /api/release after deployment."
}

if ([string]$remoteRelease.version -ne $targetVersion) {
  Write-Host "Expected version: $targetVersion" -ForegroundColor Yellow
  Write-Host "Actual version:   $([string]$remoteRelease.version)" -ForegroundColor Yellow
  Invoke-RemoteRollbackAndErr "Remote version mismatch after deployment." $repoRoot $resolvedHostAlias $resolvedRemoteDir
}
if ([string]$remoteRelease.commit -ne $targetCommit) {
  Write-Host "Expected commit: $targetCommit" -ForegroundColor Yellow
  Write-Host "Actual commit:   $([string]$remoteRelease.commit)" -ForegroundColor Yellow
  Invoke-RemoteRollbackAndErr "Remote commit mismatch after deployment." $repoRoot $resolvedHostAlias $resolvedRemoteDir
}
Log "Remote release verified: version=$targetVersion commit=$targetCommitShort"

$remoteSmokeCmd = @(
  "cd $remoteDirLiteral",
  "node scripts/verify-oss-http-smoke.mjs --base-url http://127.0.0.1:3000 --env-file .env --label remote-artifact-deploy --wait-for-db-ready"
) -join " && "

Log "Running remote OSS upload/delete smoke..."
Invoke-Ssh -RepoRootPath $repoRoot -TargetHost $resolvedHostAlias -RemoteCommand $remoteSmokeCmd
if ($LASTEXITCODE -ne 0) {
  Invoke-RemoteRollbackAndErr "Remote OSS upload/delete smoke failed." $repoRoot $resolvedHostAlias $resolvedRemoteDir
}

$remoteReliabilitySmokeCmd = @(
  "cd $remoteDirLiteral",
  "node scripts/verify-reliability-smoke.mjs --base-url http://127.0.0.1:3000 --env-file .env --wait-for-db-ready"
) -join " && "

Log "Running remote reliability smoke..."
Invoke-Ssh -RepoRootPath $repoRoot -TargetHost $resolvedHostAlias -RemoteCommand $remoteReliabilitySmokeCmd
if ($LASTEXITCODE -ne 0) {
  Invoke-RemoteRollbackAndErr "Remote reliability smoke failed." $repoRoot $resolvedHostAlias $resolvedRemoteDir
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
Invoke-Ssh -RepoRootPath $repoRoot -TargetHost $resolvedHostAlias -RemoteCommand $appendHistoryCmd
if ($LASTEXITCODE -ne 0) {
  Invoke-RemoteRollbackAndErr "Failed to append remote release history." $repoRoot $resolvedHostAlias $resolvedRemoteDir
}

Log "Artifact deployment succeeded."
Write-Host "  Version: V$targetVersion" -ForegroundColor Cyan
Write-Host "  Commit:  $targetCommitShort" -ForegroundColor Cyan
Write-Host "  Note:    $releaseNote" -ForegroundColor Cyan
