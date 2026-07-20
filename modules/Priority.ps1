#Requires -Version 5.1
# Priority.ps1 — process priority / MMCS gaming

function Set-OptiProcessPriority {
    param(
        [string]$ProcessName,
        [ValidateSet('Normal', 'AboveNormal', 'High')]
        [string]$Priority = 'High',
        [string]$LogPath
    )
    if ([string]::IsNullOrWhiteSpace($ProcessName)) {
        return @{ Success = $false; Message = 'ProcessName requis' }
    }
    $name = $ProcessName -replace '\.exe$', ''
    $procs = @(Get-Process -Name $name -ErrorAction SilentlyContinue)
    if ($procs.Count -eq 0) {
        return @{ Success = $false; Message = "Processus introuvable: $name" }
    }
    $changed = @()
    foreach ($p in $procs) {
        try {
            $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::$Priority
            $changed += @{ Name = $p.ProcessName; Id = $p.Id; Priority = $Priority }
            Write-OptiLog -Message "Priority $($p.ProcessName) ($($p.Id)) -> $Priority" -LogPath $LogPath -Level OK
        } catch {
            Write-OptiLog -Message "Priority fail $($p.Id): $($_.Exception.Message)" -LogPath $LogPath -Level WARN
        }
    }
    return @{
        Success = $true
        Message = ("Priorité $Priority sur {0} process" -f $changed.Count)
        changed = $changed
    }
}

function Set-OptiSystemResponsiveness {
    param(
        [bool]$Gaming = $true,
        [string]$LogPath
    )
    # Multimedia Class Scheduler — SystemResponsiveness (0-100, lower = more for games)
    $path = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
    $games = Join-Path $path 'Tasks\Games'
    $prev = $null
    $prevGpu = $null
    $prevPrio = $null
    $prevSched = $null
    try {
        $cur = Get-ItemProperty -Path $path -Name 'SystemResponsiveness' -ErrorAction SilentlyContinue
        if ($null -ne $cur.SystemResponsiveness) { $prev = [int]$cur.SystemResponsiveness }
    } catch { }
    try {
        if (Test-Path $games) {
            $g = Get-ItemProperty -Path $games -ErrorAction SilentlyContinue
            if ($null -ne $g.'GPU Priority') { $prevGpu = [int]$g.'GPU Priority' }
            if ($null -ne $g.Priority) { $prevPrio = [int]$g.Priority }
            if ($null -ne $g.'Scheduling Category') { $prevSched = [string]$g.'Scheduling Category' }
        }
    } catch { }
    $null = New-OptiUndoSnapshot -Name 'priority-mmcs' -Data @{
        SystemResponsiveness = $prev
        GamesGpuPriority     = $prevGpu
        GamesPriority        = $prevPrio
        GamesScheduling      = $prevSched
    }
    $val = if ($Gaming) { 10 } else { 20 }
    try {
        if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
        Set-ItemProperty -Path $path -Name 'SystemResponsiveness' -Value $val -Type DWord -ErrorAction Stop
        # Games task
        if (-not (Test-Path $games)) { New-Item -Path $games -Force | Out-Null }
        Set-ItemProperty -Path $games -Name 'GPU Priority' -Value 8 -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $games -Name 'Priority' -Value 6 -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $games -Name 'Scheduling Category' -Value 'High' -ErrorAction SilentlyContinue
        Write-OptiLog -Message "MMCS SystemResponsiveness=$val" -LogPath $LogPath -Level OK
        return @{ Success = $true; Message = "MMCS gaming (responsiveness=$val)"; value = $val }
    } catch {
        return @{ Success = $false; Message = $_.Exception.Message }
    }
}
