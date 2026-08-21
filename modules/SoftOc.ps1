# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# SoftOc.ps1 — soft NVIDIA clock locks (bounded near board max) + Afterburner bridge

function Get-OptiAfterburnerPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'MSI Afterburner\MSIAfterburner.exe')
        (Join-Path ${env:ProgramFiles} 'MSI Afterburner\MSIAfterburner.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    $cmd = Get-Command MSIAfterburner.exe -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return [string]$cmd.Source }
    return $null
}

function Get-OptiAmdSoftwarePath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'AMD\CNext\CNext\RadeonSoftware.exe')
        (Join-Path ${env:ProgramFiles} 'AMD\CNext\CNext\AMDRSServ.exe')
        (Join-Path ${env:ProgramFiles(x86)} 'AMD\CNext\CNext\RadeonSoftware.exe')
        (Join-Path ${env:ProgramFiles} 'AMD\CNext\AMDRSServ.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    $cmd = Get-Command RadeonSoftware.exe -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return [string]$cmd.Source }
    return $null
}

function Get-OptiAmdGpuInfo {
    $gpu = Get-OptiGpuInfo
    $amdGpus = @(@($gpu.gpus) | Where-Object { $_.vendor -eq 'amd' })
    $path = Get-OptiAmdSoftwarePath
    return @{
        available = ($amdGpus.Count -gt 0)
        vendor    = 'amd'
        gpus      = @($amdGpus)
        name      = if ($amdGpus.Count -gt 0) { [string]$amdGpus[0].name } else { $null }
        software  = @{
            found = [bool]$path
            path  = $path
        }
        noteFr = "SoftTunes ne verrouille pas les horloges AMD (pas d'equivalent nvidia-smi). OS soft + HAGS + Adrenalin pour UV / courbes."
        noteEn = "SoftTunes does not lock AMD clocks (no nvidia-smi equivalent). Use OS soft + HAGS + Adrenalin for UV / curves."
    }
}

function Get-OptiNvidiaClockInfo {
    $smi = Get-OptiNvidiaSmiPath
    if (-not $smi) {
        return @{ available = $false; reason = 'nvidia-smi not found' }
    }
    try {
        $out = & $smi --query-gpu=name,clocks.current.graphics,clocks.max.graphics,clocks.current.memory,clocks.max.memory --format=csv,noheader,nounits 2>$null
        $line = (@($out) | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
        if (-not $line) {
            return @{ available = $false; reason = 'empty clock query'; path = $smi }
        }
        $parts = @($line.Split(',') | ForEach-Object { $_.Trim() })
        if ($parts.Count -lt 5) {
            return @{ available = $false; reason = 'unexpected clock format'; path = $smi; raw = $line }
        }
        return @{
            available   = $true
            path        = $smi
            name        = $parts[0]
            coreCurrent = (ConvertTo-OptiPlDouble $parts[1])
            coreMax     = (ConvertTo-OptiPlDouble $parts[2])
            memCurrent  = (ConvertTo-OptiPlDouble $parts[3])
            memMax      = (ConvertTo-OptiPlDouble $parts[4])
        }
    } catch {
        return @{ available = $false; reason = $_.Exception.Message }
    }
}

function Get-OptiSoftOcStatePath {
    Join-Path (Get-OptiDataDir) 'softoc-state.json'
}

function Read-OptiSoftOcState {
    $path = Get-OptiSoftOcStatePath
    if (-not (Test-Path -LiteralPath $path)) { return @{} }
    try {
        $st = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $ht = @{}
        if ($st) { $st.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value } }
        return $ht
    } catch { return @{} }
}

function Write-OptiSoftOcState {
    param([hashtable]$Patch)
    $path = Get-OptiSoftOcStatePath
    $ht = Read-OptiSoftOcState
    foreach ($k in @($Patch.Keys)) { $ht[$k] = $Patch[$k] }
    $ht['savedAt'] = (Get-Date).ToString('o')
    [System.IO.File]::WriteAllText($path, ($ht | ConvertTo-Json -Compress), [System.Text.UTF8Encoding]::new($false))
}

