# ============================================================================
# deploy.ps1 - Release entrypoint (artifact-driven)
# Usage:
#   .\deploy.ps1 -Mode build  -VersionBump minor -ReleaseNote "fix xxx"
#   .\deploy.ps1 -Mode deploy -ArtifactPath .\artifacts\releases\release-xxx.tar.gz
#   .\deploy.ps1 -Mode all    -VersionBump major -ReleaseNote "add module yyy"
#   .\deploy.ps1   # default mode: all (auto ReleaseNote if omitted)
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

function Normalize-SingleLine([string]$Value) {
    if ($null -eq $Value) {
        return ""
    }
    $singleLine = ($Value -replace "(\r\n|\n|\r)+", " ").Trim()
    return ($singleLine -replace "\s{2,}", " ").Trim()
}

function Resolve-EntrypointReleaseNote([string]$RawNote, [string]$CurrentMode, [switch]$IsPreflightOnly) {
    $normalized = Normalize-SingleLine $RawNote
    if (-not [string]::IsNullOrWhiteSpace($normalized)) {
        return $normalized
    }

    if ($CurrentMode -eq "deploy" -or $IsPreflightOnly) {
        return ""
    }

    $commitShort = ((git -C $PSScriptRoot rev-parse --short HEAD 2>$null) | Out-String).Trim()
    if (-not $commitShort) {
        $commitShort = "unknown"
    }

    $autoNote = "auto-release-$commitShort"
    Warn "ReleaseNote not provided. Using auto-generated note: $autoNote"
    return $autoNote
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
