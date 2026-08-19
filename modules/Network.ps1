# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Network.ps1 — DNS presets, flush, light TCP tweaks (opt-in, reversible)

function Get-OptiDnsPresets {
    $presets = @(
        @{ id = 'cloudflare'; name = 'Cloudflare'; servers = @('1.1.1.1', '1.0.0.1') }
        @{ id = 'google'; name = 'Google'; servers = @('8.8.8.8', '8.8.4.4') }
        @{ id = 'quad9'; name = 'Quad9'; servers = @('9.9.9.9', '149.112.112.112') }
        @{ id = 'dhcp'; name = 'Automatique (DHCP)'; servers = @() }
    )
    foreach ($line in @(Get-OptiListLines -RelativeName 'dns-presets.txt')) {
        # format: id|name|ip1,ip2
        $parts = $line -split '\|'
        if ($parts.Count -ge 3) {
            $presets += @{
                id = $parts[0].Trim()
                name = $parts[1].Trim()
                servers = @($parts[2].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
            }
        }
    }
    return $presets
}

function Invoke-OptiDnsFlush {
    param([string]$LogPath)
    Write-OptiProgress -Percent 30 -Phase 'Réseau' -Detail 'ipconfig /flushdns...'
    $out = ipconfig /flushdns 2>&1 | Out-String
    try { Clear-DnsClientCache -ErrorAction SilentlyContinue } catch { }
    Write-OptiLog -Message "DNS flush: $out" -LogPath $LogPath -Level OK
    return @{ Success = $true; Message = 'Cache DNS vidé'; detail = $out.Trim() }
}

function Set-OptiDnsPreset {
    param(
        [string]$PresetId = 'cloudflare',
        [string]$LogPath
    )
    Write-OptiProgress -Percent 20 -Phase 'Réseau' -Detail 'DNS...'
    $presets = @(Get-OptiDnsPresets)
    $preset = $presets | Where-Object { $_.id -eq $PresetId } | Select-Object -First 1
    if (-not $preset) { return @{ Success = $false; Message = "Preset inconnu: $PresetId" } }

    $adapters = @()
    try {
        Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.ServerAddresses -and $_.InterfaceAlias -notmatch 'Loopback' } |
            ForEach-Object {
                $adapters += @{ index = $_.InterfaceIndex; alias = $_.InterfaceAlias; servers = @($_.ServerAddresses) }
            }
    } catch { }
    $null = New-OptiUndoSnapshot -Name 'network-dns' -Data @{ dnsAdapters = $adapters; preset = $PresetId }

    $applied = @()
    Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Virtual|Hyper-V|VPN' } | ForEach-Object {
        try {
            if ($PresetId -eq 'dhcp' -or -not $preset.servers -or $preset.servers.Count -eq 0) {
                Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ResetServerAddresses -ErrorAction Stop
            } else {
                Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses $preset.servers -ErrorAction Stop
            }
            $applied += $_.Name
        } catch {
            Write-OptiLog -Message ("DNS fail {0}: {1}" -f $_.Name, $_.Exception.Message) -LogPath $LogPath -Level WARN
        }
    }
    Write-OptiLog -Message ("DNS preset {0} on: {1}" -f $PresetId, ($applied -join ', ')) -LogPath $LogPath -Level OK
    return @{ Success = $true; Message = "DNS: $($preset.name)"; adapters = $applied; preset = $preset }
}

function Set-OptiNetworkTweaks {
    param(
        [bool]$TcpGaming = $false,
        [string]$LogPath
    )
    if (-not $TcpGaming) {
        return @{ Success = $true; Message = 'Aucun tweak TCP demandé'; applied = @() }
    }
    Write-OptiProgress -Percent 40 -Phase 'Réseau' -Detail 'Tweaks TCP (opt-in)...'
    # Soft / documented netsh tweaks — reversible via netsh reset note in undo
    $applied = @()
    try {
        netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
        $applied += 'autotune=normal'
    } catch { }
    try {
        netsh int tcp set global chimney=disabled 2>$null | Out-Null
        $applied += 'chimney=disabled'
    } catch { }
    try {
        # Nagle off for interactive — via TcpAckFrequency on interfaces is heavy; skip aggressive registry
        $null = New-OptiUndoSnapshot -Name 'network-tcp' -Data @{ note = 'netsh int tcp reset may be needed'; applied = $applied }
    } catch { }
    Write-OptiLog -Message ("TCP tweaks: {0}" -f ($applied -join ', ')) -LogPath $LogPath -Level OK
    return @{ Success = $true; Message = 'Tweaks TCP gaming légers appliqués'; applied = $applied; warning = 'Opt-in: utilise netsh int tcp reset pour revenir aux défauts si besoin.' }
}