function Get-OptiSoftOc {
    $gpu = Get-OptiGpuInfo
    $clk = Get-OptiNvidiaClockInfo
    $pl = Get-OptiNvidiaPowerInfo
    $ab = Get-OptiAfterburnerPath
    $amd = Get-OptiAmdGpuInfo
    $st = Read-OptiSoftOcState
    $lastOc = if ($st.lastOcPreset) { [string]$st.lastOcPreset } else { $null }
    if ($clk -is [hashtable]) {
        $clk['lastOcPreset'] = $lastOc
        $clk['activeOcPreset'] = $lastOc
    }
    return @{
        disclaimer = 'Soft OC only (NVIDIA clock locks + PL). Not undervolt. Use Afterburner (NVIDIA) or Adrenalin (AMD) for UV curves.'
        gpu        = $gpu
        nvidia     = $clk
        power      = $pl
        amd        = $amd
        afterburner = @{
            found = [bool]$ab
            path  = $ab
        }
    }
}

function Set-OptiNvidiaClocks {
    param(
        [ValidateSet('stock', 'plus50', 'plus100')]
        [string]$Preset = 'stock',
        [string]$LogPath
    )
    $clk = Get-OptiNvidiaClockInfo
    if (-not $clk.available) {
        return @{ Success = $false; Message = 'nvidia-smi clocks unavailable'; nvidia = $clk }
    }
    if ($null -eq $clk.coreMax -or $clk.coreMax -le 0) {
        return @{ Success = $false; Message = 'Could not read max graphics clock'; nvidia = $clk }
    }

    $coreMax = [int][math]::Round([double]$clk.coreMax)
    $memMax = if ($null -ne $clk.memMax -and $clk.memMax -gt 0) { [int][math]::Round([double]$clk.memMax) } else { 0 }

    $before = @{
        coreCurrent = $clk.coreCurrent
        memCurrent  = $clk.memCurrent
        coreMax     = $coreMax
        memMax      = $memMax
    }
    $null = New-OptiUndoSnapshot -Name 'softoc-clocks' -Data $before

    $offset = 0
    switch ($Preset) {
        'stock' { $offset = 0 }
        'plus50' { $offset = 50 }
        'plus100' { $offset = 100 }
    }

    try {
        if ($Preset -eq 'stock') {
            $r1 = Invoke-OptiNvidiaSmi -SmiPath $clk.path -ArgumentList @('-rgc')
            $r2 = Invoke-OptiNvidiaSmi -SmiPath $clk.path -ArgumentList @('-rmc')
            if (-not $r1.Ok -or -not $r2.Ok) {
                return @{
                    Success = $false
                    Message = ("nvidia-smi reset failed (rgc={0} rmc={1})" -f $r1.ExitCode, $r2.ExitCode)
                    detail  = @($r1.Output, $r2.Output) -join ' | '
                    nvidia  = (Get-OptiNvidiaClockInfo)
                }
            }
            Write-OptiLog -Message 'NVIDIA clocks reset (rgc/rmc)' -LogPath $LogPath -Level OK
            Write-OptiSoftOcState -Patch @{ lastOcPreset = 'stock' }
            return @{
                Success = $true
                Message = 'NVIDIA clocks reset to default'
                MessageFr = 'Horloges NVIDIA remises au défaut'
                preset  = $Preset
                nvidia  = (Get-OptiNvidiaClockInfo)
            }
        }

        # Soft OC locks near board max — never from idle current.
        # plus50 => ~max-50 MHz, plus100 => ~max.
        $targetCore = [math]::Min($coreMax, [math]::Max(300, $coreMax - 100 + $offset))
        if ($targetCore -lt [math]::Round($coreMax * 0.5)) {
            return @{
                Success = $false
                Message = 'Refusing Soft OC: target too far below board max'
                nvidia  = $clk
            }
        }

        $lo = [math]::Max(300, $targetCore - 25)
        $hi = [math]::Min($coreMax, $targetCore + 25)
        if ($hi -lt $lo) { $hi = $lo }

        $rg = Invoke-OptiNvidiaSmi -SmiPath $clk.path -ArgumentList @('-lgc', "$lo,$hi")
        if (-not $rg.Ok) {
            return @{
                Success = $false
                Message = ("nvidia-smi -lgc failed (exit {0})" -f $rg.ExitCode)
                detail  = $rg.Output
                nvidia  = $clk
            }
        }

        $targetMem = $null
        $mlo = $null
        $mhi = $null
        if ($memMax -gt 0 -and $offset -gt 0) {
            $memOff = [math]::Min(100, $offset)
            $targetMem = [math]::Min($memMax, [math]::Max(400, $memMax - 100 + $memOff))
            $mlo = [math]::Max(400, $targetMem - 50)
            $mhi = [math]::Min($memMax, $targetMem + 50)
            if ($mhi -lt $mlo) { $mhi = $mlo }
            $rm = Invoke-OptiNvidiaSmi -SmiPath $clk.path -ArgumentList @('-lmc', "$mlo,$mhi")
            if (-not $rm.Ok) {
                return @{
                    Success = $false
                    Message = ("nvidia-smi -lmc failed (exit {0})" -f $rm.ExitCode)
                    detail  = $rm.Output
                    nvidia  = (Get-OptiNvidiaClockInfo)
                }
            }
        }

        Write-OptiLog -Message ("NVIDIA soft OC core lock {0}-{1} MHz ({2})" -f $lo, $hi, $Preset) -LogPath $LogPath -Level OK
        Write-OptiSoftOcState -Patch @{ lastOcPreset = $Preset }
        return @{
            Success    = $true
            Message    = ("Soft OC applied: core lock {0}-{1} MHz ({2})" -f $lo, $hi, $Preset)
            MessageFr  = ("Soft OC : verrou core {0}-{1} MHz ({2})" -f $lo, $hi, $Preset)
            preset     = $Preset
            targetCore = $targetCore
            coreLo     = $lo
            coreHi     = $hi
            nvidia     = (Get-OptiNvidiaClockInfo)
        }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message; nvidia = $clk }
    }
}

