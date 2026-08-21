# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Health.ps1 — gaming readiness score

function Get-OptiRamInfo {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $total = [long]$os.TotalVisibleMemorySize * 1KB
        $free = [long]$os.FreePhysicalMemory * 1KB
        $usedPct = if ($total -gt 0) { [math]::Round((($total - $free) / $total) * 100, 1) } else { 0 }
        return @{ totalBytes = $total; freeBytes = $free; usedPercent = $usedPct }
    } catch {
        return @{ totalBytes = 0; freeBytes = 0; usedPercent = 0 }
    }
}

function Get-OptiDiskInfo {
    $disks = @()
    try {
        Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
            $size = [long]$_.Size
            $free = [long]$_.FreeSpace
            $usedPct = if ($size -gt 0) { [math]::Round((($size - $free) / $size) * 100, 1) } else { 0 }
            $disks += @{
                name        = $_.DeviceID
                sizeBytes   = $size
                freeBytes   = $free
                usedPercent = $usedPct
                freeLabel   = (Format-OptiSize $free)
            }
        }
    } catch { }
    return $disks
}

function Get-OptiCpuLoadSample {
    try {
        $c = Get-CimInstance Win32_Processor | Select-Object -First 1
        $v = [int]$c.LoadPercentage
        if ($v -lt 0) { return 0 }
        return $v
    } catch { return 0 }
}

function Get-OptiCpuLoad {
    param(
        [int]$Samples = 4,
        [int]$DelayMs = 400
    )
    $readings = @()
    for ($i = 0; $i -lt $Samples; $i++) {
        $readings += Get-OptiCpuLoadSample
        if ($i -lt ($Samples - 1)) { Start-Sleep -Milliseconds $DelayMs }
    }
    if ($readings.Count -eq 0) { return 0 }
    return [int][math]::Round(($readings | Measure-Object -Average).Average)
}

function Wait-OptiMetricsSettle {
    param([int]$Seconds = 3)
    Start-Sleep -Seconds $Seconds
}

function Get-OptiPowerScore {
    param([string]$PowerName)
    if ("$PowerName" -match '(?i)High|Ultimate|Haute\s*perf|Hautes\s*perf|Performances\s*maximales|Performances\s*optimales|Performances\s*élevées|Performances\s*elevees|Maximale') {
        return 100
    }
    return 55
}

function Get-OptiPowerSchemeName {
    try {
        $out = powercfg /getactivescheme 2>$null
        if ("$out" -match '\((.+?)\)') { return $Matches[1].Trim() }
        return [string]$out
    } catch { return 'Unknown' }
}

function Get-OptiGameModeState {
    try {
        $v = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -ErrorAction SilentlyContinue
        if ($null -ne $v.AutoGameModeEnabled) { return [int]$v.AutoGameModeEnabled -eq 1 }
    } catch { }
    return $true # default on modern Windows
}

function Get-OptiGamingHealth {
    param([switch]$SettleFirst)

    if ($SettleFirst) {
        Write-OptiProgress -Percent 8 -Phase 'Santé' -Detail 'Stabilisation...'
        Wait-OptiMetricsSettle -Seconds 3
    }

    Write-OptiProgress -Percent 10 -Phase 'Santé' -Detail 'RAM...'
    $ram = Get-OptiRamInfo
    Write-OptiProgress -Percent 30 -Phase 'Santé' -Detail 'Disques...'
    $disks = @(Get-OptiDiskInfo)
    Write-OptiProgress -Percent 50 -Phase 'Santé' -Detail 'CPU...'
    $cpu = if ($SettleFirst) { Get-OptiCpuLoad -Samples 5 -DelayMs 500 } else { Get-OptiCpuLoad }
    Write-OptiProgress -Percent 70 -Phase 'Santé' -Detail 'Power / Game Mode...'
    $power = Get-OptiPowerSchemeName
    $gameMode = Get-OptiGameModeState

    $sysDisk = $disks | Where-Object { $_.name -eq "$($env:SystemDrive)" } | Select-Object -First 1
    $diskFreeScore = 100
    if ($sysDisk) {
        $diskFreeScore = [math]::Max(0, 100 - [int]$sysDisk.usedPercent)
    }
    $ramScore = [math]::Max(0, 100 - [int]$ram.usedPercent)
    $cpuScore = [math]::Max(0, 100 - $cpu)
    $powerScore = Get-OptiPowerScore -PowerName $power
    $gmScore = if ($gameMode) { 100 } else { 40 }

    $score = [int][math]::Round(($ramScore * 0.25) + ($diskFreeScore * 0.2) + ($cpuScore * 0.2) + ($powerScore * 0.2) + ($gmScore * 0.15))

    # Grade: readiness label (not FPS). Higher = PC more ready to play right now.
    $grade = 'poor'
    $labelFr = 'Faible'
    $labelEn = 'Poor'
    if ($score -ge 80) {
        $grade = 'excellent'; $labelFr = 'Excellent'; $labelEn = 'Excellent'
    } elseif ($score -ge 60) {
        $grade = 'good'; $labelFr = 'Bon'; $labelEn = 'Good'
    } elseif ($score -ge 40) {
        $grade = 'fair'; $labelFr = 'Moyen'; $labelEn = 'Fair'
    }

    $stats = Get-OptiSessionStats
    $powerOk = $powerScore -ge 100
    $gameModeOk = [bool]$gameMode
    $ramOk = [int]$ram.usedPercent -lt 85
    $cpuOk = $cpu -lt 85
    $diskOk = if ($sysDisk) { [int]$sysDisk.usedPercent -lt 90 } else { $true }

    return @{
        score       = $score
        grade       = $grade
        labelFr     = $labelFr
        labelEn     = $labelEn
        ram         = $ram
        disks       = $disks
        cpuLoad     = $cpu
        powerPlan   = $power
        gameMode    = $gameMode
        breakdown   = @{
            ram   = $ramScore
            disk  = $diskFreeScore
            cpu   = $cpuScore
            power = $powerScore
            game  = $gmScore
        }
        readiness   = @{
            powerOk    = $powerOk
            gameModeOk = $gameModeOk
            ramOk      = $ramOk
            cpuOk      = $cpuOk
            diskOk     = $diskOk
        }
        sessions    = $stats
        admin       = [bool](Test-OptiAdmin)
    }
}

function Get-OptiLastScorePath {
    Join-Path (Get-OptiDataDir) 'last-score.json'
}

function Get-OptiLastScoreSnapshot {
    $path = Get-OptiLastScorePath
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try {
        return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
    } catch { return $null }
}

function Save-OptiScoreSnapshot {
    param(
        [int]$Score,
        [string]$Grade,
        [string]$LabelFr,
        [string]$Context = 'manual'
    )
    $obj = [ordered]@{
        score     = $Score
        grade     = $Grade
        labelFr   = $LabelFr
        context   = $Context
        savedAt   = (Get-Date).ToString('o')
    }
    $path = Get-OptiLastScorePath
    [System.IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))
    return $obj
}
