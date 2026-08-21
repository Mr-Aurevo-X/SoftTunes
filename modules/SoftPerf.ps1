# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# SoftPerf.ps1 — soft OS tweaks + optional NVIDIA power limit (no clocks/voltage)

$script:OptiSubProcessor = '54533251-82be-4824-96c1-47b60b740d00'
$script:OptiProcThrottleMin = '893dee8e-2bef-41e0-89c6-b55d0929964c'
$script:OptiProcThrottleMax = 'bc5038f7-23e0-4960-96da-33abaf5935ec'
$script:OptiPerfBoostMode = 'be337238-0d82-4146-a960-4f3749d470c7'
$script:OptiSubPciExpress = '501a4dda-2278-4af9-9c4e-f6f2d1d1b2d0'
$script:OptiAspm = 'ee12f906-d277-404b-b6da-e5fa1a576df5'
$script:OptiHagsPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'

function Get-OptiSoftPerfStatePath {
    Join-Path (Get-OptiDataDir) 'softperf-state.json'
}

function Read-OptiSoftPerfState {
    $path = Get-OptiSoftPerfStatePath
    if (-not (Test-Path -LiteralPath $path)) { return @{} }
    try {
        $st = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $ht = @{}
        if ($st) {
            $st.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        }
        return $ht
    } catch {
        return @{}
    }
}

