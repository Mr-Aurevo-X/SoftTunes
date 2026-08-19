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

$ErrorActionPreference = 'Continue'
try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $global:OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

$Global:OptiRoot = Split-Path $PSScriptRoot -Parent
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
    $code = [System.IO.File]::ReadAllText($modPath, $utf8NoBom)
    if ($code.Length -gt 0 -and [int][char]$code[0] -eq 0xFEFF) { $code = $code.Substring(1) }
    . ([scriptblock]::Create($code))
}

$logsDir = Join-Path $Global:OptiRoot 'logs'
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
$Global:OptiCurrentLog = Get-OptiSessionLogPath -BaseDir $Global:OptiRoot
$Global:OptiProgressPath = Get-OptiProgressPath -BaseDir $Global:OptiRoot

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
            $names = @($p.packageFullNames)
            $r = Remove-OptiBloatApps -PackageFullNames $names -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'removeBloat' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'setTimer' {
            $r = Set-OptiTimerResolution -Enable:([bool]$p.enable) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setTimer' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'clearTimer' {
            Ok (Clear-OptiTimerResolution -LogPath $Global:OptiCurrentLog)
        }

        'setPriority' {
            $r = Set-OptiProcessPriority -ProcessName ([string]$p.processName) -Priority ($(if ($p.priority) { [string]$p.priority } else { 'High' })) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setPriority' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }
        'setMmcs' {
            $r = Set-OptiSystemResponsiveness -Gaming:([bool]($p.gaming -ne $false)) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'setMmcs' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
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
            $r = Invoke-OptiGameProfile -Name ([string]$p.name) -Launch:([bool]($p.launch -ne $false)) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'applyProfile' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'getSessions' { Ok @{ sessions = @(Get-OptiSessions) } }
        'getUndoList' { Ok @{ items = @(Get-OptiUndoList) } }
        'runUndo' {
            $r = Invoke-OptiUndo -Id ([string]$p.id) -LogPath $Global:OptiCurrentLog
            Add-OptiSession -Action 'undo' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        'applyGamingPreset' {
            Write-OptiProgress -Percent 3 -Phase 'Preset' -Detail 'Score avant...'
            $beforeHealth = Get-OptiGamingHealth
            $beforeSnap = Save-OptiScoreSnapshot -Score ([int]$beforeHealth.score) -Grade ([string]$beforeHealth.grade) -LabelFr ([string]$beforeHealth.labelFr) -Context 'before-preset'

            Write-OptiProgress -Percent 8 -Phase 'Preset' -Detail 'Point de restauration...'
            $rp = New-OptiRestorePoint -Description 'Opti Gaming Preset'
            Write-OptiProgress -Percent 25 -Phase 'Preset' -Detail 'Power...'
            $pw = Set-OptiPowerPlan -Profile 'high' -LogPath $Global:OptiCurrentLog
            Write-OptiProgress -Percent 45 -Phase 'Preset' -Detail 'Game Mode...'
            $gm = Set-OptiGameModeSettings -GameMode $true -DisableGameBar $true -FocusAssist $true -LogPath $Global:OptiCurrentLog
            Write-OptiProgress -Percent 65 -Phase 'Preset' -Detail 'Visuel...'
            $vs = Set-OptiVisualGaming -LogPath $Global:OptiCurrentLog
            Write-OptiProgress -Percent 85 -Phase 'Preset' -Detail 'Boost...'
            $bo = Start-OptiBoostSession -KillOverlays $true -LogPath $Global:OptiCurrentLog

            Write-OptiProgress -Percent 95 -Phase 'Preset' -Detail 'Score après...'
            $afterHealth = Get-OptiGamingHealth -SettleFirst
            $afterSnap = Save-OptiScoreSnapshot -Score ([int]$afterHealth.score) -Grade ([string]$afterHealth.grade) -LabelFr ([string]$afterHealth.labelFr) -Context 'after-preset'

            $delta = [int]$afterHealth.score - [int]$beforeHealth.score
            $settingsDelta = [int][math]::Round(
                (([int]$afterHealth.breakdown.power - [int]$beforeHealth.breakdown.power) * 0.2) +
                (([int]$afterHealth.breakdown.game - [int]$beforeHealth.breakdown.game) * 0.15)
            )
            $deltaLabel = if ($delta -ge 0) { "+$delta" } else { "$delta" }
            $scoreNoteFr = $null
            $scoreNoteEn = $null
            if ($delta -lt 0 -and $settingsDelta -gt 0) {
                $scoreNoteFr = 'Réglages appliqués (alimentation / Game Mode). La baisse vient surtout de la charge CPU/RAM pendant l''opération — rafraîchissez dans quelques secondes.'
                $scoreNoteEn = 'Settings applied (power / Game Mode). The drop is mostly from temporary CPU/RAM load — refresh in a few seconds.'
            } elseif ($delta -lt 0) {
                $scoreNoteFr = 'Charge système élevée pendant l''optimisation (point de restauration, etc.). Rafraîchissez dans quelques secondes pour un score stable.'
                $scoreNoteEn = 'System load was high during optimization (restore point, etc.). Refresh in a few seconds for a stable score.'
            }
            $r = @{
                Success = $true
                Message = ('Preset OK - score {0} -> {1} ({2})' -f $beforeHealth.score, $afterHealth.score, $deltaLabel)
                restorePoint = $rp
                power = $pw
                gameMode = $gm
                visual = $vs
                boost = $bo
                before = $beforeSnap
                after = $afterSnap
                beforeHealth = $beforeHealth
                afterHealth = $afterHealth
                delta = $delta
                settingsDelta = $settingsDelta
                scoreNoteFr = $scoreNoteFr
                scoreNoteEn = $scoreNoteEn
            }
            Add-OptiSession -Action 'applyGamingPreset' -Result $r -LogPath $Global:OptiCurrentLog | Out-Null
            Ok $r
        }

        default { Fail "Action inconnue: $action" }
    }
}
catch {
    Fail $_.Exception.Message
    exit 1
}
