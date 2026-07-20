#Requires -Version 5.1
# Debloat.ps1 — optional AppX removal for gaming-irrelevant packages (keep-list)

function Get-OptiKeepApps {
    $list = @(Get-OptiListLines -RelativeName 'keep-apps.txt')
    if ($list.Count -eq 0) {
        return @(
            'Microsoft.WindowsStore', 'Microsoft.XboxGameOverlay', 'Microsoft.XboxIdentityProvider',
            'Microsoft.Xbox.TCUI', 'Microsoft.GamingApp', 'Microsoft.DesktopAppInstaller',
            'Microsoft.WindowsCalculator', 'Microsoft.Windows.Photos', 'Microsoft.WindowsTerminal',
            'Microsoft.WindowsNotepad', 'Microsoft.Paint', 'Microsoft.ScreenSketch'
        )
    }
    return $list
}

function Get-OptiBloatCandidates {
    $candidates = @(Get-OptiListLines -RelativeName 'bloat-apps.txt')
    if ($candidates.Count -eq 0) {
        $candidates = @(
            'Microsoft.BingNews', 'Microsoft.BingWeather', 'Microsoft.BingFinance',
            'Microsoft.GetHelp', 'Microsoft.Getstarted', 'Microsoft.MicrosoftOfficeHub',
            'Microsoft.MicrosoftSolitaireCollection', 'Microsoft.People',
            'Microsoft.WindowsFeedbackHub', 'Microsoft.WindowsMaps', 'Microsoft.ZuneMusic',
            'Microsoft.ZuneVideo', 'microsoft.windowscommunicationsapps', 'Microsoft.Todos',
            'Microsoft.PowerAutomateDesktop', 'Microsoft.Microsoft3DViewer', 'Microsoft.SkypeApp'
        )
    }
    $keep = @(Get-OptiKeepApps)
    $found = @()
    foreach ($pkg in $candidates) {
        $keepHit = $false
        foreach ($k in $keep) {
            if ($pkg -like "*$k*" -or $k -like "*$pkg*") { $keepHit = $true; break }
        }
        if ($keepHit) { continue }
        $apps = @(Get-AppxPackage -Name $pkg -ErrorAction SilentlyContinue)
        foreach ($a in $apps) {
            $found += @{
                Name = $a.Name
                PackageFullName = $a.PackageFullName
                Version = [string]$a.Version
                Selected = $true
            }
        }
    }
    return $found
}

function Remove-OptiBloatApps {
    param(
        [string[]]$PackageFullNames,
        [string]$LogPath
    )
    $keep = @(Get-OptiKeepApps)
    $removed = @()
    $skipped = @()
    $i = 0
    foreach ($pfn in @($PackageFullNames)) {
        $i++
        Write-OptiProgress -Percent (10 + [int](80 * $i / [math]::Max(1, $PackageFullNames.Count))) -Phase 'Debloat' -Detail $pfn
        $blocked = $false
        foreach ($k in $keep) {
            if ($pfn -like "*$k*") { $blocked = $true; break }
        }
        if ($blocked) {
            $skipped += @{ Name = $pfn; Reason = 'keep-list' }
            continue
        }
        try {
            Remove-AppxPackage -Package $pfn -ErrorAction Stop
            $removed += $pfn
            Write-OptiLog -Message "Removed AppX $pfn" -LogPath $LogPath -Level OK
        } catch {
            $skipped += @{ Name = $pfn; Reason = $_.Exception.Message }
        }
    }
    return @{
        Success = $true
        Message = ("{0} apps retirées" -f $removed.Count)
        removed = $removed
        skipped = $skipped
    }
}
