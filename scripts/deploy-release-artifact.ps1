param(
  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,
  [string]$MetadataPath = "",
  [string]$HostAlias = "",
  [string]$RemoteDir = "",
  [string]$DeployConfigPath = "",
  [switch]$SkipRemoteSmoke
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

function Resolve-AbsolutePath([string]$PathValue) {
  try {
    return (Resolve-Path $PathValue).Path
  } catch {
    return $null
  }
}

function Get-RemoteReleaseJson($DeployConfig) {
  $raw = Invoke-DeploySsh -Config $DeployConfig -Command "curl -fsS http://127.0.0.1:3000/api/release"
  if ($LASTEXITCODE -ne 0 -or -not $raw) {
    return $null
  }

  try {
    return ($raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Wait-RemoteHealth($DeployConfig, [int]$Retries = 15) {
  for ($attempt = 1; $attempt -le $Retries; $attempt += 1) {
    $result = Invoke-DeploySsh -Config $DeployConfig -Command "curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || echo FAIL"
    if ($LASTEXITCODE -eq 0 -and $result -match '"ok"\s*:\s*true') {
      Log "Remote health check passed on attempt $attempt."
      return $true
    }
    Start-Sleep -Seconds 2
  }

  return $false
}

function Invoke-RemoteRollbackAndErr([string]$Reason, $DeployConfig, [string]$TargetRemoteDir) {
  Warn "$Reason Attempting rollback..."
  $rollbackCmd = @(
    "if [ -d $TargetRemoteDir/dist.prev ]; then rm -rf $TargetRemoteDir/dist && mv $TargetRemoteDir/dist.prev $TargetRemoteDir/dist; fi",
    "if pm2 describe logitech > /dev/null 2>&1; then pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then pm2 restart mold-gantt-v3 --update-env; fi",
    "pm2 status || true"
  ) -join " && "
  Invoke-DeploySsh -Config $DeployConfig -Command $rollbackCmd | Out-Null
  Err $Reason
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deploySshScript = Join-Path $PSScriptRoot "deploy-ssh.ps1"
if (-not (Test-Path -LiteralPath $deploySshScript)) {
  Err "Missing deploy SSH helper: $deploySshScript"
}

. $deploySshScript
$deployConfig = Get-DeployConnectionConfig -RepoRoot $repoRoot -ConfigPath $DeployConfigPath -SshTargetOverride $HostAlias -RemoteDirOverride $RemoteDir

$artifactAbsolutePath = Resolve-AbsolutePath $ArtifactPath
if (-not $artifactAbsolutePath -or -not (Test-Path $artifactAbsolutePath)) {
  Err "Artifact not found: $ArtifactPath"
}

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
$remoteReleaseRoot = "$($deployConfig.RemoteDir)/releases"
$remoteIncomingDir = "$remoteReleaseRoot/incoming"
$releaseId = "v$targetVersion-$targetCommitShort-$((Get-Date).ToString('yyyyMMddHHmmss'))"
$remoteIncomingArtifact = "$remoteIncomingDir/$artifactName"
$remoteExtractDir = "$remoteReleaseRoot/$releaseId"

Invoke-Step "Preparing remote release directories..." {
  Invoke-DeploySsh -Config $deployConfig -Command "mkdir -p $remoteIncomingDir"
} "Failed to prepare remote release directories."

Invoke-Step "Uploading artifact to remote server..." {
  Invoke-DeployScp -Config $deployConfig -SourcePaths @($artifactAbsolutePath) -RemotePath $remoteIncomingArtifact
} "Failed to upload artifact archive."

$remoteDeployScript = @(
  "set -euo pipefail",
  "REMOTE_DIR='$($deployConfig.RemoteDir)'",
  "RELEASE_ROOT='$remoteReleaseRoot'",
  "INCOMING_ARTIFACT='$remoteIncomingArtifact'",
  "EXTRACT_DIR='$remoteExtractDir'",
  'rm -rf "$EXTRACT_DIR"',
  'mkdir -p "$EXTRACT_DIR"',
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
  'if [ -d "$EXTRACT_DIR/payload/patches" ]; then rm -rf "$REMOTE_DIR/patches"; cp -a "$EXTRACT_DIR/payload/patches" "$REMOTE_DIR/patches"; fi',
  'if [ -d "$EXTRACT_DIR/payload/drizzle" ]; then rm -rf "$REMOTE_DIR/drizzle"; cp -a "$EXTRACT_DIR/payload/drizzle" "$REMOTE_DIR/drizzle"; fi',
  'cd "$REMOTE_DIR"',
  'pnpm install --prod',
  'if pm2 describe logitech > /dev/null 2>&1; then pm2 restart logitech --update-env; elif pm2 describe mold-gantt-v3 > /dev/null 2>&1; then pm2 restart mold-gantt-v3 --update-env; else pm2 start ecosystem.config.cjs --only mold-gantt-v3 --env production && pm2 save; fi'
) -join " && "

Invoke-Step "Deploying artifact on remote host..." {
  Invoke-DeploySsh -Config $deployConfig -Command $remoteDeployScript
} "Remote deployment steps failed."

if (-not (Wait-RemoteHealth $deployConfig)) {
  Invoke-RemoteRollbackAndErr "Remote health check failed after deployment." $deployConfig $deployConfig.RemoteDir
}

$remoteRelease = Get-RemoteReleaseJson $deployConfig
if (-not $remoteRelease) {
  Err "Failed to read remote /api/release after deployment."
}

if ([string]$remoteRelease.version -ne $targetVersion) {
  Write-Host "Expected version: $targetVersion" -ForegroundColor Yellow
  Write-Host "Actual version:   $([string]$remoteRelease.version)" -ForegroundColor Yellow
  Invoke-RemoteRollbackAndErr "Remote version mismatch after deployment." $deployConfig $deployConfig.RemoteDir
}
if ([string]$remoteRelease.commit -ne $targetCommit) {
  Write-Host "Expected commit: $targetCommit" -ForegroundColor Yellow
  Write-Host "Actual commit:   $([string]$remoteRelease.commit)" -ForegroundColor Yellow
  Invoke-RemoteRollbackAndErr "Remote commit mismatch after deployment." $deployConfig $deployConfig.RemoteDir
}
Log "Remote release verified: version=$targetVersion commit=$targetCommitShort"

if (-not $SkipRemoteSmoke) {
  $remoteSmokeCmd = @(
    "cd $($deployConfig.RemoteDir)",
    "node scripts/verify-oss-http-smoke.mjs --base-url http://127.0.0.1:3000 --env-file .env --label remote-artifact-deploy"
  ) -join " && "

  Log "Running remote OSS upload/delete smoke..."
  Invoke-DeploySsh -Config $deployConfig -Command $remoteSmokeCmd
  if ($LASTEXITCODE -ne 0) {
    Invoke-RemoteRollbackAndErr "Remote OSS upload/delete smoke failed." $deployConfig $deployConfig.RemoteDir
  }
} else {
  Warn "SkipRemoteSmoke is enabled. Remote OSS smoke was skipped."
}

$releaseHistoryLine = "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')) | V$targetVersion | $changeType | $releaseNote | $targetCommitShort"
$releaseHistoryLineB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($releaseHistoryLine))
$appendHistoryCmd = @(
  "mkdir -p $($deployConfig.RemoteDir)",
  "touch $($deployConfig.RemoteDir)/release-history.log",
  "printf '%s' '$releaseHistoryLineB64' | base64 -d >> $($deployConfig.RemoteDir)/release-history.log",
  "printf '\n' >> $($deployConfig.RemoteDir)/release-history.log",
  "tail -n 5 $($deployConfig.RemoteDir)/release-history.log"
) -join " && "

Log "Appending remote release history..."
Invoke-DeploySsh -Config $deployConfig -Command $appendHistoryCmd
if ($LASTEXITCODE -ne 0) {
  Invoke-RemoteRollbackAndErr "Failed to append remote release history." $deployConfig $deployConfig.RemoteDir
}

Log "Artifact deployment succeeded."
Write-Host "  Version: V$targetVersion" -ForegroundColor Cyan
Write-Host "  Commit:  $targetCommitShort" -ForegroundColor Cyan
Write-Host "  Note:    $releaseNote" -ForegroundColor Cyan
