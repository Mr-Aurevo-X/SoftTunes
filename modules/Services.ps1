# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Services.ps1 — gaming-safe service toggles with protect list

function Get-OptiProtectServices {
    $list = @(Get-OptiListLines -RelativeName 'protect-services.txt')
    if ($list.Count -eq 0) {
        return @(
            'WinDefend', 'WdNisSvc', 'Sense', 'mpssvc', 'wuauserv', 'UsoSvc', 'WaaSMedicSvc',
            'AudioEndpointBuilder', 'Audiosrv', 'RpcSs', 'DcomLaunch', 'Dhcp', 'Dnscache',
            'NlaSvc', 'netprofm', 'nsi', 'EventLog', 'Power', 'Schedule', 'ProfSvc',
            'SamSs', 'LanmanServer', 'LanmanWorkstation', 'CryptSvc', 'BFE', 'CoreMessagingRegistrar'
        )
    }
    return $list
}

function Get-OptiGamingServices {
    $names = @(Get-OptiListLines -RelativeName 'gaming-services.txt')
    if ($names.Count -eq 0) {
        $names = @(
            'SysMain', 'WSearch', 'DiagTrack', 'dmwappushservice', 'MapsBroker',
            'Fax', 'XblAuthManager', 'XblGameSave', 'XboxNetApiSvc', 'XboxGipSvc',
            'WMPNetworkSvc', 'RemoteRegistry', 'RetailDemo', 'PhoneSvc'
        )
    }
    $protect = @(Get-OptiProtectServices)
    $items = @()
    foreach ($n in $names) {
        if ($protect -contains $n) { continue }
        try {
            $svc = Get-Service -Name $n -ErrorAction Stop
            $items += @{
                Name = $svc.Name
                DisplayName = $svc.DisplayName
                Status = [string]$svc.Status
                StartType = [string]$svc.StartType
                Protected = $false
            }
        } catch {
            $items += @{
                Name = $n
                DisplayName = $n
                Status = 'Missing'
                StartType = 'Unknown'
                Protected = $false
            }
        }
    }
    return $items
}

function Set-OptiGamingServices {
    param(
        [string[]]$DisableNames,
        [string]$LogPath
    )
    $protect = @(Get-OptiProtectServices)
    $snapshot = @()
    $changed = @()
    $skipped = @()
    foreach ($n in @($DisableNames)) {
        if ($protect -contains $n) {
            $skipped += @{ Name = $n; Reason = 'protected' }
            continue
        }
        try {
            $svc = Get-Service -Name $n -ErrorAction Stop
            $snapshot += @{ Name = $svc.Name; Status = [string]$svc.Status; StartType = [string]$svc.StartType }
            Stop-Service -Name $n -Force -ErrorAction SilentlyContinue
            Set-Service -Name $n -StartupType Manual -ErrorAction SilentlyContinue
            $changed += $n
            Write-OptiLog -Message "Service $n -> Manual/Stopped" -LogPath $LogPath -Level OK
        } catch {
            $skipped += @{ Name = $n; Reason = $_.Exception.Message }
        }
    }
    if ($snapshot.Count -gt 0) {
        $null = New-OptiUndoSnapshot -Name 'services' -Data @{ services = $snapshot }
    }
    return @{
        Success = $true
        Message = ("{0} services ajustés" -f $changed.Count)
        changed = $changed
        skipped = $skipped
    }
}
