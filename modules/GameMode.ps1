#Requires -Version 5.1
# GameMode.ps1 — Game Mode, Game Bar/DVR, Focus Assist

function Get-OptiGameModeSettings {
    $gameMode = $true
    $gameBar = $true
    $dvr = $true
    try {
        $gm = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -ErrorAction SilentlyContinue
        if ($null -ne $gm.AutoGameModeEnabled) { $gameMode = [int]$gm.AutoGameModeEnabled -eq 1 }
    } catch { }
    try {
        $dvrKey = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -ErrorAction SilentlyContinue
        if ($null -ne $dvrKey.AppCaptureEnabled) { $gameBar = [int]$dvrKey.AppCaptureEnabled -eq 1; $dvr = $gameBar }
    } catch { }
    $focus = 0
    try {
        $fa = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CloudStore' -ErrorAction SilentlyContinue
        # Focus Assist via Settings registry (Windows 10/11)
        $qi = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\QuietHours' -ErrorAction SilentlyContinue
        if ($null -ne $qi.Enabled) { $focus = [int]$qi.Enabled }
    } catch { }
    return @{
        gameMode = $gameMode
        gameBar  = $gameBar
        gameDvr  = $dvr
        focusAssist = $focus
    }
}

function Set-OptiGameModeSettings {
    param(
        [bool]$GameMode = $true,
        [bool]$DisableGameBar = $true,
        [bool]$FocusAssist = $true,
        [string]$LogPath
    )
    $prev = Get-OptiGameModeSettings
    $null = New-OptiUndoSnapshot -Name 'gamemode' -Data @{
        gameMode = if ($prev.gameMode) { 1 } else { 0 }
        gameBar  = if ($prev.gameBar) { 1 } else { 0 }
        focusAssist = $prev.focusAssist
    }

    New-Item -Path 'HKCU:\Software\Microsoft\GameBar' -Force -ErrorAction SilentlyContinue | Out-Null
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value ([int]$GameMode) -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\GameBar' -Name 'AllowAutoGameMode' -Value ([int]$GameMode) -Type DWord -ErrorAction SilentlyContinue

    New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Force -ErrorAction SilentlyContinue | Out-Null
    $barVal = if ($DisableGameBar) { 0 } else { 1 }
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value $barVal -Type DWord -ErrorAction SilentlyContinue
    New-Item -Path 'HKCU:\System\GameConfigStore' -Force -ErrorAction SilentlyContinue | Out-Null
    Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value $barVal -Type DWord -ErrorAction SilentlyContinue

    if ($FocusAssist) {
        New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\QuietHours' -Force -ErrorAction SilentlyContinue | Out-Null
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\QuietHours' -Name 'Enabled' -Value 1 -Type DWord -ErrorAction SilentlyContinue
    }

    Write-OptiLog -Message "GameMode=$GameMode DisableGameBar=$DisableGameBar Focus=$FocusAssist" -LogPath $LogPath -Level OK
    return @{
        Success = $true
        Message = 'Paramètres Game Mode appliqués'
        settings = (Get-OptiGameModeSettings)
    }
}
