#Requires -Version 5.1
# Boost.ps1 — session boost: stop overlay processes (soft), restore list

function Get-OptiOverlayProcessNames {
    $fromList = @(Get-OptiListLines -RelativeName 'kill-overlays.txt')
    if ($fromList.Count -gt 0) { return $fromList }
    return @(
        'GameBar', 'GameBarFT', 'GameBarPresenceWriter', 'XboxPcAppFT'
        'NVIDIA Share', 'nvidiawebhelper', 'nvcontainer'
        'RadeonSoftware', 'AMDRSServ', 'AMDRSSrcExt'
        'Discord'  # optional — only when user opts; kept in list for opt-in
    )
}

function Get-OptiBoostStatus {
    $running = @()
    $names = @(Get-OptiListLines -RelativeName 'kill-overlays.txt')
    if ($names.Count -eq 0) {
        $names = @('GameBar', 'GameBarFT', 'GameBarPresenceWriter', 'NVIDIA Share', 'RadeonSoftware')
    }
    foreach ($n in $names) {
        Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
            $running += @{ Name = $_.ProcessName; Id = $_.Id; Path = $_.Path }
        }
    }
    $marker = Join-Path (Get-OptiDataDir) 'boost-active.json'
    $active = $false
    $snapshot = $null
    if (Test-Path -LiteralPath $marker) {
        $active = $true
        try { $snapshot = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
    }
    return @{ active = $active; overlays = $running; snapshot = $snapshot }
}

function Start-OptiBoostSession {
    param(
        [bool]$KillOverlays = $true,
        [bool]$IncludeDiscord = $false,
        [bool]$IncludeGpuOverlay = $false,
        [string]$LogPath
    )
    Write-OptiProgress -Percent 10 -Phase 'Boost' -Detail 'Préparation...'
    $stopped = @()
    $failed = @()
    $names = @(Get-OptiListLines -RelativeName 'kill-overlays.txt')
    if ($names.Count -eq 0) {
        $names = @('GameBar', 'GameBarFT', 'GameBarPresenceWriter', 'XboxPcAppFT', 'XboxApp')
    }
    if (-not $IncludeDiscord) {
        $names = @($names | Where-Object { $_ -notmatch '(?i)^discord' })
    }
    if (-not $IncludeGpuOverlay) {
        $names = @($names | Where-Object { $_ -notmatch '(?i)nvidia|radeon|amd|nvcontainer|AMDRS' })
    }

    if ($KillOverlays) {
        $i = 0
        foreach ($n in $names) {
            $i++
            Write-OptiProgress -Percent (10 + [int](70 * $i / [math]::Max(1, $names.Count))) -Phase 'Boost' -Detail "Stop $n..."
            Get-Process -Name $n -ErrorAction SilentlyContinue | ForEach-Object {
                try {
                    $info = @{ Name = $_.ProcessName; Id = $_.Id; Path = $_.Path }
                    Stop-Process -Id $_.Id -Force -ErrorAction Stop
                    $stopped += $info
                    Write-OptiLog -Message "Stopped $($info.Name) ($($info.Id))" -LogPath $LogPath -Level OK
                } catch {
                    $failed += @{ Name = $n; Error = $_.Exception.Message }
                }
            }
        }
    }

    $snap = @{
        startedAt = (Get-Date).ToString('o')
        stopped   = $stopped
    }
    $null = New-OptiUndoSnapshot -Name 'boost' -Data @{ suspended = $stopped }
    $marker = Join-Path (Get-OptiDataDir) 'boost-active.json'
    [System.IO.File]::WriteAllText($marker, ($snap | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))

    Write-OptiProgress -Percent 100 -Phase 'Boost' -Detail 'Actif' -Done $true
    return @{
        Success = $true
        Message = ("Boost actif — {0} processus arrêtés" -f $stopped.Count)
        stopped = $stopped
        failed  = $failed
    }
}

function Stop-OptiBoostSession {
    param([string]$LogPath)
    $marker = Join-Path (Get-OptiDataDir) 'boost-active.json'
    if (Test-Path -LiteralPath $marker) {
        Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
    }
    Write-OptiLog -Message 'Boost session ended (overlays not auto-restarted)' -LogPath $LogPath -Level INFO
    return @{
        Success = $true
        Message = 'Session boost terminée. Relance manuellement Discord/overlays si besoin.'
    }
}
