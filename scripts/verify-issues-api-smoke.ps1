param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$ApiKey = "",
  [string]$ProjectId = "SMOKE-PROJECT",
  [switch]$SkipPermissionProbe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Result {
  param(
    [int]$StatusCode,
    [string]$Content
  )
  return [PSCustomObject]@{
    StatusCode = $StatusCode
    Content = $Content
  }
}

function Read-ResponseContent {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Response
  )

  try {
    if ($null -ne $Response.Content) {
      return [string]$Response.Content
    }
  } catch {
    # Fall through to stream-based read.
  }

  try {
    $stream = $Response.GetResponseStream()
    if ($null -eq $stream) {
      return ""
    }
    $reader = New-Object System.IO.StreamReader($stream)
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
      $stream.Dispose()
    }
  } catch {
    return ""
  }
}

function Invoke-Api {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PATCH", "DELETE")]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [hashtable]$Headers,
    [object]$Body
  )

  $invokeParams = @{
    Method = $Method
    Uri = $Uri
  }

  if ($Headers) {
    $invokeParams["Headers"] = $Headers
  }

  if ($PSBoundParameters.ContainsKey("Body")) {
    $invokeParams["Body"] = ($Body | ConvertTo-Json -Depth 20)
    $invokeParams["ContentType"] = "application/json"
  }
  $invokeParams["UseBasicParsing"] = $true

  try {
    $response = Invoke-WebRequest @invokeParams
    return New-Result -StatusCode ([int]$response.StatusCode) -Content (Read-ResponseContent -Response $response)
  } catch {
    if ($null -ne $_.Exception.Response) {
      $failedResponse = $_.Exception.Response
      $statusCode = 0
      try {
        $statusCode = [int]$failedResponse.StatusCode
      } catch {
        $statusCode = 0
      }
      $content = Read-ResponseContent -Response $failedResponse
      if ([string]::IsNullOrWhiteSpace($content) -and $null -ne $_.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
        $content = [string]$_.ErrorDetails.Message
      }
      return New-Result -StatusCode $statusCode -Content $content
    }
    throw
  }
}

function Parse-JsonSafely {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }
  try {
    return $Text | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Assert-Status {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Result,
    [Parameter(Mandatory = $true)]
    [int[]]$Expected,
    [Parameter(Mandatory = $true)]
    [string]$Step
  )

  if ($Expected -contains [int]$Result.StatusCode) {
    return
  }

  throw "$Step failed. Expected status [$($Expected -join ', ')], got $($Result.StatusCode). Body: $($Result.Content)"
}

function New-WriteHeaders {
  param([string]$Key)
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($Key)) {
    $headers["x-api-key"] = $Key
  }
  return $headers
}

function Is-LocalHost {
  param([string]$Url)
  $uri = [Uri]$Url
  $hostName = $uri.Host.ToLowerInvariant()
  return $hostName -eq "localhost" -or $hostName -eq "127.0.0.1" -or $hostName -eq "::1"
}

$base = $BaseUrl.TrimEnd("/")
$readUrl = "$base/api/issues?projectId=$([uri]::EscapeDataString($ProjectId))"
$issueId = "smoke-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
$isLocal = Is-LocalHost -Url $base

$createdIssue = $false
$deletedIssue = $false
$writeHeaders = New-WriteHeaders -Key $ApiKey

$createPayload = @{
  id = $issueId
  project_id = $ProjectId
  types = @("appearance")
  date = (Get-Date -Format "yyyy-MM-dd")
  process = "injection"
  modules = @{
    evidence = @{
      text = "smoke evidence"
      images = @(
        @{
          id = "img-smoke"
          preview = "/api/uploads/object?key=smoke-nonexistent"
          name = "smoke.jpg"
          size = 123
          compressed = $true
        }
      )
    }
    description = @{ text = "created by smoke"; images = @() }
    rootCause = @{ text = ""; images = @() }
    solution = @{ text = ""; images = @() }
    verification = @{ text = ""; images = @() }
    _meta = @{
      projectName = "Smoke Project"
      productName = "Smoke Product"
      quantity = "1pcs"
      technician = "smoke"
      machine = "M01"
      cavity = "#1"
    }
  }
  status = "draft"
  created_at = (Get-Date).ToString("o")
  updated_at = (Get-Date).ToString("o")
}

$updatePayload = @{
  id = $issueId
  project_id = $ProjectId
  types = @("appearance", "process")
  date = (Get-Date -Format "yyyy-MM-dd")
  process = "assembly"
  modules = @{
    evidence = @{
      text = "updated evidence"
      images = @()
    }
    description = @{ text = "updated by smoke"; images = @() }
    rootCause = @{ text = "updated root cause"; images = @() }
    solution = @{ text = "updated solution"; images = @() }
    verification = @{ text = "pending"; images = @() }
    _meta = @{
      projectName = "Smoke Project"
      productName = "Smoke Product"
      quantity = "2pcs"
      technician = "smoke-updated"
      machine = "M02"
      cavity = "#2"
    }
  }
  status = "submitted"
  created_at = (Get-Date).ToString("o")
  updated_at = (Get-Date).ToString("o")
}

Write-Host "[INFO] Issues API smoke started."
Write-Host "[INFO] BaseUrl=$base ProjectId=$ProjectId LocalHost=$isLocal"

