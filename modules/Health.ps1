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

function Get-OptiCpuLoad {
    try {
        $c = Get-CimInstance Win32_Processor | Select-Object -First 1
        return [int]($c.LoadPercentage)
    } catch { return 0 }
}

function Get-OptiPowerSchemeName {
    try {
        $out = powercfg /getactivescheme 2>$null
        if ($out -match '\((.+)\)$') { return $Matches[1].Trim() }
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
    Write-OptiProgress -Percent 10 -Phase 'Santé' -Detail 'RAM...'
    $ram = Get-OptiRamInfo
    Write-OptiProgress -Percent 30 -Phase 'Santé' -Detail 'Disques...'
    $disks = @(Get-OptiDiskInfo)
    Write-OptiProgress -Percent 50 -Phase 'Santé' -Detail 'CPU...'
    $cpu = Get-OptiCpuLoad
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
    $powerScore = if ($power -match 'High|Ultimate|Hautes|Performances maximales|Performances élevées') { 100 } else { 55 }
    $gmScore = if ($gameMode) { 100 } else { 40 }

    $score = [int][math]::Round(($ramScore * 0.25) + ($diskFreeScore * 0.2) + ($cpuScore * 0.2) + ($powerScore * 0.2) + ($gmScore * 0.15))

    $stats = Get-OptiSessionStats

    return @{
        score       = $score
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
        sessions    = $stats
        admin       = [bool](Test-OptiAdmin)
    }
}
