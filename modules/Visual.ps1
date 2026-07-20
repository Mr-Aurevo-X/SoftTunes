#Requires -Version 5.1
# Visual.ps1 — reduce Windows visual effects for gaming

function Get-OptiVisualSettings {
    $visualFx = 0
    $animations = '1'
    $transparency = 1
    try {
        $v = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -ErrorAction SilentlyContinue
        if ($null -ne $v.VisualFXSetting) { $visualFx = [int]$v.VisualFXSetting }
    } catch { }
    try {
        $a = Get-ItemProperty -Path 'HKCU:\Control Panel\Desktop\WindowMetrics' -ErrorAction SilentlyContinue
        if ($null -ne $a.MinAnimate) { $animations = [string]$a.MinAnimate }
    } catch { }
    try {
        $t = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -ErrorAction SilentlyContinue
        if ($null -ne $t.EnableTransparency) { $transparency = [int]$t.EnableTransparency }
    } catch { }
    return @{ visualFx = $visualFx; animations = $animations; transparency = $transparency }
}

function Set-OptiVisualGaming {
    param(
        [bool]$ReduceEffects = $true,
        [bool]$DisableAnimations = $true,
        [bool]$DisableTransparency = $true,
        [string]$LogPath
    )
    $prev = Get-OptiVisualSettings
    $null = New-OptiUndoSnapshot -Name 'visual' -Data $prev

    if ($ReduceEffects) {
        New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Force -ErrorAction SilentlyContinue | Out-Null
        # 2 = best performance
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90, 0x12, 0x03, 0x80, 0x10, 0x00, 0x00, 0x00)) -Type Binary -ErrorAction SilentlyContinue
    }
    if ($DisableAnimations) {
        Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop\WindowMetrics' -Name 'MinAnimate' -Value '0' -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'MenuShowDelay' -Value '0' -ErrorAction SilentlyContinue
    }
    if ($DisableTransparency) {
        New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Force -ErrorAction SilentlyContinue | Out-Null
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name 'EnableTransparency' -Value 0 -Type DWord -ErrorAction SilentlyContinue
    }

    Write-OptiLog -Message 'Visual gaming applied' -LogPath $LogPath -Level OK
    return @{
        Success = $true
        Message = 'Effets visuels réduits (undo disponible)'
        settings = (Get-OptiVisualSettings)
        previous = $prev
    }
}
