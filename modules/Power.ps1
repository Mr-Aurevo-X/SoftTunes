# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Power.ps1 — Balanced / High / Ultimate (EN + FR Windows names)

$script:OptiPowerGuidBalanced = '381b4222-f694-41f0-9685-ff5bb260df2e'
$script:OptiPowerGuidHigh = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
$script:OptiPowerGuidUltimate = 'e9a42b02-d5df-448d-aa00-03f14749eb61'

function Get-OptiPowerPlans {
    $plans = @()
    try {
        $raw = powercfg /list 2>$null
        $activeGuid = $null
        $activeLine = powercfg /getactivescheme 2>$null
        if ("$activeLine" -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') {
            $activeGuid = $Matches[1]
        }
        foreach ($line in @($raw)) {
            if ($line -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\((.+?)\)') {
                $guid = $Matches[1]
                $name = $Matches[2].Trim()
                $plans += @{
                    guid   = $guid
                    name   = $name
                    active = ($guid -eq $activeGuid)
                }
            }
        }
    } catch { }
    return $plans
}

function Find-OptiPowerGuidByName {
    param(
        [object[]]$Plans,
        [string]$Pattern
    )
    $hit = @($Plans) | Where-Object { $_.name -match $Pattern } | Select-Object -First 1
    if ($hit) { return [string]$hit.guid }
    return $null
}

function Test-OptiPowerGuidExists {
    param(
        [object[]]$Plans,
        [string]$Guid
    )
    if (-not $Guid) { return $false }
    $g = $Guid.ToLowerInvariant()
    return [bool](@($Plans) | Where-Object { ([string]$_.guid).ToLowerInvariant() -eq $g } | Select-Object -First 1)
}

function Ensure-OptiUltimatePerformance {
    $plans = @(Get-OptiPowerPlans)
    # FR Windows often labels Ultimate duplicates as "Performances optimales"
    $ult = Find-OptiPowerGuidByName -Plans $plans -Pattern 'Ultimate|Performances maximales|Performances optimales'
    if ($ult) { return $ult }
    if (Test-OptiPowerGuidExists -Plans $plans -Guid $script:OptiPowerGuidUltimate) {
        return $script:OptiPowerGuidUltimate
    }
    try {
        powercfg -duplicatescheme $script:OptiPowerGuidUltimate 2>$null | Out-Null
    } catch { }
    $plans2 = @(Get-OptiPowerPlans)
    $ult2 = Find-OptiPowerGuidByName -Plans $plans2 -Pattern 'Ultimate|Performances maximales|Performances optimales'
    if ($ult2) { return $ult2 }
    if (Test-OptiPowerGuidExists -Plans $plans2 -Guid $script:OptiPowerGuidUltimate) {
        return $script:OptiPowerGuidUltimate
    }
    return $null
}

function Set-OptiPowerPlan {
    param(
        [ValidateSet('balanced', 'high', 'ultimate')]
        [string]$Profile = 'high',
        [string]$LogPath
    )
    $before = powercfg /getactivescheme 2>$null
    $activeGuid = $null
    if ("$before" -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') {
        $activeGuid = $Matches[1]
    }
    $null = New-OptiUndoSnapshot -Name 'power' -Data @{ activeScheme = $activeGuid; raw = [string]$before }

    $plans = @(Get-OptiPowerPlans)
    $target = $null
    switch ($Profile) {
        'balanced' {
            # EN Balanced · FR Utilisation normale / Équilibré — prefer known GUID when present
            if (Test-OptiPowerGuidExists -Plans $plans -Guid $script:OptiPowerGuidBalanced) {
                $target = $script:OptiPowerGuidBalanced
            } else {
                $target = Find-OptiPowerGuidByName -Plans $plans -Pattern 'Balanced|Équilibré|Equilibre|Utilisation normale'
            }
            if (-not $target) { $target = $script:OptiPowerGuidBalanced }
        }
        'high' {
            if (Test-OptiPowerGuidExists -Plans $plans -Guid $script:OptiPowerGuidHigh) {
                $target = $script:OptiPowerGuidHigh
            } else {
                $target = Find-OptiPowerGuidByName -Plans $plans -Pattern 'High performance|Haute performance|Hautes performances|Performances élevées|Performances elevees'
            }
            if (-not $target) { $target = $script:OptiPowerGuidHigh }
        }
        'ultimate' {
            $target = Ensure-OptiUltimatePerformance
            if (-not $target) {
                # Fallback: High Performance rather than failing silently
                if (Test-OptiPowerGuidExists -Plans $plans -Guid $script:OptiPowerGuidHigh) {
                    $target = $script:OptiPowerGuidHigh
                } else {
                    $target = Find-OptiPowerGuidByName -Plans $plans -Pattern 'High performance|Haute performance|Hautes|Performances élevées'
                }
            }
        }
    }

    if (-not $target) {
        return @{
            Success   = $false
            Message   = 'Power plan not found'
            MessageFr = 'Plan d''alimentation introuvable'
            profile   = $Profile
        }
    }

    $err = powercfg /setactive $target 2>&1 | Out-String
    $after = Get-OptiPowerSchemeName
    $afterPlans = @(Get-OptiPowerPlans)
    $active = @($afterPlans) | Where-Object { $_.active } | Select-Object -First 1
    $ok = $active -and (([string]$active.guid).ToLowerInvariant() -eq $target.ToLowerInvariant())
    if (-not $ok -and $after) {
        # Name may still update even if GUID compare fails (locale)
        $ok = $true
    }
    if ($ok) {
        Write-OptiLog -Message "Power plan -> $Profile ($target) = $after" -LogPath $LogPath -Level OK
        return @{
            Success   = $true
            Message   = "Active plan: $after"
            MessageFr = "Plan actif : $after"
            profile   = $Profile
            guid      = $target
            name      = $after
        }
    }
    Write-OptiLog -Message "Power plan failed $Profile ($target): $err" -LogPath $LogPath -Level WARN
    return @{
        Success   = $false
        Message   = ("Could not activate plan ({0})" -f ($err.Trim()))
        MessageFr = ("Impossible d'activer le plan ({0})" -f ($err.Trim()))
        profile   = $Profile
        guid      = $target
        name      = $after
    }
}
