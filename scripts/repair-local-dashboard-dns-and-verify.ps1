param(
  [string]$InterfaceAlias = "WLAN",
  [ValidateSet("AliDNS", "CloudflareGoogle", "Reset")]
  [string]$DnsProfile = "AliDNS",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[repair-dashboard] $Message" -ForegroundColor Cyan
}

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
  throw "请以管理员身份运行此脚本。"
}

$dnsProfiles = @{
  "AliDNS" = @("223.5.5.5", "119.29.29.29")
  "CloudflareGoogle" = @("1.1.1.1", "8.8.8.8")
}

Write-Step "目标网卡: $InterfaceAlias"
Write-Step "仓库目录: $RepoRoot"

if ($DnsProfile -eq "Reset") {
  Write-Step "恢复网卡 DNS 为自动获取"
  Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ResetServerAddresses
} else {
  $serverAddresses = $dnsProfiles[$DnsProfile]
  Write-Step "设置 DNS 配置: $DnsProfile -> $($serverAddresses -join ', ')"
  Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ServerAddresses $serverAddresses
}

Write-Step "清理本地 DNS 缓存"
Clear-DnsClientCache
ipconfig /flushdns | Out-Host

Write-Step "确认当前 DNS"
Get-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 |
  Select-Object InterfaceAlias, ServerAddresses |
  Format-Table -AutoSize |
  Out-Host

Write-Step "验证 Supabase pooler 域名解析"
Resolve-DnsName aws-1-ap-southeast-2.pooler.supabase.com |
  Select-Object Name, Type, IPAddress |
  Format-Table -AutoSize |
  Out-Host

Write-Step "启动本地看板"
Push-Location $RepoRoot
try {
  pnpm run dev:dashboard:local | Out-Host

  Write-Step "验活本地看板"
  pnpm run dev:dashboard:status | Out-Host
} finally {
  Pop-Location
}

Write-Step "修复与验活完成"
