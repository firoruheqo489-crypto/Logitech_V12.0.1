# ============================================================================
# deploy.ps1 - Release entrypoint (artifact-driven)
# Usage:
#   .\deploy.ps1 -Mode build  -VersionBump minor -ReleaseNote "fix xxx"
#   .\deploy.ps1 -Mode deploy -ArtifactPath .\artifacts\releases\release-xxx.tar.gz
#   .\deploy.ps1 -Mode all    -VersionBump major -ReleaseNote "add module yyy"
# ============================================================================

param(
    [ValidateSet("build", "deploy", "all")]
    [string]$Mode = "all",
    [ValidateSet("minor", "major")]
    [string]$VersionBump = "minor",
    [string]$ReleaseNote = "",
    [string]$ArtifactPath = "",
    [string]$MetadataPath = "",
    [string]$OutputDir = "artifacts/releases",
    [switch]$SkipVerification,
    [switch]$SkipRemoteSmoke,
    [switch]$PreflightOnly
)

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

if (($Mode -eq "build" -or $Mode -eq "all") -and [string]::IsNullOrWhiteSpace($ReleaseNote) -and -not $PreflightOnly) {
    Err "ReleaseNote is required for build/all mode."
}

if ($Mode -eq "build") {
    Log "Running artifact build mode..."
    & $releaseBuildScript `
        -VersionBump $VersionBump `
        -ReleaseNote $ReleaseNote `
        -OutputDir $OutputDir `
        -SkipVerification:$SkipVerification `
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
    -OutputDir $OutputDir `
    -SkipVerification:$SkipVerification `
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
    -SkipRemoteSmoke:$SkipRemoteSmoke

if ($LASTEXITCODE -ne 0) {
    Err "Artifact deploy failed."
}

Log "Build+deploy completed."
