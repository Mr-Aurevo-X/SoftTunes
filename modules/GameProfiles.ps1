#Requires -Version 5.1
# GameProfiles.ps1 — per-game profiles

function Get-OptiProfilesPath {
    Join-Path (Get-OptiDataDir) 'game-profiles.json'
}

function Get-OptiGameProfiles {
    $path = Get-OptiProfilesPath
    if (-not (Test-Path -LiteralPath $path)) { return @() }
    try {
        $o = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        return @($o)
    } catch { return @() }
}

function Save-OptiGameProfiles {
    param([object[]]$Profiles)
    $path = Get-OptiProfilesPath
    [System.IO.File]::WriteAllText($path, ($Profiles | ConvertTo-Json -Depth 8), [System.Text.UTF8Encoding]::new($false))
}

function Find-OptiGameExecutables {
    param([int]$Limit = 40)
    $found = @()
    $roots = @()
    $steam = 'HKCU:\Software\Valve\Steam'
    if (Test-Path $steam) {
        try {
            $sp = (Get-ItemProperty $steam).SteamPath
            if ($sp) { $roots += (Join-Path $sp 'steamapps\common') }
        } catch { }
    }
    foreach ($d in @('C:\Program Files\Epic Games', 'C:\Program Files (x86)\Epic Games', 'D:\Games', 'C:\Games')) {
        if (Test-Path $d) { $roots += $d }
    }
    foreach ($line in @(Get-OptiListLines -RelativeName 'game-exclusions.txt')) {
        # used as extra search roots if path-like
        if ($line -match '^[A-Za-z]:\\' -and (Test-Path $line)) { $roots += $line }
    }
    foreach ($root in $roots) {
        if ($found.Count -ge $Limit) { break }
        Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            if ($found.Count -ge $Limit) { return }
            $exe = Get-ChildItem -LiteralPath $_.FullName -Filter '*.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -notmatch '(?i)unins|setup|crash|helper|redist|vcredist|updater|launcher_uninstall' } |
                Select-Object -First 1
            if ($exe) {
                $found += @{
                    name = $_.Name
                    path = $exe.FullName
                    folder = $_.FullName
                }
            }
        }
    }
    return $found
}

function Upsert-OptiGameProfile {
    param(
        [string]$Name,
        [string]$ExePath,
        [hashtable]$Settings
    )
    $profiles = @([System.Collections.ArrayList]@(Get-OptiGameProfiles))
    $existing = $null
    for ($i = 0; $i -lt $profiles.Count; $i++) {
        if ([string]$profiles[$i].name -eq $Name -or [string]$profiles[$i].exePath -eq $ExePath) {
            $existing = $i
            break
        }
    }
    $entry = [ordered]@{
        name     = $Name
        exePath  = $ExePath
        settings = $Settings
        updatedAt = (Get-Date).ToString('o')
    }
    if ($null -ne $existing) {
        $profiles[$existing] = $entry
    } else {
        [void]$profiles.Add($entry)
    }
    Save-OptiGameProfiles -Profiles @($profiles)
    return $entry
}

function Invoke-OptiGameProfile {
    param(
        [string]$Name,
        [string]$LogPath,
        [bool]$Launch = $true
    )
    $profiles = @(Get-OptiGameProfiles)
    $p = $profiles | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if (-not $p) { return @{ Success = $false; Message = "Profil introuvable: $Name" } }

    Write-OptiProgress -Percent 10 -Phase 'Profil' -Detail $Name
    $s = $p.settings
    $steps = @()

    if ($s.power) {
        Write-OptiProgress -Percent 25 -Phase 'Profil' -Detail 'Power...'
        $r = Set-OptiPowerPlan -Profile ([string]$s.power) -LogPath $LogPath
        $steps += "power:$($r.Success)"
    }
    if ($s.gameMode -ne $false) {
        Write-OptiProgress -Percent 40 -Phase 'Profil' -Detail 'Game Mode...'
        $r = Set-OptiGameModeSettings -GameMode $true -DisableGameBar ([bool]$s.disableGameBar) -FocusAssist ([bool]$s.focusAssist) -LogPath $LogPath
        $steps += "gamemode:$($r.Success)"
    }
    if ($s.boost) {
        Write-OptiProgress -Percent 55 -Phase 'Profil' -Detail 'Boost...'
        $r = Start-OptiBoostSession -KillOverlays $true -IncludeDiscord ([bool]$s.killDiscord) -IncludeGpuOverlay ([bool]$s.killGpuOverlay) -LogPath $LogPath
        $steps += "boost:$($r.Success)"
    }
    if ($s.visual) {
        Write-OptiProgress -Percent 70 -Phase 'Profil' -Detail 'Visual...'
        $r = Set-OptiVisualGaming -LogPath $LogPath
        $steps += "visual:$($r.Success)"
    }

    if ($Launch -and $p.exePath -and (Test-Path -LiteralPath ([string]$p.exePath))) {
        Write-OptiProgress -Percent 85 -Phase 'Profil' -Detail 'Lancement...'
        try {
            Start-Process -FilePath ([string]$p.exePath) -WorkingDirectory ([IO.Path]::GetDirectoryName([string]$p.exePath))
            $steps += 'launch:ok'
        } catch {
            $steps += "launch:fail"
            Write-OptiLog -Message $_.Exception.Message -LogPath $LogPath -Level ERROR
        }
    }

    # remember last
    $last = Join-Path (Get-OptiDataDir) 'last-profile.json'
    @{ name = $Name; at = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content $last -Encoding UTF8

    return @{
        Success = $true
        Message = "Profil '$Name' appliqué"
        steps = $steps
        profile = $p
    }
}

function Get-OptiLastProfile {
    $last = Join-Path (Get-OptiDataDir) 'last-profile.json'
    if (-not (Test-Path $last)) { return $null }
    try { return Get-Content $last -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}
