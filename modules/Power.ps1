# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Power.ps1 — High Performance / Ultimate Performance

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
            if ($line -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\((.+)\)') {
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

function Ensure-OptiUltimatePerformance {
    $plans = @(Get-OptiPowerPlans)
    $ult = $plans | Where-Object { $_.name -match 'Ultimate|Performances maximales' } | Select-Object -First 1
    if ($ult) { return $ult.guid }
    # Duplicate Ultimate Performance scheme (GUID known)
    $ultimateGuid = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
    try {
        powercfg -duplicatescheme $ultimateGuid 2>$null | Out-Null
    } catch { }
    $plans2 = @(Get-OptiPowerPlans)
    $ult2 = $plans2 | Where-Object { $_.name -match 'Ultimate|Performances maximales' } | Select-Object -First 1
    if ($ult2) { return $ult2.guid }
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

    $target = $null
    $plans = @(Get-OptiPowerPlans)
    switch ($Profile) {
        'balanced' {
            $target = ($plans | Where-Object { $_.name -match 'Balanced|Équilibré' } | Select-Object -First 1).guid
            if (-not $target) { $target = '381b4222-f694-41f0-9685-ff5bb260df2e' }
        }
        'high' {
            $target = ($plans | Where-Object { $_.name -match 'High performance|Hautes performances|Performances élevées' } | Select-Object -First 1).guid
            if (-not $target) { $target = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c' }
        }
        'ultimate' {
            $target = Ensure-OptiUltimatePerformance
            if (-not $target) {
                $target = ($plans | Where-Object { $_.name -match 'High performance|Hautes|Performances élevées' } | Select-Object -First 1).guid
            }
        }
    }

    if (-not $target) {
        return @{ Success = $false; Message = 'Plan introuvable' }
    }

    powercfg /setactive $target 2>$null
    $after = Get-OptiPowerSchemeName
    Write-OptiLog -Message "Power plan -> $Profile ($target) = $after" -LogPath $LogPath -Level OK
    return @{ Success = $true; Message = "Plan actif: $after"; profile = $Profile; guid = $target; name = $after }
}
