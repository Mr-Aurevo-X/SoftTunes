#Requires -Version 5.1
# Undo.ps1 — soft undo store under %LOCALAPPDATA%\Mr-Aurevo-X\Opti\undo\

function Get-OptiUndoDir {
    $dir = Join-Path (Get-OptiDataDir) 'undo'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return $dir
}

function New-OptiUndoSnapshot {
    param(
        [string]$Name,
        [hashtable]$Data
    )
    $dir = Get-OptiUndoDir
    $id = "{0}_{1}" -f (Get-Date -Format 'yyyyMMdd_HHmmss'), ($Name -replace '[^\w\-]', '_')
    $path = Join-Path $dir ("$id.json")
    $payload = [ordered]@{
        id        = $id
        name      = $Name
        createdAt = (Get-Date).ToString('o')
        data      = $Data
    }
    $json = $payload | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
    return @{ id = $id; path = $path }
}

function Get-OptiUndoList {
    $dir = Get-OptiUndoDir
    $items = @()
    Get-ChildItem -LiteralPath $dir -Filter '*.json' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
            try {
                $o = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                $summary = ''
                if ($null -ne $o.data) {
                    $keys = @($o.data.PSObject.Properties.Name | Select-Object -First 6)
                    if ($keys.Count -gt 0) { $summary = ($keys -join ', ') }
                }
                $items += @{
                    id        = $o.id
                    name      = $o.name
                    createdAt = $o.createdAt
                    path      = $_.FullName
                    summary   = $summary
                }
            } catch { }
        }
    return $items
}