try {
  $readProbe = Invoke-Api -Method "GET" -Uri $readUrl
  Assert-Status -Result $readProbe -Expected @(200) -Step "Read probe (GET /api/issues)"
  $readData = Parse-JsonSafely -Text $readProbe.Content
  if ($null -eq $readData -or -not ($readData -is [System.Collections.IEnumerable])) {
    throw "Read probe failed. Response is not a JSON array. Body: $($readProbe.Content)"
  }
  Write-Host "[PASS] Read probe ok."

  if (-not $SkipPermissionProbe) {
    $permissionProbeId = "smoke-auth-$([guid]::NewGuid().ToString('N').Substring(0, 10))"
    $permissionPayload = @{
      id = $permissionProbeId
      project_id = $ProjectId
      types = @("auth-probe")
      date = (Get-Date -Format "yyyy-MM-dd")
      process = "probe"
      modules = @{ evidence = @{ text = "auth probe"; images = @() } }
      status = "draft"
      created_at = (Get-Date).ToString("o")
      updated_at = (Get-Date).ToString("o")
    }

    $unauthWrite = Invoke-Api -Method "POST" -Uri "$base/api/issues" -Body $permissionPayload
    $writeAllowedWithoutKey = $unauthWrite.StatusCode -ge 200 -and $unauthWrite.StatusCode -lt 300

    if ($writeAllowedWithoutKey) {
      $cleanupProbe = Invoke-Api -Method "DELETE" -Uri "$base/api/issues/$permissionProbeId" -Headers $writeHeaders -Body @{ modules = $permissionPayload.modules }
      if (-not ($cleanupProbe.StatusCode -ge 200 -and $cleanupProbe.StatusCode -lt 300)) {
        Write-Host "[WARN] Permission probe cleanup failed, status=$($cleanupProbe.StatusCode)"
      }

      if ($isLocal) {
        Write-Host "[WARN] Unauthenticated write allowed on localhost (expected in local dev bypass mode)."
      } else {
        throw "Permission probe failed. Unauthenticated write unexpectedly succeeded on non-local endpoint."
      }
    } else {
      if ($unauthWrite.StatusCode -eq 403 -or $unauthWrite.StatusCode -eq 503) {
        Write-Host "[PASS] Permission probe blocked unauthenticated write (status=$($unauthWrite.StatusCode))."
      } else {
        throw "Permission probe returned unexpected status=$($unauthWrite.StatusCode). Body: $($unauthWrite.Content)"
      }
    }
  } else {
    Write-Host "[SKIP] Permission probe skipped by flag."
  }

  $createResult = Invoke-Api -Method "POST" -Uri "$base/api/issues" -Headers $writeHeaders -Body $createPayload
  Assert-Status -Result $createResult -Expected @(201, 200) -Step "Create issue"
  $createdIssue = $true
  Write-Host "[PASS] Create ok. issueId=$issueId"

  $afterCreate = Invoke-Api -Method "GET" -Uri $readUrl
  Assert-Status -Result $afterCreate -Expected @(200) -Step "Fetch after create"
  $afterCreateData = Parse-JsonSafely -Text $afterCreate.Content
  $createdRecord = $afterCreateData | Where-Object { $_.id -eq $issueId } | Select-Object -First 1
  if ($null -eq $createdRecord) {
    throw "Created issue not found in GET response."
  }
  Write-Host "[PASS] Read-after-create ok."

  $updateResult = Invoke-Api -Method "PATCH" -Uri "$base/api/issues/$issueId" -Headers $writeHeaders -Body $updatePayload
  Assert-Status -Result $updateResult -Expected @(200) -Step "Update issue"
  Write-Host "[PASS] Update ok."

  $afterUpdate = Invoke-Api -Method "GET" -Uri $readUrl
  Assert-Status -Result $afterUpdate -Expected @(200) -Step "Fetch after update"
  $afterUpdateData = Parse-JsonSafely -Text $afterUpdate.Content
  $updatedRecord = $afterUpdateData | Where-Object { $_.id -eq $issueId } | Select-Object -First 1
  if ($null -eq $updatedRecord) {
    throw "Updated issue not found in GET response."
  }
  if ($updatedRecord.status -ne "submitted") {
    throw "Update verification failed. Expected status=submitted, got status=$($updatedRecord.status)"
  }
  Write-Host "[PASS] Read-after-update ok."

  $deleteResult = Invoke-Api -Method "DELETE" -Uri "$base/api/issues/$issueId" -Headers $writeHeaders -Body @{ modules = $updatePayload.modules }
  Assert-Status -Result $deleteResult -Expected @(200) -Step "Delete issue"
  $deletedIssue = $true
  Write-Host "[PASS] Delete ok."

  $afterDelete = Invoke-Api -Method "GET" -Uri $readUrl
  Assert-Status -Result $afterDelete -Expected @(200) -Step "Fetch after delete"
  $afterDeleteData = Parse-JsonSafely -Text $afterDelete.Content
  $deletedRecord = $afterDeleteData | Where-Object { $_.id -eq $issueId } | Select-Object -First 1
  if ($null -ne $deletedRecord) {
    throw "Delete verification failed. Issue still present in GET response."
  }
  Write-Host "[PASS] Read-after-delete ok."

  Write-Host "[SUCCESS] Issues API smoke passed."
  exit 0
} catch {
  Write-Host "[FAIL] $($_.Exception.Message)"
  exit 1
} finally {
  if ($createdIssue -and -not $deletedIssue) {
    try {
      $finalCleanup = Invoke-Api -Method "DELETE" -Uri "$base/api/issues/$issueId" -Headers $writeHeaders -Body @{ modules = $updatePayload.modules }
      if ($finalCleanup.StatusCode -ge 200 -and $finalCleanup.StatusCode -lt 300) {
        Write-Host "[CLEANUP] Residual smoke issue removed."
      } else {
        Write-Host "[CLEANUP-WARN] Unable to remove residual smoke issue, status=$($finalCleanup.StatusCode)"
      }
    } catch {
      Write-Host "[CLEANUP-WARN] Residual cleanup request failed: $($_.Exception.Message)"
    }
  }
}
