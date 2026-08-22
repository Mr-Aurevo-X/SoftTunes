# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
<#
.SYNOPSIS
  Pont JSON Opti — lit une requête, appelle les modules, écrit une réponse.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$InFile,
    [Parameter(Mandatory)][string]$OutFile
)

$ErrorActionPreference = 'Stop'
try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $global:OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$Global:OptiRoot = Split-Path $PSScriptRoot -Parent
if ($env:OPTI_DATA_DIR) {
    $Global:OptiDataDir = $env:OPTI_DATA_DIR
} else {
    $Global:OptiDataDir = $Global:OptiRoot
}
$modDir = Join-Path $Global:OptiRoot 'modules'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
foreach ($modName in @(
        'Core.ps1'
        'Undo.ps1'
        'RestorePoint.ps1'
        'Sessions.ps1'
        'Health.ps1'
        'Power.ps1'
        'GameMode.ps1'
        'Boost.ps1'
        'Cleanup.ps1'
        'Network.ps1'
        'Visual.ps1'
        'Services.ps1'
        'Startup.ps1'
        'Debloat.ps1'
        'Timer.ps1'
        'Priority.ps1'
        'GameProfiles.ps1'
        'SoftPerf.ps1'
        'SoftOc.ps1'
    )) {
    $modPath = Join-Path $modDir $modName
    if (-not (Test-Path -LiteralPath $modPath)) { throw "Module manquant: $modPath" }
    try {
        $code = [System.IO.File]::ReadAllText($modPath, $utf8NoBom)
        if ($code.Length -gt 0 -and [int][char]$code[0] -eq 0xFEFF) { $code = $code.Substring(1) }
        . ([scriptblock]::Create($code))
    } catch {
        throw ("Echec chargement module {0}: {1}" -f $modName, $_.Exception.Message)
    }
}
$ErrorActionPreference = 'Continue'

$logsDir = Join-Path $Global:OptiDataDir 'logs'
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
$Global:OptiCurrentLog = Get-OptiSessionLogPath -BaseDir $Global:OptiDataDir
$Global:OptiProgressPath = Get-OptiProgressPath -BaseDir $Global:OptiDataDir

function Write-ApiResponse {
    param($Obj)
    $json = $Obj | ConvertTo-Json -Depth 14 -Compress
    [System.IO.File]::WriteAllText($OutFile, $json, [System.Text.UTF8Encoding]::new($false))
}

function Ok($data = $null) {
    Write-OptiProgress -Percent 100 -Phase 'Terminé' -Detail '' -Done $true
    Write-ApiResponse @{ ok = $true; error = $null; data = $data }
}

function Fail([string]$msg) {
    Write-OptiProgress -Percent 100 -Phase 'Erreur' -Detail $msg -Done $true -ErrorMessage $msg
    Write-ApiResponse @{ ok = $false; error = $msg; data = $null }
}

function Invoke-OptiSessionPreset {
    param(
        [bool]$CreateRestorePoint = $false,
        [string]$PowerProfile = 'high',
        [bool]$GameMode = $true,
        [bool]$DisableGameBar = $true,
        [bool]$FocusAssist = $true,
        [bool]$Visual = $true,
        [bool]$KillOverlays = $true,
        [bool]$IncludeDiscord = $false,
        [bool]$IncludeGpuOverlay = $false,
        [string]$LogPath
    )
    $steps = @()
    $rp = $null
    if ($CreateRestorePoint) {
        Write-OptiProgress -Percent 8 -Phase 'Session' -Detail 'Point de restauration...'
        $rp = New-OptiRestorePoint -Description 'SoftTunes Session'
        $steps += @{ step = 'restorePoint'; ok = [bool]$rp.Success }
    }
    Write-OptiProgress -Percent 25 -Phase 'Session' -Detail 'Power...'
    $pw = Set-OptiPowerPlan -Profile $PowerProfile -LogPath $LogPath
    $steps += @{ step = 'power'; ok = [bool]$pw.Success }
    Write-OptiProgress -Percent 45 -Phase 'Session' -Detail 'Game Mode...'
    $gm = Set-OptiGameModeSettings -GameMode $GameMode -DisableGameBar $DisableGameBar -FocusAssist $FocusAssist -LogPath $LogPath
    $steps += @{ step = 'gameMode'; ok = [bool]$gm.Success }
    if ($Visual) {
        Write-OptiProgress -Percent 65 -Phase 'Session' -Detail 'Visuel...'
        $vs = Set-OptiVisualGaming -LogPath $LogPath
        $steps += @{ step = 'visual'; ok = [bool]$vs.Success }
    }
    if ($KillOverlays) {
        Write-OptiProgress -Percent 85 -Phase 'Session' -Detail 'Overlays...'
        $bo = Start-OptiBoostSession -KillOverlays $true -IncludeDiscord $IncludeDiscord -IncludeGpuOverlay $IncludeGpuOverlay -LogPath $LogPath
        $steps += @{ step = 'overlays'; ok = [bool]$bo.Success }
    }
    return @{
        Success = $true
        Message = 'Session preset applied'
        MessageFr = 'Preset session appliqué'
        restorePoint = $rp
        power = $pw
        gameMode = $gm
        steps = $steps
    }
}