function Write-OptiSoftPerfState {
    param([hashtable]$Patch)
    $path = Get-OptiSoftPerfStatePath
    $ht = Read-OptiSoftPerfState
    foreach ($k in @($Patch.Keys)) { $ht[$k] = $Patch[$k] }
    $ht['savedAt'] = (Get-Date).ToString('o')
    $json = ($ht | ConvertTo-Json -Compress)
    [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Resolve-OptiPlPreset {
    param($nv, [string]$LastPreset)
    if (-not $nv -or -not $nv.available) { return $null }
    $cur = [double]$nv.currentPl
    $stock = [double]$(if ($null -ne $nv.stockPl) { $nv.stockPl } else { $nv.defaultPl })
    $max = [double]$nv.maxPl
    $min = [double]$nv.minPl
    if ($null -eq $cur -or $cur -le 0) { return $LastPreset }

    # Laptop GPUs often have stock == max — prefer last applied preset when watts match both.
    $stockEqMax = ($stock -gt 0 -and $max -gt 0 -and [math]::Abs($stock - $max) -le 1.5)
    if ($stockEqMax -and [math]::Abs($cur - $stock) -le 1.5) {
        if ($LastPreset -in @('stock', 'perf')) { return $LastPreset }
        return 'stock'
    }

    if ($null -ne $max -and $max -gt 0 -and [math]::Abs($cur - $max) -le 1.5) { return 'perf' }
    if ($null -ne $stock -and $stock -gt 0 -and [math]::Abs($cur - $stock) -le 1.5) { return 'stock' }
    if ($null -ne $stock -and $stock -gt 0 -and $cur -le ($stock * 0.93) + 0.5) { return 'eco' }
    if ($null -ne $min -and $min -gt 0 -and [math]::Abs($cur - $min) -le 1.5) { return 'eco' }
    if ($LastPreset -in @('eco', 'stock', 'perf')) { return $LastPreset }
    return $null
}

function Get-OptiNvidiaSmiPath {
    $cmd = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return [string]$cmd.Source }
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'NVIDIA Corporation\NVSMI\nvidia-smi.exe')
        (Join-Path ${env:ProgramFiles(x86)} 'NVIDIA Corporation\NVSMI\nvidia-smi.exe')
        (Join-Path $env:SystemRoot 'System32\nvidia-smi.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    return $null
}

function Invoke-OptiNvidiaSmi {
    param(
        [Parameter(Mandatory = $true)][string]$SmiPath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList
    )
    $out = & $SmiPath @ArgumentList 2>&1
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
    $text = (@($out) | ForEach-Object { "$_" }) -join "`n"
    return @{
        Ok       = ([int]$code -eq 0)
        ExitCode = [int]$code
        Output   = $text
    }
}

function Get-OptiPowerCfgAcIndex {
    param(
        [string]$SubGuid,
        [string]$SettingGuid
    )
    try {
        $raw = powercfg /query SCHEME_CURRENT $SubGuid $SettingGuid 2>$null
        foreach ($line in @($raw)) {
            # EN: Current AC Power Setting Index
            # FR: Index actuel du parametre de courant alternatif
            if ($line -match '(?:Current AC Power Setting Index|courant alternatif)\s*:?\s*0x([0-9a-fA-F]+)') {
                return [Convert]::ToInt32($Matches[1], 16)
            }
        }
    } catch { }
    return $null
}

function Set-OptiPowerCfgAcIndex {
    param(
        [string]$SubGuid,
        [string]$SettingGuid,
        [int]$Value
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $out = powercfg /setacvalueindex SCHEME_CURRENT $SubGuid $SettingGuid $Value 2>&1 | Out-String
        if ($out -match 'n.existe pas|does not exist|introuvable|invalid') { return $false }
        return $true
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Get-OptiHagsEnabled {
    try {
        if (-not (Test-Path -LiteralPath $script:OptiHagsPath)) { return $false }
        $v = Get-ItemProperty -Path $script:OptiHagsPath -Name 'HwSchMode' -ErrorAction SilentlyContinue
        if ($null -eq $v -or $null -eq $v.PSObject.Properties['HwSchMode']) { return $false }
        return ([int]$v.HwSchMode -eq 2)
    } catch {
        return $null
    }
}

function Set-OptiHagsEnabled {
    param([bool]$Enabled)
    New-Item -Path $script:OptiHagsPath -Force -ErrorAction SilentlyContinue | Out-Null
    $val = if ($Enabled) { 2 } else { 1 }
    Set-ItemProperty -Path $script:OptiHagsPath -Name 'HwSchMode' -Value $val -Type DWord -Force -ErrorAction SilentlyContinue
}

function Get-OptiGpuInfo {
    $gpus = @()
    $vendor = 'other'
    try {
        $ctrls = Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue
        foreach ($c in @($ctrls)) {
            $name = [string]$c.Name
            if (-not $name) { continue }
            $v = 'other'
            if ($name -match 'NVIDIA|GeForce|Quadro|RTX|GTX') { $v = 'nvidia' }
            elseif ($name -match 'AMD|Radeon|ATI') { $v = 'amd' }
            elseif ($name -match 'Intel') { $v = 'intel' }
            $gpus += @{ name = $name; vendor = $v }
            if ($vendor -eq 'other' -and $v -ne 'other') { $vendor = $v }
            elseif ($v -eq 'nvidia') { $vendor = 'nvidia' }
        }
    } catch { }
    return @{ vendor = $vendor; gpus = $gpus }
}

function ConvertTo-OptiPlDouble {
    param([string]$s)
    $n = 0.0
    $clean = ($s -replace '[^\d\.\-]', '')
    if ([double]::TryParse($clean, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
        return [math]::Round($n, 1)
    }
    return $null
}

function Get-OptiNvidiaPowerInfo {
    $smi = Get-OptiNvidiaSmiPath
    if (-not $smi) {
        return @{
            available = $false
            reason    = 'nvidia-smi not found'
            path      = $null
        }
    }
    try {
        $out = & $smi --query-gpu=name,power.limit,power.min_limit,power.max_limit,power.default_limit --format=csv,noheader,nounits 2>$null
        $line = (@($out) | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
        if (-not $line) {
            return @{ available = $false; reason = 'nvidia-smi returned empty'; path = $smi }
        }
        $parts = @($line.Split(',') | ForEach-Object { $_.Trim() })
        if ($parts.Count -lt 5) {
            return @{ available = $false; reason = 'unexpected nvidia-smi format'; path = $smi; raw = $line }
        }
        $current = ConvertTo-OptiPlDouble $parts[1]
        $min = ConvertTo-OptiPlDouble $parts[2]
        $max = ConvertTo-OptiPlDouble $parts[3]
        $def = ConvertTo-OptiPlDouble $parts[4]
        if ($null -eq $def) { $def = $current }

        $statePath = Get-OptiSoftPerfStatePath
        $savedStock = $null
        $lastPl = $null
        $st = Read-OptiSoftPerfState
        if ($null -ne $st.nvidiaStockPl) { $savedStock = [double]$st.nvidiaStockPl }
        if ($st.lastPlPreset) { $lastPl = [string]$st.lastPlPreset }

        $info = @{
            available = $true
            path      = $smi
            name      = $parts[0]
            currentPl = $current
            minPl     = $min
            maxPl     = $max
            defaultPl = $def
            stockPl   = $(if ($null -ne $savedStock) { $savedStock } else { $def })
            lastPlPreset = $lastPl
        }
        $info.activePlPreset = (Resolve-OptiPlPreset -nv $info -LastPreset $lastPl)
        return $info
    } catch {
        return @{ available = $false; reason = $_.Exception.Message; path = $smi }
    }
}

function Save-OptiSoftPerfNvidiaStock {
    param([double]$Watts)
    Write-OptiSoftPerfState -Patch @{ nvidiaStockPl = $Watts }
}

function Get-OptiSoftPerfSnapshotData {
    $nv = Get-OptiNvidiaPowerInfo
    return @{
        procMinAc       = (Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMin)
        procMaxAc       = (Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMax)
        boostModeAc     = (Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiPerfBoostMode)
        aspmAc          = (Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubPciExpress -SettingGuid $script:OptiAspm)
        hagsEnabled     = (Get-OptiHagsEnabled)
        nvidiaPl        = $(if ($nv.available) { $nv.currentPl } else { $null })
        nvidiaAvailable = [bool]$nv.available
    }
}

function Get-OptiSoftPerf {
    $gpu = Get-OptiGpuInfo
    $nv = Get-OptiNvidiaPowerInfo
    $procMin = Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMin
    $procMax = Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMax
    $boost = Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiPerfBoostMode
    $aspm = Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubPciExpress -SettingGuid $script:OptiAspm
    $hags = Get-OptiHagsEnabled
    $softOsActive = (
        ($null -ne $procMin -and $procMin -ge 100) -and
        ($null -ne $procMax -and $procMax -ge 100) -and
        ($aspm -eq 0 -or $null -eq $aspm)
    )

    return @{
        disclaimer = 'Not hardware undervolt/OC. Soft OS tweaks + optional NVIDIA power limit only.'
        gpu        = $gpu
        os         = @{
            procMinAc       = $procMin
            procMaxAc       = $procMax
            procMinSoft     = ($null -ne $procMin -and $procMin -ge 100)
            procMaxSoft     = ($null -ne $procMax -and $procMax -ge 100)
            boostModeAc     = $boost
            boostAggressive = ($boost -eq 2)
            boostAvailable  = ($null -ne $boost)
            aspmAc          = $aspm
            aspmOff         = ($aspm -eq 0)
            aspmAvailable   = ($null -ne $aspm)
            hagsEnabled     = $hags
            softOsActive    = [bool]$softOsActive
        }
        nvidia     = $nv
    }
}

function Set-OptiSoftPerfOs {
    param(
        [bool]$EnableSoftOs = $true,
        [bool]$SetHags = $false,
        [bool]$HagsEnabled = $true,
        [string]$LogPath
    )

    $before = Get-OptiSoftPerfSnapshotData
    $null = New-OptiUndoSnapshot -Name 'softperf-os' -Data $before
    $applied = @()
    $skipped = @()

    if ($EnableSoftOs) {
        if ((Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMin -Value 100) -and
            ((Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMin) -ge 100)) {
            $applied += 'procMinAc=100'
        } else { $skipped += 'procMinAc' }
        if ((Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMax -Value 100) -and
            ((Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMax) -ge 100)) {
            $applied += 'procMaxAc=100'
        } else { $skipped += 'procMaxAc' }
        if ((Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiPerfBoostMode -Value 2) -and
            ((Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiPerfBoostMode) -eq 2)) {
            $applied += 'boostMode=Aggressive'
        } else { $skipped += 'boostMode' }
        if ((Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubPciExpress -SettingGuid $script:OptiAspm -Value 0) -and
            ((Get-OptiPowerCfgAcIndex -SubGuid $script:OptiSubPciExpress -SettingGuid $script:OptiAspm) -eq 0)) {
            $applied += 'aspm=Off'
        } else { $skipped += 'aspm' }
        powercfg /setactive SCHEME_CURRENT 2>$null | Out-Null
    }

    if ($SetHags) {
        try {
            Set-OptiHagsEnabled -Enabled $HagsEnabled
            $applied += ("hags={0}" -f $HagsEnabled)
        } catch {
            $skipped += 'hags'
        }
    }

    Write-OptiLog -Message ('SoftPerf OS applied: {0}' -f ($applied -join ', ')) -LogPath $LogPath -Level OK
    if ($applied.Count -gt 0) {
        Write-OptiSoftPerfState -Patch @{ lastSoftOs = $true }
    }
    return @{
        Success = ($applied.Count -gt 0)
        Message = if ($applied.Count -gt 0) {
            ('Soft OS tweaks applied: {0}' -f ($applied -join ', '))
        } else {
            'No Soft OS setting available on this power plan'
        }
        applied = $applied
        skipped = $skipped
        before  = $before
        after   = (Get-OptiSoftPerfSnapshotData)
        note    = 'HAGS change may need a reboot to take effect'
    }
}

function Set-OptiNvidiaPowerLimit {
    param(
        [ValidateSet('eco', 'stock', 'perf')]
        [string]$Preset = 'stock',
        [string]$LogPath
    )

    $nv = Get-OptiNvidiaPowerInfo
    if (-not $nv.available) {
        return @{
            Success = $false
            Message = 'nvidia-smi not available - cannot set GPU power limit'
            nvidia  = $nv
        }
    }
    if ($null -eq $nv.currentPl -or $null -eq $nv.minPl -or $null -eq $nv.maxPl) {
        return @{ Success = $false; Message = 'Could not read NVIDIA power limits'; nvidia = $nv }
    }

    $statePath = Get-OptiSoftPerfStatePath
    $needStock = $true
    if (Test-Path -LiteralPath $statePath) {
        try {
            $st = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($null -ne $st.nvidiaStockPl) { $needStock = $false }
        } catch { }
    }
    if ($needStock) {
        Save-OptiSoftPerfNvidiaStock -Watts ([double]$nv.stockPl)
        $nv = Get-OptiNvidiaPowerInfo
    }

    $before = Get-OptiSoftPerfSnapshotData
    $null = New-OptiUndoSnapshot -Name 'softperf-pl' -Data $before

    $target = [double]$nv.currentPl
    $stock = [double]$(if ($null -ne $nv.stockPl -and $nv.stockPl -gt 0) { $nv.stockPl } else { $nv.defaultPl })
    switch ($Preset) {
        'eco' {
            $base = if ($stock -gt 0) { $stock } else { [double]$nv.currentPl }
            $target = [math]::Max([double]$nv.minPl, [math]::Round($base * 0.9, 0))
        }
        'stock' {
            $target = $stock
            if ($null -eq $target -or $target -le 0) { $target = [double]$nv.defaultPl }
        }
        'perf' {
            # Push toward board max (honest), not +5% of whatever is current.
            if ($null -ne $nv.maxPl -and [double]$nv.maxPl -gt 0) {
                $target = [double]$nv.maxPl
            } else {
                $base = if ($stock -gt 0) { $stock } else { [double]$nv.currentPl }
                $target = [math]::Round($base * 1.05, 0)
            }
        }
    }
    $target = [math]::Max([double]$nv.minPl, [math]::Min([double]$nv.maxPl, [math]::Round($target, 0)))

    try {
        $r = Invoke-OptiNvidiaSmi -SmiPath $nv.path -ArgumentList @('-pl', ([string][int]$target))
        if (-not $r.Ok) {
            return @{
                Success = $false
                Message = ("nvidia-smi -pl failed (exit {0})" -f $r.ExitCode)
                detail  = $r.Output
                nvidia  = $nv
            }
        }
        Write-OptiSoftPerfState -Patch @{ lastPlPreset = $Preset }
        $afterNv = Get-OptiNvidiaPowerInfo
        Write-OptiLog -Message ("NVIDIA PL set to {0}W ({1})" -f $target, $Preset) -LogPath $LogPath -Level OK
        return @{
            Success = $true
            Message = ("NVIDIA power limit set to {0}W ({1})" -f $target, $Preset)
            MessageFr = ("Limite GPU NVIDIA : {0}W ({1})" -f $target, $Preset)
            preset  = $Preset
            targetW = $target
            before  = $before
            nvidia  = $afterNv
            activePlPreset = $afterNv.activePlPreset
        }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message; nvidia = $nv }
    }
}

function Reset-OptiSoftPerf {
    param([string]$LogPath)

    $items = @(Get-OptiUndoList | Where-Object { $_.name -like 'softperf*' } | Select-Object -First 1)
    if ($items.Count -gt 0 -and $items[0].id) {
        return (Invoke-OptiUndo -Id ([string]$items[0].id) -LogPath $LogPath)
    }

    $nv = Get-OptiNvidiaPowerInfo
    if ($nv.available -and $null -ne $nv.stockPl) {
        try {
            $watts = [int][math]::Round([double]$nv.stockPl)
            $r = Invoke-OptiNvidiaSmi -SmiPath $nv.path -ArgumentList @('-pl', ([string]$watts))
            if (-not $r.Ok) {
                return @{ Success = $false; Message = ("nvidia-smi -pl failed (exit {0})" -f $r.ExitCode); detail = $r.Output }
            }
            return @{ Success = $true; Message = 'Restored NVIDIA stock power limit (no OS snapshot found)' }
        } catch {
            return @{ Success = $false; Message = $_.Exception.Message }
        }
    }
    return @{ Success = $false; Message = 'No SoftPerf undo snapshot found' }
}

function Restore-OptiSoftPerfFromData {
    param($Data, [string]$LogPath)
    $restored = @()
    if ($null -eq $Data) { return $restored }

    if ($null -ne $Data.procMinAc) {
        if (Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMin -Value ([int]$Data.procMinAc)) {
            $restored += 'procMinAc'
        }
    }
    if ($null -ne $Data.procMaxAc) {
        if (Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiProcThrottleMax -Value ([int]$Data.procMaxAc)) {
            $restored += 'procMaxAc'
        }
    }
    if ($null -ne $Data.boostModeAc) {
        if (Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubProcessor -SettingGuid $script:OptiPerfBoostMode -Value ([int]$Data.boostModeAc)) {
            $restored += 'boostModeAc'
        }
    }
    if ($null -ne $Data.aspmAc) {
        if (Set-OptiPowerCfgAcIndex -SubGuid $script:OptiSubPciExpress -SettingGuid $script:OptiAspm -Value ([int]$Data.aspmAc)) {
            $restored += 'aspmAc'
        }
    }
    if ($Data.procMinAc -or $Data.procMaxAc -or $Data.boostModeAc -or $Data.aspmAc) {
        powercfg /setactive SCHEME_CURRENT 2>$null | Out-Null
    }
    if ($null -ne $Data.hagsEnabled) {
        Set-OptiHagsEnabled -Enabled ([bool]$Data.hagsEnabled)
        $restored += 'hags'
    }
    if ($null -ne $Data.nvidiaPl -and $Data.nvidiaAvailable) {
        $smi = Get-OptiNvidiaSmiPath
        if ($smi) {
            try {
                $watts = [int][math]::Round([double]$Data.nvidiaPl)
                $r = Invoke-OptiNvidiaSmi -SmiPath $smi -ArgumentList @('-pl', ([string]$watts))
                if ($r.Ok) { $restored += 'nvidiaPl' }
            } catch { }
        }
    }
    Write-OptiLog -Message ("SoftPerf restore: {0}" -f ($restored -join ', ')) -LogPath $LogPath -Level OK
    return $restored
}
