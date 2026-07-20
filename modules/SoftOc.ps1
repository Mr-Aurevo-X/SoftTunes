#Requires -Version 5.1
# SoftOc.ps1 — soft NVIDIA clock locks (bounded) + Afterburner bridge (no voltage curves)

function Get-OptiAfterburnerPath {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'MSI Afterburner\MSIAfterburner.exe')
        (Join-Path ${env:ProgramFiles} 'MSI Afterburner\MSIAfterburner.exe')
        (Join-Path ${env:ProgramFiles(x86)} 'MSI Afterburner\MSIAfterburner.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    $cmd = Get-Command MSIAfterburner.exe -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return [string]$cmd.Source }
    return $null
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

function Get-OptiSoftOc {
    $gpu = Get-OptiGpuInfo
    $clk = Get-OptiNvidiaClockInfo
    $pl = Get-OptiNvidiaPowerInfo
    $ab = Get-OptiAfterburnerPath
    return @{
        disclaimer = 'Soft OC only (NVIDIA clock locks + PL). Not undervolt. Use Afterburner for UV curves.'
        gpu        = $gpu
        nvidia     = $clk
        power      = $pl
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

    $before = @{
        coreCurrent = $clk.coreCurrent
        memCurrent  = $clk.memCurrent
        coreMax     = $clk.coreMax
        memMax      = $clk.memMax
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
            $null = & $clk.path -rgc 2>&1
            $null = & $clk.path -rmc 2>&1
            Write-OptiLog -Message 'NVIDIA clocks reset (rgc/rmc)' -LogPath $LogPath -Level OK
            return @{
                Success = $true
                Message = 'NVIDIA clocks reset to default'
                preset  = $Preset
                nvidia  = (Get-OptiNvidiaClockInfo)
            }
        }

        $baseCore = [int][math]::Round([double]$clk.coreCurrent)
        if ($baseCore -le 0) { $baseCore = [int][math]::Round([double]$clk.coreMax * 0.9) }
        $targetCore = [math]::Min([int]$clk.coreMax, $baseCore + $offset)
        $targetCore = [math]::Max(300, $targetCore)

        # Lock graphics clock to a narrow band around target (soft OC)
        $lo = [math]::Max(300, $targetCore - 25)
        $hi = [math]::Min([int]$clk.coreMax, $targetCore + 25)
        $null = & $clk.path -lgc "$lo,$hi" 2>&1

        if ($null -ne $clk.memMax -and $clk.memMax -gt 0 -and $offset -gt 0) {
            $baseMem = [int][math]::Round([double]$clk.memCurrent)
            if ($baseMem -le 0) { $baseMem = [int][math]::Round([double]$clk.memMax * 0.9) }
            $memOff = [math]::Min(100, $offset)
            $tm = [math]::Min([int]$clk.memMax, $baseMem + $memOff)
            $mlo = [math]::Max(400, $tm - 50)
            $mhi = [math]::Min([int]$clk.memMax, $tm + 50)
            $null = & $clk.path -lmc "$mlo,$mhi" 2>&1
        }

        Write-OptiLog -Message ("NVIDIA soft OC core ~{0} MHz ({1})" -f $targetCore, $Preset) -LogPath $LogPath -Level OK
        return @{
            Success   = $true
            Message   = ("Soft OC applied: core ~{0} MHz ({1})" -f $targetCore, $Preset)
            preset    = $Preset
            targetCore = $targetCore
            nvidia    = (Get-OptiNvidiaClockInfo)
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

function Restore-OptiSoftOcFromData {
    param($Data, [string]$LogPath)
    $restored = @()
    $smi = Get-OptiNvidiaSmiPath
    if (-not $smi) { return $restored }
    try {
        $null = & $smi -rgc 2>&1
        $null = & $smi -rmc 2>&1
        $restored += 'nvidiaClocksReset'
    } catch { }
    Write-OptiLog -Message ("SoftOc restore: {0}" -f ($restored -join ', ')) -LogPath $LogPath -Level OK
    return $restored
}
