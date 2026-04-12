param(
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log([string]$Message) {
  Write-Host "[deploy-key] $Message" -ForegroundColor Green
}

function Err([string]$Message) {
  Write-Host "[deploy-key] $Message" -ForegroundColor Red
  exit 1
}

function Invoke-ProcessCapture {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$WorkingDirectory = ""
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  if ($WorkingDirectory) {
    $psi.WorkingDirectory = $WorkingDirectory
  }

  $quotedArguments = foreach ($argument in $Arguments) {
    if ($argument -eq "") {
      '""'
    } elseif ($argument -match '[\s"]') {
      '"' + ($argument -replace '"', '\"') + '"'
    } else {
      $argument
    }
  }
  $psi.Arguments = ($quotedArguments -join " ")

  $process = [System.Diagnostics.Process]::Start($psi)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    StdOut = $stdout
    StdErr = $stderr
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deploySshScript = Join-Path $PSScriptRoot "deploy-ssh.ps1"
if (-not (Test-Path -LiteralPath $deploySshScript)) {
  Err "Missing deploy SSH helper: $deploySshScript"
}

. $deploySshScript
$config = Get-DeployConnectionConfig -RepoRoot $repoRoot
$sshKeygenPath = "C:\Windows\System32\OpenSSH\ssh-keygen.exe"
$keyDir = Join-Path $repoRoot ".codex-user\.ssh"
$keyPath = Join-Path $keyDir "id_ed25519"
$comment = "codex-deploy@$($config.Host)"

New-Item -ItemType Directory -Path $keyDir -Force | Out-Null

if ((Test-Path -LiteralPath $keyPath) -and -not $Force) {
  Log "Reusing existing key: $keyPath"
} else {
  if (Test-Path -LiteralPath $keyPath) {
    Remove-Item -LiteralPath $keyPath -Force
  }

  $createResult = Invoke-ProcessCapture -FilePath $sshKeygenPath -WorkingDirectory $repoRoot -Arguments @(
    "-q",
    "-t", "ed25519",
    "-N", "",
    "-C", $comment,
    "-f", $keyPath
  )

  if ($createResult.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $keyPath)) {
    $stderr = $createResult.StdErr.Trim()
    if (-not $stderr) {
      $stderr = $createResult.StdOut.Trim()
    }
    Err "Failed to generate deploy key. $stderr"
  }
}

$publicKeyResult = Invoke-ProcessCapture -FilePath $sshKeygenPath -WorkingDirectory $repoRoot -Arguments @(
  "-y",
  "-f", $keyPath
)

if ($publicKeyResult.ExitCode -ne 0 -or -not $publicKeyResult.StdOut.Trim()) {
  Err "Failed to derive public key from $keyPath. $($publicKeyResult.StdErr.Trim())"
}

$publicKeyParts = $publicKeyResult.StdOut.Trim() -split "\s+"
if ($publicKeyParts.Length -lt 2) {
  Err "ssh-keygen returned an invalid public key payload."
}
$publicKey = "$($publicKeyParts[0]) $($publicKeyParts[1]) $comment"

Log "Deploy key ready."
Write-Host "Public key:" -ForegroundColor Cyan
Write-Host $publicKey
