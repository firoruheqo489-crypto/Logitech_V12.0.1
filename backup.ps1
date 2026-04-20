# ==========================================
# Level 0 物理级资产隔离脚本
# ==========================================
$ProjectName = "Logitech_Dashboard"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

$BackupParentDir = Resolve-Path "..\Backups" -ErrorAction SilentlyContinue
if (-not $BackupParentDir) {
    $BackupParentDir = New-Item -ItemType Directory -Force -Path "..\Backups"
}
$ZipPath = Join-Path $BackupParentDir "${ProjectName}_${Timestamp}.zip"
$TempDir = Join-Path $env:TEMP "${ProjectName}_$Timestamp"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Host "[1/3] 建立临时安全区: 剥离无价值与高风险目录..." -ForegroundColor Cyan
$ExcludeDirs = ".git", "node_modules", "dist", ".next", "build", ".cache", "tmp", ".pnpm-store", "artifacts", ".rollback", ".release-worktrees"
$ExcludeFiles = "*.zip", "backup.ps1", ".DS_Store"
robocopy . $TempDir /MIR /XD $ExcludeDirs /XF $ExcludeFiles /NFL /NDL /NJH /NJS /R:0 /W:0 | Out-Null

Write-Host "[2/3] 执行高压物理固化: 生成不可变压缩包..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($TempDir, $ZipPath)

Remove-Item -Path $TempDir -Recurse -Force
Write-Host "[3/3] 资产隔离完成！物理备份路径 -> $ZipPath" -ForegroundColor Green