function Get-OptiUndoSnapshot {
    param([string]$Id)
    $dir = Get-OptiUndoDir
    $path = Join-Path $dir ("$Id.json")
    if (-not (Test-Path -LiteralPath $path)) {
        $match = Get-ChildItem -LiteralPath $dir -Filter '*.json' -File -ErrorAction SilentlyContinue |
            Where-Object { $_.BaseName -eq $Id -or $_.Name -like "$Id*" } |
            Select-Object -First 1
        if ($match) { $path = $match.FullName }
    }
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Invoke-OptiUndo {
    param(
        [string]$Id,
        [string]$LogPath
    )
    $snap = Get-OptiUndoSnapshot -Id $Id
    if (-not $snap) { return @{ Success = $false; Message = "Snapshot introuvable: $Id" } }

    $kind = [string]$snap.name
    $data = $snap.data
    $restored = @()

    switch -Wildcard ($kind) {
        'power*' {
            if ($data.activeScheme) {
                powercfg /setactive ([string]$data.activeScheme) 2>$null
                $restored += "power:$($data.activeScheme)"
            }
        }
        'visual*' {
            if ($data.visualFx) {
                Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value ([int]$data.visualFx) -ErrorAction SilentlyContinue
                $restored += 'visualFx'
            }
            if ($null -ne $data.animations) {
                Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop\WindowMetrics' -Name 'MinAnimate' -Value ([string]$data.animations) -ErrorAction SilentlyContinue
                $restored += 'animations'
            }
            if ($null -ne $data.transparency) {
                Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name 'EnableTransparency' -Value ([int]$data.transparency) -ErrorAction SilentlyContinue
                $restored += 'transparency'
            }
        }
        'network*' {
            if ($data.dnsAdapters) {
                foreach ($a in @($data.dnsAdapters)) {
                    try {
                        Set-DnsClientServerAddress -InterfaceIndex ([int]$a.index) -ResetServerAddresses -ErrorAction SilentlyContinue
                        $restored += "dns:$($a.index)"
                    } catch { }
                }
            }
        }
        'services*' {
            foreach ($s in @($data.services)) {
                try {
                    Set-Service -Name $s.Name -StartupType $s.StartType -ErrorAction SilentlyContinue
                    if ($s.Status -eq 'Running') { Start-Service -Name $s.Name -ErrorAction SilentlyContinue }
                    elseif ($s.Status -eq 'Stopped') { Stop-Service -Name $s.Name -Force -ErrorAction SilentlyContinue }
                    $restored += "svc:$($s.Name)"
                } catch { }
            }
        }
        'boost*' {
            $noted = @()
            foreach ($p in @($data.suspended)) {
                try {
                    $proc = Get-Process -Id ([int]$p.Id) -ErrorAction SilentlyContinue
                    if ($proc) { $noted += "seen:$($p.Name)" }
                    else { $noted += "gone:$($p.Name)" }
                } catch { }
            }
            if ($data.focusAssist) {
                Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount' -Name 'OptiFocusPrev' -Value ([string]$data.focusAssist) -ErrorAction SilentlyContinue
            }
            Write-OptiLog -Message ("Undo boost partial: {0}" -f ($noted -join ', ')) -LogPath $LogPath -Level WARN
            return @{
                Success = $true
                Partial = $true
                Message = 'Undo boost partiel: overlays non relances automatiquement'
                Restored = $noted
                Id = $Id
            }
        }
        'gamemode*' {
            if ($null -ne $data.gameMode) {
                New-Item -Path 'HKCU:\Software\Microsoft\GameBar' -Force -ErrorAction SilentlyContinue | Out-Null
                Set-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value ([int]$data.gameMode) -ErrorAction SilentlyContinue
                $restored += 'gameMode'
            }
            if ($null -ne $data.gameBar) {
                Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value ([int]$data.gameBar) -ErrorAction SilentlyContinue
                $restored += 'gameBar'
            }
        }
        'softperf*' {
            $restored += @(Restore-OptiSoftPerfFromData -Data $data -LogPath $LogPath)
        }
        'softoc*' {
            if (Get-Command Restore-OptiSoftOcFromData -ErrorAction SilentlyContinue) {
                $restored += @(Restore-OptiSoftOcFromData -Data $data -LogPath $LogPath)
            }
        }
        'startup*' {
            if ($data.hive -and $data.name -and $null -ne $data.command) {
                try {
                    if (-not (Test-Path -LiteralPath ([string]$data.hive))) {
                        New-Item -Path ([string]$data.hive) -Force -ErrorAction SilentlyContinue | Out-Null
                    }
                    Set-ItemProperty -Path ([string]$data.hive) -Name ([string]$data.name) -Value ([string]$data.command) -ErrorAction Stop
                    $restored += "startup:$($data.name)"
                } catch {
                    Write-OptiLog -Message ("Undo startup fail: {0}" -f $_.Exception.Message) -LogPath $LogPath -Level WARN
                }
            }
            if ($data.folderFile -and $data.folderDest) {
                try {
                    $src = [string]$data.folderFile
                    $dest = [string]$data.folderDest
                    if ((Test-Path -LiteralPath $src) -and -not (Test-Path -LiteralPath $dest)) {
                        Move-Item -LiteralPath $src -Destination $dest -Force -ErrorAction Stop
                        $restored += 'startupFolder'
                    }
                } catch { }
            }
        }
        'priority-mmcs*' {
            $path = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
            $games = Join-Path $path 'Tasks\Games'
            if ($null -ne $data.SystemResponsiveness) {
                try {
                    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
                    Set-ItemProperty -Path $path -Name 'SystemResponsiveness' -Value ([int]$data.SystemResponsiveness) -Type DWord -ErrorAction Stop
                    $restored += 'SystemResponsiveness'
                } catch {
                    Write-OptiLog -Message ("Undo MMCS fail: {0}" -f $_.Exception.Message) -LogPath $LogPath -Level WARN
                }
            }
            try {
                if (-not (Test-Path $games)) { New-Item -Path $games -Force | Out-Null }
                if ($null -ne $data.GamesGpuPriority) {
                    Set-ItemProperty -Path $games -Name 'GPU Priority' -Value ([int]$data.GamesGpuPriority) -Type DWord -ErrorAction SilentlyContinue
                    $restored += 'GamesGpuPriority'
                }
                if ($null -ne $data.GamesPriority) {
                    Set-ItemProperty -Path $games -Name 'Priority' -Value ([int]$data.GamesPriority) -Type DWord -ErrorAction SilentlyContinue
                    $restored += 'GamesPriority'
                }
                if ($null -ne $data.GamesScheduling -and [string]$data.GamesScheduling -ne '') {
                    Set-ItemProperty -Path $games -Name 'Scheduling Category' -Value ([string]$data.GamesScheduling) -ErrorAction SilentlyContinue
                    $restored += 'GamesScheduling'
                }
            } catch {
                Write-OptiLog -Message ("Undo MMCS Games fail: {0}" -f $_.Exception.Message) -LogPath $LogPath -Level WARN
            }
        }
        default {
            Write-OptiLog -Message "Undo kind non gere: $kind" -LogPath $LogPath -Level WARN
            return @{ Success = $false; Message = "Undo non gere pour: $kind"; Restored = @(); Id = $Id }
        }
    }

    Write-OptiLog -Message ("Undo ${Id}: {0}" -f ($restored -join ', ')) -LogPath $LogPath -Level OK
    return @{ Success = $true; Message = "Annulation appliquee"; Restored = $restored; Id = $Id }
}
