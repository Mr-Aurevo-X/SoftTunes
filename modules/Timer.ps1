#Requires -Version 5.1
# Timer.ps1 — multimedia timer resolution (opt-in via winmm)

function Set-OptiTimerResolution {
    param(
        [bool]$Enable = $false,
        [int]$HundredNs = 5000,  # 0.5 ms
        [string]$LogPath
    )
    if (-not $Enable) {
        return @{ Success = $true; Message = 'Timer resolution non modifiée (opt-in requis)'; enabled = $false }
    }

    # Use a small C# helper via Add-Type to call timeBeginPeriod
    $code = @"
using System;
using System.Runtime.InteropServices;
public static class OptiTimer {
  [DllImport("winmm.dll", EntryPoint="timeBeginPeriod")]
  public static extern uint TimeBeginPeriod(uint uPeriod);
  [DllImport("winmm.dll", EntryPoint="timeEndPeriod")]
  public static extern uint TimeEndPeriod(uint uPeriod);
}
"@
    try {
        if (-not ([System.Management.Automation.PSTypeName]'OptiTimer').Type) {
            Add-Type -TypeDefinition $code -ErrorAction Stop
        }
        $ms = [math]::Max(1, [int]($HundredNs / 10000))
        if ($ms -lt 1) { $ms = 1 }
        $rc = [OptiTimer]::TimeBeginPeriod([uint32]$ms)
        $marker = Join-Path (Get-OptiDataDir) 'timer-active.json'
        @{ ms = $ms; startedAt = (Get-Date).ToString('o') } | ConvertTo-Json |
            Set-Content -LiteralPath $marker -Encoding UTF8
        Write-OptiLog -Message "timeBeginPeriod($ms) rc=$rc" -LogPath $LogPath -Level OK
        return @{
            Success = $true
            Message = "Timer resolution ~${ms}ms (session process Opti). Avertissement: impact batterie / thermiques."
            enabled = $true
            ms = $ms
            warning = 'Opt-in agressif — actif tant que le host Opti tourne.'
        }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message; enabled = $false }
    }
}

function Clear-OptiTimerResolution {
    param([string]$LogPath)
    try {
        if (([System.Management.Automation.PSTypeName]'OptiTimer').Type) {
            $marker = Join-Path (Get-OptiDataDir) 'timer-active.json'
            $ms = 1
            if (Test-Path $marker) {
                try { $ms = [int]((Get-Content $marker -Raw | ConvertFrom-Json).ms) } catch { }
                Remove-Item $marker -Force -ErrorAction SilentlyContinue
            }
            [OptiTimer]::TimeEndPeriod([uint32]$ms) | Out-Null
        }
        Write-OptiLog -Message 'Timer resolution cleared' -LogPath $LogPath -Level INFO
        return @{ Success = $true; Message = 'Timer resolution restaurée' }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message }
    }
}
