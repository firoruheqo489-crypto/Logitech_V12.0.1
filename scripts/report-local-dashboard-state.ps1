param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$stateFile = Join-Path $RepoRoot ".codex-local-dashboard.state.json"

if (-not (Test-Path -LiteralPath $stateFile)) {
  throw "local dashboard state file not found: $stateFile"
}

function Invoke-JsonProbe {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [int]$TimeoutSec = 5
  )

  $request = [System.Net.HttpWebRequest]::Create($Uri)
  $request.Method = "GET"
  $request.Timeout = $TimeoutSec * 1000
  $request.ReadWriteTimeout = $TimeoutSec * 1000

  try {
    $response = [System.Net.HttpWebResponse]$request.GetResponse()
  } catch [System.Net.WebException] {
    if ($null -eq $_.Exception.Response) {
      throw
    }
    $response = [System.Net.HttpWebResponse]$_.Exception.Response
  }

  try {
    $statusCode = [int]$response.StatusCode
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $raw = $reader.ReadToEnd()
    $reader.Dispose()

    $payload = $null
    try {
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $payload = $raw | ConvertFrom-Json
      }
    } catch {
      $payload = $null
    }

    return [PSCustomObject]@{
      StatusCode = $statusCode
      Payload = $payload
      Raw = $raw
    }
  } finally {
    $response.Close()
  }
}

$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$apiProbe = Invoke-JsonProbe -Uri $state.apiHealthUrl -TimeoutSec 5
$frontendResponse = Invoke-WebRequest -Uri $state.frontendUrl -Method Get -TimeoutSec 5 -UseBasicParsing
$apiHealthy = ($null -ne $apiProbe.Payload -and $apiProbe.Payload.api -eq $true)
$apiDbOk = ($null -ne $apiProbe.Payload -and $apiProbe.Payload.ok -eq $true)
$frontendStatusCode = [int]$frontendResponse.StatusCode
$frontendReachable = ($frontendStatusCode -ge 200 -and $frontendStatusCode -lt 500)

if (-not $apiHealthy) {
  throw "api health probe failed for $($state.apiHealthUrl) (status $($apiProbe.StatusCode))"
}

if (-not $frontendReachable) {
  throw "frontend check failed for $($state.frontendUrl) with status $frontendStatusCode"
}

[Console]::Out.WriteLine("LOCAL_DASHBOARD_READY")
[Console]::Out.WriteLine("FRONTEND_URL=$($state.frontendUrl)")
[Console]::Out.WriteLine("FRONTEND_STATUS=$frontendStatusCode")
[Console]::Out.WriteLine("API_URL=$($state.apiUrl)")
[Console]::Out.WriteLine("API_HEALTH=$($state.apiHealthUrl)")
[Console]::Out.WriteLine("API_OK=true")
[Console]::Out.WriteLine("API_DB_OK=$apiDbOk")
[Console]::Out.WriteLine("API_HEALTH_STATUS=$($apiProbe.StatusCode)")
[Console]::Out.WriteLine("API_PID=$($state.apiPid)")
[Console]::Out.WriteLine("VITE_PID=$($state.vitePid)")
[Console]::Out.WriteLine("STATE_FILE=$stateFile")
[Console]::Out.Flush()
