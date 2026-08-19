# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Cleanup.ps1 — gaming caches (GPU / launchers)

function Get-OptiCleanupTargets {
    $local = $env:LOCALAPPDATA
    $localLow = Join-Path $env:USERPROFILE 'AppData\LocalLow'
    $roaming = $env:APPDATA
    $targets = @(
        @{ id = 'nvidia_dx'; name = 'NVIDIA DXCache'; path = (Join-Path $local 'NVIDIA\DXCache'); risk = 'safe' }
        @{ id = 'nvidia_gl'; name = 'NVIDIA GLCache'; path = (Join-Path $local 'NVIDIA\GLCache'); risk = 'safe' }
        @{ id = 'amd_dx'; name = 'AMD DXCache'; path = (Join-Path $local 'AMD\DxCache'); risk = 'safe' }
        @{ id = 'amd_gl'; name = 'AMD GLCache'; path = (Join-Path $local 'AMD\GLCache'); risk = 'safe' }
        @{ id = 'intel_shader'; name = 'Intel Shader Cache'; path = (Join-Path $local 'Intel\ShaderCache'); risk = 'safe' }
        @{ id = 'd3ds_shader'; name = 'D3DSCache'; path = (Join-Path $local 'D3DSCache'); risk = 'safe' }
        @{ id = 'steam_html'; name = 'Steam HTML cache'; path = (Join-Path $local 'Steam\htmlcache'); risk = 'safe' }
        @{ id = 'steam_shader'; name = 'Steam shader cache'; path = (Join-Path $local 'Steam\steamapps\shadercache'); risk = 'safe' }
        @{ id = 'epic_cache'; name = 'Epic cache'; path = (Join-Path $local 'EpicGamesLauncher\Saved\webcache'); risk = 'safe' }
        @{ id = 'battle_cache'; name = 'Battle.net cache'; path = (Join-Path $local 'Battle.net\Cache'); risk = 'safe' }
        @{ id = 'discord_cache'; name = 'Discord cache'; path = (Join-Path $roaming 'discord\Cache'); risk = 'safe' }
        @{ id = 'temp_user'; name = 'Temp utilisateur'; path = $env:TEMP; risk = 'safe' }
    )
    # Extra paths from list
    foreach ($line in @(Get-OptiListLines -RelativeName 'game-cache-paths.txt')) {
        $expanded = [Environment]::ExpandEnvironmentVariables($line)
        if ($expanded) {
            $targets += @{ id = ("extra_{0}" -f ($targets.Count)); name = $expanded; path = $expanded; risk = 'safe' }
        }
    }
    return $targets
}

function Invoke-OptiCleanupScan {
    Write-OptiProgress -Percent 5 -Phase 'Cleanup' -Detail 'Scan...'
    $targets = @(Get-OptiCleanupTargets)
    $results = @()
    $total = [long]0
    $i = 0
    foreach ($t in $targets) {
        $i++
        Write-OptiProgress -Percent (5 + [int](90 * $i / [math]::Max(1, $targets.Count))) -Phase 'Cleanup' -Detail $t.name
        $exists = Test-Path -LiteralPath $t.path
        $bytes = if ($exists) { Get-OptiPathSizeBytes -Path $t.path } else { 0L }
        $total += $bytes
        $results += @{
            id      = $t.id
            name    = $t.name
            path    = $t.path
            exists  = $exists
            bytes   = $bytes
            size    = (Format-OptiSize $bytes)
            risk    = $t.risk
        }
    }
    return @{
        items = $results
        totalBytes = $total
        totalSize = (Format-OptiSize $total)
    }
}

function Invoke-OptiCleanupRun {
    param(
        [string[]]$Ids,
        [string]$LogPath
    )
    Write-OptiProgress -Percent 5 -Phase 'Cleanup' -Detail 'Nettoyage...'
    $targets = @(Get-OptiCleanupTargets)
    if ($Ids -and $Ids.Count -gt 0) {
        $targets = @($targets | Where-Object { $Ids -contains $_.id })
    }
    $freed = [long]0
    $cleaned = @()
    $errors = @()
    $i = 0
    foreach ($t in $targets) {
        $i++
        Write-OptiProgress -Percent (5 + [int](90 * $i / [math]::Max(1, $targets.Count))) -Phase 'Cleanup' -Detail $t.name
        if (-not (Test-Path -LiteralPath $t.path)) { continue }
        $before = Get-OptiPathSizeBytes -Path $t.path
        try {
            if ((Get-Item -LiteralPath $t.path -Force).PSIsContainer) {
                Get-ChildItem -LiteralPath $t.path -Force -ErrorAction SilentlyContinue | ForEach-Object {
                    Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                }
            } else {
                Remove-Item -LiteralPath $t.path -Force -ErrorAction SilentlyContinue
            }
            $after = Get-OptiPathSizeBytes -Path $t.path
            $delta = [math]::Max(0, $before - $after)
            $freed += $delta
            $cleaned += @{ id = $t.id; name = $t.name; freed = $delta; freedLabel = (Format-OptiSize $delta) }
            Write-OptiLog -Message ("Cleaned {0}: {1}" -f $t.name, (Format-OptiSize $delta)) -LogPath $LogPath -Level OK
        } catch {
            $errors += @{ id = $t.id; error = $_.Exception.Message }
            Write-OptiLog -Message ("Cleanup fail {0}: {1}" -f $t.name, $_.Exception.Message) -LogPath $LogPath -Level ERROR
        }
    }
    return @{
        Success = $true
        Message = ("Libéré {0}" -f (Format-OptiSize $freed))
        freedBytes = $freed
        freedSize = (Format-OptiSize $freed)
        cleaned = $cleaned
        errors = $errors
    }
}
