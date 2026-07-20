#Requires -Version 5.1
# Core.ps1 — root, log, progress, list helpers

function Get-OptiBaseDir {
    if ($Global:OptiRoot -and (Test-Path -LiteralPath $Global:OptiRoot)) {
        return $Global:OptiRoot
    }
    if ($PSScriptRoot -and (Split-Path $PSScriptRoot -Leaf) -eq 'modules') {
        return (Split-Path $PSScriptRoot -Parent)
    }
    if ($PSScriptRoot -and (Split-Path $PSScriptRoot -Leaf) -eq 'api') {
        return (Split-Path $PSScriptRoot -Parent)
    }
    if ($PSScriptRoot) { return $PSScriptRoot }
    return (Get-Location).Path
}

function Test-OptiAdmin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        $p = New-Object Security.Principal.WindowsPrincipal($id)
        return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

function Format-OptiSize {
    param([long]$Bytes)
    if ($null -eq $Bytes) { $Bytes = 0 }
    if ($Bytes -lt 1KB) { return "$Bytes B" }
    if ($Bytes -lt 1MB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    if ($Bytes -lt 1GB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    return "{0:N2} GB" -f ($Bytes / 1GB)
}

function Write-OptiLog {
    param(
        [string]$Message,
        [string]$LogPath,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'SKIP', 'OK')]
        [string]$Level = 'INFO'
    )
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    if ($LogPath) {
        Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    }
}

function Get-OptiPathSizeBytes {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return 0L }
    try {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if (-not $item.PSIsContainer) { return [long]$item.Length }
        $sum = [long]0
        Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
            ForEach-Object { $sum += $_.Length }
        return $sum
    } catch { return 0L }
}

function Get-OptiListLines {
    param(
        [string]$RelativeName,
        [string]$BaseDir = $(Get-OptiBaseDir)
    )
    $file = Join-Path $BaseDir (Join-Path 'lists' $RelativeName)
    if (-not (Test-Path -LiteralPath $file)) { return @() }
    Get-Content -LiteralPath $file -Encoding UTF8 -ErrorAction SilentlyContinue |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -and $_ -notmatch '^\s*#' }
}

function Get-OptiDataDir {
    $local = $env:LOCALAPPDATA
    if (-not $local) { $local = Join-Path $env:USERPROFILE 'AppData\Local' }
    $dir = Join-Path $local 'Mr-Aurevo-X\Opti'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return $dir
}

function Get-OptiSessionLogPath {
    param([string]$BaseDir = $(Get-OptiBaseDir))
    $logsDir = Join-Path $BaseDir 'logs'
    if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
    $marker = Join-Path $logsDir 'current-session.logpath'
    if (Test-Path -LiteralPath $marker) {
        $existing = (Get-Content -LiteralPath $marker -Raw -ErrorAction SilentlyContinue).Trim()
        if ($existing -and (Test-Path -LiteralPath $existing)) { return $existing }
    }
    $path = Join-Path $logsDir ("opti-{0}.log" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
    '' | Set-Content -LiteralPath $path -Encoding UTF8
    Set-Content -LiteralPath $marker -Value $path -Encoding UTF8
    return $path
}

function Get-OptiProgressPath {
    param([string]$BaseDir = $(Get-OptiBaseDir))
    $logsDir = Join-Path $BaseDir 'logs'
    if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
    Join-Path $logsDir 'job-progress.json'
}

function Write-OptiProgress {
    param(
        [int]$Percent = 0,
        [string]$Phase = '',
        [string]$Detail = '',
        [bool]$Done = $false,
        [string]$ErrorMessage = $null
    )
    $Path = $Global:OptiProgressPath
    if (-not $Path) { return }
    $obj = [ordered]@{
        percent   = [Math]::Max(0, [Math]::Min(100, [int]$Percent))
        phase     = [string]$Phase
        detail    = [string]$Detail
        done      = [bool]$Done
        error     = $ErrorMessage
        updatedAt = (Get-Date).ToString('o')
    }
    try {
        $json = ($obj | ConvertTo-Json -Compress)
        [System.IO.File]::WriteAllText($Path, $json, [System.Text.UTF8Encoding]::new($false))
    } catch { }
}
