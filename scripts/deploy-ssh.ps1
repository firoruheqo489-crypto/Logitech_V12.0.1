Set-StrictMode -Version Latest

function Resolve-DeployPath {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [string]$PathValue
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return $null
  }

  if ([IO.Path]::IsPathRooted($PathValue)) {
    return [IO.Path]::GetFullPath($PathValue)
  }

  return [IO.Path]::GetFullPath((Join-Path $RepoRoot $PathValue))
}

function Merge-DeploySettings {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Target,
    $Source
  )

  if ($null -eq $Source) {
    return
  }

  foreach ($property in $Source.PSObject.Properties) {
    if ($null -eq $property.Value) {
      continue
    }

    if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace([string]$property.Value)) {
      continue
    }

    $Target[$property.Name] = $property.Value
  }
}

function Get-DeployConnectionConfig {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [string]$ConfigPath = "",
    [string]$SshTargetOverride = "",
    [string]$RemoteDirOverride = ""
  )

  $settings = [ordered]@{
    host = "120.27.153.140"
    user = "root"
    port = 22
    remoteDir = "/var/www/logitech"
    serverUrl = ""
    sshTarget = ""
    identityFile = ".codex-user/.ssh/id_ed25519"
    knownHostsFile = ".codex-user/.ssh/known_hosts"
    strictHostKeyChecking = "accept-new"
    connectTimeoutSec = 10
    connectionAttempts = 1
  }

  $resolvedConfigPath = if ($ConfigPath) {
    Resolve-DeployPath -RepoRoot $RepoRoot -PathValue $ConfigPath
  } else {
    Join-Path $RepoRoot "deploy.local.json"
  }

  if (Test-Path -LiteralPath $resolvedConfigPath) {
    $fileSettings = Get-Content -LiteralPath $resolvedConfigPath -Raw | ConvertFrom-Json
    Merge-DeploySettings -Target $settings -Source $fileSettings
  }

  if ($env:DEPLOY_HOST) { $settings["host"] = $env:DEPLOY_HOST }
  if ($env:DEPLOY_USER) { $settings["user"] = $env:DEPLOY_USER }
  if ($env:DEPLOY_PORT) { $settings["port"] = $env:DEPLOY_PORT }
  if ($env:DEPLOY_REMOTE_DIR) { $settings["remoteDir"] = $env:DEPLOY_REMOTE_DIR }
  if ($env:DEPLOY_SERVER_URL) { $settings["serverUrl"] = $env:DEPLOY_SERVER_URL }
  if ($env:DEPLOY_SSH_TARGET) { $settings["sshTarget"] = $env:DEPLOY_SSH_TARGET }
  if ($env:DEPLOY_IDENTITY_FILE) { $settings["identityFile"] = $env:DEPLOY_IDENTITY_FILE }
  if ($env:DEPLOY_KNOWN_HOSTS_FILE) { $settings["knownHostsFile"] = $env:DEPLOY_KNOWN_HOSTS_FILE }
  if ($env:DEPLOY_STRICT_HOST_KEY_CHECKING) { $settings["strictHostKeyChecking"] = $env:DEPLOY_STRICT_HOST_KEY_CHECKING }
  if ($env:DEPLOY_CONNECT_TIMEOUT_SEC) { $settings["connectTimeoutSec"] = $env:DEPLOY_CONNECT_TIMEOUT_SEC }
  if ($env:DEPLOY_CONNECTION_ATTEMPTS) { $settings["connectionAttempts"] = $env:DEPLOY_CONNECTION_ATTEMPTS }

  if ($SshTargetOverride) {
    $settings["sshTarget"] = $SshTargetOverride
  }
  if ($RemoteDirOverride) {
    $settings["remoteDir"] = $RemoteDirOverride
  }

  $deployHost = [string]$settings["host"]
  $deployUser = [string]$settings["user"]
  $deployPort = [int]$settings["port"]
  $deployRemoteDir = [string]$settings["remoteDir"]
  $deployServerUrl = [string]$settings["serverUrl"]
  $sshTarget = [string]$settings["sshTarget"]
  if (-not $sshTarget) {
    $sshTarget = if ($deployUser) { "$deployUser@$deployHost" } else { $deployHost }
  }

  if (-not $deployServerUrl) {
    $deployServerUrl = "http://$($deployHost):3000"
  }

  $identityFile = Resolve-DeployPath -RepoRoot $RepoRoot -PathValue ([string]$settings["identityFile"])
  $knownHostsFile = Resolve-DeployPath -RepoRoot $RepoRoot -PathValue ([string]$settings["knownHostsFile"])
  $knownHostsDir = Split-Path -Path $knownHostsFile -Parent
  if ($knownHostsDir) {
    New-Item -ItemType Directory -Path $knownHostsDir -Force | Out-Null
  }

  return [pscustomobject]@{
    Host = $deployHost
    User = $deployUser
    Port = $deployPort
    RemoteDir = $deployRemoteDir
    ServerUrl = $deployServerUrl
    SshTarget = $sshTarget
    IdentityFile = $identityFile
    IdentityFileExists = [bool]($identityFile -and (Test-Path -LiteralPath $identityFile))
    KnownHostsFile = $knownHostsFile
    StrictHostKeyChecking = [string]$settings["strictHostKeyChecking"]
    ConnectTimeoutSec = [int]$settings["connectTimeoutSec"]
    ConnectionAttempts = [int]$settings["connectionAttempts"]
    ConfigPath = $resolvedConfigPath
  }
}

function Get-DeploySshArgs {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [switch]$ForScp
  )

  $args = @()
  if ($ForScp) {
    $args += @("-P", "$($Config.Port)")
  } else {
    $args += @("-p", "$($Config.Port)")
  }

  $args += @("-o", "BatchMode=yes")
  $args += @("-o", "ConnectTimeout=$($Config.ConnectTimeoutSec)")
  $args += @("-o", "ConnectionAttempts=$($Config.ConnectionAttempts)")

  if ($Config.KnownHostsFile) {
    $args += @("-o", "UserKnownHostsFile=$($Config.KnownHostsFile)")
  }
  if ($Config.StrictHostKeyChecking) {
    $args += @("-o", "StrictHostKeyChecking=$($Config.StrictHostKeyChecking)")
  }
  if ($Config.IdentityFileExists) {
    $args += @("-i", $Config.IdentityFile)
  }

  return ,$args
}

function Invoke-DeploySsh {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string]$Command
  )

  $args = @()
  $args += Get-DeploySshArgs -Config $Config
  $args += $Config.SshTarget
  $args += $Command

  & ssh @args
}

function Invoke-DeployScp {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [Parameter(Mandatory = $true)][string[]]$SourcePaths,
    [Parameter(Mandatory = $true)][string]$RemotePath
  )

  $args = @()
  $args += Get-DeploySshArgs -Config $Config -ForScp
  $args += $SourcePaths
  $args += "$($Config.SshTarget):$RemotePath"

  & scp @args
}