try {
    if (-not (Test-Path -LiteralPath $InFile)) { Fail "InFile introuvable: $InFile"; exit 1 }
    $raw = [System.IO.File]::ReadAllText($InFile, [System.Text.Encoding]::UTF8)
    $req = $raw | ConvertFrom-Json
    $action = [string]$req.action
    $p = $req.payload
    if (-not $p) { $p = [pscustomobject]@{} }
    Write-OptiProgress -Percent 1 -Phase $action -Detail 'Démarrage...' -Done $false

    switch ($action) {
        'ping' {
            Ok @{
                admin = [bool](Test-OptiAdmin)
                root  = $Global:OptiRoot
                log   = $Global:OptiCurrentLog
            }
        }

        'getHealth' {
            Ok (Get-OptiGamingHealth)
        }

        'createRestorePoint' {
            $desc = if ($p.description) { [string]$p.description } else { "Opti $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
            $r = New-OptiRestorePoint -Description $desc
            Add-OptiSession -Action 'restorePoint' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getPowerPlans' { Ok @{ plans = @(Get-OptiPowerPlans) } }
        'setPowerPlan' {
            $profile = if ($p.profile) { [string]$p.profile } else { 'high' }
            $r = Set-OptiPowerPlan -Profile $profile -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setPowerPlan' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getGameMode' { Ok (Get-OptiGameModeSettings) }
        'setGameMode' {
            $r = Set-OptiGameModeSettings `
                -GameMode:([bool]($p.gameMode -ne $false)) `
                -DisableGameBar:([bool]($p.disableGameBar -ne $false)) `
                -FocusAssist:([bool]$p.focusAssist) `
                -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setGameMode' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getBoostStatus' { Ok (Get-OptiBoostStatus) }
        'startBoost' {
            $r = Start-OptiBoostSession `
                -KillOverlays:([bool]($p.killOverlays -ne $false)) `
                -IncludeDiscord:([bool]$p.includeDiscord) `
                -IncludeGpuOverlay:([bool]$p.includeGpuOverlay) `
                -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'startBoost' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'stopBoost' {
            $r = Stop-OptiBoostSession -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'stopBoost' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'scanCleanup' { Ok (Invoke-OptiCleanupScan) }
        'runCleanup' {
            $ids = @($p.ids)
            $r = Invoke-OptiCleanupRun -Ids $ids -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'runCleanup' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getDnsPresets' { Ok @{ presets = @(Get-OptiDnsPresets) } }
        'flushDns' {
            $r = Invoke-OptiDnsFlush -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'flushDns' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'setDns' {
            $id = if ($p.presetId) { [string]$p.presetId } else { 'cloudflare' }
            $r = Set-OptiDnsPreset -PresetId $id -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setDns' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'setNetworkTweaks' {
            $r = Set-OptiNetworkTweaks -TcpGaming:([bool]$p.tcpGaming) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setNetworkTweaks' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getVisual' { Ok (Get-OptiVisualSettings) }
        'setVisual' {
            $r = Set-OptiVisualGaming `
                -ReduceEffects:([bool]($p.reduceEffects -ne $false)) `
                -DisableAnimations:([bool]($p.disableAnimations -ne $false)) `
                -DisableTransparency:([bool]($p.disableTransparency -ne $false)) `
                -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setVisual' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getServices' { Ok @{ items = @(Get-OptiGamingServices) } }
        'setServices' {
            $names = @($p.names)
            $r = Set-OptiGamingServices -DisableNames $names -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setServices' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getStartup' { Ok @{ items = @(Get-OptiStartupItems) } }
        'disableStartup' {
            $items = @($p.items)
            $r = Disable-OptiStartupItems -Items $items -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'disableStartup' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'scanBloat' { Ok @{ apps = @(Get-OptiBloatCandidates) } }
        'removeBloat' {
            Fail 'Action desactivee (removeBloat).'
        }

        'setTimer' {
            Fail 'Action desactivee (setTimer).'
        }
        'clearTimer' {
            Fail 'Action desactivee (clearTimer).'
        }

        'setPriority' {
            Fail 'Action desactivee (setPriority).'
        }
        'setMmcs' {
            Fail 'Action desactivee (setMmcs).'
        }

        'getSoftPerf' { Ok (Get-OptiSoftPerf) }
        'setSoftPerfOs' {
            $r = Set-OptiSoftPerfOs `
                -EnableSoftOs:([bool]($p.enableSoftOs -ne $false)) `
                -SetHags:([bool]$p.setHags) `
                -HagsEnabled:([bool]($p.hagsEnabled -ne $false)) `
                -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setSoftPerfOs' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'setNvidiaPowerLimit' {
            $preset = if ($p.preset) { [string]$p.preset } else { 'stock' }
            $r = Set-OptiNvidiaPowerLimit -Preset $preset -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setNvidiaPowerLimit' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'resetSoftPerf' {
            $r = Reset-OptiSoftPerf -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'resetSoftPerf' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getSoftOc' { Ok (Get-OptiSoftOc) }
        'setNvidiaClocks' {
            $preset = if ($p.preset) { [string]$p.preset } else { 'stock' }
            $r = Set-OptiNvidiaClocks -Preset $preset -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setNvidiaClocks' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'resetNvidiaClocks' {
            $r = Reset-OptiNvidiaClocks -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'resetNvidiaClocks' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'openAfterburner' {
            $r = Open-OptiAfterburner
            Ok $r
        }
        'openAmdSoftware' {
            $r = Open-OptiAmdSoftware
            Ok $r
        }

        'findGames' { Ok @{ games = @(Find-OptiGameExecutables) } }
        'getProfiles' { Ok @{ profiles = @(Get-OptiGameProfiles); last = (Get-OptiLastProfile) } }
        'saveProfile' {
            $settings = @{}
            if ($p.settings) {
                $p.settings.PSObject.Properties | ForEach-Object { $settings[$_.Name] = $_.Value }
            }
            $entry = Upsert-OptiGameProfile -Name ([string]$p.name) -ExePath ([string]$p.exePath) -Settings $settings
            Ok $entry
        }
        'applyProfile' {
            Fail 'Action desactivee (applyProfile).'
        }

        'getSessions' { Ok @{ sessions = @(Get-OptiSessions) } }
        'getUndoList' { Ok @{ items = @(Get-OptiUndoList) } }
        'runUndo' {
            $r = Invoke-OptiUndo -Id ([string]$p.id) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'undo' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'applySessionPreset' {
            $createRp = [bool]$p.createRestorePoint
            $r = Invoke-OptiSessionPreset `
                -CreateRestorePoint $createRp `
                -PowerProfile ($(if ($p.powerProfile) { [string]$p.powerProfile } else { 'high' })) `
                -GameMode:([bool]($p.gameMode -ne $false)) `
                -DisableGameBar:([bool]($p.disableGameBar -ne $false)) `
                -FocusAssist:([bool]($p.focusAssist -ne $false)) `
                -Visual:([bool]($p.visual -ne $false)) `
                -KillOverlays:([bool]($p.killOverlays -ne $false)) `
                -IncludeDiscord:([bool]$p.includeDiscord) `
                -IncludeGpuOverlay:([bool]$p.includeGpuOverlay) `
                -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'applySessionPreset' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'applyGamingPreset' {
            Fail 'Action desactivee (applyGamingPreset).'
        }

        default { Fail "Action inconnue: $action" }
    }
}
catch {
    Fail $_.Exception.Message
    exit 1
}
