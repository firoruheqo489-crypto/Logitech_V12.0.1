param(
  [string]$Version = "",
  [string]$MetadataPath = "",
  [int]$Port = 3000,
  [string]$EnvFile = ".env",
  [switch]$KeepExistingRuntime
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log([string]$Message) {
  Write-Host "[local-artifact] $Message" -ForegroundColor Green
}

function Err([string]$Message) {
  Write-Host "[local-artifact] $Message" -ForegroundColor Red
  exit 1
}

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Resolve-MetadataFile([string]$ReleasesDir, [string]$TargetVersion, [string]$InputMetadataPath) {
  if ($InputMetadataPath) {
    $resolved = Resolve-Path $InputMetadataPath -ErrorAction SilentlyContinue
    if (-not $resolved) {
      Err "Metadata file not found: $InputMetadataPath"
    }
    return $resolved.Path
  }

  if (-not $TargetVersion) {
    Err "Provide either -Version or -MetadataPath."
  }

  $candidate = Get-ChildItem -LiteralPath $ReleasesDir -File -Filter "release-v$TargetVersion-*.metadata.json" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $candidate) {
    Err "No local release metadata found for version $TargetVersion under $ReleasesDir"
  }

  return $candidate.FullName
}

function Stop-PortListeners([int]$TargetPort) {
  $listeners = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return
  }

  $procIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $procIds) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      Err "Port $TargetPort is already in use by PID $procId and could not be stopped from this session."
    }
  }
}

$repoRoot = Resolve-RepoRoot
$releasesDir = Join-Path $repoRoot "artifacts\releases"
$resolvedMetadataPath = Resolve-MetadataFile -ReleasesDir $releasesDir -TargetVersion $Version -InputMetadataPath $MetadataPath
$metadata = Get-Content -LiteralPath $resolvedMetadataPath -Raw | ConvertFrom-Json
$artifactPath = [string]$metadata.artifactPath

if (-not $artifactPath -or -not (Test-Path -LiteralPath $artifactPath)) {
  Err "Artifact file not found: $artifactPath"
}

$artifactBase = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($artifactPath))
$runtimeRoot = Join-Path $repoRoot "artifacts\local-runtime\$artifactBase"
$payloadRoot = Join-Path $runtimeRoot "payload"
$distIndex = Join-Path $payloadRoot "dist\index.js"
$resolvedEnvFile = Resolve-Path $EnvFile -ErrorAction SilentlyContinue
if (-not $resolvedEnvFile) {
  Err "Env file not found: $EnvFile"
}

Stop-PortListeners -TargetPort $Port

if ((-not $KeepExistingRuntime) -and (Test-Path -LiteralPath $runtimeRoot)) {
  Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
}

if (-not (Test-Path -LiteralPath $distIndex)) {
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  tar -xzf $artifactPath -C $runtimeRoot
}

if (-not (Test-Path -LiteralPath $distIndex)) {
  Err "Extracted runtime missing dist/index.js: $payloadRoot"
}
$runtimeEnvPath = Join-Path $payloadRoot ".env"

Copy-Item -LiteralPath $resolvedEnvFile.Path -Destination $runtimeEnvPath -Force

Log "Starting V$($metadata.version) from $artifactBase on http://localhost:$Port"
Log "Using env file: $($resolvedEnvFile.Path)"

$env:NODE_ENV = "production"
$env:PORT = "$Port"
$env:APP_ENV_FILE = $resolvedEnvFile.Path

Push-Location $payloadRoot
try {
  & node "dist/index.js"
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
