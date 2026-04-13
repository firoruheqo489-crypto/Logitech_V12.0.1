# ============================================================================
# deploy.ps1 - Release entrypoint (artifact-driven)
# Usage:
#   .\deploy.ps1 -Mode build  -VersionBump minor -ReleaseNote "fix xxx"
#   .\deploy.ps1 -Mode deploy -ArtifactPath .\artifacts\releases\release-xxx.tar.gz -ConfirmProduction -ConfirmText "DEPLOY_PROD"
#   .\deploy.ps1 -Mode all    -VersionBump major -ReleaseNote "add module yyy" -ConfirmProduction -ConfirmText "DEPLOY_PROD"
#   .\deploy.ps1   # default mode: build (safe)
# ============================================================================

param(
    [ValidateSet("build", "deploy", "all")]
    [string]$Mode = "build",
    [ValidateSet("minor", "major")]
    [string]$VersionBump = "minor",
    [string]$ReleaseNote = "",
    [string]$ArtifactPath = "",
    [string]$MetadataPath = "",
    [string]$OutputDir = "artifacts/releases",
    [string]$RemoteDir = "",
    [switch]$SkipVerification,
    [switch]$SkipRemoteSmoke,
    [switch]$ConfirmProduction,
    [string]$ConfirmText = "",
    [string]$HostAlias = "",
    [switch]$PreflightOnly,
    [switch]$AllowDirtyWorkspace
)

$ErrorActionPreference = "Stop"

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

function Resolve-EntrypointReleaseNote([string]$RawNote, [string]$CurrentMode, [switch]$IsPreflightOnly) {
    $normalized = Normalize-SingleLine $RawNote
    if (-not [string]::IsNullOrWhiteSpace($normalized)) { return $normalized }
    if ($CurrentMode -eq "deploy" -or $IsPreflightOnly) { return "" }
    return ""
}

function Assert-ReleaseGuards(
    [string]$CurrentMode,
    [string]$CurrentReleaseNote,
    [switch]$IsPreflightOnly,
    [switch]$IsConfirmProduction,
    [string]$CurrentConfirmText
) {
    $isBuildRelated = $CurrentMode -eq "build" -or $CurrentMode -eq "all"
    $isDeployRelated = $CurrentMode -eq "deploy" -or $CurrentMode -eq "all"

    if ($isBuildRelated -and -not $IsPreflightOnly -and [string]::IsNullOrWhiteSpace($CurrentReleaseNote)) {
        Err "ReleaseNote is required for build/all mode. Example: -ReleaseNote '修复删除弹窗误触'."
    }

    if ($isDeployRelated -and -not $IsPreflightOnly) {
        if (-not $IsConfirmProduction) {
            Err "Production deploy guard: add -ConfirmProduction to continue."
        }
        if ($CurrentConfirmText -ne "DEPLOY_PROD") {
            Err 'Production deploy guard: add -ConfirmText "DEPLOY_PROD" to continue.'
        }
    }
}

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

function Resolve-LatestMetadataPath([string]$RootPath) {
    if (-not (Test-Path $RootPath)) {
        return $null
    }

    $candidate = Get-ChildItem -Path $RootPath -Filter "*.metadata.json" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $candidate) {
        return $null
    }

    return $candidate.FullName
}

$scriptRoot = $PSScriptRoot
$releaseBuildScript = Join-Path $scriptRoot "scripts/release-build.ps1"
$releaseDeployScript = Join-Path $scriptRoot "scripts/deploy-release-artifact.ps1"

if (-not (Test-Path $releaseBuildScript)) {
    Err "Missing script: $releaseBuildScript"
}
if (-not (Test-Path $releaseDeployScript)) {
    Err "Missing script: $releaseDeployScript"
}

$ReleaseNote = Resolve-EntrypointReleaseNote -RawNote $ReleaseNote -CurrentMode $Mode -IsPreflightOnly:$PreflightOnly
$resolvedRemoteDir = Resolve-DeployRemoteDir $RemoteDir
Assert-ReleaseGuards `
    -CurrentMode $Mode `
    -CurrentReleaseNote $ReleaseNote `
    -IsPreflightOnly:$PreflightOnly `
    -IsConfirmProduction:$ConfirmProduction `
    -CurrentConfirmText $ConfirmText

$resolvedHostAlias = Resolve-DeployHostAlias $HostAlias

if ($Mode -eq "build") {
    Log "Running artifact build mode..."
    & $releaseBuildScript `
        -VersionBump $VersionBump `
        -ReleaseNote $ReleaseNote `
        -HostAlias $resolvedHostAlias `
        -RemoteDir $resolvedRemoteDir `
        -OutputDir $OutputDir `
        -SkipVerification:$SkipVerification `
        -AllowDirtyWorkspace:$AllowDirtyWorkspace `
        -PreflightOnly:$PreflightOnly

    if ($LASTEXITCODE -ne 0) {
        Err "Artifact build failed."
    }

    exit 0
}

if ($Mode -eq "deploy") {
    if (-not $ArtifactPath) {
        Err "ArtifactPath is required in deploy mode."
    }

    Log "Running artifact deploy mode..."
    & $releaseDeployScript `
        -ArtifactPath $ArtifactPath `
        -MetadataPath $MetadataPath `
        -HostAlias $resolvedHostAlias `
        -RemoteDir $resolvedRemoteDir `
        -SkipRemoteSmoke:$SkipRemoteSmoke

    if ($LASTEXITCODE -ne 0) {
        Err "Artifact deploy failed."
    }

    exit 0
}

# Mode = all
Log "Running artifact build+deploy mode..."
& $releaseBuildScript `
    -VersionBump $VersionBump `
    -ReleaseNote $ReleaseNote `
    -HostAlias $resolvedHostAlias `
    -RemoteDir $resolvedRemoteDir `
    -OutputDir $OutputDir `
    -SkipVerification:$SkipVerification `
    -AllowDirtyWorkspace:$AllowDirtyWorkspace `
    -PreflightOnly:$PreflightOnly

if ($LASTEXITCODE -ne 0) {
    Err "Artifact build failed."
}

if ($PreflightOnly) {
    Log "Preflight finished. Skipping deploy because -PreflightOnly was requested."
    exit 0
}

$resolvedOutputDir = Resolve-AbsolutePath $OutputDir
if (-not $resolvedOutputDir) {
    Err "Failed to resolve output directory after build: $OutputDir"
}

$latestMetadata = Resolve-LatestMetadataPath $resolvedOutputDir
if (-not $latestMetadata) {
    Err "Could not find release metadata file under $resolvedOutputDir"
}

$derivedArtifactPath = $latestMetadata -replace "\.metadata\.json$", ".tar.gz"
if (-not (Test-Path $derivedArtifactPath)) {
    Err "Derived artifact path not found: $derivedArtifactPath"
}

Log "Deploying latest artifact:"
Write-Host "  Artifact: $derivedArtifactPath" -ForegroundColor Cyan
Write-Host "  Metadata: $latestMetadata" -ForegroundColor Cyan

& $releaseDeployScript `
    -ArtifactPath $derivedArtifactPath `
    -MetadataPath $latestMetadata `
    -HostAlias $resolvedHostAlias `
    -RemoteDir $resolvedRemoteDir `
    -SkipRemoteSmoke:$SkipRemoteSmoke

if ($LASTEXITCODE -ne 0) {
    Err "Artifact deploy failed."
}

Log "Build+deploy completed."