function Reset-OptiNvidiaClocks {
    param([string]$LogPath)
    return (Set-OptiNvidiaClocks -Preset 'stock' -LogPath $LogPath)
}

function Open-OptiAfterburner {
    $path = Get-OptiAfterburnerPath
    if (-not $path) {
        return @{
            Success = $false
            Message = 'MSI Afterburner not found'
            download = 'https://www.msi.com/Landing/afterburner'
        }
    }
    try {
        Start-Process -FilePath $path -ErrorAction Stop | Out-Null
        return @{ Success = $true; Message = 'Afterburner launched'; path = $path }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message; path = $path }
    }
}

function Open-OptiAmdSoftware {
    $path = Get-OptiAmdSoftwarePath
    if (-not $path) {
        return @{
            Success = $false
            Message = 'AMD Software (Adrenalin) not found'
            download = 'https://www.amd.com/en/support/download/drivers.html'
        }
    }
    try {
        Start-Process -FilePath $path -ErrorAction Stop | Out-Null
        return @{ Success = $true; Message = 'AMD Software launched'; path = $path }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message; path = $path }
    }
}

function Restore-OptiSoftOcFromData {
    param($Data, [string]$LogPath)
    $restored = @()
    $smi = Get-OptiNvidiaSmiPath
    if (-not $smi) { return $restored }

    # Undo Soft OC = unlock clocks (driver default boost). Optional prior band re-lock
    # only when snapshot explicitly stores priorLock=true with lo/hi.
    try {
        if ($null -ne $Data -and $Data.priorLock -eq $true -and $null -ne $Data.coreLo -and $null -ne $Data.coreHi) {
            $rg = Invoke-OptiNvidiaSmi -SmiPath $smi -ArgumentList @('-lgc', ("{0},{1}" -f [int]$Data.coreLo, [int]$Data.coreHi))
            if ($rg.Ok) { $restored += 'nvidiaCoreRelock' }
            if ($null -ne $Data.memLo -and $null -ne $Data.memHi) {
                $rm = Invoke-OptiNvidiaSmi -SmiPath $smi -ArgumentList @('-lmc', ("{0},{1}" -f [int]$Data.memLo, [int]$Data.memHi))
                if ($rm.Ok) { $restored += 'nvidiaMemRelock' }
            }
        } else {
            $r1 = Invoke-OptiNvidiaSmi -SmiPath $smi -ArgumentList @('-rgc')
            $r2 = Invoke-OptiNvidiaSmi -SmiPath $smi -ArgumentList @('-rmc')
            if ($r1.Ok -and $r2.Ok) {
                $restored += 'nvidiaClocksReset'
            } else {
                Write-OptiLog -Message ("SoftOc restore smi fail rgc={0} rmc={1}" -f $r1.ExitCode, $r2.ExitCode) -LogPath $LogPath -Level WARN
            }
        }
    } catch { }

    Write-OptiLog -Message ("SoftOc restore: {0}" -f ($restored -join ', ')) -LogPath $LogPath -Level OK
    return $restored
}
