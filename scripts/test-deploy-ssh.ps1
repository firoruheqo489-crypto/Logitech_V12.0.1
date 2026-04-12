Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Log([string]$Message) {
  Write-Host "[deploy-ssh-test] $Message" -ForegroundColor Green
}

function Err([string]$Message) {
  Write-Host "[deploy-ssh-test] $Message" -ForegroundColor Red
  exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deploySshScript = Join-Path $PSScriptRoot "deploy-ssh.ps1"
if (-not (Test-Path -LiteralPath $deploySshScript)) {
  Err "Missing deploy SSH helper: $deploySshScript"
}

. $deploySshScript
$config = Get-DeployConnectionConfig -RepoRoot $repoRoot

Log "Testing SSH to $($config.SshTarget)"
$result = Invoke-DeploySsh -Config $config -Command "echo ok"
if ($LASTEXITCODE -ne 0 -or ($result | Out-String).Trim() -ne "ok") {
  Err "SSH connectivity check failed."
}

Log "SSH connectivity ok."
