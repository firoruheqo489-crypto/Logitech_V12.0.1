param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$MoldId = "",
  [string]$MoldNo = "",
  [string]$EnvFile = ".env",
  [string]$ApiKey = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-Json([string]$Uri) {
  return Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec 15
}

function Post-Json([string]$Uri, [hashtable]$Body) {
  return Invoke-RestMethod -Method Post -Uri $Uri -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 15
}

function New-SmokeIdentity {
  $timestamp = (Get-Date).ToString("yyyyMMddHHmmss")
  $token = ([guid]::NewGuid().ToString("N")).Substring(0, 8)
  return @{
    MoldId = "FRACAS-SMOKE-ASSET-$timestamp-$token"
    MoldNo = "NO. SMOKE $timestamp-$token"
  }
}

function Parse-EnvFile([string]$FilePath) {
  $map = @{}
  if (-not (Test-Path $FilePath)) {
    return $map
  }

  foreach ($rawLine in Get-Content $FilePath) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) {
      continue
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"'))
      -or ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ($key) {
      $map[$key] = $value
    }
  }

  return $map
}

if ([string]::IsNullOrWhiteSpace($MoldId) -or [string]::IsNullOrWhiteSpace($MoldNo)) {
  $identity = New-SmokeIdentity
  if ([string]::IsNullOrWhiteSpace($MoldId)) {
    $MoldId = $identity.MoldId
  }
  if ([string]::IsNullOrWhiteSpace($MoldNo)) {
    $MoldNo = $identity.MoldNo
  }
}

Write-Host "[INFO] Reliability smoke started. baseUrl=$BaseUrl moldId=$MoldId"

$envPath = Resolve-Path $EnvFile -ErrorAction SilentlyContinue
$envMap = @{}
if ($envPath) {
  $envMap = Parse-EnvFile $envPath.Path
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = [string]$env:API_SECRET_KEY
}
if ([string]::IsNullOrWhiteSpace($ApiKey) -and $envMap.ContainsKey('API_SECRET_KEY')) {
  $ApiKey = [string]$envMap['API_SECRET_KEY']
}

$headers = @{}
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
  $headers["x-api-key"] = $ApiKey.Trim()
  Write-Host "[INFO] Reliability smoke auth header enabled."
} else {
  Write-Host "[INFO] Reliability smoke auth header skipped."
}

$beforeStats = Read-Json "$BaseUrl/api/dashboard/stats?moldId=$([uri]::EscapeDataString($MoldId))&moldNo=$([uri]::EscapeDataString($MoldNo))"
$beforeReliability = [double]($beforeStats.reliability.currentReliability ?? 0)
$beforeShots = [int]($beforeStats.reliability.currentShots ?? 250000)

$payload = @{
  moldId = $MoldId
  moldNo = $MoldNo
  type = "SICKNESS"
  currentShots = $beforeShots + 1000
  recoveryRating = 0.2
  downtimeHours = 12
  cost = 9999
  operator = "smoke"
  symptom = "Smoke severe failure injection"
  diagnosis = "Smoke severe failure"
  procedure = "Smoke severe failure write path"
}

[void](Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/reliability/event" -ContentType "application/json" -Headers $headers -Body ($payload | ConvertTo-Json -Depth 10) -TimeoutSec 15)

$afterStats = Read-Json "$BaseUrl/api/dashboard/stats?moldId=$([uri]::EscapeDataString($MoldId))&moldNo=$([uri]::EscapeDataString($MoldNo))"
$afterReliability = [double]($afterStats.reliability.currentReliability ?? 0)

Write-Host "[INFO] Reliability before=$beforeReliability after=$afterReliability"

if ($afterReliability -ge $beforeReliability) {
  throw "Reliability smoke failed: expected R(t) to drop after severe failure event."
}

Write-Host "[SUCCESS] Reliability smoke passed."
