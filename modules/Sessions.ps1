# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

#Requires -Version 5.1
# Sessions.ps1 — journal sessions Opti

function Get-OptiSessionsDir {
    $dir = Join-Path (Get-OptiDataDir) 'sessions'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return $dir
}

function Add-OptiSession {
    param(
        [string]$Action,
        [hashtable]$Result,
        [string]$LogPath
    )
    $dir = Get-OptiSessionsDir
    $id = Get-Date -Format 'yyyyMMdd_HHmmss'
    $entry = [ordered]@{
        id        = $id
        action    = $Action
        createdAt = (Get-Date).ToString('o')
        result    = $Result
        log       = $LogPath
    }
    $path = Join-Path $dir ("session-$id.json")
    [System.IO.File]::WriteAllText($path, ($entry | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
    return $entry
}

function Get-OptiSessions {
    param([int]$Limit = 40)
    $dir = Get-OptiSessionsDir
    $items = @()
    Get-ChildItem -LiteralPath $dir -Filter 'session-*.json' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First $Limit |
        ForEach-Object {
            try {
                $o = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                $items += @{
                    id        = $o.id
                    action    = $o.action
                    createdAt = $o.createdAt
                    summary   = if ($o.result.Message) { [string]$o.result.Message } elseif ($o.result.message) { [string]$o.result.message } else { $o.action }
                }
            } catch { }
        }
    return $items
}

function Get-OptiSessionStats {
    $sessions = @(Get-OptiSessions -Limit 200)
    return @{
        sessionCount = $sessions.Count
        lastAction   = if ($sessions.Count -gt 0) { $sessions[0].action } else { $null }
        lastAt       = if ($sessions.Count -gt 0) { $sessions[0].createdAt } else { $null }
    }
}
