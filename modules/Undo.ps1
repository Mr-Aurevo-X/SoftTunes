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
                $items += @{
                    id        = $o.id
                    name      = $o.name
                    createdAt = $o.createdAt
                    path      = $_.FullName
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
            foreach ($p in @($data.suspended)) {
                try {
                    $proc = Get-Process -Id ([int]$p.Id) -ErrorAction SilentlyContinue
                    if ($proc) {
                        # Best-effort: cannot truly unsuspend without NtResume; mark only
                        $restored += "proc:$($p.Name)"
                    }
                } catch { }
            }
            if ($data.focusAssist) {
                Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore\Store\DefaultAccount' -Name 'OptiFocusPrev' -Value ([string]$data.focusAssist) -ErrorAction SilentlyContinue
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
        default {
            Write-OptiLog -Message "Undo kind non géré: $kind" -LogPath $LogPath -Level WARN
        }
    }

    Write-OptiLog -Message ("Undo ${Id}: {0}" -f ($restored -join ', ')) -LogPath $LogPath -Level OK
    return @{ Success = $true; Message = "Annulation appliquée"; Restored = $restored; Id = $Id }
}
